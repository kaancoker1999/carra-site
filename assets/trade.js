/* LUMIA trade area — session, server login and nav injection. */
(function () {
  var KEY = 'lumia_trade';

  function getSession() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function setSession(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(KEY); }

  /* login: the access code is checked server-side and the dealer's own
     price list comes back — nothing price-related ships with the site */
  function login(code) {
    return fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: String(code || '').trim() })
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function (d) {
      if (!d || !d.prices) return null;
      setSession({ at: new Date().toISOString(), code: String(code).trim(), name: d.name, prices: d.prices, promo: d.promo || null, contact: d.contact || null });
      return d.prices;
    });
  }

  /* ── drawer menu (all pages load this file) ──
     At every width the header links give way to a hamburger that slides a
     full-height white panel in from the right over a dimmed page:
     plain links, a "Products" group that expands with +, and the
     partner link as a solid button pinned to the bottom. */
  var SHADE_LINKS = [
    ['roman.html', 'Roman shades'], ['cellular.html', 'Cellular shades'],
    ['pleated.html', 'Pleated shades']
  ];
  function injectMobileNav() {
    var header = document.querySelector('header');
    var nav = header && header.querySelector('nav');
    if (!nav || document.getElementById('navtoggle')) return;
    var css = document.createElement('style');
    css.textContent =
      '#navtoggle{display:block;font-size:20px;line-height:1;background:none;border:1px solid #D3D2CC;' +
      'border-radius:8px;padding:7px 12px;cursor:pointer;color:#14171A}' +
      '#navveil{position:fixed;inset:0;background:rgba(16,14,10,.5);opacity:0;pointer-events:none;' +
      'transition:opacity .4s ease;z-index:998}' +
      '#navveil.on{opacity:1;pointer-events:auto}' +
      '#navdrawer{position:fixed;top:0;right:0;bottom:0;width:min(372px,90vw);background:#fff;z-index:999;' +
      'transform:translateX(104%);transition:transform .5s cubic-bezier(.3,.7,.25,1);display:flex;' +
      'flex-direction:column;padding:64px 30px 26px;overflow:auto;box-shadow:-16px 0 50px rgba(20,23,26,.22)}' +
      '#navdrawer.open{transform:none}' +
      '#navclose{position:absolute;top:12px;right:14px;font-size:30px;line-height:1;background:none;border:0;' +
      'cursor:pointer;color:#14171A;padding:8px 10px}' +
      '#navdrawer .dlinks{margin-bottom:28px}' +
      '#navdrawer .dlink,#navdrawer .dghead{display:block;width:100%;text-align:left;background:none;border:0;' +
      'border-bottom:1px solid #EFEDE8;cursor:pointer;font-family:\'IBM Plex Sans\',sans-serif;font-size:17px;' +
      'font-weight:400;color:#44484C;text-decoration:none;padding:15px 2px;letter-spacing:0;text-transform:none}' +
      '#navdrawer .dlink.on{color:#14171A;font-weight:600}' +
      '#navdrawer .dghead{font-weight:600;color:#14171A;display:flex;justify-content:space-between;align-items:center}' +
      '#navdrawer .dmain{display:block;border-bottom:1px solid #EFEDE8;font-family:\'IBM Plex Sans\',sans-serif;font-size:17px;font-weight:600;color:#14171A;text-decoration:none;padding:15px 2px;text-transform:none;letter-spacing:0}' +
      '#navdrawer .dghead span{font-size:21px;font-weight:400;color:#8A8E92;transition:transform .3s}' +
      '#navdrawer .dgroup.open>.dghead span{transform:rotate(45deg)}' +
      '#navdrawer .dsub{display:none;border-bottom:1px solid #EFEDE8;padding:4px 0 12px}' +
      '#navdrawer .dgroup.open>.dsub{display:block}' +
      '#navdrawer .dsub a{display:block;font-family:\'IBM Plex Sans\',sans-serif;font-size:14.5px;color:#64686C;' +
      'text-decoration:none;padding:9px 0 9px 14px;text-transform:none;letter-spacing:0}' +
      '#navdrawer .dghead.g2,#navdrawer .dmain.g2{font-size:15px;padding:12px 2px 12px 14px;border-bottom:1px solid #F3F1EC}' +
      '#navdrawer .dsub.g2{border-bottom:1px solid #F3F1EC;padding:2px 0 8px}' +
      '#navdrawer .dsub.g2 a{padding-left:28px;font-size:14px}' +
      '#navdrawer .dcta{margin-top:auto;display:block;text-align:center;background:#14171A;color:#fff!important;' +
      'border-radius:10px;padding:16px;font-family:\'IBM Plex Mono\',monospace;font-size:11px;letter-spacing:.16em;' +
      'text-transform:uppercase;text-decoration:none}' +
      '#navdrawer .dcta:hover{background:#8A6220}' +
      'header nav{display:none!important}header{position:sticky}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'navtoggle';
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '&#9776;';
    nav.parentNode.appendChild(btn);
    if (getComputedStyle(header).position === 'static') header.style.position = 'sticky';

    var veil = document.createElement('div'); veil.id = 'navveil';
    var dr = document.createElement('aside'); dr.id = 'navdrawer';
    dr.setAttribute('aria-label', 'Menu');
    document.body.appendChild(veil);
    document.body.appendChild(dr);

    /* rebuilt on every open, so links injected after login are included */
    function build() {
      var links = [].slice.call(nav.querySelectorAll('a'));
      var isPublic = links.some(function (a) { return /#products$/.test(a.getAttribute('href') || ''); });
      var html = '<button id="navclose" aria-label="Close menu">&times;</button><div class="dlinks">';
      var cta = '';
      links.forEach(function (a) {
        var href = a.getAttribute('href') || '#', label = a.innerHTML;
        if (a.classList.contains('partner')) {
          cta = '<a class="dcta" href="' + href + '">' + label + '</a>';
          return;
        }
        if (isPublic && /#products$/.test(href)) {
          /* Products opens to the Shades / Drapery / TDBU headings; Shades opens again */
          html += '<div class="dgroup"><button class="dghead" type="button">' + label + '<span>+</span></button>' +
            '<div class="dsub">' +
              '<div class="dgroup g2"><button class="dghead g2" type="button">Shades<span>+</span></button>' +
                '<div class="dsub g2">' + SHADE_LINKS.map(function (p) {
                  return '<a href="' + p[0] + '">' + p[1] + '</a>';
                }).join('') + '</div></div>' +
              '<div class="dgroup g2"><button class="dghead g2" type="button">Drapery<span>+</span></button>' +
                '<div class="dsub g2"><a href="drapery.html">Drapery</a></div></div>' +
              '<div class="dgroup g2"><button class="dghead g2" type="button">Top-down bottom-up<span>+</span></button>' +
                '<div class="dsub g2"><a href="tdbu.html">Top-down bottom-up</a></div></div>' +
            '</div></div>';
          return;
        }
        if (isPublic && /(?:^|\/)tdbu(?:\.html)?$/.test(href)) return; /* lives inside the Products group */
        html += '<a class="dlink' + (a.hasAttribute('style') ? ' on' : '') + '" href="' + href + '">' + label + '</a>';
      });
      dr.innerHTML = html + '</div>' + cta;
    }

    function setOpen(o) {
      if (o) build();
      dr.classList.toggle('open', o);
      veil.classList.toggle('on', o);
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      document.body.style.overflow = o ? 'hidden' : '';
    }
    btn.addEventListener('click', function () { setOpen(!dr.classList.contains('open')); });
    veil.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    dr.addEventListener('click', function (e) {
      if (e.target.closest('#navclose')) { setOpen(false); return; }
      var gh = e.target.closest('.dghead');
      if (gh) { gh.parentNode.classList.toggle('open'); return; }
      var cta = e.target.closest('.dcta');
      if (cta) {
        /* the portal's "Log out" link works by handler, not href — forward the click */
        var orig = nav.querySelector('a.partner');
        if (orig) { e.preventDefault(); setOpen(false); orig.click(); return; }
      }
      if (e.target.closest('a')) setOpen(false);
    });
  }

  /* how many messages from LUMIA the dealer hasn't opened yet → a count on "Messages" */
  function navUnread() {
    var s = getSession(), a = document.getElementById('navmsg');
    if (!s || !a) return;
    fetch('/api/threads', { headers: { 'x-dealer-code': s.code || '' } })
      .then(function (r) { return r.ok ? r.json() : { threads: [] }; })
      .then(function (d) {
        var n = 0;
        (d.threads || []).forEach(function (t) {
          var seen = t.dealerSeenAt || '';
          for (var i = t.messages.length - 1; i >= 0; i--) {
            var m = t.messages[i];
            if (m.from !== 'lumia' || m.at <= seen) break;
            n++;
          }
        });
        var old = a.querySelector('span'); if (old) old.remove();
        if (n) {
          var b = document.createElement('span');
          b.textContent = n;
          b.style.cssText = 'display:inline-block;min-width:16px;height:16px;line-height:16px;border-radius:999px;background:#C8502F;color:#fff;font-size:9px;letter-spacing:0;text-align:center;padding:0 4px;margin-left:6px;vertical-align:1px';
          a.appendChild(b);
        }
      }).catch(function () {});
  }

  /* ── nav injection ── */
  function injectNav() {
    injectMobileNav();
    var nav = document.querySelector('header nav');
    if (!nav) return;
    var partner = nav.querySelector('.partner');
    if (getSession()) {
      if (!nav.querySelector('a[href="account.html"]')) {
        var cls = (nav.querySelector('a.lnk') ? ' class="lnk"' : '');
        var here = location.pathname.split('/').pop().replace(/^_|_test/g, '');   /* local previews: _orders_test.html */
        if(here && here.indexOf('.html') === -1) here += '.html';   /* Netlify pretty URLs: /price-list */
        var mark = function (href) { return href === here ? ' style="color:var(--ink)"' : ''; };
        var frag = document.createElement('span');
        /* inside the portal: its own pages; on the public site: one "Portal" link */
        var inPortal = ['account.html', 'orders.html', 'order.html', 'price-list.html', 'messages.html'].indexOf(here) !== -1;
        frag.innerHTML = inPortal
          ? '<a href="account.html"' + cls + mark('account.html') + '>My account</a> ' +
            '<a href="orders.html"' + cls + (here === 'order.html' ? ' style="color:var(--ink)"' : mark('orders.html')) + '>Orders</a> ' +
            '<a href="messages.html" id="navmsg"' + cls + mark('messages.html') + '>Messages</a> ' +
            '<a href="price-list.html"' + cls + mark('price-list.html') + '>Price list</a>'
          : '<a href="account.html"' + cls + '>Portal</a>';
        if (inPortal) setTimeout(navUnread, 0);
        var anchor = partner || null;
        while (frag.firstChild) nav.insertBefore(frag.firstChild, anchor);
      }
      if (partner) {
        partner.textContent = 'Log out';
        partner.href = '#';
        partner.addEventListener('click', function (e) {
          e.preventDefault(); clearSession(); location.href = 'index.html';
        });
      }
    } else if (partner) {
      partner.href = 'trade.html';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNav);
  } else {
    injectNav();
  }

  window.LUMIA_TRADE = {
    getSession: getSession,
    clearSession: clearSession,
    login: login,
    require: function () {
      var s = getSession();
      /* re-login daily so price updates reach every dealer within a day */
      if (s && Date.now() - Date.parse(s.at) > 24 * 3600 * 1000) { clearSession(); s = null; }
      if (!s) location.href = 'trade.html';
      return s;
    }
  };
})();
