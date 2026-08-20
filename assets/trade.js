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
      setSession({ at: new Date().toISOString(), code: String(code).trim(), name: d.name, prices: d.prices, promo: d.promo || null });
      return d.prices;
    });
  }

  /* ── mobile hamburger (all pages load this file) ── */
  function injectMobileNav() {
    var header = document.querySelector('header');
    var nav = header && header.querySelector('nav');
    if (!nav || document.getElementById('navtoggle')) return;
    var css = document.createElement('style');
    css.textContent =
      '#navtoggle{display:none;font-size:20px;line-height:1;background:none;border:1px solid #D3D2CC;' +
      'border-radius:8px;padding:7px 12px;cursor:pointer;color:#14171A}' +
      '@media(max-width:760px){' +
      '#navtoggle{display:block}' +
      'header nav{display:none;position:absolute;top:100%;left:0;right:0;background:rgba(255,255,255,.98);' +
      'backdrop-filter:blur(12px);border-bottom:1px solid #E4E3DE;flex-direction:column;' +
      'align-items:stretch;gap:0;padding:6px 22px 18px}' +
      'header nav.open{display:flex}' +
      'header nav a{display:block!important;padding:13px 0;font-size:13px;border-bottom:1px solid #F1F1EE}' +
      'header nav a:last-child{border-bottom:0}' +
      'header nav a.partner{margin-top:10px;text-align:center;border:1px solid #D3D2CC;padding:12px}' +
      'header{position:sticky}' +
      '}';
    document.head.appendChild(css);
    var btn = document.createElement('button');
    btn.id = 'navtoggle';
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '&#9776;';
    nav.parentNode.appendChild(btn);
    if (getComputedStyle(header).position === 'static') header.style.position = 'sticky';
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.innerHTML = open ? '&times;' : '&#9776;';
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { nav.classList.remove('open'); btn.innerHTML = '&#9776;'; }
    });
  }

  /* ── nav injection ── */
  function injectNav() {
    injectMobileNav();
    var nav = document.querySelector('header nav');
    if (!nav) return;
    var partner = nav.querySelector('.partner');
    if (getSession()) {
      if (!nav.querySelector('a[href="price-list.html"]')) {
        var cls = (nav.querySelector('a.lnk') ? ' class="lnk"' : '');
        var here = location.pathname.split('/').pop();
        var mark = function (href) { return href === here ? ' style="color:var(--ink)"' : ''; };
        var frag = document.createElement('span');
        frag.innerHTML =
          '<a href="account.html"' + cls + mark('account.html') + '>My account</a> ' +
          '<a href="price-list.html"' + cls + mark('price-list.html') + '>Price list</a> ' +
          '<a href="order.html"' + cls + mark('order.html') + '>Place order</a>';
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
