# LUMIA — carra-site

B2B window-treatment platform for LUMIA (a TDC company). Live at **https://lumiashades.com**
(Netlify site `strong-tapioca-e0a9fb`, auto-deploys from this repo's `main` — deploy = commit + push, ~1-2 min).
Legacy mirror: kaancoker1999.github.io/carra-site (canonicals point at the domain).

**This repo is PUBLIC. Never commit:** admin keys, dealer access codes, or the raw pricing
Excels (`tools/*.local.*` are gitignored for exactly that reason).

## Layout
- Static pages: index, tdbu, motorization, about, privacy, terms + 4 product pages
  (roman/cellular/pleated/drapery) **generated** by `python3 tools/gen_pages.py` — edit the
  generator, not the generated files.
- Order form config: `python3 tools/gen_order.py` → assets/order-config.json (run after gen_pages changes).
- Trade area: trade.html (dealer login), account.html (overview + payments), orders.html
  (Awaiting review / In production / Shipped), messages.html (mailbox), price-list.html, order.html,
  admin.html (admin panel).
  account.html and orders.html share `assets/portal.css` + `assets/account.js` (each block renders
  only if its container exists); the invoice is `assets/invoice.js`, the guided tour `assets/tour.js`.
  All are version-stamped (`?v=N`) — bump when editing.
- Backend: `netlify/functions/api.mjs` — Netlify Function + Blobs (store "trade", STRONG
  consistency required). Dealers, orders and base prices live in Blobs, not in the repo.
- `assets/trade.js` is shared by every page (session, nav injection, mobile menu). Its URL is
  version-stamped (`trade.js?v=N`) — bump N everywhere when editing it.

## Auth
- Dealers log in with access codes (`LUMIA-XXXX-XXXX`) created in the admin panel.
- Admin panel: `ADMIN_KEY` env var on Netlify is the owner's master key (the owner has the value;
  also in the owner's local Claude memory — never hardcode it; log in with the Name field empty).
  Named admins sign in with name + password. The account manager sets a starting password in the
  Admins tab; at first sign-in the admin must choose their own (only a salted PBKDF2 hash is kept in
  the "admins" blob; 8 wrong tries lock the account for 15 min). Permissions (`orders` / `payments` /
  `dealers` / `messages` / `admins` / `accounts`) are enforced in api.mjs via `NEEDS`; the panel only
  hides what an account can't change. Every admin can view everything. `accounts` (managing admin
  accounts) is separate from full access. "View as" in the Admins tab previews another admin's panel.

## Messages
- Threads live in Blobs as `thread:<id>`: dealer ↔ LUMIA conversations (`MSG-…`: a contact request
  about an order — `orderRef` + an after-sale kind such as "Damaged product" — or a general
  request/question) and direct chats between two admins (`DM-<idA>-<idB>`, only its members read it).
- Dealer side: "Contact us about this order" in each order's details (assets/account.js), the
  mailbox page messages.html (assets/messages.js, nav link with unread count from trade.js), and
  the "Request or question" form at the bottom of the other portal pages (assets/support.js).
- Admin side: notifications bell (derived: pending orders, reported payments, unread messages),
  Messages tab (Customers with a customer picker / Team = direct chats), "Message customer" on an order.

## Pricing
- Base (group-1) prices parsed from gitignored local Excels by `tools/make_trade_data.py`
  (roman/cellular/pleated/arches from pricing.local.xlsx, drapery from drapery-pricing.local.xlsx).
- Upload to the backend: `ADMIN_KEY=... python3 tools/seed_prices.py` (uses SITE_URL env or the
  netlify.app URL). Dealer prices = base × per-dealer multiplier × active promo discount.
  A dealer can also carry per-product overrides (`mults: {roman: 1.3, ...}`) that beat the
  account-level `mult` for that product; set via POST /api/admin/dealer-mult with `product`.
  Arches never carry their own level — they always follow cellular's (same honeycomb material).

## Conventions
- American spelling ("motorized", "aluminum"). Cream background tokens --paper/--paper2.
- Sizes shown as whole inches + eighths ("22 3/4"). Order size limits follow the price grids.
- Admin UI: never use confirm()/alert() — inline two-step confirmation (armConfirm pattern).
- Catalogue PDFs: compress with pypdf image re-encode (quality≈70, cap 1600px) into assets/pdf/,
  wire via "pdf"/"pdfsize" in tools/gen_pages.py PRODUCTS.
