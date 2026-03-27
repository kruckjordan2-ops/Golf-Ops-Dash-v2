const DATA = window.MEMBER_LOOKUP_DATA || [];


const members = DATA.members;
let filtered = [...members];
let activeId = null;

function ini(m){return((m.first||'?')[0]+(m.last||'?')[0]).toUpperCase();}
function val(v,fb){if(!v||v==='nan'||v===''||v==='None'||v==='null')return fb||null;return v;}
function tenPct(t){return Math.min(100,Math.round((t||0)/80*100));}

function doSearch(){
  const q=document.getElementById('searchInput').value.toLowerCase().trim();
  const g=document.getElementById('fGender').value;
  const a=document.getElementById('fAge').value;
  const t=document.getElementById('fTenure').value;
  const d=document.getElementById('fDriver').value;
  filtered=members.filter(m=>{
    if(q&&!((m.first+' '+m.last).toLowerCase().includes(q))&&!(m.email||'').toLowerCase().includes(q))return false;
    if(g&&m.gender!==g)return false;
    if(a&&m.age_group!==a)return false;
    if(t&&m.tenure_bucket!==t)return false;
    if(d&&(m.driver||'')!==d)return false;
    return true;
  });
  document.getElementById('rCount').textContent=filtered.length+' of '+members.length;
  renderList();
}

function renderList(){
  const ul=document.getElementById('mList');
  if(!filtered.length){ul.innerHTML='<div class="no-results">No members match your filters.</div>';return;}
  const show=filtered.slice(0,200);
  ul.innerHTML=show.map(m=>`<div class="member-item${m.id===activeId?' active':''}" onclick="showMember('${m.id}')">
    <div class="av${m.gender==='Female'?' f':''}">${ini(m)}</div>
    <div style="min-width:0">
      <div class="mn">${m.first} ${m.last}</div>
      <div class="mm">${m.age?m.age+'yr · ':''}${m.tenure?m.tenure+'yr member':''}${!m.age&&!m.tenure?(m.email||''):''}
      </div>
    </div></div>`).join('');
  if(filtered.length>200) ul.innerHTML+=`<div class="no-results" style="font-style:italic">Showing 200 of ${filtered.length} — refine search</div>`;
}

function showMember(id){
  activeId=id;
  const m=members.find(x=>x.id===id);
  if(!m)return;
  document.querySelectorAll('.member-item').forEach(el=>{
    const nm=el.querySelector('.mn');
    el.classList.toggle('active',nm&&nm.textContent===m.first+' '+m.last);
  });
  const hasEq=val(m.driver)||val(m.irons)||val(m.wedges)||val(m.putter)||val(m.woods)||val(m.ball);
  const hasSz=val(m.apparel_size)||val(m.shoe_size);
  document.getElementById('mainPanel').innerHTML=`
<div class="mc-header">
  <div class="mc-avatar${m.gender==='Female'?' f':''}">${ini(m)}</div>
  <div>
    <div class="mc-name">${val(m.suffix)?val(m.suffix)+' ':''}${m.first} ${m.last}</div>
    <div class="mc-sub">${val(m.email)?'<a href="mailto:'+m.email+'">'+m.email+'</a>':'No email on file'}</div>
    <div class="mc-badges">
      <span class="badge ${m.gender==='Female'?'bf':'bm'}">${m.gender||'Unknown'}</span>
      ${m.age?'<span class="badge bt">Age '+m.age+'</span>':''}
      ${m.tenure?'<span class="badge bt">'+m.tenure+'yr member</span>':''}
    </div>
  </div>
</div>
<div class="mc-grid">
  <div class="mc-section">
    <div class="sct">Contact</div>
    <div class="fr"><span class="fl">Email</span><span class="fv">${val(m.email)?'<a href="mailto:'+m.email+'">'+m.email+'</a>':'<span class=em>Not on file</span>'}</span></div>
    <div class="fr"><span class="fl">Phone</span><span class="fv${!val(m.phone)?' em':''}">${val(m.phone)||'Not on file'}</span></div>
    <div class="fr"><span class="fl">Gender</span><span class="fv">${val(m.gender)||'—'}</span></div>
  </div>
  <div class="mc-section">
    <div class="sct">Membership</div>
    <div class="fr"><span class="fl">Joined</span><span class="fv${!val(m.join_date)?' em':''}">${val(m.join_date)||'Unknown'}</span></div>
    <div class="fr"><span class="fl">Tenure</span><span class="fv">${m.tenure?m.tenure+' years':'—'}</span></div>
    <div class="fr"><span class="fl">Date of birth</span><span class="fv${!val(m.birthday)?' em':''}">${val(m.birthday)||'—'}</span></div>
    <div class="fr"><span class="fl">Age</span><span class="fv">${m.age?m.age+' years':'—'}</span></div>
    ${m.tenure?`<div class="ten-track"><div class="ten-fill" style="width:${tenPct(m.tenure)}%"></div></div>
    <div class="ten-lbl"><span>0yr</span><span>${m.tenure}yr member</span><span>80yr</span></div>`:''}
  </div>
  ${hasEq?`<div class="mc-section full">
    <div class="sct">Equipment preferences</div>
    <div class="eq-grid">
      <div class="eq-item"><div class="eq-type">Driver</div><div class="eq-brand${!val(m.driver)?' em':''}">${val(m.driver)||'Not on file'}</div></div>
      <div class="eq-item"><div class="eq-type">Irons</div><div class="eq-brand${!val(m.irons)?' em':''}">${val(m.irons)||'Not on file'}</div></div>
      <div class="eq-item"><div class="eq-type">Woods &amp; Fairways</div><div class="eq-brand${!val(m.woods)?' em':''}">${val(m.woods)||'Not on file'}</div></div>
      <div class="eq-item"><div class="eq-type">Wedges</div><div class="eq-brand${!val(m.wedges)?' em':''}">${val(m.wedges)||'Not on file'}</div></div>
      <div class="eq-item"><div class="eq-type">Putter</div><div class="eq-brand${!val(m.putter)?' em':''}">${val(m.putter)||'Not on file'}</div></div>
      <div class="eq-item"><div class="eq-type">Golf Ball</div><div class="eq-brand${!val(m.ball)?' em':''}">${val(m.ball)||'Not on file'}</div></div>
    </div>
  </div>`:''}
  ${hasSz?`<div class="mc-section full">
    <div class="sct">Sizing preferences</div>
    <div class="eq-grid">
      ${val(m.apparel_size)?'<div class="eq-item"><div class="eq-type">Apparel</div><div class="eq-brand">'+m.apparel_size+'</div></div>':''}
      ${val(m.shoe_size)?'<div class="eq-item"><div class="eq-type">Shoe size</div><div class="eq-brand">'+m.shoe_size+'</div></div>':''}
    </div>
  </div>`:''}
</div>`;
}

doSearch();
document.getElementById('rCount').textContent=members.length+' of '+members.length;
