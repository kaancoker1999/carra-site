#!/usr/bin/env python3
"""Emit assets/shop-config.json for the consumer shop (shop.html).

Same order-form step structure as order-config.json (so the pricing engine
reads identical keys/values), enriched with the visuals the product
configurator pages use: option photos (fold styles, drapery headings) and
fabric swatch images. Re-run after changing gen_pages.py or gen_order.py:
    python3 tools/gen_shop.py
"""
import json
import pathlib

import gen_pages as gp
import gen_order as go

OUT = pathlib.Path(gp.SITE) / "assets" / "shop-config.json"

SHOP_IDS = ["roman", "cellular", "pleated", "drapery"]


def option_imgs(cfg, key):
    """{option name: photo} for a configurator group that carries images."""
    for g in cfg["groups"]:
        if g.get("key") == key:
            out = {o["n"]: o["img"] for o in g["options"]
                   if isinstance(o, dict) and o.get("img")}
            return out or None
    return None


def fabric_swatches(fabric_data):
    """{collection id: {colour value: {img, name}}} — colour values spelled
    exactly as the order steps spell them (code, or label as fallback)."""
    out = {}
    for c in fabric_data["collections"]:
        cols = {}
        for col in fabric_data["colors"][c["id"]]:
            val = col.get("code") or col["label"]
            cols[val] = {"img": col["img"], "lg": col.get("lg") or col["img"],
                         "name": col.get("name") or col["label"]}
        out[c["id"]] = cols
    return out


def cell_swatches():
    """Cellular colours are '<series> <code>' strings; the catalogue photos
    are shared across series and keyed by code, so look each code up in any
    of the marketing collections."""
    by_code = {}
    for cid in gp.FAB_CELL["colors"]:
        for col in gp.FAB_CELL["colors"][cid]:
            by_code.setdefault(col["id"], col)
    out = {}
    for series, codes in go.SERIES_COLOURS.items():
        cols = {}
        for code in codes:
            col = by_code.get(code)
            if col:
                cols[f"{series} {code}"] = {"img": col["img"], "lg": col.get("lg") or col["img"],
                                            "name": code}
        out[series] = cols
    return out


def fabric_meta(fabric_data):
    return {c["id"]: {"transparency": c.get("transparency", ""),
                      "material": c.get("material", "")}
            for c in fabric_data["collections"]}


def build():
    products = [p for p in go.core_products() if p["id"] in SHOP_IDS]
    for p in products:
        fname = p["id"] + ".html"
        cfg = gp.PRODUCTS[fname]
        p["img"] = cfg["img"]
        # remotes, cables and hubs are asked once at checkout, not per shade
        p["steps"] = [s for s in p["steps"] if s["key"] not in ("remote", "cable", "hub")]
        for step in p["steps"]:
            # the lift is always called "Mechanism" in the shop, never "Drive"
            if step["key"] == "drive":
                step["label"] = "Mechanism"
                # Flat folds hang on a corded lift: CCL or motor, never cordless
                if p["id"] == "roman":
                    ex = step.get("exclude")
                    rules = [ex] if isinstance(ex, dict) else list(ex or [])
                    rules.append({"key": "fold", "value": ["Flat"],
                                  "options": ["Cordless"]})
                    step["exclude"] = rules
            imgs = option_imgs(cfg, step["key"])
            if imgs:
                step["imgs"] = imgs
            if step["key"] == "collection":
                if p["id"] == "cellular":
                    step["swatches"] = cell_swatches()
                else:
                    step["swatches"] = fabric_swatches(gp.FAB)
                    step["meta"] = fabric_meta(gp.FAB)
        # edge banding is one step: None, or straight to a banding colour
        if p["id"] == "roman":
            for s in p["steps"]:
                if s["key"] == "banding":
                    s["options"] = ["None", "Beige", "Tan", "Red", "Grey", "Navy", "Moss", "Black"]
                    break
        # mount is the first choice after the room; roman gets one of its own
        if p["id"] == "roman":
            p["steps"].insert(0, {"key": "mount", "label": "Mount",
                                  "options": ["Inside", "Outside"]})
        else:
            for i, s in enumerate(p["steps"]):
                if s["key"] == "mount":
                    p["steps"].insert(0, p["steps"].pop(i))
                    break
    OUT.write_text(json.dumps({"products": products}, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
