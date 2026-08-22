// LUMIA trade backend — Netlify Function + Blobs.
//
// Dealer endpoints (header x-dealer-code):
//   POST /api/login            {code}                 -> {name, prices}
//   GET  /api/orders                                  -> dealer's own orders
//   POST /api/order            {ref,kind,customer,notes,lines,total}
//   POST /api/order/cancel     {ref}                  (only while "Pending review")
//   POST /api/order/received   {ref}                  (dealer confirms the goods arrived)
//
// Admin endpoints (header authorization: Bearer <ADMIN_KEY>):
//   GET  /api/admin/dealers                           -> list with order counts
//   POST /api/admin/dealers    {name, mult}           -> {code}
//   POST /api/admin/dealer-active {code, active}
//   GET  /api/admin/orders                            -> all orders
//   POST /api/admin/status     {ref, status, locked, note}
//   POST /api/admin/paid       {ref, paid}            (mark order paid / unpaid)
//   POST /api/admin/received   {ref, received}        (LUMIA confirms delivery; together with
//                                                      the dealer's own confirmation this
//                                                      closes the order — both sides agree)
//   POST /api/admin/prices     {currency, products, notes}   (seed/update base prices)

import { getStore } from "@netlify/blobs";

export const config = { path: "/api/*" };

// strong consistency: dealer/order updates must be readable immediately
const store = () => getStore({ name: "trade", consistency: "strong" });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const bad = (msg, status = 400) => json({ error: msg }, status);

function isAdmin(req) {
  const key = process.env.ADMIN_KEY;
  return !!key && req.headers.get("authorization") === `Bearer ${key}`;
}

async function getDealers() {
  return (await store().get("dealers", { type: "json" })) || {};
}

async function dealerFromReq(req) {
  const code = (req.headers.get("x-dealer-code") || "").trim();
  if (!code) return null;
  const dealers = await getDealers();
  const d = dealers[code];
  return d && d.active !== false ? { code, ...d } : null;
}

/* prices are stored once at group-1 level; each dealer gets them scaled */
function scaled(base, mult) {
  const out = JSON.parse(JSON.stringify(base));
  for (const p of out.products || []) {
    for (const g of p.grids || []) {
      for (const r of g.rows || []) {
        r.vals = r.vals.map((v) => Math.round(v * mult * 100) / 100);
      }
    }
    for (const e of p.extras || []) {
      if (typeof e.usd === "number") e.usd = Math.round(e.usd * mult * 100) / 100;
    }
  }
  return out;
}

function newCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  return `LUMIA-${pick(4)}-${pick(4)}`;
}

async function listOrders(filterCode) {
  const s = store();
  const { blobs } = await s.list({ prefix: "order:" });
  const orders = [];
  for (const b of blobs) {
    const o = await s.get(b.key, { type: "json" });
    if (o && (!filterCode || o.code === filterCode)) orders.push(o);
  }
  orders.sort((a, b) => (a.at < b.at ? 1 : -1));
  return orders;
}

export default async (req) => {
  const path = new URL(req.url).pathname.replace(/\/$/, "");
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  // ── dealer: login ─────────────────────────────────────────────
  if (path === "/api/login" && req.method === "POST") {
    const code = String(body.code || "").trim();
    const dealers = await getDealers();
    const d = dealers[code];
    if (!d || d.active === false) return bad("invalid code", 401);
    const base = await store().get("prices", { type: "json" });
    if (!base) return bad("prices not loaded yet", 503);
    const promo = d.promo && d.promo.until && new Date(d.promo.until) > new Date() ? d.promo : null;
    const eff = (d.mult || 1) * (promo ? 1 - promo.pct / 100 : 1);
    return json({ name: d.name, prices: scaled(base, eff), promo });
  }

  // ── dealer: own orders ────────────────────────────────────────
  if (path === "/api/orders" && req.method === "GET") {
    const d = await dealerFromReq(req);
    if (!d) return bad("unauthorized", 401);
    return json({ orders: await listOrders(d.code) });
  }

  // ── dealer: submit or update an order ─────────────────────────
  if (path === "/api/order" && req.method === "POST") {
    const d = await dealerFromReq(req);
    if (!d) return bad("unauthorized", 401);
    const ref = String(body.ref || "").slice(0, 40);
    if (!ref || !Array.isArray(body.lines) || !body.lines.length) return bad("ref and lines required");
    const s = store();
    const key = `order:${ref}`;
    const existing = await s.get(key, { type: "json" });
    if (existing) {
      if (existing.code !== d.code) return bad("ref already in use", 409);
      if (existing.status && existing.status.locked) return bad("order is locked", 423);
    }
    const order = {
      ref,
      code: d.code,
      dealer: d.name,
      at: existing ? existing.at : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      kind: existing ? "update" : "new",
      customer: String(body.customer || "").slice(0, 200),
      notes: String(body.notes || "").slice(0, 2000),
      total: String(body.total || "").slice(0, 60),
      lines: body.lines.slice(0, 200),
      status: existing ? existing.status : { status: "Pending review", locked: false, note: "" },
      payment: existing ? existing.payment || null : null,
    };
    await s.setJSON(key, order);
    return json({ ok: true, ref, kind: order.kind });
  }

  // ── dealer: cancel an order still awaiting review ─────────────
  if (path === "/api/order/cancel" && req.method === "POST") {
    const d = await dealerFromReq(req);
    if (!d) return bad("unauthorized", 401);
    const s = store();
    const key = `order:${String(body.ref || "").slice(0, 40)}`;
    const o = await s.get(key, { type: "json" });
    if (!o || o.code !== d.code) return bad("no such order", 404);
    const st = o.status || {};
    if ((st.status || "Pending review") !== "Pending review")
      return bad("already accepted — contact us to cancel", 409);
    o.status = {
      status: "Cancelled",
      locked: true,
      note: st.note || "",
      by: "dealer",
      updatedAt: new Date().toISOString(),
    };
    o.updatedAt = new Date().toISOString();
    await s.setJSON(key, o);
    return json({ ok: true, status: o.status });
  }

  // ── dealer: confirm the goods arrived ─────────────────────────
  if (path === "/api/order/received" && req.method === "POST") {
    const d = await dealerFromReq(req);
    if (!d) return bad("unauthorized", 401);
    const s = store();
    const key = `order:${String(body.ref || "").slice(0, 40)}`;
    const o = await s.get(key, { type: "json" });
    if (!o || o.code !== d.code) return bad("no such order", 404);
    if (((o.status && o.status.status) || "Pending review") !== "Shipped")
      return bad("only a shipped order can be confirmed as received", 409);
    o.receipt = { ...(o.receipt || {}), dealerAt: new Date().toISOString() };
    await s.setJSON(key, o);
    return json({ ok: true, receipt: o.receipt });
  }

  // ── admin ──────────────────────────────────────────────────────
  if (path.startsWith("/api/admin/")) {
    if (!isAdmin(req)) return bad("unauthorized", 401);
    const s = store();

    if (path === "/api/admin/dealers" && req.method === "GET") {
      const dealers = await getDealers();
      const orders = await listOrders();
      const counts = {};
      for (const o of orders) counts[o.code] = (counts[o.code] || 0) + 1;
      const list = Object.entries(dealers).map(([code, d]) => ({ code, ...d, orders: counts[code] || 0 }));
      list.sort((a, b) => (a.created < b.created ? 1 : -1));
      return json({ dealers: list });
    }

    if (path === "/api/admin/dealers" && req.method === "POST") {
      const name = String(body.name || "").trim().slice(0, 120);
      const mult = Number(body.mult);
      if (!name || !isFinite(mult) || mult <= 0 || mult > 10) return bad("name and a sane multiplier required");
      const dealers = await getDealers();
      let code = String(body.code || "").trim() || newCode();
      while (dealers[code]) code = newCode();
      dealers[code] = { name, mult, active: true, created: new Date().toISOString(),
                        email: String(body.email || "").trim().slice(0, 200),
                        phone: String(body.phone || "").trim().slice(0, 60),
                        address: String(body.address || "").trim().slice(0, 300) };
      await s.setJSON("dealers", dealers);
      return json({ ok: true, code, name, mult });
    }

    if (path === "/api/admin/dealer-contact" && req.method === "POST") {
      const dealers = await getDealers();
      const d = dealers[String(body.code || "")];
      if (!d) return bad("no such dealer", 404);
      d.email = String(body.email || "").trim().slice(0, 200);
      d.phone = String(body.phone || "").trim().slice(0, 60);
      d.address = String(body.address || "").trim().slice(0, 300);
      await s.setJSON("dealers", dealers);
      return json({ ok: true });
    }

    if (path === "/api/admin/backup" && req.method === "GET") {
      const dealers = await getDealers();
      const prices = await s.get("prices", { type: "json" });
      const orders = await listOrders();
      return json({ exportedAt: new Date().toISOString(), dealers, prices, orders });
    }

    if (path === "/api/admin/dealer-mult" && req.method === "POST") {
      const dealers = await getDealers();
      const d = dealers[String(body.code || "")];
      if (!d) return bad("no such dealer", 404);
      const mult = Number(body.mult);
      if (!isFinite(mult) || mult <= 0 || mult > 10) return bad("bad multiplier");
      d.mult = mult;
      await s.setJSON("dealers", dealers);
      return json({ ok: true, mult });
    }

    if (path === "/api/admin/dealer-promo" && req.method === "POST") {
      const dealers = await getDealers();
      const d = dealers[String(body.code || "")];
      if (!d) return bad("no such dealer", 404);
      const pct = Number(body.pct), days = Number(body.days);
      if (!isFinite(pct) || pct <= 0) {
        delete d.promo;
      } else {
        if (pct > 90 || !isFinite(days) || days < 1 || days > 365) return bad("pct 1-90 and days 1-365 required");
        const until = new Date(Date.now() + days * 86400000);
        d.promo = { pct: Math.round(pct * 100) / 100, until: until.toISOString(), set: new Date().toISOString() };
      }
      await s.setJSON("dealers", dealers);
      return json({ ok: true, promo: d.promo || null });
    }

    if (path === "/api/admin/dealer-delete" && req.method === "POST") {
      const dealers = await getDealers();
      const code = String(body.code || "");
      if (!dealers[code]) return bad("no such dealer", 404);
      delete dealers[code];
      await s.setJSON("dealers", dealers);
      return json({ ok: true });
    }

    if (path === "/api/admin/dealer-active" && req.method === "POST") {
      const dealers = await getDealers();
      const d = dealers[String(body.code || "")];
      if (!d) return bad("no such dealer", 404);
      d.active = !!body.active;
      await s.setJSON("dealers", dealers);
      return json({ ok: true });
    }

    if (path === "/api/admin/orders" && req.method === "GET") {
      return json({ orders: await listOrders() });
    }

    if (path === "/api/admin/status" && req.method === "POST") {
      const key = `order:${String(body.ref || "")}`;
      const o = await s.get(key, { type: "json" });
      if (!o) return bad("no such order", 404);
      o.status = {
        status: String(body.status || "Pending review").slice(0, 60),
        locked: !!body.locked,
        note: String(body.note || "").slice(0, 500),
        updatedAt: new Date().toISOString(),
      };
      await s.setJSON(key, o);
      return json({ ok: true, status: o.status });
    }

    if (path === "/api/admin/paid" && req.method === "POST") {
      const key = `order:${String(body.ref || "")}`;
      const o = await s.get(key, { type: "json" });
      if (!o) return bad("no such order", 404);
      o.payment = { paid: !!body.paid, updatedAt: new Date().toISOString() };
      await s.setJSON(key, o);
      return json({ ok: true, payment: o.payment });
    }

    if (path === "/api/admin/received" && req.method === "POST") {
      const key = `order:${String(body.ref || "")}`;
      const o = await s.get(key, { type: "json" });
      if (!o) return bad("no such order", 404);
      o.receipt = { ...(o.receipt || {}), adminAt: body.received ? new Date().toISOString() : null };
      await s.setJSON(key, o);
      return json({ ok: true, receipt: o.receipt });
    }

    if (path === "/api/admin/prices" && req.method === "POST") {
      if (!Array.isArray(body.products) || !body.products.length) return bad("products required");
      await s.setJSON("prices", body);
      return json({ ok: true, products: body.products.length });
    }
  }

  return bad("not found", 404);
};
