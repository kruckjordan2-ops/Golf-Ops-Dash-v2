
  const d = new Date();
  document.getElementById('hdrDate').textContent =
    d.toLocaleDateString('en-AU', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
