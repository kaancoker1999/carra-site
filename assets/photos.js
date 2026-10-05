/* LUMIA — photos in conversations (shared by the dealer pages and the admin panel).
   · picker(el): an "Add photos" control; pictures are shrunk in the browser
     (longest side 1600 px, JPEG) before they are sent with the message
   · html(ids) + hydrate(root, headers): show a message's photos; they are
     fetched with the caller's credentials, so only the people in the
     conversation can load them */
(function(){
  var MAX = 4, SIDE = 1600, QUALITY = 0.82;

  var css = document.createElement('style');
  css.textContent =
    '.ph-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 0}' +
    '.ph-add{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;background:#fff;border:1px solid #CFC8BC;border-radius:999px;padding:8px 14px;cursor:pointer;color:#1B1D1F}' +
    '.ph-add:hover{border-color:#1B1D1F}' +
    '.ph-hint{font-size:12px;color:#6B6F73}' +
    '.ph-thumb{position:relative;width:58px;height:58px;border-radius:9px;overflow:hidden;border:1px solid #CFC8BC;background:#EEE}' +
    '.ph-thumb img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.ph-thumb button{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:12px;line-height:18px;padding:0;cursor:pointer}' +
    '.bphotos{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}' +
    '.bphotos a{display:block;width:96px;height:96px;border-radius:10px;overflow:hidden;background:rgba(127,127,127,.25);border:1px solid rgba(127,127,127,.35)}' +
    '.bphotos img{width:100%;height:100%;object-fit:cover;display:block}';
  document.head.appendChild(css);

  /* file -> shrunken JPEG data URL */
  function shrink(file){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, SIDE / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', QUALITY));
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('not an image')); };
      img.src = url;
    });
  }

  /* mount an "Add photos" control into el; returns { get(), clear() } */
  function picker(el){
    var list = [];
    el.classList.add('ph-row');
    el.innerHTML = '<button class="ph-add" type="button">+ Add photos</button><input type="file" accept="image/*" multiple hidden><span class="ph-hint">Up to ' + MAX + ' photos</span>';
    var input = el.querySelector('input'), add = el.querySelector('.ph-add'), hint = el.querySelector('.ph-hint');
    function draw(){
      [].forEach.call(el.querySelectorAll('.ph-thumb'), function(x){ x.remove(); });
      list.forEach(function(d, i){
        var t = document.createElement('div'); t.className = 'ph-thumb';
        t.innerHTML = '<img alt="Photo ' + (i + 1) + '"><button type="button" title="Remove" data-rm="' + i + '">&times;</button>';
        t.querySelector('img').src = d;
        el.insertBefore(t, hint);
      });
      add.hidden = list.length >= MAX;
      hint.textContent = list.length ? list.length + ' of ' + MAX + ' photos' : 'Up to ' + MAX + ' photos';
    }
    add.addEventListener('click', function(){ input.click(); });
    input.addEventListener('change', function(){
      var files = [].slice.call(input.files || []).slice(0, MAX - list.length);
      input.value = '';
      files.reduce(function(p, f){
        return p.then(function(){ return shrink(f).then(function(d){ list.push(d); }).catch(function(){ hint.textContent = 'That file is not a picture.'; }); });
      }, Promise.resolve()).then(draw);
    });
    el.addEventListener('click', function(e){
      var rm = e.target.closest('[data-rm]'); if(!rm) return;
      list.splice(+rm.getAttribute('data-rm'), 1); draw();
    });
    return { get: function(){ return list.slice(); }, clear: function(){ list = []; draw(); } };
  }

  /* markup for a message's photos; hydrate() then loads them */
  function html(ids){
    if(!ids || !ids.length) return '';
    return '<div class="bphotos">' + ids.map(function(id){
      return '<a href="#" target="_blank" rel="noopener" data-photo="' + String(id).replace(/[^A-Za-z0-9_-]/g, '') + '"><img alt="Photo" loading="lazy"></a>';
    }).join('') + '</div>';
  }
  var cache = {};
  function hydrate(root, headers){
    [].forEach.call((root || document).querySelectorAll('a[data-photo]'), function(a){
      if(a.dataset.done) return;
      a.dataset.done = '1';
      var id = a.getAttribute('data-photo');
      (cache[id] || (cache[id] = fetch('/api/photo/' + id, { headers: headers || {} })
        .then(function(r){ if(!r.ok) throw new Error('no photo'); return r.blob(); })
        .then(function(b){ return URL.createObjectURL(b); })))
        .then(function(url){ a.href = url; a.querySelector('img').src = url; })
        .catch(function(){ a.style.display = 'none'; });
    });
  }

  window.LUMIA_PHOTOS = { picker: picker, html: html, hydrate: hydrate, MAX: MAX };
})();
