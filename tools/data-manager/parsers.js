/* ─────────────────────────────────────────────────────────────────────────────
   VGC Data Manager — Parsers
   JS ports of generate_bookings.py, generate_competition.py, generate_pace.py
   ───────────────────────────────────────────────────────────────────────────── */

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED: Category mapping (used by booking + competition parsers)
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_GROUP = {
  "Full Member":                        "Full Member",
  "Ordinary Member":                    "Full Member",
  "Ordinary Member.":                   "Full Member",
  "Life Member":                        "Full Member",
  "Life Member.":                       "Full Member",
  "Honorary Member":                    "Honorary",
  "Honorary Club Pro":                  "Honorary",
  "Honorary Other":                     "Honorary",
  "Honorary - Other":                   "Honorary",
  "Honorary - Club Professional":       "Honorary",
  "Senior Full Member":                 "Senior",
  "Senior Ordinary Member":             "Senior",
  "Senior Ordinary Member.":            "Senior",
  "Veteran Full Member":                "Veteran",
  "Veteran Full Member.":               "Veteran",
  "Veteran Ordinary Member":            "Veteran",
  "Veteran Ordinary Member.":           "Veteran",
  "Country Full Member":                "Country",
  "Country Ordinary Member":            "Country",
  "Country Ordinary Member.":           "Country",
  "Interstate Full Member":             "Interstate/Overseas",
  "Interstate Ordinary Member":         "Interstate/Overseas",
  "Overseas Full Member":               "Interstate/Overseas",
  "Overseas Ordinary Member":           "Interstate/Overseas",
  "Junior Over 21 Full Member":         "Junior",
  "Junior Over 21 Ordinary Member":     "Junior",
  "Junior Under 21 Full Member":        "Junior",
  "Junior Under 21 Ordinary Member":    "Junior",
  "Sub Junior Member":                  "Junior",
  "Sub Junior Member.":                 "Junior",
  "Non Playing Member":                 "Non Playing",
  "Non Playing Member.":                "Non Playing",
  "Non Playing Junior Over 21":         "Non Playing",
  "Non Playing Junior Over 21 Member":  "Non Playing",
  "Social Member":                      "Social/Public",
  "Public Member":                      "Social/Public",
  "Guests":                             "Guest",
  "Visitor":                            "Visitor",
};

function cleanCat(raw) {
  var s = (raw || '').toString().trim().replace(/\.$/, '');
  return CATEGORY_GROUP[s] || CATEGORY_GROUP[s + '.'] || s || 'Unknown';
}

const DOW_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTH_ORDER = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const HOUR_RANGE = [6,7,8,9,10,11,12,13,14,15,16,17,18];

const AGE_BRACKETS = [
  ['Under 30', 0, 29],
  ['30-49', 30, 49],
  ['50-64', 50, 64],
  ['65-79', 65, 79],
  ['80+', 80, 999],
];

function ageBracket(age) {
  for (var i = 0; i < AGE_BRACKETS.length; i++) {
    if (age >= AGE_BRACKETS[i][1] && age <= AGE_BRACKETS[i][2]) return AGE_BRACKETS[i][0];
  }
  return 'Unknown';
}


// ═══════════════════════════════════════════════════════════════════════════════
//  BOOKING ANALYSIS PARSER
//  Port of generate_bookings.py
// ═══════════════════════════════════════════════════════════════════════════════

var BookingAnalysisParser = {

  requiredColumns: ['Event Date', 'Tee Time', 'First Name', 'Last Name',
                    'Membership Number', 'Membership Category', 'Gender',
                    'Played in Comp', 'Checked In'],
  optionalColumns: ['Home Club'],
  globalName: 'BOOKING_DATA',
  fileName: 'data.js',
  exportFileName: 'booking-analysis.data.js',
  toolPath: 'tools/booking-analysis/',

  process: function(headers, rows) {
    var warnings = [];
    var today = new Date().toISOString().slice(0, 10);

    // Normalise column access
    function col(row, name) {
      var v = row[name];
      if (v === undefined) {
        // Try case-insensitive + trimmed
        for (var k in row) {
          if (k.trim().replace(/\.$/, '').toLowerCase() === name.toLowerCase()) return row[k];
        }
      }
      return v === undefined ? '' : v;
    }

    // Parse all rows
    var parsed = [];
    var parseErrors = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var eventDateStr = col(r, 'Event Date').toString().trim();
      var teeTimeStr = col(r, 'Tee Time').toString().trim();

      // Parse date (DD/MM/YYYY or YYYY-MM-DD or D/M/YYYY)
      var eventDate = parseDate(eventDateStr);
      if (!eventDate) { parseErrors++; continue; }

      // Parse tee time hour
      var hour = parseTeeTimeHour(teeTimeStr, eventDateStr);

      var memNum = col(r, 'Membership Number').toString().trim();
      var rawCat = col(r, 'Membership Category').toString().trim().replace(/\.$/, '');
      var catGrp = cleanCat(rawCat);
      var gender = col(r, 'Gender').toString().trim() || 'Unknown';
      var firstName = col(r, 'First Name').toString().trim();
      var lastName = col(r, 'Last Name').toString().trim();
      var playedInComp = toBool(col(r, 'Played in Comp'));
      var checkedIn = toBool(col(r, 'Checked In'));
      var homeClub = col(r, 'Home Club').toString().trim();

      var isVisitor = memNum.toUpperCase().startsWith('VIS') || rawCat === 'Visitor';

      var month = MONTH_ORDER[eventDate.getMonth()];
      var dow = DOW_ORDER[(eventDate.getDay() + 6) % 7]; // JS: 0=Sun, we want Mon=0

      parsed.push({
        month: month, dow: dow, hour: hour,
        catGrp: catGrp, gender: gender,
        playedInComp: playedInComp, checkedIn: checkedIn,
        memNum: memNum, firstName: firstName, lastName: lastName,
        isVisitor: isVisitor, homeClub: homeClub,
      });
    }

    if (parseErrors > 0) {
      warnings.push(parseErrors + ' rows skipped due to unparseable dates');
    }

    // Determine months present
    var monthSet = {};
    parsed.forEach(function(p) { monthSet[p.month] = true; });
    var monthsPresent = MONTH_ORDER.filter(function(m) { return monthSet[m]; });

    if (monthsPresent.length === 0) {
      return { data: null, stats: {}, warnings: ['No valid rows found. Check date format (DD/MM/YYYY expected).'] };
    }

    var total = parsed.length;
    var checkedInCount = parsed.filter(function(p) { return p.checkedIn; }).length;
    var compCount = parsed.filter(function(p) { return p.playedInComp; }).length;
    var socialCount = total - compCount;
    var visitorCount = parsed.filter(function(p) { return p.isVisitor; }).length;
    var noShows = total - checkedInCount;
    var memberNums = {};
    parsed.forEach(function(p) { if (!p.isVisitor && p.memNum) memberNums[p.memNum] = true; });
    var uniqueMembers = Object.keys(memberNums).length;

    // By Month
    var byMonth = {};
    monthsPresent.forEach(function(mo) {
      var sub = parsed.filter(function(p) { return p.month === mo; });
      var moMemNums = {};
      sub.forEach(function(p) { if (!p.isVisitor && p.memNum) moMemNums[p.memNum] = true; });
      byMonth[mo] = {
        total: sub.length,
        comp: sub.filter(function(p) { return p.playedInComp; }).length,
        social: sub.filter(function(p) { return !p.playedInComp; }).length,
        checked_in: sub.filter(function(p) { return p.checkedIn; }).length,
        no_shows: sub.filter(function(p) { return !p.checkedIn; }).length,
        visitors: sub.filter(function(p) { return p.isVisitor; }).length,
        unique_members: Object.keys(moMemNums).length,
      };
    });

    // By DOW
    var byDow = {};
    DOW_ORDER.forEach(function(dow) {
      var sub = parsed.filter(function(p) { return p.dow === dow; });
      byDow[dow] = {
        total: sub.length,
        comp: sub.filter(function(p) { return p.playedInComp; }).length,
        social: sub.filter(function(p) { return !p.playedInComp; }).length,
        checked_in: sub.filter(function(p) { return p.checkedIn; }).length,
      };
    });

    // By Hour
    var byHour = {};
    HOUR_RANGE.forEach(function(h) {
      var sub = parsed.filter(function(p) { return p.hour === h; });
      byHour[String(h)] = {
        total: sub.length,
        comp: sub.filter(function(p) { return p.playedInComp; }).length,
        social: sub.filter(function(p) { return !p.playedInComp; }).length,
      };
    });

    // By Category
    var catAgg = {};
    parsed.forEach(function(p) {
      if (!catAgg[p.catGrp]) catAgg[p.catGrp] = { total: 0, comp: 0, social: 0, checked_in: 0 };
      catAgg[p.catGrp].total++;
      if (p.playedInComp) catAgg[p.catGrp].comp++; else catAgg[p.catGrp].social++;
      if (p.checkedIn) catAgg[p.catGrp].checked_in++;
    });
    var byCategory = Object.keys(catAgg).map(function(k) {
      return { name: k, total: catAgg[k].total, comp: catAgg[k].comp, social: catAgg[k].social, checked_in: catAgg[k].checked_in };
    }).sort(function(a, b) { return b.total - a.total; });

    // By Gender
    var byGender = {};
    ['Male', 'Female', 'Unknown'].forEach(function(g) {
      var sub = parsed.filter(function(p) { return p.gender === g; });
      if (sub.length) {
        byGender[g] = {
          total: sub.length,
          comp: sub.filter(function(p) { return p.playedInComp; }).length,
          social: sub.filter(function(p) { return !p.playedInComp; }).length,
          checked_in: sub.filter(function(p) { return p.checkedIn; }).length,
        };
      }
    });

    // Top Members
    var memAgg = {};
    parsed.forEach(function(p) {
      if (p.isVisitor || !p.memNum) return;
      if (!memAgg[p.memNum]) {
        memAgg[p.memNum] = {
          name: (p.firstName + ' ' + p.lastName).trim(),
          member_number: p.memNum,
          category: p.catGrp,
          gender: p.gender,
          total: 0, comp: 0, social: 0, checked_in: 0,
        };
      }
      memAgg[p.memNum].total++;
      if (p.playedInComp) memAgg[p.memNum].comp++; else memAgg[p.memNum].social++;
      if (p.checkedIn) memAgg[p.memNum].checked_in++;
    });
    var topMembers = Object.values(memAgg)
      .sort(function(a, b) { return b.total - a.total; })
      .slice(0, 100);

    // By Month x DOW
    var byMonthDow = {};
    monthsPresent.forEach(function(mo) {
      byMonthDow[mo] = {};
      DOW_ORDER.forEach(function(dow) {
        var sub = parsed.filter(function(p) { return p.month === mo && p.dow === dow; });
        byMonthDow[mo][dow] = {
          total: sub.length,
          comp: sub.filter(function(p) { return p.playedInComp; }).length,
          social: sub.filter(function(p) { return !p.playedInComp; }).length,
          checked_in: sub.filter(function(p) { return p.checkedIn; }).length,
        };
      });
    });

    // By Month x Hour
    var byMonthHour = {};
    monthsPresent.forEach(function(mo) {
      byMonthHour[mo] = {};
      HOUR_RANGE.forEach(function(h) {
        var sub = parsed.filter(function(p) { return p.month === mo && p.hour === h; });
        byMonthHour[mo][String(h)] = {
          total: sub.length,
          comp: sub.filter(function(p) { return p.playedInComp; }).length,
          social: sub.filter(function(p) { return !p.playedInComp; }).length,
        };
      });
    });

    // By Month x Category
    var byMonthCat = {};
    monthsPresent.forEach(function(mo) {
      var moCatAgg = {};
      parsed.filter(function(p) { return p.month === mo; }).forEach(function(p) {
        if (!moCatAgg[p.catGrp]) moCatAgg[p.catGrp] = { total: 0, comp: 0, social: 0, checked_in: 0 };
        moCatAgg[p.catGrp].total++;
        if (p.playedInComp) moCatAgg[p.catGrp].comp++; else moCatAgg[p.catGrp].social++;
        if (p.checkedIn) moCatAgg[p.catGrp].checked_in++;
      });
      byMonthCat[mo] = moCatAgg;
    });

    // Home Clubs
    var clubCounts = {};
    parsed.forEach(function(p) {
      if (!p.isVisitor || !p.homeClub) return;
      if (p.homeClub === 'The Victoria Golf Club' || p.homeClub === 'Victoria Golf Club') return;
      clubCounts[p.homeClub] = (clubCounts[p.homeClub] || 0) + 1;
    });
    var homeClubs = Object.keys(clubCounts)
      .map(function(k) { return { name: k, count: clubCounts[k] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, 15);

    // Determine year from data
    var years = {};
    parsed.forEach(function(p) {
      // We need to get year from the original date parse
    });
    var yearStr = new Date().getFullYear().toString();

    var data = {
      meta: {
        generated: today,
        date_range: monthsPresent[0] + ' \u2013 ' + monthsPresent[monthsPresent.length - 1] + ' ' + yearStr,
        months: monthsPresent,
      },
      totals: {
        bookings: total,
        checked_in: checkedInCount,
        no_shows: noShows,
        comp: compCount,
        social: socialCount,
        unique_members: uniqueMembers,
        visitors: visitorCount,
      },
      by_month: byMonth,
      by_dow: byDow,
      by_hour: byHour,
      by_month_dow: byMonthDow,
      by_month_hour: byMonthHour,
      by_month_cat: byMonthCat,
      by_category: byCategory,
      by_gender: byGender,
      top_members: topMembers,
      home_clubs: homeClubs,
    };

    var stats = {
      rows: total,
      months: monthsPresent.length,
      members: uniqueMembers,
      visitors: visitorCount,
    };

    return { data: data, stats: stats, warnings: warnings };
  },

  generateJS: function(data) {
    var today = new Date().toISOString().slice(0, 10);
    var total = data.totals.bookings;
    var months = data.meta.months;
    var range = months[0] + '\u2013' + months[months.length - 1];
    return '// VGC Booking Analysis \u2014 generated ' + today + '\n' +
           '// ' + total.toLocaleString() + ' bookings \u00b7 ' + range + '\n' +
           'window.BOOKING_DATA = ' + JSON.stringify(data) + ';\n';
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
//  COMPETITION DATA PARSER
//  Port of generate_competition.py
// ═══════════════════════════════════════════════════════════════════════════════

var CompetitionDataParser = {

  requiredColumns: ['Membership Number', 'First Name', 'Last Name', 'Category'],
  compColumns: ['Competition Rounds'],
  socialColumns: ['Social Rounds'],
  globalName: 'COMPETITION_DATA',
  fileName: 'data.js',
  exportFileName: 'competition-data.data.js',
  toolPath: 'tools/competition-data/',

  // Competition data needs TWO datasets: comp sheet + social sheet
  // They can be pasted separately or combined (if both columns present)
  process: function(headers, rows, options) {
    options = options || {};
    var warnings = [];
    var today = new Date().toISOString().slice(0, 10);

    function col(row, name) {
      var v = row[name];
      if (v === undefined) {
        for (var k in row) {
          if (k.trim().replace(/\.$/, '').toLowerCase() === name.toLowerCase()) return row[k];
        }
      }
      return v === undefined ? '' : v;
    }

    // Check if this is a combined dataset (has both Competition Rounds and Social Rounds)
    var hasComp = headers.some(function(h) { return h.trim().toLowerCase().includes('competition'); });
    var hasSocial = headers.some(function(h) { return h.trim().toLowerCase().includes('social'); });
    var isCombined = hasComp && hasSocial;

    var compMap = {};
    var socialMap = {};

    if (isCombined) {
      // Single paste with both columns
      rows.forEach(function(r) {
        var mid = col(r, 'Membership Number').toString().trim();
        if (!mid || mid.toLowerCase() === 'total' || mid.toLowerCase() === 'totals') return;
        compMap[mid] = r;
        socialMap[mid] = r;
      });
    } else if (options.compRows && options.socialRows) {
      // Two separate pastes
      options.compRows.forEach(function(r) {
        var mid = col(r, 'Membership Number').toString().trim();
        if (!mid || mid.toLowerCase() === 'total' || mid.toLowerCase() === 'totals') return;
        compMap[mid] = r;
      });
      options.socialRows.forEach(function(r) {
        var mid = col(r, 'Membership Number').toString().trim();
        if (!mid || mid.toLowerCase() === 'total' || mid.toLowerCase() === 'totals') return;
        socialMap[mid] = r;
      });
    } else if (hasComp) {
      rows.forEach(function(r) {
        var mid = col(r, 'Membership Number').toString().trim();
        if (!mid || mid.toLowerCase() === 'total' || mid.toLowerCase() === 'totals') return;
        compMap[mid] = r;
      });
      if (Object.keys(socialMap).length === 0) {
        warnings.push('Only competition data found. Social rounds will be zero. Paste social data separately if available.');
      }
    } else if (hasSocial) {
      rows.forEach(function(r) {
        var mid = col(r, 'Membership Number').toString().trim();
        if (!mid || mid.toLowerCase() === 'total' || mid.toLowerCase() === 'totals') return;
        socialMap[mid] = r;
      });
      if (Object.keys(compMap).length === 0) {
        warnings.push('Only social data found. Competition rounds will be zero. Paste competition data separately if available.');
      }
    }

    // Merge by membership number
    var allIds = {};
    Object.keys(compMap).forEach(function(k) { allIds[k] = true; });
    Object.keys(socialMap).forEach(function(k) { allIds[k] = true; });
    var sortedIds = Object.keys(allIds).sort();

    var members = [];
    sortedIds.forEach(function(mid) {
      var cr = compMap[mid] || {};
      var sr = socialMap[mid] || {};
      var ref = Object.keys(cr).length ? cr : sr;

      var first = col(ref, 'First Name').toString().trim();
      var last = col(ref, 'Last Name').toString().trim();
      var rawCat = col(ref, 'Category').toString().trim();
      var rawAge = col(ref, 'Age');
      var age = parseInt(rawAge) || 0;

      // Find comp rounds column
      var compRounds = 0;
      if (Object.keys(cr).length) {
        for (var k in cr) {
          if (k.trim().toLowerCase().includes('competition') && k.trim().toLowerCase().includes('round')) {
            compRounds = parseInt(cr[k]) || 0;
            break;
          }
        }
      }

      // Find social rounds column
      var socialRounds = 0;
      if (Object.keys(sr).length) {
        for (var k in sr) {
          if (k.trim().toLowerCase().includes('social') && k.trim().toLowerCase().includes('round')) {
            socialRounds = parseInt(sr[k]) || 0;
            break;
          }
        }
      }

      var totalRounds = compRounds + socialRounds;

      members.push({
        id: mid,
        first: first,
        last: last,
        name: (first + ' ' + last).trim(),
        category: cleanCat(rawCat),
        rawCategory: rawCat,
        age: age,
        ageBracket: ageBracket(age),
        compRounds: compRounds,
        socialRounds: socialRounds,
        totalRounds: totalRounds,
        compPct: totalRounds > 0 ? Math.round((compRounds / totalRounds) * 10000) / 10000 : 0,
      });
    });

    // Sort by total rounds desc
    members.sort(function(a, b) { return b.totalRounds - a.totalRounds; });

    // Summary KPIs
    var totalComp = members.reduce(function(s, m) { return s + m.compRounds; }, 0);
    var totalSocial = members.reduce(function(s, m) { return s + m.socialRounds; }, 0);
    var totalRounds = totalComp + totalSocial;
    var activeComp = members.filter(function(m) { return m.compRounds > 0; }).length;
    var activeSocial = members.filter(function(m) { return m.socialRounds > 0; }).length;
    var compOnly = members.filter(function(m) { return m.compRounds > 0 && m.socialRounds === 0; }).length;
    var socialOnly = members.filter(function(m) { return m.socialRounds > 0 && m.compRounds === 0; }).length;
    var both = members.filter(function(m) { return m.compRounds > 0 && m.socialRounds > 0; }).length;

    var summary = {
      totalMembers: members.length,
      totalComp: totalComp,
      totalSocial: totalSocial,
      totalRounds: totalRounds,
      avgComp: activeComp ? Math.round((totalComp / activeComp) * 10) / 10 : 0,
      avgSocial: activeSocial ? Math.round((totalSocial / activeSocial) * 10) / 10 : 0,
      avgTotal: members.length ? Math.round((totalRounds / members.length) * 10) / 10 : 0,
      compOnly: compOnly,
      socialOnly: socialOnly,
      both: both,
      activeComp: activeComp,
      activeSocial: activeSocial,
      compPct: totalRounds ? Math.round((totalComp / totalRounds) * 10000) / 10000 : 0,
    };

    // By Category
    var catAgg = {};
    members.forEach(function(m) {
      if (!catAgg[m.category]) catAgg[m.category] = { comp: 0, social: 0, count: 0 };
      catAgg[m.category].comp += m.compRounds;
      catAgg[m.category].social += m.socialRounds;
      catAgg[m.category].count++;
    });
    var byCategory = Object.keys(catAgg)
      .map(function(name) {
        var v = catAgg[name];
        var t = v.comp + v.social;
        return {
          name: name, comp: v.comp, social: v.social, total: t, count: v.count,
          avgComp: v.count ? Math.round((v.comp / v.count) * 10) / 10 : 0,
          avgSocial: v.count ? Math.round((v.social / v.count) * 10) / 10 : 0,
          compPct: t ? Math.round((v.comp / t) * 10000) / 10000 : 0,
        };
      })
      .sort(function(a, b) { return b.total - a.total; });

    // By Age
    var ageAgg = {};
    members.forEach(function(m) {
      var ab = m.ageBracket;
      if (!ageAgg[ab]) ageAgg[ab] = { comp: 0, social: 0, count: 0 };
      ageAgg[ab].comp += m.compRounds;
      ageAgg[ab].social += m.socialRounds;
      ageAgg[ab].count++;
    });
    var byAge = AGE_BRACKETS.map(function(b) {
      var label = b[0];
      var v = ageAgg[label] || { comp: 0, social: 0, count: 0 };
      var t = v.comp + v.social;
      return {
        name: label, comp: v.comp, social: v.social, total: t, count: v.count,
        avgComp: v.count ? Math.round((v.comp / v.count) * 10) / 10 : 0,
        avgSocial: v.count ? Math.round((v.social / v.count) * 10) / 10 : 0,
        compPct: t ? Math.round((v.comp / t) * 10000) / 10000 : 0,
      };
    });

    var data = {
      meta: {
        period: 'Generated via Data Manager',
        generated: today,
        source: 'Pasted CSV',
      },
      summary: summary,
      members: members,
      byCategory: byCategory,
      byAge: byAge,
    };

    var stats = {
      members: members.length,
      compMembers: activeComp,
      socialMembers: activeSocial,
      totalRounds: totalRounds,
    };

    return { data: data, stats: stats, warnings: warnings };
  },

  generateJS: function(data) {
    return '// Auto-generated by Data Manager\n' +
           'window.COMPETITION_DATA = ' + JSON.stringify(data) + ';\n';
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
//  PACE OF PLAY PARSER
//  Port of generate_pace.py
// ═══════════════════════════════════════════════════════════════════════════════

var PaceOfPlayParser = {

  requiredColumns: ['Participant', 'Round Time'],
  altColumns: { 'Participant': ['Name', 'Player', 'Player Name'], 'Round Time': ['Time', 'Round Time by App'] },
  constName: 'PACE_DATA',
  fileName: 'pace_data.js',
  exportFileName: 'pace_data.js',
  toolPath: 'tools/pace-of-play/',

  MIN_MINS: 120,
  MAX_MINS: 330,

  process: function(headers, rows) {
    var warnings = [];
    var self = this;

    // Find the right column names (support alternatives)
    function findCol(row, primary, alts) {
      var v = row[primary];
      if (v !== undefined && v !== '') return v;
      // Try case-insensitive
      for (var k in row) {
        if (k.trim().toLowerCase() === primary.toLowerCase()) return row[k];
      }
      // Try alternatives
      if (alts) {
        for (var i = 0; i < alts.length; i++) {
          for (var k in row) {
            if (k.trim().toLowerCase() === alts[i].toLowerCase()) return row[k];
          }
        }
      }
      return '';
    }

    // Check for Booking Group column (to filter 9-hole)
    var hasGroup = headers.some(function(h) {
      return h.trim().toLowerCase().includes('group') || h.trim().toLowerCase().includes('booking');
    });

    var players = {};
    var skippedNine = 0;
    var skippedTime = 0;
    var validRows = 0;

    rows.forEach(function(r) {
      var nameRaw = findCol(r, 'Participant', ['Name', 'Player', 'Player Name']).toString().trim();
      if (!nameRaw) return;

      // Check for 9-hole filtering
      if (hasGroup) {
        var group = '';
        for (var k in r) {
          if (k.trim().toLowerCase().includes('group') || k.trim().toLowerCase().includes('booking')) {
            group = r[k].toString().toLowerCase();
            break;
          }
        }
        if (group.includes('9 hole')) { skippedNine++; return; }
      }

      var timeStr = findCol(r, 'Round Time', ['Time', 'Round Time by App']).toString().trim();
      var mins = parseMins(timeStr);
      if (mins === null || mins < self.MIN_MINS || mins > self.MAX_MINS) { skippedTime++; return; }

      // Normalise name: handle "Last, First" format
      var name = nameRaw;
      if (name.indexOf(',') !== -1) {
        var parts = name.split(',');
        name = parts[1].trim() + ' ' + parts[0].trim();
      }
      name = name.replace(/\s+/g, ' ').trim();

      if (!players[name]) players[name] = { times: [] };
      players[name].times.push(mins);
      validRows++;
    });

    if (skippedNine > 0) warnings.push(skippedNine + ' rows skipped (9-hole rounds)');
    if (skippedTime > 0) warnings.push(skippedTime + ' rows skipped (invalid/out-of-range times)');

    // Build output
    var records = Object.keys(players).sort().map(function(name) {
      var times = players[name].times.sort(function(a, b) { return a - b; });
      var avg = Math.round((times.reduce(function(s, t) { return s + t; }, 0) / times.length) * 10) / 10;
      return {
        name: name,
        gender: 'm', // default — would need member DB for accurate gender
        rounds: times.length,
        avgMins: avg,
        allTimes: times,
      };
    });

    // Sort by most rounds desc
    records.sort(function(a, b) { return b.rounds - a.rounds || a.name.localeCompare(b.name); });

    var stats = {
      players: records.length,
      totalRounds: validRows,
      avgTime: records.length ? Math.round(records.reduce(function(s, r) { return s + r.avgMins; }, 0) / records.length) : 0,
    };

    return { data: records, stats: stats, warnings: warnings };
  },

  generateJS: function(data) {
    return '// Auto-generated by Data Manager\n' +
           '// Re-run after each new Round Times Report export.\n' +
           'const PACE_DATA = ' + JSON.stringify(data) + ';\n';
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function parseDate(str) {
  str = (str || '').toString().trim();
  if (!str) return null;
  // DD/MM/YYYY or D/M/YYYY
  var dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    var d = new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    if (!isNaN(d.getTime())) return d;
  }
  // YYYY-MM-DD
  var ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    var d = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
    if (!isNaN(d.getTime())) return d;
  }
  // Try native parse as fallback
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function parseTeeTimeHour(teeTimeStr, eventDateStr) {
  if (!teeTimeStr) return -1;
  // HH:MM or H:MM
  var hm = teeTimeStr.match(/(\d{1,2}):(\d{2})/);
  if (hm) return parseInt(hm[1]);
  // Full datetime — extract hour
  var dt = new Date(teeTimeStr);
  if (!isNaN(dt.getTime())) return dt.getHours();
  return -1;
}

function parseMins(str) {
  str = (str || '').toString().trim();
  if (str.indexOf(':') === -1) return null;
  var parts = str.split(':');
  try {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  } catch(e) {
    return null;
  }
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  var s = (v || '').toString().trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || s === 'y';
}
