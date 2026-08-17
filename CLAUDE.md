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
- Trade area: trade.html (dealer login), price-list.html, order.html, admin.html (owner panel).
- Backend: `netlify/functions/api.mjs` — Netlify Function + Blobs (store "trade", STRONG
  consistency required). Dealers, orders and base prices live in Blobs, not in the repo.
- `assets/trade.js` is shared by every page (session, nav injection, mobile menu). Its URL is
  version-stamped (`trade.js?v=N`) — bump N everywhere when editing it.

## Auth
- Dealers log in with access codes (`LUMIA-XXXX-XXXX`) created in the admin panel.
- Admin panel auth = `ADMIN_KEY` env var on Netlify (the owner has the value; also in the
  owner's local Claude memory). Never hardcode it.

## Pricing
- Base (group-1) prices parsed from gitignored local Excels by `tools/make_trade_data.py`
  (roman/cellular/pleated/arches from pricing.local.xlsx, drapery from drapery-pricing.local.xlsx).
- Upload to the backend: `ADMIN_KEY=... python3 tools/seed_prices.py` (uses SITE_URL env or the
  netlify.app URL). Dealer prices = base × per-dealer multiplier × active promo discount.

## Conventions
- American spelling ("motorized", "aluminum"). Cream background tokens --paper/--paper2.
- Sizes shown as whole inches + eighths ("22 3/4"). Order size limits follow the price grids.
- Admin UI: never use confirm()/alert() — inline two-step confirmation (armConfirm pattern).
- Catalogue PDFs: compress with pypdf image re-encode (quality≈70, cap 1600px) into assets/pdf/,
  wire via "pdf"/"pdfsize" in tools/gen_pages.py PRODUCTS.
