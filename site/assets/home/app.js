
  const d = new Date();
  const opts = { weekday:'long', day:'numeric', month:'long', year:'numeric' };
  const dateStr = d.toLocaleDateString('en-AU', opts);

  // Header date
  document.getElementById('hdrDate').textContent = dateStr;

  // Greeting — time of day
  const h = d.getHours();
  let greet = 'Good evening';
  if (h < 12) greet = 'Good morning';
  else if (h < 17) greet = 'Good afternoon';

  const el = document.getElementById('greetingHello');
  if (el) el.innerHTML = '<strong>' + greet + '</strong>';

  const dateEl = document.getElementById('greetingDate');
  if (dateEl) dateEl.textContent = dateStr;

  // F&B status indicators
  const today = d.toDateString();

  function checkFnbStatus() {
    try {
      const tsDate = localStorage.getItem('fnb_teesheet_date');
      const lbDate = localStorage.getItem('fnb_leaderboard_date');
      const dotTs = document.getElementById('dotTeesheet');
      const dotLb = document.getElementById('dotLeaderboard');

      if (dotTs) {
        dotTs.className = 'g-pill-dot ' + (tsDate === today ? 'g-pill-dot--on' : 'g-pill-dot--off');
      }
      if (dotLb) {
        dotLb.className = 'g-pill-dot ' + (lbDate === today ? 'g-pill-dot--on' : 'g-pill-dot--off');
      }
    } catch(e) {}
  }

  checkFnbStatus();
  // Re-check every 30s in case user uploads in another tab
  setInterval(checkFnbStatus, 30000);
