// ─────────────────────────────────────────────────────────────────────────────
//  VGC Sales Dashboard — Application Logic
//  Product/category-centric view of PLU group revenue
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────────────────────────

var FNB_GROUPS = [
  'BULK BEER','PACK BEER','GIN','RUM','WHISKEY','VODKA/OUZO/TEQUILA',
  'LIQUEURS','MISC SPIRITS','BRANDY/COGNAC','APERTIFS','CHAMPAGNE/SPARKLING',
  'WHITE WINE','RED WINE','DESSERT WINE','FORTIFIED WINE','CELLAR LIST',
  'SOFT DRINK','COFFEE/TEA','MISC F&B','SANDWICHES','CASUAL SERVERY',
  'MISC FOOD','GOLF DRINKS','GOLF SNACKS','CONFECTIONARY','BREAKFAST',
  'LUNCH','ENTRÉE','DESSERT','SYSTEM'
];
var SHOP_GROUPS = [
  'GOLF BALLS','GOLF GLOVES','GOLF TEES','ACCESSORIES','GOLF CLUBS',
  'REPAIRS','HEADWEAR','OUTERWEAR','MENS SHIRTS','LADIES SHIRTS',
  'PANTS SHORTS','SHOES','SOCKS','BAGS BUGGIES','PANTS SKIRT SKORT',
  'Australian Open'
];
var GOLF_GROUPS = [
  'COMP FEES','GREEN FEES','Range Balls','LESSONS','CART HIRE',
  'Club Hire','Intl/Interstate GFees','Reciprocal Golfers','Paul Lessons'
];

var CAT_COLORS = {
  fnb:   'rgba(37,99,235,.8)',
  shop:  'rgba(124,58,237,.8)',
  golf:  'rgba(5,150,105,.8)',
  other: 'rgba(137,139,141,.5)'
};
var GRID_COLOR = '#e4e5e6';

// Build group-to-category map
var GROUP_TO_CAT = {};
FNB_GROUPS.forEach(function(g) { GROUP_TO_CAT[g] = 'fnb'; });
SHOP_GROUPS.forEach(function(g) { GROUP_TO_CAT[g] = 'shop'; });
GOLF_GROUPS.forEach(function(g) { GROUP_TO_CAT[g] = 'golf'; });

var CAT_LABELS = { fnb: 'F&B', shop: 'Pro Shop', golf: 'Golf', other: 'Other' };
var CAT_GROUPS = { fnb: FNB_GROUPS, shop: SHOP_GROUPS, golf: GOLF_GROUPS };

// ── State ────────────────────────────────────────────────────────────────────

var S = {
  search: '',
  category: 'all',
  minRevenue: 0,
  sortCol: 'revenue',
  sortDir: -1,
  activeTab: 'overview',
  deepDiveCategory: 'fnb'
};

var DATA = [];
var PLU = [];
var CAT_SUMMARY = {};
var TOTALS = { revenue: 0, transactions: 0, members: 0 };
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

function pct(part, whole) {
  return whole > 0 ? (part / whole * 100).toFixed(1) + '%' : '0%';
}

function getCatClass(cat) {
  return cat || 'other';
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

var SC = {
  scales: {
    x: { grid: { color: GRID_COLOR }, ticks: { font: { size: 10 } } },
    y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 } } }
  }
};
var SC_HOR = {
  indexAxis: 'y',
  scales: {
    x: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } },
    y: { grid: { display: false }, ticks: { font: { size: 10 } } }
  }
};

// ── Data init ────────────────────────────────────────────────────────────────

function init() {
  DATA = typeof SALES_DATA !== 'undefined' ? SALES_DATA.slice() : [];

  // Build PLU group index by inverting member data
  var pluMap = {};

  DATA.forEach(function(member) {
    if (!member.groups) return;
    Object.keys(member.groups).forEach(function(groupName) {
      var amount = member.groups[groupName];
      if (!amount || amount <= 0) return;

      if (!pluMap[groupName]) {
        pluMap[groupName] = {
          name: groupName,
          category: GROUP_TO_CAT[groupName] || 'other',
          revenue: 0,
          memberSet: {},
          members: []
        };
      }
      var g = pluMap[groupName];
      g.revenue += amount;
      if (!g.memberSet[member.id]) {
        g.memberSet[member.id] = true;
        g.members.push({ id: member.id, name: member.name, amount: amount, total: member.total });
      } else {
        // Update amount for existing member (shouldn't happen with current data, but safe)
        for (var i = 0; i < g.members.length; i++) {
          if (g.members[i].id === member.id) { g.members[i].amount += amount; break; }
        }
      }
    });
  });

  // Convert to array, compute derived fields
  PLU = Object.keys(pluMap).map(function(k) {
    var g = pluMap[k];
    g.memberCount = Object.keys(g.memberSet).length;
    g.avgPerMember = g.memberCount > 0 ? g.revenue / g.memberCount : 0;
    // Sort members by amount descending
    g.members.sort(function(a, b) { return b.amount - a.amount; });
    delete g.memberSet;
    return g;
  });

  PLU.sort(function(a, b) { return b.revenue - a.revenue; });

  // Compute category summaries
  var cats = ['fnb', 'shop', 'golf', 'other'];
  cats.forEach(function(c) {
    var groups = PLU.filter(function(g) { return g.category === c; });
    CAT_SUMMARY[c] = {
      revenue: groups.reduce(function(s, g) { return s + g.revenue; }, 0),
      groupCount: groups.length,
      memberIds: {}
    };
    groups.forEach(function(g) {
      g.members.forEach(function(m) { CAT_SUMMARY[c].memberIds[m.id] = true; });
    });
    CAT_SUMMARY[c].memberCount = Object.keys(CAT_SUMMARY[c].memberIds).length;
  });

  // Global totals
  TOTALS.revenue = DATA.reduce(function(s, m) { return s + m.total; }, 0);
  TOTALS.transactions = DATA.reduce(function(s, m) { return s + m.transactions; }, 0);
  TOTALS.members = DATA.filter(function(m) { return m.total > 0; }).length;

  // Update header badge
  document.getElementById('dataBadge').textContent = fmt(TOTALS.revenue) + ' \u00B7 ' + PLU.length + ' groups';
}

// ── Filtering ────────────────────────────────────────────────────────────────

function getFilteredPLU() {
  var out = PLU.filter(function(g) {
    if (S.search && g.name.toLowerCase().indexOf(S.search.toLowerCase()) === -1) return false;
    if (S.category !== 'all' && g.category !== S.category) return false;
    if (g.revenue < S.minRevenue) return false;
    return true;
  });
  out.sort(function(a, b) {
    var col = S.sortCol;
    var av, bv;
    if (col === 'pct') {
      av = TOTALS.revenue > 0 ? a.revenue / TOTALS.revenue : 0;
      bv = TOTALS.revenue > 0 ? b.revenue / TOTALS.revenue : 0;
    } else if (col === 'name') {
      av = a.name; bv = b.name;
    } else {
      av = a[col] || 0; bv = b[col] || 0;
    }
    if (typeof av === 'string') return S.sortDir * av.localeCompare(bv);
    return S.sortDir * (av - bv);
  });
  return out;
}

// ── Sidebar controls ─────────────────────────────────────────────────────────

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
  S.sortCol = 'revenue'; S.sortDir = -1;

  document.getElementById('sSearch').value = '';
  document.getElementById('sMinRev').value = '0';

  document.querySelectorAll('.sidebar .seg-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.sidebar .seg-btn').forEach(function(b) {
    if (b.textContent === 'All') b.classList.add('active');
  });

  document.querySelectorAll('#pluTable th').forEach(function(t) { t.classList.remove('asc', 'desc'); });

  renderAll();
}

function updateFilterSummary() {
  var filters = [];
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
    { overview: 'Overview', plu: 'PLU Groups', deepdive: 'Deep-Dive', contribution: 'Contribution' }[id];
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

// ── PAGE: OVERVIEW ──────────────────────────────────────────────────────────

function renderOverview() {
  // KPIs
  var fnbR = CAT_SUMMARY.fnb ? CAT_SUMMARY.fnb.revenue : 0;
  var shopR = CAT_SUMMARY.shop ? CAT_SUMMARY.shop.revenue : 0;
  var golfR = CAT_SUMMARY.golf ? CAT_SUMMARY.golf.revenue : 0;

  document.getElementById('overviewKPIs').innerHTML =
    '<div class="kpi"><div class="kpi-lbl">Total Revenue</div><div class="kpi-val">' + fmt(TOTALS.revenue) + '</div><div class="kpi-sub">' + PLU.length + ' PLU groups</div></div>' +
    '<div class="kpi fnb"><div class="kpi-lbl">F&amp;B</div><div class="kpi-val fnb-c">' + fmt(fnbR) + '</div><div class="kpi-sub">' + pct(fnbR, TOTALS.revenue) + '</div></div>' +
    '<div class="kpi shop"><div class="kpi-lbl">Pro Shop</div><div class="kpi-val shop-c">' + fmt(shopR) + '</div><div class="kpi-sub">' + pct(shopR, TOTALS.revenue) + '</div></div>' +
    '<div class="kpi golf"><div class="kpi-lbl">Golf Fees</div><div class="kpi-val golf-c">' + fmt(golfR) + '</div><div class="kpi-sub">' + pct(golfR, TOTALS.revenue) + '</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Transactions</div><div class="kpi-val">' + TOTALS.transactions.toLocaleString() + '</div><div class="kpi-sub">all members</div></div>' +
    '<div class="kpi green"><div class="kpi-lbl">Active Members</div><div class="kpi-val">' + TOTALS.members + '</div><div class="kpi-sub">with spend &gt; $0</div></div>';

  // Top 10 PLU groups horizontal bar
  var top10 = PLU.slice(0, 10);
  mkChart('top10Chart', 'bar', {
    labels: top10.map(function(g) { return g.name; }),
    datasets: [{
      label: 'Revenue',
      data: top10.map(function(g) { return g.revenue; }),
      backgroundColor: top10.map(function(g) { return CAT_COLORS[g.category] || CAT_COLORS.other; }),
      borderRadius: 3
    }]
  }, Object.assign({ plugins: { legend: { display: false } } }, SC_HOR));

  // Category doughnut
  var otherR = Math.max(0, TOTALS.revenue - fnbR - shopR - golfR);
  mkChart('catDoughnut', 'doughnut', {
    labels: ['F&B', 'Pro Shop', 'Golf Fees', 'Other'],
    datasets: [{ data: [fnbR, shopR, golfR, otherR], backgroundColor: [CAT_COLORS.fnb, CAT_COLORS.shop, CAT_COLORS.golf, CAT_COLORS.other], borderWidth: 0 }]
  }, { plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } });

  // Category comparison bar
  mkChart('catBarChart', 'bar', {
    labels: ['F&B', 'Pro Shop', 'Golf Fees', 'Other'],
    datasets: [{
      label: 'Revenue',
      data: [fnbR, shopR, golfR, otherR],
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

  // Revenue per transaction by category
  var fnbTx = DATA.reduce(function(s, m) { return s + (m.fnb > 0 ? m.transactions : 0); }, 0);
  var shopTx = DATA.reduce(function(s, m) { return s + (m.proshop > 0 ? m.transactions : 0); }, 0);
  var golfTx = DATA.reduce(function(s, m) { return s + (m.golf > 0 ? m.transactions : 0); }, 0);
  mkChart('rptChart', 'bar', {
    labels: ['F&B', 'Pro Shop', 'Golf Fees'],
    datasets: [{
      label: 'Avg Spend / Member',
      data: [
        CAT_SUMMARY.fnb ? fnbR / CAT_SUMMARY.fnb.memberCount : 0,
        CAT_SUMMARY.shop ? shopR / CAT_SUMMARY.shop.memberCount : 0,
        CAT_SUMMARY.golf ? golfR / CAT_SUMMARY.golf.memberCount : 0
      ],
      backgroundColor: [CAT_COLORS.fnb, CAT_COLORS.shop, CAT_COLORS.golf],
      borderRadius: 3
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });

  // Insights
  var topGroup = PLU[0];
  var fnbCount = PLU.filter(function(g) { return g.category === 'fnb' && g.revenue > 0; }).length;
  var shopCount = PLU.filter(function(g) { return g.category === 'shop' && g.revenue > 0; }).length;
  var golfCount = PLU.filter(function(g) { return g.category === 'golf' && g.revenue > 0; }).length;

  document.getElementById('overviewInsights').innerHTML =
    '<div class="ins"><strong>Top PLU Group</strong>' + (topGroup ? escHtml(topGroup.name) + ' \u2014 ' + fmtFull(topGroup.revenue) + ' (' + topGroup.memberCount + ' members)' : 'N/A') + '</div>' +
    '<div class="ins fnb-ins"><strong>F&amp;B</strong>' + fnbCount + ' active groups generating ' + fmt(fnbR) + ' from ' + (CAT_SUMMARY.fnb ? CAT_SUMMARY.fnb.memberCount : 0) + ' members</div>' +
    '<div class="ins golf-ins"><strong>Golf</strong>' + golfCount + ' active groups generating ' + fmt(golfR) + ' from ' + (CAT_SUMMARY.golf ? CAT_SUMMARY.golf.memberCount : 0) + ' members</div>';
}

// ── PAGE: PLU GROUPS ────────────────────────────────────────────────────────

function renderPLUTable() {
  var filtered = getFilteredPLU();
  document.getElementById('pluCount').textContent = filtered.length + ' PLU groups';

  if (!filtered.length) {
    document.getElementById('pluBody').innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No PLU groups match your filters.</td></tr>';
    return;
  }

  var html = filtered.map(function(g, i) {
    var catCls = getCatClass(g.category);
    var catLabel = CAT_LABELS[g.category] || 'Other';
    var pctVal = pct(g.revenue, TOTALS.revenue);

    return '<tr' + (i < 3 ? ' class="top-row"' : '') + '>' +
      '<td style="text-align:center;color:var(--muted);font-size:.65rem">' + (i + 1) + '</td>' +
      '<td style="font-weight:600">' + escHtml(g.name) + '</td>' +
      '<td><span class="cat-badge ' + catCls + '">' + catLabel + '</span></td>' +
      '<td style="font-weight:700">' + fmtFull(g.revenue) + '</td>' +
      '<td>' + pctVal + '</td>' +
      '<td style="text-align:center">' + g.memberCount + '</td>' +
      '<td>' + fmtFull(g.avgPerMember) + '</td>' +
      '<td><button class="view-btn" onclick="showPluDetail(' + i + ')">View</button></td>' +
    '</tr>';
  }).join('');

  document.getElementById('pluBody').innerHTML = html;
}

// ── PAGE: CATEGORY DEEP-DIVE ────────────────────────────────────────────────

function setDeepDive(cat) {
  S.deepDiveCategory = cat;
  // Update button states
  document.getElementById('ddFnb').className = 'cat-sel-btn' + (cat === 'fnb' ? ' active-fnb' : '');
  document.getElementById('ddShop').className = 'cat-sel-btn' + (cat === 'shop' ? ' active-shop' : '');
  document.getElementById('ddGolf').className = 'cat-sel-btn' + (cat === 'golf' ? ' active-golf' : '');
  renderDeepDive();
}

function renderDeepDive() {
  var cat = S.deepDiveCategory;
  var catLabel = CAT_LABELS[cat];
  var color = CAT_COLORS[cat];
  var catGroups = PLU.filter(function(g) { return g.category === cat; }).sort(function(a, b) { return b.revenue - a.revenue; });
  var catRevenue = catGroups.reduce(function(s, g) { return s + g.revenue; }, 0);
  var catMembers = CAT_SUMMARY[cat] ? CAT_SUMMARY[cat].memberCount : 0;
  var activeGroups = catGroups.filter(function(g) { return g.revenue > 0; }).length;

  // Update label
  document.getElementById('ddCatLabel').innerHTML = 'in ' + catLabel;

  // KPIs
  document.getElementById('ddKPIs').innerHTML =
    '<div class="kpi" style="border-left-color:' + color + '"><div class="kpi-lbl">' + catLabel + ' Revenue</div><div class="kpi-val">' + fmt(catRevenue) + '</div><div class="kpi-sub">' + pct(catRevenue, TOTALS.revenue) + ' of total</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Active Groups</div><div class="kpi-val">' + activeGroups + '</div><div class="kpi-sub">of ' + catGroups.length + ' total</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Unique Members</div><div class="kpi-val">' + catMembers + '</div><div class="kpi-sub">purchasing ' + catLabel + '</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Avg / Member</div><div class="kpi-val">' + (catMembers > 0 ? fmtFull(catRevenue / catMembers) : '$0') + '</div><div class="kpi-sub">' + catLabel + ' spend</div></div>';

  // Sub-group breakdown horizontal bar
  var activeSubGroups = catGroups.filter(function(g) { return g.revenue > 0; });
  mkChart('subGroupChart', 'bar', {
    labels: activeSubGroups.map(function(g) { return g.name; }),
    datasets: [{
      label: 'Revenue',
      data: activeSubGroups.map(function(g) { return g.revenue; }),
      backgroundColor: color,
      borderRadius: 3
    }]
  }, Object.assign({ plugins: { legend: { display: false } } }, SC_HOR));

  // Proportion doughnut
  mkChart('proportionChart', 'doughnut', {
    labels: activeSubGroups.map(function(g) { return g.name; }),
    datasets: [{
      data: activeSubGroups.map(function(g) { return g.revenue; }),
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
      tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + fmtFull(ctx.parsed) + ' (' + pct(ctx.parsed, catRevenue) + ')'; } } }
    }
  });

  // Top 10 members for this category
  var catField = cat === 'fnb' ? 'fnb' : (cat === 'shop' ? 'proshop' : 'golf');
  var topMembers = DATA.filter(function(m) { return m[catField] > 0; })
    .sort(function(a, b) { return b[catField] - a[catField]; })
    .slice(0, 10);

  document.getElementById('ddMemberBody').innerHTML = topMembers.map(function(m, i) {
    var catSpend = m[catField];
    var pctOfTotal = m.total > 0 ? (catSpend / m.total * 100).toFixed(1) + '%' : '\u2014';
    return '<tr' + (i < 3 ? ' class="top-row"' : '') + '>' +
      '<td style="text-align:center;color:var(--muted);font-size:.65rem">' + (i + 1) + '</td>' +
      '<td style="font-weight:600">' + escHtml(m.name) + '</td>' +
      '<td style="font-weight:700;color:' + color + '">' + fmtFull(catSpend) + '</td>' +
      '<td>' + fmtFull(m.total) + '</td>' +
      '<td>' + pctOfTotal + '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No members</td></tr>';
}

// ── PAGE: MEMBER CONTRIBUTION ───────────────────────────────────────────────

function renderContribution() {
  var spending = DATA.filter(function(m) { return m.total > 0; });

  // Cross-category analysis
  var catCounts = { 1: { count: 0, revenue: 0 }, 2: { count: 0, revenue: 0 }, 3: { count: 0, revenue: 0 } };
  var totalCats = 0;
  spending.forEach(function(m) {
    var count = (m.fnb > 0 ? 1 : 0) + (m.proshop > 0 ? 1 : 0) + (m.golf > 0 ? 1 : 0);
    if (count >= 1 && count <= 3) {
      catCounts[count].count++;
      catCounts[count].revenue += m.total;
    }
    totalCats += count;
  });
  var avgCats = spending.length > 0 ? (totalCats / spending.length).toFixed(1) : '0';

  // Revenue concentration — top 10%
  var sorted = spending.slice().sort(function(a, b) { return b.total - a.total; });
  var grandTotal = sorted.reduce(function(s, m) { return s + m.total; }, 0);
  var top10count = Math.max(1, Math.ceil(sorted.length * 0.1));
  var top10spend = sorted.slice(0, top10count).reduce(function(s, m) { return s + m.total; }, 0);
  var top10pct = grandTotal > 0 ? Math.round(top10spend / grandTotal * 100) : 0;

  // KPIs
  document.getElementById('contribKPIs').innerHTML =
    '<div class="kpi"><div class="kpi-lbl">Top 10% Revenue</div><div class="kpi-val">' + top10pct + '%</div><div class="kpi-sub">' + top10count + ' members</div></div>' +
    '<div class="kpi green"><div class="kpi-lbl">Multi-Category</div><div class="kpi-val">' + (catCounts[2].count + catCounts[3].count) + '</div><div class="kpi-sub">2+ categories</div></div>' +
    '<div class="kpi amber"><div class="kpi-lbl">Single-Category</div><div class="kpi-val">' + catCounts[1].count + '</div><div class="kpi-sub">1 category only</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Avg Categories</div><div class="kpi-val">' + avgCats + '</div><div class="kpi-sub">per member</div></div>';

  // Pareto / concentration curve
  if (grandTotal > 0 && sorted.length > 0) {
    var cumPct = [];
    var running = 0;
    var step = Math.max(1, Math.floor(sorted.length / 50));
    var labels = [];
    for (var i = 0; i < sorted.length; i++) {
      running += sorted[i].total;
      if (i % step === 0 || i === sorted.length - 1) {
        cumPct.push(Math.round(running / grandTotal * 100));
        labels.push(Math.round((i + 1) / sorted.length * 100) + '%');
      }
    }

    mkChart('concChart', 'line', {
      labels: labels,
      datasets: [{
        label: 'Cumulative Revenue %',
        data: cumPct,
        borderColor: 'rgba(43,51,92,.8)',
        backgroundColor: 'rgba(43,51,92,.08)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
      }]
    }, {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, title: { display: true, text: '% of Members', font: { size: 10 } }, ticks: { font: { size: 9 } } },
        y: { grid: { color: GRID_COLOR }, min: 0, max: 100, ticks: { font: { size: 10 }, callback: function(v) { return v + '%'; } },
             title: { display: true, text: '% of Revenue', font: { size: 10 } } }
      }
    });
  } else {
    dc('concChart');
  }

  // Cross-category bar chart
  mkChart('crossCatChart', 'bar', {
    labels: ['1 Category', '2 Categories', '3 Categories'],
    datasets: [
      {
        label: 'Members',
        data: [catCounts[1].count, catCounts[2].count, catCounts[3].count],
        backgroundColor: ['rgba(184,99,10,.7)', 'rgba(43,51,92,.7)', 'rgba(26,122,62,.7)'],
        borderRadius: 3,
        yAxisID: 'y'
      },
      {
        label: 'Revenue',
        data: [catCounts[1].revenue, catCounts[2].revenue, catCounts[3].revenue],
        backgroundColor: ['rgba(184,99,10,.25)', 'rgba(43,51,92,.25)', 'rgba(26,122,62,.25)'],
        borderColor: ['rgba(184,99,10,.7)', 'rgba(43,51,92,.7)', 'rgba(26,122,62,.7)'],
        borderWidth: 2,
        borderRadius: 3,
        yAxisID: 'y1'
      }
    ]
  }, {
    plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { position: 'left', grid: { color: GRID_COLOR }, beginAtZero: true, title: { display: true, text: 'Members', font: { size: 10 } }, ticks: { font: { size: 10 } } },
      y1: { position: 'right', grid: { display: false }, beginAtZero: true, title: { display: true, text: 'Revenue', font: { size: 10 } }, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });

  // Top 25 members table
  var top25 = sorted.slice(0, 25);
  document.getElementById('contribBody').innerHTML = top25.map(function(m, i) {
    var catCount = (m.fnb > 0 ? 1 : 0) + (m.proshop > 0 ? 1 : 0) + (m.golf > 0 ? 1 : 0);
    return '<tr' + (i < 3 ? ' class="top-row"' : '') + '>' +
      '<td style="text-align:center;color:var(--muted);font-size:.65rem">' + (i + 1) + '</td>' +
      '<td style="font-weight:600">' + escHtml(m.name) + '</td>' +
      '<td style="font-weight:700">' + fmtFull(m.total) + '</td>' +
      '<td style="color:var(--fnb);font-weight:600">' + (m.fnb > 0 ? fmtFull(m.fnb) : '\u2014') + '</td>' +
      '<td style="color:var(--shop);font-weight:600">' + (m.proshop > 0 ? fmtFull(m.proshop) : '\u2014') + '</td>' +
      '<td style="color:var(--golf);font-weight:600">' + (m.golf > 0 ? fmtFull(m.golf) : '\u2014') + '</td>' +
      '<td style="text-align:center">' + m.transactions + '</td>' +
      '<td style="text-align:center;font-weight:700">' + catCount + '/3</td>' +
    '</tr>';
  }).join('');
}

// ── PLU DETAIL MODAL ────────────────────────────────────────────────────────

function showPluDetail(idx) {
  var filtered = getFilteredPLU();
  var g = filtered[idx];
  if (!g) return;

  var catLabel = CAT_LABELS[g.category] || 'Other';
  var catCls = getCatClass(g.category);
  var color = CAT_COLORS[g.category] || CAT_COLORS.other;
  var top20 = g.members.slice(0, 20);

  document.getElementById('modalName').innerHTML = escHtml(g.name) + ' <span class="cat-badge ' + catCls + '" style="margin-left:8px;font-size:.6rem">' + catLabel + '</span>';

  var membersHtml = top20.map(function(m, i) {
    return '<div class="modal-row">' +
      '<span class="modal-row-lbl">' + (i + 1) + '. ' + escHtml(m.name) + '</span>' +
      '<span class="modal-row-val" style="color:' + color + '">' + fmtFull(m.amount) + '</span>' +
    '</div>';
  }).join('');

  if (g.members.length > 20) {
    membersHtml += '<div style="font-size:.65rem;color:var(--muted);padding-top:8px;text-align:center">+' + (g.members.length - 20) + ' more members</div>';
  }

  document.getElementById('modalBody').innerHTML =
    '<div class="modal-stat-grid">' +
      '<div class="modal-stat"><div class="modal-stat-val">' + fmtFull(g.revenue) + '</div><div class="modal-stat-lbl">Total Revenue</div></div>' +
      '<div class="modal-stat"><div class="modal-stat-val">' + g.memberCount + '</div><div class="modal-stat-lbl">Members</div></div>' +
      '<div class="modal-stat"><div class="modal-stat-val">' + fmtFull(g.avgPerMember) + '</div><div class="modal-stat-lbl">Avg / Member</div></div>' +
      '<div class="modal-stat"><div class="modal-stat-val">' + pct(g.revenue, TOTALS.revenue) + '</div><div class="modal-stat-lbl">% of Total</div></div>' +
    '</div>' +
    '<div style="margin-bottom:16px"><canvas id="modalTopChart"></canvas></div>' +
    '<div class="modal-section-title">Top Spenders in ' + escHtml(g.name) + '</div>' +
    membersHtml;

  document.getElementById('detailModal').classList.remove('hidden');

  // Mini bar chart of top 10 in modal
  setTimeout(function() {
    var topForChart = top20.slice(0, 10);
    var ctx = document.getElementById('modalTopChart');
    if (ctx && topForChart.length) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topForChart.map(function(m) { var p = m.name.split(' '); return p[p.length - 1]; }),
          datasets: [{
            label: 'Spend',
            data: topForChart.map(function(m) { return m.amount; }),
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
  if (tab === 'plu') { renderPLUTable(); }
  if (tab === 'deepdive') { renderDeepDive(); }
  if (tab === 'contribution') { renderContribution(); }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

Chart.defaults.font.family = "'Open Sans',Arial,sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.color = '#6b6d7a';

document.addEventListener('DOMContentLoaded', function() {
  init();
  renderAll();

  // Close modal on overlay click
  document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});
