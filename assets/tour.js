/* LUMIA trade portal — one guided tutorial across the whole portal.
   The "Tutorial" button on any portal page (and a dealer's first visit to the
   account page) opens a chooser: one of the four topics — My account, Orders,
   Place an order, Price list — or the whole portal, which walks through all
   four, moving from page to page by itself.
   Steps whose target is missing or hidden are skipped, so it also works for a
   new account with no orders and on a phone. */
(function () {
  var file = location.pathname.split('/').pop() || 'index.html';
  var page = file.replace(/^_|_test/g, '');
  var DONE = 'lumia_tour_done_all', CHAIN = 'lumia_tour_chain';
  /* the order the tutorial visits the pages in */
  var SEQ = ['account.html', 'orders.html', 'order.html', 'price-list.html'];
  var PART = { 'account.html': 'My account', 'orders.html': 'Orders', 'order.html': 'Place an order', 'price-list.html': 'Price list' };
  /* local previews (_account_test.html …) keep the walk inside the preview pages */
  var demo = /^_.+_test\.html$/.test(file);
  function urlOf(name) {
    return (demo || /_test\.html/.test(document.referrer)) && (name === 'account.html' || name === 'orders.html')
      ? '_' + name.replace('.html', '_test.html') : name;
  }
  function flag(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  /* '1' = the whole portal, page after page · 'one' = just this page's topic */
  function mode() { try { return sessionStorage.getItem(CHAIN); } catch (e) { return null; } }
  var single = false;
  var BLURB = {
    'account.html': 'Your balance, payments due and latest orders',
    'orders.html': 'Awaiting review, in production, shipped',
    'order.html': 'How to build and send an order',
    'price-list.html': 'Products, sub-groups, options, Excel download'
  };

  function byText(sel, re) {
    return [].filter.call(document.querySelectorAll(sel), function (el) { return re.test(el.textContent); })[0] || null;
  }

  var TOURS = {
    'account.html': [
      { chain: true, title: 'Welcome to your LUMIA trade portal',
        text: 'This tutorial walks you through the whole portal: your account, your orders, placing an order and your price list. You can skip it and replay it any time.' },
      { el: '#sum-orders', title: 'Your orders at a glance',
        text: 'How many orders you have placed, and how many are awaiting review, in production or shipped. Click a tile to open them on the Orders page.' },
      { el: '#sum-balance', title: 'Your balance',
        text: 'What you have purchased in total, what is still unpaid, and what is payable right now.' },
      { el: function () { return byText('#summary .sum', /Payable/); }, title: 'Payable — pay from here',
        text: 'As soon as an order goes into production it becomes payable, and payment is due within 20 days. Click this tile for the amounts due and our bank details.' },
      { el: '.actions a[href="order.html"]', title: 'Place an order',
        text: 'Start a new order here. You build it line by line — product, fabric, options and size — see your price for each line, and send it to us for review.' },
      { el: function () { return document.querySelector('#paysection:not([hidden])'); }, title: 'Payments due',
        text: 'Every unpaid order, grouped by its due date. Use “Pay from here” for our bank details, then “I’ve paid” so we know to look for your payment. Late payments turn red.' },
      { el: '#lastsection', title: 'Last 3 orders',
        text: 'Your three most recent orders with their status and payment. Click one to see its items, the FedEx tracking number and the invoice once it has shipped.' }
    ],
    'orders.html': [
      { title: 'The Orders page',
        text: 'Every order you have sent, sorted into three groups by where it stands.' },
      { el: '.actions a[href="order.html"]', title: 'Place an order',
        text: 'Start a new order from here at any time.' },
      { el: '#awaiting', title: 'Awaiting review',
        text: 'Orders we have received but not started yet. While an order is here you can still cancel it, or edit it from the order form.' },
      { el: '#production', title: 'In production',
        text: 'Orders being made. From this point the order is locked and becomes payable — payment is due within 20 days.' },
      { el: '#shipped', title: 'Shipped',
        text: 'Orders that have left our factory. Click one for its FedEx tracking number and its invoice.' },
      { el: function () { return document.querySelector('.osec.shipped tr.ord:not(.done)'); }, title: 'Shipped — not paid yet',
        text: 'White rows are shipped orders that are still unpaid. They stay at the top until the payment is confirmed.' },
      { el: function () { return document.querySelector('.osec.shipped tr.ord.done'); }, title: 'Shipped — paid',
        text: 'Light grey rows are shipped and paid: finished orders, kept here for your records.' },
      { el: function () { return document.querySelector('.osec tr.ord'); }, title: 'Order details',
        text: 'Click any row to open it: the line items, any note from LUMIA, tracking and the invoice once it has shipped.' }
    ],
    'price-list.html': [
      { title: 'Your price list',
        text: 'These are your own trade prices, in USD per unit. Here is how to read them.' },
      { el: '#xlsbtn', title: 'Download as Excel',
        text: 'Saves the complete price list — every product and every table — as an Excel file you can keep or print.' },
      { el: '#ptabs', title: 'Products',
        text: 'Pick a product: cellular, roman, pleated, drapery, arches or fabric by the yard. Each has its own price tables.' },
      { el: function () { var g = document.getElementById('gtabs'), t = document.getElementById('ttabs');
                          return (g && g.children.length) ? g : t; }, title: 'Sub-groups',
        text: 'Each product is split into sub-groups — for example the fabric colour group for roman shades, the cell type and opacity for cellular, or the heading style for drapery. Choose the one that matches your shade to see its table.' },
      { el: function () { var g = document.getElementById('gtabs'), t = document.getElementById('ttabs');
                          return (g && g.children.length && t && t.children.length) ? t : null; }, title: 'Second level',
        text: 'Some products have a second choice under the first. Pick it to narrow down to one table.' },
      { el: function () { return document.querySelector('#xwrap:not([hidden])'); }, title: 'Options & surcharges',
        text: 'Below each price table: the extras for that product and what each one adds. A percentage (for example a liner or fold style) is added on top of the table price; a dollar amount (for example motorization, top-down bottom-up or a remote) is added per shade. “Standard” means it is included at no extra cost.' },
      { chain: true, el: '#tourlink', title: 'That’s the whole portal',
        text: 'You can replay this tutorial any time with the “Tutorial” button at the top of every page.' }
    ],
    'order.html': [
      { title: 'Placing an order',
        text: 'This is the order form. You build an order one shade at a time, add each one to the list, then send the whole list to LUMIA.' },
      { el: function () { var p = document.getElementById('c-product'); return p ? p.closest('.cellrow') : null; }, title: '1 · Product and fabric',
        text: 'Choose the product first, then the fabric and colour. For roman shades and drapery the colour group is only a filter — leave it on “All groups” to see every fabric.' },
      { el: function () { var rows = document.querySelectorAll('#cells .cellrow'); return rows.length > 1 ? rows[1] : null; }, title: '2 · Options',
        text: 'Mechanism, liner, top-down bottom-up and the other options for that product. The form only offers combinations that can actually be made.' },
      { el: '#c-label', title: '3 · Room / label',
        text: 'Optional: name the window (for example “Living room 2”). It is printed on the order and the invoice so each shade is easy to identify.' },
      { el: function () { var w = document.getElementById('c-w'); return w ? w.closest('.cell') : null; }, title: '4 · Size',
        text: 'Whole inches plus eighths, for width and height. The allowed range is written above each field and changes with the product and options you picked.' },
      { el: '#c-qty', title: '5 · Quantity',
        text: 'How many identical shades of this size. Fabric by the yard is entered in yards.' },
      { el: '#addbtn', title: '6 · Add to order',
        text: 'Adds the line to the list below with its price. Then build the next shade the same way.' },
      { el: function () { return document.querySelector('#lines:not([hidden])') || document.getElementById('empty'); }, title: 'Your order so far',
        text: 'Every line with its unit price and total. Use Edit to change a line or × to remove it.' },
      { el: '#customer', title: 'Customer / project',
        text: 'Name the job — it becomes the sidemark on the order and invoice. Use the notes field for anything else, such as a requested delivery date.' },
      { el: '#sendbtn', title: 'Send order',
        text: 'Sends the order to LUMIA for review. Until it goes into production you can still edit or cancel it.' },
      { el: '#copybtn', title: 'Copy as text',
        text: 'Copies the whole order as plain text, handy for an e-mail or a message to your customer.' },
      { el: '#orders', title: 'Orders you have sent',
        text: 'Your sent orders with their status: edit while pending, reorder, track the shipment, and open the invoice once it has shipped.' }
    ]
  };

  /* ── "Tutorial" button opposite the page heading (every trade page) ── */
  function addLink() {
    var head = document.querySelector('.pagehead'), h1 = head && head.querySelector('h1');
    if (!h1 || document.getElementById('tourlink')) return;
    css();
    var row = document.createElement('div'); row.className = 'tour-headrow';
    h1.parentNode.insertBefore(row, h1);
    row.appendChild(h1);
    var a = document.createElement('button');
    a.id = 'tourlink'; a.type = 'button'; a.className = 'tour-btn'; a.textContent = 'Tutorial';
    row.appendChild(a);
    a.addEventListener('click', menu);
  }

  /* ── the tour itself ── */
  var steps, idx, shade, card, target;

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function usable(step) { return !(single && step.chain) && (!step.el || !!resolve(step)); }
  function resolve(step) {
    if (!step.el) return null;
    var el = typeof step.el === 'function' ? step.el() : document.querySelector(step.el);
    return visible(el) ? el : null;
  }

  function css() {
    if (document.getElementById('tourcss')) return;
    var s = document.createElement('style'); s.id = 'tourcss';
    s.textContent =
      '.tour-headrow{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}' +
      '.tour-btn{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#F6F3EC;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:10px 18px;cursor:pointer;margin-bottom:6px;transition:background .2s,border-color .2s}' +
      '.tour-btn:hover{background:rgba(255,255,255,.14);border-color:#fff}' +
      '.tour-shade{position:fixed;z-index:2000;border-radius:12px;box-shadow:0 0 0 9999px rgba(8,6,20,.72);pointer-events:none;transition:all .25s ease}' +
      '.tour-shade.none{left:50%;top:50%;width:0;height:0}' +
      '.tour-block{position:fixed;inset:0;z-index:1999}' +
      '.tour-card{position:fixed;z-index:2001;width:340px;max-width:calc(100vw - 24px);background:#FBF8F2;color:#1B1D1F;border-radius:16px;padding:18px 20px 14px;box-shadow:0 24px 70px rgba(0,0,0,.5);font-family:inherit}' +
      '.tour-card h4{margin:0 0 6px;font-size:16px;font-weight:600;color:#1B1D1F}' +
      '.tour-card p{margin:0 0 14px;font-size:14px;line-height:1.5;color:#3E4246}' +
      '.tour-foot{display:flex;align-items:center;gap:8px}' +
      '.tour-bar{height:4px;border-radius:99px;background:#E6E0D5;overflow:hidden;margin:0 0 12px}' +
      '.tour-bar i{display:block;height:100%;background:#B8934A;border-radius:99px;transition:width .3s ease}' +
      '.tour-menu{width:420px}' +
      '.tour-topics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 14px}' +
      '.tour-card .tour-topics button{text-align:left;border-radius:12px;padding:12px 14px;text-transform:none;letter-spacing:0;font-family:inherit;display:block;transition:border-color .15s,background .15s}' +
      '.tour-card .tour-topics button:hover{border-color:#1B1D1F;background:#fff}' +
      '.tour-topics b{display:block;font-size:14px;font-weight:600;color:#1B1D1F;margin-bottom:3px}' +
      '.tour-topics span{display:block;font-size:12px;line-height:1.35;color:#5A5E62}' +
      '@media(max-width:480px){.tour-topics{grid-template-columns:1fr}}' +
      '.tour-part{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#8A6A3E;margin:0 0 6px}' +
      '.tour-card button{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;border-radius:999px;padding:8px 14px;cursor:pointer;border:1px solid #CFC8BC;background:#fff;color:#1B1D1F}' +
      '.tour-card button.pri{background:#1B1D1F;border-color:#1B1D1F;color:#fff}' +
      '.tour-card button.skip{border-color:transparent;background:none;color:#7A7E82;padding:8px 6px}';
    document.head.appendChild(s);
  }

  function place() {
    var vw = window.innerWidth, vh = window.innerHeight, cw = card.offsetWidth, ch = card.offsetHeight, pad = 8;
    if (!target) {
      shade.className = 'tour-shade none';
      shade.style.cssText = '';
      card.style.left = Math.max(12, (vw - cw) / 2) + 'px';
      card.style.top = Math.max(12, (vh - ch) / 2) + 'px';
      return;
    }
    var r = target.getBoundingClientRect();
    shade.className = 'tour-shade';
    shade.style.left = (r.left - pad) + 'px'; shade.style.top = (r.top - pad) + 'px';
    shade.style.width = (r.width + pad * 2) + 'px'; shade.style.height = (r.height + pad * 2) + 'px';
    var top = r.bottom + pad + 12;
    if (top + ch > vh - 12) top = r.top - pad - 12 - ch;          /* no room below → above */
    if (top < 12) top = Math.max(12, vh - ch - 12);               /* tall target → pin to the bottom */
    card.style.top = top + 'px';
    card.style.left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12) + 'px';
  }

  function show(i, dir) {
    /* skip steps whose target isn't on screen for this account / device */
    while (i >= 0 && i < steps.length && !usable(steps[i])) i += dir;
    if (i < 0) { i = 0; while (i < steps.length && !usable(steps[i])) i++; }
    if (i >= steps.length) {
      var nextPage = single ? null : SEQ[SEQ.indexOf(page) + 1];
      if (!nextPage) return end();
      flag(CHAIN, '1');
      location.href = urlOf(nextPage);          /* the tutorial continues on the next page */
      return;
    }
    idx = i;
    var st = steps[i];
    target = resolve(st);
    var last = true;
    for (var j = i + 1; j < steps.length; j++) { if (usable(steps[j])) { last = false; break; } }
    var pi = SEQ.indexOf(page), finalPage = pi === SEQ.length - 1;
    var theEnd = last && (single || finalPage);
    var first = true;
    for (var f = 0; f < i; f++) { if (usable(steps[f])) { first = false; break; } }
    card.innerHTML = '<div class="tour-bar"><i></i></div><div class="tour-part"></div><h4></h4><p></p><div class="tour-foot">' +
      (theEnd ? '' : '<button class="skip" data-t="skip" type="button">Skip tutorial</button>') +
      '<span style="margin-right:auto"></span>' +
      (!first ? '<button data-t="back" type="button">Back</button>' : '') +
      '<button class="pri" data-t="next" type="button">' + (theEnd ? 'Done' : 'Next') + '</button></div>';
    card.querySelector('h4').textContent = st.title;
    card.querySelector('p').textContent = st.text;
    /* one progress bar for the whole tutorial, across all pages */
    var before = 0, total = 0;
    var pos = i + 1;
    if (single) { var mine = steps.filter(usable); total = mine.length; pos = mine.indexOf(st) + 1; }
    else SEQ.forEach(function (name, k) { var n = (TOURS[name] || []).length; total += n; if (k < pi) before += n; });
    card.querySelector('.tour-bar i').style.width = Math.round((before + pos) / total * 100) + '%';
    card.querySelector('.tour-part').textContent = single ? PART[page] : PART[page] + ' · part ' + (pi + 1) + ' of ' + SEQ.length;
    if (target) {
      var r = target.getBoundingClientRect();
      if (r.top < 90 || r.bottom > window.innerHeight - 40) {
        window.scrollTo(0, Math.max(0, window.scrollY + r.top - Math.max(100, (window.innerHeight - Math.min(r.height, window.innerHeight * .5)) / 3)));
      }
    }
    place();
    card.querySelector('.pri').focus();
  }

  function end() {
    try { localStorage.setItem(DONE, '1'); } catch (e) {}
    flag(CHAIN, null);
    single = false;
    [shade, card, document.querySelector('.tour-block')].forEach(function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey);
    shade = card = target = null;
  }
  function onKey(e) {
    if (e.key === 'Escape') end();
    else if (idx < 0) return;                      /* chooser: no stepping */
    else if (e.key === 'ArrowRight') show(idx + 1, 1);
    else if (e.key === 'ArrowLeft') show(idx - 1, -1);
  }

  /* the chooser: one topic, or the whole portal */
  function menu() {
    if (card) end();
    shell();
    steps = []; target = null; idx = -1;
    card.classList.add('tour-menu');
    card.innerHTML = '<h4>Tutorial</h4><p>What would you like to see?</p><div class="tour-topics">' +
      SEQ.map(function (name) {
        return '<button type="button" data-topic="' + name + '"><b>' + PART[name] + '</b><span>' + BLURB[name] + '</span></button>';
      }).join('') + '</div><div class="tour-foot"><button class="skip" data-t="skip" type="button">Close</button>' +
      '<span style="margin-right:auto"></span><button class="pri" data-topic="all" type="button">Show me everything</button></div>';
    place();
  }
  function pick(topic) {
    var all = topic === 'all', dest = all ? SEQ[0] : topic;
    flag(CHAIN, all ? '1' : 'one');
    if (dest !== page) { location.href = urlOf(dest); return; }
    end(true); flag(CHAIN, all ? '1' : 'one');
    start();
  }

  function start() {
    if (card || !TOURS[page]) return;
    single = mode() === 'one';
    shell();
    steps = TOURS[page];
    show(0, 1);
  }

  function shell() {
    css();
    try { localStorage.setItem(DONE, '1'); } catch (e) {}   /* seen once it has been opened */
    var block = document.createElement('div'); block.className = 'tour-block';
    shade = document.createElement('div'); shade.className = 'tour-shade none';
    card = document.createElement('div'); card.className = 'tour-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Guided tour');
    document.body.appendChild(block); document.body.appendChild(shade); document.body.appendChild(card);
    card.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.topic) return pick(b.dataset.topic);
      if (b.dataset.t === 'skip') end();
      else if (b.dataset.t === 'back') show(idx - 1, -1);
      else show(idx + 1, 1);
    });
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    document.addEventListener('keydown', onKey);
  }

  function init() {
    addLink();
    if (!TOURS[page]) return;
    var forced = /[?&]tour=1/.test(location.search), seen = false;
    try { seen = !!localStorage.getItem(DONE); } catch (e) { seen = true; }
    /* it begins on the account page on a first visit, and carries on here if
       it is already under way; give the page a moment to load its data first */
    if (forced) flag(CHAIN, '1');
    if (mode()) setTimeout(start, 900);                         /* picked in the chooser / already under way */
    else if (!seen && page === SEQ[0]) setTimeout(menu, 900);   /* first visit: offer the tutorial */
  }

  window.LUMIA_TOUR = { start: start, menu: menu };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  else setTimeout(init, 0);
})();
