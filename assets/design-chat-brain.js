/* LUMIA — how Mira's written replies read a message.
   Shared by the design-chat page (assets/design-chat.js) and by the helper on
   the product pages (assets/mira.js). No DOM, no network: text in, a list of
   changes and questions out. English, Spanish and French.
   (With an AI key the server does the understanding instead — this file is
   what keeps the page usable without one.) */

import * as core from './design-chat-core.js?v=1';

/* option values stay English in the data (as in the shop); Spanish is display only — the site's own terms */
export const VAL_ES = {
  'Roman Shades': 'Cortinas romanas', 'Cellular Shades': 'Cortinas celulares', 'Pleated Shades': 'Cortinas plisadas', 'Drapery': 'Cortinajes',
  'Inside': 'Interior', 'Outside': 'Exterior', 'Cordless': 'Sin cordón', 'Cord loop': 'Cadena continua', 'Continuous cord loop': 'Cadena continua',
  'Motorized': 'Motorizada', 'Unlined': 'Sin forro', 'White liner': 'Forro blanco', 'Blackout liner': 'Forro blackout',
  'Back rods': 'Varillas traseras', 'Front rods': 'Varillas frontales', 'Relaxed': 'Relajado', 'Hobbled': 'En cascada', 'Flat': 'Plano',
  'Wave fold': 'Onda', 'Single pinch pleat': 'Pliegue pinza sencillo', 'Double pinch pleat': 'Pliegue pinza doble',
  'Triple pinch pleat': 'Pliegue pinza triple', 'Euro pleat': 'Pliegue europeo', 'Single panel': 'Panel sencillo',
  'Pair, centre split': 'Par, apertura central', 'Yes': 'Sí', 'No': 'No', 'Wall': 'Pared', 'Ceiling': 'Techo', 'Plain': 'Liso', 'Crashed': 'Arrugado',
  'White': 'Blanco', 'Pearl': 'Perla', 'Linen': 'Lino', 'Mist grey': 'Gris niebla', 'Graphite': 'Grafito', 'None': 'Ninguno',
  'Light-filtering fabric': 'Tela que filtra la luz', 'Semi-transparent': 'Semitransparente', 'Sheer': 'Traslúcido', 'Blackout': 'Blackout',
  'Room darkening': 'Oscurecimiento', 'Light-filtering cotton blend': 'Mezcla de algodón que filtra la luz', 'Cotton blend': 'Mezcla de algodón',
  'Light Filtering': 'Filtra la luz', 'Single Cell': 'Celda sencilla', 'Double Cell': 'Celda doble', 'Triple Cell': 'Celda triple',
  'Designer Prints': 'Estampados de diseño', 'Sheer Woven': 'Tejido traslúcido',
  'Track mount': 'Montaje del riel', 'Control side': 'Lado del control', 'Left': 'Izquierda', 'Right': 'Derecha',
};
/* French: the site's own terms (tools/i18n.json). Colour names stay as they are, as on the site. */
export const VAL_FR = {
  'Roman Shades': 'Stores romains', 'Cellular Shades': 'Stores alvéolaires', 'Pleated Shades': 'Stores plissés', 'Drapery': 'Rideaux',
  'Inside': 'Intérieure', 'Outside': 'Extérieure', 'Cordless': 'Sans cordon', 'Cord loop': 'Chaînette continue', 'Continuous cord loop': 'Chaînette continue',
  'Motorized': 'Motorisé', 'Unlined': 'Sans doublure', 'White liner': 'Doublure blanche', 'Blackout liner': 'Doublure occultante',
  'Back rods': 'Baguettes arrière', 'Front rods': 'Baguettes avant', 'Relaxed': 'Détendu', 'Hobbled': 'À plis superposés', 'Flat': 'Plat',
  'Wave fold': 'Vague', 'Single pinch pleat': 'Pli pincé simple', 'Double pinch pleat': 'Pli pincé double',
  'Triple pinch pleat': 'Pli pincé triple', 'Euro pleat': 'Pli européen', 'Single panel': 'Panneau simple',
  'Pair, centre split': 'Paire, ouverture centrale', 'Yes': 'Oui', 'No': 'Non', 'Wall': 'Mur', 'Ceiling': 'Plafond', 'Plain': 'Uni', 'Crashed': 'Froissé',
  'Linen': 'Lin', 'None': 'Aucun',
  'Light-filtering fabric': 'Tissu tamisant', 'Semi-transparent': 'Semi-transparent', 'Sheer': 'Voilage', 'Blackout': 'Occultant',
  'Room darkening': 'Obscurcissant', 'Light-filtering cotton blend': 'Mélange de coton tamisant', 'Cotton blend': 'Mélange de coton',
  'Light Filtering': 'Tamisant', 'Single Cell': 'Alvéole simple', 'Double Cell': 'Alvéole double', 'Triple Cell': 'Alvéole triple',
  'Sheer Woven': 'Voilage tissé',
  'Track mount': 'Pose du rail', 'Control side': 'Côté de commande', 'Left': 'Gauche', 'Right': 'Droite',
};
const VALS = { es: VAL_ES, fr: VAL_FR };
export function tv(lang, v){
  const T = VALS[lang];
  if(!T || v == null) return v;
  if(T[v]) return T[v];
  /* composite labels such as "Light Filtering · Single Cell 3/4″" */
  return String(v).split(' · ').map(p => {
    const m = p.match(/^(.*?)( \d\/\d″)?$/);
    return (T[m[1]] || m[1]) + (m[2] || '');
  }).join(' · ');
}
const tvl = tv;
export function noteText(lang, n){
  const es = lang === 'es', tv = (v) => tvl(lang, v);
  if(lang === 'fr'){
    const low = (v) => '«\u00A0' + String(tv(v)).toLowerCase() + '\u00A0»';
    if(n.code === 'mech_switched') return `À cette taille, le mécanisme ${low(n.from)} n’est pas possible (il va jusqu’à ${n.w[1]}″ de large × ${n.h[1]}″ de haut). Je suis donc passée à ${low(n.to)}.`;
    if(n.code === 'mech_size') return `Le mécanisme ${low(n.drive)}${n.tdbu === 'Yes' ? ' avec ouverture haut-bas' : ''} se fabrique de ${n.w[0]}″ à ${n.w[1]}″ de large et jusqu’à ${n.h[1]}″ de haut. J’ai donc laissé le mécanisme tel qu’il était.`;
    if(n.code === 'size_clamped') return `Nous fabriquons ce produit de ${n.w[0]}″ à ${n.w[1]}″ de large et de ${n.h[0]}″ à ${n.h[1]}″ de haut. J’ai donc ramené les dimensions dans cette plage.`;
    if(n.code === 'excluded') return n.value === 'Relaxed'
      ? `Un pli détendu ne peut pas être motorisé. Je l’ai donc laissé sur ${low(n.now)}.`
      : `Le pli plat ne se fabrique pas sans cordon. Je l’ai donc réglé sur ${low(n.now)}.`;
    if(n.code === 'tdbu_na' || n.code === 'tdbu_size') return 'L’ouverture haut-bas n’est pas proposée dans cette combinaison. Je l’ai donc laissée désactivée.';
    if(n.code === 'unknown' && n.what === 'colour') return 'Je n’ai pas trouvé cette couleur dans notre gamme. L’étape du tissu montre tout ce que nous avons.';
    return '';
  }
  if(n.code === 'mech_switched') return es
    ? `Con esa medida no se fabrica con ${tv(n.from).toLowerCase()} (llega hasta ${n.w[1]}″ de ancho × ${n.h[1]}″ de alto), así que la cambié a ${tv(n.to).toLowerCase()}.`
    : `At that size it can't be built ${n.from.toLowerCase()} — that goes up to ${n.w[1]}″ wide × ${n.h[1]}″ tall — so I've switched it to ${n.to.toLowerCase()}.`;
  if(n.code === 'mech_size') return es
    ? `${tv(n.drive)}${n.tdbu === 'Yes' ? ' con apertura superior e inferior' : ''} se fabrica de ${n.w[0]}″ a ${n.w[1]}″ de ancho y hasta ${n.h[1]}″ de alto, así que dejé el mecanismo como estaba.`
    : `${n.drive}${n.tdbu === 'Yes' ? ' with top-down bottom-up' : ''} is built from ${n.w[0]}″ to ${n.w[1]}″ wide and up to ${n.h[1]}″ tall, so I've left the mechanism as it was.`;
  if(n.code === 'size_clamped') return es
    ? `Fabricamos este producto de ${n.w[0]}″ a ${n.w[1]}″ de ancho y de ${n.h[0]}″ a ${n.h[1]}″ de alto, así que ajusté la medida a ese rango.`
    : `We build this from ${n.w[0]}″ to ${n.w[1]}″ wide and ${n.h[0]}″ to ${n.h[1]}″ tall, so I've brought the size inside that range.`;
  if(n.code === 'excluded') return n.value === 'Relaxed'
    ? (es ? `Un pliegue relajado no se puede motorizar, así que quedó ${tv(n.now).toLowerCase()}.` : `A relaxed fold can't be motorized, so I've kept it ${n.now.toLowerCase()}.`)
    : (es ? `El pliegue plano no se fabrica sin cordón, así que quedó con ${tv(n.now).toLowerCase()}.` : `A flat fold isn't made cordless, so I've set it to ${n.now.toLowerCase()}.`);
  if(n.code === 'tdbu_na' || n.code === 'tdbu_size') return es
    ? 'La apertura superior e inferior no se ofrece en esta combinación, así que la dejé desactivada.'
    : "Top-down bottom-up isn't offered in this combination, so I've left it off.";
  if(n.code === 'unknown' && n.what === 'colour') return es
    ? 'No encontré ese color en nuestra gama; en el paso de la tela está todo lo que tenemos.'
    : "I couldn't find that color in our range — the fabric step shows everything we have.";
  return '';
}


export function norm(s){ return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[“”″]/g, '"').replace(/[’]/g, "'"); }
function num(a, frac){
  let v = parseFloat(String(a).replace(',', '.'));
  if(frac){ const m = frac.match(/(\d)\/(\d)/); if(m && +m[2]) v += (+m[1]) / (+m[2]); }
  return v;
}
export function parseSize(s){
  const N = '(\\d{1,3}(?:[.,]\\d+)?)(?:\\s+(\\d\\/\\d))?', U = '\\s*(?:"|in\\b|inch(?:es)?\\b|pulg(?:adas?)?\\b|po\\b|pouces?\\b)?';
  const ok = v => v >= 8 && v <= 400;
  let m = s.match(new RegExp(N + U + '\\s*(?:x|×|by|por|par|sur)\\s*' + N));
  if(m){ const w = num(m[1], m[2]), h = num(m[3], m[4]); return ok(w) && ok(h) ? { w, h } : null; }
  const out = {};
  m = s.match(new RegExp('(?:width|wide|ancho|anchura|largeur)\\D{0,14}?' + N)) || s.match(new RegExp(N + U + '\\s*(?:wide|de ancho|de large(?:ur)?)'));
  if(m && ok(num(m[1], m[2]))) out.w = num(m[1], m[2]);
  m = s.match(new RegExp('(?:height|tall|high|drop|long|alto|altura|caida|largo|hauteur|tombee)\\D{0,14}?' + N)) || s.match(new RegExp(N + U + '\\s*(?:tall|high|long|de alto|de largo|de haut(?:eur)?)'));
  if(m && ok(num(m[1], m[2]))) out.h = num(m[1], m[2]);
  return (out.w || out.h) ? out : null;
}
const COLOUR_WORDS = [
  /* [what people write, names that mean exactly that, names that are close, the pleated colour] */
  [/\b(white|blanc[oa]s?|blanc(he)?s?|ivory|marfil|ivoire|cream|crema|creme|off.?white)\b/, /white|ivory/i, /cloud|cotton|pearl|snow|cream|pale/i, 'White'],
  [/\b(beige|sand|arena|sable|neutral|neutr[oa]|neutre|linen|lino|\blin|tan|taupe|warm)\b/, /beige|sand|taupe/i, /linen|almond|oyster|pebble|honey|drift/i, 'Linen'],
  [/\b(grey|gray|gris(es)?|silver|plata|argent)\b/, /grey|gray/i, /ash|smoke|fog|steel|stone|dust|mist/i, 'Mist grey'],
  [/\b(blue|azul(es)?|bleu(e)?s?|navy|marine|teal)\b/, /blue/i, /indigo|ocean|aqua|horizon|teal/i, null],
  [/\b(green|verde|vert(e)?s?|sage|sauge|olive|oliva)\b/, /green/i, /sage|olive/i, null],
  [/\b(red|roj[oa]|rouges?|terracotta|terracota|terre cuite)\b/, /\bred\b|crimson|ruby/i, /terracotta|sienna|clay/i, null],
  [/\b(brown|marron|bruns?|cafe|chocolate|chocolat)\b/, /brown|coffee/i, /truffle|bark|cinnamon/i, null],
  [/\b(black|negr[oa]|noir(e)?s?|charcoal|carbon|anthracite|dark grey|dark gray|gris fonce|graphite|grafito)\b/, /black|charcoal/i, /midnight|graphite|shadow/i, 'Graphite'],
  [/\b(pink|rosa|roses?|blush)\b/, /pink|blush|rose/i, /mauve|berry/i, null],
  [/\b(purple|morad[oa]|violeta|violet(te)?s?|lila|lilas|plum|prune)\b/, /purple|plum/i, /lavender|mulberry/i, null],
  [/\b(pearl|perla|perle)\b/, /pearl/i, /oyster/i, 'Pearl'],
];
const NOT_A_COLOUR = ['shade', 'thread', 'grain', 'loom', 'dust', 'drift', 'ridge', 'wisp', 'glint'];
function findByWord(cat, pid, curColl, s){
  const words = COLOUR_WORDS.filter(w => w[0].test(s));
  /* "dark grey" is the dark entry, not the grey one */
  if(/dark gr[ae]y|gris fonce/.test(s)) words.sort((x, y) => (y[3] === 'Graphite') - (x[3] === 'Graphite'));
  for(const [, exact, close, pleated] of words){
    if(pid === 'pleated') return pleated ? { colour: pleated } : { miss: true };
    const cols = core.collections(cat, pid);
    const cur = cols.filter(c => c.id === curColl)[0];
    const order = [curColl].concat(cols.filter(c => c.id !== curColl && cur && c.group === cur.group).map(c => c.id), cols.map(c => c.id));
    /* an exact name anywhere in reach beats a merely close one */
    for(const nameRe of [exact, close]){
      for(const cid of order){
        const hit = core.colours(cat, pid, cid).filter(code => nameRe.test(core.swatch(cat, pid, cid, code).name))[0];
        if(hit) return { collection: cid, colour: hit };
      }
    }
    return { miss: true };
  }
  return null;
}
export function understand(cat, design, raw){
  const s = norm(raw), d = design, r = { patch: {}, ask: {}, room: null, need: {}, said: {} };
  if(/\broman[ao]?s?\b|\bromains?\b/.test(s)) r.patch.product = 'roman';
  else if(/cellular|celular|honeycomb|panal|alveol|nid d'abeille/.test(s)) r.patch.product = 'cellular';
  else if(/pleated|plisad|\bplisses?\b/.test(s)) r.patch.product = 'pleated';
  else if(/drap|curtain|cortinaje|rideau/.test(s)) r.patch.product = 'drapery';

  if(/nursery|baby|bebe|\bkids?\b|ninos?\b|\benfants?\b/.test(s)) r.room = 'nursery';
  else if(/bedroom|dormitorio|habitacion|recamara|cuarto|\bchambre/.test(s)) r.room = 'bedroom';
  else if(/living|lounge|family room|\bsala\b|salon|sejour/.test(s)) r.room = 'living';
  else if(/dining|comedor|salle a manger/.test(s)) r.room = 'dining';
  else if(/kitchen|cocina|cuisine/.test(s)) r.room = 'kitchen';
  else if(/bath|bano|salle de bain|salle d'eau/.test(s)) r.room = 'bath';
  else if(/office|study|desk|oficina|estudio|despacho|\bbureau/.test(s)) r.room = 'office';
  else if(/sliding|patio|french door|corrediza|puerta|ventanal|porte.?fenetre|baie vitree|coulissant/.test(s)) r.room = 'door';

  /* "blackout liner" asks for a liner, not for a blackout fabric */
  r.need.dark = /blackout|black out|\b(darken|darker|darkness|pitch dark|dark room|room.?darkening|totally dark|completely dark)\b|sleep|oscurec|oscuridad|a oscuras|dormir|opac|occult|obscur|noir (complet|total)|dans le noir|sommeil|piece sombre/.test(s.replace(/blackout lin\w*|forro (blackout|opaco)|doublure occultante/g, ' '));
  r.need.insulate = /insulat|energy|\bheat|\bcold|draft|aisla|energ|calor|\bfrio|\bisol|chaleur|\bfroid|courant d'air/.test(s);
  r.need.sheer = /sheer|translucid|vaporos|voilage/.test(s);
  r.need.slim = /slim|minimal|simple|discret|sencill/.test(s);
  r.need.child = /child|toddler|\bkids?\b|ninos?\b|bebe|baby|\benfants?\b|tout.?petit/.test(s);
  r.need.soft = /soft light|light.?filter|filtered light|gentle light|luz suave|filtr|lumiere douce|lumiere tamisee|tamisant/.test(s);
  r.need.privacy = /privacy|street|neighbou?r|privacidad|\bcalle\b|vecin|intimite|\brue\b|voisin|vis.a.vis/.test(s);
  r.need.heat = /insulat|energy|\bheat|\bhot\b|\bcold\b|draft|aisla|energ|calor|\bfrio|\bisol|chaleur|\bchaud|\bfroid|courant d'air/.test(s);

  /* nobody named a product: suggest one from the room and what they want */
  if(!r.patch.product && !d){
    if(r.room === 'door') r.patch.product = 'drapery', r.why = 'door';
    else if(r.need.insulate) r.patch.product = 'cellular', r.patch.collection = 'CH', r.why = 'insulate';
    else if(r.need.dark || r.room === 'bedroom' || r.room === 'nursery') r.patch.product = 'cellular', r.why = 'sleep';
    else if(r.room === 'kitchen' || r.room === 'bath' || r.need.slim) r.patch.product = 'pleated', r.why = r.room === 'bath' ? 'bath' : 'kitchen';
    else if(r.room === 'office') r.patch.product = 'cellular', r.patch.tdbu = 'Yes', r.why = 'office';
    else if(r.need.sheer) r.patch.product = 'roman', r.why = 'sheer';
    else if(r.room === 'living' || r.room === 'dining') r.patch.product = 'roman', r.why = 'living';
  }
  const pid = r.patch.product || (d && d.product);
  const curColl = (d && d.product === pid && d.collection) || (pid ? core.defaultDesign(cat, pid).collection : null);

  if(pid){
    if(r.need.dark){
      if(pid === 'roman' || pid === 'drapery') r.patch.collection = 'obscura';
      else if(pid === 'cellular') r.patch.collection = ({ CH: 'CHBO', CHBO: 'CHBO', XH: 'XHBO', XHBO: 'XHBO' })[r.patch.collection || curColl] || 'BHBO';
      else r.said.noBlackout = true;
    } else if(r.need.sheer && pid === 'roman') r.patch.collection = 'soho';
    /* a collection named outright */
    core.collections(cat, pid).forEach(c => {
      if(pid !== 'cellular' && new RegExp('\\b' + norm(c.label) + '\\b').test(s)) r.patch.collection = c.id;
    });
    if(pid === 'cellular'){
      const bo = /BO$/.test(r.patch.collection || curColl || '');
      if(/triple/.test(s)) r.patch.collection = 'TH';
      else if(/double|doble/.test(s)) r.patch.collection = bo ? 'CHBO' : 'CH';
      else if(/single cell|celda sencilla|alveole simple/.test(s)) r.patch.collection = bo ? 'BHBO' : 'BH';
    }
    /* a colour: by its own name first, then by a plain colour word */
    if(pid !== 'cellular'){
      const coll = r.patch.collection || curColl;
      /* "white liner" names a liner, not a white fabric */
      const sc = s.replace(/(white|blackout) lin\w*|forro (blanco|blackout|opaco)|doublure (blanche|occultante)|dans le noir|noir (complet|total|pour dormir)/g, ' ');
      let named = null;
      if(pid !== 'pleated') core.collections(cat, pid).forEach(c => core.colours(cat, pid, c.id).forEach(code => {
        /* "14 — Graphite Fog (1)" → "graphite fog"; whole words only, and never words people use anyway */
        const n = norm(core.swatch(cat, pid, c.id, code).name).replace(/^\d+\s*\W+\s*/, '').replace(/\s*\(\d+\)$/, '');
        if(n.length < 4 || !isNaN(+n) || NOT_A_COLOUR.indexOf(n) !== -1) return;
        if(new RegExp('\\b' + n.replace(/[^a-z0-9 ]/g, '.') + '\\b').test(sc) && (!named || c.id === coll)) named = { collection: c.id, colour: code, n };
      }));
      const hit = named || findByWord(cat, pid, coll, sc);
      if(hit && hit.miss) r.said.noColour = true;
      else if(hit){
        /* found by a plain word ("blue"), not by a colour's own name: said.colourWord keeps the fabric as it was before */
        if(!named) r.said.colourWord = { collection: r.patch.collection || null };
        else r.said.colourName = { collection: r.patch.collection || null, name: named.n };
        if(hit.collection && !r.need.dark) r.patch.collection = hit.collection; if(!r.need.dark || hit.collection === r.patch.collection) r.patch.colour = hit.colour; r.said.colour = true; }
    }
  }
  const sz = parseSize(s);
  if(sz){ Object.assign(r.patch, sz); r.said.size = true; }
  if(/\b(inside|recess|in the frame|dentro|interior|interieure?|dans le cadre|dans l'embrasure|encastree?)\b/.test(s)) r.patch.mount = 'Inside';
  else if(/\b(outside|on the wall|fuera|exterior|sobre la pared|exterieure?|sur le mur|au mur)\b/.test(s)) r.patch.mount = 'Outside';
  /* "inside or outside?" is a question, not a choice */
  if(/\b(inside|dentro|interior|interieure?)\b/.test(s) && /\b(outside|fuera|exterior|exterieure?)\b/.test(s)) delete r.patch.mount;
  if(/motor|remote|smart|alexa|automat|telecommande/.test(s)) r.patch.drive = 'Motorized';
  else if(/cordless|no cord|sin cordon|sin cuerda|inalambric|sans cordon|sans fil/.test(s)) r.patch.drive = 'Cordless';
  else if(/cord loop|chain|\bloop\b|cadena/.test(s)) r.patch.drive = 'Cord loop';
  if(/top.?down|tdbu|bottom.?up|superior e inferior|haut.?bas|haut et bas/.test(s)) r.patch.tdbu = /\b(no|without|sin|sans|pas d[e'])\b.{0,14}(top|tdbu|superior|haut)/.test(s) ? 'No' : 'Yes';
  if(/blackout lin|forro blackout|forro opac|doublure occultante/.test(s)) r.patch.liner = 'Blackout liner';
  else if(/white lin|forro blanco|doublure blanche/.test(s)) r.patch.liner = 'White liner';
  else if(/unlined|no liner|sin forro|sans doublure|pas de doublure/.test(s)) r.patch.liner = 'Unlined';
  if(/back rod|varillas traseras|baguettes arriere/.test(s)) r.patch.fold = 'Back rods';
  else if(/front rod|varillas frontales|baguettes avant/.test(s)) r.patch.fold = 'Front rods';
  else if(/relaxed|relajad|\bdetendu/.test(s)) r.patch.fold = 'Relaxed';
  else if(/hobbled|cascada|plis superposes|en cascade/.test(s)) r.patch.fold = 'Hobbled';
  else if(/\bflat fold|pliegue plano|\bpli plat/.test(s)) r.patch.fold = 'Flat';
  if(/wave|\bonda\b|\bvague\b/.test(s)) r.patch.heading = 'Wave fold';
  else if(/triple/.test(s) && pid === 'drapery') r.patch.heading = 'Triple pinch pleat';
  else if(/(double|doble)/.test(s) && pid === 'drapery') r.patch.heading = 'Double pinch pleat';
  else if(/euro/.test(s)) r.patch.heading = 'Euro pleat';
  else if(/pinch|pinza|pli pince/.test(s)) r.patch.heading = 'Single pinch pleat';
  const sp = s.replace(SIZE_ANY, ' ');                 /* "96 par 90" is a size, not a pair */
  if(/single panel|one panel|un panel|panel sencillo|un (seul )?panneau|panneau simple/.test(sp)) r.patch.panel = 'Single panel';
  else if(/\bpair\b|two panels|\bpar\b|dos paneles|centre split|center split|apertura central|\bpaire\b|deux panneaux|ouverture centrale/.test(sp)) r.patch.panel = 'Pair, centre split';
  if(pid === 'drapery'){
    if(/no track|without (a )?track|sin riel|sans rail|pas de rail/.test(s)) r.patch.trackopt = 'No';
    else if(/with (a )?track|add (a )?track|con riel|avec (un |le )?rail|ajoute[rz]? (un |le )?rail/.test(s)) r.patch.trackopt = 'Yes';
    if(/\b(wall|pared|mur|murale?)\b/.test(s)) r.patch.track = 'Wall';
    else if(/\b(ceiling|techo|plafond)\b/.test(s)) r.patch.track = 'Ceiling';
  }
  let m = s.match(/\b(\d{1,2})\s*(windows|shades|blinds|panels|ventanas|cortinas|unidades|of them|iguales|fenetres|stores|rideaux|identiques)\b/);
  if(m && +m[1] >= 1) r.patch.qty = +m[1];
  if(r.need.child && !r.patch.drive && pid && pid !== 'drapery') r.patch.drive = 'Cordless';

  const a = r.ask;
  a.price = /how much|price|cost|cuanto (cuesta|sale|vale|es)|precio|cuesta|combien(?! de temps)|\bprix\b|\bcout(e|ent|era|erait|s)?\b|tarif/.test(s);
  a.ship = /ship|deliver|how long|lead time|when will|arrive|envio|entrega|cuanto tarda|tiempo|demora|llega|livr|delai|combien de temps|expedi/.test(s);
  a.samples = /sample|swatch|muestra|echantillon/.test(s);
  a.fabrics = /fabrics|show me|colou?rs\b|telas|muestrame|colores|tissus|montre[rz]?.moi|couleurs\b/.test(s) && !a.samples;
  a.guarantee = /guarantee|warranty|return|remake|refund|garantia|devoluc|reembolso|garantie|retourner|rembours/.test(s);
  a.mountdiff = /difference|diferencia/.test(s);
  a.measure = /measure|medir|\bmido\b|medida exacta|mesurer|comment mesur|prendre (les|mes) mesures|prise de mesures/.test(s);
  a.order = /\border\b|buy|checkout|purchase|summary|comprar|pedido|ordenar|resumen|pagar|commander|\bcommande\b|acheter|recapitulatif|payer/.test(s);
  a.about = /who are you|factory|family|where.*made|made in|fabrica|familia|donde.*(hacen|fabrican)|quien eres|qui etes.vous|\busine\b|famil|ou .*fabriqu/.test(s);
  a.trade = /dealer|trade|designer|wholesale|distribuidor|mayorista|profesional|revendeur|grossiste|professionnel|decorat/.test(s);
  a.contact = /human|person|someone|call|phone|email|contact|persona|llamar|telefono|correo|contacto|appeler|telephone|courriel|e-mail|quelqu'un/.test(s);
  a.child = r.need.child || /safe|segur|securi|sans danger/.test(s);
  a.hello = /^(hi|hello|hey|hola|buenas|buenos dias|bonjour|bonsoir|salut|coucou|good (morning|afternoon|evening))\b/.test(s);
  a.thanks = /thank|gracias|perfect|great|genial|perfecto|merci|parfait|\bsuper\b/.test(s);
  a.add = /add (it |them |this |these |all |everything )?(to )?(the |my )?(cart|basket)|add (them )?all\b|put (it|them) in|agrega|anade|anadir|al carrito|au panier|(a|dans) (mon|le|votre) panier/.test(s);
  a.choose = /help me (choose|pick|decide)|which (one|shade|product|fabric) (is|would|should)|what do you recommend|recommend|ayudame a elegir|cual me conviene|recomiend|aide[rz]?.moi a choisir|recommand|conseille[rz]/.test(s);
  a.several = /several|many windows|multiple|whole house|more than one|varias|muchas ventanas|toda la casa|plusieurs|beaucoup de fenetres|toute la maison/.test(s);
  a.share = /send (it |this )?to my|share (it|this)|\bshare\b|enviar a mi|mandar a mi|compart|envoyer a (mon|ma|mes)|partag/.test(s);
  a.human = /talk to (a|someone|somebody|a real)|real person|speak (to|with)|human being|hablar con|persona real|representative|\bagent\b|un asesor|parler a (quelqu'un|une personne|un conseiller|un humain)|parler avec (quelqu'un|une personne|un conseiller)|vraie personne|un conseiller/.test(s);
  a.yes = /^(yes|yep|yeah|ok|okay|sure|go ahead|do it|please do|si|claro|dale|adelante|de acuerdo|oui|d'accord|bien sur|allez-y|volontiers)(?![a-z])/.test(s.trim());
  a.cart = /\b(cart|basket|checkout|carrito|pagar|panier)\b/.test(s);
  r.rooms = parseRooms(raw);
  return r;
}

/* ── several rooms in one message ──
   "5 rooms: 4, 3, 4, 2, 5", a numbered list ("1. 4 / 2. 3 / …") or named rooms
   ("living room 3, bedroom 2") → [{label, qty}]. Room names are the shop's own. */
export const ROOM_WORDS = [
  ['Living Room', 'living ?room|lounge|family room|sala de estar|sala|salon|sejour'],
  ['Dining Room', 'dining ?room|comedor|salle a manger'],
  ['Kids Room', "kids?'?s? ?(?:\\d{1,2} ?)?(?:bed)?room|children'?s (?:bed)?room|playroom|cuarto de (?:los )?ninos|cuarto infantil|chambre (?:d'|des |d )?enfants?|salle de jeux"],
  ['Bedroom', "bedroom|dormitorio|habitacion|recamara|chambre(?! (?:d'|de |du |des )?(?:bebe|enfants?))(?: a coucher)?"],
  ['Kitchen', 'kitchen|cocina|cuisine'],
  ['Bathroom', "bathroom|bath|bano|salle de bains?|salle d'eau"],
  ['Home Office', 'home office|office|study|oficina|estudio|despacho|bureau'],
  ['Nursery', "nursery|cuarto del bebe|chambre (?:de |du |d')?bebe|nurserie"],
];
/* one piece of a room list — "bedroom 1 has 4", "kids 2 room has 3", "kitchen: 2", "3 in the living room" →
   { label, index, qty, counted }. A number right after the room's name is the room's own number when a count
   follows it ("bedroom 1 has 4" = bedroom no. 1, four windows); on its own it is the count ("bedroom 2" = two windows). */
export function roomClause(c){
  let hit = null;
  ROOM_WORDS.forEach(([label, words]) => {
    const m = new RegExp('\\b(?:' + words + ')\\b').exec(c);
    if(m && (!hit || m.index < hit.at)) hit = { label, at: m.index, text: m[0] };
  });
  if(!hit) return null;
  const q = (v) => Math.max(1, Math.min(50, +v));
  const before = c.slice(0, hit.at), after = c.slice(hit.at + hit.text.length);
  const inside = (hit.text.match(/\d{1,2}/) || [])[0];                                     /* "kids 1 room" */
  const nx = /^\s*#?(\d{1,2})\b/.exec(after), nextPos = nx ? nx[0].length - nx[1].length : -1;   /* "bedroom 1 …" */
  const s1 = /(?:\b(?:has|have|had|with|needs?|gets?|got|tiene|tienen|con|lleva|var|a|ont|avec)\b|[:=×–—-]|\bx)\s*(\d{1,2})\b/.exec(after);
  const s2 = s1 ? null : /\b(\d{1,2})\s*(?:windows?|shades?|blinds?|panels?|curtains?|pcs|pieces|ventanas?|cortinas?|adet|pencere|fenetres?|stores?|rideaux)\b/.exec(after);
  const saidPos = s1 ? s1.index + s1[0].length - s1[1].length : s2 ? s2.index : -1;
  const pre = /\b(\d{1,2})\s*(?:shades?|blinds?|windows?|panels?|cortinas?|ventanas?|pcs|pieces|fenetres?|stores?)?\s*(?:in|for|en|para|dans|pour)\s*(?:the|my|el|la|mi|le|ma|mon)?\s*$/.exec(before);
  let index = inside || null, qty = 1;
  if(s1 || s2){ qty = q((s1 || s2)[1]); if(!index && nx && nextPos !== saidPos) index = nx[1]; }
  else if(pre){ qty = q(pre[1]); if(!index && nx) index = nx[1]; }
  else {
    const nums = after.match(/\b\d{1,2}\b/g) || [];
    if(nx && nums.length >= 2){ if(!index) index = nx[1]; qty = q(nums[1]); }                 /* "bedroom 1 4" */
    else if(nums.length) qty = q(nums[0]);                                                  /* "bedroom 2" */
    else { const b = /\b(\d{1,2})\b[^0-9]*$/.exec(before); if(b) qty = q(b[1]); }            /* "2 for kitchen" said loosely */
  }
  return { label: hit.label, index: index ? +index : null, qty, counted: !!(s1 || s2 || pre) };
}
/* "Bedroom 1", "Bedroom 2": a room keeps the number it was given; two of a kind without one are numbered in order */
export function nameRooms(list){
  const out = list.map(x => Object.assign({}, x, { label: x.label + (x.index ? ' ' + x.index : '') }));
  const count = {}, seen = {};
  out.forEach(x => { count[x.label] = (count[x.label] || 0) + 1; });
  out.forEach(x => { const base = x.label; if(!x.index && count[base] > 1){ seen[base] = (seen[base] || 0) + 1; x.label = base + ' ' + seen[base]; } });
  return out;
}
export const SIZE_ANY = /(\d{1,3}(?:[.,]\d+)?)(?:\s+\d\/\d)?\s*(?:"|in\b|inch(?:es)?\b|pulg(?:adas?)?\b|po\b|pouces?\b)?\s*(?:x|×|by|por|par|sur)\s*(\d{1,3}(?:[.,]\d+)?)(?:\s+\d\/\d)?\s*(?:"|in\b|inch(?:es)?\b|pulg(?:adas?)?\b|po\b|pouces?\b)?/g;
export function parseRooms(raw){
  const s = norm(raw).replace(SIZE_ANY, ' ');          /* a size's numbers are not quantities */
  const q = (v) => Math.max(1, Math.min(50, +v));
  /* a numbered list: "1. 4", "2) 3 pcs", "room 3: 4" — numbers must run 1, 2, 3 … */
  const list = [];
  const reNum = /(?:^|[\n,;])\s*(?:(?:room|window|habitacion|cuarto|ventana|oda|piece|fenetre)\s*)?#?(\d{1,2})\s*[.):=–-]\s*(\d{1,2})\b/g;
  let m;
  while((m = reNum.exec(s))) list.push([+m[1], q(m[2])]);
  if(list.length >= 2 && list.every((x, i) => x[0] === i + 1)) return list.map(x => ({ label: 'Room ' + x[0], qty: x[1] }));
  /* "5 rooms: 4, 3, 4, 2, 5" */
  m = s.match(/(\d{1,2})\s*(?:rooms|windows|habitaciones|cuartos|ventanas|odam?|pieces|fenetres|chambres)\b[^0-9]{0,40}((?:\d{1,2}\s*(?:,|and|y|et|\s)\s*)+\d{1,2})\b/);
  if(m){
    const nums = m[2].match(/\d{1,2}/g).map(q);
    if(nums.length >= 2 && nums.length === +m[1]) return nums.map((n, i) => ({ label: 'Room ' + (i + 1), qty: n }));
  }
  /* named rooms: "living room 3, bedroom 2" or "3 in the living room" */
  const named = [];
  ROOM_WORDS.forEach(([label, words]) => {
    const a = s.match(new RegExp('\\b(?:' + words + ')\\b\\s*(?:[:=x×–-]|with|con|avec|needs?)?\\s*(\\d{1,2})\\b'));
    const b = s.match(new RegExp('\\b(\\d{1,2})\\s*(?:shades?|blinds?|windows?|panels?|cortinas?|ventanas?|pcs|pieces|fenetres?|stores?)?\\s*(?:in|for|en|para|dans|pour)\\s*(?:the|my|el|la|mi|le|ma|mon)?\\s*(?:' + words + ')\\b'));
    const hit = a || b;
    if(hit) named.push({ label, qty: q(hit[1]), at: hit.index });
  });
  if(named.length >= 2) return named.sort((x, y) => x.at - y.at).map(x => ({ label: x.label, qty: x.qty }));
  return null;
}
/* which room of a list a message is about: "room 3", "the third one", "the kitchen" → index, or -1 */
export function roomTarget(raw, rooms){
  if(!rooms || !rooms.length) return -1;
  const s = norm(raw);
  /* a room called by its name, with its number where it has one: "bedroom 2", "kids 1 room", "the kitchen" */
  const said = [];
  ROOM_WORDS.forEach(([label, words]) => {
    const k = new RegExp('\\b(?:' + words + ')\\b(?:\\s*#?(\\d{1,2})\\b)?').exec(s);
    if(k) said.push({ label, at: k.index, n: (k[0].match(/\d{1,2}/) || [])[0] });
  });
  said.sort((x, y) => x.at - y.at);
  for(const x of said){
    let i = x.n ? rooms.findIndex(r => r.label === x.label + ' ' + (+x.n)) : -1;
    if(i === -1) i = rooms.findIndex(r => r.label === x.label);
    if(i === -1 && !x.n) i = rooms.findIndex(r => r.label.indexOf(x.label + ' ') === 0);
    if(i !== -1) return i;
  }
  let m = s.match(/\b(?:room|window|habitacion|cuarto|ventana|piece|fenetre)\s*#?(\d{1,2})\b(?!\s*[.):=–-]\s*\d)/);
  if(m && +m[1] >= 1 && +m[1] <= rooms.length) return +m[1] - 1;
  const ord = [['first', 'primer', 'premiere? (?:piece|fenetre|chambre)'], ['second', 'segund', 'deuxieme'], ['third', 'tercer', 'troisieme'], ['fourth', 'cuart[ao] (?:habitacion|cuarto|ventana)', 'quatrieme'], ['fifth', 'quint', 'cinquieme']];
  for(let i = 0; i < ord.length && i < rooms.length; i++) if(new RegExp('\\b(?:' + ord[i].join('|') + ')').test(s)) return i;
  return -1;
}

/* ── answers both pages give in the same words (facts from the site: shipping,
   returns & remakes, about) ── */
export const ANSWERS = {
  en: {
    noBlackout: 'Pleated shades only come light-filtering. For real darkness I’d switch to a blackout cellular shade — just say the word.',
    ship: v => `Every piece is made to order — ${v} — and then ships free, tracked, anywhere in the US.`,
    shipC: '5 business days for cellular shades', shipO: '10 to 15 business days for this product', shipAll: '5 business days for cellular shades, 10 to 15 for everything else',
    guarantee: 'If we build it wrong — the size, fabric, color or options differ from your order, there is a defect, or it is damaged on the way — we remake it free. Tell us within 30 days of delivery (5 days for damage in transit), with a photo. A slip in your own measurements isn’t covered, but write to us anyway: we can often re-cut or remake it at a reduced price.',
    mountdiff: 'An inside mount sits within the window frame for a clean, built-in look, and needs enough depth in the frame. An outside mount goes on the wall above the window, covers the whole opening and blocks more light at the edges.',
    about: 'LUMIA is a family-run manufacturer — we have been building window treatments in our own plant since 1999. What you order here is cut, sewn, assembled and tested there, then shipped straight to you.',
    contact: 'You can reach the team at lumiashades@gmail.com — they answer within one business day.',
    child: 'With young children I’d go cordless or motorized — neither has a cord anyone can reach.',
    refused: 'I can’t help with that one, but I’m glad to keep working on your window.',
    down: 'I’m having trouble reaching the workshop right now — let’s carry on, and I’ll answer what I can.',
  },
  es: {
    noBlackout: 'Las plisadas solo vienen en tela que filtra la luz. Para oscuridad de verdad cambiaría a una celular blackout; solo dímelo.',
    ship: v => `Cada pieza se fabrica sobre pedido (${v}) y después se envía gratis, con rastreo, a cualquier parte de EE. UU.`,
    shipC: '5 días hábiles para las celulares', shipO: 'de 10 a 15 días hábiles para este producto', shipAll: '5 días hábiles para las celulares, de 10 a 15 para todo lo demás',
    guarantee: 'Si la fabricamos mal (la medida, la tela, el color o las opciones no coinciden con tu pedido, hay un defecto o llega dañada), la rehacemos sin costo. Avísanos dentro de los 30 días de la entrega (5 días si el daño fue en el envío), con una foto. Un error en tus propias medidas no está cubierto, pero escríbenos igual: muchas veces podemos recortarla o rehacerla a precio reducido.',
    mountdiff: 'El montaje interior queda dentro del marco, con un aspecto limpio e integrado, y necesita suficiente profundidad. El exterior va sobre la pared, arriba de la ventana: cubre todo el vano y bloquea más luz en los bordes.',
    about: 'LUMIA es un fabricante familiar: hacemos cortinas en nuestra propia planta desde 1999. Lo que pides aquí se corta, se cose, se arma y se prueba ahí, y se envía directo a ti.',
    contact: 'Puedes escribir al equipo a lumiashades@gmail.com; responden en un día hábil.',
    child: 'Con niños pequeños yo iría por sin cordón o motorizada: ninguna tiene un cordón al alcance.',
    refused: 'Con eso no puedo ayudarte, pero con gusto seguimos con tu ventana.',
    down: 'Ahora mismo no logro comunicarme con el taller; sigamos y te respondo lo que pueda.',
  },
  fr: {
    noBlackout: 'Les stores plissés n’existent qu’en tissu tamisant. Pour une vraie obscurité, je passerais à un store alvéolaire occultant : il suffit de me le dire.',
    ship: v => `Chaque pièce est fabriquée sur commande (${v}), puis expédiée gratuitement, avec suivi, partout aux États-Unis.`,
    shipC: '5 jours ouvrables pour les stores alvéolaires', shipO: '10 à 15 jours ouvrables pour ce produit', shipAll: '5 jours ouvrables pour les stores alvéolaires, 10 à 15 pour tout le reste',
    guarantee: 'Si nous nous trompons à la fabrication (les dimensions, le tissu, la couleur ou les options ne correspondent pas à votre commande, il y a un défaut, ou le colis arrive abîmé), nous le refaisons gratuitement. Prévenez-nous dans les 30 jours suivant la livraison (5 jours pour un dommage de transport), avec une photo. Une erreur dans vos propres mesures n’est pas couverte, mais écrivez-nous quand même : nous pouvons souvent le recouper ou le refaire à prix réduit.',
    mountdiff: 'La pose intérieure se loge dans le cadre de la fenêtre, pour un rendu net et intégré, et demande une profondeur suffisante. La pose extérieure se fixe au mur au-dessus de la fenêtre : elle couvre toute l’ouverture et bloque davantage la lumière sur les bords.',
    about: 'LUMIA est un fabricant familial : nous fabriquons des habillages de fenêtres dans notre propre usine depuis 1999. Ce que vous commandez ici y est coupé, cousu, assemblé et testé, puis vous est expédié directement.',
    contact: 'Vous pouvez écrire à l’équipe à lumiashades@gmail.com. Elle répond sous un jour ouvrable.',
    child: 'Avec de jeunes enfants, je choisirais sans cordon ou motorisé : aucun des deux n’a de cordon à portée de main.',
    refused: 'Je ne peux pas vous aider sur ce point, mais je continue volontiers avec votre fenêtre.',
    down: 'J’ai du mal à joindre l’atelier pour le moment. Continuons, je répondrai à ce que je peux.',
  },
};
