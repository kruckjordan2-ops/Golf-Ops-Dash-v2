/* ─────────────────────────────────────────────────────────────────────────────
   VGC Data Manager — Core Application Logic
   CSV parsing, auto-detection, UI controller
   ───────────────────────────────────────────────────────────────────────────── */

// ═══════════════════════════════════════════════════════════════════════════════
//  TOOL REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

var TOOLS = {
  'booking-analysis': {
    name: 'Booking Analysis',
    desc: 'Transaction-level booking data from MiClub',
    columns: 'Event Date, Tee Time, Name, Category, Gender, Comp, Checked In',
    parser: BookingAnalysisParser,
    status: 'supported',
    icon: '\uD83D\uDCCA',
  },
  'competition-data': {
    name: 'Competition Data',
    desc: 'Member comp & social participation by quarter',
    columns: 'Membership #, Name, Category, Age, Rounds',
    parser: CompetitionDataParser,
    status: 'supported',
    icon: '\uD83C\uDFC6',
  },
  'pace-of-play': {
    name: 'Pace of Play',
    desc: 'Round times from GPS app & scorecard exports',
    columns: 'Participant, Round Time (HH:MM)',
    parser: PaceOfPlayParser,
    status: 'supported',
    icon: '\u23F1',
  },
  'rounds-dashboard': {
    name: 'Rounds Dashboard',
    desc: 'Multi-year rounds tracking from master spreadsheet',
    columns: 'Complex multi-sheet Excel',
    status: 'coming-soon',
    icon: '\u26F3',
  },
  'member-lookup': {
    name: 'Member Lookup',
    desc: 'Merged MiClub + Golf Genius member data',
    columns: 'Merged from two systems',
    status: 'coming-soon',
    icon: '\uD83D\uDC65',
  },
  'sales-dashboard': {
    name: 'Sales Dashboard',
    desc: 'POS transaction and spend data',
    columns: 'SwiftPOS export',
    status: 'coming-soon',
    icon: '\uD83D\uDCB0',
  },
  'scorecard-generator': {
    name: 'Scorecard Generator',
    desc: 'Course tee and hole data',
    columns: 'Static tee configuration',
    status: 'coming-soon',
    icon: '\uD83C\uDFCC',
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
//  CSV PARSER
// ═══════════════════════════════════════════════════════════════════════════════

function parseCSV(text) {
  text = text.trim();
  if (!text) return { headers: [], rows: [] };

  // Auto-detect delimiter: if first line has tabs, use tab; otherwise comma
  var firstLine = text.split('\n')[0];
  var delimiter = firstLine.indexOf('\t') !== -1 ? '\t' : ',';

  var lines = splitCSVLines(text);
  if (lines.length < 2) return { headers: [], rows: [] };

  var headers = splitCSVRow(lines[0], delimiter).map(function(h) {
    return h.trim().replace(/^["']|["']$/g, '');
  });

  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var values = splitCSVRow(line, delimiter);
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = j < values.length ? values[j].trim().replace(/^["']|["']$/g, '') : '';
    }
    rows.push(row);
  }

  return { headers: headers, rows: rows };
}

function splitCSVLines(text) {
  // Split by newlines, respecting quoted fields that contain newlines
  var lines = [];
  var current = '';
  var inQuote = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function splitCSVRow(line, delimiter) {
  var fields = [];
  var current = '';
  var inQuote = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === delimiter && !inQuote) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  AUTO-DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

function detectTool(headers) {
  var normalised = headers.map(function(h) {
    return h.trim().replace(/\.$/, '').toLowerCase();
  });

  var results = [];

  for (var toolId in TOOLS) {
    var tool = TOOLS[toolId];
    if (tool.status !== 'supported' || !tool.parser) continue;

    var reqCols = tool.parser.requiredColumns || [];
    var altCols = tool.parser.altColumns || {};
    var matched = 0;
    var matchedNames = [];
    var missing = [];

    reqCols.forEach(function(reqCol) {
      var reqNorm = reqCol.toLowerCase();
      var found = normalised.some(function(h) { return h === reqNorm || h.includes(reqNorm); });

      // Check alternatives
      if (!found && altCols[reqCol]) {
        found = altCols[reqCol].some(function(alt) {
          var altNorm = alt.toLowerCase();
          return normalised.some(function(h) { return h === altNorm || h.includes(altNorm); });
        });
      }

      if (found) { matched++; matchedNames.push(reqCol); }
      else { missing.push(reqCol); }
    });

    var confidence = reqCols.length > 0 ? matched / reqCols.length : 0;

    results.push({
      toolId: toolId,
      name: tool.name,
      confidence: confidence,
      matched: matchedNames,
      missing: missing,
    });
  }

  results.sort(function(a, b) { return b.confidence - a.confidence; });
  return results;
}


// ═══════════════════════════════════════════════════════════════════════════════
//  UI STATE
// ═══════════════════════════════════════════════════════════════════════════════

var STATE = {
  parsed: null,         // { headers, rows }
  selectedTool: null,   // tool ID
  result: null,         // { data, stats, warnings }
  jsContent: null,      // generated JS string

  // Competition-specific: two-paste mode
  compPasteMode: false,
  compData: null,
  socialData: null,
  compActiveTab: 'comp',
};


// ═══════════════════════════════════════════════════════════════════════════════
//  UI CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

function init() {
  var textarea = document.getElementById('pasteArea');
  var fileInput = document.getElementById('fileInput');

  // Paste / input events
  textarea.addEventListener('input', onDataInput);
  textarea.addEventListener('paste', function() {
    setTimeout(onDataInput, 50); // let paste complete
  });

  // File upload
  document.getElementById('uploadLink').addEventListener('click', function(e) {
    e.preventDefault();
    fileInput.click();
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files.length) {
      var reader = new FileReader();
      reader.onload = function(e) {
        textarea.value = e.target.result;
        onDataInput();
      };
      reader.readAsText(fileInput.files[0]);
    }
  });

  // Clear button
  document.getElementById('btnClear').addEventListener('click', function() {
    textarea.value = '';
    resetAll();
  });

  // Process button
  document.getElementById('btnProcess').addEventListener('click', processData);

  // Export buttons
  document.getElementById('btnDownload').addEventListener('click', downloadResult);
  document.getElementById('btnCopy').addEventListener('click', copyResult);

  // Preview toggle
  document.getElementById('previewToggle').addEventListener('click', function() {
    var el = document.getElementById('previewJson');
    el.classList.toggle('hidden');
    this.textContent = el.classList.contains('hidden') ? '\u25B6 Show JSON preview' : '\u25BC Hide JSON preview';
  });

  // Build target cards
  buildTargetCards();
}

function buildTargetCards() {
  var grid = document.getElementById('targetGrid');
  grid.innerHTML = '';

  for (var toolId in TOOLS) {
    var tool = TOOLS[toolId];
    var card = document.createElement('div');
    card.className = 'target-card' + (tool.status !== 'supported' ? ' disabled' : '');
    card.dataset.toolId = toolId;

    var badge = tool.status === 'supported'
      ? '<span class="tc-badge tc-badge--supported">Supported</span>'
      : '<span class="tc-badge tc-badge--soon">Coming Soon</span>';

    card.innerHTML =
      badge +
      '<div class="tc-name">' + tool.icon + ' ' + tool.name + '</div>' +
      '<div class="tc-desc">' + tool.columns + '</div>';

    if (tool.status === 'supported') {
      card.addEventListener('click', (function(id) {
        return function() { selectTool(id); };
      })(toolId));
    }

    grid.appendChild(card);
  }
}

function onDataInput() {
  var text = document.getElementById('pasteArea').value;

  if (!text.trim()) {
    resetAll();
    return;
  }

  // Parse CSV
  STATE.parsed = parseCSV(text);

  // Update paste info
  var rowCount = STATE.parsed.rows.length;
  var colCount = STATE.parsed.headers.length;
  document.getElementById('rowCount').textContent = rowCount.toLocaleString();
  document.getElementById('colCount').textContent = colCount;
  document.getElementById('pasteInfo').classList.remove('hidden');

  // Mark step 1 done
  document.getElementById('step1Num').classList.add('done');
  document.getElementById('step1Num').textContent = '\u2713';

  // Show step 2
  document.getElementById('step2').classList.remove('hidden');

  // Auto-detect
  if (rowCount > 0 && colCount > 0) {
    var detections = detectTool(STATE.parsed.headers);
    if (detections.length > 0 && detections[0].confidence >= 0.5) {
      var best = detections[0];
      showDetection(best);
      selectTool(best.toolId);
    } else {
      hideDetection();
      STATE.selectedTool = null;
      updateTargetCards();
      document.getElementById('btnProcess').disabled = true;
    }
  }
}

function showDetection(det) {
  var bar = document.getElementById('detectBar');
  var pct = Math.round(det.confidence * 100);
  bar.innerHTML =
    '<span class="detect-icon">\u2705</span> ' +
    'Detected: <strong>' + det.name + '</strong> &mdash; ' +
    pct + '% column match (' + det.matched.length + '/' + (det.matched.length + det.missing.length) + ' columns)';
  if (det.missing.length) {
    bar.innerHTML += ' <span style="opacity:.7">&middot; Missing: ' + det.missing.join(', ') + '</span>';
  }
  bar.classList.remove('hidden');
}

function hideDetection() {
  document.getElementById('detectBar').classList.add('hidden');
}

function selectTool(toolId) {
  STATE.selectedTool = toolId;
  updateTargetCards();

  // Enable process button
  document.getElementById('btnProcess').disabled = false;

  // Mark step 2 done
  document.getElementById('step2Num').classList.add('done');
  document.getElementById('step2Num').textContent = '\u2713';

  // Show/hide competition tabs
  var compTabs = document.getElementById('compTabs');
  if (toolId === 'competition-data') {
    compTabs.classList.remove('hidden');
  } else {
    compTabs.classList.add('hidden');
  }

  // Show step 3
  document.getElementById('step3').classList.remove('hidden');
}

function updateTargetCards() {
  var cards = document.querySelectorAll('.target-card');
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    card.classList.remove('active');
    if (card.dataset.toolId === STATE.selectedTool) {
      card.classList.add('active');
      // Update badge to "Detected"
      var badge = card.querySelector('.tc-badge');
      if (badge && STATE.selectedTool) {
        badge.className = 'tc-badge tc-badge--detected';
        badge.textContent = 'Selected';
      }
    } else {
      var badge = card.querySelector('.tc-badge');
      if (badge && !card.classList.contains('disabled')) {
        badge.className = 'tc-badge tc-badge--supported';
        badge.textContent = 'Supported';
      }
    }
  }
}

function resetAll() {
  STATE.parsed = null;
  STATE.selectedTool = null;
  STATE.result = null;
  STATE.jsContent = null;

  document.getElementById('pasteInfo').classList.add('hidden');
  document.getElementById('step1Num').classList.remove('done');
  document.getElementById('step1Num').textContent = '1';
  document.getElementById('step2').classList.add('hidden');
  document.getElementById('step2Num').classList.remove('done');
  document.getElementById('step2Num').textContent = '2';
  document.getElementById('step3').classList.add('hidden');
  document.getElementById('step3Num').classList.remove('done');
  document.getElementById('step3Num').textContent = '3';
  document.getElementById('step4').classList.add('hidden');
  document.getElementById('step4Num').classList.remove('done');
  document.getElementById('step4Num').textContent = '4';

  hideDetection();
  document.getElementById('compTabs').classList.add('hidden');
  document.getElementById('resultsArea').classList.add('hidden');
  document.getElementById('progressWrap').classList.add('hidden');
  document.getElementById('btnProcess').disabled = true;
  buildTargetCards();
}


// ═══════════════════════════════════════════════════════════════════════════════
//  PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

function processData() {
  if (!STATE.parsed || !STATE.selectedTool) return;

  var tool = TOOLS[STATE.selectedTool];
  if (!tool || !tool.parser) return;

  // Show progress
  var progressWrap = document.getElementById('progressWrap');
  var progressBar = document.getElementById('progressBar');
  progressWrap.classList.remove('hidden');
  progressBar.style.width = '30%';

  // Process in next tick to let UI update
  setTimeout(function() {
    progressBar.style.width = '70%';

    try {
      var result;

      if (STATE.selectedTool === 'competition-data' && STATE.compData && STATE.socialData) {
        // Two-paste mode for competition
        result = tool.parser.process(
          STATE.compData.headers,
          STATE.compData.rows,
          { compRows: STATE.compData.rows, socialRows: STATE.socialData.rows }
        );
      } else {
        result = tool.parser.process(STATE.parsed.headers, STATE.parsed.rows);
      }

      STATE.result = result;
      STATE.jsContent = tool.parser.generateJS(result.data);

      progressBar.style.width = '100%';
      setTimeout(function() { progressWrap.classList.add('hidden'); }, 500);

      showResults(result);

    } catch (err) {
      progressWrap.classList.add('hidden');
      showError('Processing failed: ' + err.message);
    }
  }, 100);
}

function showResults(result) {
  var area = document.getElementById('resultsArea');
  area.classList.remove('hidden');

  // Stats
  var statsRow = document.getElementById('statsRow');
  statsRow.innerHTML = '';
  var stats = result.stats;
  for (var key in stats) {
    var box = document.createElement('div');
    box.className = 'stat-box';
    var label = key.replace(/([A-Z])/g, ' $1').replace(/^./, function(s) { return s.toUpperCase(); });
    box.innerHTML = '<div class="stat-val">' + (typeof stats[key] === 'number' ? stats[key].toLocaleString() : stats[key]) + '</div>' +
                    '<div class="stat-lbl">' + label + '</div>';
    statsRow.appendChild(box);
  }

  // Warnings
  var warningsEl = document.getElementById('warnings');
  warningsEl.innerHTML = '';
  if (result.warnings && result.warnings.length) {
    result.warnings.forEach(function(w) {
      var div = document.createElement('div');
      div.className = 'warning-item';
      div.innerHTML = '<span class="wi-icon">\u26A0</span> ' + w;
      warningsEl.appendChild(div);
    });
  }

  // JSON preview
  var preview = document.getElementById('previewJson');
  try {
    var previewStr = JSON.stringify(result.data, null, 2);
    if (previewStr.length > 5000) {
      previewStr = previewStr.substring(0, 5000) + '\n\n... (' + (STATE.jsContent.length / 1024).toFixed(0) + ' KB total)';
    }
    preview.textContent = previewStr;
  } catch(e) {
    preview.textContent = 'Preview unavailable';
  }

  // Mark step 3 done
  document.getElementById('step3Num').classList.add('done');
  document.getElementById('step3Num').textContent = '\u2713';

  // Show step 4
  document.getElementById('step4').classList.remove('hidden');
  document.getElementById('step4Num').classList.add('done');
  document.getElementById('step4Num').textContent = '4';

  // Update export info
  var tool = TOOLS[STATE.selectedTool];
  var parser = tool.parser;
  var fileName = parser.exportFileName || parser.fileName || 'data.js';
  var toolPath = parser.toolPath || 'tools/' + STATE.selectedTool + '/';
  var sizeKB = (STATE.jsContent.length / 1024).toFixed(0);

  document.getElementById('exportInfo').innerHTML =
    '<strong>File:</strong> <code>' + fileName + '</code> (' + sizeKB + ' KB)<br>' +
    '<strong>Place in:</strong> <code>' + toolPath + '</code> replacing the existing <code>' + (parser.fileName || 'data.js') + '</code><br>' +
    '<strong>Also copy to:</strong> <code>data/exports/' + fileName + '</code> if applicable';
}

function showError(msg) {
  var area = document.getElementById('resultsArea');
  area.classList.remove('hidden');
  document.getElementById('statsRow').innerHTML =
    '<div class="stat-box" style="background:var(--red-lt);"><div class="stat-val" style="color:var(--red);">\u2717</div><div class="stat-lbl" style="color:var(--red);">Error</div></div>';
  document.getElementById('warnings').innerHTML =
    '<div class="warning-item" style="background:var(--red-lt);border-color:rgba(139,26,26,.2);color:var(--red);">' +
    '<span class="wi-icon">\u274C</span> ' + msg + '</div>';
}


// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function downloadResult() {
  if (!STATE.jsContent) return;

  var tool = TOOLS[STATE.selectedTool];
  var parser = tool.parser;
  var fileName = parser.fileName || 'data.js';

  var blob = new Blob([STATE.jsContent], { type: 'application/javascript' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyResult() {
  if (!STATE.jsContent) return;

  navigator.clipboard.writeText(STATE.jsContent).then(function() {
    var fb = document.getElementById('copyFeedback');
    fb.classList.add('show');
    fb.textContent = 'Copied to clipboard!';
    setTimeout(function() { fb.classList.remove('show'); }, 2000);
  }).catch(function() {
    // Fallback
    var ta = document.createElement('textarea');
    ta.value = STATE.jsContent;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    var fb = document.getElementById('copyFeedback');
    fb.classList.add('show');
    fb.textContent = 'Copied!';
    setTimeout(function() { fb.classList.remove('show'); }, 2000);
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
//  COMPETITION TWO-PASTE MODE
// ═══════════════════════════════════════════════════════════════════════════════

function initCompTabs() {
  document.getElementById('tabComp').addEventListener('click', function() {
    STATE.compActiveTab = 'comp';
    updateCompTabs();
    // Load comp data into textarea if we have it
    if (STATE.compData) {
      document.getElementById('pasteArea').value = STATE.compData.raw || '';
    }
  });

  document.getElementById('tabSocial').addEventListener('click', function() {
    STATE.compActiveTab = 'social';
    updateCompTabs();
    // Load social data into textarea if we have it
    if (STATE.socialData) {
      document.getElementById('pasteArea').value = STATE.socialData.raw || '';
    }
  });

  document.getElementById('tabCombined').addEventListener('click', function() {
    STATE.compActiveTab = 'combined';
    STATE.compData = null;
    STATE.socialData = null;
    updateCompTabs();
  });
}

function updateCompTabs() {
  var tabs = document.querySelectorAll('.comp-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('tab' + STATE.compActiveTab.charAt(0).toUpperCase() + STATE.compActiveTab.slice(1)).classList.add('active');

  // Update dots
  var compDot = document.querySelector('#tabComp .tab-dot');
  var socialDot = document.querySelector('#tabSocial .tab-dot');
  if (compDot) compDot.className = 'tab-dot ' + (STATE.compData ? 'has-data' : 'no-data');
  if (socialDot) socialDot.className = 'tab-dot ' + (STATE.socialData ? 'has-data' : 'no-data');
}

function saveCompTab() {
  if (STATE.selectedTool !== 'competition-data') return;
  var text = document.getElementById('pasteArea').value;
  if (!text.trim()) return;

  var parsed = parseCSV(text);
  if (STATE.compActiveTab === 'comp') {
    STATE.compData = { headers: parsed.headers, rows: parsed.rows, raw: text };
  } else if (STATE.compActiveTab === 'social') {
    STATE.socialData = { headers: parsed.headers, rows: parsed.rows, raw: text };
  }
  updateCompTabs();
}


// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  init();
  initCompTabs();
});
