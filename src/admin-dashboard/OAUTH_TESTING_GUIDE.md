# OAuth PKCE Testing Guide

## ✅ Current Status

**Implementation:** COMPLETE
**Error Handling:** IMPROVED (detects expired codes, provides clear messages, auto-cleanup)
**Server:** Running on http://localhost:3001

## ⚠️ Common Mistake

**DON'T:** Visit `/auth/callback?code=...` directly or refresh that page
**WHY:** Authorization codes expire quickly (10 minutes) and can only be used once
**RESULT:** You'll get "The code has expired" error

## ✅ Correct Testing Procedure

### Step 1: Navigate to Home Page
Open your browser to: **http://localhost:3001**

### Step 2: Start Fresh OAuth Flow
1. Click the **"Connect Microsoft Account (PKCE)"** button
2. This generates a fresh PKCE code verifier/challenge pair
3. Redirects you to Microsoft login

### Step 3: Complete Microsoft Authentication
1. Sign in with your Microsoft account (if not already signed in)
2. Grant permissions when prompted
3. **DO NOT refresh or navigate away during this process**

### Step 4: Observe Callback Processing
After Microsoft redirects you back to `/auth/callback`:

**Expected Flow:**
```
1. "Processing Authentication..." (spinner)
   ↓
2. Token exchange happens (code + verifier → tokens)
   ↓
3. Tokens encrypted and stored in IndexedDB
   ↓
4. "Authentication Successful!" (green checkmark)
   ↓
5. Auto-redirect to home page after 2 seconds
```

### Step 5: Verify Success on Home Page
You should see:
- ✅ Green "Authenticated" status
- Your email address
- Token expiration time
- Either:
  - **"🎉 SUCCESS! This is a 90-day token!"** (if isFallbackPublicClient works)
  - **"⚠️ This is a 24-hour SPA token"** (if limited to SPA tokens)

## 🔍 Verifying Token Storage

### Check IndexedDB
Open DevTools Console (F12) and run:

```javascript
// List all databases (should include ownyou_tokens)
indexedDB.databases().then(dbs => console.log(dbs));

// Check token status
import('/lib/token-storage.js').then(module => {
  module.getTokenStatus('microsoft').then(status => {
    console.log('Auth Status:', status);
    if (status.authenticated) {
      const days = Math.floor(status.expiresIn / (1000 * 60 * 60 * 24));
      console.log(`Token expires in: ${days} days`);
      if (days >= 60) {
        console.log('✅ 90-day token!');
      } else {
        console.log('⚠️ 24-hour SPA token');
      }
    }
  });
});
```

### Verify Encryption
```javascript
// Open IndexedDB manually to see encrypted data
const request = indexedDB.open('ownyou_tokens', 1);
request.onsuccess = (event) => {
  const db = event.target.result;
  const transaction = db.transaction(['tokens'], 'readonly');
  const store = transaction.objectStore('tokens');
  const getRequest = store.get('microsoft');

  getRequest.onsuccess = () => {
    console.log('Encrypted token data:', getRequest.result);
    // Should show encrypted bytes array, NOT plaintext tokens
  };
};
```

## 🐛 If You Get "Code Expired" Error

This means:
1. You're visiting a callback URL with an old/used code
2. The page was refreshed during the flow
3. You took too long to complete authentication (>10 minutes)

**Solution:**
1. Navigate to home page: http://localhost:3001
2. Click "Connect Microsoft Account (PKCE)" again
3. Complete the flow without delays or refreshes

The improved error handling will:
- Show clear message: "Authorization code expired. This can happen if you took too long..."
- Automatically clear sessionStorage (pkce_code_verifier, oauth_state)
- Allow you to retry without manual cleanup

## 📊 Expected Results

### If 90-Day Tokens Work (Goal)
```
authenticated: true
accountEmail: "your@email.com"
expiresAt: <timestamp ~90 days from now>
expiresIn: ~7776000000 milliseconds (90 days)
```

### If Limited to 24-Hour SPA Tokens
```
authenticated: true
accountEmail: "your@email.com"
expiresAt: <timestamp ~24 hours from now>
expiresIn: ~86400000 milliseconds (24 hours)
```

## 🔑 Critical Test Result

The key question we need to answer:

**Does `isFallbackPublicClient: true` enable 90-day tokens in SPA platform?**

- Azure configuration uses SPA platform (for PKCE redirect URIs)
- Azure app has `isFallbackPublicClient: true` (for public client behavior)
- **Theory:** This should enable 90-day refresh tokens
- **Reality:** Need to test to confirm

After successful authentication, check the token expiration to determine which case applies.

## 🎯 Next Steps Based on Results

### If 90-Day Tokens ✅
- No changes needed
- Proceed with static PWA deployment
- Document configuration for future reference

### If 24-Hour Tokens ⚠️
Two options:

**Option A: Accept with Auto-Refresh**
- Implement hourly token refresh
- User stays logged in via refresh token
- Document limitation

**Option B: Future Local Python Agent**
- Build desktop app (like Signal, Docker Desktop)
- Python agent gets 90-day tokens
- PWA communicates with localhost agent
- More complex but better UX

## 📝 Implementation Summary

**Files Created:**
- `lib/oauth-pkce.ts` (320 lines) - PKCE utilities
- `lib/token-storage.ts` (290 lines) - Encrypted IndexedDB storage
- `app/auth/callback/page.tsx` (135 lines) - Callback handler

**Files Modified:**
- `app/page.tsx` - Added OAuth testing UI
- `app/auth/callback/page.tsx` - Improved error handling (today)

**Azure Configuration:**
- Redirect URIs: localhost:3000, localhost:3001, ownyou.app
- Platform: SPA (for PKCE support)
- isFallbackPublicClient: true (for 90-day tokens attempt)

**Total New Code:** ~745 lines

---

**Status:** Ready for testing
**Last Updated:** 2025-01-14
**Next Action:** Complete OAuth flow from home page and verify token lifetime
