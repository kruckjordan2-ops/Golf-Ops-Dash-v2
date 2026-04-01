// ─────────────────────────────────────────────────────────────────────────────
//  VGC Pace of Play — Report Generator
//  Print-ready HTML report + CSV export
// ─────────────────────────────────────────────────────────────────────────────

const RPT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e2230;background:#fff;padding:20px 32px}
  @media print{body{padding:10px 20px}.no-print{display:none!important}@page{margin:1.5cm}}
  .rpt-header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:14px;border-bottom:3px solid #2b335c;margin-bottom:20px}
  .rpt-title h1{font-size:18px;font-weight:700;color:#2b335c;letter-spacing:.2px}
  .rpt-title h2{font-size:13px;font-weight:400;color:#5a585c;margin-top:3px}
  .rpt-meta{text-align:right;font-size:10px;color:#898b8d;line-height:1.7}
  .rpt-meta strong{color:#2b335c}
  .kpi-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px}
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
  .rpt-table .l{text-align:left;font-weight:600;color:#2b335c}
  .rpt-table .r{text-align:right}
  .rpt-table .bold{font-weight:700}
  .rpt-table .dim{color:#898b8d}
  .rpt-table .green{color:#1a7a3e}
  .rpt-table .amber{color:#b8630a}
  .rpt-table .red{color:#8b1a1a}
  .total-row{background:#eef0f5!important;font-weight:700}
  .total-row td{border-top:2px solid #2b335c;border-bottom:none}
  .pace-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
  .pace-card{border-radius:6px;padding:14px 16px;text-align:center}
  .pace-card.fast{background:#e8f5ee;border-top:3px solid #1a7a3e}
  .pace-card.ok{background:#f5f6f9;border-top:3px solid #2b335c}
  .pace-card.watch{background:#fef3e2;border-top:3px solid #b8630a}
  .pace-card.slow{background:#faeaea;border-top:3px solid #8b1a1a}
  .pace-val{font-size:24px;font-weight:700}
  .pace-card.fast .pace-val{color:#1a7a3e}
  .pace-card.ok .pace-val{color:#2b335c}
  .pace-card.watch .pace-val{color:#b8630a}
  .pace-card.slow .pace-val{color:#8b1a1a}
  .pace-lbl{font-size:10px;color:#898b8d;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
  .print-btn{display:inline-flex;align-items:center;gap:6px;background:#2b335c;color:#fff;border:none;border-radius:4px;padding:8px 18px;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:20px;margin-right:8px}
  .print-btn:hover{background:#1e2540}
  .rpt-footer{margin-top:28px;padding-top:12px;border-top:1px solid #e4e5e6;font-size:9px;color:#898b8d;display:flex;justify-content:space-between}
`;

// ── Get filtered members (mirrors renderMembers filter logic) ───────────────

function rpt_getFiltered(){
  const search = document.getElementById('memberSearch').value.toLowerCase();
  const gender = document.getElementById('genderFilter').value;
  const pace = document.getElementById('paceFilter').value;
  const minR = parseInt(document.getElementById('minRounds').value);
  const tenure = document.getElementById('tenureFilter').value;
  const age = document.getElementById('ageFilter').value;
  return MEMBERS.filter(m => {
    if(m.rounds < minR) return false;
    if(gender && m.gender !== gender) return false;
    if(pace && getPaceRating(m.avgMins) !== pace) return false;
    if(search && !m.name.toLowerCase().includes(search)) return false;
    if(tenure && m.tenure_bucket !== tenure) return false;
    if(age && m.age_group !== age) return false;
    return true;
  });
}

function rpt_filterDesc(){
  const parts = [];
  const gender = document.getElementById('genderFilter').value;
  const pace = document.getElementById('paceFilter').value;
  const minR = parseInt(document.getElementById('minRounds').value);
  const tenure = document.getElementById('tenureFilter').value;
  const age = document.getElementById('ageFilter').value;
  const search = document.getElementById('memberSearch').value;
  if(gender) parts.push('Gender: '+(gender==='m'?'Male':'Female'));
  if(pace) parts.push('Pace: '+pace);
  if(minR > 1) parts.push('Min rounds: '+minR);
  if(tenure) parts.push('Tenure: '+tenure);
  if(age) parts.push('Age: '+age);
  if(search) parts.push('Search: "'+search+'"');
  return parts.length ? parts.join(' | ') : 'All Members (no filters)';
}

function rpt_paceLabel(rating){
  return {fast:'Great (<4h)', ok:'On Pace (4h-4h20)', watch:'Watch (4h20-4h40)', slow:'Slow (>4h40)'}[rating]||rating;
}

// ── CSV Download ────────────────────────────────────────────────────────────

function rpt_downloadCSV(filename, headers, rows){
  const csv = [headers.join(','), ...rows.map(r => r.map(v => '"'+(v??'')+'"').join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadPaceCSV(){
  const ts = new Date().toISOString().slice(0,10);
  const list = rpt_getFiltered();
  const headers = ['Name','Gender','Tenure','Age Group','Rounds','Avg Minutes','Avg Time','Pace Rating','vs Club Avg'];
  const rows = list.map(m => {
    const clubAvg = m.gender === 'f' ? CLUB_AVG_F : CLUB_AVG_M;
    const diff = m.avgMins - clubAvg;
    return [m.name, m.gender==='f'?'Female':'Male', m.tenure_bucket||'', m.age_group||'',
      m.rounds, m.avgMins.toFixed(1), fmtMins(m.avgMins), rpt_paceLabel(getPaceRating(m.avgMins)),
      (diff>=0?'+':'')+Math.round(diff)+'m'];
  });
  rpt_downloadCSV('pace-of-play-'+ts+'.csv', headers, rows);
  document.getElementById('rpt-modal')?.remove();
}

// ── Print Report ────────────────────────────────────────────────────────────

function generatePaceReport(){
  document.getElementById('rpt-modal')?.remove();

  const list = rpt_getFiltered();
  const all = list.filter(m => m.rounds >= 1);
  const males = all.filter(m => m.gender === 'm');
  const females = all.filter(m => m.gender === 'f');
  const clubAvg = all.length ? all.reduce((s,m) => s+m.avgMins, 0)/all.length : 0;
  const maleAvg = males.length ? males.reduce((s,m) => s+m.avgMins, 0)/males.length : 0;
  const femaleAvg = females.length ? females.reduce((s,m) => s+m.avgMins, 0)/females.length : 0;
  const dateStr = new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});

  const fast = all.filter(m => getPaceRating(m.avgMins)==='fast').length;
  const ok = all.filter(m => getPaceRating(m.avgMins)==='ok').length;
  const watch = all.filter(m => getPaceRating(m.avgMins)==='watch').length;
  const slow = all.filter(m => getPaceRating(m.avgMins)==='slow').length;

  // KPI strip
  const kpis = `
  <div class="kpi-strip">
    <div class="kpi"><div class="kpi-val">${all.length}</div><div class="kpi-lbl">Members Tracked</div><div class="kpi-sub">${all.reduce((s,m)=>s+m.rounds,0).toLocaleString()} total rounds</div></div>
    <div class="kpi"><div class="kpi-val">${fmtMins(clubAvg)}</div><div class="kpi-lbl">Club Average</div><div class="kpi-sub">All members</div></div>
    <div class="kpi"><div class="kpi-val">${fmtMins(maleAvg)}</div><div class="kpi-lbl">Male Average</div><div class="kpi-sub">${males.length} members</div></div>
    <div class="kpi"><div class="kpi-val">${females.length?fmtMins(femaleAvg):'—'}</div><div class="kpi-lbl">Female Average</div><div class="kpi-sub">${females.length} members</div></div>
    <div class="kpi"><div class="kpi-val">${slow}</div><div class="kpi-lbl">Slow Players</div><div class="kpi-sub">&gt;4h 40m average</div></div>
  </div>`;

  // Pace distribution cards
  const paceCards = `
  <div class="pace-grid">
    <div class="pace-card fast"><div class="pace-val">${fast}</div><div class="pace-lbl">Great (&lt;4h)</div></div>
    <div class="pace-card ok"><div class="pace-val">${ok}</div><div class="pace-lbl">On Pace (4h-4h20)</div></div>
    <div class="pace-card watch"><div class="pace-val">${watch}</div><div class="pace-lbl">Watch (4h20-4h40)</div></div>
    <div class="pace-card slow"><div class="pace-val">${slow}</div><div class="pace-lbl">Slow (&gt;4h40)</div></div>
  </div>`;

  // Gender comparison table
  const genderTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Gender</th><th>Count</th><th>Avg Pace</th><th>Fast</th><th>On Pace</th><th>Watch</th><th>Slow</th></tr></thead>
    <tbody>
      <tr><td class="l">Male</td><td class="r">${males.length}</td><td class="r bold">${males.length?fmtMins(maleAvg):'—'}</td>
        <td class="r green">${males.filter(m=>getPaceRating(m.avgMins)==='fast').length}</td>
        <td class="r">${males.filter(m=>getPaceRating(m.avgMins)==='ok').length}</td>
        <td class="r amber">${males.filter(m=>getPaceRating(m.avgMins)==='watch').length}</td>
        <td class="r red">${males.filter(m=>getPaceRating(m.avgMins)==='slow').length}</td></tr>
      <tr><td class="l">Female</td><td class="r">${females.length}</td><td class="r bold">${females.length?fmtMins(femaleAvg):'—'}</td>
        <td class="r green">${females.filter(m=>getPaceRating(m.avgMins)==='fast').length}</td>
        <td class="r">${females.filter(m=>getPaceRating(m.avgMins)==='ok').length}</td>
        <td class="r amber">${females.filter(m=>getPaceRating(m.avgMins)==='watch').length}</td>
        <td class="r red">${females.filter(m=>getPaceRating(m.avgMins)==='slow').length}</td></tr>
    </tbody>
  </table>`;

  // Top 10 slowest
  const slowest = [...all].sort((a,b) => b.avgMins - a.avgMins).slice(0,10);
  const slowRows = slowest.map((m,i) => {
    const ca = m.gender==='f'?CLUB_AVG_F:CLUB_AVG_M;
    const diff = m.avgMins - ca;
    return `<tr>
      <td style="text-align:center">${i+1}</td>
      <td class="l">${m.name}</td>
      <td class="r">${m.gender==='f'?'F':'M'}</td>
      <td class="r">${m.rounds}</td>
      <td class="r bold red">${fmtMins(m.avgMins)}</td>
      <td class="r red">+${Math.round(diff)}m</td>
    </tr>`;
  }).join('');
  const slowTable = `<table class="rpt-table half">
    <thead><tr><th>#</th><th style="text-align:left">Name</th><th>Gender</th><th>Rounds</th><th>Avg Pace</th><th>vs Avg</th></tr></thead>
    <tbody>${slowRows}</tbody>
  </table>`;

  // Top 10 fastest
  const fastest = [...all].sort((a,b) => a.avgMins - b.avgMins).slice(0,10);
  const fastRows = fastest.map((m,i) => {
    const ca = m.gender==='f'?CLUB_AVG_F:CLUB_AVG_M;
    const diff = m.avgMins - ca;
    return `<tr>
      <td style="text-align:center">${i+1}</td>
      <td class="l">${m.name}</td>
      <td class="r">${m.gender==='f'?'F':'M'}</td>
      <td class="r">${m.rounds}</td>
      <td class="r bold green">${fmtMins(m.avgMins)}</td>
      <td class="r green">${Math.round(diff)}m</td>
    </tr>`;
  }).join('');
  const fastTable = `<table class="rpt-table half">
    <thead><tr><th>#</th><th style="text-align:left">Name</th><th>Gender</th><th>Rounds</th><th>Avg Pace</th><th>vs Avg</th></tr></thead>
    <tbody>${fastRows}</tbody>
  </table>`;

  // Full member table (first 50)
  const sorted = [...all].sort((a,b) => b.avgMins - a.avgMins);
  const memRows = sorted.slice(0,50).map(m => {
    const ca = m.gender==='f'?CLUB_AVG_F:CLUB_AVG_M;
    const diff = m.avgMins - ca;
    const rating = getPaceRating(m.avgMins);
    const cls = rating==='slow'?'red':rating==='watch'?'amber':rating==='fast'?'green':'';
    return `<tr>
      <td class="l">${m.name}</td>
      <td class="r">${m.gender==='f'?'F':'M'}</td>
      <td class="r dim">${m.tenure_bucket||'—'}</td>
      <td class="r dim">${m.age_group||'—'}</td>
      <td class="r">${m.rounds}</td>
      <td class="r bold">${fmtMins(m.avgMins)}</td>
      <td class="r ${cls}">${(diff>=0?'+':'')+Math.round(diff)}m</td>
      <td class="r ${cls}">${rpt_paceLabel(rating)}</td>
    </tr>`;
  }).join('');
  const memTable = `<table class="rpt-table">
    <thead><tr><th style="text-align:left">Name</th><th>Gender</th><th>Tenure</th><th>Age</th><th>Rounds</th><th>Avg Pace</th><th>vs Avg</th><th>Rating</th></tr></thead>
    <tbody>${memRows}</tbody>
  </table>`;

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><title>VGC Pace of Play Report</title>
  <style>${RPT_CSS}</style>
  </head><body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="rpt-header">
    <div class="rpt-title">
      <h1>The Victoria Golf Club</h1>
      <h2>Pace of Play Report</h2>
    </div>
    <div class="rpt-meta">
      <div>Members: <strong>${all.length} tracked</strong></div>
      <div>Filters: <strong>${rpt_filterDesc()}</strong></div>
      <div>Generated: <strong>${dateStr}</strong></div>
    </div>
  </div>
  ${kpis}
  <div class="rpt-section">
    <div class="rpt-section-title">Pace Distribution</div>
    ${paceCards}
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Gender Comparison</div>
    ${genderTable}
  </div>
  <div class="two-col">
    <div class="rpt-section">
      <div class="rpt-section-title">Top 10 Slowest</div>
      ${slowTable}
    </div>
    <div class="rpt-section">
      <div class="rpt-section-title">Top 10 Fastest</div>
      ${fastTable}
    </div>
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">All Members (Top 50 by Pace)</div>
    ${memTable}
  </div>
  <div class="rpt-footer">
    <span>The Victoria Golf Club — Golf Operations</span>
    <span>Pace of Play Report — Generated ${dateStr}</span>
  </div>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// ── Report Modal ────────────────────────────────────────────────────────────

function openReportModal(){
  const existing = document.getElementById('rpt-modal');
  if(existing) existing.remove();

  const list = rpt_getFiltered();

  const modal = document.createElement('div');
  modal.id = 'rpt-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.25)">
      <h3 style="font-size:14px;font-weight:700;color:#2b335c;margin-bottom:4px">Generate Report</h3>
      <p style="font-size:11px;color:#898b8d;margin-bottom:16px">${list.length} members | ${rpt_filterDesc()}</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="generatePaceReport()" style="padding:10px;border:none;border-radius:4px;background:#2b335c;color:#fff;font-weight:700;cursor:pointer;font-size:12px">Print Report</button>
        <button onclick="downloadPaceCSV()" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Download CSV</button>
      </div>
      <button onclick="document.getElementById('rpt-modal').remove()" style="width:100%;margin-top:12px;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#898b8d">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}
