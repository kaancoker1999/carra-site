/* LUMIA design chat (PREVIEW) — shared logic.
   Used by the page (assets/design-chat.js) and by the local preview server
   (tools/design_chat_server.mjs), so both price and validate a design the
   same way.

   · catalogue  = assets/shop-config.json — the data the shop itself runs on
   · prices     = the retail price table, in the shop's own shape
                  ({products:[{id, grids:[{name, cols, rows:[{label, vals}]}], extras}]})
   Nothing here talks to the network or the DOM. */

export const PRODUCT_IDS = ['roman', 'cellular', 'pleated', 'drapery'];
export const PRODUCT_PAGE = { roman: 'roman.html', cellular: 'cellular.html', pleated: 'pleated.html', drapery: 'drapery.html' };

/* pleated colours carry no swatch photo in the shop — these hex values are the
   ones the product page itself uses (tools/gen_pages.py) */
export const PLEATED_HEX = { 'White': '#FAFAF7', 'Pearl': '#F1EDE4', 'Linen': '#E6DCC8', 'Mist grey': '#C9CBC9', 'Graphite': '#5A5E62' };

/* ── catalogue ───────────────────────────────────────────── */
export function buildCatalog(cfg){
  const cat = {};
  (cfg.products || []).forEach(p => {
    const steps = {};
    (p.steps || []).forEach(s => { steps[s.key] = s; });
    cat[p.id] = { id: p.id, name: p.name, width: p.width, height: p.height, hLabel: p.hLabel || 'Height',
      sizeRules: p.sizeRules || null, cellClass: p.cellClass || null, img: p.img, steps };
  });
  return cat;
}
function plain(opts){ return (opts || []).map(o => (o && typeof o === 'object') ? (o.n || o.label || o.id) : o); }
export function options(cat, pid, key){
  const s = cat[pid] && cat[pid].steps[key];
  return s ? plain(s.options).filter(o => o && o.charAt(0) !== '—') : [];
}
export function collections(cat, pid){
  const s = cat[pid] && cat[pid].steps.collection;
  return s ? s.options.map(o => ({ id: o.id, label: o.label, group: o.group || null,
    meta: (s.meta && s.meta[o.id]) || null, count: (s.colours[o.id] || []).length })) : [];
}
export function colours(cat, pid, collection){
  const s = cat[pid] && cat[pid].steps.collection;
  if(!s) return pid === 'pleated' ? Object.keys(PLEATED_HEX) : [];
  return (s.colours[collection] || []).slice();
}
export function swatch(cat, pid, collection, code){
  if(pid === 'pleated') return { name: code, hex: PLEATED_HEX[code] || '#EEE', img: null, lg: null };
  const s = cat[pid] && cat[pid].steps.collection;
  const sw = s && s.swatches && s.swatches[collection] && s.swatches[collection][code];
  return sw ? { name: sw.name || code, img: sw.img, lg: sw.lg || sw.img, hex: null } : { name: code, img: null, lg: null, hex: null };
}
export function collectionOf(cat, pid, id){
  return collections(cat, pid).filter(c => c.id === id)[0] || null;
}
/* how much light a fabric lets through, 0 (blackout) … 1 (sheer) — drives the 3D glow */
export function translucency(cat, d){
  if(!d || !d.product) return .5;
  if(d.liner === 'Blackout liner') return .04;
  let t = '';
  if(d.product === 'pleated') t = 'light-filtering';
  else {
    const c = collectionOf(cat, d.product, d.collection);
    t = ((c && c.meta && c.meta.transparency) || (c && c.label) || '').toLowerCase();
  }
  let v = .5;
  if(/blackout/.test(t)) v = .04;
  else if(/darkening/.test(t)) v = .14;
  else if(/sheer/.test(t)) v = .86;
  else if(/semi/.test(t)) v = .64;
  else if(/linen/.test(t)) v = .56;
  else if(/light/.test(t)) v = .46;
  if(d.liner === 'White liner') v *= .55;
  return v;
}

/* ── a design ────────────────────────────────────────────── */
export function defaultDesign(cat, pid){
  const first = (c) => colours(cat, pid, c)[0] || null;
  const d = { product: pid, qty: 1, sized: false };
  if(pid === 'roman') Object.assign(d, { mount: 'Inside', collection: 'outlander', colour: first('outlander'),
    fold: 'Back rods', drive: 'Cordless', tdbu: 'No', liner: 'Unlined', banding: 'None', w: 36, h: 60 });
  else if(pid === 'cellular') Object.assign(d, { mount: 'Inside', collection: 'BH', colour: first('BH'),
    drive: 'Cordless', tdbu: 'No', w: 36, h: 60 });
  else if(pid === 'pleated') Object.assign(d, { mount: 'Inside', fabric: 'Plain', colour: 'White',
    drive: 'Cordless', tdbu: 'No', w: 36, h: 60 });
  else if(pid === 'drapery') Object.assign(d, { collection: 'outlander', colour: first('outlander'),
    heading: 'Wave fold', panel: 'Pair, centre split', liner: 'Unlined', trackopt: 'Yes', track: 'Wall', w: 72, h: 84 });
  return d;
}

function rule(p, d, drive, tdbu){
  if(!p.sizeRules) return null;
  const cls = p.cellClass ? p.cellClass[d.collection] : null;
  return p.sizeRules.filter(r => r.drive === drive && r.tdbu === tdbu && (!r.cls || r.cls.indexOf(cls) !== -1))[0] || null;
}
/* the size window of the design as configured (mechanism + TDBU decide it) */
export function limits(cat, d){
  const p = cat[d.product];
  const r = d.drive ? rule(p, d, d.drive, d.tdbu || 'No') : null;
  if(r && r.na) return { na: true, w: p.width, h: p.height };
  return r ? { w: r.w, h: r.h } : { w: p.width, h: p.height };
}
/* the widest window any mechanism of this product can cover */
export function outerLimits(cat, pid){
  const p = cat[pid];
  let w = p.width.slice(), h = p.height.slice();
  (p.sizeRules || []).forEach(r => { if(r.na) return;
    w = [Math.min(w[0], r.w[0]), Math.max(w[1], r.w[1])]; h = [Math.min(h[0], r.h[0]), Math.max(h[1], r.h[1])]; });
  return { w, h };
}
function fits(lim, w, h){ return !lim.na && w >= lim.w[0] && w <= lim.w[1] && h >= lim.h[0] && h <= lim.h[1]; }
function eighth(v){ return Math.round(v * 8) / 8; }
function pick(list, v){
  if(v == null) return null;
  const s = String(v).trim().toLowerCase();
  return list.filter(o => o.toLowerCase() === s)[0] || list.filter(o => o.toLowerCase().indexOf(s) === 0)[0] || null;
}
/* "cord loop" is "Continuous cord loop" on Roman shades */
function driveName(cat, pid, v){
  const opts = options(cat, pid, 'drive'); if(!v) return null;
  const s = String(v).toLowerCase();
  if(/motor/.test(s)) return pick(opts, 'Motorized');
  if(/cordless/.test(s)) return pick(opts, 'Cordless');
  if(/cord|loop|chain/.test(s)) return opts.filter(o => /cord loop/i.test(o))[0] || null;
  return pick(opts, v);
}
/* find a colour by code or by name — in the current collection first, then anywhere */
export function findColour(cat, pid, collection, v){
  if(v == null) return null;
  const s = String(v).trim().toLowerCase(); if(!s) return null;
  if(pid === 'pleated'){ const n = pick(Object.keys(PLEATED_HEX), s); return n ? { collection: null, colour: n } : null; }
  const order = [collection].concat(collections(cat, pid).map(c => c.id).filter(id => id !== collection));
  for(const cid of order){
    if(!cid) continue;
    const codes = colours(cat, pid, cid);
    const hit = codes.filter(c => c.toLowerCase() === s)[0] ||
      codes.filter(c => swatch(cat, pid, cid, c).name.toLowerCase() === s)[0] ||
      codes.filter(c => swatch(cat, pid, cid, c).name.toLowerCase().indexOf(s) !== -1)[0];
    if(hit) return { collection: cid, colour: hit };
  }
  return null;
}

/* Apply a set of changes to a design. Returns the new design plus `notes`
   for everything that had to be adjusted, so the advisor can say so. */
export function applyPatch(cat, cur, patch){
  const notes = [];
  patch = patch || {};
  let d = cur ? Object.assign({}, cur) : null;

  if(patch.product && PRODUCT_IDS.indexOf(patch.product) !== -1 && (!d || d.product !== patch.product)){
    const nd = defaultDesign(cat, patch.product);
    if(d){
      if(d.wSet){ nd.w = d.w; nd.wSet = true; }
      if(d.hSet){ nd.h = d.h; nd.hSet = true; }
      nd.sized = !!(nd.wSet && nd.hSet);
      if(d.mount && nd.mount) nd.mount = d.mount;
      /* Roman shades and drapery are cut from the same fabric collections */
      if(d.collection && collectionOf(cat, patch.product, d.collection)){
        nd.collection = d.collection;
        nd.colour = colours(cat, patch.product, d.collection).indexOf(d.colour) !== -1 ? d.colour : colours(cat, patch.product, d.collection)[0];
      }
      if(d.liner && nd.liner) nd.liner = d.liner;
      nd.qty = d.qty || 1;
    }
    d = nd;
  }
  if(!d) return { design: null, notes };
  const pid = d.product, p = cat[pid], before = Object.assign({}, d);

  if(patch.collection != null && p.steps.collection){
    const all = collections(cat, pid);
    const s = String(patch.collection).toLowerCase();
    const c = all.filter(x => x.id.toLowerCase() === s)[0] || all.filter(x => x.label.toLowerCase() === s)[0] ||
      all.filter(x => x.label.toLowerCase().indexOf(s) !== -1)[0];
    if(c){ if(c.id !== d.collection){ d.collection = c.id; d.colour = colours(cat, pid, c.id)[0]; } }
    else notes.push({ code: 'unknown', what: 'collection', value: patch.collection });
  }
  if(patch.colour != null){
    const hit = findColour(cat, pid, d.collection, patch.colour);
    if(hit){ if(hit.collection) d.collection = hit.collection; d.colour = hit.colour; }
    else notes.push({ code: 'unknown', what: 'colour', value: patch.colour });
  }
  ['mount', 'fold', 'liner', 'heading', 'panel', 'trackopt', 'track', 'banding', 'fabric', 'tdbu', 'chain'].forEach(k => {
    if(patch[k] == null || !p.steps[k]) return;
    const v = pick(options(cat, pid, k), patch[k]);
    if(v) d[k] = v; else notes.push({ code: 'unknown', what: k, value: patch[k] });
  });
  if(patch.drive != null && p.steps.drive){
    const v = driveName(cat, pid, patch.drive);
    if(v) d.drive = v; else notes.push({ code: 'unknown', what: 'drive', value: patch.drive });
  }
  if(patch.qty != null){ const q = Math.round(+patch.qty); if(q >= 1) d.qty = Math.min(q, 20); }

  /* `sized` = the customer has given both measurements (until then the size is an example) */
  let sizeTouched = false;
  ['w', 'h'].forEach(k => {
    if(patch[k] == null) return;
    const v = eighth(+patch[k]); if(!(v > 0)) return;
    d[k] = v; d[k + 'Set'] = true; sizeTouched = true;
  });
  if(d.wSet && d.hSet) d.sized = true;

  /* Roman: a relaxed fold cannot be motorized, a flat fold is not made cordless */
  const drv = p.steps.drive;
  if(drv && drv.exclude){
    drv.exclude.forEach(x => {
      const vals = [].concat(x.value);
      if(vals.indexOf(d[x.key]) === -1 || x.options.indexOf(d.drive) === -1) return;
      const from = d.drive;
      if(patch.drive != null && patch[x.key] == null){ d.drive = before.drive; }      /* asked for the mechanism: keep the fold, refuse */
      else { d.drive = options(cat, pid, 'drive').filter(o => x.options.indexOf(o) === -1)[0]; }
      notes.push({ code: 'excluded', key: x.key, value: d[x.key], drive: from, now: d.drive });
    });
  }

  /* size against what the mechanism can be built in */
  if(p.steps.drive){
    let lim = limits(cat, d);
    if(lim.na){
      notes.push({ code: 'tdbu_na' });
      d.tdbu = 'No'; lim = limits(cat, d);
    }
    if(!fits(lim, d.w, d.h)){
      const mechChanged = (d.drive !== before.drive || d.tdbu !== before.tdbu) && !sizeTouched;
      if(mechChanged){
        notes.push({ code: 'mech_size', drive: d.drive, tdbu: d.tdbu, w: lim.w, h: lim.h });
        d.drive = before.drive; d.tdbu = before.tdbu;
      } else {
        /* the size changed: keep it if another mechanism can be built that large */
        const builds = (o, tdbu) => {
          const r = rule(p, d, o, tdbu);
          return r ? (!r.na && fits(r, d.w, d.h)) : fits({ w: p.width, h: p.height }, d.w, d.h);
        };
        const drives = options(cat, pid, 'drive');
        let alt = drives.filter(o => builds(o, d.tdbu || 'No'))[0];
        if(!alt){
          /* nothing builds it: bring the size into the widest window first */
          const o = outerLimits(cat, pid);
          notes.push({ code: 'size_clamped', asked: [d.w, d.h], w: o.w, h: o.h });
          d.w = Math.min(Math.max(d.w, o.w[0]), o.w[1]); d.h = Math.min(Math.max(d.h, o.h[0]), o.h[1]);
          alt = drives.filter(x => builds(x, d.tdbu || 'No'))[0];
          if(!alt && d.tdbu === 'Yes'){ d.tdbu = 'No'; notes.push({ code: 'tdbu_size' }); alt = drives.filter(x => builds(x, 'No'))[0]; }
        }
        if(alt && alt !== d.drive){
          notes.push({ code: 'mech_switched', from: d.drive, to: alt, w: lim.w, h: lim.h });
          d.drive = alt;
        }
      }
    }
  } else {
    const o = { w: p.width, h: p.height };
    if(!fits(o, d.w, d.h)){
      notes.push({ code: 'size_clamped', asked: [d.w, d.h], w: o.w, h: o.h });
      d.w = Math.min(Math.max(d.w, o.w[0]), o.w[1]); d.h = Math.min(Math.max(d.h, o.h[0]), o.h[1]);
    }
  }
  return { design: d, notes };
}

/* ── price (a straight port of the shop's own priceLine) ─── */
function gridPrice(g, w, h){
  let ci = -1, ri = -1, i;
  for(i = 0; i < g.cols.length; i++){ if(w <= parseFloat(g.cols[i])){ ci = i; break; } }
  for(i = 0; i < g.rows.length; i++){ if(h <= parseFloat(g.rows[i].label)){ ri = i; break; } }
  if(ci < 0 || ri < 0) return null;
  return g.rows[ri].vals[ci];
}
function priceLine(prices, pid, sel, w, h){
  const pp = (prices.products || []).filter(p => p.id === pid)[0]; if(!pp) return null;
  const xt = (label) => { const e = (pp.extras || []).filter(x => x.label === label)[0]; return (e && e.usd) || 0; };
  const grid = (name) => pp.grids.filter(x => x.name === name)[0] || null;
  let base, add = 0, pct = 0;
  if(pid === 'roman'){
    const g = pp.grids[(sel.group || 1) - 1] || pp.grids[0];
    base = gridPrice(g, w, h); if(base == null) return null;
    pct += ({ 'Flat': 0, 'Back rods': 0, 'Front rods': 10, 'Relaxed': 10, 'Hobbled': 25 })[sel.fold] || 0;
    pct += ({ 'White liner': 10, 'Blackout liner': 20 })[sel.liner] || 0;
    if(sel.banding && sel.banding !== 'None') pct += 50;
    base = base * (1 + pct / 100);
    if(sel.drive === 'Continuous cord loop'){ add += xt('Continuous cord loop (CCL)'); if(sel.tdbu === 'Yes') add += xt('CCL TDBU'); }
    else if(sel.drive === 'Motorized') add += sel.tdbu === 'Yes' ? xt('Motor + TDBU') : xt('Motorization');
    else if(sel.tdbu === 'Yes') add += xt('Cordless TDBU');
    return Math.round((base + add) * 100) / 100;
  }
  if(pid === 'cellular'){
    const g = grid(sel.gridName); if(!g) return null;
    base = gridPrice(g, w, h); if(base == null) return null;
    if(sel.drive === 'Cord loop') add += sel.tdbu === 'Yes' ? xt('CCL + TDBU') : xt('Continuous cord loop (CCL)');
    else if(sel.drive === 'Motorized') add += sel.tdbu === 'Yes' ? xt('Motor + TDBU') : xt('Motorization');
    else if(sel.tdbu === 'Yes') add += xt('Cordless TDBU');
    return Math.round((base + add) * 100) / 100;
  }
  if(pid === 'pleated'){
    const g = grid(sel.fabric === 'Crashed' ? 'Chart B · Crushed' : 'Chart A · Smooth'); if(!g) return null;
    base = gridPrice(g, w, h); if(base == null) return null;
    if(sel.drive === 'Cord loop') add += xt('Continuous cord loop (CCL)');
    if(sel.drive === 'Motorized') add += sel.tdbu === 'Yes' ? xt('Motor + TDBU') : xt('Motorization');
    else if(sel.tdbu === 'Yes') add += xt('Cordless TDBU');
    return Math.round((base + add) * 100) / 100;
  }
  if(pid === 'drapery'){
    const g = grid(sel.heading + ' · Group ' + 'ABCD'[(sel.group || 1) - 1]); if(!g) return null;
    const panels = sel.panel === 'Pair, centre split' ? 2 : 1, pw = w / panels;
    base = gridPrice(g, pw, h); if(base == null) return null;
    base *= panels;
    const lname = sel.liner === 'White liner' ? 'Liner · White' : sel.liner === 'Blackout liner' ? 'Liner · Blackout' : null;
    if(lname){ const lg = grid(lname), lp = lg ? gridPrice(lg, pw, h) : null; if(lp == null) return null; base += lp * panels; }
    if(sel.trackopt === 'Yes'){
      const hg = grid('Hardware · Rod & Track'), tr = hg ? hg.rows.filter(r => r.label === 'Track')[0] : null;
      if(tr){ let ti = -1; for(let k = 0; k < hg.cols.length; k++){ if(w <= parseFloat(hg.cols[k])){ ti = k; break; } } if(ti >= 0) base += tr.vals[ti]; }
    }
    return Math.round(base * 100) / 100;
  }
  return null;
}
/* {unit, total} in USD for the design, or null when the table has no cell for it */
export function priceOf(cat, prices, d){
  if(!d || !prices || !prices.products) return null;
  const c = d.collection ? collectionOf(cat, d.product, d.collection) : null;
  const sel = { group: c && c.group, gridName: c && c.label, fold: d.fold, liner: d.liner, banding: d.banding,
    drive: d.drive, tdbu: d.tdbu, fabric: d.fabric, heading: d.heading, panel: d.panel, trackopt: d.trackopt };
  const unit = priceLine(prices, d.product, sel, d.w, d.h);
  if(unit == null) return null;
  return { unit, total: Math.round(unit * (d.qty || 1) * 100) / 100 };
}

/* ── words ───────────────────────────────────────────────── */
/* whole inches + eighths, the way the site writes sizes: 22 3/4″ */
export function fmtIn(v){
  const FR = { 1: '1/8', 2: '1/4', 3: '3/8', 4: '1/2', 5: '5/8', 6: '3/4', 7: '7/8' };
  let n = Math.floor(v), f = Math.round((v - n) * 8);
  if(f === 8){ n += 1; f = 0; }
  return n + (f ? ' ' + FR[f] : '') + '″';
}
export function money(v){ return '$' + (+v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function colourName(cat, d){
  if(!d) return '';
  return d.product === 'pleated' ? d.colour : swatch(cat, d.product, d.collection, d.colour).name;
}
/* the configuration as rows of [key, value] — keys are translated by the page */
export function specRows(cat, d){
  if(!d) return [];
  const rows = [['product', cat[d.product].name]];
  const c = d.collection ? collectionOf(cat, d.product, d.collection) : null;
  if(d.product === 'pleated'){ rows.push(['fabric', d.fabric + ' pleat']); rows.push(['colour', d.colour]); }
  else {
    rows.push([d.product === 'cellular' ? 'cell' : 'fabric', c ? c.label : d.collection]);
    rows.push(['colour', colourName(cat, d) + (d.product === 'cellular' ? '' : ' · ' + d.colour)]);
  }
  rows.push(['size', fmtIn(d.w) + ' × ' + fmtIn(d.h)]);
  if(d.mount) rows.push(['mount', d.mount]);
  if(d.fold) rows.push(['fold', d.fold]);
  if(d.heading) rows.push(['heading', d.heading]);
  if(d.panel) rows.push(['panel', d.panel]);
  if(d.drive) rows.push(['drive', d.drive]);
  if(d.tdbu === 'Yes') rows.push(['tdbu', 'Yes']);
  if(d.liner && d.liner !== 'Unlined') rows.push(['liner', d.liner]);
  if(d.banding && d.banding !== 'None') rows.push(['banding', d.banding]);
  if(d.trackopt) rows.push(['track', d.trackopt === 'Yes' ? 'Included' + (d.track ? ' · ' + d.track + ' mount' : '') : 'Not included']);
  return rows;
}

/* The catalogue as plain text, for the advisor's instructions (server side). */
export function catalogBrief(cat){
  const out = [];
  PRODUCT_IDS.forEach(pid => {
    const p = cat[pid]; if(!p) return;
    const o = outerLimits(cat, pid);
    out.push('## ' + p.name + ' (product id: ' + pid + ')');
    out.push('Size: width ' + o.w[0] + '-' + o.w[1] + ' in, ' + p.hLabel.toLowerCase() + ' ' + o.h[0] + '-' + o.h[1] + ' in.');
    if(p.steps.collection){
      out.push((pid === 'cellular' ? 'Cell types' : 'Fabric collections') + ':');
      collections(cat, pid).forEach(c => {
        out.push('- ' + c.id + ' = ' + c.label + (c.group ? ' (price group ' + c.group + ')' : '') +
          (c.meta ? ', ' + c.meta.transparency + ', ' + c.meta.material : '') + ', ' + c.count + ' colours');
      });
    }
    if(pid === 'pleated') out.push('Fabric: Plain or Crashed pleat. Colours: ' + Object.keys(PLEATED_HEX).join(', ') + '. Light-filtering only.');
    ['mount', 'fold', 'heading', 'panel', 'drive', 'tdbu', 'liner', 'banding', 'trackopt'].forEach(k => {
      if(p.steps[k]) out.push(p.steps[k].label + ' (' + k + '): ' + options(cat, pid, k).join(' / '));
    });
    if(p.sizeRules) out.push('Mechanism size limits: ' + p.sizeRules.map(r => r.drive + (r.tdbu === 'Yes' ? ' + TDBU' : '') +
      (r.cls ? ' [' + r.cls.join(',') + ']' : '') + (r.na ? ' not offered' : ' W ' + r.w.join('-') + ' H ' + r.h.join('-'))).join('; ') + '.');
    out.push('');
  });
  return out.join('\n');
}
