/* VBN | Vermont Basketball Network | vbn.nsnsports.net | NOT a VFN file | file: assets/vbn.js */
/* Vermont Basketball Network: shared code for every page.
 *
 * Holds the things every page needs, so a fix is made once:
 *   - where the data lives (data-cache.php on the NSN server, Google directly as a backup)
 *   - the CSV reader, team lookup, dates and times, game status, records
 *   - the header, footer, and game card
 */
var VBN = (function () {
  'use strict';

  var SEASON_YEAR = 2026;   // first year of the season (2026-27). Update each season.

  // Published VBN Data Hub tabs. Pages try data-cache.php first (NSN server).
  // If that is not available (GitHub preview), they read Google directly.
  // When you add a tab, add it here AND in data-cache.php.
  var GOOGLE = {
    schedule: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR124tvUPhqDU7cJ9fw2H2YQXvNP_XcH5F76KlxUwDdgJ_nv12PpyLHGeIWErXDzT3uxLoh_kxyvmmI/pub?gid=0&single=true&output=csv',
    teams:    'https://docs.google.com/spreadsheets/d/e/2PACX-1vR124tvUPhqDU7cJ9fw2H2YQXvNP_XcH5F76KlxUwDdgJ_nv12PpyLHGeIWErXDzT3uxLoh_kxyvmmI/pub?gid=1570140558&single=true&output=csv',
    stats:    '',   // paste the published Stats tab link here once the tab exists
    roster:   'https://docs.google.com/spreadsheets/d/e/2PACX-1vR124tvUPhqDU7cJ9fw2H2YQXvNP_XcH5F76KlxUwDdgJ_nv12PpyLHGeIWErXDzT3uxLoh_kxyvmmI/pub?gid=1159215250&single=true&output=csv'
  };

  var CONTACT = 'csimpson@nsnsports.net';
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  /* ---------- text safety ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- CSV ----------
     Quote-aware: handles commas inside names ("Profile, NH") and line breaks inside a cell.
     Columns are read by header name. A note in parentheses is ignored, so "Team1 (Home)" also answers to "Team1". */
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    text = String(text).replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
    if (!rows.length) return [];
    var headers = rows[0].map(function (h) { return String(h).trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      headers.forEach(function (h, j) {
        var v = r[j] !== undefined ? String(r[j]).trim() : '';
        var base = h.replace(/\s*\(.*\)\s*$/, '').trim();
        o[h] = v;
        if (!(base in o)) o[base] = v;
      });
      return o;
    });
  }

  /* ---------- loading ---------- */
  function looksLikeCSV(t) { return !/^\s*<(!doctype|html|\?php)/i.test(t) && String(t).trim().length > 0; }

  function loadSource(name) {
    var tries = [];
    if (typeof location !== 'undefined' && /^https?:/.test(location.protocol)) tries.push('data-cache.php?src=' + encodeURIComponent(name));
    if (GOOGLE[name]) tries.push(GOOGLE[name]);
    var i = 0;
    function next(lastErr) {
      if (i >= tries.length) return Promise.reject(lastErr || new Error('No source for ' + name));
      var url = tries[i++];
      return fetch(url, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(name + ': HTTP ' + r.status); return r.text(); })
        .then(function (t) { if (!looksLikeCSV(t)) throw new Error(name + ': not CSV'); return parseCSV(t); })
        .catch(function (e) { return next(e); });
    }
    return next();
  }

  /* ---------- teams ---------- */
  var TEAMS = {};
  function norm(s) { return String(s || '').trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' '); }
  function key(team, gender) { return norm(team) + '|' + String(gender || '').trim().toUpperCase(); }
  function setTeams(rows) {
    TEAMS = {};
    rows.forEach(function (r) { if (r.Team && r.Gender) TEAMS[key(r.Team, r.Gender)] = r; });
  }
  function loadTeams() { return loadSource('teams').then(function (rows) { setTeams(rows); return rows; }); }
  function team(name, gender) { return TEAMS[key(name, gender)] || null; }
  function displayName(name, gender) { var t = team(name, gender); return (t && t.DisplayName) || name || 'TBA'; }
  /* A school is "covered" (gets standings, rankings, a team card) when its Teams row has a League filled in.
     The NVAC column is just a note now, so southern Vermont schools join by typing their league. */
  var LEAGUE_ORDER = ['Metro', 'Lake', 'Capital A', 'Capital B', 'Mountain'];
  function hasLeague(t) { return !!(t && String(t.League || '').trim()); }
  function isActiveRow(t, gender) {
    return (!gender || String(t.Gender).toUpperCase() === gender) && hasLeague(t) && !/no team|jv/i.test(t.Status || '');
  }
  function leagueGroup(league) {                // 'Capital A' and 'Capital B' share the 'Capital' filter; a lone tier letter is dropped
    return String(league || '').trim().replace(/\s+[A-D]$/i, '');
  }
  function leagueOf(name, gender) { var t = team(name, gender); return hasLeague(t) ? leagueGroup(t.League) : ''; }
  function isMember(name, gender) { return hasLeague(team(name, gender)); }
  function orderLeagues(list) {                 // known leagues in the usual order, any new ones after, A to Z
    var seen = {}; list.forEach(function (l) { if (l) seen[l] = true; });
    return Object.keys(seen).sort(function (a, b) {
      var ia = LEAGUE_ORDER.indexOf(a), ib = LEAGUE_ORDER.indexOf(b);
      if (ia === -1 && LEAGUE_ORDER.some(function (k) { return leagueGroup(k) === a; })) ia = LEAGUE_ORDER.map(leagueGroup).indexOf(a);
      if (ib === -1 && LEAGUE_ORDER.some(function (k) { return leagueGroup(k) === b; })) ib = LEAGUE_ORDER.map(leagueGroup).indexOf(b);
      if (ia === -1) ia = 99; if (ib === -1) ib = 99;
      return ia - ib || a.localeCompare(b);
    });
  }
  // Every league in the Teams tab for one gender ('' = both). grouped=true gives the schedule filters (Capital, not Capital A).
  function leagueList(teamRows, gender, grouped) {
    return orderLeagues(teamRows.filter(function (t) { return isActiveRow(t, gender); })
      .map(function (t) { var l = String(t.League).trim(); return grouped ? leagueGroup(l) : l; }));
  }
  function validHex(c) { return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(String(c || '').trim()); }
  function crestHTML(name, gender) {
    var t = team(name, gender);
    if (t && t.LogoPath) {
      return '<img class="crest" src="' + esc(t.LogoPath) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">';
    }
    var color = t && validHex(t.PrimaryColor) ? t.PrimaryColor.trim() : '#3a3a3e';
    return '<span class="crest" style="background:' + esc(color) + '"></span>';
  }

  /* ---------- dates and times ---------- */
  function parseDate(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) { var y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[1] - 1, +m[2]); }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  // Minutes after midnight, or null. Accepts "7:00 PM", "7:00:00 PM", "19:00", "7:00".
  function parseTime(s) {
    var m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
    if (!m) return null;
    var h = +m[1], min = +m[2], ap = m[3] ? m[3].toUpperCase() : '';
    if (ap === 'PM' && h < 12) h += 12;
    else if (ap === 'AM' && h === 12) h = 0;
    else if (!ap && h < 10) h += 12;        // no AM/PM written: high school tips are 10:00 AM or later
    return h * 60 + min;
  }
  function timeLabel(s) {
    var mins = parseTime(s);
    if (mins === null) return '';
    var h = Math.floor(mins / 60), m = mins % 60;
    return ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function gameStart(g) {
    var d = parseDate(g.Date); if (!d) return null;
    var t = parseTime(g.Time); if (t !== null) d.setMinutes(t);
    return d;
  }
  // For sorting within a day: games with no time yet go after the ones with a time.
  function sortTime(g) {
    var d = parseDate(g.Date); if (!d) return Infinity;
    var t = parseTime(g.Time);
    return d.getTime() + (t === null ? 24 * 60 - 1 : t) * 60000;
  }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayLabel(d) { return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate(); }
  function startOfToday(now) { var d = now ? new Date(now) : new Date(); d.setHours(0, 0, 0, 0); return d; }

  /* ---------- game status ----------
     A game is final ONLY when Quarter starts with "Final". Scores alone never make a game final. */
  function quarter(g) { return String(g.Quarter || '').trim().toLowerCase(); }
  function isFinal(g) { return quarter(g).indexOf('final') === 0; }
  function isOff(g) { var q = quarter(g); return q.indexOf('postpon') === 0 || q.indexOf('cancel') === 0; }
  function isLive(g) { var q = quarter(g); return q !== '' && !isFinal(g) && !isOff(g); }
  function num(v) { var s = String(v == null ? '' : v).trim(); return s !== '' && isFinite(s) ? Number(s) : null; }

  // Overall records from Final games only. Key: team|gender.
  function computeRecords(rows) {
    var rec = {};
    rows.forEach(function (g) {
      if (!isFinal(g)) return;
      var s1 = num(g.Team1Score), s2 = num(g.Team2Score);
      if (s1 === null || s2 === null || s1 === s2) return;
      [[g.Team1, s1 > s2], [g.Team2, s2 > s1]].forEach(function (p) {
        var k = key(p[0], g.Gender);
        rec[k] = rec[k] || { w: 0, l: 0 };
        rec[k][p[1] ? 'w' : 'l']++;
      });
    });
    return rec;
  }

  /* ---------- VPA index points ----------
     From the VPA "Index Points Explained" document. Points depend on the opponent's division compared
     to yours, and on whether you were home or away: [home, away].
     The doc's second table (0.5 home / 1 away vs a higher division) is read as LOSS points.
     That reading, and treating neutral-site games as away for both teams, are NOT yet verified
     against official VPA standings. Change a number here and every page follows. */
  var INDEX_POINTS = {
    win:  { higher: [5, 6], same: [4, 5], lower1: [3.5, 4.5], lower2: [2, 3] },
    loss: { higher: [0.5, 1], same: [0, 0], lower1: [0, 0], lower2: [0, 0] }
  };
  var DIV_NUM = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
  function vpaDiv(name, gender) { var t = team(name, gender); return t ? String(t.VPADiv || '').trim().toUpperCase() : ''; }
  function divBand(own, opp) {        // opp minus own: negative means the opponent is in a higher (bigger-school) division
    var d = opp - own;
    return d < 0 ? 'higher' : d === 0 ? 'same' : d === 1 ? 'lower1' : 'lower2';
  }
  // Why a final game does or does not count toward index points. '' means it counts.
  function indexSkipReason(g) {
    var gn = String(g.Gender || '').toUpperCase();
    var a = team(g.Team1, gn), b = team(g.Team2, gn);
    if (!a || !b) return 'unknown team';
    if (a.State !== 'VT' || b.State !== 'VT') return 'out of state';
    if (/jv/i.test(a.Status || '') || /jv/i.test(b.Status || '')) return 'JV only';
    if (!DIV_NUM[vpaDiv(g.Team1, gn)] || !DIV_NUM[vpaDiv(g.Team2, gn)]) return 'no VPA division';
    return '';
  }

  /* ---------- standings ----------
     One entry per team|gender for every team on the schedule. Only Final games count.
     index: VPA index points total, igp: games counted for the index, avg: index average (null until a game counts). */
  function standings(rows) {
    var S = {};
    function get(name, gn) {
      var k = key(name, gn);
      if (!S[k]) S[k] = { team: name, gender: gn, w: 0, l: 0, lw: 0, ll: 0, hw: 0, hl: 0, aw: 0, al: 0,
                          pf: 0, pa: 0, gp: 0, index: 0, igp: 0, avg: null, results: [] };
      return S[k];
    }
    var finals = rows.filter(function (g) { return isFinal(g); })
      .sort(function (a, b) { return sortTime(a) - sortTime(b); });
    rows.forEach(function (g) { var gn = String(g.Gender || '').toUpperCase(); [g.Team1, g.Team2].forEach(function (t) { if (t && t !== 'TBA') get(t, gn); }); });
    finals.forEach(function (g) {
      var gn = String(g.Gender || '').toUpperCase();
      var s1 = num(g.Team1Score), s2 = num(g.Team2Score);
      if (s1 === null || s2 === null || s1 === s2 || !g.Team1 || !g.Team2 || g.Team2 === 'TBA') return;
      var neutral = String(g.Neutral || '').trim().toLowerCase() === 'yes';
      var league = String(g.League || '').trim().toLowerCase() === 'yes';
      var skip = indexSkipReason(g);
      [[g.Team1, g.Team2, s1, s2, 0], [g.Team2, g.Team1, s2, s1, 1]].forEach(function (p) {
        var r = get(p[0], gn), won = p[2] > p[3];
        r.gp++; r.pf += p[2]; r.pa += p[3];
        r[won ? 'w' : 'l']++;
        if (league) r[won ? 'lw' : 'll']++;
        if (!neutral) r[(p[4] === 0 ? 'h' : 'a') + (won ? 'w' : 'l')]++;
        r.results.push(won ? 'W' : 'L');
        if (!skip) {
          var loc = neutral ? 1 : p[4];
          var band = divBand(DIV_NUM[vpaDiv(p[0], gn)], DIV_NUM[vpaDiv(p[1], gn)]);
          r.index += INDEX_POINTS[won ? 'win' : 'loss'][band][loc];
          r.igp++;
        }
      });
    });
    Object.keys(S).forEach(function (k) {
      var r = S[k];
      r.avg = r.igp ? r.index / r.igp : null;
      var last = r.results[r.results.length - 1], n = 0;
      for (var i = r.results.length - 1; i >= 0 && r.results[i] === last; i--) n++;
      r.streak = last ? last + n : '';
    });
    return S;
  }
  function pct(w, l) { return w + l ? w / (w + l) : 0; }
  function recText(w, l) { return w + '-' + l; }

  // Sort orders shared by the standings page and team pages, so a team's place is the same everywhere.
  // League: league win %, then league wins, then overall win %. Division: index average, then overall win %.
  function sortLeague(a, b) {
    return (pct(b.lw, b.ll) - pct(a.lw, a.ll)) || (b.lw - a.lw) || (pct(b.w, b.l) - pct(a.w, a.l)) || String(a.team).localeCompare(String(b.team));
  }
  function sortIndex(a, b) {
    var x = a.avg === null ? -1 : a.avg, y = b.avg === null ? -1 : b.avg;
    return (y - x) || (pct(b.w, b.l) - pct(a.w, a.l)) || String(a.team).localeCompare(String(b.team));
  }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  /* ---------- team rankings ----------
     For one gender, every team with a League gets: its place in its league, its place among
     the teams we track in its VPA division (by index), and where its points per game (PPG) and points allowed
     per game (OPPG) rank inside both groups. Lower OPPG ranks higher. Ties share a rank (1, 2, 2, 4).
     JV-only and "No Team" rows are left out. Returns a map keyed team|gender. */
  function teamRankings(S, teamRows, gender) {
    var members = teamRows.filter(function (t) {
      return isActiveRow(t, gender);
    }).map(function (t) {
      var s = S[key(t.Team, gender)] || { team: t.Team, w: 0, l: 0, lw: 0, ll: 0, pf: 0, pa: 0, gp: 0, index: 0, igp: 0, avg: null };
      return { t: t, s: s, ppg: s.gp ? s.pf / s.gp : null, oppg: s.gp ? s.pa / s.gp : null };
    });
    function rankBy(list, field, lowerIsBetter) {
      var vals = list.filter(function (x) { return x[field] !== null; }).map(function (x) { return x[field]; });
      return function (x) {
        if (x[field] === null) return null;
        return 1 + vals.filter(function (v) { return lowerIsBetter ? v < x[field] - 1e-9 : v > x[field] + 1e-9; }).length;
      };
    }
    var out = {};
    function groups(field) {
      var g = {};
      members.forEach(function (x) { var k = String(x.t[field] || '').trim(); if (k) (g[k] = g[k] || []).push(x); });
      return g;
    }
    var lg = groups('League'), dv = groups('VPADiv');
    members.forEach(function (x) { out[key(x.t.Team, gender)] = { ppg: x.ppg, oppg: x.oppg, league: x.t.League || '', div: x.t.VPADiv || '' }; });
    [['league', lg, sortLeague], ['div', dv, sortIndex]].forEach(function (spec) {
      Object.keys(spec[1]).forEach(function (name) {
        var list = spec[1][name];
        var order = list.slice().sort(function (a, b) { return spec[2](a.s, b.s); });
        var ppgR = rankBy(list, 'ppg', false), oppgR = rankBy(list, 'oppg', true);
        order.forEach(function (x, i) {
          var r = out[key(x.t.Team, gender)];
          r[spec[0] + 'Place'] = spec[0] === 'div' && x.s.avg === null ? null : i + 1;
          r[spec[0] + 'Size'] = list.length;
          r[spec[0] + 'PpgRank'] = ppgR(x);
          r[spec[0] + 'OppgRank'] = oppgR(x);
        });
      });
    });
    return out;
  }

  /* ---------- player stats ----------
     Stats tab: one row per player per game. GameID ties each row to a Schedule game (date, opponent).
     A blank cell means "not tracked that game", which is different from 0. Per-game averages use only
     the games where that stat was entered, so a team that only reports points is not dragged down. */
  var STAT_COLS = ['PTS', 'FGM', 'FGA', '3PM', '3PA', 'FTM', 'FTA', 'REB', 'AST', 'STL', 'BLK'];
  function gradeLabel(gradYear) {
    var y = parseInt(gradYear, 10);
    if (!y) return '';
    return { 1: 'Sr.', 2: 'Jr.', 3: 'So.', 4: 'Fr.' }[y - SEASON_YEAR] || '';
  }
  function fixCase(name) {
    var s = String(name || '').trim().replace(/\s+/g, ' ');
    if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;     // mixed case typed on purpose (DiZoglio): leave it
    return s.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); });
  }
  // Returns { players: [...], warnings: [...] }
  function aggregateStats(statRows, rosterRows, scheduleRows) {
    var roster = {}, games = {}, P = {}, warnings = [];
    (rosterRows || []).forEach(function (r) {
      var gn = String(r.Gender || '').toUpperCase();
      if (r.Team && r.Player) roster[key(r.Team, gn) + '|' + norm(r.Player)] = r;
    });
    (scheduleRows || []).forEach(function (g) { if (g.GameID) games[String(g.GameID).trim().toUpperCase()] = g; });
    (statRows || []).forEach(function (r, i) {
      // GameID can be typed bare (B001) or picked from a dropdown label like "12/11 Milton vs Peoples (B001)".
      var idm = String(r.GameID || '').toUpperCase().match(/\b([BG]\d{3,})\b/);
      var id = idm ? idm[1] : String(r.GameID || '').trim().toUpperCase(), g = games[id];
      if (!r.Player || !r.Team) return;
      if (!g) { warnings.push('Stats row ' + (i + 2) + ': GameID "' + r.GameID + '" is not on the Schedule tab'); return; }
      var gn = String(g.Gender || '').toUpperCase();
      if (norm(r.Team) !== norm(g.Team1) && norm(r.Team) !== norm(g.Team2)) {
        warnings.push('Stats row ' + (i + 2) + ': ' + r.Team + ' did not play in ' + id); return;
      }
      var teamName = norm(r.Team) === norm(g.Team1) ? g.Team1 : g.Team2;
      var rk = key(teamName, gn) + '|' + norm(r.Player), ros = roster[rk];
      if (!P[rk]) P[rk] = { team: teamName, gender: gn, player: ros ? ros.Player.trim() : fixCase(r.Player),
                            number: (ros && ros.Number) || r.Number || '', grade: ros ? gradeLabel(ros.GradYear) : '',
                            position: (ros && ros.Position) || '', gp: 0, tot: {}, tracked: {}, gameIds: {} };
      var p = P[rk];
      if (p.gameIds[id]) { warnings.push('Stats row ' + (i + 2) + ': ' + p.player + ' is entered twice for ' + id); return; }
      p.gameIds[id] = true; p.gp++;
      [['FGM', 'FGA'], ['3PM', '3PA'], ['FTM', 'FTA'], ['3PM', 'FGM']].forEach(function (x) {
        var a = num(r[x[0]]), b = num(r[x[1]]);
        if (a !== null && b !== null && a > b) warnings.push('Stats row ' + (i + 2) + ': ' + x[0] + ' is more than ' + x[1] + ' for ' + p.player + '. Check the headers.');
      });
      STAT_COLS.forEach(function (c) {
        var v = num(r[c]);
        if (v === null) return;
        p.tot[c] = (p.tot[c] || 0) + v; p.tracked[c] = (p.tracked[c] || 0) + 1;
      });
    });
    var players = Object.keys(P).map(function (k) {
      var p = P[k];
      p.per = {};
      STAT_COLS.forEach(function (c) { p.per[c] = p.tracked[c] ? p.tot[c] / p.tracked[c] : null; });
      [['FG', 'FGM', 'FGA'], ['3P', '3PM', '3PA'], ['FT', 'FTM', 'FTA']].forEach(function (x) {
        var made = p.tot[x[1]] || 0, att = p.tot[x[2]] || 0;
        p.per[x[0] + '%'] = att ? made / att : null;
      });
      return p;
    });
    return { players: players, warnings: warnings };
  }

  /* ---------- game card ----------
     opts.scores: show scores and W/L (homepage, scores pages). The schedule page leaves them off
     on purpose, because a score typed mid-game looks like a final there.
     opts.records: map from computeRecords. */
  function gameCardHTML(g, opts) {
    opts = opts || {};
    var gender = String(g.Gender || '').toUpperCase();
    var neutral = String(g.Neutral || '').trim().toLowerCase() === 'yes';
    var live = isLive(g), fin = isFinal(g), off = isOff(g);
    var s1 = num(g.Team1Score), s2 = num(g.Team2Score);
    var showScores = opts.scores && (live || fin) && s1 !== null && s2 !== null;

    var status;
    if (off) status = esc(g.Quarter);
    else if (live) status = '<span><span class="live-dot"></span>Live &middot; ' + esc(g.Quarter) + '</span>';
    else if (fin && opts.scores) status = esc(g.Quarter);
    else {
      var d = parseDate(g.Date);
      var when = d ? (opts.showDate ? DAYS[d.getDay()].slice(0, 3) + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ' &middot; ' : '') : '';
      status = when + (timeLabel(g.Time) || 'Time TBA');
    }
    var gpill = '<span class="gpill">' + (gender === 'G' ? 'Girls' : gender === 'B' ? 'Boys' : '') + '</span>';

    function row(name, tag, mine, theirs) {
      var r = opts.records && isMember(name, gender) ? opts.records[key(name, gender)] : null;
      var recTxt = opts.records && isMember(name, gender) ? ' <span class="rec">(' + (r ? r.w : 0) + '-' + (r ? r.l : 0) + ')</span>' : '';
      var right = '';
      if (showScores) {
        var cls = mine > theirs ? 'score lead' : 'score';
        right = '<span class="' + cls + '">' + mine + '</span>';
      }
      return '<div class="team-row"><div class="team">' + crestHTML(name, gender) +
        '<span class="name">' + esc(displayName(name, gender)) + '</span>' +
        (tag ? ' <span class="ha">' + tag + '</span>' : '') + recTxt + '</div>' + right + '</div>';
    }

    var lg = String(g.League || '').trim().toLowerCase() === 'yes';
    var l1 = leagueOf(g.Team1, gender), l2 = leagueOf(g.Team2, gender);
    var metaLeft = lg ? (l1 && l1 === l2 ? l1 + ' League' : 'League') : 'Non-League';
    if (g.Event) metaLeft += ' &middot; ' + (neutral ? '' : 'at ') + esc(g.Event);
    var tags = String(g.GameOfWeek || '').trim().toLowerCase() === 'yes' ? '<span class="tag gow">Game of the Week</span>' : '';
    var jv = timeLabel(g.JVTime);
    var metaRight = tags || (jv && !live && !fin && !off ? 'JV ' + jv : '');

    var url = String(g.BroadcastURL || '').trim();
    var start = gameStart(g);
    var inWindow = fin || live || (start && start.getTime() - Date.now() <= 30 * 60 * 1000);
    var watch = /^https?:\/\//i.test(url) && inWindow && !off;
    var cls = 'game-card' + (live ? ' live' : '') + (off ? ' off' : '') + (watch ? ' clickable' : '');
    var open = watch
      ? '<div class="' + cls + '" role="link" tabindex="0" data-url="' + esc(url) + '">'
      : '<div class="' + cls + '">';

    return open +
      '<span class="game-status">' + status + gpill + '</span>' +
      '<div class="matchup">' +
        row(g.Team1, neutral ? '' : '(H)', s1, s2) +
        row(g.Team2, neutral ? '' : '(A)', s2, s1) +
      '</div>' +
      '<div class="game-meta"><span>' + metaLeft + '</span><span>' + metaRight + '</span></div>' +
      (watch ? '<div class="watch-hint">' + (fin ? 'Watch Replay' : 'Watch This Broadcast') + ' &rarr;</div>' : '') +
      '</div>';
  }

  // One click handler for every clickable card on the page (cards are divs, never links inside links).
  function wireCards(container) {
    if (!container || container._wired) return;
    container._wired = true;
    function go(e) {
      var card = e.target.closest('.game-card.clickable');
      if (!card || e.target.closest('a')) return;
      if (e.type === 'keydown' && e.key !== 'Enter') return;
      window.open(card.getAttribute('data-url'), '_blank', 'noopener');
    }
    container.addEventListener('click', go);
    container.addEventListener('keydown', go);
  }

  /* ---------- header and footer ---------- */
  var NAV = [['index.html', 'Home'], ['schedule.html', 'Schedule'], ['standings.html', 'Standings'], ['teams.html', 'Teams'], ['statistics.html', 'Statistics']];   // add pages here as they are built

  function renderChrome(active) {
    var h = document.getElementById('site-header');
    if (h) {
      h.className = 'site-header';
      h.innerHTML =
        '<div class="nav"><div class="nav-left">' +
          '<button class="menu-toggle" aria-label="Open menu" aria-expanded="false">&#9776;</button>' +
          '<a href="index.html" class="logo"><span class="ball"></span><span class="full">VERMONT <span class="b">BASKETBALL</span></span><span class="short">VBN</span> <span class="net">NETWORK</span></a>' +
        '</div><div class="nav-actions">' +
          '<a href="https://www.nsnsports.net" target="_blank" rel="noopener" class="btn"><span>Watch Live</span></a>' +
          '<a href="https://store.nsnsports.net/" target="_blank" rel="noopener" class="btn-ghost"><span>Purchase Previous Games</span></a>' +
        '</div></div>' +
        '<nav class="mobile-menu" id="mobileMenu">' + NAV.map(function (n) {
          return '<a href="' + n[0] + '"' + (n[0] === active ? ' class="active"' : '') + '>' + n[1] + '</a>';
        }).join('') + '</nav>';
      var btn = h.querySelector('.menu-toggle'), menu = h.querySelector('.mobile-menu');
      btn.addEventListener('click', function () {
        var open = menu.classList.toggle('open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    var f = document.getElementById('site-footer');
    if (f) {
      f.className = 'site-footer';
      f.innerHTML = '<div class="wrap"><div class="footer-grid">' +
        '<div class="footer-col"><a href="index.html" class="logo" style="font-size:1.15rem;opacity:1;"><span class="ball" style="width:26px;height:26px;"></span>VBN</a>' +
          '<p>A Northeast Sports Network production. Vermont high school basketball, every tip-off, every gym.</p></div>' +
        '<div class="footer-col"><h4>Network</h4><a href="schedule.html">Full Schedule</a><a href="standings.html">Standings</a><a href="teams.html">All Teams</a><a href="statistics.html">Statistics</a><a href="https://store.nsnsports.net/" target="_blank" rel="noopener">Video Archive</a></div>' +
        '<div class="footer-col"><h4>Partner With Us</h4><a href="mailto:' + CONTACT + '?subject=VBN%20Sponsorship">Sponsorship Packages</a><a href="mailto:' + CONTACT + '?subject=VBN%20Title%20Sponsor">Title Sponsor Inquiry</a></div>' +
        '<div class="footer-col"><h4>Follow Us</h4><a href="https://www.facebook.com/nsnsports" target="_blank" rel="noopener">Facebook</a><a href="https://www.instagram.com/nsnsports" target="_blank" rel="noopener">Instagram</a><a href="https://www.youtube.com/@nsnsportsvt" target="_blank" rel="noopener">YouTube</a></div>' +
        '</div><div class="footer-bottom"><span>&copy; ' + new Date().getFullYear() + ' Northeast Sports Network. All rights reserved.</span><span>VBN: Vermont Basketball Network</span></div></div>';
    }
  }

  return {
    SEASON_YEAR: SEASON_YEAR, CONTACT: CONTACT,
    esc: esc, parseCSV: parseCSV, loadSource: loadSource, loadTeams: loadTeams, setTeams: setTeams,
    team: team, displayName: displayName, crestHTML: crestHTML, leagueOf: leagueOf, isMember: isMember, hasLeague: hasLeague, isActiveRow: isActiveRow, leagueGroup: leagueGroup, leagueList: leagueList, key: key, norm: norm,
    parseDate: parseDate, parseTime: parseTime, timeLabel: timeLabel, gameStart: gameStart, sortTime: sortTime,
    dayKey: dayKey, dayLabel: dayLabel, startOfToday: startOfToday,
    isFinal: isFinal, isLive: isLive, isOff: isOff, computeRecords: computeRecords, num: num,
    INDEX_POINTS: INDEX_POINTS, vpaDiv: vpaDiv, indexSkipReason: indexSkipReason, standings: standings, pct: pct, recText: recText, sortLeague: sortLeague, sortIndex: sortIndex, ordinal: ordinal, teamRankings: teamRankings,
    STAT_COLS: STAT_COLS, gradeLabel: gradeLabel, fixCase: fixCase, aggregateStats: aggregateStats,
    gameCardHTML: gameCardHTML, wireCards: wireCards, renderChrome: renderChrome
  };
})();
if (typeof module !== 'undefined') module.exports = VBN;
