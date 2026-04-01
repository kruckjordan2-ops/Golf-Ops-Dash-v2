// ─────────────────────────────────────────────────────────────────────────────
//  VGC Booking Analysis — Report Generator
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

function rpt_fmtN(n){ return n==null?'—':Math.round(n).toLocaleString(); }
function rpt_fmtP(n){ return n==null?'—':(n*100).toFixed(1)+'%'; }

function rpt_filterDesc(){
  const parts = [];
  if(F.month!=='all')  parts.push('Month: '+F.month);
  if(F.comp!=='all')   parts.push('Type: '+(F.comp==='comp'?'Competition':'Social'));
  if(F.player!=='all') parts.push(F.player==='members'?'Members Only':'Visitors Only');
  if(F.gender!=='all') parts.push('Gender: '+F.gender);
  return parts.length ? parts.join(' | ') : 'All Data (no filters)';
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

function downloadBookingCSV(type){
  const ts = new Date().toISOString().slice(0,10);

  if(type==='members'){
    let members = [...D.top_members];
    if(F.gender==='Male')   members = members.filter(m=>m.gender==='Male');
    if(F.gender==='Female') members = members.filter(m=>m.gender==='Female');
    if(F.comp==='comp')   members = members.map(m=>({...m,total:m.comp,social:0}));
    if(F.comp==='social') members = members.map(m=>({...m,total:m.social,comp:0}));
    const headers = ['Name','Category','Gender','Total','Competition','Social','Checked In','No Shows'];
    const rows = members.map(m => [m.name, m.category, m.gender||'', m.total, m.comp, m.social, m.checked_in, m.total-m.checked_in]);
    rpt_downloadCSV('booking-members-'+ts+'.csv', headers, rows);
  }

  if(type==='category'){
    const cats = catData();
    const headers = ['Category','Total','Competition','Social','Checked In'];
    const rows = cats.map(c => [c.name, c.total, c.comp, c.social, c.checked_in||'']);
    rpt_downloadCSV('booking-category-'+ts+'.csv', headers, rows);
  }

  if(type==='dow'){
    const headers = ['Day','Total','Competition','Social','Checked In'];
    const rows = DOW.map(d => {
      const v = dowData(d);
      return [d, cv(v), v.comp||0, v.social||0, v.checked_in||0];
    });
    rpt_downloadCSV('booking-day-of-week-'+ts+'.csv', headers, rows);
  }

  if(type==='hourly'){
    const headers = ['Hour','Total','Competition','Social'];
    const rows = HOURS.map((h,i) => {
      const v = hourData(h);
      return [HOUR_L[i], cv(v), v.comp||0, v.social||0];
    });
    rpt_downloadCSV('booking-hourly-'+ts+'.csv', headers, rows);
  }

  document.getElementById('rpt-modal')?.remove();
}

// ── Print Report ────────────────────────────────────────────────────────────

function generateBookingReport(){
  document.getElementById('rpt-modal')?.remove();

  const k = kpiTotals();
  const ci_rate = k.checked_in!=null && k.total ? k.checked_in/k.total : null;
  const cats = catData();
  const gd = genderData();
  const dateStr = new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});

  // KPI strip
  const kpis = `
  <div class="kpi-strip">
    <div class="kpi"><div class="kpi-val">${rpt_fmtN(k.total)}</div><div class="kpi-lbl">Total Bookings</div><div class="kpi-sub">${D.meta.date_range}</div></div>
    <div class="kpi"><div class="kpi-val">${ci_rate!=null?rpt_fmtP(ci_rate):'—'}</div><div class="kpi-lbl">Check-in Rate</div><div class="kpi-sub">${ci_rate!=null?rpt_fmtN(k.checked_in)+' checked in':'Filtered'}</div></div>
    <div class="kpi"><div class="kpi-val">${rpt_fmtN(k.comp)}</div><div class="kpi-lbl">Competition</div><div class="kpi-sub">${k.total?rpt_fmtP(k.comp/k.total)+' of total':''}</div></div>
    <div class="kpi"><div class="kpi-val">${rpt_fmtN(k.social)}</div><div class="kpi-lbl">Social</div><div class="kpi-sub">${k.total?rpt_fmtP(k.social/k.total)+' of total':''}</div></div>
  </div>`;

  // Category table
  const catRows = cats.map(c => `<tr>
    <td class="l">${c.name}</td>
    <td class="r bold">${rpt_fmtN(c.total)}</td>
    <td class="r">${rpt_fmtN(c.comp)}</td>
    <td class="r">${rpt_fmtN(c.social)}</td>
    <td class="r dim">${c.checked_in!=null?rpt_fmtN(c.checked_in):'—'}</td>
    <td class="r dim">${c.total?rpt_fmtP(c.total/k.total):'—'}</td>
  </tr>`).join('');
  const catTable = `<table class="rpt-table">
    <thead><tr><th style="text-align:left">Category</th><th>Total</th><th>Comp</th><th>Social</th><th>Checked In</th><th>% of Total</th></tr></thead>
    <tbody>${catRows}</tbody>
  </table>`;

  // DOW table
  const dowRows = DOW.map(d => {
    const v = dowData(d);
    return `<tr>
      <td class="l">${d}</td>
      <td class="r bold">${rpt_fmtN(cv(v))}</td>
      <td class="r">${rpt_fmtN(v.comp||0)}</td>
      <td class="r">${rpt_fmtN(v.social||0)}</td>
      <td class="r dim">${v.checked_in!=null&&v.total?rpt_fmtP(v.checked_in/v.total):'—'}</td>
    </tr>`;
  }).join('');
  const dowTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Day</th><th>Total</th><th>Comp</th><th>Social</th><th>Check-in %</th></tr></thead>
    <tbody>${dowRows}</tbody>
  </table>`;

  // Hourly table
  const hourRows = HOURS.map((h,i) => {
    const v = hourData(h);
    const t = cv(v);
    if(!t) return '';
    return `<tr>
      <td class="l">${HOUR_L[i]}</td>
      <td class="r bold">${rpt_fmtN(t)}</td>
      <td class="r">${rpt_fmtN(v.comp||0)}</td>
      <td class="r">${rpt_fmtN(v.social||0)}</td>
    </tr>`;
  }).join('');
  const hourTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Hour</th><th>Total</th><th>Comp</th><th>Social</th></tr></thead>
    <tbody>${hourRows}</tbody>
  </table>`;

  // Gender breakdown
  const genderRows = gd.map(g => `<tr>
    <td class="l">${g.name}</td>
    <td class="r bold">${rpt_fmtN(g.total)}</td>
    <td class="r dim">${k.total?rpt_fmtP(g.total/k.total):'—'}</td>
  </tr>`).join('');
  const genderTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Gender</th><th>Bookings</th><th>% of Total</th></tr></thead>
    <tbody>${genderRows}</tbody>
  </table>`;

  // Top members table
  let members = [...D.top_members];
  if(F.gender==='Male')   members = members.filter(m=>m.gender==='Male');
  if(F.gender==='Female') members = members.filter(m=>m.gender==='Female');
  if(F.comp==='comp')   members = members.map(m=>({...m,total:m.comp,social:0}));
  if(F.comp==='social') members = members.map(m=>({...m,total:m.social,comp:0}));
  members.sort((a,b)=>b.total-a.total);
  const memRows = members.slice(0,30).map((m,i) => `<tr>
    <td style="text-align:center">${i+1}</td>
    <td class="l">${m.name}</td>
    <td>${m.category}</td>
    <td class="r bold">${rpt_fmtN(m.total)}</td>
    <td class="r">${rpt_fmtN(m.comp)}</td>
    <td class="r">${rpt_fmtN(m.social)}</td>
    <td class="r dim">${rpt_fmtN(m.checked_in)}</td>
  </tr>`).join('');
  const memTable = `<table class="rpt-table">
    <thead><tr><th>#</th><th style="text-align:left">Name</th><th>Category</th><th>Total</th><th>Comp</th><th>Social</th><th>Checked In</th></tr></thead>
    <tbody>${memRows}</tbody>
  </table>`;

  // Home clubs
  const clubs = D.home_clubs.slice(0,15);
  const maxClub = clubs[0]?.count||1;
  const clubRows = clubs.map(c => `<tr>
    <td class="l">${c.name}</td>
    <td class="r bold">${rpt_fmtN(c.count)}</td>
    <td class="r dim">${k.visitors?rpt_fmtP(c.count/(k.visitors||k.total)):'—'}</td>
  </tr>`).join('');
  const clubTable = `<table class="rpt-table half">
    <thead><tr><th style="text-align:left">Home Club</th><th>Bookings</th><th>% Share</th></tr></thead>
    <tbody>${clubRows}</tbody>
  </table>`;

  const html = `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><title>VGC Booking Analysis Report</title>
  <style>${RPT_CSS}</style>
  </head><body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="rpt-header">
    <div class="rpt-title">
      <h1>The Victoria Golf Club</h1>
      <h2>Booking Analysis Report</h2>
    </div>
    <div class="rpt-meta">
      <div>Period: <strong>${D.meta.date_range}</strong></div>
      <div>Filters: <strong>${rpt_filterDesc()}</strong></div>
      <div>Generated: <strong>${dateStr}</strong></div>
    </div>
  </div>
  ${kpis}
  <div class="rpt-section">
    <div class="rpt-section-title">Bookings by Member Category</div>
    ${catTable}
  </div>
  <div class="two-col">
    <div class="rpt-section">
      <div class="rpt-section-title">Day of Week</div>
      ${dowTable}
    </div>
    <div class="rpt-section">
      <div class="rpt-section-title">Gender Breakdown</div>
      ${genderTable}
    </div>
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Hourly Distribution</div>
    ${hourTable}
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Top Members by Bookings</div>
    ${memTable}
  </div>
  <div class="rpt-section">
    <div class="rpt-section-title">Top Visiting Clubs</div>
    ${clubTable}
  </div>
  <div class="rpt-footer">
    <span>The Victoria Golf Club — Golf Operations</span>
    <span>Booking Analysis Report — Generated ${dateStr}</span>
  </div>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Popup blocked — please allow popups for this site.'); return; }
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
        <button onclick="generateBookingReport()" style="padding:10px;border:none;border-radius:4px;background:#2b335c;color:#fff;font-weight:700;cursor:pointer;font-size:12px">Print Report</button>
        <div style="font-size:10px;font-weight:700;color:#898b8d;text-transform:uppercase;letter-spacing:.5px;margin-top:4px">Download CSV</div>
        <button onclick="downloadBookingCSV('members')" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Members list</button>
        <button onclick="downloadBookingCSV('category')" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Category summary</button>
        <button onclick="downloadBookingCSV('dow')" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Day of week summary</button>
        <button onclick="downloadBookingCSV('hourly')" style="padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;text-align:left">Hourly distribution</button>
      </div>
      <button onclick="document.getElementById('rpt-modal').remove()" style="width:100%;margin-top:12px;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#898b8d">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}
