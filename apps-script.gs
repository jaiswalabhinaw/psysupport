/**
 * PsySupport — lead capture backend
 * =================================
 * Google Apps Script. Free, runs inside your own Google account.
 * Paste this into the Apps Script editor attached to your leads Sheet.
 * Full instructions are in SETUP-GOOGLE.md.
 *
 * WHAT THIS STORES:  name, email, phone, consent, how many diary entries.
 * WHAT IT NEVER STORES:  moods, sleep, tags, notes. Those stay on the
 * visitor's phone. Keeping that line is what keeps you out of holding
 * health records — do not add mood columns to this sheet later.
 */

// The Google OAuth Client ID you created. Must match the website's.
var CLIENT_ID = 'PASTE-YOUR-CLIENT-ID-HERE.apps.googleusercontent.com';

// Tab name inside the spreadsheet. Created automatically if missing.
var TAB = 'Leads';

var HEADERS = [
  'Timestamp', 'Name', 'Email', 'Phone', 'Consent to contact',
  'Diary entries', 'Google ID', 'Status', 'Delete after'
];


/** Browsers send a preflight before the real POST. */
function doOptions() {
  return ContentService.createTextOutput('');
}

function doGet() {
  return json({ ok: true, msg: 'PsySupport lead endpoint is running.' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'empty request' });
    }

    var body = JSON.parse(e.postData.contents);

    // ---- Verify the Google token ---------------------------------
    // This URL is public, so without this check anyone could post
    // fake leads into your sheet. Google checks the signature for us.
    var who = verify(body.credential);
    if (!who) return json({ ok: false, error: 'sign-in could not be verified' });

    // ---- Only ever take the fields we mean to keep ----------------
    var phone = String(body.phone || '').replace(/[^0-9+]/g, '').slice(0, 15);
    var consent = body.consent === true;
    var entries = Math.min(parseInt(body.entries, 10) || 0, 100000);

    var sheet = openSheet();

    // One row per person. A second sign-in updates, never duplicates.
    var found = findRow(sheet, who.sub);
    var row = [
      new Date(),
      who.name || '',
      who.email || '',
      phone,
      consent ? 'YES' : 'no',
      entries,
      who.sub,
      'active',
      ''                                  // filled when you mark the session done
    ];

    if (found > 0) {
      // Keep the original signup date and any delete-after date already set.
      row[0] = sheet.getRange(found, 1).getValue() || new Date();
      row[8] = sheet.getRange(found, 9).getValue() || '';
      sheet.getRange(found, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return json({ ok: true, name: who.name });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}


/**
 * Asks Google whether this token is real and was issued for our app.
 * Returns the person's details, or null if anything is off.
 */
function verify(credential) {
  if (!credential) return null;
  try {
    var res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) return null;

    var t = JSON.parse(res.getContentText());

    if (t.aud !== CLIENT_ID) return null;                    // issued for someone else's app
    if (t.iss !== 'accounts.google.com' &&
        t.iss !== 'https://accounts.google.com') return null;
    if (parseInt(t.exp, 10) * 1000 < Date.now()) return null; // expired
    if (!t.sub) return null;

    return { sub: t.sub, email: t.email || '', name: t.name || '' };
  } catch (e) {
    return null;
  }
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
  var ids = sheet.getRange(2, 7, last - 1, 1).getValues();   // column G
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(sub)) return i + 2;
  }
  return -1;
}


function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ================================================================
   RETENTION — "delete after the session"
   ================================================================
   You decided leads are removed once the person has had their
   session. Two helpers for that:

   1. markSessionDone(email)
      Run this after a session. It sets a delete-after date 30 days
      out — enough for follow-up, then gone.

   2. cleanUp()
      Deletes every row whose delete-after date has passed, and any
      row older than a year that never became a client.
      Set this to run daily: Apps Script → Triggers → Add Trigger →
      cleanUp → Time-driven → Day timer.

   Keeping a lead forever "just in case" is exactly what the law does
   not allow, and it is also the thing that turns a small mistake into
   a large one.
   ================================================================ */

function markSessionDone(email) {
  var sheet = openSheet();
  var last = sheet.getLastRow();
  if (last < 2) return;

  var rows = sheet.getRange(2, 3, last - 1, 1).getValues();   // column C, email
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(email).toLowerCase()) {
      var when = new Date();
      when.setDate(when.getDate() + 30);
      sheet.getRange(i + 2, 8).setValue('session done');
      sheet.getRange(i + 2, 9).setValue(when);
      return;
    }
  }
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
    var signedUp = data[i][0];
    var deleteAfter = data[i][8];

    var due = deleteAfter && new Date(deleteAfter) <= now;
    var stale = signedUp && new Date(signedUp) < yearAgo && data[i][7] !== 'client';

    if (due || stale) sheet.deleteRow(i + 2);
  }
}

/**
 * Someone asked you to remove their data. Run this with their email.
 * You are required to honour this, and it should take one minute.
 */
function forgetPerson(email) {
  var sheet = openSheet();
  var last = sheet.getLastRow();
  if (last < 2) return 'no rows';

  var rows = sheet.getRange(2, 3, last - 1, 1).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]).toLowerCase() === String(email).toLowerCase()) {
      sheet.deleteRow(i + 2);
      return 'deleted ' + email;
    }
  }
  return 'not found';
}
