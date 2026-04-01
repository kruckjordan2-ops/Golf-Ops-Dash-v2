// ════════════════════════════════════════════════════════════════════════════
// VGC SCORECARD GENERATOR — Backend Logic
// Victoria Golf Club
// ════════════════════════════════════════════════════════════════════════════
// This file contains all data, calculations and card-rendering logic.
// It runs entirely in the browser — no server required.
// The HTML file links to this script and provides the DOM elements.
// ════════════════════════════════════════════════════════════════════════════


// ────────────────────────────────────────────────────────
// PLAYER COLOURS
// Used to highlight stroke index cells on matchplay cards
// ────────────────────────────────────────────────────────
const PCOL_DEFAULTS = ['#FFD700', '#90EE90', '#87CEEB', '#FFB347'];
const PCOL = [...PCOL_DEFAULTS];

/** Darken a hex colour for the stripe pattern */
function darkenHex(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const f = 0.55;
  return '#' + [r,g,b].map(c => Math.round(c*f).toString(16).padStart(2,'0')).join('');
}

/** Called by colour picker oninput */
function updatePlayerColour(idx, val) {
  PCOL[idx] = val;
  // Update legend swatch
  const lsw = document.getElementById('lsw' + (idx+1));
  if (lsw) lsw.style.background = val;
  // Update shots-received box in dashboard
  const shotBox = document.getElementById('p' + (idx+1) + 's');
  if (shotBox) { shotBox.style.background = val; shotBox.style.borderColor = darkenHex(val); }
  // Update stripe preview (uses P1 colour)
  if (idx === 0) {
    const sp = document.getElementById('stripe-preview');
    if (sp) sp.style.background = `repeating-linear-gradient(135deg,${val},${val} 4px,${darkenHex(val)} 4px,${darkenHex(val)} 7px)`;
  }
  upd();
}

/** Reset all colours to defaults */
function resetPlayerColours() {
  PCOL_DEFAULTS.forEach((c, i) => {
    PCOL[i] = c;
    document.getElementById('pcol' + (i+1)).value = c;
    updatePlayerColour(i, c);
  });
}

/** Competition dropdown handler */
function compSelChange() {
  const sel = document.getElementById('d_comp_sel');
  const otherRow = document.getElementById('d_comp_other_row');
  const hidden = document.getElementById('d_comp');
  if (sel.value === '__other__') {
    otherRow.style.display = '';
    hidden.value = document.getElementById('d_comp_other').value;
  } else {
    otherRow.style.display = 'none';
    hidden.value = sel.value;
  }
  upd();
}

// Override v() for d_comp to always read hidden field
// (already handled since hidden input has id="d_comp")


// ════════════════════════════════════════════════════════
// COURSE DATA — The Victoria Golf Club
// Each tee has:
//   SR_M / SR_F  — Scratch Rating (Men / Women)
//   SL_M / SL_F  — Slope Rating  (Men / Women)
//   h[]          — 19 holes (hole 19 = optional alternate hole)
//     n    — hole number
//     D    — distance in metres
//     PM   — par (men)
//     PF   — par (women)
//     SIM  — stroke index (men)
//     SIF  — stroke index (women)
//     SIX  — match index (used for matchplay stroke allocation)
// ════════════════════════════════════════════════════════
const TEE = {
  Black: {
    SR_M: 74, SR_F: 80, SL_M: 134, SL_F: 144,
    h: [
      { n: 1,  D: 233, PM: 4, PF: 4, SIM: 17, SIF: 16, SIX: 18 },
      { n: 2,  D: 394, PM: 4, PF: 5, SIM: 5,  SIF: 18, SIX: 8  },
      { n: 3,  D: 401, PM: 4, PF: 4, SIM: 3,  SIF: 11, SIX: 12 },
      { n: 4,  D: 164, PM: 3, PF: 3, SIM: 13, SIF: 10, SIX: 3  },
      { n: 5,  D: 370, PM: 4, PF: 4, SIM: 9,  SIF: 4,  SIX: 14 },
      { n: 6,  D: 698, PM: 4, PF: 4, SIM: 1,  SIF: 7,  SIX: 6  },
      { n: 7,  D: 169, PM: 3, PF: 3, SIM: 11, SIF: 6,  SIX: 10 },
      { n: 8,  D: 448, PM: 5, PF: 5, SIM: 15, SIF: 14, SIX: 1  },
      { n: 9,  D: 532, PM: 5, PF: 5, SIM: 7,  SIF: 1,  SIX: 16 },
      { n: 10, D: 348, PM: 4, PF: 4, SIM: 12, SIF: 2,  SIX: 5  },
      { n: 11, D: 370, PM: 4, PF: 4, SIM: 6,  SIF: 8,  SIX: 11 },
      { n: 12, D: 390, PM: 4, PF: 4, SIM: 4,  SIF: 3,  SIX: 2  },
      { n: 13, D: 392, PM: 4, PF: 5, SIM: 2,  SIF: 17, SIX: 15 },
      { n: 14, D: 142, PM: 3, PF: 3, SIM: 14, SIF: 9,  SIX: 7  },
      { n: 15, D: 289, PM: 4, PF: 4, SIM: 16, SIF: 15, SIX: 13 },
      { n: 16, D: 178, PM: 3, PF: 3, SIM: 8,  SIF: 13, SIX: 4  },
      { n: 17, D: 527, PM: 5, PF: 5, SIM: 10, SIF: 5,  SIX: 17 },
      { n: 18, D: 461, PM: 5, PF: 5, SIM: 18, SIF: 12, SIX: 9  },
      { n: 19, D: 169, PM: 3, PF: 3, SIM: null, SIF: null, SIX: null },
    ]
  },
  Silver: {
    SR_M: 75, SR_F: 79, SL_M: 135, SL_F: 143,
    h: [
      { n: 1,  D: 233, PM: 4, PF: 4, SIM: 17, SIF: 16, SIX: 18 },
      { n: 2,  D: 394, PM: 4, PF: 5, SIM: 5,  SIF: 18, SIX: 8  },
      { n: 3,  D: 401, PM: 4, PF: 4, SIM: 3,  SIF: 11, SIX: 12 },
      { n: 4,  D: 164, PM: 3, PF: 3, SIM: 13, SIF: 10, SIX: 3  },
      { n: 5,  D: 398, PM: 4, PF: 4, SIM: 9,  SIF: 4,  SIX: 14 },
      { n: 6,  D: 398, PM: 4, PF: 4, SIM: 1,  SIF: 7,  SIX: 6  },
      { n: 7,  D: 169, PM: 3, PF: 3, SIM: 11, SIF: 6,  SIX: 10 },
      { n: 8,  D: 448, PM: 5, PF: 5, SIM: 15, SIF: 14, SIX: 1  },
      { n: 9,  D: 554, PM: 5, PF: 5, SIM: 7,  SIF: 1,  SIX: 16 },
      { n: 10, D: 382, PM: 4, PF: 4, SIM: 12, SIF: 2,  SIX: 5  },
      { n: 11, D: 370, PM: 4, PF: 4, SIM: 6,  SIF: 8,  SIX: 11 },
      { n: 12, D: 402, PM: 4, PF: 4, SIM: 4,  SIF: 3,  SIX: 2  },
      { n: 13, D: 392, PM: 4, PF: 5, SIM: 2,  SIF: 17, SIX: 15 },
      { n: 14, D: 144, PM: 3, PF: 3, SIM: 14, SIF: 9,  SIX: 7  },
      { n: 15, D: 289, PM: 4, PF: 4, SIM: 16, SIF: 15, SIX: 13 },
      { n: 16, D: 178, PM: 3, PF: 3, SIM: 8,  SIF: 13, SIX: 4  },
      { n: 17, D: 527, PM: 5, PF: 5, SIM: 10, SIF: 5,  SIX: 17 },
      { n: 18, D: 461, PM: 5, PF: 5, SIM: 18, SIF: 12, SIX: 9  },
      { n: 19, D: 169, PM: 3, PF: 3, SIM: null, SIF: null, SIX: null },
    ]
  },
  Blue: {
    SR_M: 72, SR_F: 79, SL_M: 132, SL_F: 142,
    h: [
      { n: 1,  D: 229, PM: 4, PF: 4, SIM: 17, SIF: 16, SIX: 18 },
      { n: 2,  D: 385, PM: 4, PF: 5, SIM: 5,  SIF: 18, SIX: 8  },
      { n: 3,  D: 389, PM: 4, PF: 4, SIM: 3,  SIF: 11, SIX: 12 },
      { n: 4,  D: 155, PM: 3, PF: 3, SIM: 13, SIF: 10, SIX: 3  },
      { n: 5,  D: 361, PM: 4, PF: 4, SIM: 9,  SIF: 4,  SIX: 14 },
      { n: 6,  D: 287, PM: 4, PF: 4, SIM: 1,  SIF: 7,  SIX: 6  },
      { n: 7,  D: 159, PM: 3, PF: 3, SIM: 11, SIF: 6,  SIX: 10 },
      { n: 8,  D: 439, PM: 5, PF: 5, SIM: 15, SIF: 14, SIX: 1  },
      { n: 9,  D: 528, PM: 5, PF: 5, SIM: 7,  SIF: 1,  SIX: 16 },
      { n: 10, D: 344, PM: 4, PF: 4, SIM: 12, SIF: 2,  SIX: 5  },
      { n: 11, D: 355, PM: 4, PF: 4, SIM: 6,  SIF: 8,  SIX: 11 },
      { n: 12, D: 374, PM: 4, PF: 4, SIM: 4,  SIF: 3,  SIX: 2  },
      { n: 13, D: 382, PM: 4, PF: 5, SIM: 2,  SIF: 17, SIX: 15 },
      { n: 14, D: 132, PM: 3, PF: 3, SIM: 14, SIF: 9,  SIX: 7  },
      { n: 15, D: 280, PM: 4, PF: 4, SIM: 16, SIF: 15, SIX: 13 },
      { n: 16, D: 166, PM: 3, PF: 3, SIM: 8,  SIF: 13, SIX: 4  },
      { n: 17, D: 520, PM: 5, PF: 5, SIM: 10, SIF: 5,  SIX: 17 },
      { n: 18, D: 446, PM: 5, PF: 5, SIM: 18, SIF: 12, SIX: 9  },
      { n: 19, D: 159, PM: 3, PF: 3, SIM: null, SIF: null, SIX: null },
    ]
  },
  White: {
    SR_M: 71, SR_F: 77, SL_M: 129, SL_F: 139,
    h: [
      { n: 1,  D: 225, PM: 4, PF: 4, SIM: 17, SIF: 16, SIX: 18 },
      { n: 2,  D: 345, PM: 4, PF: 5, SIM: 5,  SIF: 18, SIX: 8  },
      { n: 3,  D: 375, PM: 4, PF: 4, SIM: 3,  SIF: 11, SIX: 12 },
      { n: 4,  D: 123, PM: 3, PF: 3, SIM: 13, SIF: 10, SIX: 3  },
      { n: 5,  D: 330, PM: 4, PF: 4, SIM: 9,  SIF: 4,  SIX: 14 },
      { n: 6,  D: 365, PM: 4, PF: 4, SIM: 1,  SIF: 7,  SIX: 6  },
      { n: 7,  D: 150, PM: 3, PF: 3, SIM: 11, SIF: 6,  SIX: 10 },
      { n: 8,  D: 420, PM: 5, PF: 5, SIM: 15, SIF: 14, SIX: 1  },
      { n: 9,  D: 497, PM: 5, PF: 5, SIM: 7,  SIF: 1,  SIX: 16 },
      { n: 10, D: 340, PM: 4, PF: 4, SIM: 12, SIF: 2,  SIX: 5  },
      { n: 11, D: 312, PM: 4, PF: 4, SIM: 6,  SIF: 8,  SIX: 11 },
      { n: 12, D: 348, PM: 4, PF: 4, SIM: 4,  SIF: 3,  SIX: 2  },
      { n: 13, D: 370, PM: 4, PF: 5, SIM: 2,  SIF: 17, SIX: 15 },
      { n: 14, D: 115, PM: 3, PF: 3, SIM: 14, SIF: 9,  SIX: 7  },
      { n: 15, D: 279, PM: 4, PF: 4, SIM: 16, SIF: 15, SIX: 13 },
      { n: 16, D: 166, PM: 3, PF: 3, SIM: 8,  SIF: 13, SIX: 4  },
      { n: 17, D: 490, PM: 5, PF: 5, SIM: 10, SIF: 5,  SIX: 17 },
      { n: 18, D: 440, PM: 5, PF: 5, SIM: 18, SIF: 12, SIX: 9  },
      { n: 19, D: 150, PM: 3, PF: 3, SIM: null, SIF: null, SIX: null },
    ]
  },
  Red: {
    SR_M: 70, SR_F: 75, SL_M: 126, SL_F: 137,
    h: [
      { n: 1,  D: 210, PM: 4, PF: 4, SIM: 17, SIF: 16, SIX: 18 },
      { n: 2,  D: 353, PM: 4, PF: 5, SIM: 5,  SIF: 18, SIX: 8  },
      { n: 3,  D: 307, PM: 4, PF: 4, SIM: 3,  SIF: 11, SIX: 12 },
      { n: 4,  D: 119, PM: 3, PF: 3, SIM: 13, SIF: 10, SIX: 3  },
      { n: 5,  D: 323, PM: 4, PF: 4, SIM: 9,  SIF: 4,  SIX: 14 },
      { n: 6,  D: 306, PM: 4, PF: 4, SIM: 1,  SIF: 7,  SIX: 6  },
      { n: 7,  D: 150, PM: 3, PF: 3, SIM: 11, SIF: 6,  SIX: 10 },
      { n: 8,  D: 413, PM: 5, PF: 5, SIM: 15, SIF: 14, SIX: 1  },
      { n: 9,  D: 497, PM: 5, PF: 5, SIM: 7,  SIF: 1,  SIX: 16 },
      { n: 10, D: 313, PM: 4, PF: 4, SIM: 12, SIF: 2,  SIX: 5  },
      { n: 11, D: 303, PM: 4, PF: 4, SIM: 6,  SIF: 8,  SIX: 11 },
      { n: 12, D: 343, PM: 4, PF: 4, SIM: 4,  SIF: 3,  SIX: 2  },
      { n: 13, D: 365, PM: 4, PF: 5, SIM: 2,  SIF: 17, SIX: 15 },
      { n: 14, D: 110, PM: 3, PF: 3, SIM: 14, SIF: 9,  SIX: 7  },
      { n: 15, D: 271, PM: 4, PF: 4, SIM: 16, SIF: 15, SIX: 13 },
      { n: 16, D: 144, PM: 3, PF: 3, SIM: 8,  SIF: 13, SIX: 4  },
      { n: 17, D: 461, PM: 5, PF: 5, SIM: 10, SIF: 5,  SIX: 17 },
      { n: 18, D: 412, PM: 5, PF: 5, SIM: 18, SIF: 12, SIX: 9  },
      { n: 19, D: 150, PM: 3, PF: 3, SIM: null, SIF: null, SIX: null },
    ]
  },
  Yellow: {
    SR_M: 65, SR_F: 77, SL_M: 112, SL_F: 139,
    h: [
      { n: 1,  D: 210, PM: 4, PF: 4, SIM: 17, SIF: 11, SIX: 18 },
      { n: 2,  D: 295, PM: 4, PF: 4, SIM: 5,  SIF: 5,  SIX: 8  },
      { n: 3,  D: 307, PM: 4, PF: 4, SIM: 3,  SIF: 3,  SIX: 12 },
      { n: 4,  D: 80,  PM: 3, PF: 3, SIM: 13, SIF: 17, SIX: 3  },
      { n: 5,  D: 230, PM: 4, PF: 4, SIM: 9,  SIF: 13, SIX: 14 },
      { n: 6,  D: 306, PM: 4, PF: 4, SIM: 1,  SIF: 1,  SIX: 6  },
      { n: 7,  D: 114, PM: 3, PF: 3, SIM: 11, SIF: 15, SIX: 10 },
      { n: 8,  D: 300, PM: 4, PF: 4, SIM: 15, SIF: 7,  SIX: 1  },
      { n: 9,  D: 410, PM: 5, PF: 5, SIM: 7,  SIF: 9,  SIX: 16 },
      { n: 10, D: 238, PM: 4, PF: 4, SIM: 12, SIF: 6,  SIX: 5  },
      { n: 11, D: 303, PM: 4, PF: 4, SIM: 6,  SIF: 2,  SIX: 11 },
      { n: 12, D: 270, PM: 4, PF: 4, SIM: 4,  SIF: 8,  SIX: 2  },
      { n: 13, D: 245, PM: 4, PF: 4, SIM: 2,  SIF: 10, SIX: 15 },
      { n: 14, D: 63,  PM: 3, PF: 3, SIM: 14, SIF: 16, SIX: 7  },
      { n: 15, D: 200, PM: 4, PF: 4, SIM: 16, SIF: 12, SIX: 13 },
      { n: 16, D: 95,  PM: 3, PF: 3, SIM: 8,  SIF: 18, SIX: 4  },
      { n: 17, D: 430, PM: 5, PF: 5, SIM: 10, SIF: 4,  SIX: 17 },
      { n: 18, D: 360, PM: 5, PF: 5, SIM: 18, SIF: 14, SIX: 9  },
      { n: 19, D: 114, PM: 3, PF: 3, SIM: null, SIF: null, SIX: null },
    ]
  },
};


// ════════════════════════════════════════════════════════
// DOM HELPERS
// ════════════════════════════════════════════════════════
const v   = id => document.getElementById(id)?.value ?? '';          // get input value
const s   = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t ?? ''; }; // set text
const el  = id => document.getElementById(id);                        // get element


// ════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════

/** Format a date string from YYYY-MM-DD to DD/MM/YYYY */
function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/** Get the stroke index for a hole based on selected index type */
function getSI(hole, idx) {
  return idx === 'match' ? hole.SIX : idx === 'female' ? hole.SIF : hole.SIM;
}

/** Get par for a hole based on gender */
function getPar(hole, g) {
  return g === 'F' ? hole.PF : hole.PM;
}

/** Convert metres to yards if yards mode is selected */
function dist(m) {
  return v('d_unit') === 'y' ? Math.round(m * 1.09361) : m;
}

/** Return distance unit label */
function distLbl() {
  return v('d_unit') === 'y' ? 'Yards' : 'Metres';
}


// ════════════════════════════════════════════════════════
// HANDICAP CALCULATIONS
// ════════════════════════════════════════════════════════

/**
 * Calculate GA Daily Handicap
 * Formula: ((GA × Slope/113) + (SR − Par)) × 0.93 × CF
 * CF = 0.9986 for men, 1.0483 for women
 * Result is rounded to nearest whole number
 */
function calcDaily(ga, g, td, par) {
  const x = parseFloat(ga);
  if (isNaN(x) || !td) return null;
  const sl = g === 'F' ? td.SL_F : td.SL_M;
  const sr = g === 'F' ? td.SR_F : td.SR_M;
  const cf = g === 'F' ? 1.0483 : 0.9986;
  return Math.round(((x * sl / 113) + (sr - par)) * 0.93 * cf);
}

/**
 * Allocate matchplay shots between players
 * The lowest daily handicap becomes scratch (0 shots)
 * All others receive the difference from the lowest
 */
function allocate(dailies) {
  const vals = dailies.filter(d => d !== null);
  if (!vals.length) return dailies.map(() => null);
  const mn = Math.min(...vals);
  return dailies.map(d => d === null ? null : Math.max(d - mn, 0));
}


// ════════════════════════════════════════════════════════
// HOLE SEQUENCE BUILDER
// Handles normal start (hole 1) and shotgun starts
// Also handles hole 19 substitution
// ════════════════════════════════════════════════════════

/**
 * Build front/back 9 hole arrays in play order
 * @param {object} td        - Tee data object
 * @param {string} h19       - Hole 19 setting ('none' or hole number it replaces)
 * @param {string} startHole - Starting hole number
 * @returns {{ front: hole[], back: hole[] }}
 */
function getSeq(td, h19, startHole) {
  const find = n => td.h.find(x => x.n === n) || { n, D: 0, PM: 0, PF: 0, SIM: 0, SIF: 0, SIX: 0 };
  const h19d = { ...find(19) };
  const rep = parseInt(h19);

  // Copy stroke indexes from replaced hole to hole 19
  if (h19 !== 'none') {
    const src = find(rep);
    if (src) { h19d.SIM = src.SIM; h19d.SIF = src.SIF; h19d.SIX = src.SIX; }
  }

  let base;
  if (h19 === 'none') {
    base = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].map(n => find(n));
  } else if ([4, 7].includes(rep)) {
    // Hole 19 replaces a front 9 hole
    const f = [1,2,3,4,5,6,7,8,9].filter(n => n !== rep);
    f.splice(f.indexOf(8) + 1, 0, 19);
    base = [...f.map(n => n === 19 ? h19d : find(n)), ...[10,11,12,13,14,15,16,17,18].map(n => find(n))];
  } else {
    // Hole 19 replaces a back 9 hole
    const b = [10,11,12,13,14,15,16,17,18].filter(n => n !== rep);
    b.splice(b.indexOf(10) + 1, 0, 19);
    base = [...[1,2,3,4,5,6,7,8,9].map(n => find(n)), ...b.map(n => n === 19 ? h19d : find(n))];
  }

  // Rotate for shotgun starts
  const sh = parseInt(startHole) || 1;
  let si = base.findIndex(h => h && h.n === sh);
  if (si < 0) si = 0;
  const rot = [...base.slice(si), ...base.slice(0, si)];
  return { front: rot.slice(0, 9), back: rot.slice(9, 18) };
}


// ════════════════════════════════════════════════════════
// MATCHPLAY TABLE BUILDER
// Used for both 2-Ball and 4-Ball matchplay cards
// ════════════════════════════════════════════════════════

/**
 * Build the main matchplay scorecard table HTML
 * @param {hole[]} front   - Front 9 holes in play order
 * @param {hole[]} back    - Back 9 holes in play order
 * @param {number[]} shots - Allocated shots per player [sh1, sh2, sh3, sh4]
 * @param {string[]} gs    - Gender per player ['M'|'F', ...]
 * @param {string} idx     - Index type: 'male' | 'female' | 'match'
 * @param {object} td      - Tee data object
 * @param {boolean} fourball - true = 4-ball layout, false = 2-ball layout
 * @returns {string} HTML string for the table
 */
function buildMatchTbl(front, back, shots, gs, idx, td, fourball) {
  const [sh1, sh2, sh3, sh4] = shots;
  const [g1, g2] = gs;
  const sr1 = g1 === 'F' ? td.SR_F : td.SR_M;
  const sl1 = g1 === 'F' ? td.SL_F : td.SL_M;
  const sr2 = g2 === 'F' ? td.SR_F : td.SR_M;
  const sl2 = g2 === 'F' ? td.SL_F : td.SL_M;

  // Calculate front/back totals
  let fD = 0, fP = 0, bD = 0, bP = 0;
  [...front, ...back].forEach((h, i) => {
    if (i < front.length) { fD += h.D; fP += getPar(h, g1); }
    else                   { bD += h.D; bP += getPar(h, g1); }
  });

  /**
   * How many strokes does a player receive on this hole?
   * Returns 0, 1, or 2
   * A player with >18 shots gets 2 strokes on their lowest indexes
   */
  const getStrokes = (sh, si) => {
    if (sh === null || sh === undefined || si === null) return 0;
    if (sh > 0 && si <= sh && sh > 18 && si <= (sh - 18)) return 2;
    if (sh > 0 && si <= sh) return 1;
    return 0;
  };

  /**
   * CSS background gradient for a single player's index cell
   * 0 shots = no background
   * 1 shot  = solid player colour
   * 2 shots = diagonal stripe pattern (player colour + dark variant)
   */
  const strokeBg = (col, n) => {
    if (n === 0) return '';
    if (n === 1) return col;
    const dark = darkenHex(col);
    return `repeating-linear-gradient(135deg,${col},${col} 4px,${dark} 4px,${dark} 7px)`;
  };

  /**
   * CSS background for a 4-ball index cell shared by two players
   * Cell is split into top half (player 1) and bottom half (player 2)
   * Each half is solid (1 shot) or diagonally striped (2 shots)
   */
  const pairBgFull = (col1, n1, col2, n2) => {
    const has1 = n1 > 0, has2 = n2 > 0;
    if (!has1 && !has2) return '';
    if (has1 && !has2)  return strokeBg(col1, n1);
    if (!has1 && has2)  return strokeBg(col2, n2);

    const dark1 = darkenHex(col1);
    const dark2 = darkenHex(col2);

    // Top half: solid or striped depending on shot count
    const t1 = n1 === 2 ? `${col1},${col1} 4px,${dark1} 4px,${dark1} 8px` : `${col1},${col1}`;
    // Bottom half: solid or striped depending on shot count
    const t2 = n2 === 2 ? `${col2},${col2} 4px,${dark2} 4px,${dark2} 8px` : `${col2},${col2}`;

    return [
      `repeating-linear-gradient(135deg,${t1}) 0 0/100% 50%`,
      `repeating-linear-gradient(135deg,${t2}) 0 100%/100% 50%`
    ].join(',');
  };

  // Column widths (11 columns)
  const cw = ['11%','5%','8%','10%','10%','7%','10%','10%','8%','5%','11%'];
  const colgroup = `<colgroup>${cw.map(w => `<col style="width:${w}">`).join('')}</colgroup>`;

  let r = '';

  // ── Section header row ──
  if (fourball) {
    r += `<tr style="font-size:7px;font-weight:700;height:13px">
      <td colspan="3" style="text-align:left;padding-left:2px;font-size:6px;white-space:normal;overflow:hidden;line-height:1.1">${v('d_course')}</td>
      <td colspan="2" style="text-align:center">Players 1 &amp; 2</td>
      <td style="border-left:2px solid #000;border-right:2px solid #000">Vs</td>
      <td colspan="2" style="text-align:center">Players 3 &amp; 4</td>
      <td colspan="3"></td></tr>`;
  } else {
    r += `<tr style="font-size:7px;font-weight:700;height:13px">
      <td colspan="3" style="text-align:left;padding-left:2px;font-size:6px;white-space:normal;overflow:hidden;line-height:1.1">${v('d_course')}</td>
      <td colspan="2" style="text-align:center">Player 1</td>
      <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
      <td colspan="2" style="text-align:center">Player 2</td>
      <td colspan="3"></td></tr>`;
  }

  // ── Column header row ──
  r += `<tr>
    <th style="font-size:7px">Metres</th>
    <th style="font-size:7px">Par</th>
    <th style="font-size:7px">Index</th>
    <th style="font-size:7px">Score</th>
    <th style="font-size:7px">Result</th>
    <th style="font-size:7px;border-left:2px solid #000;border-right:2px solid #000">Hole</th>
    <th style="font-size:7px">Score</th>
    <th style="font-size:7px">Result</th>
    <th style="font-size:7px">Index</th>
    <th style="font-size:7px">Par</th>
    <th style="font-size:7px">Metres</th>
  </tr>`;

  // ── Hole rows ──
  [...front, ...back].forEach((hole, i) => {
    const par  = getPar(hole, g1);
    const par2 = getPar(hole, g2);
    const si   = getSI(hole, idx);
    let lBg = '', rBg = '';

    if (fourball) {
      const ln1 = getStrokes(sh1, si), ln2 = getStrokes(sh2, si);
      const rn3 = getStrokes(sh3, si), rn4 = getStrokes(sh4, si);
      lBg = pairBgFull(PCOL[0], ln1, PCOL[1], ln2);
      rBg = pairBgFull(PCOL[2], rn3, PCOL[3], rn4);
    } else {
      lBg = strokeBg(PCOL[0], getStrokes(sh1, si));
      rBg = strokeBg(PCOL[1], getStrokes(sh2, si));
    }

    r += `<tr class="hr">
      <td>${dist(hole.D)}</td>
      <td style="font-weight:700">${par}</td>
      <td${lBg ? ` style="background:${lBg};background-repeat:no-repeat"` : ''}>${si ?? ''}</td>
      <td></td><td></td>
      <td style="font-weight:700;border-left:2px solid #000;border-right:2px solid #000">${hole.n}</td>
      <td></td><td></td>
      <td${rBg ? ` style="background:${rBg};background-repeat:no-repeat"` : ''}>${si ?? ''}</td>
      <td style="font-weight:700">${par2}</td>
      <td>${dist(hole.D)}</td>
    </tr>`;

    // After hole 9 — Out row + separator gap
    if (i === front.length - 1) {
      r += `<tr class="or">
        <td style="font-weight:700">${dist(fD)}</td><td style="font-weight:700">${fP}</td>
        <td></td><td></td><td></td>
        <td style="font-weight:700;border-left:2px solid #000;border-right:2px solid #000">Out</td>
        <td></td><td></td><td></td>
        <td style="font-weight:700">${fP}</td><td style="font-weight:700">${dist(fD)}</td>
      </tr>
      <tr style="height:5px;background:#e8e8e8">
        <td colspan="11" style="border-left:none;border-right:none;border-top:2px solid #000;border-bottom:2px solid #000;background:#e8e8e8"></td>
      </tr>`;
    }
  });

  // ── Summary rows (In / Out / Total) ──
  const tot = fP + bP, totD = fD + bD;
  r += `
  <tr class="sr">
    <td style="font-weight:700">${dist(bD)}</td><td style="font-weight:700">${bP}</td>
    <td style="border-left:1px solid #000;border-right:1px solid #000"></td><td></td><td></td>
    <td style="border-left:2px solid #000;border-right:2px solid #000">In</td>
    <td></td><td></td><td style="border-left:1px solid #000;border-right:1px solid #000"></td>
    <td style="font-weight:700">${bP}</td><td style="font-weight:700">${dist(bD)}</td>
  </tr>
  <tr class="sr">
    <td style="font-weight:700">${dist(fD)}</td><td style="font-weight:700">${fP}</td>
    <td style="border-left:1px solid #000;border-right:1px solid #000"></td><td></td><td></td>
    <td style="border-left:2px solid #000;border-right:2px solid #000">Out</td>
    <td></td><td></td><td style="border-left:1px solid #000;border-right:1px solid #000"></td>
    <td style="font-weight:700">${fP}</td><td style="font-weight:700">${dist(fD)}</td>
  </tr>
  <tr class="sr">
    <td style="font-weight:700">${dist(totD)}</td><td style="font-weight:700">${tot}</td>
    <td style="border-left:1px solid #000;border-right:1px solid #000"></td><td></td><td></td>
    <td style="font-weight:700;border-left:2px solid #000;border-right:2px solid #000">Total</td>
    <td></td><td></td><td style="border-left:1px solid #000;border-right:1px solid #000"></td>
    <td style="font-weight:700">${tot}</td><td style="font-weight:700">${dist(totD)}</td>
  </tr>

  <!-- Footer: Scratch Rating + Slope rows -->
  <tr class="fr">
    <td style="font-weight:700;text-align:left;padding-left:2px">Scratch Rtg</td>
    <td style="font-weight:700">${sr1}</td>
    <td style="border-left:1px solid #000;border-right:1px solid #000"></td>
    <td></td><td></td>
    <td style="font-weight:700;border-left:2px solid #000;border-right:2px solid #000">Deduct H'cap</td>
    <td></td><td></td>
    <td style="border-left:1px solid #000;border-right:1px solid #000"></td>
    <td style="font-weight:700">${sr2}</td>
    <td style="font-weight:700;text-align:right;padding-right:2px">Scratch Rtg</td>
  </tr>
  <tr class="fr">
    <td style="font-weight:700;text-align:left;padding-left:2px">Slope</td>
    <td style="font-weight:700">${sl1}</td>
    <td style="border-left:1px solid #000;border-right:1px solid #000"></td>
    <td></td><td></td>
    <td style="font-weight:700;border-left:2px solid #000;border-right:2px solid #000">Nett Score</td>
    <td></td><td></td>
    <td style="border-left:1px solid #000;border-right:1px solid #000"></td>
    <td style="font-weight:700">${sl2}</td>
    <td style="font-weight:700;text-align:right;padding-right:2px">Slope</td>
  </tr>

  <!-- Player / Marker signature row -->
  <tr class="sig">
    <td colspan="5" style="font-weight:700;text-align:left;padding-left:4px;border-top:2px solid #000;border-right:2px solid #000">Player:</td>
    <td style="border-top:2px solid #000;border-left:2px solid #000;border-right:2px solid #000"></td>
    <td colspan="5" style="font-weight:700;text-align:left;padding-left:4px;border-top:2px solid #000">Marker:</td>
  </tr>`;

  return `<table class="ct ct-fill" style="table-layout:fixed;width:100%;flex:1">${colgroup}${r}</table>`;
}


// ════════════════════════════════════════════════════════
// STROKEPLAY LEFT TABLE BUILDER
// Left column table for all portrait strokeplay cards
// ════════════════════════════════════════════════════════

/**
 * Build the left-side hole data table for strokeplay cards
 * @param {hole[]} front  - Front 9
 * @param {hole[]} back   - Back 9
 * @param {string[]} cols - Column names to include
 * @param {string} idx    - Index type
 * @param {string} g1     - Gender of player 1
 */
function spLeftTbl(front, back, cols, idx, g1, fP, bP, fD, bD) {
  const nc = cols.length;
  const colWidths = {
    'Metres': '32px', 'Par': '16px', 'Index': '20px',
    'Index Mens': '22px', 'Index Ladies': '28px',
    'Shots': '20px', 'Player': '36px', 'Marker': '36px', 'TPH': '22px',
    'P1': '22px', 'P2': '22px', 'MK1': '22px', 'MK2': '22px', 'Result': '28px'
  };
  const colgroup = `<colgroup>${cols.map(c => `<col style="width:${colWidths[c] || '24px'}">`).join('')}<col style="width:22px"></colgroup>`;
  const thRow = `<tr>${cols.map(c => `<th style="font-size:7px;padding:1px 2px">${c === 'Metres' ? distLbl() : c}</th>`).join('')}<th style="border-left:2px solid #000;font-size:7px">Hole</th></tr>`;

  let rows = '';
  [...front, ...back].forEach((hole, i) => {
    const par = getPar(hole, g1), si = getSI(hole, idx);
    let tds = '';
    cols.forEach(c => {
      if      (c === 'Metres')       tds += `<td>${dist(hole.D)}</td>`;
      else if (c === 'Par')          tds += `<td style="font-weight:700">${par}</td>`;
      else if (c === 'Index')        tds += `<td>${si ?? ''}</td>`;
      else if (c === 'Index Mens')   tds += `<td>${hole.SIM ?? ''}</td>`;
      else if (c === 'Index Ladies') tds += `<td>${hole.SIF ?? ''}</td>`;
      else if (c === 'Shots')        tds += `<td style="background:repeating-linear-gradient(135deg,transparent,transparent 3px,#ccc 3px,#ccc 4px)"></td>`;
      else                           tds += `<td></td>`;
    });
    rows += `<tr class="hr">${tds}<td style="font-weight:700;border-left:2px solid #000">${hole.n}</td></tr>`;
    if (i === front.length - 1)
      rows += `<tr class="or"><td>${dist(fD)}</td><td>${fP}</td>${'<td></td>'.repeat(nc - 2)}<td style="border-left:2px solid #000">Out</td></tr>`;
  });

  const tot = fP + bP, totD = fD + bD;
  rows += `
    <tr class="sr"><td>${dist(bD)}</td><td>${bP}</td>${'<td></td>'.repeat(nc - 2)}<td style="border-left:2px solid #000">IN</td></tr>
    <tr class="sr"><td>${dist(fD)}</td><td>${fP}</td>${'<td></td>'.repeat(nc - 2)}<td style="border-left:2px solid #000">OUT</td></tr>
    <tr class="sr"><td style="font-weight:700">${dist(totD)}</td><td style="font-weight:700">${tot}</td>${'<td></td>'.repeat(nc - 2)}<td style="border-left:2px solid #000;font-weight:700">GROSS</td></tr>
    <tr class="fr">${'<td></td>'.repeat(nc)}<td style="border-left:2px solid #000;font-weight:700">H/C</td></tr>
    <tr class="fr">${'<td></td>'.repeat(nc)}<td style="border-left:2px solid #000;font-weight:700">NETT</td></tr>`;

  return `<table class="ct" style="table-layout:fixed">${colgroup}${thRow}${rows}</table>`;
}


// ════════════════════════════════════════════════════════
// SCORE GRID BUILDER (right side of portrait strokeplay)
// ════════════════════════════════════════════════════════

/**
 * Build the score entry grid for strokeplay cards
 * @param {hole[]} front   - Front 9
 * @param {hole[]} back    - Back 9
 * @param {string|null} extraCol - Optional extra column label (e.g. 'P2')
 */
function spGrid(front, back, extraCol) {
  const labels = ['1','2','3','4','5','6','7','8','9','10','W'];
  if (extraCol) labels.push(extraCol);
  const gc = `repeat(10,1fr) 6px${extraCol ? ' 1fr' : ''}`;

  const hdrRow = `<div class="slr" style="grid-template-columns:${gc};min-height:13px">
    ${labels.map(l => `<div class="sc" style="background:#bbb;min-height:13px;font-weight:700;font-size:7px;padding:1px">${l}</div>`).join('')}
  </div>`;

  const dataRow = h => `<div class="sdr" style="grid-template-columns:${gc}">
    ${labels.map(l => `<div class="sc${l === 'W' ? ' wbar' : ''}" style="min-height:${h}px"></div>`).join('')}
  </div>`;

  const sumRow = (lbl, h) => `<div class="sdr" style="grid-template-columns:${gc};background:#f0f0f0">
    <div class="sc" style="min-height:${h}px;font-size:7px;font-weight:700;grid-column:1/span 10;justify-content:flex-start;padding-left:3px">${lbl}</div>
    <div class="sc wbar" style="min-height:${h}px"></div>
    ${extraCol ? `<div class="sc" style="min-height:${h}px"></div>` : ''}
  </div>`;

  let front9 = '';
  front.forEach(() => front9 += dataRow(15));
  front9 += sumRow('Out', 14);

  let back9 = '';
  back.forEach(() => back9 += dataRow(15));
  back9 += sumRow('IN', 14);
  back9 += sumRow('OUT', 14);
  back9 += sumRow('GROSS', 14);
  back9 += sumRow('H/C', 13);
  back9 += sumRow('NETT', 13);

  const sig = `<div style="border:1px solid #000;border-top:2px solid #000;margin-top:3px;display:flex">
    <div style="flex:1;padding:2px 5px;border-right:1px solid #000">
      <div style="font-size:8px;font-weight:700">Player:</div>
      <div style="height:18px;border-bottom:1px solid #ccc"></div>
    </div>
    <div style="flex:1;padding:2px 5px">
      <div style="font-size:8px;font-weight:700">Marker:</div>
      <div style="height:18px"></div>
    </div>
  </div>`;

  return `<div class="sgw" style="margin-bottom:3px">${hdrRow}${front9}</div>
    <div class="sgw" style="margin-bottom:3px">${hdrRow}${back9}</div>
    ${sig}`;
}


// ════════════════════════════════════════════════════════
// AMBROSE / 4-PLAYER STROKEPLAY TABLE
// ════════════════════════════════════════════════════════

function sp4Tbl(front, back, idx, g1, fP, bP, fD, bD, sr, sl) {
  const tot = fP + bP, totD = fD + bD;
  let r = `<tr>
    <td colspan="3" style="font-weight:700;font-size:9px">${v('d_course')}</td>
    <td colspan="5" style="font-weight:700;font-size:9px;text-align:center">Player:</td>
    <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
    <td colspan="5" style="font-weight:700;font-size:9px;text-align:center">Marker:</td>
    <td colspan="3"></td></tr>
  <tr>
    <th>${distLbl()}</th><th>Par</th><th style="font-size:7px">Index</th>
    <th>1</th><th>2</th><th>3</th><th>4</th><th style="font-size:7px">Result</th>
    <th style="border-left:2px solid #000;border-right:2px solid #000">Hole</th>
    <th>1</th><th>2</th><th>3</th><th>4</th><th style="font-size:7px">Result</th>
    <th style="font-size:7px">Index</th><th>Par</th><th>${distLbl()}</th>
  </tr>`;

  [...front, ...back].forEach((hole, i) => {
    const par = getPar(hole, g1), si = getSI(hole, idx);
    r += `<tr class="hr">
      <td>${dist(hole.D)}</td><td style="font-weight:700">${par}</td><td>${si ?? ''}</td>
      <td></td><td></td><td></td><td></td><td></td>
      <td style="font-weight:700;font-size:10px;border-left:2px solid #000;border-right:2px solid #000">${hole.n}</td>
      <td></td><td></td><td></td><td></td><td></td>
      <td>${si ?? ''}</td><td style="font-weight:700">${par}</td><td>${dist(hole.D)}</td>
    </tr>`;
    if (i === front.length - 1)
      r += `<tr class="or">
        <td>${dist(fD)}</td><td>${fP}</td><td></td><td></td><td></td><td></td><td></td><td></td>
        <td style="border-left:2px solid #000;border-right:2px solid #000">Out</td>
        <td></td><td></td><td></td><td></td><td></td><td></td><td>${fP}</td><td>${dist(fD)}</td>
      </tr>`;
  });

  r += `
  <tr class="sr"><td>${dist(bD)}</td><td>${bP}</td><td></td><td></td><td></td><td></td><td></td><td></td>
    <td style="border-left:2px solid #000;border-right:2px solid #000">In</td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td>${bP}</td><td>${dist(bD)}</td></tr>
  <tr class="sr"><td>${dist(fD)}</td><td>${fP}</td><td></td><td></td><td></td><td></td><td></td><td></td>
    <td style="border-left:2px solid #000;border-right:2px solid #000">Out</td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td>${fP}</td><td>${dist(fD)}</td></tr>
  <tr class="sr"><td style="font-weight:700">${dist(totD)}</td><td style="font-weight:700">${tot}</td>
    <td></td><td></td><td></td><td></td><td></td><td></td>
    <td style="font-weight:700;border-left:2px solid #000;border-right:2px solid #000">Total</td>
    <td></td><td></td><td></td><td></td><td></td><td></td>
    <td style="font-weight:700">${tot}</td><td style="font-weight:700">${dist(totD)}</td></tr>
  <tr class="fr">
    <td colspan="2" style="font-weight:700">${sr}</td><td></td><td></td><td></td><td></td><td></td>
    <td style="font-size:7px;font-weight:700">HCP</td>
    <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  <tr class="fr">
    <td style="font-weight:700;text-align:left;padding-left:2px">Slope</td>
    <td>${sl}</td><td></td><td></td><td></td><td></td><td></td>
    <td style="font-size:7px;font-weight:700">Nett</td>
    <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
    <td style="font-weight:700;text-align:right;padding-right:2px">Slope</td></tr>
  <tr class="sig">
    <td colspan="8" style="border-right:2px solid #000;text-align:left;padding-left:4px;height:22px">Player:</td>
    <td colspan="1" style="border-left:2px solid #000;border-right:2px solid #000"></td>
    <td colspan="8" style="text-align:left;padding-left:4px">Marker:</td></tr>`;
  return r;
}


// ════════════════════════════════════════════════════════
// LANDSCAPE HEADER BUILDER
// ════════════════════════════════════════════════════════

/**
 * Build the header block for landscape cards
 * @param {string} mode - '2ball' | '4ball' | 'social'
 */
function lsHdr(mode, date, time, ftime, tee, comp, memno, group, sr, sl, players) {
  const nP = mode === '4ball' ? 4 : 2;
  const pNames = ['A','B','C','D'].slice(0, nP);

  let h = `<table style="width:100%;border-collapse:collapse;font-size:8px;border:1px solid #000;margin-bottom:3px">
  <tr style="border-bottom:1px solid #000">
    <td style="padding:2px 4px;border-right:1px solid #000;font-weight:700">DATE:&nbsp;<span style="font-weight:400">${date}</span></td>
    <td style="padding:2px 4px;border-right:1px solid #000;font-weight:700">START TIME:&nbsp;<span style="font-weight:400">${time}</span></td>
    <td style="padding:2px 4px;border-right:1px solid #000;font-weight:700">FINISH TIME:&nbsp;<span style="font-weight:400">${ftime}</span></td>
    <td style="padding:2px 4px;font-weight:700">GROUP NO:&nbsp;<span style="font-weight:400">${group}</span></td>
  </tr>
  <tr style="border-bottom:1px solid #000">
    <td style="padding:2px 4px;border-right:1px solid #000;font-weight:700">Member No.&nbsp;<span style="font-weight:400">${memno}</span></td>
    <td colspan="2" style="padding:2px 4px;border-right:1px solid #000;font-weight:700">EVENT:&nbsp;<span style="font-weight:400">${comp}</span></td>
    <td style="padding:2px 4px">
      <span style="font-weight:700">H'cap</span>&nbsp;
      <span style="color:#1a6b3a;font-weight:700">${players[0]?.daily ?? ''}</span>&nbsp;&nbsp;
      <span style="font-weight:700">SCR</span>&nbsp;${sr}&nbsp;&nbsp;
      <span style="font-weight:700">Singles</span>&nbsp;&nbsp;&nbsp;
      <span style="font-weight:700">NETT</span>&nbsp;&nbsp;&nbsp;
      <span style="font-weight:700">TEAM</span>
    </td>
  </tr>`;

  pNames.forEach((pn, i) => {
    const p = players[i] || {};
    const isLast = i === pNames.length - 1;
    h += `<tr${isLast ? '' : ' style="border-bottom:1px solid #000"'}>
      <td colspan="2" style="padding:2px 4px;border-right:1px solid #000">
        <b>Player ${pn}:</b>&nbsp;${p.name || ''}
      </td>
      <td colspan="2" style="padding:2px 4px">
        <span style="font-weight:700">H/C</span>&nbsp;<span style="color:#1a6b3a;font-weight:700">${p.daily ?? ''}</span>&nbsp;&nbsp;
        <span style="font-weight:700">Golflink</span>&nbsp;${p.gl || ''}
      </td>
    </tr>`;
  });

  return h + `</table>`;
}


// ════════════════════════════════════════════════════════
// LANDSCAPE TABLE BUILDER
// ════════════════════════════════════════════════════════

function lsTbl(front, back, idx, g1, fP, bP, fD, bD, sr, sl, mode) {
  const tot = fP + bP, totD = fD + bD;
  const pCols = mode === '4ball' ? ['A','B','C','D'] : ['A','B'];
  const nP = pCols.length;
  const leftSpan  = 4 + nP + 1;
  const rightSpan = nP + 1 + 3;

  let r = `<tr style="font-size:8px;font-weight:700;background:#eee">
    <td colspan="${leftSpan}" style="text-align:center;border-right:2px solid #000;border-bottom:1px solid #000;padding:2px">${v('d_course')}&nbsp;&nbsp;Player:</td>
    <td style="border-left:2px solid #000;border-right:2px solid #000;writing-mode:vertical-rl;text-align:center;font-size:7px;font-weight:700;background:#ddd;padding:1px 0" rowspan="2">R<br>E<br>S<br>U<br>L<br>T</td>
    <td colspan="${rightSpan}" style="text-align:center;border-left:2px solid #000;border-bottom:1px solid #000;padding:2px">Marker:&nbsp;&nbsp;${v('d_course')}</td>
  </tr>
  <tr>
    <th style="font-size:7px">HOLE</th>
    <th style="font-size:7px">${distLbl()}</th>
    <th style="font-size:7px">Par</th>
    <th style="font-size:7px">Index</th>
    ${pCols.map(p => `<th>${p}</th>`).join('')}
    <th style="font-size:7px;border-right:2px solid #000">Result</th>
    ${pCols.map(p => `<th>${p}</th>`).join('')}
    <th style="font-size:7px">Result</th>
    <th style="font-size:7px">Index</th>
    <th style="font-size:7px">Par</th>
    <th style="font-size:7px">${distLbl()}</th>
  </tr>`;

  [...front, ...back].forEach((hole, i) => {
    const par = getPar(hole, g1), si = getSI(hole, idx);
    r += `<tr class="hr">
      <td style="font-weight:700;text-align:center">${hole.n}</td>
      <td>${dist(hole.D)}</td>
      <td style="font-weight:700">${par}</td>
      <td>${si ?? ''}</td>
      ${pCols.map(() => '<td></td>').join('')}
      <td style="border-right:2px solid #000"></td>
      <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
      ${pCols.map(() => '<td></td>').join('')}
      <td></td>
      <td>${si ?? ''}</td>
      <td style="font-weight:700">${par}</td>
      <td>${dist(hole.D)}</td>
    </tr>`;
    if (i === front.length - 1) {
      r += `<tr class="or">
        <td colspan="${leftSpan}" style="font-weight:700;text-align:right;padding-right:6px;border-right:2px solid #000">OUT ${dist(fD)} / ${fP}</td>
        <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
        <td colspan="${rightSpan}" style="font-weight:700;text-align:left;padding-left:6px;border-left:2px solid #000">IN ${dist(bD)}</td>
      </tr>`;
    }
  });

  const sumRow = (lbl, ld, rd) => `<tr class="sr">
    <td colspan="${leftSpan}" style="font-weight:700;text-align:right;padding-right:6px;border-right:2px solid #000">${lbl} ${ld}</td>
    <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
    <td colspan="${rightSpan}" style="font-weight:700;text-align:left;padding-left:6px;border-left:2px solid #000">${rd}</td>
  </tr>`;

  r += sumRow('IN',  `${dist(bD)} / ${bP}`, `${dist(bD)}`);
  r += sumRow('OUT', `${dist(fD)} / ${fP}`, `${dist(fD)}`);
  r += sumRow('TOT', `${dist(totD)} / ${tot}`, `${dist(totD)} / ${tot}`);

  r += `<tr class="sig">
    <td colspan="${leftSpan}" style="border-right:2px solid #000;padding:2px 4px;height:22px">
      <b>Player A Signature:</b><span style="border-bottom:1px solid #000;display:inline-block;min-width:120px">&nbsp;</span>
    </td>
    <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
    <td colspan="${rightSpan}" style="border-left:2px solid #000;padding:2px 4px">
      <b>Player B Signature:</b><span style="border-bottom:1px solid #000;display:inline-block;min-width:80px">&nbsp;</span>&nbsp;&nbsp;
      <b>Marker:</b><span style="border-bottom:1px solid #000;display:inline-block;min-width:80px">&nbsp;</span>
    </td>
  </tr>
  <tr class="fr">
    <td colspan="2" style="font-weight:700;border-right:1px solid #000">${sr}</td>
    <td colspan="${leftSpan - 2}" style="font-weight:700;text-align:right;padding-right:6px;border-right:2px solid #000">HANDICAP</td>
    <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
    <td colspan="${rightSpan - 1}" style="border-left:2px solid #000;padding-left:4px;font-size:7px">ACR:&nbsp;${v('d_course')}&nbsp;&nbsp;&nbsp;AWCR:&nbsp;${v('d_course')}</td>
    <td style="font-weight:700;text-align:right;padding-right:2px">Slope</td>
  </tr>
  <tr class="fr">
    <td style="font-weight:700;text-align:left;padding-left:2px">Slope</td>
    <td>${sl}</td>
    <td colspan="${leftSpan - 2}" style="font-weight:700;text-align:right;padding-right:6px;border-right:2px solid #000">NETT SCORE</td>
    <td style="border-left:2px solid #000;border-right:2px solid #000"></td>
    <td colspan="${rightSpan}" style="border-left:2px solid #000"></td>
  </tr>`;

  return r;
}


// ════════════════════════════════════════════════════════
// CARD SWITCHER
// ════════════════════════════════════════════════════════

let cur = 'mp2';

/**
 * Switch the active card and re-render
 * @param {string} id - Card ID (mp2, mp4, sp1, sp2, sp2m, sp4a, fours, ls2, ls4, lssoc)
 */
function show(id) {
  cur = id;
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
  const card = el('card_' + id); if (card) card.classList.add('active');
  document.querySelectorAll('.tb:not(.pr)').forEach(b => {
    const ids = ['mp2','mp4','sp1','sp2','sp2m','sp4a','fours','ls2','ls4','lssoc'];
    b.classList.toggle('active', ids.some(x => x === id && b.textContent.trim() ===
      ({ mp2:'2-Ball', mp4:'4-Ball', sp1:'Single', sp2:'2-Player', sp2m:'Mixed Index',
         sp4a:'Ambrose/4-Ball', fours:'Foursomes', ls2:'2-Ball', ls4:'4-Ball', lssoc:'Social' }[id])));
  });
  upd();
}


// ════════════════════════════════════════════════════════
// MAIN UPDATE FUNCTION
// Called whenever any dashboard input changes
// Recalculates everything and re-renders all cards
// ════════════════════════════════════════════════════════

function upd() {
  const tkey = v('d_tee'), td = TEE[tkey] || TEE.Blue || TEE[Object.keys(TEE)[0]];
  if (!td) return;
  const idx = v('d_idx'), h19 = v('d_h19'), sh = v('d_start');
  const gs = [v('p1g'), v('p2g'), v('p3g'), v('p4g')];
  const g1 = gs[0];
  const { front, back } = getSeq(td, h19, sh);
  const allH = [...front, ...back];

  const fP = front.reduce((s, h) => s + getPar(h, g1), 0);
  const bP = back.reduce((s,  h) => s + getPar(h, g1), 0);
  const fD = front.reduce((s, h) => s + h.D, 0);
  const bD = back.reduce((s,  h) => s + h.D, 0);
  const totalPar = fP + bP, totalDist = fD + bD;
  const sr1 = g1 === 'F' ? td.SR_F : td.SR_M;
  const sl1 = g1 === 'F' ? td.SL_F : td.SL_M;

  s('d_sr', sr1); s('d_sl', sl1); s('d_par', totalPar);

  // Shotgun start note
  const noteEl = el('d_start_note');
  if (noteEl) {
    if (parseInt(sh) > 1) {
      noteEl.style.display = 'block';
      noteEl.textContent = '⛳ Shotgun: ' + allH.map(h => h.n).join(' → ');
    } else {
      noteEl.style.display = 'none';
    }
  }

  // Calculate daily handicaps and shot allocations for all 4 players
  const das = [
    calcDaily(v('p1ga'), gs[0], td, totalPar),
    calcDaily(v('p2ga'), gs[1], td, totalPar),
    calcDaily(v('p3ga'), gs[2], td, totalPar),
    calcDaily(v('p4ga'), gs[3], td, totalPar),
  ];
  das.forEach((d, i) => s(`p${i + 1}d`, d ?? '–'));
  const shots = allocate(das);
  shots.forEach((s2, i) => s(`p${i + 1}s`, s2 ?? '–'));

  const [sh1, sh2, sh3, sh4] = shots;
  const date  = fmtDate(v('d_date')), time = v('d_time');
  const tee   = tkey, ftime = v('d_ftime'), group = v('d_group'), memno = v('d_memno');
  const thcVal = das.filter(x => x !== null).reduce((a, b, _, arr) => a + b / arr.length, 0) || 0;
  const thcStr = thcVal ? thcVal.toFixed(1) : '';

  const players = [
    { name: v('p1n'), gl: v('p1gl'), ga: v('p1ga'), daily: das[0], shots: sh1 },
    { name: v('p2n'), gl: v('p2gl'), ga: v('p2ga'), daily: das[1], shots: sh2 },
    { name: v('p3n'), gl: '',        ga: v('p3ga'), daily: das[2], shots: sh3 },
    { name: v('p4n'), gl: '',        ga: v('p4ga'), daily: das[3], shots: sh4 },
  ];

  // Sync comp hidden field if "other" is selected
  const compSel = document.getElementById('d_comp_sel');
  if (compSel && compSel.value === '__other__') {
    document.getElementById('d_comp').value = document.getElementById('d_comp_other').value;
  } else if (compSel && compSel.value !== '__other__') {
    document.getElementById('d_comp').value = compSel.value;
  }
  const comp = v('d_comp');

  // Sync shots-received box colours with current PCOL
  [0,1,2,3].forEach(i => {
    const box = document.getElementById('p' + (i+1) + 's');
    if (box) { box.style.background = PCOL[i]; box.style.borderColor = darkenHex(PCOL[i]); }
  });

  // ── 2-Ball Matchplay ──
  s('m2p1', v('p1n')); s('m2p2', v('p2n'));
  s('m2p1hc', das[0] !== null ? '(' + das[0] + ')' : '');
  s('m2p2hc', das[1] !== null ? '(' + das[1] + ')' : '');

  // Colour-coded shot badges on 2-ball header
  const b1 = document.getElementById('m2p1badge');
  const b2 = document.getElementById('m2p2badge');
  if (b1) { b1.style.background = PCOL[0]; b1.style.color = '#1a2638'; b1.textContent = sh1 !== null ? sh1 + ' shots' : ''; }
  if (b2) { b2.style.background = PCOL[1]; b2.style.color = '#1a2638'; b2.textContent = sh2 !== null ? sh2 + ' shots' : ''; }
  s('m2date', date); s('m2time', time); s('m2tee', tee); s('m2comp', comp);
  el('m2tbl').innerHTML = buildMatchTbl(front, back, [sh1, sh2, null, null], gs, idx, td, false);
  el('m2tbl').style.height = '100%';

  // ── 4-Ball Matchplay ──
  s('m4comp', comp); s('m4tee', tee); s('m4date', date); s('m4time', time);
  el('m4players').innerHTML = players.slice(0, 4).map((p, i) =>
    `<div style="display:flex;align-items:baseline;gap:5px">
      <span style="font-size:12px;font-weight:700">Player</span>
      <span style="font-size:11px;font-weight:700">${p.name || ''}</span>
      <span style="font-size:9px;color:#1a6b3a;font-weight:700">${p.daily !== null ? '(' + p.daily + ')' : ''}</span>
      <span style="flex:1"></span>
      <span style="background:${PCOL[i]};padding:1px 5px;border-radius:2px;font-size:8px;font-weight:700">${p.shots ?? '–'} shots</span>
    </div>`
  ).join('');
  el('m4tbl').innerHTML = buildMatchTbl(front, back, shots, gs, idx, td, true);
  el('m4tbl').style.height = '100%';

  // ── Single Strokeplay ──
  s('sp1p1', v('p1n')); s('sp1hc', das[0] ?? ''); s('sp1gl', v('p1gl'));
  s('sp1date', date); s('sp1time', time); s('sp1tee', tee);
  s('sp1sr', sr1); s('sp1sl', sl1); s('sp1comp', comp);
  el('sp1ltbl').innerHTML = spLeftTbl(front, back, ['Metres','Par','Index','Shots','Player','Marker','TPH'], idx, g1, fP, bP, fD, bD);
  el('sp1grid').innerHTML = spGrid(front, back, null);

  // ── 2-Player Strokeplay (4BBB) ──
  el('sp2p1').innerHTML = `${v('p1n') || '—'}&nbsp;<span style="color:#1a6b3a;font-size:9px">${das[0] ?? ''}</span>&nbsp;<span style="font-size:9px">${v('p1gl')}</span>`;
  el('sp2p2').innerHTML = `${v('p2n') || '—'}&nbsp;<span style="color:#1a6b3a;font-size:9px">${das[1] ?? ''}</span>&nbsp;<span style="font-size:9px">${v('p2gl')}</span>`;
  s('sp2date', date); s('sp2par', totalPar); s('sp2sr', sr1); s('sp2sl', sl1);
  s('sp2comp', comp); s('sp2tee', tee); s('sp2time', time);
  el('sp2ltbl').innerHTML = spLeftTbl(front, back, ['Metres','Par','Index','P1','P2','Result','MK1','MK2','Result'], idx, g1, fP, bP, fD, bD);
  el('sp2grid').innerHTML = spGrid(front, back, 'P2');

  // ── Mixed Index ──
  s('sp2mc', comp); s('sp2mdate', date); s('sp2msr', sr1); s('sp2msl', sl1);
  s('sp2mtee', tee); s('sp2mtime', time);
  el('sp2mp1').innerHTML = `${v('p1n') || '—'}&nbsp;<span style="font-size:9px">${v('p1gl')}</span>&nbsp;<b style="color:#1a6b3a;font-size:9px">${das[0] ?? ''}</b>`;
  el('sp2mp2').innerHTML = `${v('p2n') || '—'}&nbsp;<span style="font-size:9px">${v('p2gl')}</span>&nbsp;<b style="color:#1a6b3a;font-size:9px">${das[1] ?? ''}</b>`;
  el('sp2mltbl').innerHTML = spLeftTbl(front, back, ['Par','Index Mens','Index Ladies','P1','P2','Result','MK1','MK2','Result'], idx, g1, fP, bP, fD, bD);
  el('sp2mgrid').innerHTML = spGrid(front, back, 'P2');

  // ── Ambrose / 4-Ball Strokeplay ──
  s('sp4ac', comp); s('sp4ast', sh); s('sp4ad', date); s('sp4at', time); s('sp4ath', thcStr);
  el('sp4aplayers').innerHTML = players.map((p, i) =>
    `<div>${i + 1}&nbsp;${p.name || '—'}&nbsp;<b style="color:#1a6b3a">${p.daily ?? ''}</b>&nbsp;<span style="color:#888">${p.gl || ''}</span></div>`
  ).join('');
  el('sp4atbl').innerHTML = sp4Tbl(front, back, idx, g1, fP, bP, fD, bD, sr1, sl1);

  // ── Foursomes ──
  s('foc', comp); s('fopar', totalPar); s('fodist', dist(totalDist)); s('fothc', thcStr);
  s('fodate', date); s('fosr', sr1); s('fosl', sl1); s('fotee', tee); s('fotime', time);
  el('fop1').innerHTML = `${v('p1n') || '—'}&nbsp;<span style="font-size:9px">${v('p1gl')}</span>&nbsp;<b style="color:#1a6b3a;font-size:9px">${das[0] ?? ''}</b>`;
  el('fop2').innerHTML = `${v('p2n') || '—'}&nbsp;<span style="font-size:9px">${v('p2gl')}</span>&nbsp;<b style="color:#1a6b3a;font-size:9px">${das[1] ?? ''}</b>`;
  el('foltbl').innerHTML = spLeftTbl(front, back, ['Metres','Par','Index','Player','Marker'], idx, g1, fP, bP, fD, bD);
  el('fogrid').innerHTML = spGrid(front, back, null);

  // ── Landscape Cards ──
  const lsArgs = [date, time, ftime, tee, comp, memno, group, sr1, sl1, players];
  el('ls2hdr').innerHTML   = lsHdr('2ball',  ...lsArgs);
  el('ls2tbl').innerHTML   = lsTbl(front, back, idx, g1, fP, bP, fD, bD, sr1, sl1, '2ball');
  el('ls4hdr').innerHTML   = lsHdr('4ball',  ...lsArgs);
  el('ls4tbl').innerHTML   = lsTbl(front, back, idx, g1, fP, bP, fD, bD, sr1, sl1, '4ball');
  el('lssochdr').innerHTML = lsHdr('social', ...lsArgs);
  el('lssoctbl').innerHTML = lsTbl(front, back, idx, g1, fP, bP, fD, bD, sr1, sl1, 'social');
}

// Initial render on page load
// Apply default colours to shots boxes and pickers
PCOL_DEFAULTS.forEach((c, i) => {
  const box = document.getElementById('p' + (i+1) + 's');
  if (box) { box.style.background = c; box.style.borderColor = darkenHex(c); }
  const picker = document.getElementById('pcol' + (i+1));
  if (picker) picker.value = c;
});
upd();
