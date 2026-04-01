const RAW = window.ROUNDS_DASHBOARD_RAW || {};

// ═══════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════


const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const YEARS=Object.keys(RAW).map(Number).filter(n=>!isNaN(n)).sort();

// VGC colour palette for charts — auto-assigned by year index
const _YC_PALETTE=['#2b335c','#5a6090','#898b8d','#3d4678','#b8b9bb','#1e2540'];
const YC={}, YC_A={};
YEARS.forEach((y,i)=>{ YC[y]=_YC_PALETTE[i%_YC_PALETTE.length]; YC_A[y]=YC[y]+'99'; });
const PALETTE=['#2b335c','#5a6090','#898b8d','#3d4678','#b8b9bb','#1e2540','#7a7c8a','#c5c6c8'];
const P=PALETTE;

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let S = {
  year:'all',
  exclude3pm:false,
  periodType:'full',
  period:null,
  months:new Set(MONTHS),
  days:new Set(DAYS),
  metric:'total',
  chartType:'bar',
  compare:{yoy:true,avg:false},
  activeTab:'overview'
};
let charts={};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
const fmtN=n=>Math.round(n||0).toLocaleString();
const fmtP=n=>((n||0)*100).toFixed(1)+'%';
const fmtPct=n=>((n||0)*100).toFixed(0)+'%';
const fmtD=n=>(n||0).toFixed(1);

function dc(id){if(charts[id]){charts[id].destroy();charts[id]=null;}}

function deepMerge(a,b){
  if(!b)return a;
  const r={...a};
  for(const k of Object.keys(b)){
    r[k]=(b[k]&&typeof b[k]==='object'&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==='object')
      ?deepMerge(a[k],b[k]):b[k];
  }
  return r;
}

function mkChart(id,type,data,opts){
  dc(id);
  const el=document.getElementById(id);
  if(!el)return;
  const base={
    responsive:true,maintainAspectRatio:true,
    plugins:{legend:{labels:{font:{family:"'Open Sans',Arial",size:10},boxWidth:12,usePointStyle:true}}},
    scales:{}
  };
  charts[id]=new Chart(el.getContext('2d'),{type,data,options:deepMerge(base,opts||{})});
}

const GRID_COLOR='#e4e5e6';
const SC={x:{grid:{display:false},ticks:{font:{size:9}}},y:{grid:{color:GRID_COLOR},ticks:{font:{size:9}}}};
const SC_STACK={x:{stacked:true,...SC.x},y:{stacked:true,...SC.y}};
const SC_PCT={...SC,y:{...SC.y,ticks:{...SC.y.ticks,callback:v=>v+'%'},suggestedMin:0,suggestedMax:100}};

// ── DATA GETTERS ──────────────────────────────────────
function getYears(){
  // FY spans two calendar years — return both
  if(S.periodType==='fy'&&S.period){
    const fy=parseInt(S.period.replace('fy',''));
    return [fy-1,fy].filter(y=>YEARS.includes(y));
  }
  return S.year==='all'?YEARS:[S.year];
}
const CURRENT_YEAR=new Date().getFullYear();
function getYearsNoPartial(){return getYears().filter(y=>y<CURRENT_YEAR);}

function getActiveMos(){
  if(S.periodType==='full')return [...S.months].map(m=>MONTHS.indexOf(m)+1).filter(n=>n>0);
  if(S.periodType==='q'){
    const qmap={q1:[1,2,3],q2:[4,5,6],q3:[7,8,9],q4:[10,11,12]};
    return (qmap[S.period]||[1,2,3,4,5,6,7,8,9,10,11,12]).filter(m=>[...S.months].includes(MONTHS[m-1]));
  }
  if(S.periodType==='season'){
    const sm={summer:[12,1,2],autumn:[3,4,5],winter:[6,7,8],spring:[9,10,11]};
    return (sm[S.period]||[1,2,3,4,5,6,7,8,9,10,11,12]).filter(m=>[...S.months].includes(MONTHS[m-1]));
  }
  if(S.periodType==='month')return S.period?[parseInt(S.period)]:[1,2,3,4,5,6,7,8,9,10,11,12];
  if(S.periodType==='fy')return [1,2,3,4,5,6,7,8,9,10,11,12];
  return [1,2,3,4,5,6,7,8,9,10,11,12];
}

// For FY: returns which months to use for a given calendar year
function getMosForYear(year){
  if(S.periodType==='fy'&&S.period){
    const fy=parseInt(S.period.replace('fy',''));
    if(year===fy-1) return [7,8,9,10,11,12]; // Jul–Dec of prior year
    if(year===fy)   return [1,2,3,4,5,6];     // Jan–Jun of FY year
    return [];
  }
  return getActiveMos();
}

// Returns [{y,m,label}] for the Jul-Jun sequence of the selected FY, or null
function getFYSeries(){
  if(S.periodType!=='fy'||!S.period) return null;
  const fy=parseInt(S.period.replace('fy',''));
  return [
    ...[7,8,9,10,11,12].map(m=>({y:fy-1,m,label:MO[m-1]})),
    ...[1,2,3,4,5,6]   .map(m=>({y:fy,  m,label:MO[m-1]})),
  ];
}

function fyLabel(){
  if(S.periodType!=='fy'||!S.period)return '';
  const y=parseInt(S.period.replace('fy',''));
  return 'FY'+y+' (Jul '+(y-1)+'–Jun '+y+')';
}

// Sum a key across the FY sequence
function fySum(key){
  const fyS=getFYSeries();
  if(!fyS)return 0;
  return fyS.reduce((s,pt)=>s+mVal(pt.y,pt.m,key),0);
}

// Resolve year for single-year charts: for FY use the end year, else use selection or latest
function resolveDisplayYear(){
  if(S.periodType==='fy'&&S.period) return parseInt(S.period.replace('fy',''));
  return S.year==='all'?YEARS[YEARS.length-1]:S.year;
}

function getActiveDays(){return [...S.days];}

function mVal(year,month,key){
  // If excluding after3pm and key is 'total', subtract after3 from total
  if(S.exclude3pm && key==='total'){
    return (mValRaw(year,month,'total')||0) - (mValRaw(year,month,'after3')||0);
  }
  if(S.exclude3pm && key==='after3') return 0;
  return mValRaw(year,month,key);
}
function mValRaw(year,month,key){
  // Try monthly first, then pivot grand total for that month
  const yd=RAW[year];
  if(!yd)return 0;
  const mn=typeof month==='number'?MONTHS[month-1]:month;
  const v=yd.monthly?.[mn]?.[key];
  if(v!=null&&v!==undefined)return v||0;
  // fallback: sum pivot days for this month
  const pvt=yd.pivot?.[mn];
  if(pvt){
    return Object.values(pvt).reduce((s,d)=>s+(d[key]||0),0);
  }
  return 0;
}

function yVal(year,key){return RAW[year]?.yearly?.[key]||0;}

function dowVal(year,day,key){
  const yd=RAW[year];
  if(!yd)return 0;
  // Try DOW sheet first
  const v=yd.dow?.[day]?.[key];
  if(v)return v;
  // Sum from pivot across all months
  let sum=0;
  for(const mn of MONTHS){
    sum+=(yd.pivot?.[mn]?.[day]?.[key]||0);
  }
  return sum;
}

function sumMos(year,months,key){
  return months.reduce((s,mn)=>s+mVal(year,mn,key),0);
}

function filteredSum(key){
  if(S.periodType==='fy') return fySum(key);
  const mos=getActiveMos();
  const years=getYears();
  return years.reduce((s,y)=>s+sumMos(y,mos,key),0);
}

function filteredSumByYear(year,key){
  return sumMos(year,getMosForYear(year),key);
}

function avgByYear(key){
  const years=getYears();
  const vals=years.map(y=>filteredSumByYear(y,key)).filter(v=>v>0);
  return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
}

function delta(curr,prev){
  if(!prev||!curr)return{txt:'',cls:'flat'};
  const p=((curr-prev)/prev*100);
  return{txt:`${p>=0?'▲':'▼'}${Math.abs(p).toFixed(1)}%`,cls:p>0?'up':'dn'};
}

// ── METRIC LABEL ─────────────────────────────────────
const MLABELS={total:'Total Rounds',am:'AM Field',pm:'PM Field',after3:'After 3pm',
  guests:'Guests',members:'Members',comp:'Competition',corporate:'Corporate',
  event:'Event',memb_intro:'Member Intro',memb_unaccomp:'Memb Unaccomp',
  voucher:'Voucher',recip:'Reciprocal',interstate:'Interstate',intl:'International',
  mgr_intro:'Mgr Intro',non_playing:'Non Playing',industry:'Industry',
  guest_ratio:'Guest Ratio'};

// ═══════════════════════════════════════════════════════
// SIDEBAR INIT
// ═══════════════════════════════════════════════════════
function initSidebar(){
  // Month checkboxes
  const mc=document.getElementById('monthCbs');
  mc.innerHTML=MONTHS.map((m,i)=>`
    <label class="cb-item">
      <input type="checkbox" checked onchange="toggleMonth('${m}',this.checked)" id="cb-mo-${m}">
      <span class="cb-dot" style="background:hsl(${i*30},50%,55%)"></span>
      <span>${m}</span>
    </label>`).join('');
  // Day checkboxes
  const dc2=document.getElementById('dayCbs');
  dc2.innerHTML=DAYS.map(d=>`
    <label class="cb-item">
      <input type="checkbox" checked onchange="toggleDay('${d}',this.checked)" id="cb-day-${d}">
      <span class="cb-dot" style="background:var(--navy)"></span>
      <span>${d}</span>
    </label>`).join('');
}

// ═══════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════
function showTab(id,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('pg-'+id).classList.add('active');
  el.classList.add('active');
  S.activeTab=id;
  document.getElementById('activeTab').textContent=el.textContent;
  renderAll();
}

function setYear(y){
  S.year=y;
  document.querySelectorAll('#yearBtns .seg-btn').forEach((b,i)=>{
    b.classList.toggle('active',['all',...YEARS][i]===y);
  });
  updateFilterSummary();
  renderAll();
}

function setPeriodType(t){
  S.periodType=t;
  document.querySelectorAll('#periodTypeBtns .seg-btn').forEach((b,i)=>{
    b.classList.toggle('active',['full','q','season','month','fy'][i]===t);
  });
  const sub=document.getElementById('periodSubFilters');
  const sel=document.getElementById('periodSel');
  sel.innerHTML='';
  if(t==='full'){sub.style.display='none';S.period=null;}
  else{
    sub.style.display='block';
    if(t==='q'){['Q1 (Jan–Mar)','Q2 (Apr–Jun)','Q3 (Jul–Sep)','Q4 (Oct–Dec)'].forEach((l,i)=>sel.innerHTML+=`<option value="q${i+1}">${l}</option>`);}
    else if(t==='season'){[{v:'summer',l:'☀️ Summer (Dec–Feb)'},{v:'autumn',l:'🍂 Autumn (Mar–May)'},{v:'winter',l:'❄️ Winter (Jun–Aug)'},{v:'spring',l:'🌸 Spring (Sep–Nov)'}].forEach(o=>sel.innerHTML+=`<option value="${o.v}">${o.l}</option>`);}
    else if(t==='month'){MONTHS.forEach((m,i)=>sel.innerHTML+=`<option value="${i+1}">${m}</option>`);}
    else if(t==='fy'){YEARS.filter(y=>y>YEARS[0]).forEach(y=>sel.innerHTML+=`<option value="fy${y}">FY${y} (Jul ${y-1}–Jun ${y})</option>`);}
    S.period=sel.value;
  }
  updateFilterSummary();
  renderAll();
}

function setPeriod(v){S.period=v;updateFilterSummary();renderAll();}
function setMetric(v){S.metric=v;document.getElementById('trendLbl').textContent=MLABELS[v]||v;renderAll();}
function setChartType(t){S.chartType=t;document.querySelectorAll('#chartTypeBtns .seg-btn').forEach((b,i)=>b.classList.toggle('active',['bar','line','stack'][i]===t));renderAll();}
function toggleCompare(k,btn){S.compare[k]=!S.compare[k];btn.classList.toggle('active',S.compare[k]);renderAll();}
function toggleMonth(m,on){on?S.months.add(m):S.months.delete(m);updateFilterSummary();renderAll();}
function toggleDay(d,on){on?S.days.add(d):S.days.delete(d);updateFilterSummary();renderAll();}

function updateFilterSummary(){
  let yr;
  if(S.periodType==='fy'&&S.period){
    yr=fyLabel();
  } else if(S.periodType==='q'&&S.period){
    yr=S.year==='all'?'All Years':String(S.year);
    yr+=` · ${S.period.toUpperCase()}`;
  } else if(S.periodType==='season'&&S.period){
    yr=S.year==='all'?'All Years':String(S.year);
    yr+=` · ${S.period.charAt(0).toUpperCase()+S.period.slice(1)}`;
  } else if(S.periodType==='month'&&S.period){
    yr=(S.year==='all'?'All Years':String(S.year))+' · '+MONTHS[parseInt(S.period)-1];
  } else {
    yr=S.year==='all'?'All Years':String(S.year);
  }
  const mo=S.months.size===12?'All Months':S.months.size+' Months';
  const dy=S.days.size===7?'All Days':S.days.size+' Days';
  document.getElementById('filterSummary').textContent=`${yr} · ${mo} · ${dy}`;
}

function resetFilters(){
  S={...S,year:'all',periodType:'full',period:null,months:new Set(MONTHS),days:new Set(DAYS),metric:'total',chartType:'bar'};
  document.querySelectorAll('#yearBtns .seg-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  document.querySelectorAll('#periodTypeBtns .seg-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  document.getElementById('periodSubFilters').style.display='none';
  document.getElementById('metricSel').value='total';
  document.querySelectorAll('#chartTypeBtns .seg-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  document.querySelectorAll('#monthCbs input').forEach(cb=>cb.checked=true);
  document.querySelectorAll('#dayCbs input').forEach(cb=>cb.checked=true);
  document.getElementById('trendLbl').textContent='Total Rounds';
  updateFilterSummary();
  renderAll();
}

// ═══════════════════════════════════════════════════════
// KPIs
// ═══════════════════════════════════════════════════════
function buildKPIs(){
  const years=getYears();
  const isFY=S.periodType==='fy'&&S.period;
  const fyYear=isFY?parseInt(S.period.replace('fy','')):null;
  const kpis=[
    {k:'total',l:'Total Rounds',cls:''},
    {k:'am',l:'AM Field',cls:'s1'},
    {k:'pm',l:'PM Field',cls:'s2'},
    {k:'after3',l:'After 3pm',cls:'s3'},
    {k:'guests',l:'Guests',cls:'s4'},
    {k:'comp',l:'Competition',cls:'s5'},
    {k:'corporate',l:'Corporate',cls:'s6'},
  ];
  // Total months across all selected years (for avg/day calc)
  const totalMos=years.reduce((s,y)=>s+getMosForYear(y).length,0)||1;
  document.getElementById('kpiRow').innerHTML=kpis.map(({k,l,cls})=>{
    const curr=years.reduce((s,y)=>s+filteredSumByYear(y,k),0);
    const total=years.reduce((s,y)=>s+filteredSumByYear(y,'total'),0);
    // YoY delta: for FY compare FY-1, for single year compare prior year
    let prev=null;
    if(isFY&&fyYear){
      const prevFYYears=[fyYear-2,fyYear-1].filter(y=>YEARS.includes(y));
      prev=prevFYYears.length===2?sumMos(fyYear-2,[7,8,9,10,11,12],k)+sumMos(fyYear-1,[1,2,3,4,5,6],k):null;
    } else if(S.year!=='all'){
      const mos=getActiveMos();
      prev=YEARS.includes(S.year-1)?sumMos(S.year-1,mos,k):null;
    }
    const d=prev?delta(curr,prev):{txt:'',cls:'flat'};
    const periodLbl=isFY?`FY${fyYear}`:S.year==='all'?'All years':String(S.year);
    const sub=k==='total'?`${fmtD(curr/(totalMos*26||1))} avg/day`:
              k==='guests'?`${fmtP(curr/(total||1))} of total`:
              k==='comp'?`${fmtP(curr/(total||1))} of total`:
              k==='after3'&&curr===0?'Tracked from Oct 2025':'';
    const deltaLbl=isFY?`vs FY${fyYear-1}`:S.year!=='all'?`vs ${S.year-1}`:'';
    return `<div class="kpi ${cls}">
      <div class="kpi-lbl">${l}</div>
      <div class="kpi-val">${fmtN(curr)}</div>
      <div class="kpi-sub">${sub}</div>
      ${d.txt?`<div class="kpi-delta ${d.cls}">${d.txt} ${deltaLbl}</div>`:''}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// OVERVIEW CHARTS
// ═══════════════════════════════════════════════════════
function buildMainChart(){
  const fyS=getFYSeries();
  const type=S.chartType==='stack'?'bar':S.chartType;
  const stacked=S.chartType==='stack';
  let labels, ds;
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    labels=fyS.map(pt=>pt.label);
    ds=stacked?[
      {label:`FY${fyYear} AM`,data:fyS.map(pt=>mVal(pt.y,pt.m,'am')),backgroundColor:P[0]+'dd',stack:'fy',type:'bar'},
      {label:`FY${fyYear} PM`,data:fyS.map(pt=>mVal(pt.y,pt.m,'pm')),backgroundColor:P[0]+'77',stack:'fy',type:'bar'},
    ]:[{
      label:`FY${fyYear}`,data:fyS.map(pt=>mVal(pt.y,pt.m,S.metric)),
      backgroundColor:P[0]+'99',borderColor:P[0],borderWidth:type==='line'?2:1,
      fill:false,tension:.35,pointRadius:type==='line'?3:0,type,
    }];
  } else {
    const mos=getActiveMos(); const years=getYears();
    labels=mos.map(m=>MO[m-1]);
    ds=years.flatMap(y=>{
      if(stacked){
        return[
          {label:`${y} AM`,data:mos.map(m=>mVal(y,m,'am')),backgroundColor:YC[y]+'dd',stack:`${y}`,type:'bar'},
          {label:`${y} PM`,data:mos.map(m=>mVal(y,m,'pm')),backgroundColor:YC[y]+'77',stack:`${y}`,type:'bar'},
        ];
      }
      return[{
        label:String(y),data:mos.map(m=>mVal(y,m,S.metric)),
        backgroundColor:YC_A[y],borderColor:YC[y],borderWidth:type==='line'?2:1,
        fill:type==='line'&&S.chartType==='line',tension:.35,pointRadius:type==='line'?3:0,type,
      }];
    });
  }
  document.getElementById('mainChartSub').textContent=`${MLABELS[S.metric]||S.metric}`;
  mkChart('mainChart',type,{labels,datasets:ds},{
    scales:stacked?SC_STACK:SC,
    plugins:{legend:{labels:{font:{size:9},boxWidth:10}}}
  });
}

function buildYoYBar(){
  const mos=getActiveMos();
  mkChart('yoyBar','bar',{
    labels:YEARS,
    datasets:[
      {label:'Members',data:YEARS.map(y=>sumMos(y,mos,'members')),backgroundColor:P[0]+'cc'},
      {label:'Guests',data:YEARS.map(y=>sumMos(y,mos,'guests')),backgroundColor:P[2]+'cc'},
      {label:'Competition',data:YEARS.map(y=>sumMos(y,mos,'comp')),backgroundColor:P[1]+'cc'},
    ]
  },{scales:SC});
}

function buildCatBars(){
  const mos=getActiveMos(); const years=getYears();
  const cats=[
    {l:'Competition',k:'comp',c:P[0]},{l:'Corporate',k:'corporate',c:P[1]},
    {l:'Member Intro',k:'memb_intro',c:P[2]},{l:'Event',k:'event',c:P[3]},
    {l:'Voucher',k:'voucher',c:P[4]},{l:'Reciprocal',k:'recip',c:P[5]},
    {l:'Interstate',k:'interstate',c:P[6]},{l:'International',k:'intl',c:P[7]},
  ];
  const vals=cats.map(c=>({...c,v:years.reduce((s,y)=>s+sumMos(y,mos,c.k),0)}));
  const max=Math.max(...vals.map(c=>c.v))||1;
  document.getElementById('catBars').innerHTML=vals.map(c=>`
    <div class="bar-row">
      <div class="bar-lbl">${c.l}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${c.v/max*100}%;background:${c.c}"></div></div>
      <div class="bar-val">${fmtN(c.v)}</div>
    </div>`).join('');
}

function buildGuestDonut(){
  const mos=getActiveMos(); const years=getYears();
  const cats=[
    {l:'Memb Intro',k:'memb_intro',c:P[0]},{l:'Corporate',k:'corporate',c:P[1]},
    {l:'Interstate',k:'interstate',c:P[2]},{l:'International',k:'intl',c:P[3]},
    {l:'Voucher',k:'voucher',c:P[4]},{l:'Reciprocal',k:'recip',c:P[5]},
    {l:'Industry',k:'industry',c:P[6]},
  ];
  const vals=cats.map(c=>years.reduce((s,y)=>s+sumMos(y,mos,c.k),0));
  mkChart('guestDonut','doughnut',{
    labels:cats.map(c=>c.l),
    datasets:[{data:vals,backgroundColor:cats.map(c=>c.c),borderWidth:2,borderColor:'#fff'}]
  },{plugins:{legend:{position:'right',labels:{font:{size:9},boxWidth:10}}},scales:{}});
}

function buildTrendLine(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('trendLine','line',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,data:fyS.map(pt=>mVal(pt.y,pt.m,S.metric)),
        borderColor:P[0],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('trendLine','line',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),data:mos.map(m=>mVal(y,m,S.metric)),
        borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildSeasonOverview(){
  const seasons=[{l:'Summer',m:[12,1,2]},{l:'Autumn',m:[3,4,5]},{l:'Winter',m:[6,7,8]},{l:'Spring',m:[9,10,11]}];
  mkChart('seasonOverview','bar',{
    labels:seasons.map(s=>s.l),
    datasets:YEARS.map(y=>({
      label:String(y),data:seasons.map(s=>sumMos(y,s.m,'total')),
      backgroundColor:YC[y]+'cc'
    }))
  },{scales:SC});
}

function buildInsights(){
  const mos=getActiveMos();
  const n=YEARS.length;
  const latestYr=YEARS[n-1];
  const prevYr=n>=2?YEARS[n-2]:null;
  const prevPrevYr=n>=3?YEARS[n-3]:null;

  const curr=sumMos(latestYr,mos,'total');
  const prev=prevYr?sumMos(prevYr,mos,'total'):0;
  const pprev=prevPrevYr?sumMos(prevPrevYr,mos,'total'):0;

  const peakMo=mos.reduce((b,m)=>mVal(latestYr,m,'total')>mVal(latestYr,b,'total')?m:b,mos[0]||1);
  const gCurr=sumMos(latestYr,mos,'guests');
  const tCurr=sumMos(latestYr,mos,'total');
  const corpCurr=sumMos(latestYr,mos,'corporate');
  const corpPrev=prevYr?sumMos(prevYr,mos,'corporate'):0;
  const a3Curr=sumMos(latestYr,mos,'after3');

  const dowTotals=[...DAYS].map(d=>({d,v:mos.reduce((s,m)=>s+(RAW[latestYr]?.pivot?.[MONTHS[m-1]]?.[d]?.total||0),0)}));
  const busiestDOW=dowTotals.sort((a,b)=>b.v-a.v)[0]||{d:'—',v:0};

  const compCurr=sumMos(latestYr,mos,'comp');
  const compPrev=prevYr?sumMos(prevYr,mos,'comp'):0;

  const growthLine=prevYr
    ?`${prevYr}→${latestYr}: ${delta(curr,prev).txt||'flat'}${pprev?` · ${prevPrevYr}→${prevYr}: ${delta(prev,pprev).txt||'flat'}`:''}`
    :`${latestYr}: ${fmtN(curr)} rounds`;

  const ins=[
    {cls:'',t:`📈 Growth Trend`,b:`${growthLine} (${fmtN(prev||0)} → ${fmtN(curr)} rounds).`},
    {cls:'blue',t:`🏆 Peak Month ${latestYr}`,b:`${MONTHS[peakMo-1]}: ${fmtN(mVal(latestYr,peakMo,'total'))} rounds — highest of any month in ${latestYr}.`},
    {cls:'',t:`👥 Guest Ratio ${latestYr}: ${fmtP(gCurr/(tCurr||1))}`,b:`${fmtN(gCurr)} guest rounds from ${fmtN(tCurr)} total. Wednesday typically highest — corporate & member intro driven.`},
    {cls:corpCurr<corpPrev?'amber':'',t:`🏢 Corporate ${prevYr?`${corpCurr>=corpPrev?'▲':'▼'} ${Math.abs(((corpCurr-corpPrev)/(corpPrev||1))*100).toFixed(0)}% vs ${prevYr}`:''}`,b:`${prevYr?fmtN(corpPrev)+' ('+prevYr+') → ':''}${fmtN(corpCurr)} (${latestYr}). Wednesdays & Fridays dominate corporate bookings.`},
    {cls:'blue',t:'🌙 After 3pm Rounds',b:`${fmtN(a3Curr)} after-3pm rounds in ${latestYr}. Fridays see highest utilisation; Saturdays lowest.`},
    {cls:'',t:`📆 Busiest Day: ${busiestDOW.d}`,b:`${fmtN(busiestDOW.v)} rounds in ${latestYr}. Competition rounds strongest on Thursdays & Saturdays.`},
  ];
  document.getElementById('insights').innerHTML=ins.map(i=>`<div class="ins ${i.cls}"><strong>${i.t}</strong> ${i.b}</div>`).join('');
}

// ═══════════════════════════════════════════════════════
// MONTHLY PAGE
// ═══════════════════════════════════════════════════════
function buildMonthlyMain(){
  const fyS=getFYSeries();
  const type=S.chartType==='stack'?'bar':S.chartType;
  document.getElementById('monthlyChartSub').textContent=MLABELS[S.metric];
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('monthlyMain',type,{
      labels:fyS.map(pt=>pt.label),
      datasets:[{
        label:`FY${fyYear}`,data:fyS.map(pt=>mVal(pt.y,pt.m,S.metric)),
        backgroundColor:P[0]+'99',borderColor:P[0],borderWidth:type==='line'?2:1,
        tension:.35,pointRadius:type==='line'?3:0,fill:false,spanGaps:true
      }]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('monthlyMain',type,{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),data:mos.map(m=>mVal(y,m,S.metric)),
        backgroundColor:YC_A[y],borderColor:YC[y],borderWidth:type==='line'?2:1,
        tension:.35,pointRadius:type==='line'?3:0,fill:false,spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildAmPmChart(){
  const fyS=getFYSeries();
  if(fyS){
    mkChart('amPmChart','bar',{
      labels:fyS.map(pt=>pt.label),
      datasets:[
        {label:'AM',data:fyS.map(pt=>mVal(pt.y,pt.m,'am')),backgroundColor:P[0]+'cc',stack:'a'},
        {label:'PM',data:fyS.map(pt=>mVal(pt.y,pt.m,'pm')),backgroundColor:P[1]+'cc',stack:'a'},
        {label:'After 3pm',data:fyS.map(pt=>mVal(pt.y,pt.m,'after3')),backgroundColor:P[2]+'cc',stack:'a'},
      ]
    },{scales:SC_STACK});
  } else {
    const mos=getActiveMos();
    const y=resolveDisplayYear();
    mkChart('amPmChart','bar',{
      labels:mos.map(m=>MO[m-1]),
      datasets:[
        {label:'AM',data:mos.map(m=>mVal(y,m,'am')),backgroundColor:P[0]+'cc',stack:'a'},
        {label:'PM',data:mos.map(m=>mVal(y,m,'pm')),backgroundColor:P[1]+'cc',stack:'a'},
        {label:'After 3pm',data:mos.map(m=>mVal(y,m,'after3')),backgroundColor:P[2]+'cc',stack:'a'},
      ]
    },{scales:SC_STACK});
  }
}

function buildRatioChart(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('ratioChart','line',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,
        data:fyS.map(pt=>{const v=RAW[pt.y]?.monthly?.[MONTHS[pt.m-1]]?.guest_ratio;return v?(v*100).toFixed(1):null;}),
        borderColor:P[0],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true}]
    },{scales:SC_PCT});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('ratioChart','line',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),
        data:mos.map(m=>{const v=RAW[y]?.monthly?.[MONTHS[m-1]]?.guest_ratio;return v?(v*100).toFixed(1):null;}),
        borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true
      }))
    },{scales:SC_PCT});
  }
}

function buildCorpEventChart(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('corpEventChart','bar',{
      labels:fyS.map(pt=>pt.label),
      datasets:[
        {label:`FY${fyYear} Corp`,data:fyS.map(pt=>mVal(pt.y,pt.m,'corporate')),backgroundColor:P[0]+'cc',stack:'fy'},
        {label:`FY${fyYear} Event`,data:fyS.map(pt=>mVal(pt.y,pt.m,'event')),backgroundColor:P[0]+'55',stack:'fy'},
      ]
    },{scales:SC_STACK});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('corpEventChart','bar',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.flatMap(y=>[
        {label:`${y} Corp`,data:mos.map(m=>mVal(y,m,'corporate')),backgroundColor:YC[y]+'cc',stack:`${y}`},
        {label:`${y} Event`,data:mos.map(m=>mVal(y,m,'event')),backgroundColor:YC[y]+'55',stack:`${y}`},
      ])
    },{scales:SC_STACK});
  }
}

function buildDailyAvgChart(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('dailyAvgChart','line',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,
        data:fyS.map(pt=>RAW[pt.y]?.monthly_avgs?.[MONTHS[pt.m-1]]?.total?.daily?.toFixed(1)||null),
        borderColor:P[0],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('dailyAvgChart','line',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),
        data:mos.map(m=>RAW[y]?.monthly_avgs?.[MONTHS[m-1]]?.total?.daily?.toFixed(1)||null),
        borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildWeeklyAvgChart(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('weeklyAvgChart','line',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,
        data:fyS.map(pt=>RAW[pt.y]?.monthly_avgs?.[MONTHS[pt.m-1]]?.total?.weekly?.toFixed(0)||null),
        borderColor:P[0],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('weeklyAvgChart','line',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),
        data:mos.map(m=>RAW[y]?.monthly_avgs?.[MONTHS[m-1]]?.total?.weekly?.toFixed(0)||null),
        borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildMonthlyTable(){
  const mos=getActiveMos(); const years=getYears();
  document.getElementById('monthlyTableSub').textContent=`${years.join(', ')}`;
  const metrics=[
    {l:'Total',k:'total'},{l:'AM',k:'am'},{l:'PM',k:'pm'},{l:'After 3pm',k:'after3'},
    {l:'Guests',k:'guests'},{l:'Members',k:'members'},{l:'Competition',k:'comp'},
    {l:'Corporate',k:'corporate'},{l:'Event',k:'event'},{l:'Voucher',k:'voucher'},
    {l:'Reciprocal',k:'recip'},{l:'Interstate',k:'interstate'},{l:'International',k:'intl'},
    {l:'Non Playing',k:'non_playing'},
  ];
  const hdr=`<thead><tr><th>Metric</th>${years.flatMap(y=>mos.map(m=>`<th style="color:${YC[y]}">${y} ${MO[m-1]}</th>`)).join('')}<th>Total</th></tr></thead>`;
  const body='<tbody>'+metrics.map(({l,k})=>{
    const vals=years.flatMap(y=>mos.map(m=>mVal(y,m,k)));
    const tot=vals.reduce((a,b)=>a+b,0);
    const mx=Math.max(...vals);
    return `<tr><td>${l}</td>${vals.map(v=>`<td class="${v===mx&&v>0?'best':''}">${fmtN(v)}</td>`).join('')}<td><strong>${fmtN(tot)}</strong></td></tr>`;
  }).join('')+'</tbody>';
  document.getElementById('monthlyTable').innerHTML=hdr+body;
}

// ═══════════════════════════════════════════════════════
// OCCUPANCY PAGE
// ═══════════════════════════════════════════════════════
function buildOccKPIs(){
  const kpis=YEARS.map(y=>({y,am:yVal(y,'occ_am'),pm:yVal(y,'occ_pm'),tot:yVal(y,'occ_total')}));
  document.getElementById('occKpiRow').innerHTML=kpis.map(({y,am,pm,tot})=>`
    <div class="kpi" style="border-left-color:${YC[y]}">
      <div class="kpi-lbl">${y}${y===2026?' YTD':''}</div>
      <div class="kpi-val">${fmtPct(tot)}</div>
      <div class="kpi-sub">AM ${fmtPct(am)} · PM ${pm?fmtPct(pm):'N/A'}</div>
    </div>`).join('');
}

function buildOccMonthChart(){
  const mos=getActiveMos();
  const labels=mos.map(m=>MO[m-1]);
  mkChart('occMonthChart','line',{
    labels,
    datasets:YEARS.map(y=>({
      label:String(y),
      data:mos.map(m=>{const v=RAW[y]?.occ_report?.[MONTHS[m-1]];
        if(!v)return null;
        const tots=Object.values(v).map(d=>d.total_occ).filter(Boolean);
        return tots.length?(tots.reduce((a,b)=>a+b,0)/tots.length*100).toFixed(1):null;
      }),
      borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:4,borderWidth:2,spanGaps:false
    }))
  },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'},suggestedMin:50,suggestedMax:100}}});
}

function buildOccDayGrid(){
  const grid=document.getElementById('occDayGrid');
  const years=getYears();
  grid.innerHTML=DAYS.map(d=>{
    const amVals=[],pmVals=[],totVals=[];
    for(const y of years){
      for(const mn of MONTHS){
        const v=RAW[y]?.occ_report?.[mn]?.[d];
        if(v){
          if(v.am_occ)amVals.push(v.am_occ);
          if(v.pm_occ)pmVals.push(v.pm_occ);
          if(v.total_occ)totVals.push(v.total_occ);
        }
      }
    }
    const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
    const am=avg(amVals),pm=avg(pmVals),tot=avg(totVals)||am;
    const cls=tot>=.85?'occ-hi':tot>=.70?'occ-mid':'occ-lo';
    return `<div class="occ-tile">
      <div class="occ-day">${d.substring(0,3)}</div>
      <div class="occ-pct ${cls}">${(tot*100).toFixed(0)}%</div>
      <div class="occ-sub">AM ${(am*100).toFixed(0)}%${pm?' · PM '+(pm*100).toFixed(0)+'%':''}</div>
      <div class="occ-bar am" style="width:${(am*100).toFixed(0)}%;max-width:100%"></div>
      ${pm?`<div class="occ-bar pm" style="width:${(pm*100).toFixed(0)}%;max-width:100%"></div>`:''}
    </div>`;
  }).join('');
}

function buildOccAmChart(){
  const mos=getActiveMos();
  mkChart('occAmChart','line',{
    labels:mos.map(m=>MO[m-1]),
    datasets:YEARS.map(y=>({
      label:String(y),
      data:mos.map(m=>{const v=RAW[y]?.occ_report?.[MONTHS[m-1]];
        if(!v)return null;
        const vs=Object.values(v).map(d=>d.am_occ).filter(Boolean);
        return vs.length?(vs.reduce((a,b)=>a+b,0)/vs.length*100).toFixed(1):null;
      }),
      borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:4,borderWidth:2,spanGaps:false
    }))
  },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'},suggestedMin:50}}});
}

function buildOccPmChart(){
  const mos=getActiveMos();
  mkChart('occPmChart','line',{
    labels:mos.map(m=>MO[m-1]),
    datasets:YEARS.map(y=>({
      label:String(y),
      data:mos.map(m=>{const v=RAW[y]?.occ_report?.[MONTHS[m-1]];
        if(!v)return null;
        const vs=Object.values(v).map(d=>d.pm_occ).filter(Boolean);
        return vs.length?(vs.reduce((a,b)=>a+b,0)/vs.length*100).toFixed(1):null;
      }),
      borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:4,borderWidth:2,spanGaps:false
    }))
  },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'},suggestedMin:30}}});
}

function buildOcc3pmChart(){
  // Sum after3pm rounds by day of week from pivot (after3pm.by_day doesn't exist in data)
  const mos=getActiveMos();
  const n=YEARS.length;
  const yr2=YEARS[n-1], yr1=n>=2?YEARS[n-2]:YEARS[0];
  function a3byDay(y){return DAYS.map(d=>mos.reduce((s,m)=>s+(RAW[y]?.pivot?.[MONTHS[m-1]]?.[d]?.after3||0),0));}
  mkChart('occ3pmChart','bar',{
    labels:DS,
    datasets:[
      {label:String(yr1),data:a3byDay(yr1),backgroundColor:P[0]+'cc'},
      {label:String(yr2),data:a3byDay(yr2),backgroundColor:P[2]+'cc'},
    ]
  },{scales:SC});
}

function buildOccSpotsChart(){
  const mos=getActiveMos(); const y=S.year==='all'?YEARS[YEARS.length-1]:S.year;
  const ams=mos.map(m=>RAW[y]?.occ_report?.[MONTHS[m-1]]||{});
  const amBook=amos=>Object.values(amos).reduce((s,d)=>s+(d.am_book||0),0);
  const amSpots=amos=>Object.values(amos).reduce((s,d)=>s+(d.am_spots||0),0);
  mkChart('occSpotsChart','bar',{
    labels:mos.map(m=>MO[m-1]),
    datasets:[
      {label:'AM Bookings',data:mos.map(m=>amBook(RAW[y]?.occ_report?.[MONTHS[m-1]]||{})),backgroundColor:P[0]+'cc',stack:'a'},
      {label:'AM Spots Avail',data:mos.map(m=>amSpots(RAW[y]?.occ_report?.[MONTHS[m-1]]||{})-amBook(RAW[y]?.occ_report?.[MONTHS[m-1]]||{})),backgroundColor:P[4]+'66',stack:'a'},
    ]
  },{scales:SC_STACK});
}

function buildOccTable(){
  const tbl=document.getElementById('occTable');
  const hdr=`<thead><tr><th>Month</th>${YEARS.flatMap(y=>[`<th style="color:${YC[y]}">${y} AM</th>`,`<th style="color:${YC[y]}">${y} PM</th>`,`<th style="color:${YC[y]}">${y} Total</th>`]).join('')}</tr></thead>`;
  const body='<tbody>'+MONTHS.map(mn=>`<tr><td>${mn}</td>${YEARS.flatMap(y=>{
    const v=RAW[y]?.occ_report?.[mn];
    if(!v)return['<td>—</td>','<td>—</td>','<td>—</td>'];
    const ams=Object.values(v).map(d=>d.am_occ).filter(Boolean);
    const pms=Object.values(v).map(d=>d.pm_occ).filter(Boolean);
    const tots=Object.values(v).map(d=>d.total_occ).filter(Boolean);
    const avg=a=>a.length?(a.reduce((s,v)=>s+v,0)/a.length*100).toFixed(0)+'%':'—';
    return [`<td>${avg(ams)}</td>`,`<td>${avg(pms)}</td>`,`<td>${avg(tots)}</td>`];
  }).join('')}</tr>`).join('')+'</tbody>';
  tbl.innerHTML=hdr+body;
}

// ═══════════════════════════════════════════════════════
// DOW PAGE
// ═══════════════════════════════════════════════════════
// Sum a DOW metric across the correct months for a given year (FY-aware)
function dowSum(y,d,key){
  return getMosForYear(y).reduce((s,m)=>s+(RAW[y]?.pivot?.[MONTHS[m-1]]?.[d]?.[key]||0),0);
}
// Sum a DOW metric across ALL FY months (across two years)
function dowFYSum(d,key){
  const fyS=getFYSeries();
  if(!fyS)return 0;
  return fyS.reduce((s,pt)=>s+(RAW[pt.y]?.pivot?.[MONTHS[pt.m-1]]?.[d]?.[key]||0),0);
}

function buildDowTotal(){
  const years=getYears();
  const activeDays=DAYS.filter(d=>S.days.has(d));
  const fyS=getFYSeries();
  document.getElementById('dowSub').textContent=MLABELS[S.metric];
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('dowTotal','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:[{label:`FY${fyYear}`,data:activeDays.map(d=>dowFYSum(d,S.metric)),backgroundColor:P[0]+'cc'}]
    },{scales:SC});
  } else {
    mkChart('dowTotal','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:years.map(y=>({
        label:String(y),
        data:activeDays.map(d=>dowSum(y,d,S.metric)),
        backgroundColor:YC[y]+'cc'
      }))
    },{scales:SC});
  }
}

function buildDowAmPm(){
  const activeDays=DAYS.filter(d=>S.days.has(d));
  const fyS=getFYSeries();
  if(fyS){
    mkChart('dowAmPm','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:[
        {label:'AM',data:activeDays.map(d=>dowFYSum(d,'am')),backgroundColor:P[0]+'cc',stack:'a'},
        {label:'PM',data:activeDays.map(d=>dowFYSum(d,'pm')),backgroundColor:P[1]+'cc',stack:'a'},
        {label:'After 3pm',data:activeDays.map(d=>dowFYSum(d,'after3')),backgroundColor:P[2]+'cc',stack:'a'},
      ]
    },{scales:SC_STACK});
  } else {
    const y=resolveDisplayYear();
    mkChart('dowAmPm','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:[
        {label:'AM',data:activeDays.map(d=>dowSum(y,d,'am')),backgroundColor:P[0]+'cc',stack:'a'},
        {label:'PM',data:activeDays.map(d=>dowSum(y,d,'pm')),backgroundColor:P[1]+'cc',stack:'a'},
        {label:'After 3pm',data:activeDays.map(d=>dowSum(y,d,'after3')),backgroundColor:P[2]+'cc',stack:'a'},
      ]
    },{scales:SC_STACK});
  }
}

function buildDowGuestRatio(){
  const years=getYears();
  const activeDays=DAYS.filter(d=>S.days.has(d));
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('dowGuestRatio','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:[{label:`FY${fyYear}`,data:activeDays.map(d=>{
        const t=dowFYSum(d,'total'), g=dowFYSum(d,'guests');
        return t?(g/t*100).toFixed(1):0;
      }),backgroundColor:P[0]+'cc'}]
    },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'}}}});
  } else {
    mkChart('dowGuestRatio','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:years.map(y=>({
        label:String(y),
        data:activeDays.map(d=>{
          const t=dowSum(y,d,'total'), g=dowSum(y,d,'guests');
          return t?(g/t*100).toFixed(1):0;
        }),
        backgroundColor:YC[y]+'cc'
      }))
    },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'}}}});
  }
}

function buildDowComp(){
  const years=getYears();
  const activeDays=DAYS.filter(d=>S.days.has(d));
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('dowComp','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:[{label:`FY${fyYear}`,data:activeDays.map(d=>dowFYSum(d,'comp')),backgroundColor:P[0]+'cc'}]
    },{scales:SC});
  } else {
    mkChart('dowComp','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:years.map(y=>({
        label:String(y),
        data:activeDays.map(d=>dowSum(y,d,'comp')),
        backgroundColor:YC[y]+'cc'
      }))
    },{scales:SC});
  }
}

function buildDowShare(){
  const years=getYears();
  const activeDays=DAYS.filter(d=>S.days.has(d));
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    const totalFY=activeDays.reduce((s,d)=>s+dowFYSum(d,'total'),0)||1;
    mkChart('dowShare','line',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:[{label:`FY${fyYear}`,data:activeDays.map(d=>(dowFYSum(d,'total')/totalFY*100).toFixed(1)),
        borderColor:P[0],backgroundColor:'transparent',tension:.3,pointRadius:4,borderWidth:2}]
    },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'}}}});
  } else {
    mkChart('dowShare','line',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:years.map(y=>({
        label:String(y),
        data:activeDays.map(d=>{
          const t=dowSum(y,d,'total');
          const yr=getMosForYear(y).reduce((s,m)=>s+(RAW[y]?.monthly?.[MONTHS[m-1]]?.total||0),0)||1;
          return (t/yr*100).toFixed(1);
        }),
        borderColor:YC[y],backgroundColor:'transparent',tension:.3,pointRadius:4,borderWidth:2
      }))
    },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'}}}});
  }
}

function buildDowCorpEvent(){
  const years=getYears();
  const activeDays=DAYS.filter(d=>S.days.has(d));
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('dowCorpEvent','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:[
        {label:`FY${fyYear} Corp`,data:activeDays.map(d=>dowFYSum(d,'corporate')),backgroundColor:P[0]+'cc',stack:'fy'},
        {label:`FY${fyYear} Event`,data:activeDays.map(d=>dowFYSum(d,'event')),backgroundColor:P[0]+'55',stack:'fy'},
      ]
    },{scales:SC_STACK});
  } else {
    mkChart('dowCorpEvent','bar',{
      labels:activeDays.map(d=>d.slice(0,3)),
      datasets:years.flatMap(y=>[
        {label:`${y} Corp`,data:activeDays.map(d=>dowSum(y,d,'corporate')),backgroundColor:YC[y]+'cc',stack:`${y}`},
        {label:`${y} Event`,data:activeDays.map(d=>dowSum(y,d,'event')),backgroundColor:YC[y]+'55',stack:`${y}`},
      ])
    },{scales:SC_STACK});
  }
}

function buildDowTable(){
  const years=getYears();
  const activeDays=DAYS.filter(d=>S.days.has(d));
  const fyS=getFYSeries();
  const metrics=[
    {l:'Total',k:'total'},{l:'AM',k:'am'},{l:'PM',k:'pm'},{l:'After 3pm',k:'after3'},
    {l:'Guests',k:'guests'},{l:'Guest %',k:'_gp'},{l:'Members',k:'members'},
    {l:'Competition',k:'comp'},{l:'Corporate',k:'corporate'},{l:'Event',k:'event'},
    {l:'Member Intro',k:'memb_intro'},{l:'Interstate',k:'interstate'},{l:'International',k:'intl'},
  ];
  const tbl=document.getElementById('dowTable');
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    const hdr=`<thead><tr><th>Metric</th>${activeDays.map(d=>`<th>FY${fyYear} ${d.substring(0,3)}</th>`).join('')}</tr></thead>`;
    const body='<tbody>'+metrics.map(({l,k})=>`<tr><td>${l}</td>${activeDays.map(d=>{
      if(k==='_gp'){const t=dowFYSum(d,'total'),g=dowFYSum(d,'guests');return `<td>${t?(g/t*100).toFixed(1)+'%':'—'}</td>`;}
      return `<td>${fmtN(dowFYSum(d,k))}</td>`;
    }).join('')}</tr>`).join('')+'</tbody>';
    tbl.innerHTML=hdr+body;
  } else {
    const hdr=`<thead><tr><th>Metric</th>${years.flatMap(y=>activeDays.map(d=>`<th style="color:${YC[y]}">${y} ${d.substring(0,3)}</th>`)).join('')}</tr></thead>`;
    const body='<tbody>'+metrics.map(({l,k})=>`<tr><td>${l}</td>${years.flatMap(y=>activeDays.map(d=>{
      if(k==='_gp'){const t=dowSum(y,d,'total'),g=dowSum(y,d,'guests');return `<td>${t?(g/t*100).toFixed(1)+'%':'—'}</td>`;}
      return `<td>${fmtN(dowSum(y,d,k))}</td>`;
    })).join('')}</tr>`).join('')+'</tbody>';
    tbl.innerHTML=hdr+body;
  }
}

// ═══════════════════════════════════════════════════════
// GUESTS PAGE
// ═══════════════════════════════════════════════════════
function buildGuestKPIs(){
  const mos=getActiveMos(); const years=getYears();
  const keys=[{k:'guests',l:'Total Guests'},{k:'memb_intro',l:'Member Intro'},{k:'corporate',l:'Corporate'},
    {k:'interstate',l:'Interstate'},{k:'intl',l:'International'},{k:'recip',l:'Reciprocal'},{k:'voucher',l:'Voucher'}];
  document.getElementById('guestKpiRow').innerHTML=keys.map(({k,l},i)=>{
    const v=years.reduce((s,y)=>s+sumMos(y,mos,k),0);
    return `<div class="kpi s${i}"><div class="kpi-lbl">${l}</div><div class="kpi-val">${fmtN(v)}</div></div>`;
  }).join('');
}

function buildGuestTrend(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    document.getElementById('guestTrendSub').textContent=`FY${fyYear}`;
    mkChart('guestTrend','bar',{
      labels:fyS.map(pt=>pt.label),
      datasets:[
        {label:'Memb Intro',data:fyS.map(pt=>mVal(pt.y,pt.m,'memb_intro')),backgroundColor:P[0]+'cc',stack:'a'},
        {label:'Corporate',data:fyS.map(pt=>mVal(pt.y,pt.m,'corporate')),backgroundColor:P[1]+'cc',stack:'a'},
        {label:'Interstate',data:fyS.map(pt=>mVal(pt.y,pt.m,'interstate')),backgroundColor:P[2]+'cc',stack:'a'},
        {label:'International',data:fyS.map(pt=>mVal(pt.y,pt.m,'intl')),backgroundColor:P[3]+'cc',stack:'a'},
        {label:'Voucher',data:fyS.map(pt=>mVal(pt.y,pt.m,'voucher')),backgroundColor:P[4]+'cc',stack:'a'},
        {label:'Reciprocal',data:fyS.map(pt=>mVal(pt.y,pt.m,'recip')),backgroundColor:P[5]+'cc',stack:'a'},
      ]
    },{scales:SC_STACK});
  } else {
    const mos=getActiveMos(); const y=resolveDisplayYear();
    document.getElementById('guestTrendSub').textContent=String(y);
    mkChart('guestTrend','bar',{
      labels:mos.map(m=>MO[m-1]),
      datasets:[
        {label:'Memb Intro',data:mos.map(m=>mVal(y,m,'memb_intro')),backgroundColor:P[0]+'cc',stack:'a'},
        {label:'Corporate',data:mos.map(m=>mVal(y,m,'corporate')),backgroundColor:P[1]+'cc',stack:'a'},
        {label:'Interstate',data:mos.map(m=>mVal(y,m,'interstate')),backgroundColor:P[2]+'cc',stack:'a'},
        {label:'International',data:mos.map(m=>mVal(y,m,'intl')),backgroundColor:P[3]+'cc',stack:'a'},
        {label:'Voucher',data:mos.map(m=>mVal(y,m,'voucher')),backgroundColor:P[4]+'cc',stack:'a'},
        {label:'Reciprocal',data:mos.map(m=>mVal(y,m,'recip')),backgroundColor:P[5]+'cc',stack:'a'},
      ]
    },{scales:SC_STACK});
  }
}

function buildGuestMix(){
  const mos=getActiveMos(); const years=getYears();
  const cats=['memb_intro','corporate','interstate','intl','voucher','recip','industry'];
  mkChart('guestMix','bar',{
    labels:years,
    datasets:cats.map((k,i)=>({
      label:MLABELS[k]||k,
      data:years.map(y=>sumMos(y,mos,k)),
      backgroundColor:P[i%P.length]+'cc',stack:'a'
    }))
  },{scales:SC_STACK});
}

function buildTravelChart(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('travelChart','bar',{
      labels:fyS.map(pt=>pt.label),
      datasets:[
        {label:`FY${fyYear} Interstate`,data:fyS.map(pt=>mVal(pt.y,pt.m,'interstate')),backgroundColor:P[0]+'cc',stack:'fy'},
        {label:`FY${fyYear} Intl`,data:fyS.map(pt=>mVal(pt.y,pt.m,'intl')),backgroundColor:P[0]+'55',stack:'fy'},
      ]
    },{scales:SC_STACK});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('travelChart','bar',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.flatMap(y=>[
        {label:`${y} Interstate`,data:mos.map(m=>mVal(y,m,'interstate')),backgroundColor:YC[y]+'cc',stack:`${y}`},
        {label:`${y} Intl`,data:mos.map(m=>mVal(y,m,'intl')),backgroundColor:YC[y]+'55',stack:`${y}`},
      ])
    },{scales:SC_STACK});
  }
}

function buildCorpMonth(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('corpMonth','line',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,data:fyS.map(pt=>mVal(pt.y,pt.m,'corporate')),
        borderColor:P[0],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('corpMonth','line',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),data:mos.map(m=>mVal(y,m,'corporate')),
        borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildMembIntroChart(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('membIntroChart','line',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,data:fyS.map(pt=>mVal(pt.y,pt.m,'memb_intro')),
        borderColor:P[0],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('membIntroChart','line',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),data:mos.map(m=>mVal(y,m,'memb_intro')),
        borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildGuestTable(){
  const mos=getActiveMos();
  const cats=[
    {l:'Total Guests',k:'guests'},{l:'Member Intro',k:'memb_intro'},
    {l:'Corporate',k:'corporate'},{l:'Interstate',k:'interstate'},
    {l:'International',k:'intl'},{l:'Industry',k:'industry'},
    {l:'Memb Unaccomp',k:'memb_unaccomp'},{l:'Voucher',k:'voucher'},{l:'Reciprocal',k:'recip'},
  ];
  const tbl=document.getElementById('guestTable');
  const hdr=`<thead><tr><th>Category</th>${mos.flatMap(m=>YEARS.map(y=>`<th style="color:${YC[y]}">${y} ${MO[m-1]}</th>`)).join('')}<th>Total</th></tr></thead>`;
  const body='<tbody>'+cats.map(({l,k})=>{
    const vals=mos.flatMap(m=>YEARS.map(y=>mVal(y,m,k)));
    const tot=vals.reduce((a,b)=>a+b,0);
    return `<tr><td>${l}</td>${vals.map(v=>`<td>${fmtN(v)}</td>`).join('')}<td><strong>${fmtN(tot)}</strong></td></tr>`;
  }).join('')+'</tbody>';
  tbl.innerHTML=hdr+body;
}

// ═══════════════════════════════════════════════════════
// SEASONAL PAGE
// ═══════════════════════════════════════════════════════
const SEASONS=[{k:'summer',l:'Summer',icon:'☀️',m:[12,1,2],cls:'sum'},{k:'autumn',l:'Autumn',icon:'🍂',m:[3,4,5],cls:'aut'},{k:'winter',l:'Winter',icon:'❄️',m:[6,7,8],cls:'win'},{k:'spring',l:'Spring',icon:'🌸',m:[9,10,11],cls:'spr'}];
const QUARTERS=[{l:'Q1',m:[1,2,3]},{l:'Q2',m:[4,5,6]},{l:'Q3',m:[7,8,9]},{l:'Q4',m:[10,11,12]}];

function buildSeasonCards(){
  const years=getYears();
  document.getElementById('seasonCards').innerHTML=SEASONS.map(s=>{
    const tot=years.reduce((sm,y)=>sm+sumMos(y,s.m,'total'),0);
    const gs=years.reduce((sm,y)=>sm+sumMos(y,s.m,'guests'),0);
    return `<div class="sc ${s.cls}"><div class="sc-icon">${s.icon}</div><div class="sc-name">${s.l}</div><div class="sc-num">${fmtN(tot)}</div><div class="sc-sub">${fmtN(gs)} guests</div></div>`;
  }).join('');
}

function buildSeasonYear(){
  mkChart('seasonYear','bar',{
    labels:SEASONS.map(s=>s.l),
    datasets:getYears().map(y=>({
      label:String(y),data:SEASONS.map(s=>sumMos(y,s.m,'total')),backgroundColor:YC[y]+'cc'
    }))
  },{scales:SC});
}

function buildQuarterChart(){
  mkChart('quarterChart','bar',{
    labels:QUARTERS.map(q=>q.l),
    datasets:getYears().map(y=>({
      label:String(y),data:QUARTERS.map(q=>sumMos(y,q.m,'total')),backgroundColor:YC[y]+'cc'
    }))
  },{scales:SC});
}

function buildSeasonGuests(){
  mkChart('seasonGuests','bar',{
    labels:SEASONS.map(s=>s.l),
    datasets:getYears().map(y=>({
      label:String(y),data:SEASONS.map(s=>sumMos(y,s.m,'guests')),backgroundColor:YC[y]+'cc'
    }))
  },{scales:SC});
}

function buildSeasonOcc(){
  mkChart('seasonOcc','line',{
    labels:SEASONS.map(s=>s.l),
    datasets:getYearsNoPartial().map(y=>({
      label:String(y),
      data:SEASONS.map(s=>{
        const vals=s.m.flatMap(mn=>Object.values(RAW[y]?.occ_report?.[MONTHS[mn-1]]||{}).map(d=>d.total_occ).filter(Boolean));
        return vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length*100).toFixed(1):null;
      }),
      borderColor:YC[y],backgroundColor:'transparent',tension:.3,pointRadius:5,borderWidth:2.5,spanGaps:true
    }))
  },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'},suggestedMin:60}}});
}

function buildSeasonTable(){
  const tbl=document.getElementById('seasonTable');
  const metrics=[{l:'Total',k:'total'},{l:'AM',k:'am'},{l:'PM',k:'pm'},{l:'Guests',k:'guests'},{l:'Comp',k:'comp'},{l:'Corporate',k:'corporate'}];
  const hdr=`<thead><tr><th>Season</th>${YEARS.flatMap(y=>metrics.map(m=>`<th style="color:${YC[y]}">${y} ${m.l}</th>`)).join('')}</tr></thead>`;
  const body='<tbody>'+SEASONS.map(s=>`<tr><td>${s.l} (${s.m.map(m=>MO[m-1]).join('·')})</td>${YEARS.flatMap(y=>metrics.map(({k})=>`<td>${fmtN(sumMos(y,s.m,k))}</td>`)).join('')}</tr>`).join('')+'</tbody>';
  tbl.innerHTML=hdr+body;
}

// ═══════════════════════════════════════════════════════
// HEAT MAP PAGE
// ═══════════════════════════════════════════════════════
function heatColor(val,min,max,alpha='dd'){
  const t=max>min?(val-min)/(max-min):0;
  const r=Math.round(43+(27-43)*t); // navy R to darker
  const g=Math.round(51+(37-51)*t);
  const b=Math.round(92+(64-92)*t);
  // Use opacity to show intensity: light=low, dark=high
  const op=Math.round(20+t*220).toString(16).padStart(2,'0');
  return `rgba(43,51,92,${(0.1+t*0.85).toFixed(2)})`;
}

function buildHeatmap(containerId,getVal,formatVal){
  const container=document.getElementById(containerId);
  if(!container)return;
  const yr=S.year==='all'?YEARS[YEARS.length-1]:S.year;
  const vals=DAYS.flatMap(d=>MONTHS.map(mo=>getVal(yr,mo,d)));
  const nonZero=vals.filter(v=>v>0);
  const valMin=Math.min(...nonZero)||0, valMax=Math.max(...nonZero)||1;
  let html=`<table class="hm-table"><tr><th></th>${MO.map(m=>`<th>${m}</th>`).join('')}</tr>`;
  for(const d of DAYS){
    html+=`<tr><td class="hm-row-lbl">${d}</td>`;
    for(const mo of MONTHS){
      const v=getVal(yr,mo,d);
      const bg=v>0?heatColor(v,valMin,valMax):'#f5f5f7';
      const c=v>0&&(v-valMin)/(valMax-valMin)>0.6?'#fff':'var(--navy)';
      html+=`<td title="${d}, ${mo}: ${formatVal(v)}" style="background:${bg};color:${c};font-weight:${v>0?600:400}">${v>0?formatVal(v):'—'}</td>`;
    }
    html+='</tr>';
  }
  html+='</table>';
  container.innerHTML=html;
}

function buildAllHeatmaps(){
  const yr=resolveDisplayYear();
  buildHeatmap('hmRounds',(y,mn,d)=>RAW[y]?.pivot?.[mn]?.[d]?.total||0,fmtN);
  buildHeatmap('hmOcc',(y,mn,d)=>{const v=RAW[y]?.occ_report?.[mn]?.[d]?.total_occ;return v?(v*100):0;},v=>v.toFixed(0)+'%');
  buildHeatmap('hmGuest',(y,mn,d)=>{const t=RAW[y]?.pivot?.[mn]?.[d]?.total||0,g=RAW[y]?.pivot?.[mn]?.[d]?.guests||0;return t?(g/t*100):0;},v=>v.toFixed(0)+'%');
  buildHeatmap('hmComp',(y,mn,d)=>RAW[y]?.pivot?.[mn]?.[d]?.comp||0,fmtN);
  buildHeatmap('hmCorp',(y,mn,d)=>RAW[y]?.pivot?.[mn]?.[d]?.corporate||0,fmtN);
  document.getElementById('hmSub').textContent=`${yr}`;
}

// ═══════════════════════════════════════════════════════
// YEAR COMPARE PAGE
// ═══════════════════════════════════════════════════════
function buildCmpTotal(){
  const mos=getActiveMos();
  mkChart('cmpTotal','line',{
    labels:mos.map(m=>MO[m-1]),
    datasets:YEARS.map(y=>({
      label:String(y),data:mos.map(m=>mVal(y,m,'total')),
      borderColor:YC[y],backgroundColor:YC[y]+'22',fill:true,tension:.35,pointRadius:3,borderWidth:2.5,spanGaps:true
    }))
  },{scales:SC});
}

function buildCmpMemGuest(){
  mkChart('cmpMemGuest','bar',{
    labels:YEARS,
    datasets:[
      {label:'Members',data:YEARS.map(y=>yVal(y,'members')),backgroundColor:P[0]+'cc'},
      {label:'Guests',data:YEARS.map(y=>yVal(y,'guests')),backgroundColor:P[2]+'cc'},
    ]
  },{scales:SC});
}

function buildCmpCorp(){
  const mos=getActiveMos();
  mkChart('cmpCorp','bar',{
    labels:mos.map(m=>MO[m-1]),
    datasets:YEARS.map(y=>({label:String(y),data:mos.map(m=>mVal(y,m,'corporate')),backgroundColor:YC[y]+'cc'}))
  },{scales:SC});
}

function buildCmpComp(){
  const mos=getActiveMos();
  mkChart('cmpComp','bar',{
    labels:mos.map(m=>MO[m-1]),
    datasets:YEARS.map(y=>({label:String(y),data:mos.map(m=>mVal(y,m,'comp')),backgroundColor:YC[y]+'cc'}))
  },{scales:SC});
}

function buildCmpOcc(){
  mkChart('cmpOcc','line',{
    labels:YEARS,
    datasets:[
      {label:'AM Occ',data:YEARS.map(y=>yVal(y,'occ_am')?(yVal(y,'occ_am')*100).toFixed(1):null),borderColor:P[0],backgroundColor:'transparent',tension:.3,pointRadius:5,borderWidth:2.5,spanGaps:false},
      {label:'PM Occ',data:YEARS.map(y=>yVal(y,'occ_pm')?(yVal(y,'occ_pm')*100).toFixed(1):null),borderColor:P[2],backgroundColor:'transparent',tension:.3,pointRadius:5,borderWidth:2.5,spanGaps:false},
      {label:'Total',data:YEARS.map(y=>yVal(y,'occ_total')?(yVal(y,'occ_total')*100).toFixed(1):null),borderColor:P[1],backgroundColor:'transparent',tension:.3,pointRadius:5,borderWidth:2.5,spanGaps:false},
    ]
  },{scales:{x:SC.x,y:{...SC.y,ticks:{callback:v=>v+'%'},suggestedMin:60}}});
}

function buildCmpTable(){
  const metrics=[
    {l:'Total Rounds',k:'total'},{l:'AM Field',k:'am'},{l:'PM Field',k:'pm'},{l:'After 3pm',k:'after3'},
    {l:'Guests',k:'guests'},{l:'Members',k:'members'},{l:'Competition',k:'comp'},
    {l:'Corporate',k:'corporate'},{l:'Event',k:'event'},{l:'Voucher',k:'voucher'},
    {l:'Reciprocal',k:'recip'},{l:'Interstate',k:'interstate'},{l:'International',k:'intl'},
    {l:'Occ Total',k:'occ_total',fmt:v=>v?fmtPct(v):'—'},{l:'Occ AM',k:'occ_am',fmt:v=>v?fmtPct(v):'—'},
  ];
  const tbl=document.getElementById('cmpTable');
  const n=YEARS.length;
  const deltaHdrs=YEARS.slice(1).map((y,i)=>`<th>Δ ${YEARS[i]}→${y}${y===CURRENT_YEAR?' YTD':''}</th>`).join('');
  const hdr=`<thead><tr><th>Metric</th>${YEARS.map(y=>`<th style="color:${YC[y]}">${y}${y===CURRENT_YEAR?' YTD':''}</th>`).join('')}${deltaHdrs}</tr></thead>`;
  const body='<tbody>'+metrics.map(({l,k,fmt})=>{
    const vals=YEARS.map(y=>yVal(y,k));
    const f=fmt||fmtN;
    const deltas=vals.slice(1).map((v,i)=>{
      const p=vals[i]&&v?((v-vals[i])/vals[i]*100).toFixed(1):'—';
      const cls=p!=='—'&&+p>0?'best':p!=='—'&&+p<0?'worst':'';
      return `<td class="${cls}">${p!=='—'?(+p>=0?'+':'')+p+'%':'—'}</td>`;
    }).join('');
    return `<tr><td>${l}</td>${vals.map(v=>`<td>${f(v)}</td>`).join('')}${deltas}</tr>`;
  }).join('')+'</tbody>';
  tbl.innerHTML=hdr+body;
}

function buildCmpMonthTable(){
  const tbl=document.getElementById('cmpMonthTable');
  const hdr=`<thead><tr><th>Month</th>${YEARS.map(y=>`<th style="color:${YC[y]}">${y} Total</th><th style="color:${YC[y]}">Guests</th><th style="color:${YC[y]}">Comp</th>`).join('')}</tr></thead>`;
  const body='<tbody>'+MONTHS.map(mn=>`<tr><td>${mn}</td>${YEARS.map(y=>{const v=mVal(y,MONTHS.indexOf(mn)+1,'total');return `<td>${v?fmtN(v):'—'}</td><td>${v?fmtN(mVal(y,MONTHS.indexOf(mn)+1,'guests')):'—'}</td><td>${v?fmtN(mVal(y,MONTHS.indexOf(mn)+1,'comp')):'—'}</td>`;}).join('')}</tr>`).join('')+'</tbody>';
  tbl.innerHTML=hdr+body;
}

// ═══════════════════════════════════════════════════════
// AVERAGES PAGE
// ═══════════════════════════════════════════════════════
function buildAvgDaily(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('avgDaily','line',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,
        data:fyS.map(pt=>RAW[pt.y]?.monthly_avgs?.[MONTHS[pt.m-1]]?.total?.daily?.toFixed(1)||null),
        borderColor:P[0],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('avgDaily','line',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),
        data:mos.map(m=>RAW[y]?.monthly_avgs?.[MONTHS[m-1]]?.total?.daily?.toFixed(1)||null),
        borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildAvgWeekly(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('avgWeekly','line',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,
        data:fyS.map(pt=>RAW[pt.y]?.monthly_avgs?.[MONTHS[pt.m-1]]?.total?.weekly?.toFixed(0)||null),
        borderColor:P[0],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('avgWeekly','line',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),
        data:mos.map(m=>RAW[y]?.monthly_avgs?.[MONTHS[m-1]]?.total?.weekly?.toFixed(0)||null),
        borderColor:YC[y],backgroundColor:'transparent',tension:.35,pointRadius:3,borderWidth:2,spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildAvgGuests(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('avgGuests','bar',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,
        data:fyS.map(pt=>RAW[pt.y]?.monthly_avgs?.[MONTHS[pt.m-1]]?.guests?.daily?.toFixed(1)||null),
        backgroundColor:P[0]+'cc',spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('avgGuests','bar',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),
        data:mos.map(m=>RAW[y]?.monthly_avgs?.[MONTHS[m-1]]?.guests?.daily?.toFixed(1)||null),
        backgroundColor:YC[y]+'cc',spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildAvgComp(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('avgComp','bar',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,
        data:fyS.map(pt=>RAW[pt.y]?.monthly_avgs?.[MONTHS[pt.m-1]]?.comp?.daily?.toFixed(1)||null),
        backgroundColor:P[0]+'cc',spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('avgComp','bar',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),
        data:mos.map(m=>RAW[y]?.monthly_avgs?.[MONTHS[m-1]]?.comp?.daily?.toFixed(1)||null),
        backgroundColor:YC[y]+'cc',spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildAvgCorp(){
  const fyS=getFYSeries();
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    mkChart('avgCorp','bar',{
      labels:fyS.map(pt=>pt.label),
      datasets:[{label:`FY${fyYear}`,
        data:fyS.map(pt=>RAW[pt.y]?.monthly_avgs?.[MONTHS[pt.m-1]]?.corporate?.daily?.toFixed(2)||null),
        backgroundColor:P[0]+'cc',spanGaps:true}]
    },{scales:SC});
  } else {
    const mos=getActiveMos(); const years=getYears();
    mkChart('avgCorp','bar',{
      labels:mos.map(m=>MO[m-1]),
      datasets:years.map(y=>({
        label:String(y),
        data:mos.map(m=>RAW[y]?.monthly_avgs?.[MONTHS[m-1]]?.corporate?.daily?.toFixed(2)||null),
        backgroundColor:YC[y]+'cc',spanGaps:true
      }))
    },{scales:SC});
  }
}

function buildAvgTable(){
  const fyS=getFYSeries();
  const tbl=document.getElementById('avgTable');
  const metrics=[{l:'Total',k:'total'},{l:'AM',k:'am'},{l:'PM',k:'pm'},{l:'Guests',k:'guests'},{l:'Members',k:'members'},{l:'Competition',k:'comp'},{l:'Corporate',k:'corporate'}];
  if(fyS){
    const fyYear=parseInt(S.period.replace('fy',''));
    const hdr=`<thead><tr><th>Metric</th>${fyS.map(pt=>`<th>FY${fyYear} ${pt.label} Daily</th>`).join('')}</tr></thead>`;
    const body='<tbody>'+metrics.map(({l,k})=>`<tr><td>${l}</td>${fyS.map(pt=>{
      const v=RAW[pt.y]?.monthly_avgs?.[MONTHS[pt.m-1]]?.[k]?.daily;
      return `<td>${v!=null?v.toFixed(1):'—'}</td>`;
    }).join('')}</tr>`).join('')+'</tbody>';
    tbl.innerHTML=hdr+body;
  } else {
    const mos=getActiveMos(); const years=getYears();
    const hdr=`<thead><tr><th>Metric</th>${years.flatMap(y=>mos.map(m=>`<th style="color:${YC[y]}">${y} ${MO[m-1]} Daily</th>`)).join('')}</tr></thead>`;
    const body='<tbody>'+metrics.map(({l,k})=>`<tr><td>${l}</td>${years.flatMap(y=>mos.map(m=>{
      const v=RAW[y]?.monthly_avgs?.[MONTHS[m-1]]?.[k]?.daily;
      return `<td>${v!=null?v.toFixed(1):'—'}</td>`;
    })).join('')}</tr>`).join('')+'</tbody>';
    tbl.innerHTML=hdr+body;
  }
}

// ═══════════════════════════════════════════════════════
// MEMBERS PAGE
// ═══════════════════════════════════════════════════════
function buildMembKPIs(){
  const nowLabel=new Date().toLocaleString('default',{month:'short',year:'numeric'});
  const kd=[
    {l:'Total Members',v:fmtN(MEMB.total),s:'As of '+nowLabel},
    {l:'Average Age',v:MEMB.avg_age+'yr',s:'Median '+MEMB.median_age+'yr'},
    {l:'Avg Tenure',v:MEMB.avg_tenure+'yr',s:'Average years of membership'},
    {l:'Male Members',v:fmtN(MEMB.male),s:(MEMB.male/MEMB.total*100).toFixed(0)+'% of total'},
    {l:'Female Members',v:fmtN(MEMB.female),s:(MEMB.female/MEMB.total*100).toFixed(0)+'% of total'},
    {l:'New (Last 5yr)',v:fmtN(MEMB.new_5yr),s:'Joined last 5 years'},
    {l:'10+ Year Members',v:fmtN(MEMB.long_10plus),s:(MEMB.long_10plus/MEMB.total*100).toFixed(0)+'% long-standing'},
  ];
  document.getElementById('membKpiRow').innerHTML=kd.map((k,i)=>
    '<div class="kpi s'+i+'"><div class="kpi-lbl">'+k.l+'</div><div class="kpi-val">'+k.v+'</div><div class="kpi-sub">'+k.s+'</div></div>'
  ).join('');
}

function buildMembAge(){
  const ORDER=['Under 30','30s','40s','50s','60s','70s','80+','Unknown'];
  const ag=MEMB.age_groups;
  dc('membAge');
  mkChart('membAge','bar',{
    labels:ORDER,
    datasets:[{label:'Members',data:ORDER.map(k=>ag[k]||0),backgroundColor:P[0]+'cc',borderColor:P[0],borderWidth:1}]
  },{scales:SC});
}

function buildMembTenure(){
  const ORDER=['New (<2yr)','2–5yr','5–10yr','10–20yr','20–30yr','30–50yr','50+yr','Unknown'];
  const tb=MEMB.tenure_buckets;
  dc('membTenure');
  mkChart('membTenure','bar',{
    labels:ORDER,
    datasets:[{label:'Members',data:ORDER.map(k=>tb[k]||0),backgroundColor:ORDER.map((_,i)=>i<3?P[2]+'cc':P[0]+'cc'),borderWidth:0}]
  },{scales:SC});
}

function buildMembJoin(){
  const yr=MEMB.join_trend;
  const labels=Object.keys(yr).sort();
  dc('membJoin');
  mkChart('membJoin','bar',{
    labels,
    datasets:[{label:'New members',data:labels.map(k=>yr[k]||0),backgroundColor:P[0]+'cc',borderColor:P[0],borderWidth:1}]
  },{scales:SC});
}

function buildMembGenderAge(){
  const ORDER=['Under 30','30s','40s','50s','60s','70s','80+'];
  const ga=MEMB.gender_by_age;
  dc('membGenderAge');
  mkChart('membGenderAge','bar',{
    labels:ORDER,
    datasets:[
      {label:'Male',data:ORDER.map(k=>(ga[k]||{}).M||0),backgroundColor:P[0]+'cc',stack:'a'},
      {label:'Female',data:ORDER.map(k=>(ga[k]||{}).F||0),backgroundColor:P[2]+'cc',stack:'a'},
    ]
  },{scales:SC_STACK});
}

function buildMembDriver(){
  const db=MEMB.driver_brands;
  const keys=Object.keys(db).filter(k=>k&&k!=='nan'&&k!=='').slice(0,8);
  dc('membDriver');
  mkChart('membDriver','doughnut',{
    labels:keys,
    datasets:[{data:keys.map(k=>db[k]),backgroundColor:PALETTE,borderWidth:2,borderColor:'#fff'}]
  },{plugins:{legend:{position:'right',labels:{font:{size:10},boxWidth:12}}},scales:{}});
}

function buildMembIrons(){
  const ib=MEMB.iron_brands;
  const keys=Object.keys(ib).filter(k=>k&&k!=='nan'&&k!=='').slice(0,8);
  dc('membIrons');
  mkChart('membIrons','bar',{
    labels:keys,
    datasets:[{label:'Members',data:keys.map(k=>ib[k]),backgroundColor:P[1]+'cc'}]
  },{scales:SC,indexAxis:'y'});
}

function buildMembBall(){
  const bb=MEMB.ball_brands;
  const keys=Object.keys(bb).filter(k=>k&&k!=='nan'&&k!=='').slice(0,8);
  dc('membBall');
  mkChart('membBall','bar',{
    labels:keys,
    datasets:[{label:'Members',data:keys.map(k=>bb[k]),backgroundColor:P[2]+'cc'}]
  },{scales:SC,indexAxis:'y'});
}

function buildMembCoverage(){
  const rows=[
    {l:'Email address',v:MEMB.email_pct},
    {l:'Phone number',v:MEMB.phone_pct},
    {l:'Date of birth',v:95.7},
    {l:'Membership date',v:94.9},
  ];
  document.getElementById('membCoverage').innerHTML=rows.map(r=>`
    <div class="bar-row">
      <div class="bar-lbl">${r.l}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${r.v}%;background:${r.v>=95?'var(--navy)':'var(--silver)'}"></div></div>
      <div class="bar-val">${r.v}%</div>
    </div>`).join('');
}

function buildMembLong(){
  const ORDER=['50+yr','30–50yr','20–30yr','10–20yr'];
  const tb=MEMB.tenure_buckets;
  document.getElementById('membLong').innerHTML=ORDER.map(k=>{
    const v=tb[k]||0;
    return `<div class="bar-row">
      <div class="bar-lbl">${k}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${v/MEMB.total*100*4}%;max-width:100%;background:var(--navy)"></div></div>
      <div class="bar-val">${v}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// MASTER RENDER
// ═══════════════════════════════════════════════════════
function renderAll(){
  buildKPIs();
  const tab=S.activeTab;
  if(tab==='overview'){
    buildMainChart();buildYoYBar();buildCatBars();buildGuestDonut();
    buildTrendLine();buildSeasonOverview();buildInsights();
  }
  if(tab==='monthly'){
    buildMonthlyMain();buildAmPmChart();buildRatioChart();buildCorpEventChart();
    buildDailyAvgChart();buildWeeklyAvgChart();buildMonthlyTable();
  }
  if(tab==='occupancy'){
    buildOccKPIs();buildOccMonthChart();buildOccDayGrid();
    buildOccAmChart();buildOccPmChart();buildOcc3pmChart();buildOccSpotsChart();buildOccTable();
  }
  if(tab==='dayofweek'){
    buildDowTotal();buildDowAmPm();buildDowGuestRatio();buildDowComp();
    buildDowShare();buildDowCorpEvent();buildDowTable();
  }
  if(tab==='guests'){
    buildGuestKPIs();buildGuestTrend();buildGuestMix();buildTravelChart();
    buildCorpMonth();buildMembIntroChart();buildGuestTable();
  }
  if(tab==='seasonal'){
    buildSeasonCards();buildSeasonYear();buildQuarterChart();
    buildSeasonGuests();buildSeasonOcc();buildSeasonTable();
  }
  if(tab==='heatmap')buildAllHeatmaps();
  if(tab==='compare'){
    buildCmpTotal();buildCmpMemGuest();buildCmpCorp();buildCmpComp();buildCmpOcc();
    buildCmpTable();buildCmpMonthTable();
  }
  if(tab==='members'){
    buildMembKPIs();buildMembAge();buildMembTenure();buildMembJoin();
    buildMembGenderAge();buildMembDriver();buildMembIrons();buildMembBall();
    buildMembCoverage();buildMembLong();
  }
  if(tab==='averages'){
    buildAvgDaily();buildAvgWeekly();buildAvgGuests();buildAvgComp();buildAvgCorp();buildAvgTable();
  }
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
Chart.defaults.font.family="'Open Sans',Arial,sans-serif";

// ── MEMBERSHIP ANALYTICS DATA ──
const MEMB=window.ROUNDS_DASHBOARD_MEMB||{};
Chart.defaults.font.size=11;
Chart.defaults.color='#6b6d7a';
Chart.defaults.borderColor='#e4e5e6';

document.addEventListener('DOMContentLoaded',()=>{
  initSidebar();
  // After 3pm toggle
  const tog = document.getElementById('toggle3pm');
  if(tog){
    tog.addEventListener('change', e=>{
      S.exclude3pm = e.target.checked;
      renderAll();
    });
  }
  updateFilterSummary();
  renderAll();
});
