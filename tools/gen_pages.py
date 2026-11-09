#!/usr/bin/env python3
"""Generate per-product configurator pages for the LUMIA site."""
import json, pathlib

SITE = pathlib.Path.home() / "carra-site"
HERE = pathlib.Path(__file__).parent
FABRICS = json.loads((HERE / "fabric-data.json").read_text())
FAB_CELL = json.loads((HERE / "cellular-fabrics.json").read_text())

# rewrite image paths for the static site and keep only what the page needs
FAB = {
    "collections": [
        {"id": c["id"], "label": c["label"], "group": c.get("group"),
         "transparency": c["transparency"], "material": c["material"]}
        for c in FABRICS["collections"]
    ],
    "colors": {
        cid: [
            {"id": col["id"], "label": col["label"], "code": col.get("code", ""),
             "name": col.get("name", col["label"]),
             "img": "assets" + col["image"],
             "lg": "assets/fabrics-lg" + col["image"][len("/fabrics"):]}
            for col in cols
        ]
        for cid, cols in FABRICS["colors"].items()
    },
}

# The product page shell: marketing hero + the consumer shop (assets/shopkit.js).
TEMPLATE = (HERE / "product_template.html").read_text()

PRODUCTS = {
    "roman.html": {
        "code": "01", "name": "Roman Shades", "img": "assets/product-roman.jpg",
        "pdf": "assets/pdf/lumia-roman-shades-catalogue.pdf", "pdfsize": "8.3 MB",
        "desc": "Five fold styles across every fabric group — flat, back rods, front rods, relaxed and hobbled — with square hems and a consistent stack at any width. Lining and blackout backing are made in house.",
        "hLabel": "Height", "width": [18, 96], "height": [24, 96],
        "fabrics": True,
        "heightRules": {"drive": "drive", "rules": {
            "Cordless": [24, 96], "Continuous cord loop": [24, 120], "Motorized": [24, 120]}},
        "widthRules": {"drive": "drive", "tdbu": "tdbu", "rules": {
            "Cordless|No": [18, 96], "Cordless|Yes": [24, 96],
            "Continuous cord loop|No": [18, 105], "Continuous cord loop|Yes": [24, 105],
            "Motorized|No": [18, 105], "Motorized|Yes": [34, 105]}},
        "groups": [
            {"key": "fold", "label": "Fold style", "options": [
                {"n": "Flat", "img": "assets/fold-back-rods.jpg"},
                {"n": "Back rods", "img": "assets/fold-back-rods.jpg"},
                {"n": "Front rods", "img": "assets/fold-front-rods.jpg"},
                {"n": "Relaxed", "img": "assets/fold-relaxed.jpg"},
                {"n": "Hobbled", "img": "assets/fold-hobbled.jpg"}]},
            {"type": "fabrics"},
            {"key": "drive", "label": "Mechanism", "options": ["Cordless", "Continuous cord loop", "Motorized"],
             # a relaxed fold can't be motorized
             "exclude": {"key": "fold", "value": ["Relaxed"], "options": ["Motorized"]}},
            {"key": "chain", "label": "Control side", "options": ["Left", "Right"], "showIf": {"key": "drive", "value": ["Continuous cord loop", "Motorized"]}},
            {"key": "remote", "label": "Remote control", "options": ["No remote", "1-channel remote", "5-channel remote", "15-channel remote"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "cable", "label": "USB-C charging cable", "options": ["No", "Yes"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "hub", "label": "Smart home hub", "options": ["No", "Yes"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "tdbu", "label": "Top-down bottom-up", "options": ["No", "Yes"]},
            {"key": "liner", "label": "Liner", "options": ["Unlined", "White liner", "Blackout liner"]},
            {"key": "banding", "label": "Edge banding", "options": ["None", "Yes"]},
        ],
    },
    "cellular.html": {
        "code": "02", "name": "Cellular Shades", "img": "assets/product-cellular.jpg",
        "pdf": "assets/pdf/lumia-cellular-shades-catalogue-2025.pdf", "pdfsize": "3.9 MB",
        "desc": "Single, double and triple cell honeycomb in sheer, light-filtering and blackout, bonded so the cell holds its shape for the life of the shade. The most energy-efficient range we build.",
        "hLabel": "Height", "width": [19, 105], "height": [20, 137],
        "sizeRange": 'W 19" – 105" · H 20" – 137"',
        "depth": "Inside 1½″ · fully recessed 2⅜″ · outside surface 2¼″",
        "fabrics": "cell",
        # "TDC Honeycomb Shades Constraints and Specifications" (single headrail).
        # Cell classes: S = single cell (any opacity), DLF = double light-filtering,
        # DBO = double blackout, T = triple. First matching rule wins; na = not offered.
        "sizeRules": [
            {"drive": "Cordless", "tdbu": "No", "cls": ["S", "DLF"], "w": [19, 96], "h": [20, 96]},
            {"drive": "Cordless", "tdbu": "No", "cls": ["DBO", "T"], "w": [19, 84], "h": [20, 84]},
            {"drive": "Cordless", "tdbu": "Yes", "cls": ["S"], "w": [24, 84], "h": [20, 84]},
            {"drive": "Cordless", "tdbu": "Yes", "cls": ["DLF"], "w": [24, 72], "h": [20, 72]},
            {"drive": "Cordless", "tdbu": "Yes", "cls": ["DBO", "T"], "na": True},
            {"drive": "Cord loop", "tdbu": "No", "w": [19, 105], "h": [20, 137]},
            {"drive": "Cord loop", "tdbu": "Yes", "w": [24, 105], "h": [20, 137]},
            {"drive": "Motorized", "tdbu": "No", "w": [24, 105], "h": [20, 137]},
            {"drive": "Motorized", "tdbu": "Yes", "w": [34, 105], "h": [20, 137]},
        ],
        "groups": [
            {"key": "cell", "label": "Cell", "options": ["Single", "Double", "Triple"]},
            {"key": "opacity", "label": "Opacity", "options": ["Sheer", "Light-filtering", "Blackout"]},
            {"type": "fabrics"},
            {"key": "mount", "label": "Mount", "options": ["Inside", "Outside"]},
            {"key": "drive", "label": "Drive", "options": ["Cordless", "Cord loop", "Motorized"]},
            {"key": "chain", "label": "Control side", "options": ["Left", "Right"], "showIf": {"key": "drive", "value": ["Cord loop", "Motorized"]}},
            {"key": "remote", "label": "Remote control", "options": ["No remote", "1-channel remote", "5-channel remote", "15-channel remote"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "cable", "label": "USB-C charging cable", "options": ["No", "Yes"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "hub", "label": "Smart home hub", "options": ["No", "Yes"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "tdbu", "label": "Top-down bottom-up", "options": ["No", "Yes"]},
        ],
    },
    "pleated.html": {
        "code": "03", "name": "Pleated Shades", "img": "assets/product-pleated.jpg",
        "desc": "Single-layer pleated fabric in plain and crashed finishes, with a crisp, evenly held fold and the slimmest stack in the range — the shallowest option when the reveal is tight.",
        "hLabel": "Height", "width": [18, 105], "height": [24, 120],
        "sizeRange": 'W 18" – 105" · H 24" – 120"',
        "groups": [
            {"key": "fabric", "label": "Fabric", "options": ["Plain", "Crashed"]},
            {"key": "opacity", "label": "Opacity", "options": ["Light-filtering"]},
            {"key": "colour", "label": "Colour", "options": [
                {"n": "White", "c": "#FAFAF7"}, {"n": "Pearl", "c": "#F1EDE4"},
                {"n": "Linen", "c": "#E6DCC8"}, {"n": "Mist grey", "c": "#C9CBC9"},
                {"n": "Graphite", "c": "#5A5E62"}]},
            {"key": "mount", "label": "Mount", "options": ["Inside", "Outside"]},
            {"key": "drive", "label": "Drive", "options": ["Cordless", "Cord loop", "Motorized"]},
            {"key": "chain", "label": "Control side", "options": ["Left", "Right"], "showIf": {"key": "drive", "value": ["Cord loop", "Motorized"]}},
            {"key": "remote", "label": "Remote control", "options": ["No remote", "1-channel remote", "5-channel remote", "15-channel remote"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "cable", "label": "USB-C charging cable", "options": ["No", "Yes"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "hub", "label": "Smart home hub", "options": ["No", "Yes"], "showIf": {"key": "drive", "value": "Motorized"}},
            {"key": "tdbu", "label": "Top-down bottom-up", "options": ["No", "Yes"]},
        ],
    },
    "drapery.html": {
        "code": "04", "name": "Drapery", "img": "assets/product-drapery.jpg",
        "desc": "Five heading styles on concealed hook gliders, hung on a slim aluminum track with flat end caps. Made to the drop, hemmed and steamed before it is packed, so it hangs straight out of the box.",
        "hLabel": "Drop", "width": [18, 192], "height": [24, 120],
        "sizeRange": 'W 18" – 192" · Drop 24" – 120"',
        "note": "Concealed hook gliders, 1.5 kg per carrier",
        "fabrics": True,
        "groups": [
            {"key": "heading", "label": "Heading", "options": [
                {"n": "Wave fold", "img": "assets/heading-wave-fold.jpg", "ph": True},
                {"n": "Single pinch pleat", "img": "assets/heading-single-pinch.jpg", "ph": True},
                {"n": "Double pinch pleat", "img": "assets/heading-double-pinch.jpg", "ph": True},
                {"n": "Triple pinch pleat", "img": "assets/heading-triple-pinch.jpg", "ph": True},
                {"n": "Euro pleat", "img": "assets/heading-euro-pleat.jpg", "ph": True}]},
            {"key": "panel", "label": "Panels", "options": ["Single panel", "Pair, centre split"]},
            {"type": "fabrics"},
            {"key": "liner", "label": "Liner", "options": ["Unlined", "White liner", "Blackout liner"]},
            {"key": "trackopt", "label": "Add track", "options": ["Yes", "No"]},
            {"key": "track", "label": "Track mount", "options": ["Wall", "Ceiling"], "choose": True,
             "showIf": {"key": "trackopt", "value": "Yes"}},
            # drapery is hand drawn only — there is no motor pricing yet, so the
            # motorized operation and the steps hanging off it stay out
        ],
    },
}

def generate():
    for fname, cfg in PRODUCTS.items():
        html = (TEMPLATE
                .replace("@@NAME@@", cfg["name"])
                .replace("@@PID@@", fname[:-len(".html")])
                .replace("@@FNAME@@", fname)
                .replace("@@PDFBTN@@",
                         ('      <p><a class="pdfbtn" href="' + cfg["pdf"] + '" target="_blank" rel="noopener">'
                          'View product catalogue <span class="sz">PDF &#8599;</span></a></p>')
                         if cfg.get("pdf") else "")
                .replace("@@DESC@@", cfg["desc"])
                .replace("@@IMG@@", cfg["img"]))
        (SITE / fname).write_text(html)
        print("wrote", fname, len(html), "bytes")


if __name__ == "__main__":
    generate()
