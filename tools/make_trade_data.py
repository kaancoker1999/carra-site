#!/usr/bin/env python3
"""Build assets/trade-data.json for the LUMIA trade area.

Dealers get an access code. Each code decrypts exactly one customer group's
price list. Group membership is never exposed in the UI, and price data sits
encrypted in the repo (AES-256-GCM, key derived from the code via PBKDF2).

Layout of trade-data.json:
  {
    "kdf": {"iterations": 150000},
    "dealers": [ {"s": salt_b64, "i": iv_b64, "c": ct_b64} ... ],   # ct = group key (hex)
    "groups":  [ {"s": salt_b64, "i": iv_b64, "c": ct_b64} ... ]    # ct = prices JSON
  }
Login tries every dealer record with the entered code; GCM auth fails on all
but the right one. The recovered group key then opens exactly one group blob.
The browser can't tell which group a code belongs to without the code itself.

Edit DEALERS below to add/remove codes, drop real price grids into PRICES,
then re-run:  python3 tools/make_trade_data.py
"""
import base64
import hashlib
import json
import os
import pathlib

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HERE = pathlib.Path(__file__).parent
OUT = HERE.parent / "assets" / "trade-data.json"
ITER = 150_000

# ── dealers: access code -> customer group (1-4). Codes are what you hand out.
# Real codes live in tools/dealers.local.json (gitignored — NEVER commit codes
# to the public repo): {"LUMIA-XXXX": 1, ...}. Demo codes below are fallback.
DEALERS = {
    "LUMIA-DEMO-G1": 1,
    "LUMIA-DEMO-G2": 2,
    "LUMIA-DEMO-G3": 3,
    "LUMIA-DEMO-G4": 4,
}
_local = HERE / "dealers.local.json"
if _local.exists():
    DEALERS = {k: int(v) for k, v in json.loads(_local.read_text()).items()}

# ── price data ──────────────────────────────────────────────────────────────
# SAMPLE grids until the real Excels arrive. Structure per product:
#   widths/heights are the grid axes (inches), tiers are fabric groups,
#   grid[tier][h_index][w_index] = list price in USD.
WIDTHS = [24, 36, 48, 60, 72, 84, 96]
HEIGHTS = [36, 48, 60, 72, 84, 96]
TIERS = ["Entry", "Standard", "Premium", "Luxury"]

# sample list-price formula: base + rate per square foot, bumped per tier.
BASES = {"roman": 189, "cellular": 129, "pleated": 99, "drapery": 249}
RATES = {"roman": 9.5, "cellular": 6.5, "pleated": 5.0, "drapery": 12.0}
TIER_MULT = [1.0, 1.22, 1.5, 1.9]
# customer group discounts off list (group 1 = list price)
GROUP_MULT = [1.0, 0.92, 0.84, 0.75]

PRODUCT_NAMES = {
    "roman": "Roman Shades",
    "cellular": "Cellular Shades",
    "pleated": "Pleated Shades",
    "drapery": "Drapery (per panel)",
}


def sample_grid(product: str, gmult: float, tmult: float):
    rows = []
    for h in HEIGHTS:
        row = []
        for w in WIDTHS:
            sqft = (w * h) / 144.0
            price = (BASES[product] + RATES[product] * sqft) * tmult * gmult
            row.append(int(round(price / 5.0)) * 5)  # round to $5
        rows.append(row)
    return rows


def prices_for_group(gi: int):
    gmult = GROUP_MULT[gi - 1]
    return {
        "sample": True,
        "currency": "USD",
        "note": "SAMPLE price list — replace with the real grids.",
        "products": [
            {
                "id": pid,
                "name": PRODUCT_NAMES[pid],
                "widths": WIDTHS,
                "heights": HEIGHTS,
                "tiers": [
                    {"name": TIERS[t], "grid": sample_grid(pid, gmult, TIER_MULT[t])}
                    for t in range(len(TIERS))
                ],
            }
            for pid in ["roman", "cellular", "pleated", "drapery"]
        ],
    }


# ── crypto helpers ──────────────────────────────────────────────────────────

def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def derive(secret: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", secret.encode(), salt, ITER, dklen=32)


def encrypt(secret: str, plaintext: bytes) -> dict:
    salt, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(derive(secret, salt)).encrypt(iv, plaintext, None)
    return {"s": b64(salt), "i": b64(iv), "c": b64(ct)}


def main():
    n_groups = max(DEALERS.values())
    group_keys = [os.urandom(24).hex() for _ in range(n_groups)]

    groups = [
        encrypt(group_keys[gi], json.dumps(prices_for_group(gi + 1), separators=(",", ":")).encode())
        for gi in range(n_groups)
    ]
    dealers = [
        encrypt(code, group_keys[grp - 1].encode())
        for code, grp in DEALERS.items()
    ]

    # deterministic-ish shuffle so record order does not mirror group order
    dealers.sort(key=lambda d: d["s"])
    OUT.write_text(json.dumps({"kdf": {"iterations": ITER}, "dealers": dealers, "groups": groups}, indent=1))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB): {len(dealers)} dealer codes, {n_groups} groups")


if __name__ == "__main__":
    main()
