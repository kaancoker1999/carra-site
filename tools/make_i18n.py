#!/usr/bin/env python3
"""Build the Spanish / French dictionaries for assets/i18n.js.

Source of truth: tools/i18n.json  {"<English string>": {"es": "...", "fr": "..."}}
plus the PATTERNS below (sentences with changing parts). Output: assets/i18n/es.js, fr.js.
Re-run after editing either:  python3 tools/make_i18n.py
To find text that still has no entry, open a page with ?i18n=collect and call
LUMIA_I18N.missing() in the console; add the strings to tools/i18n.json.
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
SRC = HERE / "i18n.json"
OUT = HERE.parent / "assets" / "i18n"

# (JavaScript regex source, Spanish, French).  $1… = the captured text as is,
# {1}… = the captured text translated (looked up like any other string).
PATTERNS = [
    (r"^Check the size — width (\S+), height (\S+)\.$", "Revise la medida: ancho $1, alto $2.", "Vérifiez les dimensions : largeur $1, hauteur $2."),
    (r"^Check the size — width (\S+), drop (\S+)\.$", "Revise la medida: ancho $1, caída $2.", "Vérifiez les dimensions : largeur $1, hauteur $2."),
    (r"^Width \(in\) (.+)$", "Ancho (pulg.) $1", "Largeur (po) $1"),
    (r"^Height \(in\) (.+)$", "Alto (pulg.) $1", "Hauteur (po) $1"),
    (r"^Drop \(in\) (.+)$", "Caída (pulg.) $1", "Hauteur (po) $1"),
    (r"^Step (\d+)$", "Paso $1", "Étape $1"),
    (r"^1 new$", "1 nuevo", "1 nouveau"),
    (r"^(\d+) new$", "$1 nuevos", "$1 nouveaux"),
    (r"^1 new message$", "1 mensaje nuevo", "1 nouveau message"),
    (r"^(\d+) new messages$", "$1 mensajes nuevos", "$1 nouveaux messages"),
    (r"^1 order$", "1 pedido", "1 commande"),
    (r"^(\d+) orders$", "$1 pedidos", "$1 commandes"),
    (r"^1 line$", "1 línea", "1 ligne"),
    (r"^(\d+) lines$", "$1 líneas", "$1 lignes"),
    (r"^1 unit$", "1 unidad", "1 unité"),
    (r"^([\d.]+) units$", "$1 unidades", "$1 unités"),
    (r"^1 day$", "1 día", "1 jour"),
    (r"^(\d+) days$", "$1 días", "$1 jours"),
    (r"^(\d+) of (\d+) photos$", "$1 de $2 fotos", "$1 sur $2 photos"),
    (r"^Up to (\d+) photos$", "Hasta $1 fotos", "Jusqu’à $1 photos"),
    (r"^Photo (\d+)$", "Foto $1", "Photo $1"),
    (r"^1 order is past the (\d+)-day payment window — (\S+) \((.+)\)\. Please pay as soon as possible\.$",
     "1 pedido superó el plazo de pago de $1 días: $2 ($3). Por favor, pague lo antes posible.",
     "1 commande a dépassé le délai de paiement de $1 jours : $2 ($3). Merci de régler dès que possible."),
    (r"^(\d+) orders are past the (\d+)-day payment window — (\S+) \((.+)\)\. Please pay as soon as possible\.$",
     "$1 pedidos superaron el plazo de pago de $2 días: $3 ($4). Por favor, pague lo antes posible.",
     "$1 commandes ont dépassé le délai de paiement de $2 jours : $3 ($4). Merci de régler dès que possible."),
    (r"^Due (.+)$", "Vence: $1", "Échéance : $1"),
    (r"^Sent ([^.?]{4,40})$", "Enviado: $1", "Envoyée : $1"),
    (r"^shipped (.+)$", "enviado: $1", "expédiée : $1"),
    (r"^delivered (.+?) \((.+)\)$", "entregado: $1 ({2})", "livrée : $1 ({2})"),
    (r"^payment due (.+)$", "el pago vence: $1", "échéance de paiement : $1"),
    (r"^paid (.+)$", "pagado: $1", "payée : $1"),
    (r"^product no\. (.+)$", "n.º de producto $1", "n° de produit $1"),
    (r"^I’ve paid all \((\d+)\)$", "Ya pagué todo ($1)", "J’ai tout payé ($1)"),
    (r"^View all (\d+) orders →$", "Ver los $1 pedidos →", "Voir les $1 commandes →"),
    (r"^This withdraws order (\S+) — it cannot be undone\. You can always reorder it afterwards\.$",
     "Esto retira el pedido $1 y no se puede deshacer. Siempre podrá volver a pedirlo después.",
     "Cela retire la commande $1 — cette action est irréversible. Vous pourrez toujours la recommander ensuite."),
    (r"^This tells LUMIA that order (\S+) arrived\. Once LUMIA confirms it too, the order moves to Past orders\.$",
     "Esto informa a LUMIA de que el pedido $1 llegó. Cuando LUMIA también lo confirme, el pedido pasará a Pedidos anteriores.",
     "Cela indique à LUMIA que la commande $1 est arrivée. Une fois confirmée par LUMIA, la commande passera dans Commandes passées."),
    (r"^Colour group (\d)( \([A-D]\))?$", "Grupo de color $1$2", "Groupe de couleur $1$2"),
    (r"^Group ([\dA-D])$", "Grupo $1", "Groupe $1"),
    (r"^Choose (.+) and (.+) before adding this line\.$", "Elija $1 y $2 antes de añadir esta línea.", "Choisissez $1 et $2 avant d’ajouter cette ligne."),
    (r"^Choose (.+) before adding this line\.$", "Elija $1 antes de añadir esta línea.", "Choisissez $1 avant d’ajouter cette ligne."),
    (r"^(.+) \(not with (.+)\)$", "{1} (no con {2})", "{1} (pas avec {2})"),
    (r"^(.+) \(not available\)$", "{1} (no disponible)", "{1} (non disponible)"),
    (r"^(Single Cell|Double Cell|Triple Cell) ([A-Z0-9][A-Z0-9/″ ]*)$", "{1} $2", "{1} $2"),
    (r"^W (\d.*)$", "An. $1", "L $1"),
    (r"^H (\d.*)$", "Al. $1", "H $1"),
    (r"^Drop (\d.*)$", "Caída $1", "Hauteur $1"),
    (r"^1 channel$", "1 canal", "1 canal"),
    (r"^(\d+) channel$", "$1 canales", "$1 canaux"),
    (r"^Chart ([AB])$", "Tabla $1", "Tableau $1"),
    (r"^These prices include your (\d+)% discount — valid until (.+?)\.?$",
     "Estos precios incluyen su descuento del $1 %, válido hasta el $2.",
     "Ces prix incluent votre remise de $1 %, valable jusqu’au $2."),
    (r"^\+ (\d+) on request$", "+ $1 a consultar", "+ $1 sur demande"),
    (r"^order (\S+)$", "pedido $1", "commande $1"),
    (r"^About order (\S+)$", "Sobre el pedido $1", "À propos de la commande $1"),
]


def js(s):
    return json.dumps(s, ensure_ascii=False)


def build(lang, idx):
    data = json.loads(SRC.read_text())
    entries = {k: v[lang] for k, v in sorted(data.items()) if v.get(lang) and v[lang] != k}
    lines = ["/* LUMIA — %s dictionary for assets/i18n.js. GENERATED by tools/make_i18n.py —" % {"es": "Spanish", "fr": "French"}[lang],
             "   edit tools/i18n.json (strings) or the PATTERNS in tools/make_i18n.py, then re-run it. */",
             "LUMIA_I18N_DATA({"]
    lines += ["%s:%s," % (js(k), js(v)) for k, v in entries.items()]
    lines.append("}, [")
    for p in PATTERNS:
        # the regex goes in as a JS regex literal ("/" is the only character to escape)
        lines.append("[/%s/, %s]," % (p[0].replace("/", "\\/"), js(p[idx])))
    lines.append("]);")
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / (lang + ".js")
    out.write_text("\n".join(lines) + "\n")
    print("wrote %s: %d strings, %d patterns, %d KB" % (out, len(entries), len(PATTERNS), out.stat().st_size // 1024))


if __name__ == "__main__":
    for i, lang in enumerate(("es", "fr"), start=1):
        build(lang, i)
