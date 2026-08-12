#!/usr/bin/env python3
"""Emit assets/order-config.json for the trade order builder.

Derives the option columns from the same PRODUCTS/fabric data that drives the
product configurators, so the order form never drifts from the site.
Re-run after changing gen_pages.py:  python3 tools/gen_order.py
"""
import json
import pathlib

import gen_pages as gp

OUT = pathlib.Path(gp.SITE) / "assets" / "order-config.json"


def option_names(options):
    return [o["n"] if isinstance(o, dict) else o for o in options]


# Cellular order rows pick one combined "cell & opacity" option matching the
# price-list grids, instead of separate cell / opacity / fabric steps.
# Each option maps to the fabric collection whose colours apply.
CELL_CHOICES = [
    ("Light Filtering · Single Cell", "cellular-classic"),
    ("Light Filtering · Double Cell", "cellular-classic"),
    ("Light Filtering · Single Cell 3/4″", "cellular-classic"),
    ("Light Filtering · Triple Cell 3/8″", "cellular-classic"),
    ("Designer Prints · Single Cell 3/4″", "cellular-designer"),
    ("Sheer Woven · Single Cell 3/4″", "cellular-sheer"),
    ("Blackout · Single Cell", "cellular-classic"),
    ("Blackout · Double Cell", "cellular-classic"),
    ("Blackout · Single Cell 3/4″", "cellular-classic"),
]


def fabric_first(steps):
    """Product, then fabric & colour, then everything else."""
    front = [s for s in steps if s["key"] in ("collection", "fabric", "colour")]
    rest = [s for s in steps if s["key"] not in ("collection", "fabric", "colour")]
    return front + rest


def build():
    products = []
    for fname, cfg in gp.PRODUCTS.items():
        fab = cfg.get("fabrics", False)
        fabric_data = gp.FAB_CELL if fab == "cell" else (gp.FAB if fab else None)

        steps = []
        for g in cfg["groups"]:
            if g.get("type") == "fabrics":
                if fab == "cell":
                    continue  # cellular fabric is folded into the cell choice below
                colours = {
                    c["id"]: [col.get("code") or col["label"] for col in fabric_data["colors"][c["id"]]]
                    for c in fabric_data["collections"]
                }
                steps.append({
                    "key": "collection", "label": "Fabric",
                    "options": [{"id": c["id"], "label": c["label"]} for c in fabric_data["collections"]],
                    "colours": colours,
                })
                continue
            if fab == "cell" and g["key"] in ("cell", "opacity"):
                continue  # replaced by the combined cell choice
            step = {"key": g["key"], "label": g["label"], "options": option_names(g["options"])}
            if "showIf" in g:
                step["showIf"] = g["showIf"]
            steps.append(step)

        if fab == "cell":
            colours = {
                c["id"]: [col.get("code") or col["label"] for col in fabric_data["colors"][c["id"]]]
                for c in fabric_data["collections"]
            }
            used = {cid for _, cid in CELL_CHOICES}
            steps.insert(0, {
                "key": "collection", "label": "Cell & opacity",
                "options": [{"id": cid, "label": name} for name, cid in CELL_CHOICES],
                "colours": {cid: cols for cid, cols in colours.items() if cid in used},
            })

        steps = fabric_first(steps)

        products.append({
            "id": fname.replace(".html", ""),
            "name": cfg["name"],
            "width": cfg["width"],
            "height": cfg["height"],
            "hLabel": cfg.get("hLabel", "Height"),
            "steps": steps,
        })

    OUT.write_text(json.dumps({"products": products}, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
