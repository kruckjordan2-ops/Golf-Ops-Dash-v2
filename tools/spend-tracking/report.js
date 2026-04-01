// ─────────────────────────────────────────────────────────────────────────────
//  VGC Member Spend Report Generator
//  Opens a print-ready report in a new window.
// ─────────────────────────────────────────────────────────────────────────────

function openSpendReport() {
  var filtered = getFiltered();
  if (!filtered.length) { alert('No data to report — adjust your filters.'); return; }

  var total = filtered.reduce(function(s, m) { return s + m.total; }, 0);
  var fnbT = filtered.reduce(function(s, m) { return s + m.fnb; }, 0);
  var shopT = filtered.reduce(function(s, m) { return s + m.proshop; }, 0);
  var golfT = filtered.reduce(function(s, m) { return s + m.golf; }, 0);
  var spending = filtered.filter(function(m) { return m.total > 0; });
  var avg = spending.length ? total / spending.length : 0;
  var dormant = filtered.filter(function(m) { return m.total === 0; }).length;
  var matchedCount = filtered.filter(function(m) { return m._matched; }).length;
  var sorted = filtered.slice().sort(function(a, b) { return b.total - a.total; });

  // Filter summary
  var yearLabel = (S.year !== 'all' && YEARS.length > 1) ? S.year : 'All Years';
  var filterDesc = [];
  if (S.year !== 'all' && YEARS.length > 1) filterDesc.push('Year: ' + S.year);
  if (S.segment !== 'all') filterDesc.push('Segment: ' + segLabel(S.segment));
  if (S.minSpend > 0) filterDesc.push('Min spend: $' + S.minSpend);
  if (S.categoryFocus) filterDesc.push('Category: ' + S.categoryFocus);
  if (S.matchFilter) filterDesc.push('DB: ' + S.matchFilter);
  if (S.search) filterDesc.push('Search: ' + S.search);
  var filterText = filterDesc.length ? filterDesc.join(' | ') : 'All Members';

  // Segment table rows
  var segRows = SEG_DEFS.map(function(sd) {
    var members = filtered.filter(sd.fn);
    var rev = members.reduce(function(s, m) { return s + m.total; }, 0);
    var avgS = members.length ? rev / members.length : 0;
    return '<tr><td style="text-align:left;font-weight:600">' + sd.label + '</td>' +
      '<td>' + members.length + '</td>' +
      '<td style="font-weight:700">$' + rev.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td>$' + avgS.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td>' + (total > 0 ? (rev / total * 100).toFixed(1) + '%' : '\u2014') + '</td></tr>';
  }).join('');

  // Top 20 rows
  var top20 = sorted.slice(0, 20).map(function(m, i) {
    return '<tr>' +
      '<td style="text-align:center">' + (i + 1) + '</td>' +
      '<td style="text-align:left;font-weight:600">' + m.name + '</td>' +
      '<td style="font-weight:700">$' + m.total.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td style="color:#2563eb">$' + m.fnb.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td style="color:#7c3aed">$' + m.proshop.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td style="color:#059669">$' + m.golf.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td>' +
      '<td>' + m.transactions + '</td>' +
    '</tr>';
  }).join('');

  // Category sub-totals
  function catSection(label, groups, color) {
    var subTotals = {};
    groups.forEach(function(g) {
      filtered.forEach(function(m) {
        if (m.groups && m.groups[g]) subTotals[g] = (subTotals[g] || 0) + m.groups[g];
      });
    });
    var sorted = Object.keys(subTotals).filter(function(g) { return subTotals[g] > 0; }).sort(function(a, b) { return subTotals[b] - subTotals[a]; });
    if (!sorted.length) return '';
    return sorted.map(function(g) {
      return '<tr><td style="text-align:left;padding-left:20px">' + g + '</td>' +
        '<td style="color:' + color + ';font-weight:600">$' + subTotals[g].toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td></tr>';
    }).join('');
  }

  var now = new Date();
  var genDate = now.toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' });
  var genTime = now.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' });

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>VGC Spend Report</title><style>' +
    '@page{margin:15mm 12mm}' +
    'body{font-family:"Open Sans",Arial,sans-serif;font-size:11px;color:#1e2230;margin:0;padding:20px}' +
    '.no-print{cursor:pointer}' +
    '@media print{.no-print{display:none!important}}' +
    '.hdr{background:#2b335c;color:#fff;padding:16px 20px;border-radius:4px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}' +
    '.hdr h1{font-size:14px;margin:0}.hdr p{font-size:9px;opacity:.6;margin:2px 0 0;letter-spacing:1px;text-transform:uppercase}' +
    '.hdr-right{text-align:right;font-size:9px;opacity:.7}' +
    '.kpi-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px}' +
    '.kpi{background:#f2f3f5;border-radius:4px;padding:10px 12px;border-left:3px solid #2b335c}' +
    '.kpi.fnb{border-color:#2563eb}.kpi.shop{border-color:#7c3aed}.kpi.golf{border-color:#059669}.kpi.red{border-color:#8b1a1a}' +
    '.kpi-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#6b6d7a}' +
    '.kpi-val{font-size:16px;font-weight:700;color:#2b335c;margin:2px 0}' +
    '.kpi-val.fnb{color:#2563eb}.kpi-val.shop{color:#7c3aed}.kpi-val.golf{color:#059669}.kpi-val.red{color:#8b1a1a}' +
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
    '.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
    '</style></head><body>' +
    '<button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;background:#2b335c;color:#fff;border:none;border-radius:3px;padding:8px 16px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;font-family:inherit">Print Report</button>' +

    '<div class="hdr"><div><h1>Member Spend Report — ' + yearLabel + '</h1><p>The Victoria Golf Club</p></div><div class="hdr-right">' + genDate + ' ' + genTime + '<br>SwiftPOS Data</div></div>' +

    (filterDesc.length ? '<div class="filter-note">Filtered: ' + filterText + '</div>' : '') +

    '<div class="kpi-strip">' +
      '<div class="kpi"><div class="kpi-lbl">Total Spend</div><div class="kpi-val">$' + total.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi fnb"><div class="kpi-lbl">F&amp;B</div><div class="kpi-val fnb">$' + fnbT.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi shop"><div class="kpi-lbl">Pro Shop</div><div class="kpi-val shop">$' + shopT.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi golf"><div class="kpi-lbl">Golf Fees</div><div class="kpi-val golf">$' + golfT.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi"><div class="kpi-lbl">Avg / Member</div><div class="kpi-val">$' + avg.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}) + '</div></div>' +
      '<div class="kpi red"><div class="kpi-lbl">Zero Spend</div><div class="kpi-val red">' + dormant + '</div></div>' +
    '</div>' +

    '<div class="section"><div class="section-title">Segment Breakdown</div>' +
    '<table><thead><tr><th style="text-align:left">Segment</th><th>Members</th><th>Total Spend</th><th>Avg Spend</th><th>% Revenue</th></tr></thead><tbody>' +
    segRows + '</tbody></table></div>' +

    '<div class="section"><div class="section-title">Top 20 Spenders</div>' +
    '<table><thead><tr><th style="text-align:center">#</th><th style="text-align:left">Member</th><th>Total</th><th>F&amp;B</th><th>Pro Shop</th><th>Golf</th><th>Trans</th></tr></thead><tbody>' +
    top20 + '</tbody></table></div>' +

    '<div class="section"><div class="section-title">Category Detail</div>' +
    '<table>' +
      '<tr class="cat-hdr"><td style="text-align:left">F&amp;B — $' + fnbT.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td><td></td></tr>' +
      catSection('F&B', FNB_GROUPS, '#2563eb') +
      '<tr class="cat-hdr"><td style="text-align:left">Pro Shop — $' + shopT.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td><td></td></tr>' +
      catSection('Pro Shop', SHOP_GROUPS, '#7c3aed') +
      '<tr class="cat-hdr"><td style="text-align:left">Golf Fees — $' + golfT.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</td><td></td></tr>' +
      catSection('Golf', GOLF_GROUPS, '#059669') +
    '</table></div>' +

    '<div class="footer">VGC Member Spend Report — Generated ' + genDate + ' — ' + filtered.length + ' members · $' + total.toLocaleString('en-AU', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' total spend — ' + matchedCount + ' matched to member DB</div>' +

    '</body></html>';

  var w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}
