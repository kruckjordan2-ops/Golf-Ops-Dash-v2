// ─────────────────────────────────────────────────────────────────────────────
//  VGC Sales Dashboard Report Generator
//  Opens a print-ready report in a new window.
// ─────────────────────────────────────────────────────────────────────────────

function openSalesReport() {
  var filtered = getFilteredPLU();
  if (!filtered.length) { alert('No data to report \u2014 adjust your filters.'); return; }

  var totalRev = filtered.reduce(function(s, g) { return s + g.revenue; }, 0);
  var fnbR = 0, shopR = 0, golfR = 0;
  filtered.forEach(function(g) {
    if (g.category === 'fnb') fnbR += g.revenue;
    else if (g.category === 'shop') shopR += g.revenue;
    else if (g.category === 'golf') golfR += g.revenue;
  });
  var otherR = Math.max(0, totalRev - fnbR - shopR - golfR);

  // Filter summary
  var filterDesc = [];
  if (S.category !== 'all') filterDesc.push('Category: ' + (CAT_LABELS[S.category] || S.category));
  if (S.minRevenue > 0) filterDesc.push('Min revenue: ' + fmt(S.minRevenue));
  if (S.search) filterDesc.push('Search: ' + S.search);
  var filterText = filterDesc.length ? filterDesc.join(' | ') : 'All PLU Groups';

  // Top 15 PLU groups
  var top15 = filtered.slice(0, 15).map(function(g, i) {
    var catLabel = CAT_LABELS[g.category] || 'Other';
    return '<tr>' +
      '<td style="text-align:center">' + (i + 1) + '</td>' +
      '<td style="text-align:left;font-weight:600">' + escHtml(g.name) + '</td>' +
      '<td>' + catLabel + '</td>' +
      '<td style="font-weight:700">$' + g.revenue.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td>' + (TOTALS.revenue > 0 ? (g.revenue / TOTALS.revenue * 100).toFixed(1) + '%' : '\u2014') + '</td>' +
      '<td>' + g.memberCount + '</td>' +
    '</tr>';
  }).join('');

  // Top 10 members
  var sortedMembers = DATA.filter(function(m) { return m.total > 0; }).sort(function(a, b) { return b.total - a.total; }).slice(0, 10);
  var top10members = sortedMembers.map(function(m, i) {
    return '<tr>' +
      '<td style="text-align:center">' + (i + 1) + '</td>' +
      '<td style="text-align:left;font-weight:600">' + escHtml(m.name) + '</td>' +
      '<td style="font-weight:700">$' + m.total.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td style="color:#2563eb">$' + m.fnb.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td style="color:#7c3aed">$' + m.proshop.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td style="color:#059669">$' + m.golf.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
    '</tr>';
  }).join('');

  // Category sub-group sections
  function catSection(label, catKey, color) {
    var groups = filtered.filter(function(g) { return g.category === catKey; }).sort(function(a, b) { return b.revenue - a.revenue; });
    if (!groups.length) return '';
    var catTotal = groups.reduce(function(s, g) { return s + g.revenue; }, 0);
    return '<tr class="cat-hdr"><td style="text-align:left">' + label + ' \u2014 $' + catTotal.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td><td></td><td></td></tr>' +
      groups.map(function(g) {
        return '<tr><td style="text-align:left;padding-left:20px">' + escHtml(g.name) + '</td>' +
          '<td style="color:' + color + ';font-weight:600">$' + g.revenue.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
          '<td>' + g.memberCount + ' members</td></tr>';
      }).join('');
  }

  var now = new Date();
  var genDate = now.toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' });
  var genTime = now.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' });

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>VGC Sales Report</title><style>' +
    '@page{margin:15mm 12mm}' +
    'body{font-family:"Open Sans",Arial,sans-serif;font-size:11px;color:#1e2230;margin:0;padding:20px}' +
    '.no-print{cursor:pointer}' +
    '@media print{.no-print{display:none!important}}' +
    '.hdr{background:#2b335c;color:#fff;padding:16px 20px;border-radius:4px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}' +
    '.hdr h1{font-size:14px;margin:0}.hdr p{font-size:9px;opacity:.6;margin:2px 0 0;letter-spacing:1px;text-transform:uppercase}' +
    '.hdr-right{text-align:right;font-size:9px;opacity:.7}' +
    '.kpi-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px}' +
    '.kpi{background:#f2f3f5;border-radius:4px;padding:10px 12px;border-left:3px solid #2b335c}' +
    '.kpi.fnb{border-color:#2563eb}.kpi.shop{border-color:#7c3aed}.kpi.golf{border-color:#059669}' +
    '.kpi-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#6b6d7a}' +
    '.kpi-val{font-size:16px;font-weight:700;color:#2b335c;margin:2px 0}' +
    '.kpi-val.fnb{color:#2563eb}.kpi-val.shop{color:#7c3aed}.kpi-val.golf{color:#059669}' +
    '.section{margin-bottom:14px}' +
    '.section-title{background:#2b335c;color:#fff;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;border-radius:3px;margin-bottom:8px}' +
    'table{width:100%;border-collapse:collapse;font-size:10px}' +
    'th{background:#f0f1f5;color:#2b335c;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:.5px;padding:6px 8px;border-bottom:2px solid #2b335c;text-align:right}' +
    'th:first-child{text-align:left}' +
    'td{padding:5px 8px;border-bottom:1px solid #e4e5e6;text-align:right}' +
    'td:first-child{text-align:left}' +
    'tr:nth-child(even){background:#f8f9fa}' +
    '.cat-hdr td{background:#eef0f8;font-weight:700;color:#2b335c;font-size:10px}' +
    '.filter-note{background:#fef3e2;border:1px solid rgba(184,99,10,.2);border-radius:3px;padding:6px 10px;font-size:9px;color:#b8630a;margin-bottom:12px}' +
    '.footer{margin-top:20px;text-align:center;font-size:8px;color:#898b8d;border-top:1px solid #dddee3;padding-top:8px}' +
    '</style></head><body>' +
    '<button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;background:#2b335c;color:#fff;border:none;border-radius:3px;padding:8px 16px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;font-family:inherit">Print Report</button>' +

    '<div class="hdr"><div><h1>Sales Dashboard Report</h1><p>The Victoria Golf Club</p></div><div class="hdr-right">' + genDate + ' ' + genTime + '<br>SwiftPOS Data</div></div>' +

    (filterDesc.length ? '<div class="filter-note">Filtered: ' + filterText + '</div>' : '') +

    '<div class="kpi-strip">' +
      '<div class="kpi"><div class="kpi-lbl">Total Revenue</div><div class="kpi-val">$' + totalRev.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi fnb"><div class="kpi-lbl">F&amp;B</div><div class="kpi-val fnb">$' + fnbR.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi shop"><div class="kpi-lbl">Pro Shop</div><div class="kpi-val shop">$' + shopR.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi golf"><div class="kpi-lbl">Golf Fees</div><div class="kpi-val golf">$' + golfR.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi"><div class="kpi-lbl">PLU Groups</div><div class="kpi-val">' + filtered.length + '</div></div>' +
      '<div class="kpi"><div class="kpi-lbl">Active Members</div><div class="kpi-val">' + TOTALS.members + '</div></div>' +
    '</div>' +

    '<div class="section"><div class="section-title">Top 15 PLU Groups by Revenue</div>' +
    '<table><thead><tr><th style="text-align:center">#</th><th style="text-align:left">PLU Group</th><th>Category</th><th>Revenue</th><th>% of Total</th><th>Members</th></tr></thead><tbody>' +
    top15 + '</tbody></table></div>' +

    '<div class="section"><div class="section-title">Top 10 Members by Revenue</div>' +
    '<table><thead><tr><th style="text-align:center">#</th><th style="text-align:left">Member</th><th>Total</th><th>F&amp;B</th><th>Pro Shop</th><th>Golf</th></tr></thead><tbody>' +
    top10members + '</tbody></table></div>' +

    '<div class="section"><div class="section-title">Category Detail</div>' +
    '<table>' +
      catSection('F&B', 'fnb', '#2563eb') +
      catSection('Pro Shop', 'shop', '#7c3aed') +
      catSection('Golf Fees', 'golf', '#059669') +
    '</table></div>' +

    '<div class="footer">VGC Sales Dashboard Report \u2014 Generated ' + genDate + ' \u2014 ' + filtered.length + ' PLU groups \u00B7 $' + TOTALS.revenue.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' total revenue \u00B7 ' + TOTALS.members + ' active members</div>' +

    '</body></html>';

  var w = window.open('', '_blank');
  if (!w) { alert('Popup blocked — please allow popups for this site.'); return; }
  w.document.write(html);
  w.document.close();
}
