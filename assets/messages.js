/* LUMIA trade portal — Messages (messages.html): the dealer's mailbox.
   Every conversation with LUMIA — contact requests about an order and general
   requests / questions — listed on the left, the open one on the right. */
(function(){
  var SESSION = LUMIA_TRADE.require();
  if(!SESSION) return;

  function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function $(id){ return document.getElementById(id); }
  function day(x){ return new Date(x).toLocaleDateString('en-US', {month:'short', day:'numeric'}); }
  function when(x){
    var d = new Date(x);
    return day(x) + ' · ' + d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
  }
  function call(path, body){
    return fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-dealer-code': SESSION.code || '', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){
      if(r.status === 401){ LUMIA_TRADE.clearSession(); location.href = 'trade.html'; throw new Error('logged out'); }
      return r.json().then(function(d){ if(!r.ok) throw new Error(d.error || 'failed'); return d; });
    });
  }

  var threads = [], openId = null, composing = false;
  var AUTH = { 'x-dealer-code': SESSION.code || '' };
  var pick = null;                                   /* the "Add photos" control of the open form */
  function mountPicker(id){ var el = $(id); pick = el && window.LUMIA_PHOTOS ? LUMIA_PHOTOS.picker(el) : null; }
  function photos(){ return pick ? pick.get() : []; }
  var q = /[?&]open=([^&]+)/.exec(location.search);
  if(q) openId = decodeURIComponent(q[1]);
  if(/[?&]new=1/.test(location.search)) composing = true;

  /* how many messages LUMIA has sent since the dealer last opened the thread */
  function unread(t){
    var seen = t.dealerSeenAt || '', n = 0;
    for(var i = t.messages.length - 1; i >= 0; i--){ var m = t.messages[i]; if(m.from !== 'lumia' || m.at <= seen) break; n++; }
    return n;
  }
  function tags(t){
    return '<span class="mtag' + (/Damaged|Wrong|Missing/.test(t.kind) ? ' urgent' : '') + '">' + esc(t.kind) + '</span>' +
      (t.orderRef ? '<span class="mtag">' + esc(t.orderRef) + '</span>' : '') +
      (t.status === 'closed' ? '<span class="mtag closed">Closed</span>' : '');
  }

  function renderList(){
    $('mblist').innerHTML =
      '<button class="btn solid mbnew" type="button" data-new="1">New message</button>' +
      (threads.length ? threads.map(function(t){
        var last = t.messages[t.messages.length - 1], n = unread(t);
        return '<div class="mbitem' + (t.id === openId && !composing ? ' on' : '') + (t.status === 'closed' ? ' closed' : '') + '" data-open="' + esc(t.id) + '">' +
          '<div class="mbtop"><b>' + esc(t.subject) + '</b>' + (n ? '<span class="mbn">' + n + '</span>' : '') + '</div>' +
          '<div class="mbsnip">' + (last.from === 'dealer' ? 'You' : 'LUMIA') + ': <span data-noi18n="1">' + esc(last.text) + '</span></div>' +
          '<div class="mbmeta">' + tags(t) + '<span class="mbdate">' + day(last.at) + '</span></div></div>';
      }).join('') : '<div class="mbempty">No messages yet.</div>');
  }

  function renderPane(){
    var pane = $('mbpane');
    document.body.classList.toggle('mb-open', composing || !!openId);   /* phones: list ↔ conversation */
    if(composing){
      pane.innerHTML = '<button class="mbback" type="button" data-back="1">← All messages</button>' +
        '<div class="mbhead"><b>New message</b></div>' +
        '<div class="mbform">' +
          '<div class="mrow"><label>Type<select id="n-kind"><option>Request</option><option>Question</option></select></label>' +
          '<label>Subject<input id="n-subject" type="text" maxlength="120" placeholder="e.g. Fabric samples for Outlander" autocomplete="off"></label></div>' +
          '<label>Message<textarea id="n-text" rows="5" maxlength="2000" placeholder="Tell us what you need."></textarea></label>' +
          '<div id="n-photos"></div>' +
          '<p class="mbnote">About a specific order? Open it on the <a href="orders.html">Orders</a> page and use “Contact us about this order”.</p>' +
          '<div class="mfoot"><span class="merr" id="n-err"></span><button class="btn solid" id="n-send" type="button">Send</button></div></div>';
      mountPicker('n-photos');
      return;
    }
    var t = threads.filter(function(x){ return x.id === openId; })[0];
    if(!t){
      pick = null;
      pane.innerHTML = '<div class="mbblank">' + (threads.length ? 'Choose a conversation on the left.' : 'Your conversations with LUMIA appear here. Use “New message” to write to us.') + '</div>';
      return;
    }
    var keep = $('r-text') && $('r-text').dataset.id === t.id ? $('r-text').value : '';
    pane.innerHTML = '<button class="mbback" type="button" data-back="1">← All messages</button>' +
      '<div class="mbhead"><b>' + esc(t.subject) + '</b><div class="mbmeta">' + tags(t) +
        (t.orderRef ? '<a class="mbord" href="orders.html">View order →</a>' : '') + '</div></div>' +
      '<div class="mbbox" id="mbbox"><div class="bubbles" style="margin:0">' + t.messages.map(function(m){
        var mine = m.from === 'dealer';
        return '<div class="bub ' + (mine ? 'me' : 'them') + '"><span class="who">' + (mine ? 'You' : 'LUMIA') + ' · ' + when(m.at) + '</span><span data-noi18n="1">' + esc(m.text) + '</span>' +
          (window.LUMIA_PHOTOS ? LUMIA_PHOTOS.html(m.photos) : '') + '</div>';
      }).join('') + '</div></div>' +
      (t.status === 'closed' ? '<p class="mbnote">LUMIA closed this conversation. Writing again reopens it.</p>' : '') +
      '<div class="treply"><textarea id="r-text" data-id="' + esc(t.id) + '" rows="3" maxlength="2000" placeholder="Write a reply…"></textarea>' +
      '<div id="r-photos"></div>' +
      '<div class="mfoot"><span class="merr" id="r-err"></span><button class="btn solid" id="r-send" type="button">Send reply</button></div></div>';
    $('r-text').value = keep;
    mountPicker('r-photos');
    if(window.LUMIA_PHOTOS) LUMIA_PHOTOS.hydrate(pane, AUTH);
    $('mbbox').scrollTop = $('mbbox').scrollHeight;
  }

  function render(){
    /* the open conversation counts as read */
    var t = !composing && threads.filter(function(x){ return x.id === openId; })[0];
    if(t && unread(t)){
      t.dealerSeenAt = new Date().toISOString();
      call('/api/thread/seen', { id: t.id }).catch(function(){});
    }
    renderList(); renderPane();
  }
  function load(){
    return call('/api/threads').then(function(d){ threads = d.threads || []; render(); });
  }

  document.addEventListener('click', function(e){
    if(e.target.closest('[data-new]')){ composing = true; render(); var s = $('n-subject'); if(s) s.focus(); return; }
    if(e.target.closest('[data-back]')){ composing = false; openId = null; render(); return; }
    var it = e.target.closest('[data-open]');
    if(it){ composing = false; openId = it.getAttribute('data-open'); render(); return; }
    if(e.target.closest('#n-send')){
      var b = e.target.closest('#n-send'), subject = $('n-subject').value.trim(), text = $('n-text').value.trim();
      $('n-err').textContent = '';
      if(!subject || (!text && !photos().length)){ $('n-err').textContent = 'Please add a subject and a message.'; return; }
      b.disabled = true; b.textContent = 'Sending…';
      call('/api/thread', { kind: $('n-kind').value, subject: subject, text: text, photos: photos() })
        .then(function(d){ composing = false; openId = d.thread.id; return load(); })
        .catch(function(){ $('n-err').textContent = 'Could not send — please try again.'; b.disabled = false; b.textContent = 'Send'; });
      return;
    }
    if(e.target.closest('#r-send')){
      var rb = e.target.closest('#r-send'), txt = $('r-text').value.trim();
      $('r-err').textContent = '';
      if(!txt && !photos().length){ $('r-err').textContent = 'Write a reply or add a photo first.'; return; }
      rb.disabled = true; rb.textContent = 'Sending…';
      call('/api/thread/reply', { id: openId, text: txt, photos: photos() })
        .then(function(){ $('r-text').value = ''; return load(); })
        .catch(function(){ $('r-err').textContent = 'Could not send — please try again.'; rb.disabled = false; rb.textContent = 'Send reply'; });
    }
  });

  load().catch(function(){ $('mblist').innerHTML = '<div class="mbempty">Could not load your messages — please refresh the page.</div>'; });
  /* pick up new replies while the page is open (not while something is being typed) */
  setInterval(function(){
    var typing = [].some.call(document.querySelectorAll('#mbpane textarea, #mbpane input'), function(x){ return x.value.trim(); });
    if(!document.hidden && !typing && !photos().length) load().catch(function(){});
  }, 45000);
})();
