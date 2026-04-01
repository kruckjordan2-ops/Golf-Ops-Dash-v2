/* VGC Competition Data — app.js */
const D = window.COMPETITION_DATA;
const S = D.summary;
const CATS = D.byCategory.map(c => c.name);
const AGE_LABELS = D.byAge.map(a => a.name);

const NAVY   = '#2b335c';
const NAVY3  = '#3d4678';
const SILVER = '#898b8d';
const GREEN  = '#2e7d32';
const AMBER  = '#e65100';
const PALETTE = [NAVY,'#4a5490',NAVY3,'#6b74a8','#9099c5',SILVER,'#b0b2bc'];

Chart.defaults.font.family = "'Open Sans',Arial,sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.color       = '#6b6d7a';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding  = 14;

const SC = {
  x: {grid:{display:false},ticks:{color:'#6b6d7a'}},
  y: {grid:{color:'#eeeff3'},ticks:{color:'#6b6d7a'},border:{display:false}},
};

// ── Filter state ─────────────────────────────────────────────────────────────
const F = { category:'all', ageBracket:'all', search:'' };
let sortCol = 'totalRounds', sortDir = -1;
const charts = {};

function fmtN(n){ return n==null?'—':Math.round(n).toLocaleString(); }
function fmtP(n){ return n==null?'—':(n*100).toFixed(1)+'%'; }

// ── Filtered members ─────────────────────────────────────────────────────────
function filtered(){
  return D.members.filter(m => {
    if(F.category!=='all' && m.category!==F.category) return false;
    if(F.ageBracket!=='all' && m.ageBracket!==F.ageBracket) return false;
    if(F.search && !m.name.toLowerCase().includes(F.search.toLowerCase())) return false;
    return true;
  });
}

function filteredSummary(){
  const list = filtered();
  const comp   = list.reduce((s,m) => s + m.compRounds, 0);
  const social = list.reduce((s,m) => s + m.socialRounds, 0);
  const total  = comp + social;
  const activeComp   = list.filter(m => m.compRounds > 0).length;
  const activeSocial = list.filter(m => m.socialRounds > 0).length;
  return {
    count: list.length, comp, social, total,
    avgComp:   activeComp   ? +(comp / activeComp).toFixed(1) : 0,
    avgSocial: activeSocial ? +(social / activeSocial).toFixed(1) : 0,
    compPct: total ? comp / total : 0,
    compOnly:   list.filter(m => m.compRounds > 0 && m.socialRounds === 0).length,
    socialOnly: list.filter(m => m.socialRounds > 0 && m.compRounds === 0).length,
    both:       list.filter(m => m.compRounds > 0 && m.socialRounds > 0).length,
  };
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function showTab(id){
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  if(event && event.currentTarget) event.currentTarget.classList.add('active');
  renderTab(id);
}

function renderTab(id){
  if(id==='overview')  renderOverview();
  if(id==='members')   renderMembers();
  if(id==='category')  renderCategory();
  if(id==='age')       renderAge();
}

function renderActive(){
  const active = document.querySelector('.panel.active')?.id?.replace('tab-','');
  if(active) renderTab(active);
}

// ── Filter control ────────────────────────────────────────────────────────────
function setFilter(key, val){
  F[key] = val;
  const segId = key === 'category' ? 'catSeg' : 'ageSeg';
  document.querySelectorAll('#'+segId+' .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
  updateFilterSummary();
  updateHeader();
  renderActive();
}

function applyFilters(){
  F.search = document.getElementById('searchInput').value;
  updateFilterSummary();
  updateHeader();
  renderActive();
}

function resetFilters(){
  F.category = 'all'; F.ageBracket = 'all'; F.search = '';
  document.getElementById('searchInput').value = '';
  document.querySelectorAll('.seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === 'all');
  });
  updateFilterSummary();
  updateHeader();
  renderActive();
}

function updateFilterSummary(){
  const chips = [];
  if(F.category !== 'all') chips.push(F.category);
  if(F.ageBracket !== 'all') chips.push(F.ageBracket);
  if(F.search) chips.push('"'+F.search+'"');
  document.getElementById('filterSummary').innerHTML = chips.length
    ? chips.map(c => `<span class="filter-chip">${c}</span>`).join('') : '';
}

function updateHeader(){
  const s = filteredSummary();
  document.getElementById('hdrTotal').textContent = fmtN(s.count) + ' members';
}

// ── Chart helper ──────────────────────────────────────────────────────────────
function dc(id){
  if(charts[id]){ charts[id].destroy(); delete charts[id]; }
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function renderOverview(){
  const s = filteredSummary();
  const list = filtered();

  // KPIs
  document.getElementById('kpiRow').innerHTML = [
    kpi('Active Members', fmtN(s.count), `of ${fmtN(S.totalMembers)} total`, ''),
    kpi('Competition Rounds', fmtN(s.comp), fmtP(s.compPct)+' of total', 's1'),
    kpi('Social Rounds', fmtN(s.social), fmtP(1-s.compPct)+' of total', 's2'),
    kpi('Avg Comp / Member', s.avgComp.toFixed(1), 'rounds per active comp player', 's3'),
    kpi('Avg Social / Member', s.avgSocial.toFixed(1), 'rounds per active social player', 's4'),
    kpi('Total Rounds', fmtN(s.total), fmtN(s.count)+' members', 's5'),
  ].join('');

  // Category stacked bar
  const catData = aggregateByField(list, 'category');
  dc('catStackChart');
  charts.catStackChart = new Chart(document.getElementById('catStackChart'), {
    type: 'bar',
    data: {
      labels: catData.map(c => c.name),
      datasets: [
        {label:'Competition', data:catData.map(c => c.comp), backgroundColor:NAVY},
        {label:'Social',      data:catData.map(c => c.social), backgroundColor:'#9099c5'},
      ]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {x:{stacked:true,...SC.x}, y:{stacked:true,grid:{display:false},ticks:{color:'#6b6d7a'}}},
      plugins: {legend:{position:'top'}}
    }
  });

  // Doughnut split
  dc('splitChart');
  charts.splitChart = new Chart(document.getElementById('splitChart'), {
    type: 'doughnut',
    data: {
      labels: ['Competition','Social'],
      datasets: [{data:[s.comp, s.social], backgroundColor:[NAVY,'#9099c5'], borderWidth:0}]
    },
    options: {responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{legend:{position:'bottom'}}}
  });

  // Engagement doughnut
  dc('engagementChart');
  charts.engagementChart = new Chart(document.getElementById('engagementChart'), {
    type: 'doughnut',
    data: {
      labels: ['Both Comp & Social','Comp Only','Social Only'],
      datasets: [{data:[s.both, s.compOnly, s.socialOnly], backgroundColor:[NAVY,NAVY3,'#9099c5'], borderWidth:0}]
    },
    options: {responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{legend:{position:'bottom'}}}
  });

  // Top 20 comp players
  const top20 = [...list].sort((a,b) => b.compRounds - a.compRounds).slice(0,20);
  dc('topCompChart');
  charts.topCompChart = new Chart(document.getElementById('topCompChart'), {
    type: 'bar',
    data: {
      labels: top20.map(m => m.name),
      datasets: [
        {label:'Competition', data:top20.map(m => m.compRounds), backgroundColor:NAVY},
        {label:'Social',      data:top20.map(m => m.socialRounds), backgroundColor:'#9099c5'},
      ]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {x:{stacked:true,...SC.x}, y:{stacked:true,grid:{display:false},ticks:{color:'#6b6d7a',font:{size:10}}}},
      plugins: {legend:{position:'top'}}
    }
  });
}

function kpi(label, value, sub, cls){
  return `<div class="kpi ${cls}"><div class="kpi-lbl">${label}</div><div class="kpi-val">${value}</div><div class="kpi-sub">${sub}</div></div>`;
}

// ── Members tab ───────────────────────────────────────────────────────────────
function renderMembers(){
  const list = filtered();
  const sorted = [...list].sort((a,b) => {
    const av = a[sortCol], bv = b[sortCol];
    if(typeof av === 'string') return sortDir * av.localeCompare(bv);
    return sortDir * (av - bv);
  });

  const maxTotal = Math.max(...sorted.map(m => m.totalRounds), 1);
  const tbody = document.getElementById('memberTbody');
  tbody.innerHTML = sorted.map(m => `<tr>
    <td>${m.name}</td>
    <td><span class="badge-cat">${m.category}</span></td>
    <td>${m.age||'—'}</td>
    <td>${fmtN(m.compRounds)}</td>
    <td>${fmtN(m.socialRounds)}</td>
    <td>${fmtN(m.totalRounds)}<span class="bar-mini"><span class="bar-mini-fill" style="width:${(m.totalRounds/maxTotal*100).toFixed(1)}%"></span></span></td>
    <td>${fmtP(m.compPct)}</td>
  </tr>`).join('');

  document.getElementById('memberTableSub').textContent =
    `${fmtN(sorted.length)} members — click column headers to sort`;

  // Update sort indicators
  document.querySelectorAll('#memberTable th').forEach(th => {
    th.classList.remove('sort-asc','sort-desc');
    if(th.dataset.col === sortCol) th.classList.add(sortDir > 0 ? 'sort-asc' : 'sort-desc');
  });
}

function sortTable(col){
  if(sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = col === 'name' || col === 'category' ? 1 : -1; }
  renderMembers();
}

// ── Category tab ──────────────────────────────────────────────────────────────
function renderCategory(){
  const list = filtered();
  const catData = aggregateByField(list, 'category');

  // Summary tiles
  const topCat = catData[0];
  document.getElementById('catKPIs').innerHTML = [
    sumTile(fmtN(catData.length), 'Categories', 1),
    sumTile(topCat ? topCat.name : '—', 'Largest Category', 1),
    sumTile(topCat ? fmtN(topCat.total) : '—', 'Rounds (Top Cat)', 1),
    sumTile(topCat ? fmtP(topCat.compPct) : '—', 'Comp % (Top Cat)', 1),
  ].join('');

  // Avg rounds grouped bar
  dc('catAvgChart');
  charts.catAvgChart = new Chart(document.getElementById('catAvgChart'), {
    type: 'bar',
    data: {
      labels: catData.map(c => c.name),
      datasets: [
        {label:'Avg Comp', data:catData.map(c => c.avgComp), backgroundColor:NAVY},
        {label:'Avg Social', data:catData.map(c => c.avgSocial), backgroundColor:'#9099c5'},
      ]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {x:{...SC.x}, y:{grid:{display:false},ticks:{color:'#6b6d7a'}}},
      plugins: {legend:{position:'top'}}
    }
  });

  // Comp % bar
  dc('catCompPctChart');
  charts.catCompPctChart = new Chart(document.getElementById('catCompPctChart'), {
    type: 'bar',
    data: {
      labels: catData.map(c => c.name),
      datasets: [{label:'Competition %', data:catData.map(c => +(c.compPct*100).toFixed(1)), backgroundColor:NAVY}]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {x:{grid:{display:false},ticks:{color:'#6b6d7a'}}, y:{...SC.y, max:100}},
      plugins: {legend:{display:false}}
    }
  });
}

// ── Age tab ───────────────────────────────────────────────────────────────────
function renderAge(){
  const list = filtered();
  const ageData = aggregateByField(list, 'ageBracket', AGE_LABELS);

  // Summary tiles
  const largest = [...ageData].sort((a,b) => b.count - a.count)[0];
  document.getElementById('ageKPIs').innerHTML = [
    sumTile(fmtN(ageData.length), 'Age Brackets', 1),
    sumTile(largest ? largest.name : '—', 'Largest Bracket', 1),
    sumTile(largest ? fmtN(largest.count)+' members' : '—', 'In Largest', 1),
    sumTile(largest ? fmtP(largest.compPct) : '—', 'Comp % (Largest)', 1),
  ].join('');

  // Stacked bar
  dc('ageStackChart');
  charts.ageStackChart = new Chart(document.getElementById('ageStackChart'), {
    type: 'bar',
    data: {
      labels: ageData.map(a => a.name),
      datasets: [
        {label:'Competition', data:ageData.map(a => a.comp), backgroundColor:NAVY},
        {label:'Social',      data:ageData.map(a => a.social), backgroundColor:'#9099c5'},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {x:{stacked:true,...SC.x}, y:{stacked:true,...SC.y}},
      plugins: {legend:{position:'top'}}
    }
  });

  // Avg rounds grouped
  dc('ageAvgChart');
  charts.ageAvgChart = new Chart(document.getElementById('ageAvgChart'), {
    type: 'bar',
    data: {
      labels: ageData.map(a => a.name),
      datasets: [
        {label:'Avg Comp', data:ageData.map(a => a.avgComp), backgroundColor:NAVY},
        {label:'Avg Social', data:ageData.map(a => a.avgSocial), backgroundColor:'#9099c5'},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {x:{...SC.x}, y:{...SC.y}},
      plugins: {legend:{position:'top'}}
    }
  });

  // Member count
  dc('ageCountChart');
  charts.ageCountChart = new Chart(document.getElementById('ageCountChart'), {
    type: 'bar',
    data: {
      labels: ageData.map(a => a.name),
      datasets: [{label:'Members', data:ageData.map(a => a.count), backgroundColor:NAVY3}]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {x:{...SC.x}, y:{...SC.y}},
      plugins: {legend:{display:false}}
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function aggregateByField(list, field, orderLabels){
  const agg = {};
  for(const m of list){
    const key = m[field] || 'Unknown';
    if(!agg[key]) agg[key] = {name:key, comp:0, social:0, count:0};
    agg[key].comp   += m.compRounds;
    agg[key].social += m.socialRounds;
    agg[key].count  += 1;
  }
  let result = Object.values(agg);
  for(const r of result){
    r.total   = r.comp + r.social;
    r.avgComp   = r.count ? +(r.comp / r.count).toFixed(1) : 0;
    r.avgSocial = r.count ? +(r.social / r.count).toFixed(1) : 0;
    r.compPct   = r.total ? r.comp / r.total : 0;
  }
  if(orderLabels){
    result = orderLabels.map(l => result.find(r => r.name === l)).filter(Boolean);
  } else {
    result.sort((a,b) => b.total - a.total);
  }
  return result;
}

function sumTile(val, lbl, pct){
  return `<div class="sum-tile"><div class="sum-tile-val">${val}</div><div class="sum-tile-lbl">${lbl}</div></div>`;
}

// ── Build sidebar filter buttons ──────────────────────────────────────────────
function buildSidebar(){
  const catSeg = document.getElementById('catSeg');
  let html = '<div class="seg-row"><button class="seg-btn active" data-val="all" onclick="setFilter(\'category\',\'all\')">All</button></div>';
  for(const c of CATS){
    html += `<div class="seg-row"><button class="seg-btn" data-val="${c}" onclick="setFilter('category','${c}')">${c}</button></div>`;
  }
  catSeg.innerHTML = html;

  const ageSeg = document.getElementById('ageSeg');
  let ageHtml = '<div class="seg-row"><button class="seg-btn active" data-val="all" onclick="setFilter(\'ageBracket\',\'all\')">All</button></div>';
  for(const a of AGE_LABELS){
    ageHtml += `<div class="seg-row"><button class="seg-btn" data-val="${a}" onclick="setFilter('ageBracket','${a}')">${a}</button></div>`;
  }
  ageSeg.innerHTML = ageHtml;
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init(){
  document.getElementById('hdrRange').textContent = D.meta.period;
  document.getElementById('hdrTotal').textContent = fmtN(S.totalMembers) + ' members';
  buildSidebar();
  renderOverview();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
