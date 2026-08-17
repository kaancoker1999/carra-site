#!/usr/bin/env python3
"""Seed (or refresh) the trade backend on Netlify.

Builds base group-1 prices from the local Excels and uploads them to the
API; optionally (re)creates the demo dealers. Needs the admin key.

    ADMIN_KEY=... python3 tools/seed_prices.py [--demo-dealers]
"""
import json
import os
import sys
import urllib.request

import make_trade_data as mtd

SITE = os.environ.get("SITE_URL", "https://strong-tapioca-e0a9fb.netlify.app")
KEY = os.environ.get("ADMIN_KEY") or sys.exit("set ADMIN_KEY env var")


def post(path, payload):
    req = urllib.request.Request(
        SITE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    base = {
        "currency": "USD",
        "products": mtd.parse_workbook(),
        "notes": ["Prices per unit in USD. Volume pricing available — contact us."],
    }
    print("uploading prices:", post("/api/admin/prices", base))

    if "--demo-dealers" in sys.argv:
        for code, mult in [("LUMIA-DEMO-G1", 1.00), ("LUMIA-DEMO-G2", 1.15),
                           ("LUMIA-DEMO-G3", 1.30), ("LUMIA-DEMO-G4", 1.50)]:
            print(post("/api/admin/dealers", {"name": f"Demo dealer ({code[-2:]})", "mult": mult, "code": code}))


if __name__ == "__main__":
    main()
