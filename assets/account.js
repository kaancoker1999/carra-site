/* LUMIA trade portal — account overview (account.html) and orders (orders.html).
   Each block renders only if its container exists on the page. */
(function(){
  var SESSION = LUMIA_TRADE.require();
  if(!SESSION) return;

  function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function isPaid(o){ return !!(o.payment && o.payment.paid); }
  function orderTotals(ls){
    var total = 0, unknown = 0;
    (ls || []).forEach(function(l){
      if(l.price == null){ unknown += 1; } else { total += l.price * l.qty; }
    });
    return { total: Math.round(total * 100) / 100, unknown: unknown };
  }

  function tile(v, k, cls, act, href){
    if(href) return '<a class="sum' + (cls ? ' ' + cls : '') + '" href="' + href + '"><div class="v">' + v + '</div><div class="k">' + k + '</div></a>';
    return '<div class="sum' + (cls ? ' ' + cls : '') + (act ? ' act" data-act="' + act + '" role="button" tabindex="0"' : '"') +
      '><div class="v">' + v + '</div><div class="k">' + k + (act ? ' <span class="go">pay from here →</span>' : '') + '</div></div>';
  }
  function fdate(x){
    return new Date(x).toLocaleDateString('en-US', {year:'numeric', month:'short', day:'numeric'});
  }
  function fmtIn(v){
    var n = Math.round(v * 8) / 8, w = Math.floor(n), e = Math.round((n - w) * 8);
    if(e === 8){ w += 1; e = 0; }
    return w + ({0:'',1:' 1/8',2:' 1/4',3:' 3/8',4:' 1/2',5:' 5/8',6:' 3/4',7:' 7/8'})[e] + '″';
  }

  /* delivered = either side confirmed the goods arrived; billed on the
     1st of the following month (delivered in Aug -> due Sep 1) */
  function deliveredAt(o){
    var rc = o.receipt || {};
    var a = rc.adminAt ? Date.parse(rc.adminAt) : null;
    var b = rc.dealerAt ? Date.parse(rc.dealerAt) : null;
    if(a == null) return b;
    if(b == null) return a;
    return Math.min(a, b);
  }
  /* payment opens once an order goes In production and is due PAY_DAYS later */
  var PAY_DAYS = 20;
  function prodStart(o){
    if(o.productionAt) return o.productionAt;
    var st = (o.status && o.status.status) || 'Pending review';
    if(st === 'In production' && o.status.updatedAt) return o.status.updatedAt;
    return o.shippedAt || null;
  }
  function dueWed(o){
    var p = prodStart(o); if(!p) return null;
    var d = new Date(p);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + PAY_DAYS);
  }
  function paidAt(o){ return (o.payment && o.payment.paid && o.payment.updatedAt) ? Date.parse(o.payment.updatedAt) : null; }
  /* shown in Payments due while it is owed — and, once paid, for 2 more days */
  function payShow(o){
    var st = (o.status && o.status.status) || 'Pending review';
    if(st === 'Cancelled' || !prodStart(o)) return false;
    if(isPaid(o)){ var pa = paidAt(o); return pa != null && (Date.now() - pa) < 2 * 86400000; }
    return true;
  }
  function payDue(o){ return payShow(o) && !isPaid(o) ? dueWed(o) : null; }
  function payable(o){ return payShow(o) && !isPaid(o); }   /* still owed */
  function startOfToday(){ var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); }
  /* past the 20-day window and still unpaid -> late warning */
  function daysLate(o){ var d = dueWed(o); return d ? Math.round((startOfToday() - d.getTime()) / 86400000) : 0; }
  function isLate(o){ return payable(o) && daysLate(o) > 0; }
  function lateTag(o){ var n = daysLate(o); return 'Late · ' + n + ' day' + (n === 1 ? '' : 's'); }
  function orderItems(o){
    return (o.lines || []).map(function(l){ return (l.label ? esc(l.label) + ' — ' : '') + esc(l.product); }).join(' &middot; ');
  }

  /* a TDBU that wasn't chosen is left out — only "Top-down bottom-up: Yes" is written */
  function cleanSpec(t){
    return String(t || '').split(' · ').filter(function(part){
      return !/^(top-down bottom-up|tdbu): no$/i.test(part.trim());
    }).join(' · ');
  }
  function detailHTML(o){
    var rows = (o.lines || []).map(function(l, i){
      var size = l.w == null ? '—' : fmtIn(l.w) + ' × ' + fmtIn(l.h);
      var amt = l.price == null ? 'TBD' : '$' + (Math.round(l.price * l.qty * 100) / 100).toFixed(2);
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + (l.label ? '<b>' + esc(l.label) + '</b><br>' : '') + esc(l.product) +
          '<div class="spec">' + esc(cleanSpec(l.spec || l.desc)) + '</div></td>' +
        '<td>' + size + '</td><td>' + l.qty + '</td><td class="num">' + amt + '</td></tr>';
    }).join('');
    var rc = o.receipt || {}, d = deliveredAt(o), bits = ['Sent ' + fdate(o.at)];
    if(o.shippedAt) bits.push('shipped ' + fdate(o.shippedAt));
    if(d){
      var who = rc.dealerAt && rc.adminAt ? 'confirmed by both sides'
              : rc.dealerAt ? 'confirmed by you' : 'confirmed by LUMIA';
      bits.push('delivered ' + fdate(d) + ' (' + who + ')');
    }
    var pdw = payDue(o);
    if(pdw) bits.push('payment due ' + fdate(pdw));
    if(isPaid(o)) bits.push('paid' + (o.payment.updatedAt ? ' ' + fdate(o.payment.updatedAt) : ''));
    var track = o.tracking
      ? '<div class="track"><i>📦</i><div><b>Shipped &middot; FedEx tracking</b><br><a class="tn" href="https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(o.tracking) + '" target="_blank" rel="noopener" title="Track on FedEx">' + esc(o.tracking) + '</a></div>' +
        '<a href="https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(o.tracking) + '" target="_blank" rel="noopener">Track it →</a></div>'
      : '';
    /* the invoice is issued with the shipment — once a FedEx tracking number is on the order */
    var inv = o.tracking
      ? '<div style="margin:10px 0 0"><button class="paybtn" data-invoice="' + esc(o.ref) + '" type="button" style="padding:9px 16px">Invoice</button></div>'
      : '';
    return '<div class="dwrap"><table>' +
      '<thead><tr><th>#</th><th>Item</th><th>Size</th><th>Qty</th><th>Price</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' + track +
      (o.notes ? '<div class="dnotes"><b>Notes:</b> ' + esc(o.notes) + '</div>' : '') + inv +
      '<div class="dmeta">' + bits.join(' · ') +
      ' · <a href="order.html">' + (o.tracking ? 'edit, reorder or print the invoice →' : 'edit or reorder →') + '</a></div>';
  }

  /* ACH details come from the API (logged-in dealers only) — never in the page */
  var PAYINFO = null;
  function payInfoHTML(orders){
    var P = PAYINFO; if(!P) return '';
    var ex = orders.filter(payable)[0];
    function row(k, v, copy){
      if(!v) return '';
      return '<div class="pirow"><span>' + k + '</span><b>' + esc(v) + '</b>' +
        (copy ? '<button class="picopy" type="button" data-copy="' + esc(v) + '">Copy</button>' : '<i></i>') + '</div>';
    }
    return '<div class="payinfo"><div class="pihead">Payment instructions (ACH)</div>' +
      row('Account holder', P.holder, true) + row('Bank', P.bank) + row('Account type', P.type) +
      row('Routing number', P.routing, true) + row('Account number', P.account, true) +
      '<div class="pimemo">Memo: please include your LUMIA order number' +
      (ex ? ' (e.g. <b>' + esc(ex.ref) + '</b>)' : '') + ' with each payment.</div></div>';
  }
  /* pop-up with the ACH details, opened from the Payable tile / "How to pay" */
  var LASTORDERS = [];
  function openPayPop(){
    if(!PAYINFO) return;
    closePayPop();
    var owed = 0; LASTORDERS.forEach(function(o){ if(payable(o)) owed += orderTotals(o.lines).total; });
    var ov = document.createElement('div');
    ov.className = 'popov'; ov.id = 'paypop';
    ov.innerHTML = '<div class="popbox" role="dialog" aria-modal="true" aria-label="Payment instructions">' +
      '<button class="popx" type="button" aria-label="Close">&times;</button>' +
      '<div class="popamt"><span>Payable now</span><b>$' + owed.toFixed(2) + '</b></div>' +
      popDueHTML(LASTORDERS) + payInfoHTML(LASTORDERS) + popClaimHTML(LASTORDERS) + '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
  }
  /* "I've paid all" inside the pop-up: marks every payable order as paid by
     the customer (LUMIA then confirms) — same two-step tap as on the page */
  function unclaimed(orders){
    return orders.filter(function(o){ return payable(o) && !(o.payment && o.payment.customerPaidAt); });
  }
  function popClaimHTML(orders){
    var n = unclaimed(orders).length, waiting = orders.filter(payable).length - n;
    if(!n){
      return waiting ? '<div class="popdone">✓ Marked as paid — LUMIA will confirm once the payment arrives.</div>' : '';
    }
    return '<div class="popclaim"><span>Sent the payment?</span>' +
      '<button class="paybtn" data-popclaim="1" type="button" style="padding:11px 18px">' +
      (n === 1 ? 'I&rsquo;ve paid' : 'I&rsquo;ve paid all (' + n + ')') + '</button></div>';
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-popclaim]'); if(!b) return;
    var label = b.textContent;
    if(b.dataset.armed !== '1'){
      b.dataset.armed = '1'; b.textContent = 'Tap again to confirm';
      setTimeout(function(){ if(b.dataset.armed === '1'){ b.dataset.armed = ''; b.textContent = label; } }, 6000);
      return;
    }
    b.dataset.armed = ''; b.disabled = true; b.textContent = '…';
    unclaimed(LASTORDERS).map(function(o){ return o.ref; })
      .reduce(function(p, ref){ return p.then(function(){ return claimPaid(ref, true); }); }, Promise.resolve())
      .then(load).then(openPayPop)
      .catch(function(){ b.disabled = false; b.textContent = 'Could not save — try again'; });
  });
  /* compact "Payments due" for the pop-up: each due date with its orders */
  function popDueHTML(orders){
    var groups = {}, today = startOfToday();
    orders.filter(payable).forEach(function(o){
      var w = dueWed(o), k = w.getTime();
      (groups[k] = groups[k] || { due: w, orders: [], owed: 0 });
      groups[k].orders.push(o); groups[k].owed += orderTotals(o.lines).total;
    });
    var keys = Object.keys(groups).sort();
    if(!keys.length) return '';
    return '<div class="popdue"><div class="pihead">Payments due</div>' + keys.map(function(k){
      var g = groups[k], over = g.due.getTime() < today;
      return '<div class="pdgrp' + (over ? ' over' : '') + '"><div class="pdtop"><span>Due ' +
        g.due.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'}) + (over ? ' · late' : '') +
        '</span><b>$' + g.owed.toFixed(2) + '</b></div>' +
        g.orders.map(function(o){
          var claimed = !!(o.payment && o.payment.customerPaidAt);
          return '<div class="pdrow"><span class="pref">' + esc(o.ref) + '</span>' +
            (claimed ? ' <span class="pclaim">Awaiting confirmation</span>'
              : isLate(o) ? ' <span class="plate">' + lateTag(o) + '</span>' : '') +
            '<i>$' + orderTotals(o.lines).total.toFixed(2) + '</i></div>';
        }).join('') + '</div>';
    }).join('') + '</div>';
  }
  function closePayPop(){
    var ov = document.getElementById('paypop'); if(!ov) return;
    ov.remove(); document.body.style.overflow = '';
  }
  document.addEventListener('click', function(e){
    if(e.target.closest('[data-act="paypop"]')){ openPayPop(); return; }
    if(e.target.id === 'paypop' || e.target.closest('.popx')){ closePayPop(); return; }
  });
  /* invoice (shared assets/invoice.js) — billing details come from the session */
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-invoice]'); if(!b) return;
    var o = LASTORDERS.filter(function(x){ return x.ref === b.getAttribute('data-invoice'); })[0];
    if(o) LUMIA_INVOICE.open(o, SESSION.contact, o.dealer || SESSION.name || '', function(m){ b.textContent = m; });
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closePayPop();
    if((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.sum[data-act="paypop"]')){ e.preventDefault(); openPayPop(); }
  });
  document.addEventListener('click', function(e){
    var b = e.target.closest('.picopy'); if(!b) return;
    navigator.clipboard.writeText(b.dataset.copy).then(function(){
      b.textContent = 'Copied'; setTimeout(function(){ b.textContent = 'Copy'; }, 1400);
    });
  });

  function renderPayDue(orders){
    if(!document.getElementById('paysection')) return;   /* Orders page has no payments block */
    var groups = {};
    orders.forEach(function(o){
      if(!payShow(o)) return;
      var w = dueWed(o);
      var k = w.getFullYear() + '-' + ('0'+(w.getMonth()+1)).slice(-2) + '-' + ('0'+w.getDate()).slice(-2);
      (groups[k] = groups[k] || { due: w, orders: [], owed: 0 });
      groups[k].orders.push(o);
      if(!isPaid(o)) groups[k].owed += orderTotals(o.lines).total;
    });
    var keys = Object.keys(groups).sort();
    document.getElementById('paysection').hidden = !keys.length;
    if(!keys.length) return;
    var today = startOfToday();
    var claimable = orders.filter(function(o){ return payShow(o) && !isPaid(o) && !(o.payment && o.payment.customerPaidAt); }).length;
    var allbtn = claimable > 1
      ? '<div style="display:flex;justify-content:flex-end;margin:0 0 10px"><button class="paybtn wht" data-payallclaim="1" type="button" style="padding:9px 16px">I&rsquo;ve paid all (' + claimable + ')</button></div>'
      : '';
    var late = orders.filter(isLate), lateT = 0;
    late.forEach(function(o){ lateT += orderTotals(o.lines).total; });
    var warn = late.length
      ? '<div class="paywarn">⚠ <b>Your payment is late.</b> ' + late.length + ' order' + (late.length === 1 ? ' is' : 's are') + ' past the ' + PAY_DAYS +
        '-day payment window — $' + lateT.toFixed(2) + ' (' + late.map(function(o){ return esc(o.ref); }).join(', ') + '). Please pay as soon as possible.</div>'
      : '';
    LASTORDERS = orders;
    var howbtn = PAYINFO ? '<button class="paybtn wht" data-act="paypop" type="button" style="padding:9px 16px">Pay from here</button>' : '';
    if(howbtn || allbtn){
      allbtn = '<div style="display:flex;justify-content:flex-end;gap:8px;margin:0 0 10px">' + howbtn +
        (claimable > 1 ? '<button class="paybtn wht" data-payallclaim="1" type="button" style="padding:9px 16px">I&rsquo;ve paid all (' + claimable + ')</button>' : '') + '</div>';
    }
    document.getElementById('paydue').innerHTML = warn + allbtn + keys.map(function(k){
      var g = groups[k], over = g.due.getTime() < today && g.owed > 0;
      var when = g.due.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric', year:'numeric'});
      var rows = g.orders.map(function(o){
        var paid = isPaid(o), t = orderTotals(o.lines).total;
        var claimed = !!(o.payment && o.payment.customerPaidAt && !paid);
        var badge = paid ? ' <span class="ppaid">Paid</span>'
                  : claimed ? ' <span class="pclaim">Awaiting confirmation</span>' : '';
        if(!paid && !claimed && isLate(o)) badge += ' <span class="plate">' + lateTag(o) + '</span>';
        var action = paid ? ''
          : claimed ? '<button class="paybtn ghost" data-paidcancel="' + esc(o.ref) + '" type="button">Not yet</button>'
          : '<button class="paybtn" data-paidclaim="' + esc(o.ref) + '" type="button">I&rsquo;ve paid</button>';
        return '<div class="payorow"><div class="pi">' +
          '<span class="pref">' + esc(o.ref) + '</span>' + (o.customer ? ' <span class="pcust">' + esc(o.customer) + '</span>' : '') + badge +
          '<div class="pitems">' + orderItems(o) + '</div></div>' +
          '<div class="por"><div class="poamt' + (paid ? ' done' : '') + '">$' + t.toFixed(2) + '</div>' + action + '</div></div>';
      }).join('');
      return '<div class="paybox' + (over ? ' over' : '') + '">' +
        '<div class="paytop"><div class="pdue">Due ' + when + '</div>' +
        '<div class="pamt">$' + g.owed.toFixed(2) + '</div></div>' +
        '<div class="payorows">' + rows + '</div></div>';
    }).join('');
  }

  function render(orders){
    LASTORDERS = orders;
    var purch = 0, due = 0, shipped = 0, prod = 0, pend = 0;
    orders.forEach(function(o){
      var st = (o.status && o.status.status) || 'Pending review';
      if(st === 'Shipped') shipped++;
      if(st === 'In production') prod++;
      if(st === 'Pending review') pend++;
      if(st !== 'Cancelled'){
        var t = orderTotals(o.lines).total;
        purch += t;
        if(!isPaid(o)) due += t;
      }
    });
    var pay = 0;
    orders.filter(payable).forEach(function(o){ pay += orderTotals(o.lines).total; });
    /* two boxes: where the orders stand, and the money side (account page) */
    if(document.getElementById('summary')){
      document.getElementById('summary').innerHTML =
        '<div class="sumpanel" id="sum-orders"><div class="sumhead">Orders</div><div class="sumrow">' +
          tile(orders.length, 'Orders placed', '', '', 'orders.html') +
          tile(pend, 'Awaiting review', '', '', 'orders.html#awaiting') +
          tile(prod, 'In production', '', '', 'orders.html#production') +
          tile(shipped, 'Shipped', '', '', 'orders.html#shipped') +
        '</div></div>' +
        '<div class="sumpanel" id="sum-balance"><div class="sumhead">Balance</div><div class="sumrow">' +
          tile('$' + purch.toFixed(2), 'Total purchased') +
          tile('$' + due.toFixed(2), 'Balance due', due > 0 ? 'due' : '') +
          tile('$' + pay.toFixed(2), 'Payable', pay > 0 ? 'due' : '', PAYINFO ? 'paypop' : '') +
        '</div></div>';
    }
    renderPayDue(orders);
    renderSections(orders);
  }

  /* one order = a summary row + a hidden details row */
  function rowHTML(o){
    var st = o.status || { status: 'Pending review' };
    var pendSt = st.status === 'Pending review';
    var cancelled = st.status === 'Cancelled';
    var rc = o.receipt || {};
    var done = !!(rc.dealerAt && rc.adminAt);   /* both sides confirmed delivery */
    var stCls = pendSt ? 'pend' : (cancelled ? 'canc' : 'acc');
    var t = orderTotals(o.lines);
    var when = new Date(o.at);
    var payBadge = isPaid(o)
      ? '<span class="status paid">Paid</span>'
      : (!pendSt && st.status !== 'Cancelled' ? '<span class="status unpaid">Unpaid</span>' : '&mdash;');
    /* a shipped order that is paid is finished — shown dimmed */
    var finished = st.status === 'Shipped' && isPaid(o);
    return '<tr class="ord' + (finished ? ' done' : '') + '" title="Click for line items">' +
      '<td>' + when.toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'}) + '</td>' +
      '<td>' + esc(o.customer || '—') + '</td>' +
      '<td><span class="ref">' + esc(o.ref) + '</span></td>' +
      '<td>' + (o.lines || []).length + '</td>' +
      '<td class="num">$' + t.total.toFixed(2) + (t.unknown ? ' <span class="mono" style="font-size:9px">+' + t.unknown + ' TBD</span>' : '') + '</td>' +
      '<td><span class="status ' + stCls + (st.locked ? ' lock' : '') + '">' + esc(st.status) + '</span>' +
        (done ? ' <span class="status acc">Completed</span>' : '') +
        (st.note ? '<div class="lnote">LUMIA: ' + esc(st.note) + '</div>' : '') + '</td>' +
      '<td>' + payBadge + '</td>' +
      '<td>' + (pendSt
        ? '<button class="rbtn" type="button" data-cancel="' + esc(o.ref) + '">Cancel order</button>'
        : (st.status === 'Shipped' && !rc.dealerAt
          ? '<button class="gbtn" type="button" data-received="' + esc(o.ref) + '">Order completed</button>'
          : '')) + '</td>' +
      '</tr>' +
      '<tr class="det" hidden><td colspan="8">' + detailHTML(o) + '</td></tr>';
  }

  /* Orders page: Awaiting review · In production · Shipped (unpaid first,
     paid ones dimmed underneath) */
  function renderSections(orders){
    var box = document.getElementById('osections'); if(!box) return;
    function statusOf(o){ return (o.status && o.status.status) || 'Pending review'; }
    var SECS = [
      { id: 'awaiting', title: 'Awaiting review', empty: 'Nothing waiting for review.',
        list: orders.filter(function(o){ var s = statusOf(o); return s === 'Pending review' || s === 'On hold'; }) },
      { id: 'production', title: 'In production', empty: 'Nothing in production right now.',
        list: orders.filter(function(o){ return statusOf(o) === 'In production'; }) },
      { id: 'shipped', title: 'Shipped', empty: 'No shipped orders yet.',
        list: orders.filter(function(o){ return statusOf(o) === 'Shipped'; })
                    .sort(function(a, b){ return (isPaid(a) ? 1 : 0) - (isPaid(b) ? 1 : 0); }) }
    ];
    var head = '<thead><tr><th>Date</th><th>Customer / project</th><th>Ref</th><th>Lines</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr></thead>';
    box.innerHTML = SECS.map(function(s){
      return '<div class="osec ' + s.id + '" id="' + s.id + '"><div class="xtitle">' + s.title + '<span class="n">' + s.list.length + '</span></div>' +
        (s.list.length
          ? '<div class="tablewrap"><table>' + head + '<tbody class="orows">' + s.list.map(rowHTML).join('') + '</tbody></table></div>'
          : '<div class="none">' + s.empty + '</div>') + '</div>';
    }).join('') +
      (orders.length ? '' : '<div class="osec"><div class="none">No orders sent yet &mdash; <a href="order.html" style="color:#fff">place your first order</a>.</div></div>');
    if(location.hash && !renderSections.jumped){
      renderSections.jumped = true;
      var t = document.getElementById(location.hash.slice(1)); if(t) t.scrollIntoView({ block: 'start' });
    }
  }

  /* a click anywhere on an order row (except its buttons/links) opens the details */
  document.addEventListener('click', function(e){
    if(!e.target.closest('.orows')) return;
    if(e.target.closest('.rbtn') || e.target.closest('.gbtn') || e.target.closest('a') || e.target.closest('button')) return;
    var tr = e.target.closest('tr.ord'); if(!tr) return;
    var det = tr.nextElementSibling;
    if(det && det.classList.contains('det')) det.hidden = !det.hidden;
  });

  /* "Order completed" — the customer confirms the goods arrived; the order
     then joins the payment schedule. Same inline two-step confirmation. */
  document.addEventListener('click', function(e){
    var b = e.target.closest('.orows .gbtn'); if(!b) return;
    if(b.dataset.armed !== '1'){
      b.dataset.armed = '1'; b.classList.add('armed'); b.textContent = 'Click again to confirm';
      note(b, 'This confirms the order arrived — it will be billed on the 1st of next month.');
      setTimeout(function(){
        if(b.dataset.armed === '1'){
          b.dataset.armed = ''; b.classList.remove('armed'); b.textContent = 'Order completed'; note(b, '');
        }
      }, 8000);
      return;
    }
    b.dataset.armed = ''; b.classList.remove('armed');
    b.disabled = true; b.textContent = 'Sending…'; note(b, '');
    fetch('/api/order/received', {
      method: 'POST',
      headers: { 'x-dealer-code': SESSION.code || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: b.dataset.received })
    }).then(function(r){
      if(!r.ok) throw new Error('failed');
      return load();
    }).catch(function(){
      b.disabled = false; b.textContent = 'Order completed';
      note(b, 'Could not send the confirmation — try again, or e-mail hello@lumiashades.com.');
    });
  });

  /* cancelling is only offered while an order is still awaiting review;
     two-step inline confirmation — the site never uses confirm()/alert() */
  function note(b, text){
    var n = b.parentNode.querySelector('.confnote');
    if(!text){ if(n) n.remove(); return; }
    if(!n){ n = document.createElement('div'); n.className = 'confnote'; b.parentNode.appendChild(n); }
    n.textContent = text;
  }
  function disarm(b){
    b.dataset.armed = ''; b.classList.remove('armed'); b.textContent = 'Cancel order'; note(b, '');
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('.orows .rbtn'); if(!b) return;
    if(b.dataset.armed !== '1'){
      b.dataset.armed = '1'; b.classList.add('armed'); b.textContent = 'Click again to confirm';
      note(b, 'This withdraws the order — it cannot be undone. Reorder from the Place order page if you change your mind.');
      setTimeout(function(){ if(b.dataset.armed === '1') disarm(b); }, 8000);
      return;
    }
    disarm(b); b.disabled = true; b.textContent = 'Cancelling…';
    fetch('/api/order/cancel', {
      method: 'POST',
      headers: { 'x-dealer-code': SESSION.code || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: b.dataset.cancel })
    }).then(function(r){
      if(!r.ok) throw new Error('failed');
      return load();
    }).catch(function(){
      b.disabled = false; b.textContent = 'Cancel order';
      note(b, 'Could not cancel — it may already be in production. Try again or e-mail hello@lumiashades.com.');
    });
  });

  function claimPaid(ref, claim){
    return fetch('/api/order/paid-claim', {
      method: 'POST',
      headers: { 'x-dealer-code': SESSION.code || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: ref, claim: claim })
    }).then(function(r){ if(!r.ok) throw new Error('failed'); });
  }
  /* customer claims (or takes back) a payment — LUMIA still confirms it */
  (document.getElementById('paydue') || document.createElement('div')).addEventListener('click', function(e){
    var all = e.target.closest('[data-payallclaim]');
    if(all){
      if(all.dataset.armed !== '1'){
        all.dataset.armed = '1'; all.textContent = 'Tap again to confirm';
        setTimeout(function(){ if(all.dataset.armed === '1'){ all.dataset.armed = ''; load(); } }, 6000);
        return;
      }
      all.disabled = true; all.textContent = '…';
      var refs = [].slice.call(document.querySelectorAll('#paydue [data-paidclaim]')).map(function(x){ return x.getAttribute('data-paidclaim'); });
      refs.reduce(function(p, ref){ return p.then(function(){ return claimPaid(ref, true); }); }, Promise.resolve())
        .then(load).catch(function(){ all.disabled = false; all.textContent = 'I’ve paid all'; });
      return;
    }
    var b = e.target.closest('[data-paidclaim],[data-paidcancel]'); if(!b) return;
    var claim = b.hasAttribute('data-paidclaim');
    var ref = b.getAttribute(claim ? 'data-paidclaim' : 'data-paidcancel');
    b.disabled = true; b.textContent = '…';
    claimPaid(ref, claim).then(load)
      .catch(function(){ b.disabled = false; b.textContent = claim ? 'I’ve paid' : 'Not yet'; });
  });

  function load(){
  return fetch('/api/orders', { headers: { 'x-dealer-code': SESSION.code || '' } })
    .then(function(r){
      if(r.status === 401){ LUMIA_TRADE.clearSession(); location.href = 'trade.html'; throw new Error('logged out'); }
      return r.json();
    })
    .then(function(d){ PAYINFO = d.payInfo || null; render(d.orders || []); })
    .catch(function(){ render([]); });
  }
  load();
})();
