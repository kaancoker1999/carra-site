/* LUMIA — Spanish / French for the public site and the trade portal.
   The pages are written in English; this layer translates what is on screen:
   every text node, placeholder and title is looked up in the dictionary of the
   chosen language (assets/i18n/es.js, fr.js) — including content the page
   builds later (order form, mailbox, tutorial…), via a MutationObserver.
   Nothing that is stored or sent changes: orders, option values and messages
   stay exactly as written, so the admin panel always reads the same English.
   The admin panel does not load this file.

   · language: localStorage "lumia_lang" (en | es | fr); switching reloads the page
   · dictionary keys are the English strings (whitespace-normalised); a key may
     contain inline HTML when the sentence does (<b>, <a>…)
   · PATTERNS (in the dictionary file) cover strings with changing parts
   · "A · B · C" and "Label: value" strings are translated piece by piece
   · anything without an entry simply stays in English
   · ?i18n=collect lists what is still untranslated (window.LUMIA_I18N.missing()) */
(function(){
  var LANGS = { en: 'English', es: 'Español', fr: 'Français' };
  var lang = 'en';
  try { lang = localStorage.getItem('lumia_lang') || 'en'; } catch (e) {}
  if (!LANGS[lang]) lang = 'en';
  var collect = /[?&]i18n=collect/.test(location.search);
  var missing = {};

  document.documentElement.lang = lang;

  /* ── language switcher (every page that loads this file) ── */
  function switcher(){
    if (document.getElementById('langsw')) return;
    var css = document.createElement('style');
    css.textContent =
      '#langsw{position:fixed;right:14px;bottom:14px;z-index:1500;display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(20,18,36,.88);border:1px solid rgba(255,255,255,.22);box-shadow:0 8px 24px rgba(0,0,0,.28);backdrop-filter:blur(8px)}' +
      '#langsw button{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;letter-spacing:.1em;border:0;background:none;color:rgba(255,255,255,.72);border-radius:999px;padding:7px 11px;cursor:pointer}' +
      '#langsw button:hover{color:#fff}' +
      '#langsw button.on{background:#F6F3EC;color:#1B1D1F}' +
      '@media print{#langsw{display:none}}';
    document.head.appendChild(css);
    var box = document.createElement('div');
    box.id = 'langsw'; box.setAttribute('data-noi18n', '1'); box.setAttribute('role', 'group'); box.setAttribute('aria-label', 'Language');
    box.innerHTML = Object.keys(LANGS).map(function (k) {
      return '<button type="button" data-lang="' + k + '" title="' + LANGS[k] + '"' + (k === lang ? ' class="on"' : '') + '>' + k.toUpperCase() + '</button>';
    }).join('');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lang]'); if (!b || b.dataset.lang === lang) return;
      try { localStorage.setItem('lumia_lang', b.dataset.lang); } catch (err) {}
      location.reload();
    });
    document.body.appendChild(box);
  }
  function whenBody(fn){ if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }
  whenBody(switcher);

  window.LUMIA_I18N = {
    lang: lang,
    t: function (s) { return s; },
    missing: function () { return Object.keys(missing).sort(); }
  };
  if (lang === 'en' && !collect) return;

  /* ── the dictionary: loaded right here, before the page is parsed ── */
  var DICT = {}, PATTERNS = [];
  window.LUMIA_I18N_DATA = function (dict, patterns) { DICT = dict || {}; PATTERNS = patterns || []; };
  if (lang !== 'en') {
    document.documentElement.classList.add('i18n-wait');
    document.write('<style>html.i18n-wait body{visibility:hidden}</style>');
    document.write('<script src="assets/i18n/' + lang + '.js?v=1"><\/script>');
    /* never leave the page hidden if something goes wrong */
    setTimeout(function () { document.documentElement.classList.remove('i18n-wait'); }, 2500);
  }

  /* dates and numbers the pages format as US English follow the language */
  var LOCALE = { es: 'es', fr: 'fr' }[lang];
  if (LOCALE) {
    ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString'].forEach(function (m) {
      var orig = Date.prototype[m];
      Date.prototype[m] = function (loc, opt) { return orig.call(this, loc === 'en-US' ? LOCALE : loc, opt); };
    });
  }

  function norm(s){ return String(s).replace(/\s+/g, ' ').trim(); }

  /* one string → its translation, or null */
  function lookup(s){
    if (Object.prototype.hasOwnProperty.call(DICT, s)) return DICT[s];
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i], m = p[0].exec(s);
      if (m) {
        return p[1].replace(/\$(\d)/g, function (_, n) { return m[+n] == null ? '' : m[+n]; })
                   .replace(/\{(\d)\}/g, function (_, n) { var v = m[+n]; return v == null ? '' : (piece(v) || v); });
      }
    }
    return null;
  }
  /* "A · B", "Label: value", "A — B", "3 lines" … piece by piece */
  function piece(s){
    var t = lookup(s);
    if (t != null) return t;
    var seps = [' · ', ' — ', ': ', ' / '];
    for (var i = 0; i < seps.length; i++) {
      var sep = seps[i];
      if (s.indexOf(sep) === -1) continue;
      var parts = s.split(sep), hit = false;
      var out = parts.map(function (x) { var y = piece(x); if (y != null) { hit = true; return y; } return x; });
      if (hit) return out.join(sep);
    }
    return null;
  }
  function tr(raw){
    var s = norm(raw);
    if (!s || !/[A-Za-z]/.test(s)) return null;
    var t = piece(s);
    if (t == null) { if (collect && s.length < 400 && /[A-Za-z]{2}/.test(s)) missing[s] = 1; return null; }
    /* keep the original outer whitespace (text nodes sit between tags) */
    var lead = /^\s*/.exec(raw)[0], trail = /\s*$/.exec(raw)[0];
    return (lead ? ' ' : '') + t + (trail ? ' ' : '');
  }
  window.LUMIA_I18N.t = function (s) { var t = tr(s); return t == null ? s : t.trim(); };
  if (lang === 'en') {          /* collect mode in English: only gather */
    DICT = {}; PATTERNS = [];
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, TEXTAREA: 1, SVG: 1 };
  var INLINE = { B: 1, I: 1, A: 1, EM: 1, STRONG: 1, SPAN: 1, BR: 1, SMALL: 1, U: 1, SUP: 1, SUB: 1 };
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var done = typeof WeakSet === 'function' ? new WeakSet() : { has: function () { return false; }, add: function () {} };

  function skipped(el){
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (SKIP[n.nodeName.toUpperCase()] || n.hasAttribute('data-noi18n') || n.isContentEditable) return true;
    }
    return false;
  }
  /* a sentence with inline markup inside ("due <b>within 20 days</b>") is one entry:
     an element that has text of its own plus only simple inline children */
  function sentence(el){
    if (!el.children.length || el.children.length > 6) return null;
    var own = false;
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { if (/[A-Za-z]{3}/.test(n.nodeValue)) own = true; }
      else if (n.nodeType === 1) {
        if (!INLINE[n.nodeName] || n.children.length > 1 || n.id || n.hasAttribute('data-noi18n')) return null;
        for (var i = 0; i < n.attributes.length; i++) if (/^(data-|on)/.test(n.attributes[i].name)) return null;
        if (n.querySelector('button,input,select,textarea,img')) return null;
      }
    }
    if (!own) return null;
    var key = norm(el.innerHTML);
    return key.length > 900 ? null : key;
  }
  function wholeElement(el){
    var key = sentence(el);
    if (key == null) return false;
    if (Object.prototype.hasOwnProperty.call(DICT, key)) { el.innerHTML = DICT[key]; return true; }
    if (collect) missing['§' + key] = 1;
    return false;
  }
  function textNode(n){
    if (done.has(n)) return;
    var t = tr(n.nodeValue);
    done.add(n);
    if (t != null && lang !== 'en' && t !== n.nodeValue) {
      /* an <option> without a value attribute uses its text as its value: pin the
         English text as the value first, so what is sent and stored never changes */
      var o = n.parentNode;
      if (o && o.nodeName === 'OPTION' && !o.hasAttribute('value')) o.setAttribute('value', norm(o.textContent));
      n.nodeValue = t;
    }
  }
  function attrs(el){
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (!v || el.getAttribute('data-i18n-' + a) === v) continue;
      var t = tr(v);
      if (t != null && lang !== 'en') { t = t.trim(); el.setAttribute(a, t); el.setAttribute('data-i18n-' + a, t); }
    }
  }
  function walk(root){
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !skipped(root.parentNode)) textNode(root); return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    var stack = [root];
    while (stack.length) {
      var el = stack.pop();
      if (el.hasAttribute('data-noi18n')) continue;
      attrs(el);                                         /* a textarea's placeholder too */
      if (SKIP[el.nodeName.toUpperCase()]) continue;
      if (wholeElement(el)) { mark(el); continue; }
      for (var c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) textNode(c);
        else if (c.nodeType === 1) stack.push(c);
      }
    }
  }
  function mark(el){ var w = document.createTreeWalker(el, 4, null, false), n; while ((n = w.nextNode())) done.add(n); }

  var busy = false;
  function run(root){
    busy = true;
    try { walk(root); if (lang !== 'en') { var tt = tr(document.title); if (tt != null) document.title = tt.trim(); } }
    catch (e) { /* a translation hiccup must never break the page */ }
    busy = false;
  }
  function start(){
    run(document.body);
    document.documentElement.classList.remove('i18n-wait');
    new MutationObserver(function (list) {
      if (busy) return;
      busy = true;
      try {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === 'characterData') { done.delete && done.delete(m.target); walk(m.target); }
          else if (m.type === 'attributes') { if (m.target.nodeType === 1 && !skipped(m.target)) attrs(m.target); }
          else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        }
      } catch (e) {}
      busy = false;
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
