/* LUMIA invoice — one printable invoice shared by the order page, the
   customer account and the admin panel (modelled on the TDC invoice layout). */
(function(){
  function esc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  var FRAC_NAMES = {0:'0/8',1:'1/8',2:'1/4',3:'3/8',4:'1/2',5:'5/8',6:'3/4',7:'7/8'};
  function fmtIn(v){
    var n = Math.floor(v), f = Math.round((v - n) * 8);
    if(f === 8){ n += 1; f = 0; }
    return n + ' ' + FRAC_NAMES[f];
  }
  function orderTotals(ls){
    var units = 0, total = 0, unknown = 0;
    (ls || []).forEach(function(l){
      units += l.qty;
      if(l.price == null){ unknown += 1; } else { total += l.price * l.qty; }
    });
    return { units: units, total: Math.round(total * 100) / 100, unknown: unknown };
  }
  function fedexUrl(n){ return 'https://www.fedex.com/fedextrack/?trknbr=' + encodeURIComponent(n); }
  /* invoice date = the Friday of the week (Mon–Sun) the FedEx number was entered */
  function invoiceDate(o){
    var d = new Date(o.trackingAt || o.shippedAt || o.at);
    var dow = (d.getDay() + 6) % 7;   /* Monday = 0 */
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 4);
  }
  function mdy(d){ d = new Date(d); return (d.getMonth()+1) + '.' + d.getDate() + '.' + d.getFullYear(); }
  /* o: the order · dl: the dealer's billing contact {company,address,phone}
     dealerName: fallback name · onBlocked: called if the pop-up is blocked */
  function open(o, dl, dealerName, onBlocked){
    dl = dl || {};
    dealerName = dealerName || o.dealer || '';
    var t = orderTotals(o.lines);
    var dts = mdy(o.at);                 /* order (PO) date */
    var ids = mdy(invoiceDate(o));       /* invoice date */
    var rows = (o.lines || []).map(function(l, i){
      var m = (l.spec || '').match(/(?:Fabric|Cell & opacity|Style): ([^·]+)/) ||
              (l.spec || '').match(/^[^:]+: ([^·]+)/);
      var desc = esc(l.product) + ' — ' + esc(l.desc || (m ? m[1].trim() : ''));
      return '<tr><td>' + (i+1) + '</td><td class="l">' + desc + '</td>' +
        '<td>' + (l.w == null ? '—' : fmtIn(l.w)) + '</td><td>' + (l.h == null ? '—' : fmtIn(l.h)) + '</td><td>' + esc(l.label || '') + '</td>' +
        '<td>' + l.qty + '</td><td class="r">' + (l.price == null ? 'TBD' : '$' + l.price.toFixed(2)) + '</td>' +
        '<td class="r">' + (l.price == null ? 'TBD' : '$' + (l.price * l.qty).toFixed(2)) + '</td></tr>';
    }).join('');
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Invoice ' + esc(o.ref) + '</title><style>' +
      'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:40px auto;max-width:760px;padding:0 20px}' +
      'h1{font-size:15px;margin:0}.right{text-align:right}' +
      '.top{display:flex;justify-content:space-between;margin-bottom:26px}' +
      '.inv{font-size:15px;font-weight:bold}' +
      '.blocks{display:flex;gap:60px;margin-bottom:26px}' +
      '.blocks h2{font-size:12px;margin:0 0 6px}' +
      '.blocks div p{margin:2px 0}' +
      '[contenteditable]{outline:1px dashed #bbb;min-width:120px;padding:1px 3px}' +
      'table{border-collapse:collapse;width:100%;font-size:11.5px}' +
      'th,td{border:1px solid #333;padding:6px 8px;text-align:center}' +
      'th{background:#d9d9d9}td.l{text-align:left}td.r{text-align:right}' +
      '.total{text-align:right;font-size:13px;font-weight:bold;margin:18px 0 30px}a{color:#0b57d0}' +
      '.foot{text-align:center;font-size:11px;margin-top:34px}' +
      '.printbtn{position:fixed;top:14px;right:14px;padding:10px 18px;font-size:12px;cursor:pointer}' +
      '@media print{.printbtn{display:none}[contenteditable]{outline:none}}' +
      '</style></head><body>' +
      '<button class="printbtn" onclick="print()">Print / save PDF</button>' +
      '<div class="top"><div><h1>TDC PRODUCTS LLC</h1>' +
      '<p style="margin:2px 0"><b>7907 Candle Lane, Houston, TX 77071 U.S.A.</b></p>' +
      '<p style="margin:2px 0"><b>hello@lumiashades.com</b></p></div>' +
      '<div class="right"><div class="inv">INVOICE</div>' +
      '<p style="margin:2px 0">No.: <span contenteditable>' + esc(o.ref.replace(/\D/g,'').slice(-6)) + '</span></p>' +
      '<p style="margin:2px 0">Date: ' + ids + '</p>' +
      '<p style="margin:2px 0">Order ref.: <b>' + esc(o.ref) + '</b></p>' +
      (o.tracking ? '<p style="margin:2px 0">FedEx tracking: <a href="' + fedexUrl(o.tracking) + '" target="_blank" rel="noopener"><b>' + esc(o.tracking) + '</b></a></p>' : '') +
      '</div></div>' +
      '<div class="blocks"><div><h2>BILLED TO:</h2>' +
      '<p><span contenteditable>' + esc(dl.company || dealerName || 'Customer') + '</span></p>' +
      '<p><span contenteditable>' + esc(dl.address || 'Street address, City, State ZIP') + '</span></p>' +
      '<p><span contenteditable>' + (dl.phone ? esc('Phone: ' + dl.phone) : 'Phone number') + '</span></p></div>' +
      '<div><h2>PO DETAILS:</h2>' +
      '<p>PO # ' + esc(o.ref) + '</p>' +
      '<p>PO Date ' + dts + '</p>' +
      (o.productNo ? '<p>Product No. ' + esc(o.productNo) + '</p>' : '') +
      '<p>Sidemark <span contenteditable>' + esc(o.customer || '') + '</span></p>' +
      '<p>Ship Ref. ' + (o.tracking ? 'FedEx <a href="' + fedexUrl(o.tracking) + '" target="_blank" rel="noopener">' + esc(o.tracking) + '</a>' : '<span contenteditable>&nbsp;</span>') + '</p>' +
      '<p>Ship Date ' + (o.shippedAt ? mdy(o.shippedAt) : '<span contenteditable>&nbsp;</span>') + '</p></div></div>' +
      '<table><thead><tr><th>#</th><th>Description</th><th>Width</th><th>Height</th><th>Room</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<p class="total">TOTAL&nbsp;&nbsp;$ ' + t.total.toFixed(2) + (t.unknown ? ' + ' + t.unknown + ' line(s) TBD' : '') + '</p>' +
      (o.notes ? '<p style="font-size:11px"><b>Notes:</b> ' + esc(o.notes) + '</p>' : '') +
      '<div class="foot">DIRECT ALL INQUIRIES TO hello@lumiashades.com<br><b>THANK YOU FOR YOUR COOPERATION</b></div>' +
      '</body></html>';
    var win = window.open('', '_blank');
    if(!win){ if(onBlocked) onBlocked('Allow pop-ups for this site to open the invoice.'); return; }
    win.document.write(html);
    win.document.close();
  }

  window.LUMIA_INVOICE = { open: open, fedexUrl: fedexUrl, invoiceDate: invoiceDate };
})();
