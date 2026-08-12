/* LUMIA trade area — shared session, crypto and nav injection. */
(function () {
  var KEY = 'lumia_trade';

  function getSession() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function setSession(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function clearSession() { localStorage.removeItem(KEY); }

  /* ── crypto ── */
  function b64d(s) {
    var bin = atob(s), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function deriveKey(secret, salt, iterations) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      });
  }
  function tryDecrypt(secret, rec, iterations) {
    return deriveKey(secret, b64d(rec.s), iterations).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(rec.i) }, key, b64d(rec.c));
    }).then(function (buf) {
      return new TextDecoder().decode(buf);
    }).catch(function () { return null; });
  }
  function firstHit(secret, records, iterations) {
    var p = Promise.resolve(null);
    records.forEach(function (rec) {
      p = p.then(function (found) {
        return found !== null ? found : tryDecrypt(secret, rec, iterations);
      });
    });
    return p;
  }

  /* login: access code -> group key -> price data. Resolves prices or null. */
  function login(code) {
    return fetch('assets/trade-data.json').then(function (r) { return r.json(); })
      .then(function (data) {
        var it = (data.kdf && data.kdf.iterations) || 150000;
        return firstHit(code.trim(), data.dealers, it).then(function (groupKey) {
          if (!groupKey) return null;
          return firstHit(groupKey, data.groups, it);
        });
      })
      .then(function (pricesJson) {
        if (!pricesJson) return null;
        var prices = JSON.parse(pricesJson);
        setSession({ at: new Date().toISOString(), prices: prices });
        return prices;
      });
  }

  /* ── nav injection ── */
  function injectNav() {
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
      if (!s) location.href = 'trade.html';
      return s;
    }
  };
})();
