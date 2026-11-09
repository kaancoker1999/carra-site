/* LUMIA shopkit — the consumer shop embedded in each product page.
   The page declares its product with <body data-shop="roman">; steps,
   pricing, cart, sign-up and checkout all come from assets/shop-config.json
   and the /api/home endpoints. Version-stamped: bump ?v= everywhere. */
(function(){
  /* ── the free no-password account: holds the contact details + prices ── */
  function getAccount(){
    try{ return JSON.parse(localStorage.getItem('lumia_home_acct') || 'null'); }catch(e){ return null; }
  }
  function setAccount(a){
    try{ if(a){ localStorage.setItem('lumia_home_acct', JSON.stringify(a)); } else { localStorage.removeItem('lumia_home_acct'); } }catch(e){}
  }
  try{ localStorage.removeItem('lumia_home'); }catch(e){}   /* the old code-gate session */
  var ACCOUNT = getAccount();
  var signout = document.getElementById('signout');
  signout.hidden = !ACCOUNT;
  var shoplogin = document.getElementById('shoplogin');
  shoplogin.hidden = !!ACCOUNT;
  shoplogin.addEventListener('click', function(){ openRegister(); });

  signout.addEventListener('click', function(){
    setAccount(null); ACCOUNT = null;
    location.hash = '';
    location.reload();
  });

  /* ── sign-up overlay ── */
  var RG_FIELDS = ['name','email','phone','address','city','state','zip'];
  function openRegister(){
    var a = ACCOUNT || {};
    RG_FIELDS.forEach(function(k){
      var el = document.getElementById('rg-' + k);
      if(el && !el.value && a[k]) el.value = a[k];
    });
    document.getElementById('regerr').classList.remove('on');
    document.getElementById('regveil').hidden = false;
    setTimeout(function(){ document.getElementById('rg-name').focus(); }, 50);
  }
  function closeRegister(){ document.getElementById('regveil').hidden = true; }
  document.getElementById('regclose').addEventListener('click', closeRegister);
  document.getElementById('regveil').addEventListener('click', function(e){
    if(e.target === this) closeRegister();
  });
  document.getElementById('regbtn').addEventListener('click', function(){
    var btn = this, err = document.getElementById('regerr');
    err.classList.remove('on');
    var c = {};
    RG_FIELDS.forEach(function(k){ c[k] = (document.getElementById('rg-' + k).value || '').trim(); });
    /* only an identity is needed to see prices — the address can wait for checkout */
    var missing = [];
    if(!c.name) missing.push('your name');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) missing.push('a valid e-mail');
    if(missing.length){
      err.textContent = 'Please fill in ' + missing.join(', ') + '.';
      err.classList.add('on');
      return;
    }
    btn.disabled = true; btn.textContent = 'One moment…';
    fetch('/api/home/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer: c })
    }).then(function(r){ return r.json().then(function(d){ return { ok: r.ok, d: d }; }); })
    .then(function(x){
      btn.disabled = false; btn.innerHTML = 'Show my prices &rarr;';
      if(!x.ok || !x.d.prices) throw new Error((x.d && x.d.error) || 'failed');
      ACCOUNT = Object.assign({}, c, { prices: x.d.prices, at: Date.now() });
      setAccount(ACCOUNT);
      signout.hidden = false;
      shoplogin.hidden = true;
      loadContact();
      closeRegister();
      if(P) renderSteps();
      renderLines();
    }).catch(function(e2){
      btn.disabled = false; btn.innerHTML = 'Show my prices &rarr;';
      err.textContent = String(e2.message || '') === 'The shop is closed right now.'
        ? 'The shop is closed right now — please try again later.'
        : 'Could not create the account — please try again, or write to lumiashades@gmail.com.';
      err.classList.add('on');
    });
  });

  /* ════════ views: home (the four products) / one product's wizard ════════ */
  var SELECT = '— Select —';
  var PID = document.body.getAttribute('data-shop') || 'roman';
  var CFG = null, P = null, SEL = {}, OPEN = {}, SUBOPEN = {}, lines = [], editIdx = null, booted = false;
  var W = 36, H = 48, QTY = 1, ACC = {};
  try{ lines = JSON.parse(sessionStorage.getItem('lumia_home_cart') || '[]'); }catch(e){}
  try{ ACC = JSON.parse(sessionStorage.getItem('lumia_home_acc') || '{}'); }catch(e){}

  var home = document.getElementById('home'), pview = document.getElementById('pview'),
      stepsBox = document.getElementById('steps'), rowerr = document.getElementById('rowerr');

  function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

  function syncSections(){
    var show = !pview.hidden || lines.length > 0;
    document.getElementById('cartsec').hidden = !show;
    document.getElementById('checkout').hidden = !show;
  }

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  function openProduct(pid, fromHash){
    if(!CFG) return;
    P = CFG.products.filter(function(p){ return p.id === pid; })[0];
    if(!P){ closeProduct(); return; }
    SEL = {}; OPEN = { _size: true }; SUBOPEN = {}; QTY = 1; editIdx = null;
    ensureDefaults();
    var lim = sizeLimits();
    W = clamp(36, lim.w[0], lim.w[1]);
    H = clamp(48, lim.h[0], lim.h[1]);
    document.getElementById('pv-img').src = P.img || '';
    document.getElementById('pv-name').textContent = P.name;
    home.hidden = true; pview.hidden = false;
    renderSteps();
    syncSections();
    window.scrollTo(0, 0);
  }
  function closeProduct(){
    pview.hidden = true; home.hidden = false;
    P = null;
    syncSections();
    window.scrollTo(0, 0);
  }
  function applyHash(){
    /* each page is one product — its configurator is always open */
    openProduct(PID, true);
  }

  document.getElementById('prods').addEventListener('click', function(e){
    var card = e.target.closest('.pt'); if(!card || !CFG) return;
    openProduct(card.dataset.pid);
  });
  document.getElementById('backbtn').addEventListener('click', function(){ closeProduct(); });

  /* ════════ engine: visibility, defaults, pricing (unchanged rules) ════════ */
  function clearFail(){ rowerr.classList.remove('on'); }
  function fail(message){ rowerr.textContent = message; rowerr.classList.add('on'); }

  function stepByKey(k){ return (P.steps || []).filter(function(s){ return s.key === k; })[0]; }
  function stepVisible(st){
    if(!st || !st.showIf) return true;
    var dep = stepByKey(st.showIf.key);
    if(dep && !stepVisible(dep)) return false;
    return [].concat(st.showIf.value).indexOf(SEL[st.showIf.key]) !== -1;
  }
  function disabledOf(st){
    var m = {};
    /* exclude is one rule or a list of rules */
    [].concat(st.exclude || []).forEach(function(ex){
      if([].concat(ex.value).indexOf(SEL[ex.key]) !== -1){
        ex.options.forEach(function(o){ m[o] = ex.key; });
      }
    });
    return m;
  }
  function collectionOpts(st){
    var m = (SEL.cgroup || '').match(/(\d)/), g = m ? +m[1] : null;
    return st.options.filter(function(o){ return !g || o.group === g; });
  }
  function isChoose(st){ return st.options && st.options[0] === SELECT; }
  function plainOpts(st){ return st.options.filter(function(o){ return o !== SELECT; }); }

  function ensureDefaults(){
    (P.steps || []).forEach(function(st){
      if(st.key === 'collection'){
        var opts = collectionOpts(st);
        if(!opts.length) opts = st.options;
        if(!opts.some(function(o){ return o.id === SEL.collection; })) SEL.collection = opts[0].id;
        var cols = st.colours[SEL.collection] || [];
        if(cols.indexOf(SEL.colour) === -1) SEL.colour = cols[0];
        return;
      }
      if(st.key === 'cgroup'){
        if(st.options.indexOf(SEL.cgroup) === -1) SEL.cgroup = st.options[0];
        return;
      }
      if(isChoose(st)){
        if(plainOpts(st).indexOf(SEL[st.key]) === -1) SEL[st.key] = null;
        return;
      }
      var dis = disabledOf(st);
      var ok = st.options.filter(function(o){ return !dis[o]; });
      if(ok.indexOf(SEL[st.key]) === -1) SEL[st.key] = ok[0];
    });
  }

  function sizeRule(drive, tdbu){
    var cls = P.cellClass ? P.cellClass[SEL.collection] : null;
    return (P.sizeRules || []).filter(function(r){
      return r.drive === drive && r.tdbu === tdbu && (!r.cls || r.cls.indexOf(cls) !== -1);
    })[0] || null;
  }
  function sizeLimits(){
    var r = P.sizeRules ? sizeRule(SEL.drive, SEL.tdbu) : null;
    return (r && !r.na) ? { w: r.w, h: r.h } : { w: P.width, h: P.height };
  }

  function PRICES(){ return (ACCOUNT || {}).prices || {}; }
  function hasPrices(){ return !!(ACCOUNT && ACCOUNT.prices); }
  function prodPrices(id){
    return (PRICES().products || []).filter(function(p){ return p.id === id; })[0] || null;
  }
  function gridPrice(g, w, h){
    var ci = -1, ri = -1, i;
    for(i = 0; i < g.cols.length; i++){ if(w <= parseFloat(g.cols[i])){ ci = i; break; } }
    for(i = 0; i < g.rows.length; i++){ if(h <= parseFloat(g.rows[i].label)){ ri = i; break; } }
    if(ci < 0 || ri < 0) return null;
    return g.rows[ri].vals[ci];
  }
  function xt(pp, label){
    var e = pp.extras.filter(function(x){ return x.label === label; })[0];
    return (e && e.usd) || 0;
  }
  /* accessories (remotes, cable, hub) are priced from any product's extras */
  function xtAny(labels){
    var prods = PRICES().products || [];
    for(var i = 0; i < prods.length; i++){
      var ex = prods[i].extras || [];
      for(var j = 0; j < ex.length; j++){
        if(labels.indexOf(ex[j].label) !== -1 && typeof ex[j].usd === 'number') return ex[j].usd;
      }
    }
    return null;
  }
  function priceLine(pid, sel, w, h){
    var pp, base, add = 0, pct = 0;
    if(pid === 'roman'){
      pp = prodPrices('roman'); if(!pp) return null;
      var grid = pp.grids[(sel.group || 1) - 1] || pp.grids[0];
      base = gridPrice(grid, w, h); if(base == null) return null;
      pct += ({'Flat':0, 'Back rods':0, 'Front rods':10, 'Relaxed':10, 'Hobbled':25})[sel.fold] || 0;
      pct += ({'White liner':10, 'Blackout liner':20})[sel.liner] || 0;
      if(sel.banding && sel.banding !== 'None') pct += 50;
      base = base * (1 + pct / 100);
      if(sel.drive === 'Continuous cord loop'){
        add += xt(pp, 'Continuous cord loop (CCL)');
        if(sel.tdbu === 'Yes') add += xt(pp, 'CCL TDBU');
      } else if(sel.drive === 'Motorized'){
        add += sel.tdbu === 'Yes' ? xt(pp, 'Motor + TDBU') : xt(pp, 'Motorization');
      } else if(sel.tdbu === 'Yes'){
        add += xt(pp, 'Cordless TDBU');
      }
      return Math.round((base + add) * 100) / 100;
    }
    if(pid === 'cellular'){
      pp = prodPrices('cellular'); if(!pp) return null;
      var g = pp.grids.filter(function(x){ return x.name === sel.gridName; })[0];
      if(!g) return null;
      base = gridPrice(g, w, h); if(base == null) return null;
      if(sel.drive === 'Cord loop'){
        add += sel.tdbu === 'Yes' ? xt(pp, 'CCL + TDBU') : xt(pp, 'Continuous cord loop (CCL)');
      } else if(sel.drive === 'Motorized'){
        add += sel.tdbu === 'Yes' ? xt(pp, 'Motor + TDBU') : xt(pp, 'Motorization');
      } else if(sel.tdbu === 'Yes'){
        add += xt(pp, 'Cordless TDBU');
      }
      return Math.round((base + add) * 100) / 100;
    }
    if(pid === 'pleated'){
      pp = prodPrices('pleated'); if(!pp) return null;
      var chart = sel.fabric === 'Crashed' ? 'Chart B · Crushed' : 'Chart A · Smooth';
      var pg = pp.grids.filter(function(x){ return x.name === chart; })[0];
      if(!pg) return null;
      base = gridPrice(pg, w, h); if(base == null) return null;
      if(sel.drive === 'Cord loop') add += xt(pp, 'Continuous cord loop (CCL)');
      if(sel.drive === 'Motorized'){
        add += sel.tdbu === 'Yes' ? xt(pp, 'Motor + TDBU') : xt(pp, 'Motorization');
      } else if(sel.tdbu === 'Yes'){
        add += xt(pp, 'Cordless TDBU');
      }
      return Math.round((base + add) * 100) / 100;
    }
    if(pid === 'drapery'){
      pp = prodPrices('drapery'); if(!pp) return null;
      var dg = pp.grids.filter(function(x){
        return x.name === sel.heading + ' · Group ' + 'ABCD'[(sel.group || 1) - 1];
      })[0];
      if(!dg) return null;
      var panels = sel.panel === 'Pair, centre split' ? 2 : 1;
      var pw = w / panels;
      base = gridPrice(dg, pw, h); if(base == null) return null;
      base *= panels;
      var lname = sel.liner === 'White liner' ? 'Liner · White'
                : sel.liner === 'Blackout liner' ? 'Liner · Blackout' : null;
      if(lname){
        var lg = pp.grids.filter(function(x){ return x.name === lname; })[0];
        var lp = lg ? gridPrice(lg, pw, h) : null;
        if(lp == null) return null;
        base += lp * panels;
      }
      if(sel.trackopt === 'Yes'){
        var hg = pp.grids.filter(function(x){ return x.name === 'Hardware · Rod & Track'; })[0];
        var tr = hg ? hg.rows.filter(function(r){ return r.label === 'Track'; })[0] : null;
        if(tr){
          var ti = -1;
          for(var k = 0; k < hg.cols.length; k++){ if(w <= parseFloat(hg.cols[k])){ ti = k; break; } }
          if(ti >= 0) base += tr.vals[ti];
        }
      }
      return Math.round(base * 100) / 100;
    }
    return null;
  }

  function pricingSel(){
    var sel = {};
    (P.steps || []).forEach(function(st){
      if(!stepVisible(st)) return;
      if(st.key === 'collection'){
        var chosen = st.options.filter(function(o){ return o.id === SEL.collection; })[0] || {};
        sel.gridName = chosen.label;
        sel.group = chosen.group;
        return;
      }
      if(st.key === 'cgroup' || st.key === 'colour') return;
      sel[st.key] = SEL[st.key];
    });
    return sel;
  }
  function currentPrice(){ return priceLine(P.id, pricingSel(), W, H); }

  /* ════════ the configurator: collapsible steps ════════ */
  function icon(paths){
    return '<svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }
  var ICONS = {
    'Living Room': icon('<path d="M6 16v-5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v5"/><rect x="3" y="16" width="26" height="7" rx="2"/><path d="M7 23v2.5M25 23v2.5"/>'),
    'Bedroom': icon('<path d="M4 9v16"/><path d="M4 19h24v6"/><path d="M28 19v-5a3 3 0 0 0-3-3H12v8"/><circle cx="8" cy="14.5" r="2"/>'),
    'Kitchen': icon('<path d="M7 13h18v6a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7z"/><path d="M4 13h24"/><path d="M13 9h6"/>'),
    'Dining Room': icon('<circle cx="19" cy="18" r="8"/><circle cx="19" cy="18" r="3.5"/><path d="M6 8v7M9 8v7M7.5 15v9"/>'),
    'Bathroom': icon('<path d="M4 17h24v2a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7z"/><path d="M6 17V9a3 3 0 0 1 5.5-1.6"/><path d="M9 26l-1.5 3M23 26l1.5 3"/>'),
    'Home Office': icon('<rect x="5" y="11" width="22" height="13" rx="2"/><path d="M12 11V9a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v2"/><path d="M5 17h22"/>'),
    'Nursery': icon('<path d="M5 8v17M27 8v17"/><path d="M5 12h22M5 22h22"/><path d="M10 12v10M16 12v10M22 12v10"/>'),
    'Other': icon('<path d="M16 9v14M9 16h14"/>')
  };
  var ROOMS = ['Living Room','Bedroom','Kitchen','Dining Room','Bathroom','Home Office','Nursery','Other'];

  /* line-art illustrations for the option steps that have no photos */
  function art(body, vb){
    return '<span class="bcart"><svg viewBox="' + (vb || '0 0 120 90') + '" style="width:82%;height:auto;max-height:100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg></span>';
  }
  var FAB = '#C9A87C';   /* the drawn shade fabric: soft coffee */
  var WIN = '<rect x="18" y="6" width="84" height="78" rx="3"/>';
  var SHADE_TOP = '<rect x="24" y="12" width="72" height="34" fill="' + FAB + '"/><path d="M24 23h72M24 34h72"/><path d="M22 46h76" stroke-width="3"/>';
  /* the mechanism scenes get a richer window: headrail, sill, deeper shade */
  var VB2 = '0 0 160 120';
  var WIN2 = '<rect x="18" y="8" width="124" height="94" rx="4"/><path d="M12 106h136" stroke-width="3"/>';
  var RAIL2 = '<rect x="24" y="14" width="112" height="7" rx="2" fill="currentColor" stroke="none"/>';
  var FAB2 = '<rect x="24" y="21" width="112" height="41" fill="' + FAB + '"/><path d="M24 35h112M24 49h112"/><path d="M22 62h116" stroke-width="3.5"/>';
  var ART_CCL = art(WIN2 + RAIL2 + FAB2 +
    '<path d="M128 24v62a6 6 0 0 0 12 0V24"/>' +
    '<circle cx="128" cy="42" r="1.8" fill="currentColor" stroke="none"/><circle cx="128" cy="58" r="1.8" fill="currentColor" stroke="none"/><circle cx="128" cy="74" r="1.8" fill="currentColor" stroke="none"/>' +
    '<circle cx="140" cy="42" r="1.8" fill="currentColor" stroke="none"/><circle cx="140" cy="58" r="1.8" fill="currentColor" stroke="none"/><circle cx="140" cy="74" r="1.8" fill="currentColor" stroke="none"/>', VB2);
  var OPT_ART = {
    mount: {
      'Inside': art('<rect x="18" y="8" width="124" height="94" rx="4"/><path d="M12 106h136" stroke-width="3"/>' +
        '<rect x="26" y="16" width="108" height="78"/>' +
        '<rect x="30" y="20" width="100" height="6" rx="2" fill="currentColor" stroke="none"/>' +
        '<rect x="30" y="26" width="100" height="32" fill="' + FAB + '"/><path d="M30 38h100M30 48h100"/><path d="M28 58h104" stroke-width="3"/>', VB2),
      'Outside': art('<rect x="34" y="24" width="92" height="78" rx="3"/><path d="M12 106h136" stroke-width="3"/>' +
        '<rect x="22" y="10" width="116" height="7" rx="2" fill="currentColor" stroke="none"/>' +
        '<rect x="22" y="17" width="116" height="40" fill="' + FAB + '"/><path d="M22 31h116M22 44h116"/><path d="M20 57h120" stroke-width="3.5"/>', VB2)
    },
    drive: {
      'Cordless': art(WIN2 + RAIL2 + FAB2 +
        '<rect x="72" y="64" width="16" height="6" rx="3" fill="currentColor" stroke="none"/>' +
        '<path d="M80 76v20" stroke="#8A6220"/><path d="M73 83l7-7 7 7" stroke="#8A6220"/><path d="M73 89l7 7 7-7" stroke="#8A6220"/>', VB2),
      'Continuous cord loop': ART_CCL,
      'Cord loop': ART_CCL,
      'Motorized': art(WIN2 + RAIL2 + FAB2 +
        '<rect x="24" y="14" width="30" height="7" rx="2" fill="#8A6220" stroke="none"/>' +
        '<path d="M60 26c3 3 3 8 0 11" stroke="#8A6220"/><path d="M66 23c5 5 5 12 0 17" stroke="#8A6220"/>' +
        '<rect x="112" y="64" width="24" height="38" rx="8" fill="#fff"/>' +
        '<circle cx="124" cy="76" r="4.5"/>' +
        '<circle cx="119" cy="90" r="1.8" fill="currentColor" stroke="none"/><circle cx="129" cy="90" r="1.8" fill="currentColor" stroke="none"/><circle cx="124" cy="96" r="1.8" fill="currentColor" stroke="none"/>', VB2)
    },
    tdbu: {
      'No': art(WIN + '<rect x="24" y="12" width="72" height="40" fill="' + FAB + '"/><path d="M24 24h72M24 36h72"/><path d="M22 52h76" stroke-width="3"/>'),
      'Yes': art(WIN + '<path d="M22 28h76" stroke-width="3"/><rect x="24" y="28" width="72" height="30" fill="' + FAB + '"/><path d="M24 38h72M24 48h72"/><path d="M22 58h76" stroke-width="3"/><path d="M60 11v11M57 15l3-4 3 4"/><path d="M60 68v11M57 75l3 4 3-4"/>')
    },
    liner: {
      'Unlined': art('<rect x="36" y="12" width="50" height="66" rx="2" fill="' + FAB + '"/><path d="M36 28h50M36 44h50M36 60h50"/>'),
      'White liner': art('<rect x="44" y="8" width="50" height="64" rx="2" fill="#fff"/><rect x="26" y="18" width="50" height="64" rx="2" fill="' + FAB + '"/><path d="M26 34h50M26 50h50M26 66h50"/><circle cx="106" cy="16" r="4.5"/><path d="M106 6v4M106 22v4M96 16h4M112 16h4"/>'),
      'Blackout liner': art('<rect x="44" y="8" width="50" height="64" rx="2" fill="#fff"/><rect x="26" y="18" width="50" height="64" rx="2" fill="' + FAB + '"/><path d="M26 34h50M26 50h50M26 66h50"/><circle cx="106" cy="16" r="4.5"/><path d="M106 6v4M106 22v4M96 16h4M112 16h4"/><path d="M98 24 114 8" stroke-width="2.5"/>')
    }
  };

  function stepList(){
    /* the measurements come first, then the room, then the product's own steps */
    var list = [{ kind: 'size', key: '_size', label: 'Width & height' },
                { kind: 'room', key: '_room', label: 'Room' }];
    (P.steps || []).forEach(function(st){
      if(st.key === 'cgroup') return;          /* it becomes the filter inside the fabric step */
      if(!stepVisible(st)) return;
      if(st.key === 'collection'){
        list.push({ kind: 'fabric', key: 'collection', st: st,
          label: P.id === 'cellular' ? 'Cell & color' : st.label + ' & color' });
      } else {
        list.push({ kind: 'opt', key: st.key, st: st, label: st.label });
      }
    });
    return list;
  }

  function pad2(n){ return n < 10 ? '0' + n : String(n); }
  function chk(){ return '<span class="bchk">&check;</span>'; }

  function roomBody(){
    var cards = ROOMS.map(function(r){
      var on = SEL._room === r;
      return '<button class="roomcard' + (on ? ' on' : '') + '" type="button" data-room="' + esc(r) + '">' +
        (ICONS[r] || '') + '<span class="rname">' + esc(r) + '</span>' + chk() + '</button>';
    }).join('');
    return '<div class="roomgrid">' + cards + '</div>' +
      (SEL._room === 'Other'
        ? '<input id="roomtext" type="text" placeholder="e.g. Guest room — left window" value="' + esc(SEL._roomText || '') + '" autocomplete="off">'
        : '') +
      '<p class="stepnote">Names this window in your cart so you can tell them apart. Optional.</p>';
  }

  /* short captions under specific option cards */
  var OPT_SUB = {
    drive: {
      'Motorized': 'Remote, charging cable and smart hub are picked once at checkout — one remote can run several shades.'
    }
  };

  /* colour steps (edge banding) draw each colour as banding on a folded white shade */
  var OPT_COLORS = {
    banding: { 'Beige':'#E6DCC3', 'Tan':'#B08D4F', 'Red':'#C01F2F', 'Grey':'#63655C',
               'Navy':'#1C2340', 'Moss':'#3C4237', 'Black':'#141414' }
  };

  function optBody(st){
    var dis = disabledOf(st);
    var opts = plainOpts(st);
    var colors = OPT_COLORS[st.key] || null;
    if(colors){
      /* a folded white shade; the band runs down the sides and along the
         bottom only (never across the top). "None" is the plain shade. */
      return '<div class="swgrid2">' + opts.map(function(o){
        var on = SEL[st.key] === o;
        var band = colors[o]
          ? '<path d="M19.5 6v75.5h51V6" stroke="' + colors[o] + '" stroke-width="5" fill="none" stroke-linecap="butt"/>'
          : '';
        return '<button class="swtile' + (on ? ' on' : '') + '" type="button" data-step="' + esc(st.key) + '" data-val="' + esc(o) + '">' +
          '<span class="clrart"><svg viewBox="0 0 90 90" fill="none" stroke="#3A3D40" stroke-width="1.8" stroke-linecap="round">' +
            '<rect x="17" y="6" width="56" height="78" rx="2" fill="#FFFFFF"/>' +
            '<path d="M17 56h56M17 65h56M17 74h56"/>' +
            band +
          '</svg></span>' +
          '<span class="swname">' + esc(o) + '</span>' + chk() + '</button>';
      }).join('') + '</div>';
    }
    var artMap = OPT_ART[st.key] || null;
    var anyVisual = !!st.imgs || !!artMap;
    var cards = opts.map(function(o){
      var on = SEL[st.key] === o;
      var visual = st.imgs && st.imgs[o]
        ? '<img src="' + esc(st.imgs[o]) + '" alt="" loading="lazy">'
        : (artMap && artMap[o]) || '';
      return '<button class="bigcard' + (visual ? '' : ' noimg') + (on ? ' on' : '') +
        '" type="button" data-step="' + esc(st.key) + '" data-val="' + esc(o) + '"' +
        (dis[o] ? ' disabled title="Not with ' + esc(SEL[dis[o]]) + '"' : '') + '>' +
        visual +
        '<span class="bcname">' + esc(o) + '</span>' +
        (OPT_SUB[st.key] && OPT_SUB[st.key][o]
          ? '<span class="bcsub">' + esc(OPT_SUB[st.key][o]) + '</span>' : '') +
        chk() + '</button>';
    }).join('');
    return '<div class="cardgrid' + (anyVisual ? '' : ' txt') + '">' + cards + '</div>';
  }

  function fsecHTML(st, c){
    var meta = st.meta && st.meta[c.id];
    var metaLine = meta ? [meta.transparency, meta.material].filter(Boolean).join(' · ') : '';
    var cols = st.colours[c.id] || [];
    var sw = st.swatches && st.swatches[c.id] || {};
    var tiles = cols.map(function(v){
      var s = sw[v] || {};
      var on = SEL.collection === c.id && SEL.colour === v;
      var img = s.lg || s.img;
      return '<button class="swtile' + (on ? ' on' : '') + '" type="button" data-fab="' + esc(c.id) + '|' + esc(v) + '">' +
        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '') +
        '<span class="swname">' + esc(s.name || v) + '</span>' +
        '<span class="swcode">' + (s.name && s.name !== v ? esc(v) : '&nbsp;') + '</span>' + chk() + '</button>';
    }).join('');
    var dark = /blackout/i.test(c.label) || /blackout/i.test(metaLine);
    return '<div class="fsec"><div class="fsechead' + (dark ? ' dark' : '') + '"><b>' + esc(c.label) + '</b>' +
      (metaLine ? ' &middot; ' + esc(metaLine) : '') + '</div>' +
      '<div class="swgrid2">' + tiles + '</div></div>';
  }
  function cellSizeOf(label){
    return /triple/i.test(label) ? 'Triple Cell' : /double/i.test(label) ? 'Double Cell' : 'Single Cell';
  }
  function fabricBody(st){
    var html = '';
    var cg = stepByKey('cgroup');
    if(cg){
      html += '<div class="filterrow">' + cg.options.map(function(o){
        return '<button class="fbtn' + (SEL.cgroup === o ? ' on' : '') + '" type="button" data-cg="' + esc(o) + '">' + esc(o) + '</button>';
      }).join('') + '</div>';
    }
    if(P.id === 'cellular'){
      /* the cell fabrics fold into Single / Double / Triple sub-sections */
      var order = ['Single Cell', 'Double Cell', 'Triple Cell'];
      var groups = {};
      collectionOpts(st).forEach(function(c){
        var g = cellSizeOf(c.label);
        (groups[g] = groups[g] || []).push(c);
      });
      if(!SUBOPEN._init){
        var chosen = st.options.filter(function(o){ return o.id === SEL.collection; })[0];
        SUBOPEN = { _init: true };
        SUBOPEN[chosen ? cellSizeOf(chosen.label) : 'Single Cell'] = true;
      }
      order.forEach(function(g){
        var list = groups[g];
        if(!list || !list.length) return;
        var open = !!SUBOPEN[g];
        html += '<div class="subacc' + (open ? ' open' : '') + '">' +
          '<button class="subhead" type="button" data-sub="' + esc(g) + '">' +
            '<span class="stitle">' + esc(g) + '</span>' +
            '<span class="scount">' + list.length + (list.length === 1 ? ' style' : ' styles') + '</span>' +
            '<span class="chev">&#9662;</span></button>' +
          '<div class="subbody">' + list.map(function(c){ return fsecHTML(st, c); }).join('') + '</div></div>';
      });
      return html;
    }
    collectionOpts(st).forEach(function(c){ html += fsecHTML(st, c); });
    return html;
  }

  function sizeSel(id, lim, whole){
    var out = '<select id="' + id + '">';
    for(var v = lim[0]; v <= lim[1]; v++){
      out += '<option value="' + v + '"' + (v === whole ? ' selected' : '') + '>' + v + '&Prime;</option>';
    }
    return out + '</select>';
  }
  var FR_OPTS = [[0,'0&Prime;'],[0.125,'1/8&Prime;'],[0.25,'1/4&Prime;'],[0.375,'3/8&Prime;'],[0.5,'1/2&Prime;'],[0.625,'5/8&Prime;'],[0.75,'3/4&Prime;'],[0.875,'7/8&Prime;']];
  function fracSel(id, frac){
    return '<select id="' + id + '">' + FR_OPTS.map(function(f){
      return '<option value="' + f[0] + '"' + (f[0] === frac ? ' selected' : '') + '>' + f[1] + '</option>';
    }).join('') + '</select>';
  }
  function sizeBlock(name, cap, lim, val){
    var whole = Math.floor(val), frac = Math.round((val - whole) * 8) / 8;
    if(frac === 1){ whole += 1; frac = 0; }
    return '<div class="sizeblock"><div class="sizecap">' + esc(cap) + '</div>' +
      '<div class="sizerow">' +
        '<div class="sfield"><label>Inches</label>' + sizeSel(name + '-in', lim, whole) + '</div>' +
        '<div class="sfield"><label>Fraction</label>' + fracSel(name + '-fr', frac) + '</div>' +
      '</div>' +
      '<input class="srange" id="' + name + '-sl" type="range" min="' + lim[0] + '" max="' + lim[1] + '" step="1" value="' + whole + '">' +
      '<div class="steprng">' + lim[0] + '&Prime; &ndash; ' + lim[1] + '&Prime;</div></div>';
  }
  function sizeBody(){
    var lim = sizeLimits();
    W = clamp(W, lim.w[0], lim.w[1]);
    H = clamp(H, lim.h[0], lim.h[1]);
    return sizeBlock('w', 'Width', lim.w, W) +
      sizeBlock('h', P.hLabel || 'Height', lim.h, H) +
      '<p class="stepnote">Measure to the nearest 1/8&Prime;. We make the ' + esc(P.name.toLowerCase()) + ' to this exact size.</p>';
  }

  var FRAC_NAMES = {0:'0/8',1:'1/8',2:'1/4',3:'3/8',4:'1/2',5:'5/8',6:'3/4',7:'7/8'};
  function fmtIn(v){
    var n = Math.floor(v), f = Math.round((v - n) * 8);
    if(f === 8){ n += 1; f = 0; }
    return f ? n + ' ' + FRAC_NAMES[f] : String(n);
  }

  /* what a collapsed step's header says it is set to */
  function curOf(s){
    if(s.kind === 'room'){
      return SEL._room === 'Other' ? (SEL._roomText || 'Other') : (SEL._room || '—');
    }
    if(s.kind === 'fabric'){
      var chosen = s.st.options.filter(function(o){ return o.id === SEL.collection; })[0] || {};
      return (chosen.label || '') + ' · ' + (SEL.colour || '');
    }
    if(s.kind === 'size') return fmtIn(W) + '″ × ' + fmtIn(H) + '″';
    return SEL[s.key] || '';
  }

  function accHTML(s, n, body){
    var open = !!OPEN[s.key];
    var need = s.kind === 'opt' && isChoose(s.st) && !SEL[s.key];
    return '<div class="grp' + (open ? ' open' : '') + '">' +
      '<button class="grphead" type="button" data-acc="' + esc(s.key) + '">' +
        '<span class="code">' + pad2(n) + '</span><span class="gdash"></span>' +
        '<span class="gtitle">' + esc(s.label) + '</span>' +
        '<span class="cur' + (need ? ' need' : '') + '">' + (need ? 'Choose' : esc(curOf(s))) + '</span>' +
        '<span class="chev">&#9662;</span>' +
      '</button><div class="grpbody">' + body + '</div></div>';
  }

  function renderSteps(){
    if(!P) return;
    ensureDefaults();
    var html = '';
    stepList().forEach(function(s, i){
      var body =
        s.kind === 'room'   ? roomBody() :
        s.kind === 'fabric' ? fabricBody(s.st) :
        s.kind === 'size'   ? sizeBody() : optBody(s.st);
      html += accHTML(s, i + 1, body);
    });
    stepsBox.innerHTML = html;
    syncBar();
  }

  function syncBar(){
    var el = document.getElementById('wizprice');
    if(!hasPrices()){
      el.innerHTML = '<button class="lockcta" type="button" id="pricecta">Sign up free to see it</button>';
    } else {
      var price = currentPrice();
      if(price == null){ el.innerHTML = '&mdash;'; }
      else if(QTY > 1){ el.textContent = QTY + ' × $' + price.toFixed(2) + ' = $' + (price * QTY).toFixed(2); }
      else { el.textContent = '$' + price.toFixed(2); }
    }
    document.getElementById('qnum').textContent = QTY;
    document.getElementById('wiznext').innerHTML =
      editIdx == null ? 'Add to cart &rarr;' : 'Update line &rarr;';
  }
  document.getElementById('wizbar').addEventListener('click', function(e){
    if(e.target.closest('#pricecta')) openRegister();
  });

  /* step interactions */
  stepsBox.addEventListener('click', function(e){
    var b;
    if((b = e.target.closest('[data-acc]'))){
      OPEN[b.dataset.acc] = !OPEN[b.dataset.acc];
      renderSteps();
      return;
    }
    if((b = e.target.closest('[data-room]'))){
      clearFail();
      SEL._room = b.dataset.room;
      renderSteps();
      if(SEL._room === 'Other'){ var t = document.getElementById('roomtext'); if(t) t.focus(); }
      return;
    }
    if((b = e.target.closest('[data-sub]'))){
      SUBOPEN[b.dataset.sub] = !SUBOPEN[b.dataset.sub];
      SUBOPEN._init = true;
      renderSteps();
      return;
    }
    if((b = e.target.closest('[data-cg]'))){
      clearFail();
      SEL.cgroup = b.dataset.cg;
      renderSteps();
      return;
    }
    if((b = e.target.closest('[data-fab]'))){
      clearFail();
      var parts = b.dataset.fab.split('|');
      SEL.collection = parts[0]; SEL.colour = parts[1];
      renderSteps();
      return;
    }
    if((b = e.target.closest('[data-step]')) && !b.disabled){
      clearFail();
      SEL[b.dataset.step] = b.dataset.val;
      renderSteps();
      return;
    }
  });
  stepsBox.addEventListener('input', function(e){
    if(e.target.id === 'roomtext'){ SEL._roomText = e.target.value; return; }
    if(e.target.id === 'w-sl'){ W = (+e.target.value) + (W - Math.floor(W)); syncSizeFields('w', W); syncBar(); return; }
    if(e.target.id === 'h-sl'){ H = (+e.target.value) + (H - Math.floor(H)); syncSizeFields('h', H); syncBar(); return; }
  });
  stepsBox.addEventListener('change', function(e){
    if(e.target.id === 'roomtext'){ renderSteps(); return; }
    if(e.target.id === 'w-in' || e.target.id === 'w-fr'){
      W = (+document.getElementById('w-in').value) + (+document.getElementById('w-fr').value);
      renderSteps(); return;
    }
    if(e.target.id === 'h-in' || e.target.id === 'h-fr'){
      H = (+document.getElementById('h-in').value) + (+document.getElementById('h-fr').value);
      renderSteps(); return;
    }
    if(e.target.id === 'w-sl' || e.target.id === 'h-sl'){ renderSteps(); return; }
  });
  function syncSizeFields(name, v){
    var whole = Math.floor(v);
    var sl = document.getElementById(name + '-sl'), si = document.getElementById(name + '-in');
    if(sl) sl.value = String(whole);
    if(si) si.value = String(whole);
  }

  /* the bar: quantity stepper + add to cart */
  document.getElementById('wizbar').addEventListener('click', function(e){
    var q = e.target.closest('[data-q]');
    if(q){ QTY = clamp(QTY + (+q.dataset.q), 1, 50); syncBar(); }
  });
  document.getElementById('wiznext').addEventListener('click', function(){
    clearFail();
    addToCart();
  });

  /* ── add to cart ── */
  function addToCart(){
    /* prices (and so the cart) unlock with the free sign-up */
    if(!hasPrices()){ openRegister(); return; }
    /* every choose-step needs an answer — open the ones still waiting */
    var missing = (P.steps || []).filter(function(st){
      return stepVisible(st) && isChoose(st) && !SEL[st.key];
    });
    if(missing.length){
      missing.forEach(function(st){ OPEN[st.key] = true; });
      renderSteps();
      fail('Choose ' + missing.map(function(st){ return st.label.toLowerCase(); }).join(', ') + ' before adding this line.');
      return;
    }
    var price = currentPrice();
    if(price == null){
      fail('That combination is not available online — write to lumiashades@gmail.com and we will quote it for you.');
      return;
    }
    var parts = [], pairs = [], main = '';
    (P.steps || []).forEach(function(st){
      if(!stepVisible(st)) return;
      if(st.key === 'collection'){
        var chosen = st.options.filter(function(o){ return o.id === SEL.collection; })[0] || {};
        var picked = chosen.label + ' ' + SEL.colour;
        if(!main) main = picked;
        parts.push(st.label + ': ' + picked);
        pairs.push({ k: st.label, v: picked });
        return;
      }
      if(st.key === 'cgroup' || st.key === 'colour') return;
      if(!main && /fabric|cell|style/i.test(st.label)) main = SEL[st.key];
      parts.push(st.label + ': ' + SEL[st.key]);
      pairs.push({ k: st.label, v: SEL[st.key] });
    });
    var label = (SEL._room === 'Other' ? (SEL._roomText || '') : (SEL._room || '')).trim();
    var pick = { product: P.id, sel: JSON.parse(JSON.stringify(SEL)) };
    var line = { label: label, product: P.name, pid: P.id, spec: parts.join(' · '), specs: pairs,
                 desc: (main || '').trim(), pick: pick,
                 w: W, h: H, qty: QTY, price: price };
    if(editIdx == null){
      lines.push(line);
    } else {
      lines[editIdx] = line;
      editIdx = null;
    }
    saveLines(); renderLines();
    var nx = document.getElementById('wiznext');
    nx.innerHTML = 'Added &check;';
    setTimeout(function(){ syncBar(); }, 1400);
    document.getElementById('cartsec').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── cart lines ── */
  var linesBox = document.getElementById('lines'),
      empty = document.getElementById('empty'), count = document.getElementById('count');

  function saveLines(){ try{ sessionStorage.setItem('lumia_home_cart', JSON.stringify(lines)); }catch(e){} }

  function fmt$(v){ return v == null ? '&mdash;' : '$' + v.toFixed(2); }
  function fmtIn8(v){
    var n = Math.floor(v), f = Math.round((v - n) * 8);
    if(f === 8){ n += 1; f = 0; }
    return n + ' ' + FRAC_NAMES[f];
  }

  function orderTotals(ls){
    var units = 0, total = 0;
    ls.forEach(function(l){
      units += l.qty;
      if(l.price != null) total += l.price * l.qty;
    });
    return { units: units, total: Math.round(total * 100) / 100 };
  }
  function specPairs(l){
    if(Array.isArray(l.specs) && l.specs.length) return l.specs;
    return String(l.spec || '').split(' · ').map(function(part){
      var i = part.indexOf(': ');
      return i < 0 ? { k: '', v: part.trim() } : { k: part.slice(0, i).trim(), v: part.slice(i + 2).trim() };
    }).filter(function(p){ return p.v; });
  }
  function tdbuNo(p){ return /^(top-down bottom-up|tdbu)$/i.test(p.k || '') && /^no$/i.test(p.v || ''); }

  /* the chosen colour's swatch makes the line's thumbnail */
  function swatchOf(l){
    try{
      var p = CFG.products.filter(function(x){ return x.id === l.pid; })[0];
      var st = (p.steps || []).filter(function(s){ return s.key === 'collection'; })[0];
      var sel = l.pick && l.pick.sel;
      if(st && sel && st.swatches && st.swatches[sel.collection]){
        var s = st.swatches[sel.collection][sel.colour];
        if(s && s.img) return s.img;
      }
    }catch(e){}
    return 'assets/card-' + l.pid + '.jpg';
  }
  function inTxt(v){ return fmtIn8(v).replace(' 0/8', ''); }

  function cartRow(l, i){
    /* the full configuration, label by label */
    var pairs = specPairs(l).filter(function(p){ return p.k; });
    var kv = pairs.map(function(p){
      return '<div><span>' + esc(p.k) + '</span><b>' + esc(p.v) + '</b></div>';
    }).join('');
    return '<div class="cline' + (i === editIdx ? ' editing' : '') + '">' +
      '<img class="cthumb" src="' + esc(swatchOf(l)) + '" alt="" loading="lazy">' +
      '<div class="cinfo">' +
        '<div class="cname">' + esc(l.product) +
          (l.label ? ' <span class="croom">&mdash; ' + esc(l.label) + '</span>' : '') + '</div>' +
        (kv ? '<div class="ckv">' + kv + '</div>' : '') +
        '<div class="cspec dim2">' +
          (l.w != null ? inTxt(l.w) + '&Prime; &times; ' + inTxt(l.h) + '&Prime; &middot; ' : '') +
          'Qty ' + l.qty + '</div>' +
        '<div class="cacts">' +
          '<button class="clink" type="button" data-i="' + i + '" data-act="edit">Edit</button><span>&middot;</span>' +
          '<button class="clink danger" type="button" data-i="' + i + '" data-act="del">Remove</button></div>' +
      '</div>' +
      '<div class="cprice">' + (l.price == null ? '&mdash;' : '$' + (l.price * l.qty).toFixed(2)) +
        (l.qty > 1 && l.price != null ? '<span class="cunit">$' + l.price.toFixed(2) + ' each</span>' : '') +
      '</div></div>';
  }
  function plural(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); }

  function renderLines(){
    linesBox.hidden = lines.length === 0;
    empty.style.display = lines.length ? 'none' : '';
    linesBox.innerHTML = lines.map(cartRow).join('');
    count.hidden = lines.length === 0;
    var t = orderTotals(lines);
    renderAcc();
    var at = accTotal();
    var grand = Math.round((t.total + at) * 100) / 100;
    count.innerHTML = lines.length
      ? '<div class="csubrow"><span>' + plural(lines.length, 'line') + ' &middot; ' + plural(t.units, 'unit') +
        (at > 0 ? ' &middot; accessories $' + at.toFixed(2) : '') +
        '<span class="cst">Made to measure &middot; reviewed before production</span></span>' +
        '<b>$' + grand.toFixed(2) + '</b></div>'
      : '';
    syncPay();
    syncSections();
  }

  linesBox.addEventListener('click', function(e){
    var b = e.target.closest('.clink'); if(!b) return;
    var i = +b.dataset.i;
    if(b.dataset.act === 'edit'){ editLine(i); return; }
    lines.splice(i, 1);
    if(editIdx != null){
      if(i === editIdx){ editIdx = null; }
      else if(i < editIdx){ editIdx -= 1; }
    }
    saveLines(); renderLines();
  });

  function editLine(i){
    var l = lines[i];
    if(!l) return;
    if(l.pid !== PID){
      /* the line belongs to another product — edit it on that product's page */
      try{ sessionStorage.setItem('lumia_home_edit', String(i)); }catch(e){}
      location.href = l.pid + '.html';
      return;
    }
    openProduct(l.pid);
    if(l.pick && l.pick.sel){ SEL = JSON.parse(JSON.stringify(l.pick.sel)); }
    ensureDefaults();
    if(l.w != null) W = l.w;
    if(l.h != null) H = l.h;
    QTY = l.qty || 1;
    editIdx = i;
    OPEN = {};                 /* all collapsed — the headers summarize the line */
    renderSteps();
    renderLines();
    window.scrollTo(0, 0);
  }

  /* ── motorized accessories: asked once, for the whole order ── */
  var ACCDEFS = [
    { labels: ['Remote control — 1 channel'], name: '1-channel remote', sub: 'All shades together on one channel' },
    { labels: ['Remote control — 5 channel'], name: '5-channel remote', sub: 'Up to 5 shades, each on its own channel' },
    { labels: ['Remote control — 15 channel'], name: '15-channel remote', sub: 'Up to 15 shades, each on its own channel' },
    { labels: ['10 ft USB cable'], name: 'USB-C charging cable', sub: 'For recharging the motors' },
    { labels: ['Smart home hub', 'Motionblinds WiFi hub'], name: 'Smart home hub', sub: 'App control, works with Alexa and Google' }
  ];
  function saveAcc(){ try{ sessionStorage.setItem('lumia_home_acc', JSON.stringify(ACC)); }catch(e){} }
  function motorCount(){
    var n = 0;
    lines.forEach(function(l){
      if(l.pick && l.pick.sel && l.pick.sel.drive === 'Motorized') n += l.qty;
    });
    return n;
  }
  function accTotal(){
    var t = 0;
    ACCDEFS.forEach(function(a){
      var q = ACC[a.name] || 0, p = xtAny(a.labels);
      if(q > 0 && p != null) t += q * p;
    });
    return Math.round(t * 100) / 100;
  }
  function accLines(){
    var out = [];
    ACCDEFS.forEach(function(a){
      var q = ACC[a.name] || 0, p = xtAny(a.labels);
      if(q > 0 && p != null){
        out.push({ label: '', product: 'Accessories', pid: 'accessory', desc: a.name,
          spec: 'Accessory: ' + a.name, specs: [{ k: 'Accessory', v: a.name }],
          w: null, h: null, qty: q, price: p });
      }
    });
    return out;
  }
  function renderAcc(){
    var block = document.getElementById('accblock');
    var n = motorCount();
    if(!n){ ACC = {}; saveAcc(); block.hidden = true; return; }
    block.hidden = false;
    document.getElementById('acchint').textContent =
      'You have ' + n + ' motorized shade' + (n === 1 ? '' : 's') + ' in the cart. ' +
      'One remote can run several shades — pick what you need for the whole order.';
    document.getElementById('accrows').innerHTML = ACCDEFS.map(function(a){
      var p = xtAny(a.labels);
      if(p == null) return '';
      var q = ACC[a.name] || 0;
      return '<div class="accrow">' +
        '<div class="an"><b>' + esc(a.name) + '</b><span>' + esc(a.sub) + '</span></div>' +
        '<span class="ap">$' + p.toFixed(2) + '</span>' +
        '<div class="qtyrow">' +
          '<button class="qbtn" type="button" data-accq="' + esc(a.name) + '|-1">&minus;</button>' +
          '<span class="qnum">' + q + '</span>' +
          '<button class="qbtn" type="button" data-accq="' + esc(a.name) + '|1">+</button></div></div>';
    }).join('');
  }
  document.getElementById('accrows').addEventListener('click', function(e){
    var b = e.target.closest('[data-accq]'); if(!b) return;
    var p = b.dataset.accq.split('|');
    ACC[p[0]] = clamp((ACC[p[0]] || 0) + (+p[1]), 0, 50);
    saveAcc();
    renderLines();
  });

  /* ── checkout ── */
  var paybtn = document.getElementById('paybtn'), savebtn = document.getElementById('savebtn'),
      ckerr = document.getElementById('ckerr');
  function syncPay(){
    var total = Math.round((orderTotals(lines).total + accTotal()) * 100) / 100;
    paybtn.disabled = !lines.length;
    savebtn.disabled = !lines.length;
    paybtn.textContent = lines.length ? 'Pay $' + total.toFixed(2) : 'Pay';
  }
  function ckMsg(text){
    ckerr.textContent = text || '';
    ckerr.classList.toggle('on', !!text);
  }
  var CK_FIELDS = ['name','email','phone','address','city','state','zip'];
  function loadContact(){
    var c = {};
    try{ c = JSON.parse(localStorage.getItem('lumia_home_contact') || '{}'); }catch(e){}
    CK_FIELDS.forEach(function(k){
      var el = document.getElementById('ck-' + k);
      if(!el) return;
      /* the account's details come first; an edited checkout field wins */
      var v = c[k] || (ACCOUNT && ACCOUNT[k]) || '';
      if(v) el.value = v;
    });
  }
  function readContact(){
    var c = {};
    CK_FIELDS.forEach(function(k){
      c[k] = (document.getElementById('ck-' + k).value || '').trim();
    });
    return c;
  }
  /* one submit path: pay right away, or save the order to pay later */
  function submitOrder(paylater){
    ckMsg('');
    if(!lines.length) return;
    var c = readContact();
    var missing = [];
    if(!c.name) missing.push('your name');
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) missing.push('a valid e-mail');
    if(!c.address) missing.push('the street address');
    if(!c.city) missing.push('the city');
    if(!c.state) missing.push('the state');
    if(!c.zip) missing.push('the ZIP code');
    if(missing.length){
      ckMsg('Please fill in ' + missing.join(', ') + ' — we need them to make and ship your order.');
      return;
    }
    try{ localStorage.setItem('lumia_home_contact', JSON.stringify(c)); }catch(e){}
    var notes = (document.getElementById('ck-notes').value || '').trim();
    var btn = paylater ? savebtn : paybtn;
    var lbl = btn.innerHTML;
    paybtn.disabled = true; savebtn.disabled = true;
    btn.textContent = paylater ? 'Saving…' : 'Opening secure checkout…';
    fetch('/api/home/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: lines.concat(accLines()), customer: c, notes: notes, paylater: !!paylater })
    }).then(function(r){
      return r.json().then(function(d){ return { ok: r.ok, d: d }; });
    }).then(function(x){
      if(!x.ok || !x.d.ref || (!paylater && !x.d.url)) throw new Error((x.d && x.d.error) || 'failed');
      try{
        localStorage.setItem('lumia_home_last', JSON.stringify({ ref: x.d.ref, email: c.email, at: Date.now() }));
      }catch(e){}
      lines = []; saveLines();
      ACC = {}; saveAcc();
      location.href = paylater
        ? 'track.html?ref=' + encodeURIComponent(x.d.ref) + '&saved=1'
        : x.d.url;
    }).catch(function(err){
      paybtn.disabled = false; savebtn.disabled = false;
      btn.innerHTML = lbl;
      syncPay();
      ckMsg(paylater
        ? 'Could not save the order — please try again, or write to lumiashades@gmail.com.'
        : 'Could not start the payment — please try again, or write to lumiashades@gmail.com.');
    });
  }
  paybtn.addEventListener('click', function(){ submitOrder(false); });
  savebtn.addEventListener('click', function(){ submitOrder(true); });

  /* ── boot ── */
  /* a returning customer: quietly refresh the stored price list */
  function refreshPrices(){
    if(!ACCOUNT) return;
    var c = {};
    RG_FIELDS.forEach(function(k){ c[k] = ACCOUNT[k] || ''; });
    fetch('/api/home/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ customer: c })
    }).then(function(r){ if(!r.ok) throw new Error('skip'); return r.json(); })
    .then(function(d){
      ACCOUNT.prices = d.prices; setAccount(ACCOUNT);
      if(P) renderSteps();
      renderLines();
    }).catch(function(){});
  }
  function boot(){
    if(booted) return;
    booted = true;
    refreshPrices();
    loadContact();
    fetch('assets/shop-config.json?v=' + Date.now())
      .then(function(r){ return r.json(); })
      .then(function(cfg){
        CFG = cfg;
        renderLines();
        applyHash();
        /* a cart line sent over from another product's page */
        var pe = null;
        try{
          pe = sessionStorage.getItem('lumia_home_edit');
          sessionStorage.removeItem('lumia_home_edit');
        }catch(e){}
        if(pe != null && lines[+pe] && lines[+pe].pid === PID) editLine(+pe);
      });
  }

  boot();
})();
