# Google login + leads — setup guide

यह आपके करने का काम है। सब मुफ़्त, कोई card नहीं। लगभग **25 मिनट**।

आख़िर में मुझे **दो values** भेजनी हैं — मैं website में जोड़ दूँगा:

1. **Client ID** — `…apps.googleusercontent.com`
2. **Apps Script URL** — `https://script.google.com/macros/s/…/exec`

---

## भाग 1 — Google Sheet बनाइए (3 मिनट)

1. [sheets.new](https://sheets.new) खोलिए
2. नाम दीजिए: **PsySupport Leads**
3. बस। Columns अपने आप बन जाएँगे।

⚠️ इस Sheet को **कभी "anyone with link" मत कीजिए**। इसमें लोगों के नंबर होंगे।

---

## भाग 2 — Apps Script लगाइए (8 मिनट)

1. उसी Sheet में: **Extensions → Apps Script**
2. जो code दिखे उसे मिटा दीजिए
3. `apps-script.gs` फ़ाइल का पूरा code copy करके paste कीजिए
4. **Save** (💾)

अभी deploy मत कीजिए — पहले Client ID चाहिए।

---

## भाग 3 — Google Client ID (10 मिनट)

1. [console.cloud.google.com](https://console.cloud.google.com) खोलिए
2. ऊपर से **New Project** → नाम **PsySupport** → Create

**OAuth screen सेट कीजिए:**

3. बाएँ मेन्यू → **APIs & Services → OAuth consent screen**
4. **External** चुनिए → Create
5. भरिए:
   - App name: **PsySupport**
   - User support email: आपका email
   - Developer contact: आपका email
6. Save and Continue → Scopes पर कुछ मत जोड़िए → Save → Back to Dashboard
7. **Publish App** दबाइए → Confirm

> **Publish ज़रूरी है।** नहीं तो सिर्फ़ 100 लोग login कर पाएँगे, और "unverified app" की चेतावनी आएगी।

**Client ID बनाइए:**

8. **APIs & Services → Credentials**
9. **+ Create Credentials → OAuth client ID**
10. Application type: **Web application**
11. Name: **PsySupport Website**
12. **Authorized JavaScript origins** में दोनों जोड़िए:
    ```
    https://www.psysupport.in
    https://psysupport.in
    ```
13. Create → एक box में **Client ID** दिखेगा → **copy कर लीजिए**

---

## भाग 4 — Client ID को Script में डालिए (2 मिनट)

1. Apps Script पर वापस जाइए
2. सबसे ऊपर वाली लाइन में अपना Client ID डालिए:
   ```js
   var CLIENT_ID = 'यहाँ-आपका-client-id.apps.googleusercontent.com';
   ```
3. **Save**

---

## भाग 5 — Deploy कीजिए (3 मिनट)

1. ऊपर दाएँ → **Deploy → New deployment**
2. ⚙️ (gear) → **Web app**
3. भरिए:
   - Description: `PsySupport leads`
   - Execute as: **Me**
   - Who has access: **Anyone**    ← ज़रूरी है
4. **Deploy**
5. Google permission माँगेगा → **Authorize access** → अपना account चुनिए
6. "Google hasn't verified this app" आए तो → **Advanced → Go to PsySupport (unsafe)**
   *(यह आपका ही script है, इसलिए ठीक है)*
7. **Web app URL** copy कर लीजिए — `…/exec` पर ख़त्म होता है

---

## भाग 6 — रोज़ की सफ़ाई चालू कीजिए (2 मिनट)

आपने तय किया: **session के बाद lead delete**। उसे अपने आप चलाने के लिए —

1. Apps Script में बाएँ → **Triggers** (⏰)
2. **+ Add Trigger**
3. भरिए:
   - Function: **cleanUp**
   - Event source: **Time-driven**
   - Type: **Day timer** → कोई भी समय
4. Save

अब हर रोज़ पुराने leads अपने आप हट जाएँगे।

---

## अब मुझे भेजिए

```
Client ID       : ......................apps.googleusercontent.com
Apps Script URL : https://script.google.com/macros/s/....../exec
```

ये दोनों **गुप्त नहीं** हैं — website में वैसे भी दिखेंगे। असली सुरक्षा token verify करने से आती है, जो script में पहले से लगा है।

---

## रोज़मर्रा का इस्तेमाल

**Sheet ऐसी दिखेगी:**

| Timestamp | Name | Email | Phone | Consent | Entries | Google ID | Status | Delete after |
|---|---|---|---|---|---|---|---|---|
| 28 Aug | राहुल शर्मा | rahul@… | 98xxx | **YES** | 12 | 1029… | active | |
| 28 Aug | प्रिया | priya@… | | no | 3 | 1183… | active | |

**नियम — इसे टालिए मत:**

- 📞 सिर्फ़ उन्हें फ़ोन कीजिए जिनका **Consent = YES** है
- ❌ जिनका `no` है, उन्हें **कभी** मत कीजिए — नंबर होते हुए भी
- ✅ Session हो जाए → Apps Script में `markSessionDone("email")` चलाइए
- 🗑️ कोई कहे "मेरा data हटाओ" → `forgetPerson("email")` चलाइए
- 🔒 अपने Google account पर **2-step verification** ज़रूर लगाइए — अब उसमें लोगों के नंबर हैं

---

## दिक़्क़त आए तो

| समस्या | वजह |
|---|---|
| Login बटन नहीं दिखता | origins में `https://` लगाना भूल गए, या `www` वाला नहीं डाला |
| "unverified app" | OAuth screen **Publish** नहीं किया |
| Sheet में कुछ नहीं आ रहा | deployment "Anyone" पर नहीं, या Client ID दोनों जगह अलग है |
| Code बदला पर असर नहीं | हर बदलाव के बाद **New deployment** करना पड़ता है |

---

## आख़िरी बात

यह चालू करने से पहले **privacy policy अपडेट करनी ज़रूरी है** — नाम, email और नंबर इकट्ठा करते ही यह क़ानूनी ज़रूरत बन जाती है, सलाह नहीं। मुझसे कहिए, मैं लिख दूँगा।
