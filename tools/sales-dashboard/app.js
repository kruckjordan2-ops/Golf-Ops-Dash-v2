// ─────────────────────────────────────────────────────────────────────────────
//  VGC Sales Dashboard — Application Logic
//  Product/category-centric view of PLU group revenue (yearly data)
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────────────────────────

var CAT_COLORS = {
  fnb:     'rgba(37,99,235,.8)',
  shop:    'rgba(124,58,237,.8)',
  proshop: 'rgba(124,58,237,.8)',
  golf:    'rgba(5,150,105,.8)',
  other:   'rgba(137,139,141,.5)'
};
var CAT_LABELS = { fnb: 'F&B', shop: 'Pro Shop', proshop: 'Pro Shop', golf: 'Golf', other: 'Other' };
var GRID_COLOR = '#e4e5e6';

// ── State ────────────────────────────────────────────────────────────────────

var S = {
  year: 'all',
  search: '',
  category: 'all',
  minRevenue: 0,
  sortCol: 'sales',
  sortDir: -1,
  activeTab: 'overview',
  deepDiveCategory: 'fnb',
  itemSortCol: 'sales',
  itemSortDir: -1
};

var YEARS = [];
var PLU = [];       // array of group objects with computed totals for selected year(s)
var ALL_ITEMS = []; // flat array of all items for Items tab
var charts = {};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
}

function fmtFull(n) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(n) {
  return n.toLocaleString('en-AU', { maximumFractionDigits: 0 });
}

function pct(part, whole) {
  return whole > 0 ? (part / whole * 100).toFixed(1) + '%' : '0%';
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Chart factory ────────────────────────────────────────────────────────────

function dc(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function mkChart(id, type, data, opts) {
  dc(id);
  var el = document.getElementById(id);
  if (!el) return null;
  var base = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { font: { size: 11, family: "'Open Sans',Arial,sans-serif" } } } }
  };
  var merged = Object.assign({}, base, opts || {});
  charts[id] = new Chart(el, { type: type, data: data, options: merged });
  return charts[id];
}

var SC_HOR = {
  indexAxis: 'y',
  scales: {
    x: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } },
    y: { grid: { display: false }, ticks: { font: { size: 10 } } }
  }
};

// ── Data init ────────────────────────────────────────────────────────────────

function sumYearly(yearly, field, years) {
  var total = 0;
  years.forEach(function(y) {
    if (yearly[y]) total += yearly[y][field] || 0;
  });
  return total;
}

function init() {
  if (typeof YEARLY_SALES === 'undefined') return;

  YEARS = YEARLY_SALES.years || [];
  buildPLU();
  buildYearButtons();

  document.getElementById('dataBadge').textContent = fmt(sumAllSales()) + ' \u00B7 ' + PLU.length + ' groups';
}

function buildYearButtons() {
  var html = '<button class="seg-btn active" onclick="setYear(\'all\',this)">All</button>';
  YEARS.forEach(function(y) {
    html += '<button class="seg-btn" onclick="setYear(\'' + y + '\',this)">' + y + '</button>';
  });
  document.getElementById('yearButtons').innerHTML = html;
}

function getSelectedYears() {
  return S.year === 'all' ? YEARS.slice() : [S.year];
}

function sumAllSales() {
  var years = getSelectedYears();
  var total = 0;
  years.forEach(function(y) {
    if (YEARLY_SALES.totals[y]) total += YEARLY_SALES.totals[y].sales || 0;
  });
  return total;
}

function buildPLU() {
  var years = getSelectedYears();
  var groups = YEARLY_SALES.groups;
  PLU = [];
  ALL_ITEMS = [];

  Object.keys(groups).forEach(function(gn) {
    var g = groups[gn];
    var sales = sumYearly(g.yearly, 'sales', years);
    var qty   = sumYearly(g.yearly, 'qty', years);
    var cost  = sumYearly(g.yearly, 'cost', years);
    var gp    = sumYearly(g.yearly, 'gp', years);
    var gpPct = sales > 0 ? gp / sales : 0;

    PLU.push({
      name: gn,
      category: g.category,
      sales: sales,
      qty: qty,
      cost: cost,
      gp: gp,
      gpPct: gpPct,
      yearly: g.yearly,
      items: g.items || []
    });

    // Build flat items list
    (g.items || []).forEach(function(item) {
      var iSales = sumYearly(item.yearly, 'sales', years);
      var iQty   = sumYearly(item.yearly, 'qty', years);
      if (iSales > 0 || iQty > 0) {
        ALL_ITEMS.push({
          plu: item.plu,
          desc: item.desc,
          group: gn,
          category: g.category,
          sales: iSales,
          qty: iQty,
          yearly: item.yearly
        });
      }
    });
  });

  PLU.sort(function(a, b) { return b.sales - a.sales; });
  ALL_ITEMS.sort(function(a, b) { return b.sales - a.sales; });
}

// ── Filtering ────────────────────────────────────────────────────────────────

function getFilteredPLU() {
  var out = PLU.filter(function(g) {
    if (S.search && g.name.toLowerCase().indexOf(S.search.toLowerCase()) === -1) return false;
    if (S.category !== 'all' && g.category !== S.category) return false;
    if (g.sales < S.minRevenue) return false;
    return true;
  });
  out.sort(function(a, b) {
    var col = S.sortCol;
    var av = col === 'name' ? a.name : (a[col] || 0);
    var bv = col === 'name' ? b.name : (b[col] || 0);
    if (typeof av === 'string') return S.sortDir * av.localeCompare(bv);
    return S.sortDir * (av - bv);
  });
  return out;
}

function getFilteredItems() {
  var out = ALL_ITEMS.filter(function(item) {
    if (S.search && item.desc.toLowerCase().indexOf(S.search.toLowerCase()) === -1 &&
        item.group.toLowerCase().indexOf(S.search.toLowerCase()) === -1) return false;
    if (S.category !== 'all' && item.category !== S.category) return false;
    return true;
  });
  out.sort(function(a, b) {
    var col = S.itemSortCol;
    var av = col === 'desc' || col === 'plu' ? (a[col] || '') : (a[col] || 0);
    var bv = col === 'desc' || col === 'plu' ? (b[col] || '') : (b[col] || 0);
    if (typeof av === 'string') return S.itemSortDir * av.localeCompare(bv);
    return S.itemSortDir * (av - bv);
  });
  return out;
}

// ── Sidebar controls ─────────────────────────────────────────────────────────

function setYear(v, btn) {
  S.year = v;
  var section = btn.closest('.sidebar-section');
  section.querySelectorAll('.seg-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  buildPLU();
  document.getElementById('dataBadge').textContent = fmt(sumAllSales()) + ' \u00B7 ' + PLU.length + ' groups';
  renderAll();
}

function setSearch(v) { S.search = v; renderAll(); }

function setCategory(v, btn) {
  S.category = v;
  var section = btn.closest('.sidebar-section');
  section.querySelectorAll('.seg-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  renderAll();
}

function setMinRevenue(v) { S.minRevenue = parseFloat(v) || 0; renderAll(); }

function resetFilters() {
  S.search = ''; S.category = 'all'; S.minRevenue = 0;
  S.sortCol = 'sales'; S.sortDir = -1;
  S.itemSortCol = 'sales'; S.itemSortDir = -1;
  S.year = 'all';

  document.getElementById('sSearch').value = '';
  document.getElementById('sMinRev').value = '0';

  document.querySelectorAll('.sidebar .seg-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.sidebar .seg-btn').forEach(function(b) {
    if (b.textContent === 'All') b.classList.add('active');
  });

  document.querySelectorAll('#pluTable th, #itemTable th').forEach(function(t) { t.classList.remove('asc', 'desc'); });

  buildPLU();
  document.getElementById('dataBadge').textContent = fmt(sumAllSales()) + ' \u00B7 ' + PLU.length + ' groups';
  renderAll();
}

function updateFilterSummary() {
  var filters = [];
  if (S.year !== 'all') filters.push(S.year);
  if (S.search) filters.push('Search');
  if (S.category !== 'all') filters.push(CAT_LABELS[S.category] || S.category);
  if (S.minRevenue > 0) filters.push(fmt(S.minRevenue) + '+');
  document.getElementById('filterBadge').textContent = filters.length ? filters.join(' \u00B7 ') : 'No Filters';
}

// ── Tab navigation ───────────────────────────────────────────────────────────

function showTab(id, el) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('pg-' + id).classList.add('active');
  S.activeTab = id;
  document.getElementById('activeTabBadge').textContent =
    { overview: 'Overview', trends: 'Trends', plu: 'PLU Groups', deepdive: 'Deep-Dive', items: 'Items' }[id];
  renderAll();
}

// ── Sort ─────────────────────────────────────────────────────────────────────

function sortBy(col, th) {
  S.sortDir = S.sortCol === col ? S.sortDir * -1 : -1;
  S.sortCol = col;
  document.querySelectorAll('#pluTable th').forEach(function(t) { t.classList.remove('asc', 'desc'); });
  if (th) th.classList.add(S.sortDir === 1 ? 'asc' : 'desc');
  renderAll();
}

function sortItems(col, th) {
  S.itemSortDir = S.itemSortCol === col ? S.itemSortDir * -1 : -1;
  S.itemSortCol = col;
  document.querySelectorAll('#itemTable th').forEach(function(t) { t.classList.remove('asc', 'desc'); });
  if (th) th.classList.add(S.itemSortDir === 1 ? 'asc' : 'desc');
  renderAll();
}

// ── PAGE: OVERVIEW ──────────────────────────────────────────────────────────

function getCatTotal(cat, field) {
  var years = getSelectedYears();
  var total = 0;
  years.forEach(function(y) {
    if (YEARLY_SALES.categories[cat] && YEARLY_SALES.categories[cat][y]) {
      total += YEARLY_SALES.categories[cat][y][field] || 0;
    }
  });
  return total;
}

function renderOverview() {
  var totalSales = sumAllSales();
  var years = getSelectedYears();
  var totalGP = 0, totalQty = 0, totalCost = 0;
  years.forEach(function(y) {
    if (YEARLY_SALES.totals[y]) {
      totalGP += YEARLY_SALES.totals[y].gp || 0;
      totalQty += YEARLY_SALES.totals[y].qty || 0;
      totalCost += YEARLY_SALES.totals[y].cost || 0;
    }
  });
  var gpPct = totalSales > 0 ? (totalGP / totalSales * 100).toFixed(1) + '%' : '0%';

  var fnbS = getCatTotal('fnb', 'sales'), shopS = getCatTotal('proshop', 'sales'), golfS = getCatTotal('golf', 'sales');
  var otherS = getCatTotal('other', 'sales');

  document.getElementById('overviewKPIs').innerHTML =
    '<div class="kpi"><div class="kpi-lbl">Total Revenue</div><div class="kpi-val">' + fmt(totalSales) + '</div><div class="kpi-sub">' + PLU.length + ' PLU groups</div></div>' +
    '<div class="kpi fnb"><div class="kpi-lbl">F&amp;B</div><div class="kpi-val fnb-c">' + fmt(fnbS) + '</div><div class="kpi-sub">' + pct(fnbS, totalSales) + '</div></div>' +
    '<div class="kpi shop"><div class="kpi-lbl">Pro Shop</div><div class="kpi-val shop-c">' + fmt(shopS) + '</div><div class="kpi-sub">' + pct(shopS, totalSales) + '</div></div>' +
    '<div class="kpi golf"><div class="kpi-lbl">Golf Fees</div><div class="kpi-val golf-c">' + fmt(golfS) + '</div><div class="kpi-sub">' + pct(golfS, totalSales) + '</div></div>' +
    '<div class="kpi green"><div class="kpi-lbl">Gross Profit</div><div class="kpi-val">' + fmt(totalGP) + '</div><div class="kpi-sub">' + gpPct + ' margin</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Items Sold</div><div class="kpi-val">' + fmtQty(totalQty) + '</div><div class="kpi-sub">total quantity</div></div>';

  // Top 10 horizontal bar
  var top10 = PLU.filter(function(g) { return g.sales > 0; }).slice(0, 10);
  mkChart('top10Chart', 'bar', {
    labels: top10.map(function(g) { return g.name; }),
    datasets: [{
      label: 'Revenue',
      data: top10.map(function(g) { return g.sales; }),
      backgroundColor: top10.map(function(g) { return CAT_COLORS[g.category] || CAT_COLORS.other; }),
      borderRadius: 3
    }]
  }, Object.assign({ plugins: { legend: { display: false } } }, SC_HOR));

  // Category doughnut
  mkChart('catDoughnut', 'doughnut', {
    labels: ['F&B', 'Pro Shop', 'Golf Fees', 'Other'],
    datasets: [{ data: [fnbS, shopS, golfS, otherS], backgroundColor: [CAT_COLORS.fnb, CAT_COLORS.shop, CAT_COLORS.golf, CAT_COLORS.other], borderWidth: 0 }]
  }, { plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } });

  // Category comparison bar
  mkChart('catBarChart', 'bar', {
    labels: ['F&B', 'Pro Shop', 'Golf Fees', 'Other'],
    datasets: [{
      label: 'Revenue',
      data: [fnbS, shopS, golfS, otherS],
      backgroundColor: [CAT_COLORS.fnb, CAT_COLORS.shop, CAT_COLORS.golf, CAT_COLORS.other],
      borderRadius: 3
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });

  // GP by category
  var fnbGP = getCatTotal('fnb', 'gp'), shopGP = getCatTotal('proshop', 'gp'), golfGP = getCatTotal('golf', 'gp');
  mkChart('gpChart', 'bar', {
    labels: ['F&B', 'Pro Shop', 'Golf Fees'],
    datasets: [
      { label: 'Revenue', data: [fnbS, shopS, golfS], backgroundColor: [CAT_COLORS.fnb, CAT_COLORS.shop, CAT_COLORS.golf], borderRadius: 3 },
      { label: 'Gross Profit', data: [fnbGP, shopGP, golfGP], backgroundColor: ['rgba(37,99,235,.35)', 'rgba(124,58,237,.35)', 'rgba(5,150,105,.35)'], borderRadius: 3 }
    ]
  }, {
    plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });

  // Insights
  var topGroup = PLU[0];
  document.getElementById('overviewInsights').innerHTML =
    '<div class="ins"><strong>Top PLU Group</strong>' + (topGroup ? escHtml(topGroup.name) + ' \u2014 ' + fmtFull(topGroup.sales) + ' (' + fmtQty(topGroup.qty) + ' items sold)' : 'N/A') + '</div>' +
    '<div class="ins fnb-ins"><strong>F&amp;B Revenue</strong>' + fmt(fnbS) + ' \u2014 ' + pct(fnbS, totalSales) + ' of total revenue</div>' +
    '<div class="ins golf-ins"><strong>Overall GP Margin</strong>' + gpPct + ' \u2014 ' + fmt(totalGP) + ' gross profit on ' + fmt(totalSales) + ' revenue</div>';
}

// ── PAGE: TRENDS ────────────────────────────────────────────────────────────

function renderTrends() {
  var years = YEARS;

  // Total revenue by year
  mkChart('trendTotalChart', 'bar', {
    labels: years,
    datasets: [{
      label: 'Revenue',
      data: years.map(function(y) { return YEARLY_SALES.totals[y] ? YEARLY_SALES.totals[y].sales : 0; }),
      backgroundColor: 'rgba(43,51,92,.75)',
      borderRadius: 3
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });

  // Category revenue by year (stacked)
  mkChart('trendCatChart', 'bar', {
    labels: years,
    datasets: [
      { label: 'F&B', data: years.map(function(y) { return YEARLY_SALES.categories.fnb && YEARLY_SALES.categories.fnb[y] ? YEARLY_SALES.categories.fnb[y].sales : 0; }), backgroundColor: CAT_COLORS.fnb, borderRadius: 2 },
      { label: 'Pro Shop', data: years.map(function(y) { return YEARLY_SALES.categories.proshop && YEARLY_SALES.categories.proshop[y] ? YEARLY_SALES.categories.proshop[y].sales : 0; }), backgroundColor: CAT_COLORS.shop, borderRadius: 2 },
      { label: 'Golf', data: years.map(function(y) { return YEARLY_SALES.categories.golf && YEARLY_SALES.categories.golf[y] ? YEARLY_SALES.categories.golf[y].sales : 0; }), backgroundColor: CAT_COLORS.golf, borderRadius: 2 },
      { label: 'Other', data: years.map(function(y) { return YEARLY_SALES.categories.other && YEARLY_SALES.categories.other[y] ? YEARLY_SALES.categories.other[y].sales : 0; }), backgroundColor: CAT_COLORS.other, borderRadius: 2 }
    ]
  }, {
    plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { stacked: true, grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });

  // GP by year
  mkChart('trendGPChart', 'bar', {
    labels: years,
    datasets: [
      { label: 'Revenue', data: years.map(function(y) { return YEARLY_SALES.totals[y] ? YEARLY_SALES.totals[y].sales : 0; }), backgroundColor: 'rgba(43,51,92,.3)', borderRadius: 3 },
      { label: 'Gross Profit', data: years.map(function(y) { return YEARLY_SALES.totals[y] ? YEARLY_SALES.totals[y].gp : 0; }), backgroundColor: 'rgba(26,122,62,.7)', borderRadius: 3 }
    ]
  }, {
    plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });

  // Qty by year
  mkChart('trendQtyChart', 'bar', {
    labels: years,
    datasets: [{
      label: 'Qty Sold',
      data: years.map(function(y) { return YEARLY_SALES.totals[y] ? YEARLY_SALES.totals[y].qty : 0; }),
      backgroundColor: 'rgba(184,99,10,.7)',
      borderRadius: 3
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 } } }
    }
  });

  // Top movers table (compare latest full year vs prior)
  var fullYears = years.filter(function(y) { return y.indexOf('Q') === -1; });
  if (fullYears.length >= 2) {
    var latestYear = fullYears[fullYears.length - 1];
    var priorYear = fullYears[fullYears.length - 2];
    var movers = [];

    Object.keys(YEARLY_SALES.groups).forEach(function(gn) {
      var g = YEARLY_SALES.groups[gn];
      var latest = g.yearly[latestYear] ? g.yearly[latestYear].sales : 0;
      var prior = g.yearly[priorYear] ? g.yearly[priorYear].sales : 0;
      var change = latest - prior;
      var changePct = prior > 0 ? change / prior * 100 : (latest > 0 ? 100 : 0);
      if (latest > 0 || prior > 0) {
        movers.push({ name: gn, category: g.category, prior: prior, latest: latest, change: change, changePct: changePct });
      }
    });

    movers.sort(function(a, b) { return Math.abs(b.change) - Math.abs(a.change); });

    document.getElementById('moversBody').innerHTML = movers.slice(0, 15).map(function(m) {
      var cls = m.change > 0 ? 'color:var(--green)' : (m.change < 0 ? 'color:var(--red)' : '');
      var arrow = m.change > 0 ? '\u25B2' : (m.change < 0 ? '\u25BC' : '\u2014');
      return '<tr>' +
        '<td style="text-align:left;font-weight:600">' + escHtml(m.name) + '</td>' +
        '<td><span class="cat-badge ' + m.category + '">' + (CAT_LABELS[m.category] || 'Other') + '</span></td>' +
        '<td>' + fmtFull(m.prior) + '</td>' +
        '<td style="font-weight:700">' + fmtFull(m.latest) + '</td>' +
        '<td style="font-weight:700;' + cls + '">' + arrow + ' ' + fmtFull(Math.abs(m.change)) + '</td>' +
        '<td style="font-weight:700;' + cls + '">' + (m.changePct > 0 ? '+' : '') + m.changePct.toFixed(1) + '%</td>' +
      '</tr>';
    }).join('');
  } else {
    document.getElementById('moversBody').innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted)">Need at least 2 full years for comparison</td></tr>';
  }
}

// ── PAGE: PLU GROUPS ────────────────────────────────────────────────────────

function renderPLUTable() {
  var filtered = getFilteredPLU();
  document.getElementById('pluCount').textContent = filtered.length + ' PLU groups';

  if (!filtered.length) {
    document.getElementById('pluBody').innerHTML =
      '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">No PLU groups match your filters.</td></tr>';
    return;
  }

  document.getElementById('pluBody').innerHTML = filtered.map(function(g, i) {
    return '<tr' + (i < 3 ? ' class="top-row"' : '') + '>' +
      '<td style="text-align:center;color:var(--muted);font-size:.65rem">' + (i + 1) + '</td>' +
      '<td style="font-weight:600">' + escHtml(g.name) + '</td>' +
      '<td><span class="cat-badge ' + g.category + '">' + (CAT_LABELS[g.category] || 'Other') + '</span></td>' +
      '<td style="font-weight:700">' + fmtFull(g.sales) + '</td>' +
      '<td style="text-align:center">' + fmtQty(g.qty) + '</td>' +
      '<td>' + fmtFull(g.cost) + '</td>' +
      '<td style="color:var(--green);font-weight:600">' + fmtFull(g.gp) + '</td>' +
      '<td>' + (g.gpPct * 100).toFixed(1) + '%</td>' +
      '<td><button class="view-btn" onclick="showPluDetail(' + i + ')">View</button></td>' +
    '</tr>';
  }).join('');
}

// ── PAGE: CATEGORY DEEP-DIVE ────────────────────────────────────────────────

function setDeepDive(cat) {
  S.deepDiveCategory = cat;
  document.getElementById('ddFnb').className = 'cat-sel-btn' + (cat === 'fnb' ? ' active-fnb' : '');
  document.getElementById('ddShop').className = 'cat-sel-btn' + (cat === 'proshop' ? ' active-shop' : '');
  document.getElementById('ddGolf').className = 'cat-sel-btn' + (cat === 'golf' ? ' active-golf' : '');
  renderDeepDive();
}

function renderDeepDive() {
  var cat = S.deepDiveCategory;
  var catLabel = CAT_LABELS[cat];
  var color = CAT_COLORS[cat];
  var catGroups = PLU.filter(function(g) { return g.category === cat; }).sort(function(a, b) { return b.sales - a.sales; });
  var catSales = catGroups.reduce(function(s, g) { return s + g.sales; }, 0);
  var catGP = catGroups.reduce(function(s, g) { return s + g.gp; }, 0);
  var catQty = catGroups.reduce(function(s, g) { return s + g.qty; }, 0);
  var activeGroups = catGroups.filter(function(g) { return g.sales > 0; }).length;

  document.getElementById('ddCatLabel').innerHTML = 'in ' + catLabel;

  document.getElementById('ddKPIs').innerHTML =
    '<div class="kpi" style="border-left-color:' + color + '"><div class="kpi-lbl">' + catLabel + ' Revenue</div><div class="kpi-val">' + fmt(catSales) + '</div><div class="kpi-sub">' + pct(catSales, sumAllSales()) + ' of total</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Active Groups</div><div class="kpi-val">' + activeGroups + '</div><div class="kpi-sub">of ' + catGroups.length + ' total</div></div>' +
    '<div class="kpi green"><div class="kpi-lbl">Gross Profit</div><div class="kpi-val">' + fmt(catGP) + '</div><div class="kpi-sub">' + (catSales > 0 ? (catGP / catSales * 100).toFixed(1) + '% margin' : '0%') + '</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Items Sold</div><div class="kpi-val">' + fmtQty(catQty) + '</div><div class="kpi-sub">total quantity</div></div>';

  var activeSubGroups = catGroups.filter(function(g) { return g.sales > 0; });
  mkChart('subGroupChart', 'bar', {
    labels: activeSubGroups.map(function(g) { return g.name; }),
    datasets: [{ label: 'Revenue', data: activeSubGroups.map(function(g) { return g.sales; }), backgroundColor: color, borderRadius: 3 }]
  }, Object.assign({ plugins: { legend: { display: false } } }, SC_HOR));

  mkChart('proportionChart', 'doughnut', {
    labels: activeSubGroups.map(function(g) { return g.name; }),
    datasets: [{
      data: activeSubGroups.map(function(g) { return g.sales; }),
      backgroundColor: activeSubGroups.map(function(_, i) {
        var opacity = 0.9 - (i * 0.04);
        if (opacity < 0.2) opacity = 0.2;
        if (cat === 'fnb') return 'rgba(37,99,235,' + opacity + ')';
        if (cat === 'shop') return 'rgba(124,58,237,' + opacity + ')';
        return 'rgba(5,150,105,' + opacity + ')';
      }),
      borderWidth: 0
    }]
  }, {
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + fmtFull(ctx.parsed) + ' (' + pct(ctx.parsed, catSales) + ')'; } } }
    }
  });

  // Top items in category
  var catItems = ALL_ITEMS.filter(function(item) { return item.category === cat; })
    .sort(function(a, b) { return b.sales - a.sales; })
    .slice(0, 20);

  document.getElementById('ddItemBody').innerHTML = catItems.map(function(item, i) {
    return '<tr' + (i < 3 ? ' class="top-row"' : '') + '>' +
      '<td style="text-align:center;color:var(--muted);font-size:.65rem">' + (i + 1) + '</td>' +
      '<td style="font-weight:600">' + escHtml(item.desc) + '</td>' +
      '<td style="color:var(--muted);font-size:.7rem">' + escHtml(item.group) + '</td>' +
      '<td style="font-weight:700;color:' + color + '">' + fmtFull(item.sales) + '</td>' +
      '<td style="text-align:center">' + fmtQty(item.qty) + '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No items</td></tr>';
}

// ── PAGE: ITEMS ─────────────────────────────────────────────────────────────

function renderItems() {
  var filtered = getFilteredItems();
  document.getElementById('itemCount').textContent = filtered.length + ' items' + (filtered.length > 200 ? ' (showing top 200)' : '');

  var shown = filtered.slice(0, 200);
  document.getElementById('itemBody').innerHTML = shown.map(function(item, i) {
    return '<tr' + (i < 3 ? ' class="top-row"' : '') + '>' +
      '<td style="text-align:center;color:var(--muted);font-size:.65rem">' + (i + 1) + '</td>' +
      '<td style="font-weight:600">' + escHtml(item.desc) + '</td>' +
      '<td style="color:var(--muted);font-size:.7rem">' + item.plu + '</td>' +
      '<td style="font-size:.7rem">' + escHtml(item.group) + '</td>' +
      '<td><span class="cat-badge ' + item.category + '">' + (CAT_LABELS[item.category] || 'Other') + '</span></td>' +
      '<td style="font-weight:700">' + fmtFull(item.sales) + '</td>' +
      '<td style="text-align:center">' + fmtQty(item.qty) + '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">No items match your filters.</td></tr>';
}

// ── PLU DETAIL MODAL ────────────────────────────────────────────────────────

function showPluDetail(idx) {
  var filtered = getFilteredPLU();
  var g = filtered[idx];
  if (!g) return;

  var catLabel = CAT_LABELS[g.category] || 'Other';
  var color = CAT_COLORS[g.category] || CAT_COLORS.other;

  document.getElementById('modalName').innerHTML = escHtml(g.name) + ' <span class="cat-badge ' + g.category + '" style="margin-left:8px;font-size:.6rem">' + catLabel + '</span>';

  // Yearly breakdown
  var yearlyHtml = '';
  YEARS.forEach(function(y) {
    var yd = g.yearly[y];
    if (yd) {
      yearlyHtml += '<div class="modal-row"><span class="modal-row-lbl">' + y + '</span><span class="modal-row-val">' + fmtFull(yd.sales) + ' <span style="color:var(--muted);font-weight:400;font-size:.7rem">(' + fmtQty(yd.qty) + ' items)</span></span></div>';
    }
  });

  // Top items
  var topItems = g.items.slice(0, 15);
  var itemsHtml = topItems.map(function(item, i) {
    var iSales = sumYearly(item.yearly, 'sales', getSelectedYears());
    var iQty = sumYearly(item.yearly, 'qty', getSelectedYears());
    if (iSales <= 0 && iQty <= 0) return '';
    return '<div class="modal-row">' +
      '<span class="modal-row-lbl">' + (i + 1) + '. ' + escHtml(item.desc) + ' <span style="color:var(--silver);font-size:.65rem">PLU ' + item.plu + '</span></span>' +
      '<span class="modal-row-val" style="color:' + color + '">' + fmtFull(iSales) + ' <span style="color:var(--muted);font-weight:400;font-size:.7rem">\u00D7' + fmtQty(iQty) + '</span></span>' +
    '</div>';
  }).filter(function(h) { return h; }).join('');

  if (g.items.length > 15) {
    itemsHtml += '<div style="font-size:.65rem;color:var(--muted);padding-top:8px;text-align:center">+' + (g.items.length - 15) + ' more items</div>';
  }

  document.getElementById('modalBody').innerHTML =
    '<div class="modal-stat-grid">' +
      '<div class="modal-stat"><div class="modal-stat-val">' + fmtFull(g.sales) + '</div><div class="modal-stat-lbl">Revenue</div></div>' +
      '<div class="modal-stat"><div class="modal-stat-val">' + fmtQty(g.qty) + '</div><div class="modal-stat-lbl">Qty Sold</div></div>' +
      '<div class="modal-stat"><div class="modal-stat-val">' + fmtFull(g.gp) + '</div><div class="modal-stat-lbl">Gross Profit</div></div>' +
      '<div class="modal-stat"><div class="modal-stat-val">' + (g.gpPct * 100).toFixed(1) + '%</div><div class="modal-stat-lbl">GP Margin</div></div>' +
    '</div>' +
    '<div style="margin-bottom:16px"><canvas id="modalYearChart"></canvas></div>' +
    '<div class="modal-section-title">Revenue by Year</div>' +
    yearlyHtml +
    '<div class="modal-section-title">Top Items</div>' +
    itemsHtml;

  document.getElementById('detailModal').classList.remove('hidden');

  // Mini bar chart of yearly revenue
  setTimeout(function() {
    var ctx = document.getElementById('modalYearChart');
    if (ctx) {
      var yrs = YEARS.filter(function(y) { return g.yearly[y] && g.yearly[y].sales > 0; });
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: yrs,
          datasets: [{
            label: 'Revenue',
            data: yrs.map(function(y) { return g.yearly[y].sales; }),
            backgroundColor: color,
            borderRadius: 3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 9 } } },
            y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 9 }, callback: function(v) { return fmt(v); } } }
          }
        }
      });
    }
  }, 50);
}

// ── renderAll ────────────────────────────────────────────────────────────────

function renderAll() {
  updateFilterSummary();
  var tab = S.activeTab;
  if (tab === 'overview') { renderOverview(); }
  if (tab === 'trends') { renderTrends(); }
  if (tab === 'plu') { renderPLUTable(); }
  if (tab === 'deepdive') { renderDeepDive(); }
  if (tab === 'items') { renderItems(); }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

Chart.defaults.font.family = "'Open Sans',Arial,sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = '#6b6d7a';

document.addEventListener('DOMContentLoaded', function() {
  init();
  renderAll();

  document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});
