# Google setup — sign-in and the leaderboard

Everything here is free. No card, no billing account, nothing to cancel later.
Budget about **30 minutes**.

You are building three things that talk to each other:

```
   challenge.html                Google Cloud              Google Sheet
   (your website)                (checks who               (stores the
        |                         someone is)               scores)
        |                              ^                        ^
        |  1. person signs in ─────────┘                        |
        |  2. score is posted ──────────────► Apps Script ──────┘
                                              (the code you paste)
```

At the end you will have **two values**. Paste them into `challenge.html`,
or send them to me and I will:

1. **Client ID** — looks like `1234567890-abc123.apps.googleusercontent.com`
2. **Web app URL** — looks like `https://script.google.com/macros/s/AKfy…/exec`

---

## Part 0 — Which Google account (decide this first)

**Any Google account works.** A free `@gmail.com` is enough — no Workspace
subscription, no card, no billing account.

But choose deliberately, because this account is hard to change later and two
things about it are not obvious:

**It owns everything.** The Cloud project, the Sheet, the Apps Script and every
score in it all belong to whichever account creates them. Moving them to a
different account later means redoing the whole setup and re-issuing the
Client ID.

**Its support email is shown publicly.** When a visitor taps "Sign in with
Google", the screen displays your app name and the support email you entered.
Everyone who signs in sees that address. A personal address looks careless
here; something like `psysupport.in@gmail.com` does not.

**Do not use your everyday personal Gmail.** That account is about to hold your
clients' names, emails and phone numbers. Keeping that separate from your
personal mail is worth the five minutes:

1. Create a new free Google account, e.g. `psysupport.in@gmail.com`
2. Turn on **2-step verification** on it immediately, before anything else
3. Use that account for every step below

If you later get Google Workspace on your own domain, an address like
`hello@psysupport.in` is better still — but a free Gmail is perfectly fine to
start, and nothing about this setup has to change if you upgrade later.

---

## Part 1 — Create the Sheet (3 minutes)

1. Go to **[sheets.new](https://sheets.new)**
2. Name it **PsySupport Challenge**
3. That is all. The columns create themselves the first time someone plays.

> ⚠️ **Never set this Sheet to "Anyone with the link".** It will hold people's
> phone numbers and email addresses. Keep it private to your account.

---

## Part 2 — Paste in the code (5 minutes)

1. In that Sheet: **Extensions → Apps Script**
2. Delete the few lines of placeholder code that are already there
3. Open **`apps-script.gs`** from the website files, copy **all** of it, paste it in
4. Click **Save** (the 💾 icon)

Leave this tab open. You come back to it in Part 4.

Do **not** deploy yet — the code needs your Client ID first.

---

## Part 3 — Google Cloud (15 minutes)

This is the part that sounds intimidating and is not. You are only creating an
ID so Google can tell you who signed in.

### 3a. Make a project

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. At the top, click the project dropdown → **New Project**
3. Name: **PsySupport** → **Create**
4. Wait a few seconds, then make sure the dropdown now shows **PsySupport**

### 3b. Set up the consent screen

This is what people see when they click "Sign in with Google".

1. Left menu → **APIs & Services → OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in only three fields:
   - **App name:** `PsySupport`
   - **User support email:** your email
   - **Developer contact information:** your email
4. **Save and Continue**
5. On the **Scopes** screen, add nothing at all → **Save and Continue**
6. On **Test users**, add nothing → **Save and Continue** → **Back to Dashboard**
7. Now find the **Publish App** button and click it → **Confirm**

> **Publishing matters.** Left in "Testing" mode only a handful of people can
> sign in, and their sessions expire after a week.
>
> **You will not need Google's verification review.** That is only required for
> apps requesting sensitive data. Signing in gives you a name and an email,
> which Google treats as basic, so publishing takes effect immediately and your
> visitors see a normal sign-in screen with no warnings.

### 3c. Create the Client ID

1. Left menu → **APIs & Services → Credentials**
2. **+ Create Credentials → OAuth client ID**
3. **Application type:** Web application
4. **Name:** `PsySupport Website`
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add **both**:

   ```
   https://www.psysupport.in
   https://psysupport.in
   ```

   Type them exactly — with `https://`, and with no slash on the end.

6. Leave **Authorized redirect URIs** completely empty. You do not need them.
7. **Create**

A box appears with your **Client ID**. **Copy it now** and keep it somewhere.
You can always find it again under Credentials.

---

## Part 4 — Put the Client ID in the script (2 minutes)

1. Back to the Apps Script tab
2. Find this near the top:

   ```js
   var CLIENT_ID = 'PASTE-YOUR-CLIENT-ID-HERE.apps.googleusercontent.com';
   ```

3. Replace it with your real one, keeping the quote marks:

   ```js
   var CLIENT_ID = '1234567890-abc123.apps.googleusercontent.com';
   ```

4. **Save**

This is what stops someone posting fake scores into your Sheet. The script
checks every sign-in against Google, and rejects anything issued for a
different app.

---

## Part 5 — Deploy (5 minutes)

1. Top right → **Deploy → New deployment**
2. Click the **gear icon** next to "Select type" → choose **Web app**
3. Set:
   - **Description:** `PsySupport challenge`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone** ← must be this, or the website cannot reach it
4. **Deploy**
5. Google asks for permission → **Authorize access** → pick your account
6. You will see **"Google hasn't verified this app"**. This is your own script
   asking to use your own Sheet, and only you ever see this screen.
   Click **Advanced → Go to PsySupport (unsafe)** → **Allow**
7. Copy the **Web app URL**. It ends in `/exec`

> **Remember for later:** editing the code does nothing on its own. Every time
> you change it you must do **Deploy → New deployment** again, or the website
> keeps using the old version.

---

## Part 6 — Switch it on (2 minutes)

Open `challenge.html` and find this near the top of the `<script>` block:

```js
var CONFIG = {
  clientId: "",
  endpoint: ""
};
```

Fill both in:

```js
var CONFIG = {
  clientId: "1234567890-abc123.apps.googleusercontent.com",
  endpoint: "https://script.google.com/macros/s/AKfy.../exec"
};
```

Save, commit, push. That is the whole switch — the sign-in button and the real
leaderboard appear on their own.

Or just send me the two values and I will do it.

---

## Part 7 — Automatic clean-up (2 minutes)

You decided leads are deleted after the person's session. To make that run by
itself:

1. In Apps Script, left sidebar → **Triggers** (the ⏰ icon)
2. **+ Add Trigger**
3. Set:
   - **Function to run:** `cleanUp`
   - **Event source:** Time-driven
   - **Type:** Day timer
   - **Time of day:** anything
4. **Save**

---

## Running it each week

### Monday: pick the winners

1. Apps Script → choose **`weeklyWinners`** from the function dropdown → **Run**
2. **View → Logs** shows last week's top fifteen

The log flags anyone who did **not** consent to being contacted. Email those
people their prize code only — do not call them.

### New questions each week

In `challenge.html`, replace the `QUESTIONS` list and update `WEEK_TITLE`.
The week number works itself out from the date.

### After someone's session

In Apps Script, run `markSessionDone("their@email.com")`. Their row is deleted
automatically 30 days later.

### If someone asks to be removed

Run `forgetPerson("their@email.com")`. You are required to do this, and it
takes a minute.

---

## Your daily rules

| | |
|---|---|
| 📞 | Only contact people whose **May contact** column says `YES` |
| ❌ | Never call someone whose column says `no` — having their number is not permission |
| 👤 | Only show names where **Show name** says `YES`; everyone else is a player number |
| 🔒 | Turn on **2-step verification** on your Google account — it now holds people's phone numbers |
| 🗑️ | Let `cleanUp` do its job. Keeping leads "just in case" is exactly what you may not do |

---

## When something does not work

| What you see | What is wrong |
|---|---|
| No sign-in button on the page | `clientId` is still empty in `challenge.html`, or the origins in Part 3c are missing `https://` or the `www` version |
| Sign-in appears then fails | The Client ID in the Apps Script does not match the one in `challenge.html` |
| Board says it cannot load | Deployment is not set to **Anyone**, or you have not deployed since editing |
| Scores are not arriving | Same as above — nearly always a missed re-deployment |
| Only some people can sign in | The consent screen is still in **Testing**. Publish it (Part 3b step 7) |
| Code changes have no effect | You saved but did not **Deploy → New deployment** |

---

## Before the first person signs in

Two things are not optional once you are storing names, emails and phone
numbers:

1. **Privacy policy** — must say what you collect, why, how long you keep it,
   and how someone gets it deleted
2. **Competition terms** — who may enter, how winners are chosen, what the
   prizes are, and that they cannot be swapped for cash

Ask me and I will write both.
