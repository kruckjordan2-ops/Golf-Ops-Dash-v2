// ─────────────────────────────────────────────────────────────────────────────
//  VGC Member Lookup — Report Generator
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
  .kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
  .kpi{background:#f5f6f9;border-radius:6px;padding:12px 16px;border-left:3px solid #2b335c}
  .kpi-val{font-size:22px;font-weight:700;color:#2b335c}
  .kpi-lbl{font-size:10px;color:#898b8d;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
  .kpi-sub{font-size:10px;color:#5a585c;margin-top:4px}
  .rpt-section{margin-bottom:28px}
  .rpt-section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#fff;background:#2b335c;padding:5px 10px;margin-bottom:10px;border-radius:3px}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .three-col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px}
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
  .print-btn{display:inline-flex;align-items:center;gap:6px;background:#2b335c;color:#fff;border:none;border-radius:4px;padding:8px 18px;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:20px;margin-right:8px}
  .print-btn:hover{background:#1e2540}
  .rpt-footer{margin-top:28px;padding-top:12px;border-top:1px solid #e4e5e6;font-size:9px;color:#898b8d;display:flex;justify-content:space-between}
`;

function rpt_filterDesc(){
  const parts = [];
  const g = document.getElementById('fGender').value;
  const a = document.getElementById('fAge').value;
  const t = document.getElementById('fTenure').value;
  const d = document.getElementById('fDriver').value;
  const q = document.getElementById('searchInput').value;
  if(q) parts.push('Search: "'+q+'"');
  if(g) parts.push('Gender: '+g);
  if(a) parts.push('Age: '+a);
  if(t) parts.push('Tenure: '+t);
  if(d) parts.push('Driver: '+d);
  return parts.length ? parts.join(' | ') : 'All Members (no filters)';
}

function rpt_countBy(list, field){
  const counts = {};
  list.forEach(m => {
    const k = m[field] || 'Unknown';
    counts[k] = (counts[k]||0) + 1;
  });
  return Object.entries(counts).sort((a,b) => b[1]-a[1]);
}

function rpt_topBrands(list, field, limit){
  const counts = {};
  list.forEach(m => {
    const v = val(m[field]);
    if(v) counts[v] = (counts[v]||0) + 1;
  });
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, limit||10);
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

function downloadMemberCSV(){
  const ts = new Date().toISOString().slice(0,10);
  const headers = ['First Name','Last Name','Gender','Age','Age Group','Membership Type','Member Code',
    'Join Date','Join Year','Tenure','Tenure Bucket','Handicap','City','Email','Phone',
    'Driver','Irons','Woods','Wedges','Putter','Ball','Apparel Size','Shoe Size'];
  const rows = filtered.map(m => [
    m.first, m.last, m.gender||'', m.age||'', m.age_group||'', m.membership_type||'', m.member_code||'',
    m.join_date||'', m.join_year||'', m.tenure||'', m.tenure_bucket||'', m.handicap!=null?m.handicap:'',
    m.city||'', m.email||'', m.phone||'',
    m.driver||'', m.irons||'', m.woods||'', m.wedges||'', m.putter||'', m.ball||'',
    m.apparel_size||'', m.shoe_size||''
  ]);
  rpt_downloadCSV('member-lookup-'+ts+'.csv', headers, rows);
  document.getElementById('rpt-modal')?.remove();
}

// ── Print Report ────────────────────────────────────────────────────────────

function generateMemberReport(){
  document.getElementById('rpt-modal')?.remove();

  const list = filtered;
  const dateStr = new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});

  const males = list.filter(m => m.gender==='Male').length;
  const females = list.filter(m => m.gender==='Female').length;
  const avgAge = list.filter(m=>m.age).length ? (list.reduce((s,m)=>s+(m.age||0),0)/list.filter(m=>m.age).length).toFixed(1) : '—';
  const avgTenure = list.filter(m=>m.tenure).length ? (list.reduce((s,m)=>s+(m.tenure||0),0)/list.filter(m=>m.tenure).length).toFixed(1) : '—';

  // KPI strip
  const kpis = `
  <div class="kpi-strip">
    <div class="kpi"><div class="kpi-val">${list.length.toLocaleString()}</div><div class="kpi-lbl">Total Members</div><div class="kpi-sub">Matching current filters</div></div>
    <div class="kpi"><div class="kpi-val">${males} / ${females}</div><div class="kpi-lbl">Male / Female</div><div class="kpi-sub">${list.length?(males/list.length*100).toFixed(0)+'% / '+(females/list.length*100).toFixed(0)+'%':''}</div></div>
    <div class="kpi"><div class="kpi-val">${avgAge}</div><div class="kpi-lbl">Avg Age (years)</div><div class="kpi-sub">${list.filter(m=>m.age).length} with age data</div></div>
    <div class="kpi"><div class="kpi-val">${avgTenure}</div><div class="kpi-lbl">Avg Tenure (years)</div><div class="kpi-sub">${list.filter(m=>m.tenure).length} with tenure data</div></div>
  </div>`;

  // Membership type breakdown
  const typeData = rpt_countBy(list, 'membership_type');
  const typeRows = typeData.map(([k,v]) => `<tr><td class="l">${k}</td><td class="r bold">${v}</td><td class="r dim">${(v/list.length*100).toFixed(1)}%</td></tr>`).join('');
  const typeTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Membership Type</th><th>Count</th><th>%</th></tr></thead>
    <tbody>${typeRows}</tbody>
  </table>`;

  // Age group distribution
  const ageData = rpt_countBy(list, 'age_group');
  const ageRows = ageData.map(([k,v]) => `<tr><td class="l">${k}</td><td class="r bold">${v}</td><td class="r dim">${(v/list.length*100).toFixed(1)}%</td></tr>`).join('');
  const ageTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Age Group</th><th>Count</th><th>%</th></tr></thead>
    <tbody>${ageRows}</tbody>
  </table>`;

  // Tenure distribution
  const tenureData = rpt_countBy(list, 'tenure_bucket');
  const tenureRows = tenureData.map(([k,v]) => `<tr><td class="l">${k}</td><td class="r bold">${v}</td><td class="r dim">${(v/list.length*100).toFixed(1)}%</td></tr>`).join('');
  const tenureTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Tenure Bucket</th><th>Count</th><th>%</th></tr></thead>
    <tbody>${tenureRows}</tbody>
  </table>`;

  // Gender breakdown
  const genderData = rpt_countBy(list, 'gender');
  const genderRows = genderData.map(([k,v]) => `<tr><td class="l">${k}</td><td class="r bold">${v}</td><td class="r dim">${(v/list.length*100).toFixed(1)}%</td></tr>`).join('');
  const genderTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Gender</th><th>Count</th><th>%</th></tr></thead>
    <tbody>${genderRows}</tbody>
  </table>`;

  // Equipment preferences
  function brandTable(title, field){
    const brands = rpt_topBrands(list, field, 8);
    if(!brands.length) return '';
    const total = brands.reduce((s,b)=>s+b[1],0);
    const rows = brands.map(([k,v]) => `<tr><td class="l">${k}</td><td class="r bold">${v}</td><td class="r dim">${(v/total*100).toFixed(0)}%</td></tr>`).join('');
    return `<div><div style="font-size:10px;font-weight:700;color:#2b335c;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">${title}</div>
    <table class="rpt-table half"><thead><tr><th style="text-align:left">Brand</th><th>Count</th><th>Share</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  const equipSection = `<div class="three-col">
    ${brandTable('Drivers','driver')}
    ${brandTable('Irons','irons')}
    ${brandTable('Golf Balls','ball')}
  </div>`;

  // Member list (first 50)
  const memRows = list.slice(0,50).map(m => `<tr>
    <td class="l">${m.first} ${m.last}</td>
    <td class="r">${m.gender||'—'}</td>
    <td class="r">${m.age||'—'}</td>
    <td>${m.membership_type||'—'}</td>
    <td class="r">${m.tenure||'—'}</td>
    <td class="r">${m.handicap!=null?m.handicap:'—'}</td>
    <td class="dim">${m.city||'—'}</td>
  </tr>`).join('');
  const memTable = `<table class="rpt-table">
    <thead><tr><th style="text-align:left">Name</th><th>Gender</th><th>Age</th><th>Type</th><th>Tenure</th><th>Hcp</th><th>City</th></tr></thead>
    <tbody>${memRows}</tbody>
  </table>`;

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><title>VGC Member Lookup Report</title>
  <style>${RPT_CSS}</style>
  </head><body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="rpt-header">
    <div class="rpt-title">
      <h1>The Victoria Golf Club</h1>
      <h2>Member Lookup Report</h2>
    </div>
    <div class="rpt-meta">
      <div>Members: <strong>${list.length.toLocaleString()} of ${members.length.toLocaleString()}</strong></div>
      <div>Filters: <strong>${rpt_filterDesc()}</strong></div>
      <div>Generated: <strong>${dateStr}</strong></div>
    </div>
  </div>
  ${kpis}
  <div class="two-col">
    <div class="rpt-section">
      <div class="rpt-section-title">Membership Type</div>
      ${typeTable}
    </div>
    <div class="rpt-section">
      <div class="rpt-section-title">Gender Breakdown</div>
      ${genderTable}
    </div>
  </div>
  <div class="two-col">
    <div class="rpt-section">
      <div class="rpt-section-title">Age Group Distribution</div>
      ${ageTable}
    </div>
    <div class="rpt-section">
      <div class="rpt-section-title">Tenure Distribution</div>
      ${tenureTable}
    </div>
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Equipment Preferences</div>
    ${equipSection}
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Member List${list.length>50?' (First 50)':''}</div>
    ${memTable}
  </div>
  <div class="rpt-footer">
    <span>The Victoria Golf Club — Golf Operations</span>
    <span>Member Lookup Report — Generated ${dateStr}</span>
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
      <p style="font-size:11px;color:#898b8d;margin-bottom:16px">${filtered.length} members | ${rpt_filterDesc()}</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="generateMemberReport()" style="padding:10px;border:none;border-radius:4px;background:#2b335c;color:#fff;font-weight:700;cursor:pointer;font-size:12px">Print Report</button>
        <button onclick="downloadMemberCSV()" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Download CSV (all fields)</button>
      </div>
      <button onclick="document.getElementById('rpt-modal').remove()" style="width:100%;margin-top:12px;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#898b8d">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}
