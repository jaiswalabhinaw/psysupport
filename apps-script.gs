/**
 * PsySupport — Weekly Challenge backend
 * =====================================
 * Google Apps Script. Free, runs inside your own Google account.
 * Paste into the Apps Script editor attached to your Sheet.
 * Setup instructions: SETUP-GOOGLE.md
 *
 * STORES:      name, email, phone, quiz score, and three separate consents.
 * NEVER STORES: moods, sleep, diary notes. Those stay on the player's phone.
 *
 * That line is the whole reason this stays simple. A quiz score is an
 * ordinary score. A mood record is health data. Do not add mood columns
 * to this sheet later — it changes what you are legally holding.
 */

// From SETUP-GOOGLE.md part 3. Must match the website exactly.
var CLIENT_ID = 'PASTE-YOUR-CLIENT-ID-HERE.apps.googleusercontent.com';

var TAB = 'Players';

var HEADERS = [
  'First seen', 'Last played', 'Name', 'Email', 'Phone',
  'Show name', 'May contact', 'Wants tips',
  'Week', 'Score', 'Total', 'Seconds',
  'Google ID', 'Player no', 'Status', 'Delete after'
];

// Column numbers, so the code below reads clearly.
var C = {
  first: 1, last: 2, name: 3, email: 4, phone: 5,
  showName: 6, mayContact: 7, wantsTips: 8,
  week: 9, score: 10, total: 11, seconds: 12,
  googleId: 13, playerNo: 14, status: 15, deleteAfter: 16
};


/* ==================================================================
   READ — the public leaderboard
   ================================================================== */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || '';

    if (action === 'board') {
      return json({ ok: true, rows: board((e.parameter.week || '').toString()) });
    }
    return json({ ok: true, msg: 'PsySupport challenge endpoint is running.' });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * Top 15 for a given week.
 * Only ever returns a name when that player ticked "show my name".
 * Everyone else comes back with a player number and no name at all,
 * so an unticked box cannot leak through this endpoint.
 */
function board(week) {
  var sheet = openSheet();
  var last = sheet.getLastRow();
  if (last < 2) return [];

  var data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var out = [];

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (week && String(r[C.week - 1]) !== week) continue;
    if (!r[C.score - 1] && r[C.score - 1] !== 0) continue;

    out.push({
      name: r[C.showName - 1] === 'YES' ? String(r[C.name - 1]) : '',
      id: r[C.playerNo - 1] || (i + 1),
      score: Number(r[C.score - 1]),
      // seconds is used only to break ties, never shown
      t: Number(r[C.seconds - 1]) || 99999
    });
  }

  out.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;   // higher score first
    return a.t - b.t;                                    // then faster time
  });

  return out.slice(0, 15).map(function (r) {
    return { name: r.name, id: r.id, score: r.score };
  });
}


/* ==================================================================
   WRITE — a submitted score
   ================================================================== */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'empty request' });
    }

    var body = JSON.parse(e.postData.contents);

    // The endpoint URL is public, so without this anyone could post
    // whatever they liked. Google checks the signature for us.
    var who = verify(body.credential);
    if (!who) return json({ ok: false, error: 'sign-in could not be verified' });

    var total = clampInt(body.total, 0, 100);
    var score = clampInt(body.score, 0, total || 100);
    var seconds = clampInt(body.seconds, 0, 86400);
    var week = String(body.week || '').slice(0, 10);
    var phone = String(body.phone || '').replace(/[^0-9+]/g, '').slice(0, 15);

    var showName = body.showName === true;
    var mayContact = body.mayContact === true;
    var wantsTips = body.wantsTips === true;

    var sheet = openSheet();
    var row = findRow(sheet, who.sub);
    var now = new Date();

    if (row > 0) {
      var sameWeek = String(sheet.getRange(row, C.week).getValue()) === week;
      var previous = Number(sheet.getRange(row, C.score).getValue());

      sheet.getRange(row, C.last).setValue(now);
      sheet.getRange(row, C.name).setValue(who.name || '');
      sheet.getRange(row, C.email).setValue(who.email || '');
      if (phone) sheet.getRange(row, C.phone).setValue(phone);
      sheet.getRange(row, C.showName).setValue(showName ? 'YES' : 'no');
      sheet.getRange(row, C.mayContact).setValue(mayContact ? 'YES' : 'no');
      sheet.getRange(row, C.wantsTips).setValue(wantsTips ? 'YES' : 'no');

      // Within a week, only an improvement replaces what is there —
      // so retaking the quiz can never cost someone their place.
      if (!sameWeek || score > previous) {
        sheet.getRange(row, C.week).setValue(week);
        sheet.getRange(row, C.score).setValue(score);
        sheet.getRange(row, C.total).setValue(total);
        sheet.getRange(row, C.seconds).setValue(seconds);
      }
    } else {
      sheet.appendRow([
        now, now, who.name || '', who.email || '', phone,
        showName ? 'YES' : 'no', mayContact ? 'YES' : 'no', wantsTips ? 'YES' : 'no',
        week, score, total, seconds,
        who.sub, nextPlayerNo(sheet), 'active', ''
      ]);
    }

    return json({ ok: true, name: who.name || '' });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}


/* ==================================================================
   HELPERS
   ================================================================== */

/** Asks Google whether this token is real and was issued for our app. */
function verify(credential) {
  if (!credential) return null;
  try {
    var res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;

    var t = JSON.parse(res.getContentText());
    if (t.aud !== CLIENT_ID) return null;                       // someone else's app
    if (t.iss !== 'accounts.google.com' &&
        t.iss !== 'https://accounts.google.com') return null;
    if (parseInt(t.exp, 10) * 1000 < Date.now()) return null;   // expired
    if (!t.sub) return null;

    return { sub: t.sub, email: t.email || '', name: t.name || '' };
  } catch (e) {
    return null;
  }
}

function clampInt(v, lo, hi) {
  var n = parseInt(v, 10);
  if (isNaN(n)) return 0;
  return Math.max(lo, Math.min(hi, n));
}

function openSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TAB);
  if (!sheet) {
    sheet = ss.insertSheet(TAB);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow(sheet, sub) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, C.googleId, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(sub)) return i + 2;
  }
  return -1;
}

function nextPlayerNo(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return 1;
  var nums = sheet.getRange(2, C.playerNo, last - 1, 1).getValues();
  var top = 0;
  for (var i = 0; i < nums.length; i++) {
    var n = parseInt(nums[i][0], 10);
    if (!isNaN(n) && n > top) top = n;
  }
  return top + 1;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ==================================================================
   PICKING WINNERS
   Run weeklyWinners() on a Monday. It prints the top 15 for last
   week, with contact details only for those who allowed contact.
   ================================================================== */
function weeklyWinners() {
  var d = new Date();
  d.setDate(d.getDate() - 7);
  var week = isoWeek(d);

  var sheet = openSheet();
  var last = sheet.getLastRow();
  if (last < 2) { Logger.log('No players yet.'); return; }

  var data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var players = [];

  for (var i = 0; i < data.length; i++) {
    if (String(data[i][C.week - 1]) !== week) continue;
    players.push({
      name: data[i][C.name - 1],
      email: data[i][C.email - 1],
      phone: data[i][C.phone - 1],
      contact: data[i][C.mayContact - 1] === 'YES',
      score: Number(data[i][C.score - 1]),
      t: Number(data[i][C.seconds - 1]) || 99999
    });
  }

  players.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.t - b.t;
  });

  Logger.log('Winners for ' + week + ':');
  players.slice(0, 15).forEach(function (p, n) {
    var prize = n === 0 ? 'FREE SESSION' : n < 3 ? '50% off' : '25% off';
    Logger.log(
      (n + 1) + '. ' + p.name + ' — ' + p.score + ' — ' + prize + ' — ' +
      (p.contact ? (p.email + ' ' + (p.phone || 'no phone'))
                 : 'DID NOT CONSENT TO CONTACT — email the prize only, do not call')
    );
  });
}

function isoWeek(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  var start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var wk = Math.ceil((((d - start) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + ('0' + wk).slice(-2);
}


/* ==================================================================
   RETENTION — "delete after the session", as you decided.

   markSessionDone(email)  after someone has had their session; sets a
                           delete-after date 30 days out.
   forgetPerson(email)     someone asked to be removed. You have to do
                           this, and it should take a minute.
   cleanUp()               deletes what is due. Set this to run daily:
                           Triggers → Add Trigger → cleanUp → Day timer.
   ================================================================== */
function markSessionDone(email) {
  var sheet = openSheet();
  var row = findByEmail(sheet, email);
  if (row < 0) return 'not found';

  var when = new Date();
  when.setDate(when.getDate() + 30);
  sheet.getRange(row, C.status).setValue('session done');
  sheet.getRange(row, C.deleteAfter).setValue(when);
  return 'marked ' + email;
}

function forgetPerson(email) {
  var sheet = openSheet();
  var row = findByEmail(sheet, email);
  if (row < 0) return 'not found';
  sheet.deleteRow(row);
  return 'deleted ' + email;
}

function findByEmail(sheet, email) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var rows = sheet.getRange(2, C.email, last - 1, 1).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(email).toLowerCase()) return i + 2;
  }
  return -1;
}

function cleanUp() {
  var sheet = openSheet();
  var last = sheet.getLastRow();
  if (last < 2) return;

  var data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var now = new Date();
  var yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  // Walk upwards so deleting a row does not shift the ones still to check.
  for (var i = data.length - 1; i >= 0; i--) {
    var deleteAfter = data[i][C.deleteAfter - 1];
    var lastPlayed = data[i][C.last - 1];

    var due = deleteAfter && new Date(deleteAfter) <= now;
    var stale = lastPlayed && new Date(lastPlayed) < yearAgo &&
                data[i][C.status - 1] !== 'client';

    if (due || stale) sheet.deleteRow(i + 2);
  }
}
