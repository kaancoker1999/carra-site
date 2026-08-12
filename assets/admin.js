/* LUMIA admin — owner-only helpers for publishing order statuses.
   Works entirely with the owner's own GitHub token, stored only in
   this browser (localStorage). Dealers never have a token, so for
   them none of this activates. */
(function () {
  var REPO = 'kaancoker1999/carra-site';
  var PATH = 'assets/order-status.json';
  var KEY = 'lumia_admin_token';

  function token() { return localStorage.getItem(KEY) || ''; }
  function setToken(t) {
    if (t) { localStorage.setItem(KEY, t); } else { localStorage.removeItem(KEY); }
  }

  function gh(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      'Authorization': 'Bearer ' + token(),
      'Accept': 'application/vnd.github+json'
    }, opts.headers || {});
    return fetch('https://api.github.com/repos/' + REPO + '/' + url, opts)
      .then(function (r) {
        if (!r.ok) return r.json().catch(function(){ return {}; }).then(function (b) {
          throw new Error('GitHub ' + r.status + (b.message ? ': ' + b.message : ''));
        });
        return r.json();
      });
  }

  function b64encodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decodeUtf8(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
  }

  /* read the live status file (with sha, for updates) */
  function fetchStatuses() {
    return gh('contents/' + PATH + '?ref=main').then(function (f) {
      return { sha: f.sha, data: JSON.parse(b64decodeUtf8(f.content) || '{}') };
    });
  }

  /* set entry to {status, locked, note} or null to clear; retries once on sha conflict */
  function saveStatus(ref, entry, attempt) {
    return fetchStatuses().then(function (cur) {
      if (entry) { cur.data[ref] = entry; } else { delete cur.data[ref]; }
      return gh('contents/' + PATH, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'Order status: ' + ref + ' -> ' + (entry ? entry.status + (entry.locked ? ' [locked]' : '') : 'cleared'),
          content: b64encodeUtf8(JSON.stringify(cur.data, null, 1)),
          sha: cur.sha,
          branch: 'main'
        })
      }).then(function () { return cur.data; });
    }).catch(function (e) {
      if (!attempt && /409/.test(e.message)) return saveStatus(ref, entry, 1);
      throw e;
    });
  }

  /* interactive editor used by the badge click on order.html */
  function editStatus(ref, current) {
    var status = prompt('Status for ' + ref + '\n(empty = clear back to Pending)',
      (current && current.status) || 'In production');
    if (status === null) return Promise.resolve(null); /* cancelled */
    status = status.trim();
    if (!status) {
      if (!confirm('Clear the status of ' + ref + '? It goes back to Pending and unlocks.')) return Promise.resolve(null);
      return saveStatus(ref, null).then(function (d) { return { data: d, entry: null }; });
    }
    var locked = confirm('Lock ' + ref + '?\nOK = locked (dealer cannot edit or remove) · Cancel = not locked');
    var note = prompt('Note shown to the dealer (optional)', (current && current.note) || '') || '';
    var entry = { status: status, locked: locked };
    if (note.trim()) entry.note = note.trim();
    return saveStatus(ref, entry).then(function (d) { return { data: d, entry: entry }; });
  }

  window.LUMIA_ADMIN = {
    hasToken: function () { return !!token(); },
    setToken: setToken,
    fetchStatuses: fetchStatuses,
    saveStatus: saveStatus,
    editStatus: editStatus
  };
})();
