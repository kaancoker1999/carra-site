// LUMIA trade backend — Netlify Function + Blobs.
//
// Dealer endpoints (header x-dealer-code):
//   POST /api/login            {code}                 -> {name, prices}
//   GET  /api/orders                                  -> dealer's own orders
//   POST /api/order            {ref,kind,customer,notes,lines,total}
//   POST /api/order/cancel     {ref}                  (only while "Pending review")
//   POST /api/order/received   {ref}                  (dealer confirms the goods arrived)
//   GET  /api/threads                                 -> dealer's own message threads
//   POST /api/thread           {orderRef,text} (chat about an order) or {kind,subject,text}
//   POST /api/thread/reply     {id,text}  ·  POST /api/thread/seen {id}
//
// Admin endpoints (header authorization: Bearer <ADMIN_KEY> for the owner's master key, or
// Bearer <name>:<password> for a named admin; see PERMS/NEEDS for who may do what):
//   GET  /api/admin/dealers                           -> list with order counts
//   POST /api/admin/dealers    {name, mult}           -> {code}
//   POST /api/admin/dealer-active {code, active}
//   GET  /api/admin/orders                            -> all orders
//   GET  /api/admin/me                                -> {name, perms, owner}
//   GET/POST /api/admin/admins · POST /admin-update {id,perms,active} · /admin-password {id,password} · /admin-delete {id}
//   POST /api/admin/my-password {password}             (an admin sets their own; required on first sign-in)
//   POST /api/admin/status     {ref, status, locked, note, tracking, productNo}
//   POST /api/admin/paid       {ref, paid}            (mark order paid / unpaid)
//   POST /api/admin/received   {ref, received}        (LUMIA confirms delivery; together with
//                                                      the dealer's own confirmation this
//                                                      closes the order — both sides agree)
//   POST /api/admin/prices     {currency, products, notes}   (seed/update base prices)
//   GET  /api/admin/threads                           -> every message thread
//   POST /api/admin/thread/reply {id|orderRef,text} · /status {id,status} · /seen {id} · /delete {id}
//   GET  /api/admin/team                              -> the other admins one can write to
//   POST /api/admin/dm         {to,text} | {to,seen:true}    (direct chat between two admins)

import { getStore } from "@netlify/blobs";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

export const config = { path: "/api/*" };

// strong consistency: dealer/order updates must be readable immediately
const store = () => getStore({ name: "trade", consistency: "strong" });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const bad = (msg, status = 400) => json({ error: msg }, status);

// ── admins ──
// The ADMIN_KEY env var is the owner's master key (full access). Each named
// admin signs in with their NAME and a PASSWORD that the account manager sets
// in the Admins tab; only a salted PBKDF2 hash is stored, in the "admins"
// blob. Every admin can SEE customers, orders, payments and messages; the
// permissions below gate what they can CHANGE.
const PERMS = {
  orders:   "Review orders, move them to production, ship, add FedEx / product no.",
  payments: "Confirm payments received",
  dealers:  "Create customer accounts and set their price level",
  messages: "Answer customer messages",
  admins:   "Base prices, backups, deleting customers",
  accounts: "Manage admin accounts (add, remove, keys, permissions)",
};
const ROLE_PRESETS = {
  // full access to the business side; managing admin accounts ("accounts") is
  // granted separately, by whoever already holds it
  owner:    ["orders", "payments", "dealers", "messages", "admins"],
  orders:   ["orders"],
  payments: ["payments", "dealers"],
  support:  ["messages"],
};
const PASS_MIN = 8, LOCK_AFTER = 8, LOCK_MS = 15 * 60000;
const hashPass = (pw, salt) => pbkdf2Sync(String(pw), salt, 60000, 32, "sha256").toString("hex");
async function getAdmins() {
  return (await store().get("admins", { type: "json" })) || {};
}
// a verified "name:password" stays good for a few minutes on a warm instance,
// so the hash isn't recomputed on every request
const verified = new Map();
// -> { id, name, perms: [...], owner } or null
async function adminFromReq(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  if (!token) return null;
  const master = process.env.ADMIN_KEY;
  if (master && token === master) {
    return { id: "owner", name: process.env.ADMIN_NAME || "LUMIA", perms: Object.keys(PERMS), owner: true };
  }
  // named admin: "Name:password" (the name may be URI-encoded for non-ASCII letters)
  const i = token.indexOf(":");
  if (i < 1) return null;
  let name = token.slice(0, i), pw = token.slice(i + 1);
  try { name = decodeURIComponent(name); pw = decodeURIComponent(pw); } catch { return null; }
  const admins = await getAdmins();
  const entry = Object.entries(admins).find(([, a]) => a.name.toLowerCase() === name.trim().toLowerCase());
  if (!entry) return null;
  const [id, a] = entry;
  if (a.active === false || !a.passHash) return null;
  const hit = verified.get(token);
  if (hit && hit.id === id && hit.hash === a.passHash && hit.exp > Date.now()) {
    return { id, name: a.name, perms: a.perms || [], owner: false, mustChange: !!a.mustChange };
  }
  // too many wrong passwords: locked for a while
  const f = a.fails || { n: 0, at: 0 };
  if (f.n >= LOCK_AFTER && Date.now() - f.at < LOCK_MS) return null;
  const good = Buffer.from(a.passHash, "hex"), got = Buffer.from(hashPass(pw, a.salt), "hex");
  if (good.length !== got.length || !timingSafeEqual(good, got)) {
    a.fails = { n: (Date.now() - f.at < LOCK_MS ? f.n : 0) + 1, at: Date.now() };
    await store().setJSON("admins", admins);
    return null;
  }
  if (f.n) { delete a.fails; await store().setJSON("admins", admins); }
  verified.set(token, { id, hash: a.passHash, exp: Date.now() + 5 * 60000 });
  return { id, name: a.name, perms: a.perms || [], owner: false, mustChange: !!a.mustChange };
}
// what each changing endpoint needs; anything not listed is open to every admin
const NEEDS = {
  "/api/admin/status": "orders", "/api/admin/received": "orders", "/api/admin/order-delete": "orders",
  "/api/admin/paid": "payments",
  "/api/admin/dealers:POST": "dealers", "/api/admin/dealer-contact": "dealers", "/api/admin/dealer-mult": "dealers",
  "/api/admin/dealer-promo": "dealers", "/api/admin/dealer-active": "dealers", "/api/admin/dealer-test": "dealers",
  "/api/admin/dealer-delete": "admins", "/api/admin/dealer-recode": "dealers",
  "/api/admin/prices": "admins", "/api/admin/backup": "admins",
  "/api/admin/admins": "accounts", "/api/admin/admin-update": "accounts", "/api/admin/admin-delete": "accounts", "/api/admin/admin-password": "accounts",
};

async function getDealers() {
  return (await store().get("dealers", { type: "json" })) || {};
}

/* ACH payment instructions — only ever sent to a logged-in dealer, never in
   the public site/repo. Set on Netlify: PAY_ACCOUNT_HOLDER, PAY_BANK,
   PAY_ACCOUNT_TYPE, PAY_ROUTING, PAY_ACCOUNT_NUMBER */
function payInfo() {
  const e = process.env;
  const info = {
    holder: e.PAY_ACCOUNT_HOLDER || "", bank: e.PAY_BANK || "", type: e.PAY_ACCOUNT_TYPE || "",
    routing: e.PAY_ROUTING || "", account: e.PAY_ACCOUNT_NUMBER || "",
  };
  return info.routing && info.account ? info : null;
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

// ── messages ──
// One blob per thread ("thread:<id>") holding its messages:
//   · an order chat  — id "ORD-<order ref>", one per order, either side can start it
//   · a request / question from a dealer — id "MSG-…"
//   · a direct chat between two admins — id "DM-<idA>-<idB>" (kind "DM"; only its
//     two members can read or write it, and dealers never see it)
// "Unread" is derived: the other side wrote after this side last opened the thread.
const THREAD_KINDS = ["Request", "Question"];
const dmId = (a, b) => `DM-${[a, b].sort().join("-")}`;
const MSG_MAX = 2000, THREAD_MAX_MSGS = 300;

async function listThreads(filterCode) {
  const s = store();
  const { blobs } = await s.list({ prefix: "thread:" });
  const out = [];
  for (const b of blobs) {
    const t = await s.get(b.key, { type: "json" });
    if (!t) continue;
    if (filterCode ? (t.code === filterCode && t.kind !== "DM") : true) out.push(t);
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}
function newThreadId() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `MSG-${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
}
const cleanText = (v, max) => String(v || "").replace(/\r/g, "").trim().slice(0, max);

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
    return json({ orders: await listOrders(d.code), payInfo: payInfo() });
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

  // ── dealer: claim a payment (LUMIA still confirms it) ─────────
  if (path === "/api/order/paid-claim" && req.method === "POST") {
    const d = await dealerFromReq(req);
    if (!d) return bad("unauthorized", 401);
    const s = store();
    const key = `order:${String(body.ref || "").slice(0, 40)}`;
    const o = await s.get(key, { type: "json" });
    if (!o || o.code !== d.code) return bad("no such order", 404);
    const p = o.payment || {};
    if (p.paid) return bad("already confirmed paid", 409);
    // toggle the claim: a customer can also take it back before we confirm
    o.payment = { ...p, paid: false,
      customerPaidAt: body.claim === false ? null : new Date().toISOString() };
    await s.setJSON(key, o);
    return json({ ok: true, payment: o.payment });
  }

  // ── dealer: messages ───────────────────────────────────────────
  if (path === "/api/threads" && req.method === "GET") {
    const d = await dealerFromReq(req);
    if (!d) return bad("unauthorized", 401);
    return json({ threads: await listThreads(d.code) });
  }

  // start a conversation: about one of the dealer's orders ({orderRef, text} —
  // one chat per order, so a second message just continues it), or a general
  // request / question ({kind, subject, text})
  if (path === "/api/thread" && req.method === "POST") {
    const d = await dealerFromReq(req);
    if (!d) return bad("unauthorized", 401);
    const text = cleanText(body.text, MSG_MAX);
    if (!text) return bad("message required");
    const s = store();
    const now = new Date().toISOString();
    const msg = { from: "dealer", by: d.name, text, at: now };
    const orderRef = cleanText(body.orderRef, 40);
    if (orderRef) {
      const o = await s.get(`order:${orderRef}`, { type: "json" });
      if (!o || o.code !== d.code) return bad("no such order", 404);
      const key = `thread:ORD-${orderRef}`;
      let t = await s.get(key, { type: "json" });
      if (t) {
        if (t.messages.length >= THREAD_MAX_MSGS) return bad("this conversation is full", 409);
        t.messages.push(msg); t.status = "open";
      } else {
        t = { id: `ORD-${orderRef}`, code: d.code, dealer: d.name, test: !!d.test, kind: "Order",
              subject: `Order ${orderRef}`, orderRef, status: "open", createdAt: now,
              adminSeenAt: null, messages: [msg] };
      }
      t.updatedAt = now; t.dealerSeenAt = now;
      await s.setJSON(key, t);
      return json({ ok: true, thread: t });
    }
    const subject = cleanText(body.subject, 120);
    if (!subject) return bad("subject required");
    let id = newThreadId();
    while (await s.get(`thread:${id}`, { type: "json" })) id = newThreadId();
    const t = {
      id, code: d.code, dealer: d.name, test: !!d.test,
      subject, kind: THREAD_KINDS.includes(body.kind) ? body.kind : "Request", orderRef: "",
      status: "open", createdAt: now, updatedAt: now,
      dealerSeenAt: now, adminSeenAt: null, messages: [msg],
    };
    await s.setJSON(`thread:${id}`, t);
    return json({ ok: true, thread: t });
  }

  if ((path === "/api/thread/reply" || path === "/api/thread/seen") && req.method === "POST") {
    const d = await dealerFromReq(req);
    if (!d) return bad("unauthorized", 401);
    const s = store();
    const key = `thread:${String(body.id || "").slice(0, 40)}`;
    const t = await s.get(key, { type: "json" });
    if (!t || t.code !== d.code) return bad("no such conversation", 404);
    const now = new Date().toISOString();
    if (path.endsWith("/reply")) {
      const text = cleanText(body.text, MSG_MAX);
      if (!text) return bad("message required");
      if (t.messages.length >= THREAD_MAX_MSGS) return bad("this conversation is full — please start a new one", 409);
      t.messages.push({ from: "dealer", by: d.name, text, at: now });
      t.updatedAt = now;
      t.status = "open";              // a new customer message reopens a closed thread
    }
    t.dealerSeenAt = now;
    await s.setJSON(key, t);
    return json({ ok: true, thread: t });
  }

  // ── admin ──────────────────────────────────────────────────────
  if (path.startsWith("/api/admin/")) {
    const admin = await adminFromReq(req);
    if (!admin) return bad("unauthorized", 401);
    const need = NEEDS[`${path}:${req.method}`] || (req.method === "POST" ? NEEDS[path] : (path === "/api/admin/backup" ? "admins" : path === "/api/admin/admins" ? "accounts" : null));
    if (need && !admin.perms.includes(need)) return bad("you don't have permission for this", 403);
    const can = (p) => admin.perms.includes(p);
    const s = store();

    // who am I — the panel shows and hides its controls from this
    if (path === "/api/admin/me" && req.method === "GET") {
      return json({ id: admin.id, name: admin.name, perms: admin.perms, owner: admin.owner,
                    mustChange: !!admin.mustChange, allPerms: PERMS });
    }

    // an admin chooses their own password — required on first sign-in, since the
    // one the manager set is only a starting password
    if (path === "/api/admin/my-password" && req.method === "POST") {
      if (admin.owner) return bad("the master key has no password to change", 400);
      const admins = await getAdmins();
      const a = admins[admin.id];
      if (!a) return bad("no such admin", 404);
      const pw = String(body.password || "");
      if (pw.length < PASS_MIN) return bad(`the password needs at least ${PASS_MIN} characters`);
      if (hashPass(pw, a.salt) === a.passHash) return bad("choose a password different from the one you were given");
      a.salt = randomBytes(16).toString("hex");
      a.passHash = hashPass(pw, a.salt);
      a.passwordSetAt = new Date().toISOString();
      a.ownPassword = true;
      delete a.mustChange; delete a.fails;
      await s.setJSON("admins", admins);
      return json({ ok: true });
    }

    // until then nothing else is available
    if (admin.mustChange) return bad("choose your own password first", 403);

    // ── admin accounts (owner) ──
    if (path === "/api/admin/admins" && req.method === "GET") {
      const admins = await getAdmins();
      return json({ admins: Object.entries(admins).map(([id, a]) => ({
        id, name: a.name, role: a.role, perms: a.perms || [], active: a.active !== false,
        created: a.created, hasPassword: !!a.passHash, passwordSetAt: a.passwordSetAt || null,
        mustChange: !!a.mustChange })),
        perms: PERMS, presets: ROLE_PRESETS });
    }
    if (path === "/api/admin/admins" && req.method === "POST") {
      const name = cleanText(body.name, 40);
      if (!name) return bad("name required");
      const admins = await getAdmins();
      if (Object.values(admins).some((a) => a.name.toLowerCase() === name.toLowerCase())) return bad("an admin with this name already exists", 409);
      const role = ROLE_PRESETS[body.role] ? body.role : "support";
      if (name.includes(":")) return bad("the name can't contain ':'");
      const id = `adm_${randomBytes(5).toString("hex")}`;
      admins[id] = { name, role, perms: ROLE_PRESETS[role].slice(), active: true, created: new Date().toISOString() };
      // a password can be given right away, or set afterwards
      if (body.password !== undefined) {
        const pw = String(body.password);
        if (pw.length < PASS_MIN) return bad(`the password needs at least ${PASS_MIN} characters`);
        admins[id].salt = randomBytes(16).toString("hex");
        admins[id].passHash = hashPass(pw, admins[id].salt);
        admins[id].passwordSetAt = new Date().toISOString();
        admins[id].mustChange = true;            // a starting password: they pick their own on first sign-in
      }
      await s.setJSON("admins", admins);
      return json({ ok: true, id });
    }
    if (path === "/api/admin/admin-update" && req.method === "POST") {
      const admins = await getAdmins();
      const a = admins[String(body.id || "")];
      if (!a) return bad("no such admin", 404);
      if (Array.isArray(body.perms)) a.perms = body.perms.filter((x) => PERMS[x]);
      if (typeof body.active === "boolean") a.active = body.active;
      if (body.name) a.name = cleanText(body.name, 40) || a.name;
      await s.setJSON("admins", admins);
      return json({ ok: true });
    }
    // the account manager chooses each admin's password; only its salted hash is kept
    if (path === "/api/admin/admin-password" && req.method === "POST") {
      const admins = await getAdmins();
      const a = admins[String(body.id || "")];
      if (!a) return bad("no such admin", 404);
      const pw = String(body.password || "");
      if (pw.length < PASS_MIN) return bad(`the password needs at least ${PASS_MIN} characters`);
      a.salt = randomBytes(16).toString("hex");
      a.passHash = hashPass(pw, a.salt);
      a.passwordSetAt = new Date().toISOString();
      a.mustChange = true;                       // a starting password: they pick their own on first sign-in
      delete a.ownPassword; delete a.keyHash; delete a.fails;
      await s.setJSON("admins", admins);
      return json({ ok: true });
    }
    if (path === "/api/admin/admin-delete" && req.method === "POST") {
      const admins = await getAdmins();
      if (!admins[String(body.id || "")]) return bad("no such admin", 404);
      delete admins[String(body.id)];
      await s.setJSON("admins", admins);
      // their direct chats go with the account
      const { blobs } = await s.list({ prefix: "thread:DM-" });
      for (const b of blobs) {
        const t = await s.get(b.key, { type: "json" });
        if (t && (t.members || []).includes(String(body.id))) await s.delete(b.key);
      }
      return json({ ok: true });
    }

    // customer threads for everyone; direct chats only for their two members
    if (path === "/api/admin/threads" && req.method === "GET") {
      const all = await listThreads();
      return json({ threads: all.filter((t) => t.kind !== "DM" || (t.members || []).includes(admin.id)) });
    }

    // the people an admin can write to: every active named admin
    if (path === "/api/admin/team" && req.method === "GET") {
      const admins = await getAdmins();
      return json({ me: admin.id, team: Object.entries(admins)
        .filter(([, a]) => a.active !== false).map(([id, a]) => ({ id, name: a.name })) });
    }

    // direct message to another admin: {to, text} — or {to, seen:true} to mark it read
    if (path === "/api/admin/dm" && req.method === "POST") {
      const to = String(body.to || "");
      const admins = await getAdmins();
      const other = to === "owner" ? { name: process.env.ADMIN_NAME || "LUMIA" } : admins[to];
      if (!other || to === admin.id) return bad("no such admin", 404);
      if (other.active === false) return bad("this admin account is suspended", 409);
      const key = `thread:${dmId(admin.id, to)}`;
      const now = new Date().toISOString();
      let t = await s.get(key, { type: "json" });
      if (body.seen) {
        if (!t) return json({ ok: true });
        t.seen = { ...(t.seen || {}), [admin.id]: now };
        await s.setJSON(key, t);
        return json({ ok: true, thread: t });
      }
      const text = cleanText(body.text, MSG_MAX);
      if (!text) return bad("message required");
      if (!t) t = { id: dmId(admin.id, to), kind: "DM", code: "", members: [admin.id, to].sort(),
                    names: {}, seen: {}, createdAt: now, messages: [] };
      t.names = { ...(t.names || {}), [admin.id]: admin.name, [to]: other.name };
      if (t.messages.length >= THREAD_MAX_MSGS) t.messages = t.messages.slice(-(THREAD_MAX_MSGS - 1));   // keeps rolling
      t.messages.push({ fromId: admin.id, by: admin.name, text, at: now });
      t.updatedAt = now;
      t.seen = { ...(t.seen || {}), [admin.id]: now };
      await s.setJSON(key, t);
      return json({ ok: true, thread: t });
    }

    if (path.startsWith("/api/admin/thread/") && req.method === "POST") {
      const act = path.slice("/api/admin/thread/".length);
      const now = new Date().toISOString();
      const by = admin.name;                      // the logged-in admin, never client-supplied
      let id = String(body.id || "").slice(0, 60);
      // writing to customers needs "messages" (opening one to read it does not)
      if (act !== "seen" && !can("messages")) return bad("you don't have permission for this", 403);
      // LUMIA writing first about an order: {orderRef} opens that order's chat
      const orderRef = cleanText(body.orderRef, 40);
      if (!id && orderRef) id = `ORD-${orderRef}`;
      const key = `thread:${id}`;
      let t = await s.get(key, { type: "json" });
      if (t && t.kind === "DM") return bad("no such conversation", 404);   // admins' chats go through /api/admin/dm
      if (!t && act === "reply" && orderRef) {
        const o = await s.get(`order:${orderRef}`, { type: "json" });
        if (!o) return bad("no such order", 404);
        t = { id, code: o.code, dealer: o.dealer || "", test: !!o.test, kind: "Order",
              subject: `Order ${orderRef}`, orderRef, status: "open", createdAt: now,
              dealerSeenAt: null, messages: [] };
      }
      if (!t) return bad("no such conversation", 404);
      if (act === "delete") { await s.delete(key); return json({ ok: true }); }
      if (act === "reply") {
        const text = cleanText(body.text, MSG_MAX);
        if (!text) return bad("message required");
        if (t.messages.length >= THREAD_MAX_MSGS) return bad("conversation is full", 409);
        t.messages.push({ from: "lumia", by, text, at: now });
        t.updatedAt = now;
        t.adminSeenAt = now;
      } else if (act === "status") {
        t.status = body.status === "closed" ? "closed" : "open";
        t.closedAt = t.status === "closed" ? now : null;
        t.adminSeenAt = now;
      } else if (act === "seen") {
        t.adminSeenAt = now;
      } else return bad("not found", 404);
      await s.setJSON(key, t);
      return json({ ok: true, thread: t });
    }

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
      const threads = await listThreads();
      return json({ exportedAt: new Date().toISOString(), dealers, prices, orders, threads });
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
      // every status other than "Pending review" locks the order (the customer
      // can only edit or withdraw it while it is still awaiting review)
      const autoLock = status !== "Pending review";
      // an order already in production from before productionAt existed keeps
      // its original start (the last status change), not today
      const prevStart = o.status && o.status.status === "In production" ? o.status.updatedAt : null;
      o.status = {
        status,
        locked: autoLock || !!body.locked,
        note: String(body.note || "").slice(0, 500),
        updatedAt: new Date().toISOString(),
      };
      // FedEx tracking number, entered when the order ships — shown to the customer
      // LUMIA's own product / production number for the order
      if (body.productNo !== undefined) o.productNo = cleanText(body.productNo, 60);
      const prevTracking = o.tracking || "";
      o.tracking = String(body.tracking || "").trim().slice(0, 80);
      // when the tracking number was entered — the invoice is dated the Friday of that week
      if (!o.tracking) delete o.trackingAt;
      else if (o.tracking !== prevTracking) o.trackingAt = new Date().toISOString();
      else if (!o.trackingAt) o.trackingAt = o.shippedAt || new Date().toISOString();   // entered before this stamp existed
      // stamp when production starts — payment opens then and is due 20 days
      // later (shipping without a production step counts as starting then) —
      // and the ship date the first time it ships. "Pending review" clears both.
      const nowIso = new Date().toISOString();
      if (status === "In production" || status === "Shipped") { if (!o.productionAt) o.productionAt = prevStart || o.shippedAt || nowIso; }
      if (status === "Shipped") { if (!o.shippedAt) o.shippedAt = nowIso; }
      else if (status === "Pending review") { delete o.shippedAt; delete o.productionAt; }
      await s.setJSON(key, o);
      return json({ ok: true, status: o.status, tracking: o.tracking, shippedAt: o.shippedAt || null, productionAt: o.productionAt || null });
    }

    if (path === "/api/admin/paid" && req.method === "POST") {
      const key = `order:${String(body.ref || "")}`;
      const o = await s.get(key, { type: "json" });
      if (!o) return bad("no such order", 404);
      // keep the customer's "I paid" claim as a record when confirming
      o.payment = { ...(o.payment || {}), paid: !!body.paid, updatedAt: new Date().toISOString() };
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
      await s.delete(`thread:ORD-${ref}`);      // its chat goes with it
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
