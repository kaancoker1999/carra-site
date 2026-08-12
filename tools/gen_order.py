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


def build():
    products = []
    for fname, cfg in gp.PRODUCTS.items():
        fab = cfg.get("fabrics", False)
        fabric_data = gp.FAB_CELL if fab == "cell" else (gp.FAB if fab else None)

        steps = []
        for g in cfg["groups"]:
            if g.get("type") == "fabrics":
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
            step = {"key": g["key"], "label": g["label"], "options": option_names(g["options"])}
            if "showIf" in g:
                step["showIf"] = g["showIf"]
            steps.append(step)

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
