/* LUMIA trade portal — "Request or question" at the bottom of every portal page.
   Closed until its button is clicked; then a short form (request / question).
   The conversation itself continues in Messages (messages.html). Something
   about a specific order is sent from that order, on the Orders page. */
(function(){
  if(!window.LUMIA_TRADE) return;
  var SESSION = LUMIA_TRADE.getSession();
  if(!SESSION) return;

  function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function when(x){
    var d = new Date(x);
    return d.toLocaleDateString('en-US', {month:'short', day:'numeric'}) + ' · ' +
           d.toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'});
  }
  function call(path, body){
    return fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-dealer-code': SESSION.code || '', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){
      return r.json().then(function(d){ if(!r.ok) throw new Error(d.error || 'failed'); return d; });
    });
  }

  var css = document.createElement('style');
  css.textContent =
    '.sp{border-top:1px solid rgba(255,255,255,.08);padding:26px 0 30px}' +
    '.sp-bar{display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
    '.sp-bar p{margin:0;font-size:14px;color:rgba(255,255,255,.62)}' +
    '.sp-btn{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#F6F3EC;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:11px 20px;cursor:pointer;transition:background .2s,border-color .2s}' +
    '.sp-btn:hover{background:rgba(255,255,255,.14);border-color:#fff}' +
    '.sp-dot{display:inline-block;min-width:16px;height:16px;line-height:16px;border-radius:999px;background:#C8502F;color:#fff;font-size:9px;letter-spacing:0;text-align:center;padding:0 4px;margin-left:8px}' +
    '.sp-panel{margin-top:18px;max-width:820px}' +
    '.sp-form{background:#FBF8F2;border-radius:16px;padding:18px 20px;color:#1B1D1F}' +
    '.sp-form label,.sp-reply label{display:block;font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#6B6F73;margin:0 0 12px}' +
    '.sp-form input,.sp-form select,.sp-form textarea,.sp-reply textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;font-family:"IBM Plex Sans",sans-serif;font-size:14.5px;letter-spacing:0;text-transform:none;color:#1B1D1F;background:#fff;border:1px solid #D9D2C5;border-radius:9px;padding:11px 12px}' +
    '.sp-form textarea,.sp-reply textarea{resize:vertical;line-height:1.45}' +
    '.sp-form input:focus,.sp-form select:focus,.sp-form textarea:focus,.sp-reply textarea:focus{outline:none;border-color:#1B1D1F}' +
    '.sp-row{display:grid;grid-template-columns:180px 1fr;gap:12px}' +
    '.sp-foot{display:flex;align-items:center;justify-content:flex-end;gap:14px}' +
    '.sp-err{font-size:13px;color:#8A2620;margin-right:auto}' +
    '.sp-send{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;background:#1B1D1F;color:#fff;border:0;border-radius:999px;padding:11px 20px;cursor:pointer}' +
    '.sp-send:disabled{opacity:.6}' +
    '.sp-note{font-size:13px;color:rgba(255,255,255,.6);margin:12px 2px 0}' +
    '.sp-note a{color:#D9AE5A}' +
    '.sp-title{font-family:"Archivo",sans-serif;font-weight:600;font-size:17px;color:#F6F3EC;margin:26px 0 10px}' +
    '.sp-thread{background:#fff;border-radius:14px;margin:0 0 10px;color:#1B1D1F;overflow:hidden}' +
    '.sp-thread.closed{background:#EEECE7}' +
    '.sp-head{display:flex;align-items:center;gap:10px;padding:13px 18px;cursor:pointer;flex-wrap:wrap}' +
    '.sp-head:hover{background:#FCFAF3}' +
    '.sp-sub{font-weight:600;font-size:15px;margin-right:auto}' +
    '.sp-meta{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.06em;color:#6B6F73}' +
    '.sp-tag{font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:3px 9px;border:1px solid #D9D2C5;color:#4A4E52;background:#FBF8F2;white-space:nowrap}' +
    '.sp-tag.new{background:#1B1D1F;border-color:#1B1D1F;color:#fff}' +
    '.sp-tag.closed{background:#E4E2DD;color:#6B6F73}' +
    '.sp-body{border-top:1px solid #EEE9E0;padding:16px 18px 18px;background:#FBF9F4}' +
    '.sp-bubs{display:flex;flex-direction:column;gap:10px;margin:0 0 14px}' +
    '.sp-bub{max-width:78%;border-radius:14px;padding:10px 14px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}' +
    '.sp-bub .who{display:block;font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;opacity:.7;margin-bottom:4px}' +
    '.sp-bub.me{align-self:flex-end;background:#1B1D1F;color:#fff;border-bottom-right-radius:4px}' +
    '.sp-bub.them{align-self:flex-start;background:#fff;border:1px solid #D9D2C5;border-bottom-left-radius:4px}' +
    '.sp-closed{font-size:13px;color:#5A5E62;margin:0 0 12px}' +
    '@media(max-width:640px){.sp-row{grid-template-columns:1fr}.sp-bub{max-width:92%}}';
  document.head.appendChild(css);

  var expanded = false;
  var box = document.createElement('div');
  box.className = 'sp';
  box.innerHTML = '<div class="wrap"><div class="sp-bar">' +
    '<button class="sp-btn" id="sp-toggle" type="button">Request or question</button>' +
    '<p>Need something from LUMIA? Send us a request or a question &mdash; we answer in <a href="messages.html" style="color:#D9AE5A">Messages</a>.</p></div>' +
    '<div class="sp-panel" id="sp-panel" hidden></div></div>';

  function renderPanel(sentId){
    document.getElementById('sp-panel').innerHTML = sentId
      ? '<div class="sp-form"><p style="margin:0;font-size:14.5px">✓ Sent. We will answer in <a href="messages.html?open=' + encodeURIComponent(sentId) + '" style="color:#8A6A3E;font-weight:600">Messages</a>.</p></div>'
      : '<div class="sp-form"><div class="sp-row">' +
          '<label>Type<select id="sp-kind"><option>Request</option><option>Question</option></select></label>' +
          '<label>Subject<input id="sp-subject" type="text" maxlength="120" placeholder="e.g. Fabric samples for Outlander" autocomplete="off"></label></div>' +
          '<label>Message<textarea id="sp-text" rows="4" maxlength="2000" placeholder="Tell us what you need."></textarea></label>' +
          '<div class="sp-foot"><span class="sp-err" id="sp-err"></span><button class="sp-send" id="sp-sendnew" type="button">Send</button></div></div>' +
        '<p class="sp-note">About a specific order? Open it on the <a href="orders.html">Orders</a> page and use “Contact us about this order”.</p>';
  }

  box.addEventListener('click', function(e){
    if(e.target.closest('#sp-toggle')){
      expanded = !expanded;
      var p = document.getElementById('sp-panel');
      p.hidden = !expanded;
      if(expanded){ renderPanel(); p.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
      return;
    }
    if(e.target.closest('#sp-sendnew')){
      var b = e.target.closest('#sp-sendnew'), err = document.getElementById('sp-err');
      var subject = document.getElementById('sp-subject').value.trim(), text = document.getElementById('sp-text').value.trim();
      err.textContent = '';
      if(!subject || !text){ err.textContent = 'Please add a subject and a message.'; return; }
      b.disabled = true; b.textContent = 'Sending…';
      call('/api/thread', { kind: document.getElementById('sp-kind').value, subject: subject, text: text })
        .then(function(d){ renderPanel(d.thread.id); })
        .catch(function(){ err.textContent = 'Could not send — please try again.'; b.disabled = false; b.textContent = 'Send'; });
    }
  });

  function mount(){
    var footer = document.querySelector('footer');
    if(!footer || document.querySelector('.sp')) return;
    footer.parentNode.insertBefore(box, footer);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
