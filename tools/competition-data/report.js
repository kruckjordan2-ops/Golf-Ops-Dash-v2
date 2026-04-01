// ─────────────────────────────────────────────────────────────────────────────
//  VGC Competition Data — Report Generator
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
  .total-row{background:#eef0f5!important;font-weight:700}
  .total-row td{border-top:2px solid #2b335c;border-bottom:none}
  .eng-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
  .eng-card{background:#f5f6f9;border-radius:6px;padding:14px 16px;text-align:center;border-top:3px solid #2b335c}
  .eng-val{font-size:24px;font-weight:700;color:#2b335c}
  .eng-lbl{font-size:10px;color:#898b8d;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
  .print-btn{display:inline-flex;align-items:center;gap:6px;background:#2b335c;color:#fff;border:none;border-radius:4px;padding:8px 18px;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:20px;margin-right:8px}
  .print-btn:hover{background:#1e2540}
  .rpt-footer{margin-top:28px;padding-top:12px;border-top:1px solid #e4e5e6;font-size:9px;color:#898b8d;display:flex;justify-content:space-between}
`;

function rpt_fmtN(n){ return n==null?'—':Math.round(n).toLocaleString(); }
function rpt_fmtP(n){ return n==null?'—':(n*100).toFixed(1)+'%'; }

function rpt_filterDesc(){
  const parts = [];
  if(F.category!=='all') parts.push('Category: '+F.category);
  if(F.ageBracket!=='all') parts.push('Age: '+F.ageBracket);
  if(F.search) parts.push('Search: "'+F.search+'"');
  return parts.length ? parts.join(' | ') : 'All Members (no filters)';
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

function downloadCompCSV(type){
  const ts = new Date().toISOString().slice(0,10);
  const list = filtered();

  if(type==='members'){
    const headers = ['Name','Category','Age Bracket','Comp Rounds','Social Rounds','Total Rounds','Comp %'];
    const rows = list.map(m => [m.name, m.category, m.ageBracket||'', m.compRounds, m.socialRounds, m.totalRounds, m.totalRounds?(m.compRounds/m.totalRounds*100).toFixed(1)+'%':'0%']);
    rpt_downloadCSV('competition-members-'+ts+'.csv', headers, rows);
  }

  if(type==='category'){
    const catData = aggregateByField(list, 'category');
    const headers = ['Category','Members','Comp Rounds','Social Rounds','Total Rounds','Avg Comp','Avg Social','Comp %'];
    const rows = catData.map(c => [c.name, c.count, c.comp, c.social, c.total, c.avgComp, c.avgSocial, (c.compPct*100).toFixed(1)+'%']);
    rpt_downloadCSV('competition-category-'+ts+'.csv', headers, rows);
  }

  if(type==='age'){
    const ageData = aggregateByField(list, 'ageBracket', AGE_LABELS);
    const headers = ['Age Bracket','Members','Comp Rounds','Social Rounds','Total Rounds','Avg Comp','Avg Social','Comp %'];
    const rows = ageData.map(a => [a.name, a.count, a.comp, a.social, a.total, a.avgComp, a.avgSocial, (a.compPct*100).toFixed(1)+'%']);
    rpt_downloadCSV('competition-age-'+ts+'.csv', headers, rows);
  }

  document.getElementById('rpt-modal')?.remove();
}

// ── Print Report ────────────────────────────────────────────────────────────

function generateCompReport(){
  document.getElementById('rpt-modal')?.remove();

  const list = filtered();
  const s = filteredSummary();
  const catData = aggregateByField(list, 'category');
  const ageData = aggregateByField(list, 'ageBracket', AGE_LABELS);
  const dateStr = new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});

  // KPI strip
  const kpis = `
  <div class="kpi-strip">
    <div class="kpi"><div class="kpi-val">${rpt_fmtN(s.count)}</div><div class="kpi-lbl">Active Members</div><div class="kpi-sub">of ${rpt_fmtN(S.totalMembers)} total</div></div>
    <div class="kpi"><div class="kpi-val">${rpt_fmtN(s.comp)}</div><div class="kpi-lbl">Comp Rounds</div><div class="kpi-sub">${rpt_fmtP(s.compPct)} of total</div></div>
    <div class="kpi"><div class="kpi-val">${rpt_fmtN(s.social)}</div><div class="kpi-lbl">Social Rounds</div><div class="kpi-sub">${rpt_fmtP(1-s.compPct)} of total</div></div>
    <div class="kpi"><div class="kpi-val">${s.avgComp.toFixed(1)}</div><div class="kpi-lbl">Avg Comp / Player</div><div class="kpi-sub">per active comp player</div></div>
    <div class="kpi"><div class="kpi-val">${rpt_fmtN(s.total)}</div><div class="kpi-lbl">Total Rounds</div><div class="kpi-sub">${rpt_fmtN(s.count)} members</div></div>
  </div>`;

  // Engagement cards
  const engagement = `
  <div class="eng-grid">
    <div class="eng-card"><div class="eng-val">${rpt_fmtN(s.both)}</div><div class="eng-lbl">Both Comp & Social</div></div>
    <div class="eng-card"><div class="eng-val">${rpt_fmtN(s.compOnly)}</div><div class="eng-lbl">Comp Only</div></div>
    <div class="eng-card"><div class="eng-val">${rpt_fmtN(s.socialOnly)}</div><div class="eng-lbl">Social Only</div></div>
  </div>`;

  // Category table
  const catRows = catData.map(c => `<tr>
    <td class="l">${c.name}</td>
    <td class="r">${rpt_fmtN(c.count)}</td>
    <td class="r bold">${rpt_fmtN(c.comp)}</td>
    <td class="r">${rpt_fmtN(c.social)}</td>
    <td class="r">${rpt_fmtN(c.total)}</td>
    <td class="r">${c.avgComp.toFixed(1)}</td>
    <td class="r">${c.avgSocial.toFixed(1)}</td>
    <td class="r dim">${rpt_fmtP(c.compPct)}</td>
  </tr>`).join('');
  const catTable = `<table class="rpt-table">
    <thead><tr><th style="text-align:left">Category</th><th>Members</th><th>Comp</th><th>Social</th><th>Total</th><th>Avg Comp</th><th>Avg Social</th><th>Comp %</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>`;

  // Age bracket table
  const ageRows = ageData.map(a => `<tr>
    <td class="l">${a.name}</td>
    <td class="r">${rpt_fmtN(a.count)}</td>
    <td class="r bold">${rpt_fmtN(a.comp)}</td>
    <td class="r">${rpt_fmtN(a.social)}</td>
    <td class="r">${rpt_fmtN(a.total)}</td>
    <td class="r">${a.avgComp.toFixed(1)}</td>
    <td class="r">${a.avgSocial.toFixed(1)}</td>
    <td class="r dim">${rpt_fmtP(a.compPct)}</td>
  </tr>`).join('');
  const ageTable = `<table class="rpt-table">
    <thead><tr><th style="text-align:left">Age Bracket</th><th>Members</th><th>Comp</th><th>Social</th><th>Total</th><th>Avg Comp</th><th>Avg Social</th><th>Comp %</th></tr></thead>
    <tbody>${ageRows}</tbody>
  </table>`;

  // Top 20 comp players
  const top20 = [...list].sort((a,b) => b.compRounds - a.compRounds).slice(0,20);
  const topRows = top20.map((m,i) => `<tr>
    <td style="text-align:center">${i+1}</td>
    <td class="l">${m.name}</td>
    <td>${m.category}</td>
    <td class="r">${m.ageBracket||'—'}</td>
    <td class="r bold">${rpt_fmtN(m.compRounds)}</td>
    <td class="r">${rpt_fmtN(m.socialRounds)}</td>
    <td class="r">${rpt_fmtN(m.totalRounds)}</td>
    <td class="r dim">${rpt_fmtP(m.compPct)}</td>
  </tr>`).join('');
  const topTable = `<table class="rpt-table">
    <thead><tr><th>#</th><th style="text-align:left">Name</th><th>Category</th><th>Age</th><th>Comp</th><th>Social</th><th>Total</th><th>Comp %</th></tr></thead>
    <tbody>${topRows}</tbody>
  </table>`;

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><title>VGC Competition Data Report</title>
  <style>${RPT_CSS}</style>
  </head><body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="rpt-header">
    <div class="rpt-title">
      <h1>The Victoria Golf Club</h1>
      <h2>Competition Data Report</h2>
    </div>
    <div class="rpt-meta">
      <div>Period: <strong>${D.meta.period}</strong></div>
      <div>Filters: <strong>${rpt_filterDesc()}</strong></div>
      <div>Generated: <strong>${dateStr}</strong></div>
    </div>
  </div>
  ${kpis}
  <div class="rpt-section">
    <div class="rpt-section-title">Member Engagement</div>
    ${engagement}
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Rounds by Category</div>
    ${catTable}
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Rounds by Age Bracket</div>
    ${ageTable}
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Top 20 Competition Players</div>
    ${topTable}
  </div>
  <div class="rpt-footer">
    <span>The Victoria Golf Club — Golf Operations</span>
    <span>Competition Data Report — Generated ${dateStr}</span>
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

  const modal = document.createElement('div');
  modal.id = 'rpt-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:8px;padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.25)">
      <h3 style="font-size:14px;font-weight:700;color:#2b335c;margin-bottom:4px">Generate Report</h3>
      <p style="font-size:11px;color:#898b8d;margin-bottom:16px">Filters: ${rpt_filterDesc()}</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="generateCompReport()" style="padding:10px;border:none;border-radius:4px;background:#2b335c;color:#fff;font-weight:700;cursor:pointer;font-size:12px">Print Report</button>
        <div style="font-size:10px;font-weight:700;color:#898b8d;text-transform:uppercase;letter-spacing:.5px;margin-top:4px">Download CSV</div>
        <button onclick="downloadCompCSV('members')" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Full member list</button>
        <button onclick="downloadCompCSV('category')" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Category summary</button>
        <button onclick="downloadCompCSV('age')" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Age bracket summary</button>
      </div>
      <button onclick="document.getElementById('rpt-modal').remove()" style="width:100%;margin-top:12px;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#898b8d">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}
