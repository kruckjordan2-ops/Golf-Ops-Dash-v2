// ─────────────────────────────────────────────────────────────────────────────
//  VGC Report Generator
//  Opens a print-ready board report in a new window.
//  Mirrors the Occupancy tab layout + additions.
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_MONTHS  = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
const REPORT_DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const REPORT_QTR     = { Q1:['January','February','March'], Q2:['April','May','June'],
                          Q3:['July','August','September'], Q4:['October','November','December'] };

// Tee-sheet capacity per occurrence of each day of week.
// Derived from Feb 2026 actuals (28 days = 4 of each day).
// Update these if the tee-sheet configuration changes.
const TEESHEET_CAP = {
  Monday:    { am: 61, pm: 89, after3: 74 },
  Tuesday:   { am: 106, pm: 74, after3: 104 },
  Wednesday: { am: 108, pm: 82, after3: 76 },
  Thursday:  { am: 88, pm: 88, after3: 80 },
  Friday:    { am: 87, pm: 81, after3: 85 },
  Saturday:  { am: 91, pm: 89, after3: 40 },
  Sunday:    { am: 96, pm: 88, after3: 80 },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function rpt_weekdayCounts(year, monthName) {
  const mi = REPORT_MONTHS.indexOf(monthName);
  const daysInMonth = new Date(year, mi + 1, 0).getDate();
  const counts = {};
  REPORT_DAYS.forEach(d => counts[d] = 0);
  for (let d = 1; d <= daysInMonth; d++) {
    let wd = new Date(year, mi, d).getDay(); // 0=Sun
    const name = REPORT_DAYS[wd === 0 ? 6 : wd - 1];
    counts[name]++;
  }
  return counts;
}

function rpt_capacity(year, monthName) {
  const wdc = rpt_weekdayCounts(year, monthName);
  let am = 0, pm = 0, after3 = 0;
  REPORT_DAYS.forEach(d => {
    const c = TEESHEET_CAP[d], n = wdc[d];
    am     += c.am    * n;
    pm     += c.pm    * n;
    after3 += c.after3 * n;
  });
  return { am, pm, after3, total: am + pm };
}

function rpt_dayCapacity(year, monthName, dayName) {
  const wdc = rpt_weekdayCounts(year, monthName);
  const c = TEESHEET_CAP[dayName], n = wdc[dayName];
  return { am: c.am * n, pm: c.pm * n, after3: c.after3 * n };
}

// Build month stats from RAW pivot
function rpt_monthData(year, monthName) {
  const RAW = window.ROUNDS_DASHBOARD_RAW;
  const pivot = RAW?.[year]?.pivot?.[monthName];
  if (!pivot) return null;

  const KEYS = ['am','pm','total','guests','members','mgr_intro','interstate',
                'intl','industry','memb_intro','memb_unaccomp','corporate',
                'event','non_playing','voucher','recip','comp'];
  const totals = {};
  KEYS.forEach(k => totals[k] = 0);
  const byDay = {};

  REPORT_DAYS.forEach(day => {
    const v = pivot[day] || {};
    const row = {};
    KEYS.forEach(k => row[k] = v[k] || 0);
    row.after3 = Math.max(0, row.total - row.am - row.pm);
    byDay[day] = row;
    KEYS.forEach(k => totals[k] += row[k]);
  });
  totals.after3 = Math.max(0, totals.total - totals.am - totals.pm);

  const cap = rpt_capacity(year, monthName);
  return { totals, byDay, cap };
}

// Aggregate multiple months
function rpt_aggregateMonths(year, months) {
  const agg = { totals: {}, byDay: {}, cap: { am: 0, pm: 0, after3: 0, total: 0 } };
  const KEYS = ['am','pm','total','after3','guests','members','mgr_intro','interstate',
                'intl','industry','memb_intro','memb_unaccomp','corporate',
                'event','non_playing','voucher','recip','comp'];
  KEYS.forEach(k => agg.totals[k] = 0);
  REPORT_DAYS.forEach(d => { agg.byDay[d] = {}; KEYS.forEach(k => agg.byDay[d][k] = 0); });

  months.forEach(m => {
    const md = rpt_monthData(year, m);
    if (!md) return;
    KEYS.forEach(k => agg.totals[k] += md.totals[k] || 0);
    REPORT_DAYS.forEach(d => KEYS.forEach(k => agg.byDay[d][k] += md.byDay[d]?.[k] || 0));
    agg.cap.am    += md.cap.am;
    agg.cap.pm    += md.cap.pm;
    agg.cap.after3 += md.cap.after3;
    agg.cap.total  += md.cap.total;
  });
  return agg;
}

function pct(n, d) { return d > 0 ? (n / d * 100).toFixed(1) + '%' : '—'; }
function fmt(n)     { return n ? Math.round(n).toLocaleString() : '0'; }
function arrow(a,b) {
  if (!a || !b) return '';
  const d = b - a, p = (d / a * 100).toFixed(1);
  return d > 0 ? `<span class="up">▲ ${p}%</span>` : d < 0 ? `<span class="dn">▼ ${Math.abs(p)}%</span>` : '—';
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function rpt_occBar(bookings, cap) {
  const p = cap > 0 ? Math.min(100, bookings / cap * 100) : 0;
  const col = p >= 90 ? '#2b335c' : p >= 75 ? '#3d7a5c' : p >= 55 ? '#e8a020' : '#c0392b';
  return `<div class="occ-bar-wrap"><div class="occ-bar" style="width:${p.toFixed(0)}%;background:${col}"></div></div>`;
}

function rpt_dayOccTable(data, year, months, label) {
  const isMulti = months.length > 1;
  let rows = '';
  REPORT_DAYS.forEach(day => {
    const v = data.byDay[day];
    const cap = isMulti
      ? { am: months.reduce((s,m)=>s+rpt_dayCapacity(year,m,day).am,0),
          pm: months.reduce((s,m)=>s+rpt_dayCapacity(year,m,day).pm,0) }
      : rpt_dayCapacity(year, months[0], day);
    const totSpots = cap.am + cap.pm;
    rows += `<tr>
      <td class="day-cell">${day}</td>
      <td class="num">${fmt(v.am)}</td><td class="num dim">${fmt(cap.am)}</td>
      <td class="num occ-col">${pct(v.am, cap.am)}</td>
      <td class="num">${fmt(v.pm)}</td><td class="num dim">${fmt(cap.pm)}</td>
      <td class="num occ-col">${pct(v.pm, cap.pm)}</td>
      <td class="num bold">${fmt(v.am + v.pm)}</td><td class="num dim">${fmt(totSpots)}</td>
      <td class="num occ-col">${pct(v.am + v.pm, totSpots)}${rpt_occBar(v.am+v.pm, totSpots)}</td>
    </tr>`;
  });
  const t = data.totals, c = data.cap;
  rows += `<tr class="total-row">
    <td class="day-cell">${label}</td>
    <td class="num">${fmt(t.am)}</td><td class="num dim">${fmt(c.am)}</td>
    <td class="num occ-col">${pct(t.am, c.am)}</td>
    <td class="num">${fmt(t.pm)}</td><td class="num dim">${fmt(c.pm)}</td>
    <td class="num occ-col">${pct(t.pm, c.pm)}</td>
    <td class="num bold">${fmt(t.am + t.pm)}</td><td class="num dim">${fmt(c.total)}</td>
    <td class="num occ-col">${pct(t.am + t.pm, c.total)}${rpt_occBar(t.am+t.pm, c.total)}</td>
  </tr>`;
  return `
  <table class="rpt-table">
    <thead>
      <tr>
        <th rowspan="2" class="day-cell">Day</th>
        <th colspan="3">AM Session</th>
        <th colspan="3">PM Session</th>
        <th colspan="3">Total (Excl. After 3pm)</th>
      </tr>
      <tr>
        <th>Rounds</th><th>Spots</th><th>Occ%</th>
        <th>Rounds</th><th>Spots</th><th>Occ%</th>
        <th>Rounds</th><th>Spots</th><th>Occ%</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function rpt_after3Table(data, year, months) {
  const isMulti = months.length > 1;
  let rows = '';
  let tBkgs = 0, tSpots = 0;
  REPORT_DAYS.forEach(day => {
    const v = data.byDay[day];
    const bkgs = Math.round(v.after3);
    const spots = isMulti
      ? months.reduce((s,m)=>s+rpt_dayCapacity(year,m,day).after3,0)
      : rpt_dayCapacity(year, months[0], day).after3;
    tBkgs += bkgs; tSpots += spots;
    rows += `<tr>
      <td class="day-cell">${day}</td>
      <td class="num">${fmt(bkgs)}</td>
      <td class="num dim">${fmt(spots)}</td>
      <td class="num occ-col">${pct(bkgs, spots)}${rpt_occBar(bkgs, spots)}</td>
    </tr>`;
  });
  rows += `<tr class="total-row">
    <td class="day-cell">Total</td>
    <td class="num">${fmt(tBkgs)}</td>
    <td class="num dim">${fmt(tSpots)}</td>
    <td class="num occ-col">${pct(tBkgs, tSpots)}</td>
  </tr>`;
  return `
  <table class="rpt-table half">
    <thead><tr>
      <th class="day-cell">Day</th><th>Rounds</th><th>Spots</th><th>Occ%</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function rpt_summaryTable(data) {
  const t = data.totals, c = data.cap;
  const after3Spots = c.after3;
  const totalIncl   = t.total;
  const totalSpotsIncl = c.total + after3Spots;
  return `
  <table class="rpt-table half">
    <thead><tr><th>Time</th><th>Rounds</th><th>Spots</th><th>Occ%</th></tr></thead>
    <tbody>
      <tr><td>AM</td><td class="num">${fmt(t.am)}</td><td class="num dim">${fmt(c.am)}</td><td class="num occ-col">${pct(t.am,c.am)}</td></tr>
      <tr><td>PM</td><td class="num">${fmt(t.pm)}</td><td class="num dim">${fmt(c.pm)}</td><td class="num occ-col">${pct(t.pm,c.pm)}</td></tr>
      <tr><td>After 3pm</td><td class="num">${fmt(Math.round(t.after3))}</td><td class="num dim">${fmt(after3Spots)}</td><td class="num occ-col">${pct(t.after3,after3Spots)}</td></tr>
      <tr class="total-row"><td>Total</td><td class="num">${fmt(totalIncl)}</td><td class="num dim">${fmt(totalSpotsIncl)}</td><td class="num occ-col">${pct(totalIncl,totalSpotsIncl)}</td></tr>
    </tbody>
  </table>`;
}

function rpt_yoyTable(months, label) {
  const RAW = window.ROUNDS_DASHBOARD_RAW;
  const years = Object.keys(RAW).map(Number).sort();
  let rows = '';
  let prev = null;
  years.forEach(yr => {
    const agg = rpt_aggregateMonths(yr, months);
    const total = agg.totals.total || 0;
    if (!total) return;
    rows += `<tr>
      <td>${yr}</td>
      <td class="num bold">${fmt(total)}</td>
      <td>${prev ? arrow(prev, total) : '—'}</td>
    </tr>`;
    prev = total;
  });
  return `
  <table class="rpt-table half">
    <thead><tr><th>Year</th><th>${label}</th><th>vs Prior Year</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function rpt_usageRanking(data) {
  const totals = {};
  let grand = 0;
  REPORT_DAYS.forEach(d => { totals[d] = data.byDay[d].total || 0; grand += totals[d]; });
  const sorted = [...REPORT_DAYS].sort((a,b) => totals[b] - totals[a]);
  return sorted.map(d => {
    const p = grand > 0 ? (totals[d] / grand * 100) : 0;
    return `<div class="usage-row">
      <div class="usage-day">${d}</div>
      <div class="usage-bar-wrap"><div class="usage-bar" style="width:${p.toFixed(1)}%"></div></div>
      <div class="usage-pct">${p.toFixed(1)}%</div>
      <div class="usage-num">${fmt(totals[d])}</div>
    </div>`;
  }).join('');
}

function rpt_amPmByDay(data) {
  const max = Math.max(...REPORT_DAYS.map(d => data.byDay[d].total || 0));
  return `<div class="ampm-grid">${REPORT_DAYS.map(d => {
    const v = data.byDay[d];
    const am = v.am || 0, pm = v.pm || 0, a3 = Math.round(v.after3 || 0);
    const scale = max > 0 ? 120 / max : 1;
    return `<div class="ampm-col">
      <div class="ampm-bars">
        <div class="ampm-bar am-bar"  style="height:${(am * scale).toFixed(0)}px" title="AM: ${fmt(am)}"></div>
        <div class="ampm-bar pm-bar"  style="height:${(pm * scale).toFixed(0)}px" title="PM: ${fmt(pm)}"></div>
        <div class="ampm-bar a3-bar"  style="height:${(a3 * scale).toFixed(0)}px" title="After 3pm: ${fmt(a3)}"></div>
      </div>
      <div class="ampm-label">${d.slice(0,3)}</div>
      <div class="ampm-total">${fmt(v.total || 0)}</div>
    </div>`;
  }).join('')}</div>
  <div class="ampm-legend">
    <span class="leg am-leg">AM</span>
    <span class="leg pm-leg">PM</span>
    <span class="leg a3-leg">After 3pm</span>
  </div>`;
}

function rpt_guestBreakdown(data) {
  const t = data.totals;
  const guests = t.guests || 0;
  const total  = t.total  || 0;
  const rows = [
    ['Manager Introduction', t.mgr_intro],
    ['Interstate',           t.interstate],
    ['International',        t.intl],
    ['Industry Guest',       t.industry],
    ['Member Guest (MiClub)', t.memb_intro],
    ['Member Guest Unaccompanied', t.memb_unaccomp],
    ['Corporate',            t.corporate],
    ['Voucher',              t.voucher],
    ['Reciprocal',           t.recip],
    ['Complimentary',        t.comp],
  ].filter(([,v]) => v > 0);
  return `
  <div class="guest-summary">
    <div class="guest-pill">
      <div class="gp-val">${fmt(total)}</div><div class="gp-lbl">Total Rounds</div>
    </div>
    <div class="guest-pill mem">
      <div class="gp-val">${fmt(t.members)}</div>
      <div class="gp-lbl">Members <span class="gp-pct">${pct(t.members,total)}</span></div>
    </div>
    <div class="guest-pill gst">
      <div class="gp-val">${fmt(guests)}</div>
      <div class="gp-lbl">Guests <span class="gp-pct">${pct(guests,total)}</span></div>
    </div>
  </div>
  <table class="rpt-table half" style="margin-top:12px">
    <thead><tr><th>Guest Category</th><th>Rounds</th><th>% of Guests</th></tr></thead>
    <tbody>${rows.map(([lbl,val])=>`<tr>
      <td>${lbl}</td><td class="num">${fmt(val)}</td>
      <td class="num dim">${guests>0?(val/guests*100).toFixed(1)+'%':'—'}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// Monthly breakdown table (for quarterly report)
function rpt_monthlyBreakdown(year, months) {
  let rows = '';
  months.forEach(m => {
    const md = rpt_monthData(year, m);
    if (!md) return;
    const t = md.totals, c = md.cap;
    rows += `<tr>
      <td>${m}</td>
      <td class="num">${fmt(t.am)}</td><td class="num">${fmt(t.pm)}</td>
      <td class="num dim">${fmt(Math.round(t.after3))}</td>
      <td class="num bold">${fmt(t.total)}</td>
      <td class="num dim">${fmt(c.total)}</td>
      <td class="num occ-col">${pct(t.am+t.pm, c.total)}</td>
      <td class="num">${fmt(t.members)}</td>
      <td class="num">${fmt(t.guests)}</td>
    </tr>`;
  });
  return `
  <table class="rpt-table">
    <thead><tr>
      <th>Month</th><th>AM</th><th>PM</th><th>After 3pm</th>
      <th>Total</th><th>Capacity</th><th>Occ%</th>
      <th>Members</th><th>Guests</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Main report HTML ──────────────────────────────────────────────────────────

function rpt_buildHTML(year, months, title, subtitle) {
  const isQtr = months.length > 1;
  const data = rpt_aggregateMonths(year, months);
  const dateStr = new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e2230;background:#fff;padding:20px 32px}
    @media print{body{padding:10px 20px}.no-print{display:none!important}@page{margin:1.5cm}}

    /* Header */
    .rpt-header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:14px;border-bottom:3px solid #2b335c;margin-bottom:20px}
    .rpt-title h1{font-size:18px;font-weight:700;color:#2b335c;letter-spacing:.2px}
    .rpt-title h2{font-size:13px;font-weight:400;color:#5a585c;margin-top:3px}
    .rpt-meta{text-align:right;font-size:10px;color:#898b8d;line-height:1.7}
    .rpt-meta strong{color:#2b335c}

    /* KPI strip */
    .kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
    .kpi{background:#f5f6f9;border-radius:6px;padding:12px 16px;border-left:3px solid #2b335c}
    .kpi-val{font-size:22px;font-weight:700;color:#2b335c}
    .kpi-lbl{font-size:10px;color:#898b8d;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
    .kpi-sub{font-size:10px;color:#5a585c;margin-top:4px}

    /* Sections */
    .rpt-section{margin-bottom:28px}
    .rpt-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;
      color:#fff;background:#2b335c;padding:5px 10px;margin-bottom:10px;border-radius:3px}

    /* Two-column layout */
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .two-col-3{display:grid;grid-template-columns:2fr 1fr;gap:20px}

    /* Tables */
    .rpt-table{border-collapse:collapse;width:100%;font-size:11px}
    .rpt-table.half{max-width:520px}
    .rpt-table th{background:#2b335c;color:#fff;padding:5px 8px;text-align:center;font-weight:600;font-size:10px}
    .rpt-table td{padding:5px 8px;border-bottom:1px solid #e4e5e6}
    .rpt-table tbody tr:hover{background:#f5f6f9}
    .rpt-table .day-cell{font-weight:600;color:#2b335c;text-align:left}
    .rpt-table .num{text-align:right}
    .rpt-table .bold{font-weight:700}
    .rpt-table .dim{color:#898b8d}
    .rpt-table .occ-col{text-align:right;font-weight:600}
    .total-row{background:#eef0f5!important;font-weight:700}
    .total-row td{border-top:2px solid #2b335c;border-bottom:none}

    /* Occupancy mini-bar */
    .occ-bar-wrap{height:4px;background:#e4e5e6;border-radius:2px;margin-top:3px;width:80px;display:inline-block;vertical-align:middle;margin-left:6px}
    .occ-bar{height:4px;border-radius:2px}

    /* Usage ranking */
    .usage-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
    .usage-day{width:90px;font-weight:600;color:#2b335c;font-size:11px}
    .usage-bar-wrap{flex:1;height:14px;background:#e4e5e6;border-radius:3px;overflow:hidden}
    .usage-bar{height:14px;background:#2b335c;border-radius:3px;transition:width .3s}
    .usage-pct{width:45px;text-align:right;font-size:11px;font-weight:600;color:#3d4678}
    .usage-num{width:45px;text-align:right;font-size:10px;color:#898b8d}

    /* AM/PM chart */
    .ampm-grid{display:flex;align-items:flex-end;gap:6px;padding:8px 0 0}
    .ampm-col{display:flex;flex-direction:column;align-items:center;flex:1}
    .ampm-bars{display:flex;align-items:flex-end;gap:2px;height:130px}
    .ampm-bar{width:16px;border-radius:2px 2px 0 0;min-height:2px}
    .am-bar{background:#2b335c}
    .pm-bar{background:#5a6090}
    .a3-bar{background:#b8b9bb}
    .ampm-label{font-size:10px;font-weight:700;color:#2b335c;margin-top:4px}
    .ampm-total{font-size:10px;color:#898b8d}
    .ampm-legend{display:flex;gap:16px;margin-top:10px;font-size:10px}
    .leg{display:flex;align-items:center;gap:5px}
    .leg::before{content:'';width:12px;height:12px;border-radius:2px;display:inline-block}
    .am-leg::before{background:#2b335c}
    .pm-leg::before{background:#5a6090}
    .a3-leg::before{background:#b8b9bb}

    /* Guest pills */
    .guest-summary{display:flex;gap:12px;margin-bottom:4px}
    .guest-pill{background:#f5f6f9;border-radius:6px;padding:10px 16px;border-left:3px solid #2b335c;flex:1}
    .guest-pill.mem{border-color:#3d7a5c}
    .guest-pill.gst{border-color:#5a6090}
    .gp-val{font-size:20px;font-weight:700;color:#2b335c}
    .gp-lbl{font-size:10px;color:#898b8d;text-transform:uppercase;letter-spacing:.4px;margin-top:2px}
    .gp-pct{color:#5a6090;font-weight:600}

    /* YoY */
    .up{color:#2a7a4c;font-weight:600}
    .dn{color:#c0392b;font-weight:600}

    /* Print button */
    .print-btn{display:inline-flex;align-items:center;gap:6px;background:#2b335c;color:#fff;
      border:none;border-radius:4px;padding:8px 18px;font-size:12px;font-weight:600;
      cursor:pointer;margin-bottom:20px}
    .print-btn:hover{background:#1e2540}

    /* Footer */
    .rpt-footer{margin-top:28px;padding-top:12px;border-top:1px solid #e4e5e6;
      font-size:9px;color:#898b8d;display:flex;justify-content:space-between}
  `;

  const t = data.totals, c = data.cap;
  const guestRatio = t.total > 0 ? (t.guests / t.total * 100).toFixed(1) + '%' : '—';
  const after3Pct  = (t.am + t.pm) > 0 ? pct(t.after3, t.am + t.pm) : '—';
  const occPct     = pct(t.am + t.pm, c.total);

  const kpiYoY = (() => {
    const RAW = window.ROUNDS_DASHBOARD_RAW;
    const years = Object.keys(RAW).map(Number).sort();
    const curYr = year, prevYr = year - 1;
    if (!RAW[prevYr]) return '';
    const cur  = rpt_aggregateMonths(curYr, months).totals.total;
    const prev = rpt_aggregateMonths(prevYr, months).totals.total;
    if (!prev) return '';
    const d = cur - prev, p = (d / prev * 100).toFixed(1);
    return d >= 0 ? `▲ ${p}% vs ${prevYr}` : `▼ ${Math.abs(p)}% vs ${prevYr}`;
  })();

  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${css}</style>
  </head><body>

  <button class="print-btn no-print" onclick="window.print()">⎙ Print / Save as PDF</button>

  <div class="rpt-header">
    <div class="rpt-title">
      <h1>The Victoria Golf Club</h1>
      <h2>Golf Operations Report — ${title}</h2>
    </div>
    <div class="rpt-meta">
      <div>Prepared for: <strong>General Manager</strong></div>
      <div>Report period: <strong>${subtitle}</strong></div>
      <div>Generated: <strong>${dateStr}</strong></div>
      <div style="margin-top:4px;font-size:9px">Occupancy based on estimated tee-sheet capacity</div>
    </div>
  </div>

  <!-- KPI Strip -->
  <div class="kpi-strip">
    <div class="kpi">
      <div class="kpi-val">${fmt(t.total)}</div>
      <div class="kpi-lbl">Total Rounds</div>
      ${kpiYoY ? `<div class="kpi-sub">${kpiYoY}</div>` : ''}
    </div>
    <div class="kpi">
      <div class="kpi-val">${fmt(t.members)}</div>
      <div class="kpi-lbl">Member Rounds</div>
      <div class="kpi-sub">${pct(t.members, t.total)} of total</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">${fmt(t.guests)}</div>
      <div class="kpi-lbl">Guest Rounds</div>
      <div class="kpi-sub">${guestRatio} of total</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">${occPct}</div>
      <div class="kpi-lbl">Occupancy (Excl. After 3pm)</div>
      <div class="kpi-sub">${fmt(t.am+t.pm)} of ${fmt(c.total)} spots</div>
    </div>
  </div>

  ${isQtr ? `
  <!-- Monthly breakdown for quarterly reports -->
  <div class="rpt-section">
    <div class="rpt-section-title">Monthly Breakdown</div>
    ${rpt_monthlyBreakdown(year, months)}
  </div>` : ''}

  <!-- Day Occupancy -->
  <div class="rpt-section">
    <div class="rpt-section-title">Day Occupancy</div>
    ${rpt_dayOccTable(data, year, months, subtitle)}
  </div>

  <!-- After 3pm + Occupancy summary side by side -->
  <div class="two-col">
    <div class="rpt-section">
      <div class="rpt-section-title">After 3pm Utilisation</div>
      ${rpt_after3Table(data, year, months)}
    </div>
    <div class="rpt-section">
      <div class="rpt-section-title">Occupancy Summary (Incl. After 3pm)</div>
      ${rpt_summaryTable(data)}
    </div>
  </div>

  <!-- Usage ranking + AM/PM chart side by side -->
  <div class="two-col">
    <div class="rpt-section">
      <div class="rpt-section-title">Daily Round Usage</div>
      ${rpt_usageRanking(data)}
    </div>
    <div class="rpt-section">
      <div class="rpt-section-title">AM / PM / After 3pm by Day</div>
      ${rpt_amPmByDay(data)}
    </div>
  </div>

  <!-- Year-on-Year + Guest breakdown side by side -->
  <div class="two-col">
    <div class="rpt-section">
      <div class="rpt-section-title">Year-on-Year Comparison — ${isQtr ? subtitle : months[0]}</div>
      ${rpt_yoyTable(months, months.length > 1 ? 'Total Rounds' : months[0] + ' Rounds')}
    </div>
    <div class="rpt-section">
      <div class="rpt-section-title">Round Composition</div>
      ${rpt_guestBreakdown(data)}
    </div>
  </div>

  <div class="rpt-footer">
    <span>The Victoria Golf Club — Golf Operations</span>
    <span>${title} · Generated ${dateStr}</span>
  </div>

  </body></html>`;
}

// ── Filtered report helpers ──────────────────────────────────────────────────

function rpt_filterSummary() {
  const parts = [];
  // Year
  if (S.year === 'all') parts.push('All Years');
  else parts.push(String(S.year));
  // Period
  if (S.periodType === 'fy' && S.period) {
    const fy = parseInt(S.period.replace('fy',''));
    parts.push('FY' + fy + ' (Jul ' + (fy-1) + ' – Jun ' + fy + ')');
  } else if (S.periodType === 'q' && S.period) {
    parts.push(S.period.toUpperCase());
  } else if (S.periodType === 'season' && S.period) {
    parts.push(S.period.charAt(0).toUpperCase() + S.period.slice(1));
  } else if (S.periodType === 'month' && S.period) {
    parts.push(REPORT_MONTHS[parseInt(S.period)-1] || S.period);
  }
  // Month filters
  if (S.months.size < 12) parts.push(S.months.size + ' months selected');
  // Day filters
  if (S.days.size < 7) parts.push(S.days.size + ' days selected');
  // Exclude 3pm
  if (S.exclude3pm) parts.push('Excl. after 3pm');
  return parts.join(' · ');
}

function rpt_generateFiltered() {
  const RAW = window.ROUNDS_DASHBOARD_RAW;
  const modal = document.getElementById('rpt-modal');
  if (modal) modal.remove();

  // Determine active months from S state
  const activeMos = getActiveMos(); // returns array of month numbers 1-12
  const monthNames = activeMos.map(m => REPORT_MONTHS[m-1]);

  // Handle FY spanning two calendar years
  if (S.periodType === 'fy' && S.period) {
    const fy = parseInt(S.period.replace('fy',''));
    const priorYear = fy - 1;
    const priorMonths = [7,8,9,10,11,12].map(m => REPORT_MONTHS[m-1]);
    const curMonths = [1,2,3,4,5,6].map(m => REPORT_MONTHS[m-1]);

    // Aggregate across both halves
    const dataPrior = rpt_aggregateMonths(priorYear, priorMonths);
    const dataCur = rpt_aggregateMonths(fy, curMonths);

    // Combine
    const KEYS = ['am','pm','total','after3','guests','members','mgr_intro','interstate',
                  'intl','industry','memb_intro','memb_unaccomp','corporate',
                  'event','non_playing','voucher','recip','comp'];
    KEYS.forEach(k => dataPrior.totals[k] = (dataPrior.totals[k]||0) + (dataCur.totals[k]||0));
    REPORT_DAYS.forEach(d => KEYS.forEach(k => dataPrior.byDay[d][k] = (dataPrior.byDay[d][k]||0) + (dataCur.byDay[d][k]||0)));
    dataPrior.cap.am += dataCur.cap.am;
    dataPrior.cap.pm += dataCur.cap.pm;
    dataPrior.cap.after3 += dataCur.cap.after3;
    dataPrior.cap.total += dataCur.cap.total;

    const title = 'FY' + fy + ' (Jul ' + priorYear + ' – Jun ' + fy + ')';
    const subtitle = title;
    // Build using a custom approach since rpt_buildHTML expects a single year
    const html = rpt_buildFilteredHTML(dataPrior, title, subtitle);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    return;
  }

  // For non-FY: iterate across active years
  const years = S.year === 'all' ? Object.keys(RAW).map(Number).sort() : [S.year];

  if (years.length === 1) {
    // Single year — use standard report builder
    const year = years[0];
    const title = rpt_filterSummary();
    const subtitle = title;
    const html = rpt_buildHTML(year, monthNames, title, subtitle);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  } else {
    // Multi-year: aggregate all years together
    const KEYS = ['am','pm','total','after3','guests','members','mgr_intro','interstate',
                  'intl','industry','memb_intro','memb_unaccomp','corporate',
                  'event','non_playing','voucher','recip','comp'];
    const combined = { totals:{}, byDay:{}, cap:{am:0,pm:0,after3:0,total:0} };
    KEYS.forEach(k => combined.totals[k] = 0);
    REPORT_DAYS.forEach(d => { combined.byDay[d] = {}; KEYS.forEach(k => combined.byDay[d][k] = 0); });

    years.forEach(year => {
      const agg = rpt_aggregateMonths(year, monthNames);
      KEYS.forEach(k => combined.totals[k] += agg.totals[k] || 0);
      REPORT_DAYS.forEach(d => KEYS.forEach(k => combined.byDay[d][k] += agg.byDay[d]?.[k] || 0));
      combined.cap.am += agg.cap.am;
      combined.cap.pm += agg.cap.pm;
      combined.cap.after3 += agg.cap.after3;
      combined.cap.total += agg.cap.total;
    });

    const title = rpt_filterSummary();
    const subtitle = title;
    const html = rpt_buildFilteredHTML(combined, title, subtitle);
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }
}

// Build report HTML from pre-aggregated data (for multi-year / FY reports)
function rpt_buildFilteredHTML(data, title, subtitle) {
  const dateStr = new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});
  const t = data.totals, c = data.cap;
  const guestRatio = t.total > 0 ? (t.guests / t.total * 100).toFixed(1) + '%' : '—';
  const occPct = pct(t.am + t.pm, c.total);

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e2230;background:#fff;padding:20px 32px}
    @media print{body{padding:10px 20px}.no-print{display:none!important}@page{margin:1.5cm}}
    .rpt-header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:14px;border-bottom:3px solid #2b335c;margin-bottom:20px}
    .rpt-title h1{font-size:18px;font-weight:700;color:#2b335c;letter-spacing:.2px}
    .rpt-title h2{font-size:13px;font-weight:400;color:#5a585c;margin-top:3px}
    .rpt-meta{text-align:right;font-size:10px;color:#898b8d;line-height:1.7}
    .rpt-meta strong{color:#2b335c}
    .kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
    .kpi{background:#f5f6f9;border-radius:6px;padding:12px 16px;border-left:3px solid #2b335c}
    .kpi-val{font-size:22px;font-weight:700;color:#2b335c}
    .kpi-lbl{font-size:10px;color:#898b8d;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
    .kpi-sub{font-size:10px;color:#5a585c;margin-top:4px}
    .rpt-section{margin-bottom:28px}
    .rpt-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#fff;background:#2b335c;padding:5px 10px;margin-bottom:10px;border-radius:3px}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .rpt-table{border-collapse:collapse;width:100%;font-size:11px}
    .rpt-table.half{max-width:520px}
    .rpt-table th{background:#2b335c;color:#fff;padding:5px 8px;text-align:center;font-weight:600;font-size:10px}
    .rpt-table td{padding:5px 8px;border-bottom:1px solid #e4e5e6}
    .rpt-table tbody tr:hover{background:#f5f6f9}
    .rpt-table .day-cell{font-weight:600;color:#2b335c;text-align:left}
    .rpt-table .num{text-align:right}
    .rpt-table .bold{font-weight:700}
    .rpt-table .dim{color:#898b8d}
    .rpt-table .occ-col{text-align:right;font-weight:600}
    .total-row{background:#eef0f5!important;font-weight:700}
    .total-row td{border-top:2px solid #2b335c;border-bottom:none}
    .occ-bar-wrap{height:4px;background:#e4e5e6;border-radius:2px;margin-top:3px;width:80px;display:inline-block;vertical-align:middle;margin-left:6px}
    .occ-bar{height:4px;border-radius:2px}
    .usage-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
    .usage-day{width:90px;font-weight:600;color:#2b335c;font-size:11px}
    .usage-bar-wrap{flex:1;height:14px;background:#e4e5e6;border-radius:3px;overflow:hidden}
    .usage-bar{height:14px;background:#2b335c;border-radius:3px}
    .usage-pct{width:45px;text-align:right;font-size:11px;font-weight:600;color:#3d4678}
    .usage-num{width:45px;text-align:right;font-size:10px;color:#898b8d}
    .guest-summary{display:flex;gap:12px;margin-bottom:4px}
    .guest-pill{background:#f5f6f9;border-radius:6px;padding:10px 16px;border-left:3px solid #2b335c;flex:1}
    .guest-pill.mem{border-color:#3d7a5c}
    .guest-pill.gst{border-color:#5a6090}
    .gp-val{font-size:20px;font-weight:700;color:#2b335c}
    .gp-lbl{font-size:10px;color:#898b8d;text-transform:uppercase;letter-spacing:.4px;margin-top:2px}
    .gp-pct{color:#5a6090;font-weight:600}
    .print-btn{display:inline-flex;align-items:center;gap:6px;background:#2b335c;color:#fff;border:none;border-radius:4px;padding:8px 18px;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:20px}
    .print-btn:hover{background:#1e2540}
    .rpt-footer{margin-top:28px;padding-top:12px;border-top:1px solid #e4e5e6;font-size:9px;color:#898b8d;display:flex;justify-content:space-between}
  `;

  // Build day occupancy table inline (can't use rpt_dayOccTable since it needs year/months for capacity)
  let dayRows = '';
  REPORT_DAYS.forEach(day => {
    const v = data.byDay[day];
    const am = v.am||0, pm = v.pm||0, total = am+pm;
    dayRows += `<tr>
      <td class="day-cell">${day}</td>
      <td class="num">${fmt(am)}</td>
      <td class="num">${fmt(pm)}</td>
      <td class="num dim">${fmt(Math.round(v.after3||0))}</td>
      <td class="num bold">${fmt(v.total||0)}</td>
      <td class="num">${fmt(v.members||0)}</td>
      <td class="num">${fmt(v.guests||0)}</td>
    </tr>`;
  });
  dayRows += `<tr class="total-row">
    <td class="day-cell">Total</td>
    <td class="num">${fmt(t.am)}</td>
    <td class="num">${fmt(t.pm)}</td>
    <td class="num dim">${fmt(Math.round(t.after3||0))}</td>
    <td class="num bold">${fmt(t.total)}</td>
    <td class="num">${fmt(t.members)}</td>
    <td class="num">${fmt(t.guests)}</td>
  </tr>`;

  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><title>${title}</title>
  <style>${css}</style>
  </head><body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="rpt-header">
    <div class="rpt-title">
      <h1>The Victoria Golf Club</h1>
      <h2>Golf Operations Report — ${title}</h2>
    </div>
    <div class="rpt-meta">
      <div>Prepared for: <strong>General Manager</strong></div>
      <div>Report period: <strong>${subtitle}</strong></div>
      <div>Generated: <strong>${dateStr}</strong></div>
    </div>
  </div>
  <div class="kpi-strip">
    <div class="kpi"><div class="kpi-val">${fmt(t.total)}</div><div class="kpi-lbl">Total Rounds</div></div>
    <div class="kpi"><div class="kpi-val">${fmt(t.members)}</div><div class="kpi-lbl">Member Rounds</div><div class="kpi-sub">${pct(t.members, t.total)} of total</div></div>
    <div class="kpi"><div class="kpi-val">${fmt(t.guests)}</div><div class="kpi-lbl">Guest Rounds</div><div class="kpi-sub">${guestRatio} of total</div></div>
    <div class="kpi"><div class="kpi-val">${occPct}</div><div class="kpi-lbl">Occupancy</div><div class="kpi-sub">${fmt(t.am+t.pm)} of ${fmt(c.total)} spots</div></div>
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Rounds by Day of Week</div>
    <table class="rpt-table">
      <thead><tr><th class="day-cell">Day</th><th>AM</th><th>PM</th><th>After 3pm</th><th>Total</th><th>Members</th><th>Guests</th></tr></thead>
      <tbody>${dayRows}</tbody>
    </table>
  </div>
  <div class="two-col">
    <div class="rpt-section">
      <div class="rpt-section-title">Daily Round Usage</div>
      ${rpt_usageRanking(data)}
    </div>
    <div class="rpt-section">
      <div class="rpt-section-title">Round Composition</div>
      ${rpt_guestBreakdown(data)}
    </div>
  </div>
  <div class="rpt-footer">
    <span>The Victoria Golf Club — Golf Operations</span>
    <span>${title} · Generated ${dateStr}</span>
  </div>
  </body></html>`;
}

// ── Modal UI ─────────────────────────────────────────────────────────────────

function openReportModal(type) {
  const RAW = window.ROUNDS_DASHBOARD_RAW;
  const years = Object.keys(RAW).map(Number).sort().reverse();

  const existingModal = document.getElementById('rpt-modal');
  if (existingModal) existingModal.remove();

  // Filtered report — show current filter summary and generate directly
  if (type === 'filtered') {
    const modal = document.createElement('div');
    modal.id = 'rpt-modal';
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center`;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:8px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.25)">
        <h3 style="font-size:14px;font-weight:700;color:#2b335c;margin-bottom:4px">
          Generate Report from Current Filters
        </h3>
        <p style="font-size:11px;color:#898b8d;margin-bottom:16px">${rpt_filterSummary()}</p>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('rpt-modal').remove()"
            style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:12px">
            Cancel
          </button>
          <button onclick="rpt_generateFiltered()"
            style="flex:2;padding:8px;border:none;border-radius:4px;background:#2b335c;color:#fff;font-weight:700;cursor:pointer;font-size:12px">
            Generate Report
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    return;
  }

  const yearOpts = years.map(y => `<option value="${y}">${y}</option>`).join('');

  const bodyContent = type === 'monthly' ? `
    <label>Month<br>
      <select id="rpt-month" style="width:100%;margin-top:4px;padding:6px;border:1px solid #ddd;border-radius:4px">
        ${REPORT_MONTHS.map(m=>`<option value="${m}">${m}</option>`).join('')}
      </select>
    </label>` : `
    <label>Quarter<br>
      <select id="rpt-qtr" style="width:100%;margin-top:4px;padding:6px;border:1px solid #ddd;border-radius:4px">
        <option value="Q1">Q1 — Jan, Feb, Mar</option>
        <option value="Q2">Q2 — Apr, May, Jun</option>
        <option value="Q3">Q3 — Jul, Aug, Sep</option>
        <option value="Q4">Q4 — Oct, Nov, Dec</option>
      </select>
    </label>`;

  const modal = document.createElement('div');
  modal.id = 'rpt-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:24px;width:300px;box-shadow:0 8px 32px rgba(0,0,0,.25)">
      <h3 style="font-size:14px;font-weight:700;color:#2b335c;margin-bottom:16px">
        Generate ${type === 'monthly' ? 'Monthly' : 'Quarterly'} Report
      </h3>
      <div style="display:flex;flex-direction:column;gap:12px;font-size:12px;color:#1e2230">
        <label>Year<br>
          <select id="rpt-year" style="width:100%;margin-top:4px;padding:6px;border:1px solid #ddd;border-radius:4px">
            ${yearOpts}
          </select>
        </label>
        ${bodyContent}
      </div>
      <div style="display:flex;gap:8px;margin-top:20px">
        <button onclick="document.getElementById('rpt-modal').remove()"
          style="flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:12px">
          Cancel
        </button>
        <button onclick="rpt_generate('${type}')"
          style="flex:2;padding:8px;border:none;border-radius:4px;background:#2b335c;color:#fff;font-weight:700;cursor:pointer;font-size:12px">
          Generate Report
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Default month/quarter to current
  const now = new Date();
  if (type === 'monthly') {
    const mi = (now.getMonth() + 11) % 12; // previous month
    document.getElementById('rpt-month').selectedIndex = mi;
  } else {
    const q = Math.floor((now.getMonth()) / 3); // current quarter
    document.getElementById('rpt-qtr').selectedIndex = Math.max(0, q - 1);
  }
}

function rpt_generate(type) {
  const year = parseInt(document.getElementById('rpt-year').value);
  let months, title, subtitle;

  if (type === 'monthly') {
    const month = document.getElementById('rpt-month').value;
    months   = [month];
    title    = `${month} ${year}`;
    subtitle = `${month} ${year}`;
  } else {
    const qtr = document.getElementById('rpt-qtr').value;
    months   = REPORT_QTR[qtr];
    title    = `${qtr} ${year} (${months[0].slice(0,3)}–${months[2].slice(0,3)})`;
    subtitle = `${qtr} ${year} — ${months[0]} to ${months[2]}`;
  }

  document.getElementById('rpt-modal').remove();
  const html = rpt_buildHTML(year, months, title, subtitle);
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}
