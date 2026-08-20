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
# Colour availability differs per cell type — lists below follow the
# "LUMIA Cellular Shades Catalogue 2025" colour-range pages (series codes).
SERIES_COLOURS = {
    "BH":   ["001", "002", "004", "005", "007", "009", "010", "015", "011", "019",
             "012", "021", "023", "024", "025", "030", "027", "040", "101"],
    "XH":   ["001", "002", "004", "005", "007", "009", "010", "015", "011", "019",
             "012", "021", "101"],
    "DH":   ["200", "400", "500", "5247", "5249"],
    "SH":   ["100", "900", "300", "600"],
    "CH":   ["001", "002", "004", "005", "007", "009", "010", "015", "011", "019",
             "012", "021", "023", "024", "025", "030", "027", "040", "101"],
    "TH":   ["001", "002", "004", "005", "007", "009", "010", "015", "011", "019",
             "012", "021", "023", "025", "101"],
    "BHBO": ["001", "002", "004", "005", "007", "009", "012", "023", "015", "030",
             "021", "040", "101"],
    "XHBO": ["001", "002", "004", "005", "007", "009", "015", "030", "021", "023"],
    "CHBO": ["001", "002", "004", "005", "007", "009", "012", "023", "015", "030",
             "021", "040", "101"],
}

CELL_CHOICES = [
    ("Light Filtering · Single Cell", "BH"),
    ("Light Filtering · Double Cell", "CH"),
    ("Light Filtering · Single Cell 3/4″", "XH"),
    ("Light Filtering · Triple Cell 3/8″", "TH"),
    ("Designer Prints · Single Cell 3/4″", "DH"),
    ("Sheer Woven · Single Cell 3/4″", "SH"),
    ("Blackout · Single Cell", "BHBO"),
    ("Blackout · Double Cell", "CHBO"),
    ("Blackout · Single Cell 3/4″", "XHBO"),
]


def series_colours(series):
    return [f"{series} {c}" for c in SERIES_COLOURS[series]]


def fabric_first(steps):
    """Product, then fabric & colour, then everything else."""
    front = [s for s in steps if s["key"] in ("collection", "fabric", "colour")]
    rest = [s for s in steps if s["key"] not in ("collection", "fabric", "colour")]
    return front + rest


# Order size limits follow the PRICE GRIDS (the workbook), not the marketing
# ranges on the configurator pages — a dealer can order anything that has a
# price. Update these if the workbook grids grow.
GRID_LIMITS = {
    "roman": {"width": [18, 98], "height": [24, 106]},
    "cellular": {"width": [18, 120], "height": [24, 137]},
    "pleated": {"width": [18, 120], "height": [24, 137]},
}

ARCH_STYLES = [
    ("Light Filtering · Single Cell", "Light Filtering", "Single Cell"),
    ("Light Filtering · Double Cell", "Light Filtering", "Double Cell"),
    ("Light Filtering · Triple Cell", "Light Filtering", "Triple Cell"),
    ("Blackout · Single Cell", "Blackout", "Single Cell"),
    ("Blackout · Double Cell", "Blackout", "Double Cell"),
]


ARCH_SERIES = {
    ("Light Filtering", "Single Cell"): "BH",
    ("Light Filtering", "Double Cell"): "CH",
    ("Light Filtering", "Triple Cell"): "TH",
    ("Blackout", "Single Cell"): "BHBO",
    ("Blackout", "Double Cell"): "CHBO",
}


def arches_product():
    return {
        "id": "arches", "name": "Cellular Arches",
        "width": [19, 84], "height": [10, 50], "hLabel": "Height",
        "steps": [{
            "key": "collection", "label": "Style",
            "options": [{"id": f"arch|{grid}|{row}", "label": label}
                        for label, grid, row in ARCH_STYLES],
            "colours": {f"arch|{grid}|{row}": series_colours(ARCH_SERIES[(grid, row)])
                        for label, grid, row in ARCH_STYLES},
        }],
    }


def fabric_product():
    """Fabric by the yard — same collections/colours as Roman, no dimensions."""
    gate = {"key": "cgroup", "value": ["Group 1", "Group 2", "Group 3", "Group 4"]}
    colours = {
        c["id"]: [col.get("code") or col["label"] for col in gp.FAB["colors"][c["id"]]]
        for c in gp.FAB["collections"]
    }
    return {
        "id": "fabric", "name": "Fabric Only",
        "noSize": True, "qtyLabel": "Yards",
        "width": [0, 0], "height": [0, 0], "hLabel": "Height",
        "steps": [
            {"key": "cgroup", "label": "Colour group",
             "options": ["— Select —", "Group 1", "Group 2", "Group 3", "Group 4"]},
            {"key": "collection", "label": "Fabric", "showIf": gate,
             "options": [{"id": c["id"], "label": c["label"], "group": c.get("group")}
                         for c in gp.FAB["collections"]],
             "colours": colours},
        ],
    }


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
                    "options": [{"id": c["id"], "label": c["label"], "group": c.get("group")}
                                for c in fabric_data["collections"]],
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
            steps.insert(0, {
                "key": "collection", "label": "Cell & opacity",
                "options": [{"id": series, "label": name} for name, series in CELL_CHOICES],
                "colours": {series: series_colours(series) for _, series in CELL_CHOICES},
            })

        steps = fabric_first(steps)

        pid = fname.replace(".html", "")
        if pid in ("drapery", "roman"):
            # colour group first; everything else appears once it is chosen,
            # and the fabric list narrows to that group's collections
            gate = {"key": "cgroup", "value": ["Group 1", "Group 2", "Group 3", "Group 4"]}
            for st in steps:
                if "showIf" not in st:
                    st["showIf"] = gate
            steps.insert(0, {"key": "cgroup", "label": "Colour group",
                             "options": ["— Select —", "Group 1", "Group 2", "Group 3", "Group 4"]})
        lim = GRID_LIMITS.get(pid, {})
        products.append({
            "id": pid,
            "name": cfg["name"],
            "width": lim.get("width", cfg["width"]),
            "height": lim.get("height", cfg["height"]),
            "hLabel": cfg.get("hLabel", "Height"),
            "steps": steps,
        })

    products.append(arches_product())
    products.append(fabric_product())
    OUT.write_text(json.dumps({"products": products}, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
