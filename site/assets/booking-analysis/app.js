/* VGC Booking Analysis — app.js */
const D = window.BOOKING_DATA;
const MONTHS = D.meta.months;
const DOW    = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const DOW_S  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOURS  = Array.from({length:13},(_,i)=>String(i+6)); // "6".."18"
const HOUR_L = HOURS.map(h=>{ const n=+h; return n<12?n+' AM':n===12?'12 PM':(n-12)+' PM'; });

const NAVY   = '#2b335c';
const NAVY3  = '#3d4678';
const SILVER = '#898b8d';
const GREEN  = '#2e7d32';
const AMBER  = '#e65100';
const PALETTE= [NAVY,'#4a5490',NAVY3,'#6b74a8','#9099c5',SILVER,'#b0b2bc'];

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
const F = { month:'all', comp:'all', player:'all', gender:'all' };
let sortCol='total', sortDir=-1;
const charts = {};

function fmtN(n){ return n==null?'—':n.toLocaleString(); }
function fmtP(n){ return n==null?'—':(n*100).toFixed(1)+'%'; }
function pct(a,b){ return b?a/b:0; }

// ── Filtered data helpers ────────────────────────────────────────────────────

/** Return the active months as array */
function activeMos(){ return F.month==='all'? MONTHS : [F.month]; }

/** Get a scalar from a sub-object based on comp filter */
function cv(obj){
  if(!obj) return 0;
  if(F.comp==='comp')   return obj.comp   || 0;
  if(F.comp==='social') return obj.social || 0;
  return obj.total || 0;
}

/** Sum DOW data across active months */
function dowData(dow){
  if(F.month==='all') return D.by_dow[dow];
  return D.by_month_dow[F.month]?.[dow] || {total:0,comp:0,social:0,checked_in:0};
}

/** Sum hour data across active months */
function hourData(h){
  if(F.month==='all') return D.by_hour[h];
  return D.by_month_hour[F.month]?.[h] || {total:0,comp:0,social:0};
}

/** Aggregate month data for active months */
function monthTotals(mo){
  return D.by_month[mo] || {total:0,comp:0,social:0,checked_in:0,no_shows:0,visitors:0};
}

/** Total across active months for a field */
function sumMos(field){
  return activeMos().reduce((s,m)=>{
    const obj = D.by_month[m] || {};
    if(F.comp==='comp')   return s + (field==='total'? obj.comp   : obj[field]||0);
    if(F.comp==='social') return s + (field==='total'? obj.social : obj[field]||0);
    return s + (obj[field]||0);
  },0);
}

/** Category data for active months */
function catData(){
  if(F.month==='all'){
    return D.by_category.map(c=>({
      name:c.name, total:c.total, comp:c.comp, social:c.social, checked_in:c.checked_in
    }));
  }
  const mc = D.by_month_cat[F.month] || {};
  return Object.entries(mc).map(([name,v])=>({name,...v})).sort((a,b)=>b.total-a.total);
}

/** Gender data — comp filter applies */
function genderData(){
  return Object.entries(D.by_gender).map(([g,v])=>({
    name:g, total:cv(v), raw:v
  })).filter(x=>x.total>0);
}

/** KPI totals across active months + comp filter */
function kpiTotals(){
  const total      = sumMos('total');
  const checked_in = F.comp==='all' ? sumMos('checked_in') : null; // no comp-level checkin
  const no_shows   = F.comp==='all' ? sumMos('no_shows')   : null;
  const visitors   = F.comp==='all' ? sumMos('visitors')   : null;
  const comp       = F.comp==='all' ? sumMos('comp')        : (F.comp==='comp'?total:0);
  const social     = F.comp==='all' ? sumMos('social')      : (F.comp==='social'?total:0);
  return {total, checked_in, no_shows, visitors, comp, social};
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function showTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  event.currentTarget.classList.add('active');
  renderTab(id);
}

function renderTab(id){
  if(id==='overview')     { buildKPIs(); buildMonthChart(); buildGenderChart(); buildCheckInMonth(); buildClubList(); }
  if(id==='time')         { buildHourChart(); buildDowChart(); buildCheckInDow(); }
  if(id==='members')      { buildCatChart(); buildMemberTable(); }
  if(id==='participation'){ buildParticipationKPIs(); buildCompMonth(); buildCompDow(); buildNoShowDow(); buildCompCat(); }
}

// ── Filter control ─────────────────────────────────────────────────────────────
function setFilter(key, val){
  F[key] = val;
  document.querySelectorAll(`#${key==='month'?'month':key==='comp'?'comp':key==='player'?'visitor':key==='gender'?'gender':''}Seg .seg-btn`).forEach(b=>{
    b.classList.toggle('active', b.dataset.val===val);
  });
  updateFilterSummary();
  renderActive();
}

function resetFilters(){
  F.month='all'; F.comp='all'; F.player='all'; F.gender='all';
  ['monthSeg','compSeg','visitorSeg','genderSeg'].forEach(id=>{
    document.querySelectorAll('#'+id+' .seg-btn').forEach(b=>{
      b.classList.toggle('active', b.dataset.val==='all');
    });
  });
  updateFilterSummary();
  renderActive();
}

function updateFilterSummary(){
  const chips=[];
  if(F.month!=='all')  chips.push(F.month);
  if(F.comp!=='all')   chips.push(F.comp==='comp'?'Competition':'Social');
  if(F.player!=='all') chips.push(F.player==='members'?'Members only':'Visitors only');
  if(F.gender!=='all') chips.push(F.gender);
  const el=document.getElementById('filterSummary');
  el.innerHTML = chips.length
    ? chips.map(c=>`<span class="filter-chip">🔍 ${c}</span>`).join('')
    : '';
}

function renderActive(){
  const active = document.querySelector('.panel.active')?.id?.replace('tab-','');
  if(active) renderTab(active);
}

// ── Chart helper ──────────────────────────────────────────────────────────────
function mkChart(id, type, data, opts={}){
  if(charts[id]){ charts[id].destroy(); delete charts[id]; }
  const ctx = document.getElementById(id)?.getContext('2d');
  if(!ctx) return;
  charts[id] = new Chart(ctx, {type, data,
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:true},...(opts.plugins||{})},
      scales:opts.scales||{}, ...opts}});
}

// ── OVERVIEW ─────────────────────────────────────────────────────────────────
function buildKPIs(){
  const k = kpiTotals();
  const ci_rate = k.checked_in!=null && k.total ? k.checked_in/k.total : null;
  const comp_pct = k.total ? k.comp/k.total : null;

  const kpis=[
    {l:'Total Bookings',    v:fmtN(k.total),   s:D.meta.date_range,          cls:''},
    {l:'Check-in Rate',     v:ci_rate!=null?fmtP(ci_rate):'—', s:ci_rate!=null?fmtN(k.checked_in)+' checked in':'Filtered', cls:'s1'},
    {l:'Comp Bookings',     v:fmtN(k.comp),    s:comp_pct!=null?fmtP(comp_pct)+' of total':'', cls:'s2'},
    {l:'Social Bookings',   v:fmtN(k.social),  s:comp_pct!=null?fmtP(1-comp_pct)+' of total':'', cls:'s3'},
    {l:'Unique Members',    v:fmtN(D.totals.unique_members), s:'Distinct member numbers', cls:'s4'},
    {l:'Visitor Bookings',  v:k.visitors!=null?fmtN(k.visitors):'—',
      s:k.visitors!=null&&k.total?fmtP(k.visitors/k.total)+' of bookings':'', cls:'s5'},
  ];
  document.getElementById('kpiRow').innerHTML =
    kpis.map(k=>`<div class="kpi ${k.cls}"><div class="kpi-lbl">${k.l}</div>
      <div class="kpi-val">${k.v}</div><div class="kpi-sub">${k.s}</div></div>`).join('');

  document.getElementById('hdrTotal').textContent = fmtN(k.total)+' bookings';
}

function buildMonthChart(){
  const mos = activeMos();
  document.getElementById('monthSub').textContent = F.comp==='all'?'Comp vs Social split':'Showing '+F.comp+' rounds';
  const compVals  = mos.map(m=>D.by_month[m]?.comp  || 0);
  const socVals   = mos.map(m=>D.by_month[m]?.social || 0);
  const datasets  = F.comp==='all'
    ? [{label:'Competition',data:compVals,backgroundColor:NAVY+'dd'},
       {label:'Social',     data:socVals, backgroundColor:SILVER+'cc'}]
    : [{label:F.comp==='comp'?'Competition':'Social',
        data:mos.map(m=>F.comp==='comp'?D.by_month[m]?.comp:D.by_month[m]?.social||0),
        backgroundColor:NAVY+'dd'}];
  mkChart('monthChart','bar',{labels:mos, datasets},{
    scales:{x:SC.x,y:SC.y},
    plugins:{legend:{display:F.comp==='all'},tooltip:{callbacks:{
      afterBody:items=>{ const t=items.reduce((s,i)=>s+i.raw,0);
        const mo=mos[items[0].dataIndex];
        const ci=D.by_month[mo]?.checked_in||0;
        return [`Check-in: ${fmtP(pct(ci,D.by_month[mo]?.total))}`];
      }
    }}},
    stacked:F.comp==='all',
  });
}

function buildGenderChart(){
  const gd = genderData();
  const filtered = F.gender==='all'? gd : gd.filter(g=>g.name===F.gender);
  mkChart('genderChart','doughnut',{
    labels: filtered.map(g=>g.name),
    datasets:[{data:filtered.map(g=>g.total),
      backgroundColor:[NAVY,SILVER,'#c5c6cb'],borderWidth:2,borderColor:'#fff'}]
  },{plugins:{legend:{display:true,position:'right'}},scales:{}});
}

function buildCheckInMonth(){
  const mos = activeMos();
  const rates = mos.map(m=>{
    const obj=D.by_month[m];
    return obj?.total? +(obj.checked_in/obj.total*100).toFixed(1) : 0;
  });
  mkChart('checkInMonthChart','bar',{
    labels:mos,
    datasets:[{label:'Check-in %',data:rates,backgroundColor:GREEN+'cc',borderRadius:3}]
  },{
    scales:{x:SC.x,y:{...SC.y,min:0,max:100,ticks:{callback:v=>v+'%'}}},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>i.raw+'%'}}},
  });
}

function buildClubList(){
  const clubs = D.home_clubs.slice(0,10);
  const max   = clubs[0]?.count||1;
  document.getElementById('clubList').innerHTML = clubs.map(c=>`
    <div class="club-row">
      <span class="club-name">${c.name}</span>
      <div class="club-bar"><div class="club-bar-fill" style="width:${(c.count/max*100).toFixed(0)}%"></div></div>
      <span class="club-count">${c.count}</span>
    </div>`).join('');
}

// ── BY TIME ──────────────────────────────────────────────────────────────────
function buildHourChart(){
  const compVals  = HOURS.map(h=>hourData(h).comp  || 0);
  const socVals   = HOURS.map(h=>hourData(h).social || 0);
  const totalVals = HOURS.map(h=>(hourData(h).total || 0));
  const datasets  = F.comp==='all'
    ? [{label:'Competition',data:compVals, backgroundColor:NAVY+'dd',stack:'s'},
       {label:'Social',     data:socVals,  backgroundColor:SILVER+'cc',stack:'s'}]
    : [{label:F.comp==='comp'?'Competition':'Social',
        data:HOURS.map(h=>F.comp==='comp'?hourData(h).comp:hourData(h).social||0),
        backgroundColor:NAVY+'dd'}];
  mkChart('hourChart','bar',{labels:HOUR_L, datasets},{
    scales:{x:SC.x,y:SC.y},
    plugins:{legend:{display:F.comp==='all'},
      tooltip:{callbacks:{footer:items=>{
        const total=F.comp==='all'?totalVals[items[0].dataIndex]:items[0].raw;
        return `Total: ${fmtN(total)}`;
      }}}},
  });
}

function buildDowChart(){
  const compVals  = DOW.map(d=>dowData(d).comp  || 0);
  const socVals   = DOW.map(d=>dowData(d).social || 0);
  const datasets  = F.comp==='all'
    ? [{label:'Competition',data:compVals, backgroundColor:NAVY+'dd',stack:'s'},
       {label:'Social',     data:socVals,  backgroundColor:SILVER+'cc',stack:'s'}]
    : [{label:F.comp==='comp'?'Competition':'Social',
        data:DOW.map(d=>F.comp==='comp'?dowData(d).comp:dowData(d).social||0),
        backgroundColor:NAVY+'dd'}];
  mkChart('dowChart','bar',{labels:DOW_S, datasets},{
    scales:{x:SC.x,y:SC.y},
    plugins:{legend:{display:F.comp==='all'}},
  });
}

function buildCheckInDow(){
  const rates = DOW.map(d=>{
    const obj=dowData(d);
    return obj?.total? +(obj.checked_in/obj.total*100).toFixed(1): 0;
  });
  const colors = rates.map(r=>r>=85?GREEN+'cc':r>=70?AMBER+'cc':NAVY+'99');
  mkChart('checkInDowChart','bar',{
    labels:DOW_S,
    datasets:[{label:'Check-in %',data:rates,backgroundColor:colors,borderRadius:3}]
  },{
    scales:{x:SC.x,y:{...SC.y,min:0,max:100,ticks:{callback:v=>v+'%'}}},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>i.raw+'%'}}},
  });
}

// ── BY MEMBER ────────────────────────────────────────────────────────────────
function buildCatChart(){
  let cats = catData();
  if(F.comp==='comp')   cats = cats.map(c=>({...c,total:c.comp}));
  if(F.comp==='social') cats = cats.map(c=>({...c,total:c.social}));
  cats = cats.sort((a,b)=>b.total-a.total).slice(0,10);
  const compD = cats.map(c=>Math.min(c.comp,c.total));
  const socD  = cats.map(c=>Math.max(0,c.total-c.comp));

  const datasets = F.comp==='all'
    ? [{label:'Competition',data:compD,backgroundColor:NAVY+'dd'},
       {label:'Social',     data:socD, backgroundColor:SILVER+'cc'}]
    : [{label:F.comp==='comp'?'Competition':'Social',
        data:cats.map(c=>c.total), backgroundColor:NAVY+'dd'}];

  mkChart('catChart','bar',{labels:cats.map(c=>c.name), datasets},{
    indexAxis:'y',
    scales:{x:SC.y, y:{...SC.x,ticks:{color:'#1e2230',font:{weight:'600'}}}},
    plugins:{legend:{display:F.comp==='all'}},
  });
}

function buildMemberTable(){
  let members = [...D.top_members];

  // Apply gender filter
  if(F.gender==='Male')   members = members.filter(m=>m.gender==='Male');
  if(F.gender==='Female') members = members.filter(m=>m.gender==='Female');
  // Visitors aren't in top_members (all members), player filter doesn't apply

  // Apply comp filter
  if(F.comp==='comp')   members = members.map(m=>({...m,total:m.comp,social:0}));
  if(F.comp==='social') members = members.map(m=>({...m,total:m.social,comp:0}));

  // Sort
  const key = sortCol==='no_show'?'no_show':sortCol;
  members = members.map(m=>({...m,no_show:m.total-m.checked_in}));
  members.sort((a,b)=>sortDir*(b[key]-a[key]||0));
  if(sortCol==='name'||sortCol==='category') members.sort((a,b)=>sortDir*(a[key]>b[key]?1:-1));

  document.getElementById('memberTableSub').textContent =
    `${D.meta.date_range} · ${members.length} members`+
    (F.gender!=='all'?` · ${F.gender} only`:'')+
    (F.comp!=='all'?` · ${F.comp==='comp'?'Comp':'Social'} only`:'');

  const max = members[0]?.total||1;
  document.getElementById('memberTbody').innerHTML = members.slice(0,100).map(m=>`
    <tr>
      <td>${m.name}</td>
      <td><span class="badge-cat">${m.category}</span></td>
      <td>${fmtN(m.total)}<span class="bar-mini"><span class="bar-mini-fill" style="width:${(m.total/max*100).toFixed(0)}%"></span></span></td>
      <td>${fmtN(m.comp)}</td>
      <td>${fmtN(m.social)}</td>
      <td><span class="rate ${m.total&&(m.checked_in/m.total)>=0.9?'good':m.total&&(m.checked_in/m.total)<0.7?'warn':'neutral'}">${fmtN(m.checked_in)}</span></td>
      <td>${fmtN(m.no_show)}</td>
    </tr>`).join('');

  // Update sort arrows
  document.querySelectorAll('#memberTable th').forEach(th=>{
    th.classList.remove('sort-asc','sort-desc');
    if(th.dataset.col===sortCol) th.classList.add(sortDir>0?'sort-asc':'sort-desc');
  });
}

function sortTable(col){
  if(sortCol===col) sortDir*=-1;
  else { sortCol=col; sortDir=-1; }
  buildMemberTable();
}

// ── PARTICIPATION ─────────────────────────────────────────────────────────────
function buildParticipationKPIs(){
  const k = kpiTotals();
  const tiles=[
    {v:fmtN(k.comp),   l:'Competition Rounds', pct:k.total?k.comp/k.total:0},
    {v:fmtN(k.social), l:'Social Rounds',       pct:k.total?k.social/k.total:0},
    {v:k.checked_in!=null?fmtN(k.total-k.checked_in):'—', l:'Total No-Shows',
      pct:k.checked_in!=null&&k.total?(k.total-k.checked_in)/k.total:0},
    {v:fmtN(D.totals.unique_members), l:'Unique Members', pct:null},
  ];
  document.getElementById('participationKPIs').innerHTML = tiles.map(t=>`
    <div class="sum-tile">
      <div class="sum-tile-val">${t.v}</div>
      <div class="sum-tile-lbl">${t.l}</div>
      ${t.pct!=null?`<div class="sum-tile-bar"><div class="sum-tile-fill" style="width:${(t.pct*100).toFixed(0)}%"></div></div>`:''}
      ${t.pct!=null?`<div style="font-size:.68rem;color:var(--muted);margin-top:3px">${fmtP(t.pct)} of total</div>`:''}
    </div>`).join('');
}

function buildCompMonth(){
  const mos = activeMos();
  mkChart('compMonthChart','bar',{
    labels:mos,
    datasets:[
      {label:'Competition',data:mos.map(m=>D.by_month[m]?.comp  || 0),backgroundColor:NAVY+'dd',stack:'s'},
      {label:'Social',     data:mos.map(m=>D.by_month[m]?.social || 0),backgroundColor:SILVER+'cc',stack:'s'},
    ]
  },{scales:{x:SC.x,y:SC.y},plugins:{legend:{display:true}}});
}

function buildCompDow(){
  const rates = DOW.map(d=>{
    const obj=dowData(d);
    return obj?.total? +(obj.comp/obj.total*100).toFixed(1): 0;
  });
  mkChart('compDowChart','bar',{
    labels:DOW_S,
    datasets:[{label:'Comp %',data:rates,
      backgroundColor:DOW.map(d=>{ const r=dowData(d); return r.total&&r.comp/r.total>0.5?NAVY+'dd':NAVY3+'99'; }),
      borderRadius:3}]
  },{
    scales:{x:SC.x,y:{...SC.y,min:0,max:100,ticks:{callback:v=>v+'%'}}},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:i=>i.raw+'%'}}},
  });
}

function buildNoShowDow(){
  const counts = DOW.map(d=>{ const obj=dowData(d); return (obj?.total||0)-(obj?.checked_in||0); });
  const rates  = DOW.map(d=>{ const obj=dowData(d); return obj?.total?+(( 1-obj.checked_in/obj.total)*100).toFixed(1):0; });
  mkChart('noShowDowChart','bar',{
    labels:DOW_S,
    datasets:[{label:'No-shows',data:counts,
      backgroundColor:DOW.map((_,i)=>rates[i]>20?AMBER+'cc':NAVY+'99'),
      borderRadius:3}]
  },{
    scales:{x:SC.x,y:SC.y},
    plugins:{legend:{display:false},tooltip:{callbacks:{
      afterLabel:i=>`${rates[i]}% no-show rate`
    }}},
  });
}

function buildCompCat(){
  let cats = catData();
  cats = cats.sort((a,b)=>b.total-a.total).slice(0,10);
  mkChart('compCatChart','bar',{
    labels:cats.map(c=>c.name),
    datasets:[
      {label:'Competition',data:cats.map(c=>c.comp),  backgroundColor:NAVY+'dd',stack:'s'},
      {label:'Social',     data:cats.map(c=>c.social),backgroundColor:SILVER+'cc',stack:'s'},
    ]
  },{
    indexAxis:'y',
    scales:{x:SC.y, y:{...SC.x,ticks:{color:'#1e2230',font:{weight:'600'}}}},
    plugins:{legend:{display:true}},
  });
}

// ── INIT ─────────────────────────────────────────────────────────────────────
(function init(){
  document.getElementById('hdrRange').textContent = D.meta.date_range;
  document.getElementById('hdrTotal').textContent = fmtN(D.totals.bookings)+' bookings';
  renderTab('overview');
})();
