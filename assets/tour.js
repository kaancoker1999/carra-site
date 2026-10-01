/* LUMIA trade portal — guided tour.
   Runs once per page on a dealer's first visit (remembered in localStorage)
   and again whenever the "Tutorial" button next to the page heading is clicked. Steps whose
   target is missing or hidden are skipped, so the same tour works for a new
   account with no orders and on a phone. */
(function () {
  var page = (location.pathname.split('/').pop() || 'index.html').replace(/^_|_test/g, '');
  var DONE = 'lumia_tour_done_';

  function byText(sel, re) {
    return [].filter.call(document.querySelectorAll(sel), function (el) { return re.test(el.textContent); })[0] || null;
  }

  var TOURS = {
    'account.html': [
      { title: 'Welcome to your LUMIA trade portal',
        text: 'This one-minute tour shows where everything is. You can skip it and replay it any time.' },
      { el: '#sum-orders', title: 'Your orders at a glance',
        text: 'How many orders you have placed, and how many are awaiting review, in production or shipped.' },
      { el: '#sum-balance', title: 'Your balance',
        text: 'What you have purchased in total, what is still unpaid, and what is payable right now.' },
      { el: function () { return byText('#summary .sum', /Payable/); }, title: 'Payable — pay from here',
        text: 'As soon as an order goes into production it becomes payable, and payment is due within 20 days. Click this tile for the amounts due and our bank details.' },
      { el: '.actions a[href="order.html"]', title: 'Place an order',
        text: 'Build an order line by line — product, fabric, options and size — and send it to us for review.' },
      { el: function () { return document.querySelector('#otable:not([hidden])') || document.querySelector('#noorders:not([hidden])'); },
        title: 'Your orders',
        text: 'Every order with its status and payment. Click an order to see its items, the FedEx tracking number and — once it has shipped — the invoice.' },
      { el: 'header nav a[href="price-list.html"]', title: 'Price list',
        text: 'Your own trade prices for every product, always up to date.' },
      { el: '#tourlink', title: 'Replay the tutorial',
        text: 'That’s it. Click “Tutorial” whenever you want to see this again.' }
    ],
    'order.html': [
      { title: 'Placing an order',
        text: 'A quick look at how to build and send an order.' },
      { el: '#cells', title: 'Build one line at a time',
        text: 'Pick the product, then the fabric and options. The form only offers what is actually available for your choices.' },
      { el: function () { var w = document.getElementById('c-w'); return w ? w.closest('.cellrow') : null; }, title: 'Size and quantity',
        text: 'Sizes are in inches plus eighths. The allowed range is shown above each field and follows the product and options you chose.' },
      { el: '#addbtn', title: 'Add to order',
        text: 'Adds the line to your order below, with its price. Repeat for every shade.' },
      { el: function () { return document.querySelector('#lines:not([hidden])') || document.getElementById('empty'); }, title: 'Your order so far',
        text: 'All lines with unit prices and totals. Use Edit to change a line or × to remove it.' },
      { el: '#customer', title: 'Customer / project',
        text: 'Name the job (it becomes the sidemark) and add any notes, such as a requested delivery date.' },
      { el: '#sendbtn', title: 'Send order',
        text: 'Sends the order to LUMIA. You can still edit or withdraw it while it is pending review.' },
      { el: '#orders', title: 'Orders you have sent',
        text: 'Status, FedEx tracking, reorder — and the invoice once an order has shipped.' }
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
    a.addEventListener('click', function () {
      if (TOURS[page]) start(); else location.href = 'account.html?tour=1';
    });
  }

  /* ── the tour itself ── */
  var steps, idx, shade, card, target;

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
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
      '.tour-n{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.12em;color:#7A7E82;margin-right:auto}' +
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
    while (i >= 0 && i < steps.length && steps[i].el && !resolve(steps[i])) i += dir;
    if (i < 0) i = 0;
    if (i >= steps.length) return end();
    idx = i;
    var st = steps[i];
    target = resolve(st);
    var last = true;
    for (var j = i + 1; j < steps.length; j++) { if (!steps[j].el || resolve(steps[j])) { last = false; break; } }
    card.innerHTML = '<h4></h4><p></p><div class="tour-foot"><span class="tour-n"></span>' +
      (last ? '' : '<button class="skip" data-t="skip" type="button">Skip</button>') +
      (i > 0 ? '<button data-t="back" type="button">Back</button>' : '') +
      '<button class="pri" data-t="next" type="button">' + (last ? 'Done' : 'Next') + '</button></div>';
    card.querySelector('h4').textContent = st.title;
    card.querySelector('p').textContent = st.text;
    card.querySelector('.tour-n').textContent = (i + 1) + ' / ' + steps.length;
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
    try { localStorage.setItem(DONE + page, '1'); } catch (e) {}
    [shade, card, document.querySelector('.tour-block')].forEach(function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); });
    window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey);
    shade = card = target = null;
  }
  function onKey(e) {
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight') show(idx + 1, 1);
    else if (e.key === 'ArrowLeft') show(idx - 1, -1);
  }

  function start() {
    if (card || !TOURS[page]) return;
    css();
    steps = TOURS[page];
    var block = document.createElement('div'); block.className = 'tour-block';
    shade = document.createElement('div'); shade.className = 'tour-shade none';
    card = document.createElement('div'); card.className = 'tour-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Guided tour');
    document.body.appendChild(block); document.body.appendChild(shade); document.body.appendChild(card);
    card.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t === 'skip') end();
      else if (b.dataset.t === 'back') show(idx - 1, -1);
      else show(idx + 1, 1);
    });
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    document.addEventListener('keydown', onKey);
    show(0, 1);
  }

  function init() {
    addLink();
    if (!TOURS[page]) return;
    var forced = /[?&]tour=1/.test(location.search), seen = false;
    try { seen = !!localStorage.getItem(DONE + page); } catch (e) { seen = true; }
    /* give the page a moment to load its orders before pointing at them */
    if (forced || !seen) setTimeout(start, 900);
  }

  window.LUMIA_TOUR = { start: start };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  else setTimeout(init, 0);
})();
