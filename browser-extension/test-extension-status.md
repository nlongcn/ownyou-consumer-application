# Extension Testing - Quick Status Check

Based on your screenshots showing "All done!" from Microsoft, the authentication **should have succeeded**. Here's how to verify:

## Quick Console Checks

### 1. Check Extension Popup Status

Open the extension popup (click the puzzle piece icon → OwnYou):

**Expected to see:**
- ✅ Authenticated
- Account: nlongcroft@hotmail.com
- Expires in: ~89-90 days
- "Logout" button visible

**If you see "Not authenticated":**
- The service worker may have crashed after authentication
- Try refreshing the extension (toggle OFF/ON at chrome://extensions/)

---

### 2. Check Service Worker Console

1. Go to `chrome://extensions/`
2. Find "OwnYou Personal AI Extension"
3. Click blue "service worker" link
4. Look for these log messages:

**Expected logs:**
```
OwnYou Extension Background Worker Started
Starting Microsoft authentication...
Starting token polling. Expires in 900 seconds (15 minutes)
Poll #1 (0s elapsed, 900s remaining)
Poll response: authorization_pending
...
✅ Token received successfully after Xs and Y polls
✅ Tokens encrypted and stored for microsoft
⏰ Token refresh scheduled for microsoft
```

**If no logs visible:**
- Service worker may have slept (normal Manifest V3 behavior)
- Click popup to wake it up
- Or run the verification script below

---

### 3. Run Verification Script (Recommended)

In the service worker console, paste this:

```javascript
// Quick token verification
chrome.storage.local.get(['tokens_microsoft'], (result) => {
  console.log('=== TOKEN STORAGE CHECK ===');

  if (!result.tokens_microsoft) {
    console.error('❌ NO TOKENS FOUND');
    console.log('This means authentication did not complete.');
    console.log('Try authenticating again from the popup.');
    return;
  }

  const tokens = result.tokens_microsoft;

  console.log('✅ Tokens found!');
  console.log('');
  console.log('Storage structure:');
  console.log('├─ data (encrypted):', tokens.data ? `Array[${tokens.data.length}]` : '❌ MISSING');
  console.log('├─ iv (encryption IV):', tokens.iv ? `Array[${tokens.iv.length}]` : '❌ MISSING');
  console.log('├─ accountEmail:', tokens.accountEmail || '❌ MISSING');
  console.log('└─ expiresAt:', tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : '❌ MISSING');
  console.log('');

  if (tokens.expiresAt) {
    const now = Date.now();
    const daysRemaining = Math.floor((tokens.expiresAt - now) / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor(((tokens.expiresAt - now) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    console.log('Token expiration:');
    console.log('├─ Expires:', new Date(tokens.expiresAt).toLocaleString());
    console.log('├─ Remaining:', daysRemaining, 'days', hoursRemaining, 'hours');

    if (daysRemaining >= 60) {
      console.log('└─ ✅ SUCCESS! This is a 90-day token');
    } else if (daysRemaining >= 1) {
      console.log('└─ ⚠️ WARNING: Expected 90 days, got', daysRemaining);
    } else {
      console.log('└─ ❌ ERROR: Token expires in <1 day (should be 90 days)');
    }
  }

  console.log('');
  console.log('=== END CHECK ===');
});

// Check if token refresh is scheduled
chrome.alarms.getAll((alarms) => {
  console.log('');
  console.log('=== SCHEDULED ALARMS ===');

  const refreshAlarm = alarms.find(a => a.name === 'tokenRefresh-microsoft');

  if (refreshAlarm) {
    const nextRefresh = new Date(refreshAlarm.scheduledTime);
    const minutesUntil = Math.floor((refreshAlarm.scheduledTime - Date.now()) / (1000 * 60));

    console.log('✅ Token refresh scheduled:');
    console.log('├─ Next refresh:', nextRefresh.toLocaleString());
    console.log('└─ In:', minutesUntil, 'minutes');
  } else {
    console.log('⚠️ No token refresh alarm found');
    console.log('This may be normal if service worker restarted');
  }

  console.log('=== END ALARMS ===');
});
```

---

## Expected Results

### ✅ SUCCESS (Everything Working)

**Popup shows:**
- ✅ Authenticated
- Account: nlongcroft@hotmail.com
- Expires in: 89 days

**Console shows:**
```
✅ Tokens found!

Storage structure:
├─ data (encrypted): Array[XXX]
├─ iv (encryption IV): Array[12]
├─ accountEmail: nlongcroft@hotmail.com
└─ expiresAt: 2025-04-14T...

Token expiration:
├─ Expires: April 14, 2025...
├─ Remaining: 89 days XX hours
└─ ✅ SUCCESS! This is a 90-day token

✅ Token refresh scheduled:
├─ Next refresh: [date]
└─ In: XX minutes
```

### ❌ PROBLEM (Needs Fix)

**Popup shows:**
- ❌ Not authenticated

**Console shows:**
```
❌ NO TOKENS FOUND
```

**Fix:** Try authenticating again from the popup

---

## What the Screenshots Tell Us

### Screenshot 1: Extension Popup During Auth
- Device code: CM8D8GCCP ✅
- "Waiting for authentication..." ✅
- Code displayed properly (fix worked!) ✅

### Screenshot 2: Microsoft Success Page
- "All done!" ✅
- "You're now signed in to OwnYou Email Agent $Test$" ✅
- Authentication completed on Microsoft's side ✅

**This confirms:**
1. ✅ Device code flow initiated successfully
2. ✅ User entered code correctly
3. ✅ Microsoft accepted authentication
4. ✅ Token should have been issued

**What we need to verify:**
- Did the background worker receive the token?
- Did crypto-module.js encrypt it?
- Did chrome.storage.local save it?

---

## Troubleshooting

### Service Worker Died Before Storing Tokens

**Symptom:** Microsoft says "All done!" but extension shows "Not authenticated"

**Cause:** Service worker terminated during token polling (Manifest V3 can kill workers after 30 seconds)

**Fix:**
1. Toggle extension OFF then ON at chrome://extensions/
2. Click popup to wake service worker
3. Try authenticating again

### Storage Key Mismatch

**Symptom:** Console shows no tokens under `tokens_microsoft`

**Fix:** Try checking alternate storage keys:
```javascript
chrome.storage.local.get(null, (all) => {
  console.log('All stored data:', all);
});
```

Look for keys like:
- `tokens_microsoft`
- `ownyou_tokens_microsoft`
- `microsoft_tokens`

### Encryption Failed

**Symptom:** Token received but not stored

**Check:** Service worker console for errors like:
- "Failed to encrypt tokens"
- "Crypto error"
- "deriveEncryptionKey failed"

---

## Next Steps

1. **Check extension popup** - Should show "✅ Authenticated"
2. **Run verification script** - In service worker console
3. **Share results** - Screenshot or paste console output

Then we can:
- Confirm 90-day token lifetime
- Test PWA integration (window.OwnYouAuth)
- Set up 25-hour test to verify token outlives SPA tokens

---

**Status:** Awaiting verification of token storage
**Expected:** 90-day tokens encrypted and stored successfully
**Next:** Confirm via console check
