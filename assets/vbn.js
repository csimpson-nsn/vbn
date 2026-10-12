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
    teams:    'https://docs.google.com/spreadsheets/d/e/2PACX-1vR124tvUPhqDU7cJ9fw2H2YQXvNP_XcH5F76KlxUwDdgJ_nv12PpyLHGeIWErXDzT3uxLoh_kxyvmmI/pub?gid=1570140558&single=true&output=csv'
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
  function leagueOf(name, gender) {            // 'Metro', 'Lake', 'Capital', 'Mountain' or ''
    var t = team(name, gender); return t && t.League ? t.League.split(' ')[0] : '';
  }
  function isMember(name, gender) { var t = team(name, gender); return !!(t && t.NVAC === 'Yes'); }
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
    else if (!ap && h < 10) h += 12;        // no AM/PM written: NVAC tips are 10:00 AM or later
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
  var NAV = [['index.html', 'Home'], ['schedule.html', 'Schedule']];   // add pages here as they are built

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
        '<div class="footer-col"><h4>Watch</h4><a href="schedule.html">Full Schedule</a><a href="https://store.nsnsports.net/" target="_blank" rel="noopener">Video Archive</a></div>' +
        '<div class="footer-col"><h4>Partner With Us</h4><a href="mailto:' + CONTACT + '?subject=VBN%20Sponsorship">Sponsorship Packages</a><a href="mailto:' + CONTACT + '?subject=VBN%20Title%20Sponsor">Title Sponsor Inquiry</a></div>' +
        '<div class="footer-col"><h4>Follow Us</h4><a href="https://www.facebook.com/nsnsports" target="_blank" rel="noopener">Facebook</a><a href="https://www.instagram.com/nsnsports" target="_blank" rel="noopener">Instagram</a><a href="https://www.youtube.com/@nsnsportsvt" target="_blank" rel="noopener">YouTube</a></div>' +
        '</div><div class="footer-bottom"><span>&copy; ' + new Date().getFullYear() + ' Northeast Sports Network. All rights reserved.</span><span>VBN: Vermont Basketball Network</span></div></div>';
    }
  }

  return {
    SEASON_YEAR: SEASON_YEAR, CONTACT: CONTACT,
    esc: esc, parseCSV: parseCSV, loadSource: loadSource, loadTeams: loadTeams, setTeams: setTeams,
    team: team, displayName: displayName, leagueOf: leagueOf, isMember: isMember, key: key, norm: norm,
    parseDate: parseDate, parseTime: parseTime, timeLabel: timeLabel, gameStart: gameStart, sortTime: sortTime,
    dayKey: dayKey, dayLabel: dayLabel, startOfToday: startOfToday,
    isFinal: isFinal, isLive: isLive, isOff: isOff, computeRecords: computeRecords,
    gameCardHTML: gameCardHTML, wireCards: wireCards, renderChrome: renderChrome
  };
})();
if (typeof module !== 'undefined') module.exports = VBN;
