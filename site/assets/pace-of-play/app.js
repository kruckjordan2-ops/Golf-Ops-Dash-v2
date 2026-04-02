// VGC Pace of Play — App Logic
// Auto-extracted from index.html — do not add inline scripts to index.html

// ── DATA (embedded from VGC round times report) ───────────────────
const CLUB_AVG_M = 256;
const CLUB_AVG_F = 261;

// Format benchmarks (app avg in minutes, all files, outliers <5h30 removed)
const FORMAT_BENCHMARKS = {
  stableford: { m: 256, f: 255, n: 248 },
  par:        { m: 237, f: 271, n: 128 },
  stroke:     { m: 262, f: 296, n: 62  },
  ambrose:    { m: 256, f: 254, n: 125 },
};

// ── PACE DATA (loaded from pace_data.js, cross-referenced with member DB) ──

// Cross-reference pace data with member database
// Only keep verified VGC members (filter guests)
function buildMemberList() {
  const paceData = typeof PACE_DATA !== 'undefined' ? PACE_DATA : [];
  const memberDB = (typeof MEMBER_LOOKUP_DATA !== 'undefined' && MEMBER_LOOKUP_DATA.members) ? MEMBER_LOOKUP_DATA.members : [];

  // Build lookup map from member DB by full name
  const memberMap = {};
  memberDB.forEach(m => {
    const key = (m.first + ' ' + m.last).toLowerCase().trim();
    memberMap[key] = m;
  });

  // Match pace data against member DB
  const matched = [];
  const unmatched = [];
  paceData.forEach(p => {
    const key = p.name.toLowerCase().trim();
    const dbRecord = memberMap[key];
    if (dbRecord) {
      matched.push({
        ...p,
        gender: dbRecord.gender === 'Female' ? 'f' : 'm', // use DB gender (more accurate)
        tenure_bucket: dbRecord.tenure_bucket || '',
        age_group: dbRecord.age_group || '',
        join_year: dbRecord.join_year || null,
        email: dbRecord.email || '',
        isVerifiedMember: true,
      });
    } else {
      unmatched.push(p.name);
    }
  });

  console.log('Pace of Play: ' + matched.length + ' verified members, ' + unmatched.length + ' guests/unmatched filtered out');
  return matched;
}

const MEMBERS = buildMemberList();

// ── HELPERS ───────────────────────────────────────────────────────
function fmtMins(m) {
  return `${Math.floor(m/60)}h ${Math.round(m%60).toString().padStart(2,'0')}m`;
}

function getPaceRating(mins) {
  if (mins < 240) return 'fast';
  if (mins < 260) return 'ok';
  if (mins < 280) return 'watch';
  return 'slow';
}

function getPaceLabel(rating) {
  return { fast:'⚡ Great', ok:'✅ On Pace', watch:'👀 Watch', slow:'🐢 Slow' }[rating];
}

function getClubAvg(gender) {
  return gender === 'f' ? CLUB_AVG_F : CLUB_AVG_M;
}

// ── SORTING ───────────────────────────────────────────────────────
let sortCol = 'avgMins';
let sortDir = 1;

function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = 1; }
  document.querySelectorAll('.tbl th').forEach(th => {
    th.classList.remove('asc','desc');
    if (th.textContent.toLowerCase().includes(col.toLowerCase())) {
      th.classList.add(sortDir === 1 ? 'asc' : 'desc');
    }
  });
  renderMembers();
}

// ── RENDER MEMBERS ────────────────────────────────────────────────
function renderMembers() {
  const search = document.getElementById('memberSearch').value.toLowerCase();
  const gender = document.getElementById('genderFilter').value;
  const pace = document.getElementById('paceFilter').value;
  const minR = parseInt(document.getElementById('minRounds').value);

  const tenure = document.getElementById('tenureFilter').value;
  const age = document.getElementById('ageFilter').value;
  let filtered = MEMBERS.filter(m => {
    if (m.rounds < minR) return false;
    if (gender && m.gender !== gender) return false;
    if (pace && getPaceRating(m.avgMins) !== pace) return false;
    if (search && !m.name.toLowerCase().includes(search)) return false;
    if (tenure && m.tenure_bucket !== tenure) return false;
    if (age && m.age_group !== age) return false;
    return true;
  });

  filtered.sort((a,b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') return sortDir * av.localeCompare(bv);
    return sortDir * (av - bv);
  });

  document.getElementById('resultCount').textContent = `${filtered.length} members`;

  // Update summary cards
  const all = MEMBERS.filter(m => m.rounds >= 1);
  document.getElementById('cTotal').textContent = MEMBERS.length;
  document.getElementById('cTotalSub').textContent = MEMBERS.reduce((s,m)=>s+m.rounds,0).toLocaleString() + ' total rounds';
  document.getElementById('cFast').textContent = all.filter(m=>getPaceRating(m.avgMins)==='fast').length;
  document.getElementById('cOk').textContent = all.filter(m=>getPaceRating(m.avgMins)==='ok').length;
  document.getElementById('cWatch').textContent = all.filter(m=>getPaceRating(m.avgMins)==='watch').length;
  document.getElementById('cSlow').textContent = all.filter(m=>getPaceRating(m.avgMins)==='slow').length;

  const tbody = document.getElementById('memberBody');
  tbody.innerHTML = filtered.map(m => {
    const rating = getPaceRating(m.avgMins);
    const clubAvg = getClubAvg(m.gender);
    const diff = m.avgMins - clubAvg;
    const diffStr = diff >= 0 ? `+${Math.round(diff)}m` : `${Math.round(diff)}m`;
    const diffColor = diff > 15 ? 'color:var(--red)' : diff > 0 ? 'color:var(--amber)' : 'color:var(--green)';
    const rowClass = rating === 'slow' ? 'slow' : rating === 'watch' ? 'watch' : '';

    // Sparkline from allTimes
    const times = m.allTimes || [m.avgMins];
    const maxT = Math.max(...times);
    const minT = Math.min(...times);
    const range = maxT - minT || 1;
    const spark = times.map((t,i) => {
      const h = Math.round(4 + ((t-minT)/range)*20);
      const cls = i === times.length-1 ? 'latest' : '';
      return `<div class="spark-bar ${cls}" style="height:${h}px" title="${fmtMins(t)}"></div>`;
    }).join('');

    // Round dots
    const dots = times.map(t => {
      const r = getPaceRating(t);
      const col = {fast:'var(--green)',ok:'var(--navy)',watch:'var(--amber)',slow:'var(--red)'}[r];
      return `<div class="rdot" style="background:${col}" title="${fmtMins(t)}"></div>`;
    }).join('');

    return `<tr class="${rowClass}">
      <td style="font-weight:600">${m.name}</td>
      <td><span class="gbadge ${m.gender}">${m.gender === 'f' ? '♀ F' : '♂ M'}</span></td>
      <td style="font-size:.68rem;color:var(--muted)">${m.tenure_bucket || '—'}</td>
      <td style="font-size:.68rem;color:var(--muted)">${m.age_group || '—'}</td>
      <td>
        <div style="font-weight:700">${m.rounds}</div>
        <div class="rdots" style="margin-top:3px">${dots}</div>
      </td>
      <td style="font-weight:700;font-size:.82rem">${fmtMins(m.avgMins)}</td>
      <td style="${diffColor};font-weight:700;font-size:.75rem">${diffStr} vs avg</td>
      <td><div class="spark">${spark}</div></td>
      <td><span class="pace ${rating}">${getPaceLabel(rating)}</span></td>
    </tr>`;
  }).join('');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">No members match your filters.</td></tr>';
  }
}

// ── OVERVIEW ──────────────────────────────────────────────────────
function buildOverview() {
  const all = MEMBERS.filter(m=>m.rounds>=1);
  const males = all.filter(m=>m.gender==='m');
  const females = all.filter(m=>m.gender==='f');

  const clubAvg = all.length ? all.reduce((s,m)=>s+m.avgMins,0)/all.length : 0;
  const maleAvg = males.length ? males.reduce((s,m)=>s+m.avgMins,0)/males.length : 0;
  const femaleAvg = females.length ? females.reduce((s,m)=>s+m.avgMins,0)/females.length : 0;

  const sorted = [...all].sort((a,b)=>b.avgMins-a.avgMins);
  const slowest = sorted[0];
  const fastest = sorted[sorted.length-1];

  document.getElementById('insClubAvg').textContent = fmtMins(clubAvg);
  document.getElementById('insMaleAvg').textContent = fmtMins(maleAvg);
  document.getElementById('insMaleN').textContent = `${males.length} members tracked`;
  document.getElementById('insFemaleAvg').textContent = fmtMins(femaleAvg);
  document.getElementById('insFemaleN').textContent = `${females.length} members tracked`;
  document.getElementById('insSlowest').textContent = slowest ? fmtMins(slowest.avgMins) : '—';
  document.getElementById('insSlowName').textContent = slowest ? slowest.name : '—';
  document.getElementById('insFastest').textContent = fastest ? fmtMins(fastest.avgMins) : '—';
  document.getElementById('insFastName').textContent = fastest ? fastest.name : '—';
  document.getElementById('insSlowCount').textContent = all.filter(m=>m.avgMins>=280).length;

  // Distribution chart
  const bins = [180,195,210,225,240,255,270,285,300,315,330];
  const labels = bins.map((b,i) => i<bins.length-1 ? `${Math.floor(b/60)}h${(b%60).toString().padStart(2,'0')}` : '5h30+');
  const counts = bins.map((b,i) => {
    const next = bins[i+1] || 999;
    return all.filter(m=>m.avgMins>=b && m.avgMins<next).length;
  });

  new Chart(document.getElementById('distChart'), {
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:'Members',
        data:counts,
        backgroundColor: bins.map(b => b<240?'rgba(26,122,62,.7)':b<260?'rgba(43,51,92,.7)':b<280?'rgba(184,99,10,.7)':'rgba(139,26,26,.7)'),
        borderRadius:2
      }]
    },
    options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#eee'}},x:{grid:{display:false}}}}
  });

  // Pace pie
  const ratings = ['fast','ok','watch','slow'];
  const rCounts = ratings.map(r=>all.filter(m=>getPaceRating(m.avgMins)===r).length);
  new Chart(document.getElementById('paceChart'), {
    type:'doughnut',
    data:{
      labels:['Great (<4h)','On Pace (4h–4h20)','Watch (4h20–4h40)','Slow (>4h40)'],
      datasets:[{data:rCounts,backgroundColor:['rgba(26,122,62,.8)','rgba(43,51,92,.8)','rgba(184,99,10,.8)','rgba(139,26,26,.8)'],borderWidth:0}]
    },
    options:{plugins:{legend:{position:'right',labels:{font:{size:11}}}}}
  });

  // Format benchmark chart
  const fmts = ['Stableford','Par','Stroke','Ambrose'];
  const mAvgs = [256,237,262,256];
  const fAvgs = [255,271,296,254];
  new Chart(document.getElementById('fmtChart'), {
    type:'bar',
    data:{
      labels:fmts,
      datasets:[
        {label:'Male avg',data:mAvgs,backgroundColor:'rgba(43,51,92,.8)',borderRadius:2},
        {label:'Female avg',data:fAvgs,backgroundColor:'rgba(137,139,141,.6)',borderRadius:2}
      ]
    },
    options:{
      plugins:{legend:{position:'top'}},
      scales:{
        y:{min:180,max:360,grid:{color:'#eee'},ticks:{callback:v=>`${Math.floor(v/60)}h${(v%60).toString().padStart(2,'0')}`}},
        x:{grid:{display:false}}
      }
    }
  });
}

// ── TABS ─────────────────────────────────────────────────────────
function switchTab(name, el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('panel-'+name).classList.add('active');
  if (name==='overview') buildOverview();
}

// ── INIT ─────────────────────────────────────────────────────────
const _totalRounds = MEMBERS.reduce((s,m)=>s+m.rounds,0);
document.getElementById('dataInfo').textContent = _totalRounds + ' rounds · ' + MEMBERS.length + ' verified members';
renderMembers();
