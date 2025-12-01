# Azure CORS Issue with Browser Extension Device Code Flow

## Problem

**Error:** `AADSTS90023: Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type`

**Root Cause:** Microsoft Azure detects browser extension token requests as "cross-origin" and requires SPA client type, which only provides 24-hour tokens (not 90-day tokens).

## Why This Happens

1. **Browser Extension = Cross-Origin Context**
   - Extension service worker runs in `chrome-extension://[id]` origin
   - Token requests to `login.microsoftonline.com` are cross-origin
   - Microsoft's CORS policy blocks this for non-SPA clients

2. **Device Code Flow Expectation**
   - Device code flow is designed for native apps (mobile/desktop)
   - Native apps run on localhost or device, not in browser context
   - Microsoft expects token requests from same origin as device code initiation

3. **SPA vs Mobile/Desktop Token Lifetimes**
   - **SPA (Single-Page Application)**: 24-hour access token max
   - **Mobile/Desktop**: 90-day refresh token possible
   - Browser extensions can't use Mobile/Desktop due to CORS

## Attempted Fixes (Failed)

1. ❌ **Removed redirect URI** - Didn't solve CORS issue
2. ❌ **Enabled `isFallbackPublicClient: true`** - Still cross-origin
3. ❌ **Added SPA redirect URI** - Would work but limits to 24-hour tokens

## Alternative Solutions

### Option 1: Chrome Identity API (Recommended for Chrome Extensions)

**Pros:**
- Native Chrome extension OAuth support
- Handles CORS automatically
- Works with Microsoft OAuth

**Cons:**
- Chrome-specific (not cross-browser)
- Still limited to SPA token lifetimes (24 hours)
- Requires different OAuth flow (implicit or authorization code)

**Implementation:**
```javascript
chrome.identity.launchWebAuthFlow({
  url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?...`,
  interactive: true
}, function(redirectUrl) {
  // Extract token from redirectUrl
});
```

### Option 2: Local Companion Server

**Pros:**
- Can use device code flow properly (no CORS)
- Supports 90-day tokens
- Full control over OAuth flow

**Cons:**
- Requires user to install/run local server
- More complex setup
- Port conflicts possible

**Architecture:**
```
Browser Extension → localhost:8080 (Node.js server) → Microsoft OAuth
```

The local server runs as a true "native app" and can use device code flow without CORS issues.

### Option 3: PWA with Service Worker (Already Planned)

**Pros:**
- PWA runs at https://ownyou.app (not extension origin)
- Can use implicit/PKCE flow from same origin
- No CORS issues

**Cons:**
- Still SPA = 24-hour tokens max
- Requires user to visit PWA URL
- Can't inject into other pages

**Note:** This was already your plan - browser extension just manages PWA tokens.

### Option 4: Hybrid - Extension + Local Python Agent

**Pros:**
- Python agent on localhost can get 90-day tokens
- Extension communicates with Python agent
- Best of both worlds (extension UX + long-lived tokens)

**Cons:**
- Requires user to install Python agent
- Most complex architecture
- Two components to maintain

**Architecture:**
```
Browser Extension → localhost:5000 (Python Flask) → Microsoft OAuth (90-day tokens)
```

## Recommended Path Forward

### Short-term: Chrome Identity API with 24-Hour Tokens

Accept that browser extensions can't get 90-day tokens from Microsoft due to CORS limitations.

**Steps:**
1. Switch from device code flow to Chrome Identity API
2. Use authorization code flow with PKCE
3. Implement automatic token refresh every hour
4. Store tokens securely in chrome.storage.local

**Trade-off:** 24-hour token lifetime, but simpler architecture.

### Long-term: Local Python Agent (Phase 2)

When you build the full consumer app, use local Python agent for OAuth:

**Steps:**
1. User installs Python desktop app (like Signal Desktop)
2. Python app runs on localhost:5000
3. Browser extension communicates with localhost
4. Python app gets 90-day tokens using device code flow
5. Extension requests tokens from Python app via localhost

**Benefit:** 90-day tokens + browser extension UX.

## Technical Details

### Why Device Code Flow Fails in Browser Extensions

**Device Code Initiation (Works):**
```javascript
// ✅ This works - no CORS issue
POST https://login.microsoftonline.com/common/oauth2/v2.0/devicecode
Origin: chrome-extension://[id]
```

**Token Redemption (Fails):**
```javascript
// ❌ This fails - CORS policy violation
POST https://login.microsoftonline.com/common/oauth2/v2.0/token
Origin: chrome-extension://[id]
// Microsoft rejects: "Cross-origin token redemption is permitted only for SPA client-type"
```

**Why Microsoft Rejects:**
- Origin `chrome-extension://[id]` is not HTTPS web origin
- Microsoft's CORS policy only allows:
  - Same-origin requests (web app at login.microsoftonline.com)
  - SPA with configured redirect URIs
  - Native apps (NOT browser extensions)

### Chrome Identity API Alternative

**Uses Authorization Code Flow:**
```javascript
chrome.identity.launchWebAuthFlow({
  url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?
    client_id=fb33f128-2613-47d2-a551-9552446705b7
    &response_type=code
    &redirect_uri=https://[extension-id].chromiumapp.org/
    &scope=Mail.Read offline_access
    &response_mode=query`,
  interactive: true
}, (redirectUrl) => {
  // Extract authorization code
  const code = new URL(redirectUrl).searchParams.get('code');

  // Exchange code for token (this works because Chrome handles CORS)
  fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: 'fb33f128-2613-47d2-a551-9552446705b7',
      code: code,
      redirect_uri: `https://[extension-id].chromiumapp.org/`,
      grant_type: 'authorization_code'
    })
  }).then(r => r.json()).then(tokens => {
    // tokens.access_token (1 hour)
    // tokens.refresh_token (24 hours for SPA)
  });
});
```

**Azure Configuration Needed:**
1. Platform: Single-page application
2. Redirect URI: `https://[extension-id].chromiumapp.org/` (Chrome generates this)
3. Token lifetime: 24 hours (SPA maximum)

## Decision Matrix

| Solution | Token Lifetime | Complexity | Cross-Browser | Setup Required |
|----------|---------------|------------|---------------|----------------|
| **Chrome Identity API** | 24 hours | Low | No (Chrome only) | App registration change |
| **Local Python Agent** | 90 days | High | Yes | Python install |
| **PWA Only** | 24 hours | Low | Yes | None (already planned) |
| **Local Node Server** | 90 days | Medium | Yes | Node install |

## Recommendation

**For MVP (Now):**
- Use PWA with implicit/PKCE flow (already planned)
- Accept 24-hour tokens
- Implement hourly auto-refresh
- Document limitation in README

**For Production (Phase 2):**
- Build local Python agent (part of consumer app architecture)
- Python agent handles OAuth and gets 90-day tokens
- Browser extension becomes lightweight UI layer
- Extension communicates with Python agent via localhost

## Next Steps

1. **Document this finding** - Update requirements with token lifetime limitations
2. **Simplify browser extension** - Remove device code flow, use for UI/injection only
3. **Focus on PWA** - Main OAuth happens in PWA context (no CORS issues)
4. **Plan Python agent** - Include OAuth handling in Phase 2 architecture

---

**Date:** 2025-11-14
**Status:** Device code flow blocked by Microsoft CORS policy
**Impact:** Browser extensions cannot get 90-day refresh tokens from Microsoft
**Resolution:** Use PWA for OAuth (24-hour tokens) or local Python agent (90-day tokens)
