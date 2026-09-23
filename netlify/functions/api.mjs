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

/* prices are stored once at group-1 level; each dealer gets them scaled.
   multOf(productId) -> effective multiplier, so a dealer can carry
   per-product overrides (d.mults) on top of their account level (d.mult) */
function scaled(base, multOf) {
  const out = JSON.parse(JSON.stringify(base));
  for (const p of out.products || []) {
    const mult = multOf(p.id);
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

// cancelled orders are kept for 30 days (measured from when they were
// cancelled), then purged for good the next time any order list is read
const CANCELLED_TTL_MS = 30 * 86400000;

async function listOrders(filterCode) {
  const s = store();
  const { blobs } = await s.list({ prefix: "order:" });
  const orders = [];
  for (const b of blobs) {
    const o = await s.get(b.key, { type: "json" });
    if (!o) continue;
    const st = o.status || {};
    if (st.status === "Cancelled") {
      const t = Date.parse(st.updatedAt || o.updatedAt || o.at);
      if (Number.isFinite(t) && Date.now() - t > CANCELLED_TTL_MS) {
        await s.delete(b.key);
        continue;
      }
    }
    if (!filterCode || o.code === filterCode) orders.push(o);
  }
  orders.sort((a, b) => (a.at < b.at ? 1 : -1));
  return orders;
}

// e-mail the owner when an order arrives, via Resend. Fully env-driven so no
// address lives in this public repo, and a no-op until the key is set:
//   RESEND_API_KEY      – from resend.com
//   ORDER_NOTIFY_EMAIL  – where notifications go (comma-separated for several)
//   ORDER_FROM          – optional sender; defaults to Resend's shared address
async function notifyOrder(order) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_NOTIFY_EMAIL;
  if (!apiKey || !to) return; // not configured yet
  const from = process.env.ORDER_FROM || "LUMIA orders <onboarding@resend.dev>";
  const lines = (order.lines || [])
    .map((l, i) =>
      `${i + 1}. ${l.label ? "[" + l.label + "] " : ""}${l.product} — ${l.spec || ""}` +
      (l.w == null ? " — by the yard" : ` — ${l.w}″ × ${l.h}″`) +
      ` — qty ${l.qty}` + (l.price != null ? ` — $${(l.price * l.qty).toFixed(2)}` : " — TBD"))
    .join("\n");
  const subject = `${order.kind === "update" ? "Order update" : "New order"} ${order.ref} — ${order.dealer}`;
  const text =
    `${order.kind === "update" ? "Updated order" : "New order"} from ${order.dealer}\n` +
    `Ref: ${order.ref}\n` +
    (order.customer ? `Customer / project: ${order.customer}\n` : "") +
    `Total: ${order.total || ""}\n` +
    (order.notes ? `Notes: ${order.notes}\n` : "") +
    `\nLines:\n${lines}\n\n` +
    `Open the admin panel: https://lumiashades.com/admin.html`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()).filter(Boolean), subject, text }),
    });
  } catch (e) {
    /* best effort — a mail hiccup must never block the order */
  }
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
    // remember when this dealer last signed in — shown in the admin panel
    d.lastLogin = new Date().toISOString();
    await store().setJSON("dealers", dealers);
    const promo = d.promo && d.promo.until && new Date(d.promo.until) > new Date() ? d.promo : null;
    const promoF = promo ? 1 - promo.pct / 100 : 1;
    // arches are made from the same honeycomb material as cellular shades,
    // so they always follow cellular's price level — never their own
    const multOf = (pid) => {
      const key = pid === "arches" ? "cellular" : pid;
      return ((d.mults && d.mults[key]) || d.mult || 1) * promoF;
    };
    return json({ name: d.name, prices: scaled(base, multOf), promo,
      contact: { company: d.company || "", address: d.address || "", phone: d.phone || "" } });
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
      test: !!d.test,   // orders from a test account: no e-mail, flagged in admin
    };
    await s.setJSON(key, order);
    // e-mail the owner when a real (non-test) order lands — best effort
    if (!order.test) await notifyOrder(order);
    return json({ ok: true, ref, kind: order.kind, test: !!d.test });
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
                        company: String(body.company || "").trim().slice(0, 200),
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
      d.company = String(body.company || "").trim().slice(0, 200);
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
      const product = String(body.product || "").trim();
      if (product) {
        // per-product level; mult <= 0 clears the override back to the account level
        if (!/^[a-z]+$/.test(product)) return bad("bad product");
        // arches carry no level of their own (clearing a leftover is still allowed)
        if (product === "arches" && isFinite(mult) && mult > 0)
          return bad("arches follow cellular pricing");
        if (isFinite(mult) && mult > 10) return bad("bad multiplier");
        d.mults = d.mults || {};
        if (!isFinite(mult) || mult <= 0) delete d.mults[product];
        else d.mults[product] = mult;
        if (!Object.keys(d.mults).length) delete d.mults;
      } else {
        if (!isFinite(mult) || mult <= 0 || mult > 10) return bad("bad multiplier");
        d.mult = mult;
      }
      await s.setJSON("dealers", dealers);
      return json({ ok: true, mult: d.mult, mults: d.mults || null });
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

    // mark an account as a test account (its orders never e-mail the owner
    // and are flagged in the panel), or back to a live account
    if (path === "/api/admin/dealer-test" && req.method === "POST") {
      const dealers = await getDealers();
      const d = dealers[String(body.code || "")];
      if (!d) return bad("no such dealer", 404);
      if (body.test) d.test = true; else delete d.test;
      await s.setJSON("dealers", dealers);
      return json({ ok: true, test: !!d.test });
    }

    // issue a fresh access code for a dealer: the old code stops working,
    // the account (contacts, level, promo) is kept, and every past order is
    // moved onto the new code so nothing is orphaned
    if (path === "/api/admin/dealer-recode" && req.method === "POST") {
      const dealers = await getDealers();
      const oldCode = String(body.code || "");
      const d = dealers[oldCode];
      if (!d) return bad("no such dealer", 404);
      let code = newCode();
      while (dealers[code]) code = newCode();
      dealers[code] = d;
      delete dealers[oldCode];
      await s.setJSON("dealers", dealers);
      // re-key the dealer's orders (order blobs carry the code as owner)
      const { blobs } = await s.list({ prefix: "order:" });
      for (const b of blobs) {
        const o = await s.get(b.key, { type: "json" });
        if (o && o.code === oldCode) {
          o.code = code;
          await s.setJSON(b.key, o);
        }
      }
      return json({ ok: true, code });
    }

    if (path === "/api/admin/orders" && req.method === "GET") {
      return json({ orders: await listOrders() });
    }

    if (path === "/api/admin/status" && req.method === "POST") {
      const key = `order:${String(body.ref || "")}`;
      const o = await s.get(key, { type: "json" });
      if (!o) return bad("no such order", 404);
      const status = String(body.status || "Pending review").slice(0, 60);
      // once an order is in production (or beyond, shipped) it locks so the
      // customer can no longer edit or withdraw it
      // every status other than "Pending review" locks the order (the customer
      // can only edit or withdraw it while it is still awaiting review)
      const autoLock = status !== "Pending review";
      o.status = {
        status,
        locked: autoLock || !!body.locked,
        note: String(body.note || "").slice(0, 500),
        updatedAt: new Date().toISOString(),
      };
      // FedEx tracking number, entered when the order ships — shown to the customer
      o.tracking = String(body.tracking || "").trim().slice(0, 80);
      await s.setJSON(key, o);
      return json({ ok: true, status: o.status, tracking: o.tracking });
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

    // permanently remove one order (e.g. a stray test order)
    if (path === "/api/admin/order-delete" && req.method === "POST") {
      const ref = String(body.ref || "");
      if (!ref) return bad("ref required");
      await s.delete(`order:${ref}`);
      return json({ ok: true });
    }

    if (path === "/api/admin/prices" && req.method === "POST") {
      if (!Array.isArray(body.products) || !body.products.length) return bad("products required");
      await s.setJSON("prices", body);
      return json({ ok: true, products: body.products.length });
    }
  }

  return bad("not found", 404);
};
