// ─────────────────────────────────────────────────────────────────────────────
//  VGC Member Spend Tracking — Application Logic
//  State-driven architecture matching rounds-dashboard pattern
// ─────────────────────────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────────────────────────

const FNB_GROUPS = [
  'BULK BEER','PACK BEER','GIN','RUM','WHISKEY','VODKA/OUZO/TEQUILA',
  'LIQUEURS','MISC SPIRITS','BRANDY/COGNAC','APERTIFS','CHAMPAGNE/SPARKLING',
  'WHITE WINE','RED WINE','DESSERT WINE','FORTIFIED WINE','CELLAR LIST',
  'SOFT DRINK','COFFEE/TEA','MISC F&B','SANDWICHES','CASUAL SERVERY',
  'MISC FOOD','GOLF DRINKS','GOLF SNACKS','CONFECTIONARY','BREAKFAST',
  'LUNCH','ENTRÉE','DESSERT','SYSTEM'
];
const SHOP_GROUPS = [
  'GOLF BALLS','GOLF GLOVES','GOLF TEES','ACCESSORIES','GOLF CLUBS',
  'REPAIRS','HEADWEAR','OUTERWEAR','MENS SHIRTS','LADIES SHIRTS',
  'PANTS SHORTS','SHOES','SOCKS','BAGS BUGGIES','PANTS SKIRT SKORT',
  'Australian Open'
];
const GOLF_GROUPS = [
  'COMP FEES','GREEN FEES','Range Balls','LESSONS','CART HIRE',
  'Club Hire','Intl/Interstate GFees','Reciprocal Golfers','Paul Lessons'
];

const CAT_COLORS = {
  fnb:   'rgba(37,99,235,.8)',
  shop:  'rgba(124,58,237,.8)',
  golf:  'rgba(5,150,105,.8)',
  other: 'rgba(137,139,141,.5)'
};
const GRID_COLOR = '#e4e5e6';

const SEG_DEFS = [
  { key:'whale',   label:'Whale ($5k+)',   fn: m => m.total >= 5000,                    color:'rgba(43,51,92,.85)' },
  { key:'high',    label:'High ($1k-$5k)', fn: m => m.total >= 1000 && m.total < 5000,  color:'rgba(26,122,62,.75)' },
  { key:'mid',     label:'Mid ($200-$1k)', fn: m => m.total >= 200  && m.total < 1000,  color:'rgba(90,88,92,.6)' },
  { key:'low',     label:'Low ($1-$200)',  fn: m => m.total > 0     && m.total < 200,   color:'rgba(184,99,10,.7)' },
  { key:'dormant', label:'Zero Spend',     fn: m => m.total === 0,                      color:'rgba(139,26,26,.7)' }
];

// ── State ────────────────────────────────────────────────────────────────────

let S = {
  year: 'all',
  search: '',
  segment: 'all',
  minSpend: 0,
  categoryFocus: '',
  matchFilter: '',
  sortCol: 'total',
  sortDir: -1,
  activeTab: 'members',
  ageGroup: '',
  gender: '',
  membershipType: '',
  tenureBucket: ''
};

let DATA = [];
let YEARS = [];
let YEAR_DATA = {};
let MEMBER_INDEX = {};
let charts = {};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return '$' + n.toFixed(0);
}

function fmtFull(n) {
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getSegment(total) {
  if (total === 0) return 'dormant';
  if (total >= 5000) return 'whale';
  if (total >= 1000) return 'high';
  if (total >= 200) return 'mid';
  return 'low';
}

function segLabel(s) {
  return { whale:'Whale', high:'High', mid:'Mid', low:'Low', dormant:'Zero' }[s] || s;
}

function segEmoji(s) {
  return { whale:'\uD83D\uDC0B', high:'\u2B06', mid:'\u27A1', low:'\u2B07', dormant:'\uD83D\uDCA4' }[s] || '';
}

function getCategoryFocus(m) {
  if (m.total === 0) return 'none';
  var max = Math.max(m.fnb, m.proshop, m.golf);
  if (max / m.total < 0.5) return 'balanced';
  if (max === m.fnb) return 'fnb';
  if (max === m.proshop) return 'shop';
  return 'golf';
}

function median(arr) {
  if (!arr.length) return 0;
  var s = arr.slice().sort(function(a, b) { return a - b; });
  var mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
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
var SC_STACK = {
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { stacked: true, grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
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

function crossRef(arr) {
  arr.forEach(function(sale) {
    var nameLower = sale.name.toLowerCase().trim();
    var matched = MEMBER_INDEX[nameLower];
    if (!matched) {
      var parts = nameLower.split(' ');
      if (parts.length >= 3) {
        matched = MEMBER_INDEX[parts[0] + ' ' + parts[parts.length - 1]];
      }
    }
    sale._member = matched || null;
    sale._matched = !!matched;
    sale._avg = sale.transactions > 0 ? sale.total / sale.transactions : 0;
  });
}

function mergeAllYears() {
  // Merge members across years by ID, summing values
  var merged = {};
  YEARS.forEach(function(y) {
    (YEAR_DATA[y] || []).forEach(function(m) {
      if (!merged[m.id]) {
        merged[m.id] = {
          id: m.id, name: m.name, total: 0, fnb: 0, proshop: 0,
          golf: 0, other: 0, transactions: 0, groups: {},
          _member: m._member, _matched: m._matched
        };
      }
      var t = merged[m.id];
      t.total += m.total; t.fnb += m.fnb; t.proshop += m.proshop;
      t.golf += m.golf; t.other += m.other; t.transactions += m.transactions;
      // Use latest name and match info
      if (m._matched) { t._member = m._member; t._matched = true; t.name = m.name; }
      // Merge groups
      Object.keys(m.groups || {}).forEach(function(g) {
        t.groups[g] = (t.groups[g] || 0) + m.groups[g];
      });
    });
  });
  var arr = Object.values(merged);
  arr.forEach(function(m) {
    m.total = Math.round(m.total * 100) / 100;
    m.fnb = Math.round(m.fnb * 100) / 100;
    m.proshop = Math.round(m.proshop * 100) / 100;
    m.golf = Math.round(m.golf * 100) / 100;
    m.other = Math.round(m.other * 100) / 100;
    m._avg = m.transactions > 0 ? m.total / m.transactions : 0;
  });
  return arr;
}

function buildActiveData() {
  if (S.year === 'all') {
    DATA = mergeAllYears();
  } else {
    DATA = (YEAR_DATA[S.year] || []).slice();
  }
  DATA.sort(function(a, b) { return b.total - a.total; });
  updateMatchBadge();
}

function updateMatchBadge() {
  var matchedCount = DATA.filter(function(d) { return d._matched; }).length;
  var pct = DATA.length ? Math.round(matchedCount / DATA.length * 100) : 0;
  document.getElementById('matchBadge').textContent = matchedCount + ' matched (' + pct + '%)';
}

function init() {
  // Build name index from member lookup
  if (typeof MEMBER_LOOKUP_DATA !== 'undefined' && MEMBER_LOOKUP_DATA.members) {
    MEMBER_LOOKUP_DATA.members.forEach(function(m) {
      var key = (m.first + ' ' + m.last).toLowerCase().trim();
      MEMBER_INDEX[key] = m;
    });
  }

  // Handle both legacy flat array and new multi-year object
  var raw = typeof SALES_DATA !== 'undefined' ? SALES_DATA : [];
  if (Array.isArray(raw)) {
    // Legacy flat array — single year
    YEARS = ['All'];
    YEAR_DATA = { 'All': raw };
    crossRef(raw);
    S.year = 'All';
  } else {
    // Multi-year object: { years: [...], data: { year: [...] } }
    YEARS = raw.years || [];
    YEAR_DATA = raw.data || {};
    YEARS.forEach(function(y) { crossRef(YEAR_DATA[y] || []); });
    S.year = 'all';
  }

  // Build year buttons
  buildYearButtons();

  // Set active data
  buildActiveData();

  // Populate demographic dropdowns
  populateDemoDropdowns();
}

function buildYearButtons() {
  var container = document.getElementById('yearButtons');
  if (!container) return;
  if (YEARS.length <= 1) {
    // Single year / legacy — hide year section
    container.closest('.sidebar-section').style.display = 'none';
    return;
  }
  var html = '<button class="seg-btn active" onclick="setYear(\'all\',this)">All</button>';
  YEARS.forEach(function(y) {
    html += '<button class="seg-btn" onclick="setYear(\'' + y + '\',this)">' + y + '</button>';
  });
  container.innerHTML = html;
}

function setYear(v, btn) {
  S.year = v;
  var section = btn.closest('.sidebar-section');
  section.querySelectorAll('.seg-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  buildActiveData();
  renderAll();
}

function populateDemoDropdowns() {
  var ageGroups = new Set(), types = new Set(), tenures = new Set();
  DATA.forEach(function(d) {
    if (!d._member) return;
    if (d._member.age_group) ageGroups.add(d._member.age_group);
    if (d._member.membership_type) types.add(d._member.membership_type);
    if (d._member.tenure_bucket) tenures.add(d._member.tenure_bucket);
  });

  var ageSel = document.getElementById('sAgeGroup');
  Array.from(ageGroups).sort().forEach(function(g) {
    var o = document.createElement('option'); o.value = g; o.textContent = g; ageSel.appendChild(o);
  });
  var typeSel = document.getElementById('sMemberType');
  Array.from(types).sort().forEach(function(t) {
    var o = document.createElement('option'); o.value = t; o.textContent = t; typeSel.appendChild(o);
  });
  var tenSel = document.getElementById('sTenure');
  var tenureOrder = ['0\u20132yr','3\u20134yr','5\u20139yr','10\u201319yr','20\u201349yr','50yr+'];
  tenureOrder.forEach(function(t) {
    if (tenures.has(t)) {
      var o = document.createElement('option'); o.value = t; o.textContent = t; tenSel.appendChild(o);
    }
  });
  // Add any remaining
  Array.from(tenures).sort().forEach(function(t) {
    if (tenureOrder.indexOf(t) === -1) {
      var o = document.createElement('option'); o.value = t; o.textContent = t; tenSel.appendChild(o);
    }
  });
}

// ── Filtering ────────────────────────────────────────────────────────────────

function getFiltered() {
  var out = DATA.filter(function(m) {
    if (S.search && (!m.name || m.name.toLowerCase().indexOf(S.search.toLowerCase()) === -1)) return false;
    if (S.segment !== 'all' && getSegment(m.total) !== S.segment) return false;
    if (m.total < S.minSpend) return false;
    if (S.categoryFocus && getCategoryFocus(m) !== S.categoryFocus) return false;
    if (S.matchFilter === 'matched' && !m._matched) return false;
    if (S.matchFilter === 'unmatched' && m._matched) return false;
    return true;
  });
  out.sort(function(a, b) {
    var col = S.sortCol;
    var av = col === 'avg' ? a._avg : a[col];
    var bv = col === 'avg' ? b._avg : b[col];
    if (typeof av === 'string') return S.sortDir * av.localeCompare(bv);
    return S.sortDir * ((av || 0) - (bv || 0));
  });
  return out;
}

function getMatchedFiltered() {
  return getFiltered().filter(function(m) {
    if (!m._matched) return false;
    if (S.ageGroup && m._member.age_group !== S.ageGroup) return false;
    if (S.gender && m._member.gender !== S.gender) return false;
    if (S.membershipType && m._member.membership_type !== S.membershipType) return false;
    if (S.tenureBucket && m._member.tenure_bucket !== S.tenureBucket) return false;
    return true;
  });
}

// ── Sidebar controls ─────────────────────────────────────────────────────────

function setSearch(v) { S.search = v; renderAll(); }

function setSegment(v, btn) {
  S.segment = v;
  btn.parentElement.querySelectorAll('.seg-btn').forEach(function(b) { b.classList.remove('active'); });
  // Also check sibling row
  var section = btn.closest('.sidebar-section');
  section.querySelectorAll('.seg-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  renderAll();
}

function setMinSpend(v) { S.minSpend = parseFloat(v) || 0; renderAll(); }
function setCategoryFocus(v) { S.categoryFocus = v; renderAll(); }

function setMatchFilter(v, btn) {
  S.matchFilter = v;
  var section = btn.closest('.sidebar-section');
  section.querySelectorAll('.seg-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  renderAll();
}

function setAgeGroup(v) { S.ageGroup = v; renderAll(); }
function setGender(v) { S.gender = v; renderAll(); }
function setMembershipType(v) { S.membershipType = v; renderAll(); }
function setTenureBucket(v) { S.tenureBucket = v; renderAll(); }

function resetFilters() {
  S.year = 'all'; S.search = ''; S.segment = 'all'; S.minSpend = 0; S.categoryFocus = '';
  S.matchFilter = ''; S.ageGroup = ''; S.gender = ''; S.membershipType = ''; S.tenureBucket = '';
  S.sortCol = 'total'; S.sortDir = -1;

  document.getElementById('sSearch').value = '';
  document.getElementById('sMinSpend').value = '0';
  document.getElementById('sCatFocus').value = '';
  document.getElementById('sAgeGroup').value = '';
  document.getElementById('sGender').value = '';
  document.getElementById('sMemberType').value = '';
  document.getElementById('sTenure').value = '';

  // Reset all seg buttons (including year)
  document.querySelectorAll('.sidebar .seg-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.sidebar .seg-btn').forEach(function(b) {
    if (b.textContent === 'All') b.classList.add('active');
  });

  // Reset sort headers
  document.querySelectorAll('.tbl th').forEach(function(t) { t.classList.remove('asc', 'desc'); });
  var totalTh = document.querySelector('#memberTable th.desc, #memberTable th:nth-child(3)');
  if (totalTh) totalTh.classList.add('desc');

  buildActiveData();
  renderAll();
}

function updateFilterSummary() {
  var filters = [];
  if (S.year !== 'all' && YEARS.length > 1) filters.push(S.year);
  if (S.search) filters.push('Search');
  if (S.segment !== 'all') filters.push(segLabel(S.segment));
  if (S.minSpend > 0) filters.push('$' + S.minSpend + '+');
  if (S.categoryFocus) filters.push(S.categoryFocus);
  if (S.matchFilter) filters.push(S.matchFilter);
  document.getElementById('filterBadge').textContent = filters.length ? filters.join(' · ') : 'No Filters';
}

// ── Tab navigation ───────────────────────────────────────────────────────────

function showTab(id, el) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('pg-' + id).classList.add('active');
  S.activeTab = id;
  document.getElementById('activeTabBadge').textContent =
    { members:'Members', overview:'Overview', segments:'Segments', categories:'Categories', demographics:'Demographics' }[id];

  // Show/hide demographics filters
  document.getElementById('demoFilters').style.display = id === 'demographics' ? '' : 'none';

  renderAll();
}

// ── Sort ─────────────────────────────────────────────────────────────────────

function sortBy(col, th) {
  S.sortDir = S.sortCol === col ? S.sortDir * -1 : -1;
  S.sortCol = col;
  document.querySelectorAll('#memberTable th').forEach(function(t) { t.classList.remove('asc', 'desc'); });
  if (th) th.classList.add(S.sortDir === 1 ? 'asc' : 'desc');
  renderAll();
}

// ── PAGE: MEMBERS ────────────────────────────────────────────────────────────

function renderMemberTable() {
  var filtered = getFiltered();
  document.getElementById('resultCount').textContent = filtered.length + ' members';

  if (!filtered.length) {
    document.getElementById('memberBody').innerHTML =
      '<tr><td colspan="12" style="text-align:center;padding:32px;color:var(--muted)">No members match your filters.</td></tr>';
    return;
  }

  var html = filtered.map(function(m, i) {
    var s = getSegment(m.total);
    var total = m.total;
    var fnbW = total > 0 ? Math.round(m.fnb / total * 100) : 0;
    var shopW = total > 0 ? Math.round(m.proshop / total * 100) : 0;
    var golfW = total > 0 ? Math.round(m.golf / total * 100) : 0;
    var otherW = Math.max(0, 100 - fnbW - shopW - golfW);
    var badge = m._matched
      ? '<span class="match-badge yes">\u2713</span>'
      : '<span class="match-badge no">\u2717</span>';

    return '<tr' + (i < 3 ? ' class="top-row"' : '') + '>' +
      '<td style="text-align:center;color:var(--muted);font-size:.65rem">' + (i + 1) + '</td>' +
      '<td style="font-weight:600">' + m.name + '</td>' +
      '<td style="font-weight:700">' + fmtFull(total) + '</td>' +
      '<td style="color:var(--fnb);font-weight:600">' + (m.fnb > 0 ? fmtFull(m.fnb) : '\u2014') + '</td>' +
      '<td style="color:var(--shop);font-weight:600">' + (m.proshop > 0 ? fmtFull(m.proshop) : '\u2014') + '</td>' +
      '<td style="color:var(--golf);font-weight:600">' + (m.golf > 0 ? fmtFull(m.golf) : '\u2014') + '</td>' +
      '<td><div class="spend-bar-wrap">' +
        '<div class="spend-bar bar-fnb" style="width:' + fnbW + '%"></div>' +
        '<div class="spend-bar bar-shop" style="width:' + shopW + '%"></div>' +
        '<div class="spend-bar bar-golf" style="width:' + golfW + '%"></div>' +
        '<div class="spend-bar bar-other" style="width:' + otherW + '%"></div>' +
      '</div></td>' +
      '<td style="text-align:center">' + m.transactions + '</td>' +
      '<td>' + (m._avg > 0 ? fmtFull(m._avg) : '\u2014') + '</td>' +
      '<td><span class="seg ' + s + '">' + segLabel(s) + '</span></td>' +
      '<td style="text-align:center">' + badge + '</td>' +
      '<td><button class="view-btn" onclick="showDetail(\'' + m.id + '\')">View</button></td>' +
    '</tr>';
  }).join('');

  document.getElementById('memberBody').innerHTML = html;
}

// ── PAGE: OVERVIEW ───────────────────────────────────────────────────────────

function buildOverviewKPIs() {
  var filtered = getFiltered();
  var spending = filtered.filter(function(m) { return m.total > 0; });
  var total = filtered.reduce(function(s, m) { return s + m.total; }, 0);
  var fnb = filtered.reduce(function(s, m) { return s + m.fnb; }, 0);
  var shop = filtered.reduce(function(s, m) { return s + m.proshop; }, 0);
  var golf = filtered.reduce(function(s, m) { return s + m.golf; }, 0);
  var avg = spending.length ? total / spending.length : 0;
  var med = median(spending.map(function(m) { return m.total; }));
  var dormant = filtered.filter(function(m) { return m.total === 0; }).length;

  document.getElementById('overviewKPIs').innerHTML =
    '<div class="kpi"><div class="kpi-lbl">Total Spend</div><div class="kpi-val">' + fmt(total) + '</div><div class="kpi-sub">' + filtered.length + ' members</div></div>' +
    '<div class="kpi fnb"><div class="kpi-lbl">F&amp;B</div><div class="kpi-val fnb-c">' + fmt(fnb) + '</div><div class="kpi-sub">' + (total ? (fnb/total*100).toFixed(1) + '%' : '0%') + '</div></div>' +
    '<div class="kpi shop"><div class="kpi-lbl">Pro Shop</div><div class="kpi-val shop-c">' + fmt(shop) + '</div><div class="kpi-sub">' + (total ? (shop/total*100).toFixed(1) + '%' : '0%') + '</div></div>' +
    '<div class="kpi golf"><div class="kpi-lbl">Golf Fees</div><div class="kpi-val golf-c">' + fmt(golf) + '</div><div class="kpi-sub">' + (total ? (golf/total*100).toFixed(1) + '%' : '0%') + '</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Avg / Member</div><div class="kpi-val">' + fmtFull(avg) + '</div><div class="kpi-sub">spending members</div></div>' +
    '<div class="kpi"><div class="kpi-lbl">Median</div><div class="kpi-val">' + fmtFull(med) + '</div><div class="kpi-sub">middle value</div></div>' +
    '<div class="kpi red"><div class="kpi-lbl">Zero Spend</div><div class="kpi-val red-c">' + dormant + '</div><div class="kpi-sub">no activity</div></div>';
}

function buildDistChart() {
  var filtered = getFiltered();
  var buckets = [
    { label: 'Zero', fn: function(m) { return m.total === 0; }, color: 'rgba(139,26,26,.7)' },
    { label: '$1-200', fn: function(m) { return m.total > 0 && m.total < 200; }, color: 'rgba(184,99,10,.7)' },
    { label: '$200-500', fn: function(m) { return m.total >= 200 && m.total < 500; }, color: 'rgba(43,51,92,.4)' },
    { label: '$500-1k', fn: function(m) { return m.total >= 500 && m.total < 1000; }, color: 'rgba(43,51,92,.6)' },
    { label: '$1k-5k', fn: function(m) { return m.total >= 1000 && m.total < 5000; }, color: 'rgba(26,122,62,.7)' },
    { label: '$5k+', fn: function(m) { return m.total >= 5000; }, color: 'rgba(43,51,92,.9)' }
  ];
  mkChart('distChart', 'bar', {
    labels: buckets.map(function(b) { return b.label; }),
    datasets: [{
      label: 'Members',
      data: buckets.map(function(b) { return filtered.filter(b.fn).length; }),
      backgroundColor: buckets.map(function(b) { return b.color; }),
      borderRadius: 3
    }]
  }, { plugins: { legend: { display: false } }, scales: SC.scales });
}

function buildCatChart() {
  var filtered = getFiltered();
  var fnb = filtered.reduce(function(s, m) { return s + m.fnb; }, 0);
  var shop = filtered.reduce(function(s, m) { return s + m.proshop; }, 0);
  var golf = filtered.reduce(function(s, m) { return s + m.golf; }, 0);
  var other = Math.max(0, filtered.reduce(function(s, m) { return s + m.total; }, 0) - fnb - shop - golf);
  mkChart('catChart', 'doughnut', {
    labels: ['F&B', 'Pro Shop', 'Golf Fees', 'Other'],
    datasets: [{ data: [fnb, shop, golf, other], backgroundColor: [CAT_COLORS.fnb, CAT_COLORS.shop, CAT_COLORS.golf, CAT_COLORS.other], borderWidth: 0 }]
  }, { plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } });
}

function buildTop20Chart() {
  var sorted = getFiltered().filter(function(m) { return m.total > 0; }).slice(0, 20);
  mkChart('top20Chart', 'bar', {
    labels: sorted.map(function(m) { var p = m.name.split(' '); return p[p.length - 1]; }),
    datasets: [
      { label: 'F&B', data: sorted.map(function(m) { return m.fnb; }), backgroundColor: CAT_COLORS.fnb, borderRadius: 2 },
      { label: 'Pro Shop', data: sorted.map(function(m) { return m.proshop; }), backgroundColor: CAT_COLORS.shop, borderRadius: 2 },
      { label: 'Golf', data: sorted.map(function(m) { return m.golf; }), backgroundColor: CAT_COLORS.golf, borderRadius: 2 },
      { label: 'Other', data: sorted.map(function(m) { return m.other || 0; }), backgroundColor: CAT_COLORS.other, borderRadius: 2 }
    ]
  }, Object.assign({ plugins: { legend: { position: 'top' } } }, SC_STACK));
}

function buildParetoChart() {
  var sorted = getFiltered().filter(function(m) { return m.total > 0; }).sort(function(a, b) { return b.total - a.total; });
  var grandTotal = sorted.reduce(function(s, m) { return s + m.total; }, 0);
  if (!grandTotal || !sorted.length) { dc('paretoChart'); return; }

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

  mkChart('paretoChart', 'line', {
    labels: labels,
    datasets: [{
      label: 'Cumulative Revenue %',
      data: cumPct,
      borderColor: 'rgba(43,51,92,.8)',
      backgroundColor: 'rgba(43,51,92,.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      borderWidth: 2
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, title: { display: true, text: '% of Members', font: { size: 10 } }, ticks: { font: { size: 9 } } },
      y: { grid: { color: GRID_COLOR }, min: 0, max: 100, ticks: { font: { size: 10 }, callback: function(v) { return v + '%'; } },
           title: { display: true, text: '% of Revenue', font: { size: 10 } } }
    }
  });
}

function buildOverviewInsights() {
  var filtered = getFiltered();
  if (!filtered.length) { document.getElementById('overviewInsights').innerHTML = ''; return; }

  var sorted = filtered.slice().sort(function(a, b) { return b.total - a.total; });
  var total = sorted.reduce(function(s, m) { return s + m.total; }, 0);
  var spending = sorted.filter(function(m) { return m.total > 0; });
  var matchedCount = filtered.filter(function(m) { return m._matched; }).length;
  var matchPct = filtered.length ? Math.round(matchedCount / filtered.length * 100) : 0;
  var dormant = filtered.filter(function(m) { return m.total === 0; }).length;

  // Top spender insight
  var topSpend = sorted[0];
  // Concentration: top 10% spend what % of total?
  var top10count = Math.max(1, Math.ceil(spending.length * 0.1));
  var top10spend = spending.slice(0, top10count).reduce(function(s, m) { return s + m.total; }, 0);
  var top10pct = total ? Math.round(top10spend / total * 100) : 0;

  document.getElementById('overviewInsights').innerHTML =
    '<div class="ins"><strong>Top Spender</strong>' + topSpend.name + ' — ' + fmtFull(topSpend.total) + ' across ' + topSpend.transactions + ' transactions</div>' +
    '<div class="ins amber"><strong>Spend Concentration</strong>Top 10% of spenders (' + top10count + ' members) account for ' + top10pct + '% of total revenue</div>' +
    '<div class="ins' + (dormant > 50 ? ' rose' : '') + '"><strong>DB Match Rate</strong>' + matchedCount + ' of ' + filtered.length + ' matched (' + matchPct + '%) — ' + dormant + ' members with zero spend</div>';
}

// ── PAGE: SEGMENTS ───────────────────────────────────────────────────────────

function buildSegLists() {
  var filtered = getFiltered();
  var whales = filtered.filter(function(m) { return m.total >= 5000; }).sort(function(a, b) { return b.total - a.total; });
  var high = filtered.filter(function(m) { return m.total >= 1000 && m.total < 5000; }).sort(function(a, b) { return b.total - a.total; });
  var dormant = filtered.filter(function(m) { return m.total === 0 && m._matched; });

  document.getElementById('whaleCount').textContent = whales.length + ' members';
  document.getElementById('highCount').textContent = high.length + ' members';
  document.getElementById('dormantCount').textContent = dormant.length + ' matched';

  document.getElementById('segWhale').innerHTML = whales.map(function(m) {
    return '<div class="seg-list-item"><span style="font-weight:600">' + m.name + '</span><span style="font-weight:700;color:var(--navy)">' + fmtFull(m.total) + '</span></div>';
  }).join('') || '<div style="color:var(--muted);font-size:.75rem;padding:8px">No whales in current filter</div>';

  document.getElementById('segHigh').innerHTML = high.slice(0, 25).map(function(m) {
    return '<div class="seg-list-item"><span style="font-weight:600">' + m.name + '</span><span style="font-weight:700;color:var(--green)">' + fmtFull(m.total) + '</span></div>';
  }).join('') + (high.length > 25 ? '<div style="font-size:.65rem;color:var(--muted);padding-top:8px">+' + (high.length - 25) + ' more</div>' : '') ||
    '<div style="color:var(--muted);font-size:.75rem;padding:8px">None in current filter</div>';

  var dormantHtml = dormant.slice(0, 25).map(function(m) {
    return '<div class="seg-list-item"><span style="color:var(--muted)">' + m.name + '</span><span style="font-size:.6rem;color:var(--red);font-weight:700">$0.00</span></div>';
  }).join('');
  if (dormant.length > 25) dormantHtml += '<div style="font-size:.65rem;color:var(--muted);padding-top:8px">+' + (dormant.length - 25) + ' more</div>';
  document.getElementById('segDormant').innerHTML = dormantHtml || '<div style="color:var(--muted);font-size:.75rem;padding:8px">All matched members have some spend</div>';
}

function buildSegTable() {
  var filtered = getFiltered();
  var grandTotal = filtered.reduce(function(s, m) { return s + m.total; }, 0);
  document.getElementById('segSummaryBody').innerHTML = SEG_DEFS.map(function(sd) {
    var members = filtered.filter(sd.fn);
    var rev = members.reduce(function(s, m) { return s + m.total; }, 0);
    var avg = members.length ? rev / members.length : 0;
    return '<tr>' +
      '<td style="text-align:left"><span class="seg ' + sd.key + '">' + sd.label + '</span></td>' +
      '<td style="font-weight:700">' + members.length + '</td>' +
      '<td style="font-weight:700">' + fmtFull(rev) + '</td>' +
      '<td>' + (avg > 0 ? fmtFull(avg) : '\u2014') + '</td>' +
      '<td>' + (grandTotal > 0 ? (rev / grandTotal * 100).toFixed(1) + '%' : '\u2014') + '</td>' +
    '</tr>';
  }).join('');
}

function buildSegPie() {
  var filtered = getFiltered();
  mkChart('segPieChart', 'doughnut', {
    labels: SEG_DEFS.map(function(s) { return s.label; }),
    datasets: [{
      data: SEG_DEFS.map(function(sd) { return filtered.filter(sd.fn).length; }),
      backgroundColor: SEG_DEFS.map(function(s) { return s.color; }),
      borderWidth: 0
    }]
  }, { plugins: { legend: { position: 'right', labels: { font: { size: 11 } } } } });
}

function buildSegRevenueChart() {
  var filtered = getFiltered();
  mkChart('segRevenueChart', 'bar', {
    labels: SEG_DEFS.map(function(s) { return s.label; }),
    datasets: [{
      label: 'Revenue',
      data: SEG_DEFS.map(function(sd) { return filtered.filter(sd.fn).reduce(function(s, m) { return s + m.total; }, 0); }),
      backgroundColor: SEG_DEFS.map(function(s) { return s.color; }),
      borderRadius: 3
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });
}

// ── PAGE: CATEGORIES ─────────────────────────────────────────────────────────

function buildCatSummaryCards() {
  var filtered = getFiltered();
  var total = filtered.reduce(function(s, m) { return s + m.total; }, 0);
  var cats = [
    { key: 'fnb', label: 'F&B', groups: FNB_GROUPS, color: 'var(--fnb)' },
    { key: 'proshop', label: 'Pro Shop', groups: SHOP_GROUPS, color: 'var(--shop)' },
    { key: 'golf', label: 'Golf Fees', groups: GOLF_GROUPS, color: 'var(--golf)' }
  ];

  document.getElementById('catSummaryCards').innerHTML = cats.map(function(cat) {
    var catTotal = filtered.reduce(function(s, m) { return s + (m[cat.key] || 0); }, 0);
    var pct = total ? (catTotal / total * 100).toFixed(1) : '0';

    // Top 5 sub-categories
    var subTotals = {};
    cat.groups.forEach(function(g) {
      filtered.forEach(function(m) {
        if (m.groups && m.groups[g]) subTotals[g] = (subTotals[g] || 0) + m.groups[g];
      });
    });
    var topSubs = Object.keys(subTotals).sort(function(a, b) { return subTotals[b] - subTotals[a]; }).slice(0, 5);

    return '<div class="card">' +
      '<div class="card-hdr" style="color:' + cat.color + '">' + cat.label + '<span class="sub">' + pct + '% of total</span></div>' +
      '<div style="font-size:1.4rem;font-weight:700;color:' + cat.color + ';margin-bottom:10px">' + fmtFull(catTotal) + '</div>' +
      topSubs.map(function(g) {
        var w = catTotal > 0 ? Math.round(subTotals[g] / catTotal * 100) : 0;
        return '<div class="bar-row">' +
          '<span class="bar-lbl">' + g + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + w + '%;background:' + cat.color + '"></div></div>' +
          '<span class="bar-val">' + fmt(subTotals[g]) + '</span></div>';
      }).join('') +
    '</div>';
  }).join('');
}

function buildAllCategoriesChart() {
  var filtered = getFiltered();
  var allGroups = {};
  var groupCat = {};
  [FNB_GROUPS, SHOP_GROUPS, GOLF_GROUPS].forEach(function(groups, ci) {
    var catKey = ['fnb', 'shop', 'golf'][ci];
    groups.forEach(function(g) { groupCat[g] = catKey; });
  });

  filtered.forEach(function(m) {
    if (!m.groups) return;
    Object.keys(m.groups).forEach(function(g) {
      if (m.groups[g] > 0) allGroups[g] = (allGroups[g] || 0) + m.groups[g];
    });
  });

  var sorted = Object.keys(allGroups).sort(function(a, b) { return allGroups[b] - allGroups[a]; });
  var colors = sorted.map(function(g) {
    var c = groupCat[g];
    if (c === 'fnb') return CAT_COLORS.fnb;
    if (c === 'shop') return CAT_COLORS.shop;
    if (c === 'golf') return CAT_COLORS.golf;
    return CAT_COLORS.other;
  });

  mkChart('allCatChart', 'bar', {
    labels: sorted,
    datasets: [{
      label: 'Revenue',
      data: sorted.map(function(g) { return allGroups[g]; }),
      backgroundColor: colors,
      borderRadius: 2
    }]
  }, Object.assign({ plugins: { legend: { display: false } } }, SC_HOR));
}

function buildSubCatChart(canvasId, groups, color) {
  var filtered = getFiltered();
  var subTotals = {};
  groups.forEach(function(g) {
    filtered.forEach(function(m) {
      if (m.groups && m.groups[g]) subTotals[g] = (subTotals[g] || 0) + m.groups[g];
    });
  });
  var sorted = Object.keys(subTotals).filter(function(g) { return subTotals[g] > 0; }).sort(function(a, b) { return subTotals[b] - subTotals[a]; });
  if (!sorted.length) { dc(canvasId); return; }

  mkChart(canvasId, 'bar', {
    labels: sorted,
    datasets: [{ data: sorted.map(function(g) { return subTotals[g]; }), backgroundColor: color, borderRadius: 2 }]
  }, Object.assign({ plugins: { legend: { display: false } } }, SC_HOR));
}

function buildCatInsights() {
  var filtered = getFiltered();
  var allGroups = {};
  filtered.forEach(function(m) {
    if (!m.groups) return;
    Object.keys(m.groups).forEach(function(g) {
      if (m.groups[g] > 0) allGroups[g] = (allGroups[g] || 0) + m.groups[g];
    });
  });
  var sorted = Object.keys(allGroups).sort(function(a, b) { return allGroups[b] - allGroups[a]; });

  var topCat = sorted[0];
  var fnbMembers = filtered.filter(function(m) { return m.fnb > 0; }).length;
  var shopMembers = filtered.filter(function(m) { return m.proshop > 0; }).length;
  var golfMembers = filtered.filter(function(m) { return m.golf > 0; }).length;

  document.getElementById('catInsightsCard').innerHTML =
    '<div class="card-hdr">Category Insights</div>' +
    '<div class="ins fnb-ins"><strong>Top Category</strong>' + (topCat || 'N/A') + ' — ' + (topCat ? fmtFull(allGroups[topCat]) : '$0') + '</div>' +
    '<div class="ins fnb-ins"><strong>F&B Participation</strong>' + fnbMembers + ' members (' + (filtered.length ? Math.round(fnbMembers / filtered.length * 100) : 0) + '%) have F&B spend</div>' +
    '<div class="ins shop-ins"><strong>Pro Shop Participation</strong>' + shopMembers + ' members (' + (filtered.length ? Math.round(shopMembers / filtered.length * 100) : 0) + '%) have Pro Shop spend</div>' +
    '<div class="ins golf-ins"><strong>Golf Fees Participation</strong>' + golfMembers + ' members (' + (filtered.length ? Math.round(golfMembers / filtered.length * 100) : 0) + '%) have Golf fee spend</div>';
}

// ── PAGE: DEMOGRAPHICS ───────────────────────────────────────────────────────

function buildDemoNotice() {
  var matched = getMatchedFiltered();
  var total = getFiltered().length;
  document.getElementById('demoNotice').innerHTML =
    'Demographics data available for <strong>' + matched.length + '</strong> of ' + total +
    ' members (matched to member database). Unmatched members are excluded from this view.';
}

function groupByField(field) {
  var matched = getMatchedFiltered();
  var groups = {};
  matched.forEach(function(m) {
    var key = m._member[field] || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });
  return groups;
}

function buildDemoBarChart(canvasId, field, useAvg) {
  var groups = groupByField(field);
  var labels = Object.keys(groups).sort();
  var data = labels.map(function(k) {
    var total = groups[k].reduce(function(s, m) { return s + m.total; }, 0);
    return useAvg ? (groups[k].length ? total / groups[k].length : 0) : total;
  });

  mkChart(canvasId, 'bar', {
    labels: labels,
    datasets: [{
      label: useAvg ? 'Avg Spend' : 'Total Spend',
      data: data,
      backgroundColor: 'rgba(43,51,92,.7)',
      borderRadius: 3
    }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: GRID_COLOR }, beginAtZero: true, ticks: { font: { size: 10 }, callback: function(v) { return fmt(v); } } }
    }
  });
}

function buildDemoCatMixChart() {
  var groups = groupByField('age_group');
  var labels = Object.keys(groups).sort();

  mkChart('demoCatMixChart', 'bar', {
    labels: labels,
    datasets: [
      { label: 'F&B', data: labels.map(function(k) { return groups[k].reduce(function(s, m) { return s + m.fnb; }, 0); }), backgroundColor: CAT_COLORS.fnb, borderRadius: 2 },
      { label: 'Pro Shop', data: labels.map(function(k) { return groups[k].reduce(function(s, m) { return s + m.proshop; }, 0); }), backgroundColor: CAT_COLORS.shop, borderRadius: 2 },
      { label: 'Golf', data: labels.map(function(k) { return groups[k].reduce(function(s, m) { return s + m.golf; }, 0); }), backgroundColor: CAT_COLORS.golf, borderRadius: 2 }
    ]
  }, Object.assign({ plugins: { legend: { position: 'top' } } }, SC_STACK));
}

function buildDemoTable() {
  var groups = groupByField('age_group');
  var labels = Object.keys(groups).sort();

  document.getElementById('demoTableBody').innerHTML = labels.map(function(k) {
    var members = groups[k];
    var total = members.reduce(function(s, m) { return s + m.total; }, 0);
    var fnb = members.reduce(function(s, m) { return s + m.fnb; }, 0);
    var shop = members.reduce(function(s, m) { return s + m.proshop; }, 0);
    var golf = members.reduce(function(s, m) { return s + m.golf; }, 0);
    var avg = members.length ? total / members.length : 0;
    return '<tr>' +
      '<td style="text-align:left">' + k + '</td>' +
      '<td>' + members.length + '</td>' +
      '<td style="font-weight:700">' + fmtFull(total) + '</td>' +
      '<td>' + fmtFull(avg) + '</td>' +
      '<td style="color:var(--fnb)">' + (total ? (fnb / total * 100).toFixed(1) + '%' : '\u2014') + '</td>' +
      '<td style="color:var(--shop)">' + (total ? (shop / total * 100).toFixed(1) + '%' : '\u2014') + '</td>' +
      '<td style="color:var(--golf)">' + (total ? (golf / total * 100).toFixed(1) + '%' : '\u2014') + '</td>' +
    '</tr>';
  }).join('');
}

// ── MODAL ────────────────────────────────────────────────────────────────────

function showDetail(id) {
  var m = null;
  for (var i = 0; i < DATA.length; i++) {
    if (DATA[i].id === id) { m = DATA[i]; break; }
  }
  if (!m) return;

  var s = getSegment(m.total);
  var avgTx = m.transactions > 0 ? m.total / m.transactions : 0;
  window._detailMemberId = id;

  function groupRows(groups, groupNames, color) {
    var rows = '';
    var hasAny = false;
    groupNames.forEach(function(g) {
      if (groups[g] && groups[g] > 0) {
        hasAny = true;
        rows += '<div class="modal-row"><span class="modal-row-lbl">' + g + '</span><span class="modal-row-val" style="color:' + color + '">' + fmtFull(groups[g]) + '</span></div>';
      }
    });
    return hasAny ? rows : '<div class="modal-row"><span class="modal-row-lbl" style="font-style:italic">No spend</span><span class="modal-row-val">\u2014</span></div>';
  }

  var groups = m.groups || {};
  var otherRows = '';
  Object.keys(groups).forEach(function(g) {
    if (groups[g] > 0 && FNB_GROUPS.indexOf(g) === -1 && SHOP_GROUPS.indexOf(g) === -1 && GOLF_GROUPS.indexOf(g) === -1) {
      otherRows += '<div class="modal-row"><span class="modal-row-lbl">' + g + '</span><span class="modal-row-val">' + fmtFull(groups[g]) + '</span></div>';
    }
  });

  // Member DB section
  var memberBlock = '';
  if (m._matched) {
    var mem = m._member;
    memberBlock =
      '<div class="modal-section-title">Member Database Record</div>' +
      '<div class="member-info-box">' +
        '<div class="mi-row"><span class="mi-lbl">Name</span><span class="mi-val">' + mem.first + ' ' + mem.last + '</span></div>' +
        '<div class="mi-row"><span class="mi-lbl">Gender</span><span class="mi-val">' + (mem.gender || '\u2014') + '</span></div>' +
        '<div class="mi-row"><span class="mi-lbl">Age Group</span><span class="mi-val">' + (mem.age_group || '\u2014') + '</span></div>' +
        '<div class="mi-row"><span class="mi-lbl">Membership</span><span class="mi-val">' + (mem.membership_type || '\u2014') + '</span></div>' +
        '<div class="mi-row"><span class="mi-lbl">Joined</span><span class="mi-val">' + (mem.join_date || '\u2014') + '</span></div>' +
        '<div class="mi-row"><span class="mi-lbl">Tenure</span><span class="mi-val">' + (mem.tenure_bucket || '\u2014') + '</span></div>' +
        '<div class="mi-row"><span class="mi-lbl">Handicap</span><span class="mi-val">' + (mem.handicap != null ? mem.handicap : '\u2014') + '</span></div>' +
        '<div class="mi-row"><span class="mi-lbl">City</span><span class="mi-val">' + (mem.city || '\u2014') + '</span></div>' +
      '</div>';

    // Equipment section
    var hasEquip = mem.driver || mem.woods || mem.irons || mem.wedges || mem.putter || mem.ball;
    if (hasEquip) {
      memberBlock += '<div class="modal-section-title">Equipment</div><div class="member-info-box"><div class="equip-grid">';
      [['Driver', mem.driver], ['Woods', mem.woods], ['Irons', mem.irons], ['Wedges', mem.wedges], ['Putter', mem.putter], ['Ball', mem.ball]].forEach(function(e) {
        if (e[1]) memberBlock += '<div class="mi-row"><span class="mi-lbl">' + e[0] + '</span><span class="mi-val">' + e[1] + '</span></div>';
      });
      memberBlock += '</div></div>';
    }

    memberBlock += '<button class="lookup-btn" onclick="openCurrentInLookup()">Open in Member Lookup \u2192</button>';
  } else {
    memberBlock =
      '<div class="modal-section-title">Member Database</div>' +
      '<div style="font-size:.75rem;color:var(--muted);padding:10px;background:var(--bg);border-radius:4px;line-height:1.6">Name not matched in member database.</div>';
  }

  document.getElementById('modalName').textContent = m.name;
  document.getElementById('modalBody').innerHTML =
    '<div class="modal-stat-grid">' +
      '<div class="modal-stat"><div class="modal-stat-val">' + fmtFull(m.total) + '</div><div class="modal-stat-lbl">Total Spend</div></div>' +
      '<div class="modal-stat"><div class="modal-stat-val">' + m.transactions + '</div><div class="modal-stat-lbl">Transactions</div></div>' +
      '<div class="modal-stat"><div class="modal-stat-val">' + (avgTx > 0 ? fmtFull(avgTx) : '$0') + '</div><div class="modal-stat-lbl">Avg per Visit</div></div>' +
    '</div>' +
    '<div class="modal-chart-wrap"><canvas id="modalMixChart"></canvas></div>' +
    '<div class="modal-section-title">Summary</div>' +
    '<div class="modal-row"><span class="modal-row-lbl">Segment</span><span class="modal-row-val"><span class="seg ' + s + '">' + segEmoji(s) + ' ' + segLabel(s) + '</span></span></div>' +
    '<div class="modal-row"><span class="modal-row-lbl" style="color:var(--fnb);font-weight:700">F&amp;B Total</span><span class="modal-row-val" style="color:var(--fnb)">' + fmtFull(m.fnb) + (m.total > 0 ? ' (' + Math.round(m.fnb / m.total * 100) + '%)' : '') + '</span></div>' +
    '<div class="modal-row"><span class="modal-row-lbl" style="color:var(--shop);font-weight:700">Pro Shop Total</span><span class="modal-row-val" style="color:var(--shop)">' + fmtFull(m.proshop) + (m.total > 0 ? ' (' + Math.round(m.proshop / m.total * 100) + '%)' : '') + '</span></div>' +
    '<div class="modal-row"><span class="modal-row-lbl" style="color:var(--golf);font-weight:700">Golf Total</span><span class="modal-row-val" style="color:var(--golf)">' + fmtFull(m.golf) + (m.total > 0 ? ' (' + Math.round(m.golf / m.total * 100) + '%)' : '') + '</span></div>' +
    '<div class="modal-section-title" style="color:var(--fnb)">F&amp;B Breakdown</div>' +
    groupRows(groups, FNB_GROUPS, 'var(--fnb)') +
    '<div class="modal-section-title" style="color:var(--shop)">Pro Shop Breakdown</div>' +
    groupRows(groups, SHOP_GROUPS, 'var(--shop)') +
    '<div class="modal-section-title" style="color:var(--golf)">Golf Breakdown</div>' +
    groupRows(groups, GOLF_GROUPS, 'var(--golf)') +
    (otherRows ? '<div class="modal-section-title">Other</div>' + otherRows : '') +
    memberBlock;

  document.getElementById('detailModal').classList.remove('hidden');

  // Build mini doughnut in modal
  if (m.total > 0) {
    setTimeout(function() {
      var ctx = document.getElementById('modalMixChart');
      if (ctx) {
        new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['F&B', 'Pro Shop', 'Golf', 'Other'],
            datasets: [{
              data: [m.fnb, m.proshop, m.golf, Math.max(0, m.total - m.fnb - m.proshop - m.golf)],
              backgroundColor: [CAT_COLORS.fnb, CAT_COLORS.shop, CAT_COLORS.golf, CAT_COLORS.other],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '55%',
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + fmtFull(ctx.parsed); } } }
            }
          }
        });
      }
    }, 50);
  }
}

function openCurrentInLookup() {
  var m = null;
  for (var i = 0; i < DATA.length; i++) {
    if (DATA[i].id === window._detailMemberId) { m = DATA[i]; break; }
  }
  if (m && m._matched) {
    sessionStorage.setItem('memberLookupSearch', m._member.first + ' ' + m._member.last);
    window.location.href = '../member-lookup/index.html';
  }
}

// ── renderAll ────────────────────────────────────────────────────────────────

function renderAll() {
  updateFilterSummary();

  var tab = S.activeTab;
  if (tab === 'members') {
    renderMemberTable();
  }
  if (tab === 'overview') {
    buildOverviewKPIs();
    buildDistChart();
    buildCatChart();
    buildTop20Chart();
    buildParetoChart();
    buildOverviewInsights();
  }
  if (tab === 'segments') {
    buildSegLists();
    buildSegTable();
    buildSegPie();
    buildSegRevenueChart();
  }
  if (tab === 'categories') {
    buildCatSummaryCards();
    buildAllCategoriesChart();
    buildSubCatChart('fnbSubChart', FNB_GROUPS, CAT_COLORS.fnb);
    buildSubCatChart('shopSubChart', SHOP_GROUPS, CAT_COLORS.shop);
    buildSubCatChart('golfSubChart', GOLF_GROUPS, CAT_COLORS.golf);
    buildCatInsights();
  }
  if (tab === 'demographics') {
    buildDemoNotice();
    buildDemoBarChart('demoAgeChart', 'age_group', false);
    buildDemoBarChart('demoGenderChart', 'gender', false);
    buildDemoBarChart('demoTenureChart', 'tenure_bucket', true);
    buildDemoBarChart('demoTypeChart', 'membership_type', true);
    buildDemoBarChart('demoAvgAgeChart', 'age_group', true);
    buildDemoCatMixChart();
    buildDemoTable();
  }
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

  // Pre-populate search if redirected from another tool
  var preSearch = sessionStorage.getItem('spendToolSearch');
  if (preSearch) {
    document.getElementById('sSearch').value = preSearch;
    S.search = preSearch;
    sessionStorage.removeItem('spendToolSearch');
    renderAll();
  }
});
