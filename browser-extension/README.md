# OwnYou Browser Extension - OAuth MVP

**Status:** Phase 1 Implementation - Core OAuth functionality complete
**Created:** 2025-01-14
**Based on:** docs/architecture/BROWSER_EXTENSION_UNIFIED_REQUIREMENTS.md

---

## Overview

Privacy-first browser extension for OAuth token management (Phase 1: Microsoft Outlook) and browsing classification (Phase 2).

### What's Implemented ✅

1. **Manifest V3 Configuration** (`manifest.json`)
   - All required permissions (storage, identity, alarms)
   - Host permissions for Microsoft OAuth
   - Background service worker configured
   - Content script injection for PWA

2. **OAuth Module** (`modules/oauth-module.js`)
   - Microsoft device code flow implementation
   - Token refresh logic
   - JWT email extraction
   - Automatic hourly refresh scheduling

3. **Crypto Module** (`modules/crypto-module.js`)
   - AES-GCM encryption/decryption
   - Web Crypto API (browser-native)
   - Deterministic key derivation from extension ID
   - Secure token storage/retrieval

4. **Background Service Worker** (`background.js`)
   - OAuth flow orchestration
   - Message passing handlers
   - Alarm management for token refresh
   - Service worker keep-alive logic

### What's Pending ⏳

1. **Content Script** (`content.js`) - PWA message relay
2. **Bridge Script** (`bridge.js`) - PWA API injection
3. **Extension Popup** (`popup.html` + `popup.js`) - User interface
4. **Icons** (`icons/`) - Extension branding
5. **Testing** - Local Chrome extension testing

---

## Quick Start

### Prerequisites

- Google Chrome or Microsoft Edge
- Azure App Registration (Client ID: `fb33f128-2613-47d2-a551-9552446705b7`)

### Installation (Developer Mode)

1. **Open Chrome Extensions:**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode:**
   - Toggle "Developer mode" switch (top right)

3. **Load Unpacked Extension:**
   - Click "Load unpacked"
   - Select `browser-extension/` directory

4. **Verify Installation:**
   - Extension should appear in toolbar
   - Click extension icon to open popup

### Testing OAuth Flow

1. **Click Extension Icon**
2. **Click "Authenticate Microsoft"**
3. **Copy Device Code** (e.g., `ABC123XYZ`)
4. **Open** https://microsoft.com/devicelogin
5. **Enter Code**
6. **Sign In** with Microsoft account
7. **Grant Permissions** (Mail.Read, offline_access, etc.)
8. **Return to Extension** - Tokens should be stored

---

## Architecture

```
browser-extension/
├── manifest.json                 ✅ Manifest V3 configuration
├── background.js                 ✅ Service worker (OAuth orchestration)
├── content.js                    ⏳ PWA message relay (pending)
├── bridge.js                     ⏳ PWA API injection (pending)
├── popup.html                    ⏳ Extension UI (pending)
├── popup.js                      ⏳ Popup logic (pending)
├── modules/
│   ├── oauth-module.js           ✅ Device code flow + refresh
│   └── crypto-module.js          ✅ AES-GCM encryption
└── icons/                        ⏳ Extension icons (pending)
```

---

## Remaining Implementation Tasks

### 1. Content Script (`content.js`)

**Purpose:** Relay messages between PWA and background worker

```javascript
// Message relay: PWA → Background Worker
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data.type || event.data.source !== 'ownyou-pwa') return;

  // Forward to background worker
  chrome.runtime.sendMessage(event.data.payload, (response) => {
    // Send response back to PWA
    window.postMessage({
      type: 'OWNYOU_RESPONSE',
      requestId: event.data.requestId,
      payload: response
    }, '*');
  });
});
```

---

### 2. Bridge Script (`bridge.js`)

**Purpose:** Inject PWA API into page

```javascript
// Injected into PWA page
window.OwnYouAuth = {
  async getAccessToken() {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substr(2, 9);

      // Listen for response
      const handler = (event) => {
        if (event.data.type === 'OWNYOU_RESPONSE' && event.data.requestId === requestId) {
          window.removeEventListener('message', handler);
          if (event.data.payload.success) {
            resolve(event.data.payload);
          } else {
            reject(new Error(event.data.payload.error));
          }
        }
      };

      window.addEventListener('message', handler);

      // Send request to content script
      window.postMessage({
        type: 'OWNYOU_REQUEST',
        source: 'ownyou-pwa',
        requestId,
        payload: {
          type: 'GET_ACCESS_TOKEN',
          provider: 'microsoft'
        }
      }, '*');

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  }
};
```

---

### 3. Extension Popup (`popup.html` + `popup.js`)

**Purpose:** User interface for OAuth authentication

**HTML Structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>OwnYou Extension</title>
  <style>
    body { width: 350px; padding: 15px; font-family: system-ui; }
    .provider { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
    .status { margin: 10px 0; }
    button { padding: 8px 16px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0052a3; }
    .device-code { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .code-display { font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 2px; margin: 10px 0; }
  </style>
</head>
<body>
  <h2>OwnYou Extension</h2>

  <!-- Microsoft Provider -->
  <div class="provider">
    <h3>Microsoft Outlook</h3>
    <div class="status" id="ms-status">Checking status...</div>
    <button id="ms-auth-btn">Authenticate</button>
    <button id="ms-logout-btn" style="display:none; background:#dc3545;">Logout</button>

    <!-- Device Code Display -->
    <div id="ms-device-code" class="device-code" style="display:none;">
      <p>Open this URL in your browser:</p>
      <a href="https://microsoft.com/devicelogin" target="_blank">https://microsoft.com/devicelogin</a>
      <p>Enter this code:</p>
      <div class="code-display" id="ms-code"></div>
      <p>Waiting for authentication...</p>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

**JavaScript Logic (`popup.js`):**
```javascript
// Check Microsoft token status on load
chrome.runtime.sendMessage({ type: 'GET_TOKEN_STATUS', provider: 'microsoft' }, (response) => {
  updateMicrosoftStatus(response);
});

// Authenticate button
document.getElementById('ms-auth-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'AUTHENTICATE_MICROSOFT' }, (response) => {
    if (response.success) {
      document.getElementById('ms-device-code').style.display = 'none';
      updateMicrosoftStatus({ authenticated: true, accountEmail: response.accountEmail });
    }
  });
});

// Logout button
document.getElementById('ms-logout-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'LOGOUT', provider: 'microsoft' }, (response) => {
    if (response.success) {
      updateMicrosoftStatus({ authenticated: false });
    }
  });
});

// Listen for device code display
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DEVICE_CODE' && message.provider === 'microsoft') {
    document.getElementById('ms-device-code').style.display = 'block';
    document.getElementById('ms-code').textContent = message.userCode;
  }
});

function updateMicrosoftStatus(status) {
  const statusDiv = document.getElementById('ms-status');
  const authBtn = document.getElementById('ms-auth-btn');
  const logoutBtn = document.getElementById('ms-logout-btn');

  if (status.authenticated) {
    statusDiv.innerHTML = `✅ Authenticated: ${status.accountEmail}<br>Expires in ${status.daysRemaining} days`;
    authBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
  } else {
    statusDiv.textContent = '❌ Not authenticated';
    authBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
}
```

---

### 4. Icons (`icons/`)

Create placeholder icons (16x16, 48x48, 128x128 PNG files).

**Quick SVG-to-PNG conversion:**
```bash
# Create simple SVG
cat > icon.svg << 'EOF'
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#0066cc"/>
  <text x="64" y="64" font-size="48" text-anchor="middle" dominant-baseline="middle" fill="white">O</text>
</svg>
EOF

# Convert (requires ImageMagick or similar)
convert icon.svg -resize 16x16 icons/icon16.png
convert icon.svg -resize 48x48 icons/icon48.png
convert icon.svg -resize 128x128 icons/icon128.png
```

---

## Testing Checklist

### Phase 1: Local Testing

- [ ] Load extension in Chrome (Developer Mode)
- [ ] Click extension icon → popup opens
- [ ] Click "Authenticate Microsoft" → device code displayed
- [ ] Copy device code → paste at https://microsoft.com/devicelogin
- [ ] Sign in with Microsoft account → grant permissions
- [ ] Return to popup → status shows "Authenticated"
- [ ] Check browser console → no errors
- [ ] Inspect `chrome.storage.local` → encrypted tokens present

### Phase 2: Token Refresh Testing

- [ ] Wait 1 hour → check console for "Successfully refreshed microsoft token"
- [ ] Inspect storage → `expiresAt` updated
- [ ] Check alarms: `chrome.alarms.getAll()` → `tokenRefresh-microsoft` present

### Phase 3: PWA Integration Testing

- [ ] Open PWA (http://localhost:3001)
- [ ] Open browser console
- [ ] Run: `await window.OwnYouAuth.getAccessToken()`
- [ ] Verify: Returns `{ success: true, accessToken: "...", expiresAt: ... }`
- [ ] Call Microsoft Graph API with token → verify 200 OK

### Phase 4: 25-Hour Token Lifetime Test

- [ ] Authenticate via extension
- [ ] Record timestamp
- [ ] Wait 25 hours
- [ ] Call `getAccessToken()` from PWA
- [ ] SUCCESS = Token refresh worked (90-day tokens confirmed)
- [ ] FAILURE = Token expired (24-hour SPA behavior)

---

## Known Limitations (Phase 1)

1. **Microsoft Only** - Google OAuth not yet implemented
2. **No Browsing Classification** - Phase 2 feature
3. **Basic UI** - Popup is minimal (no stats, no logs)
4. **No Error Recovery** - Device code expiration requires manual retry
5. **No Offline Handling** - Requires internet for OAuth flows

---

## Next Steps

### Immediate (Complete Phase 1 MVP):

1. Implement `content.js` and `bridge.js`
2. Implement `popup.html` and `popup.js`
3. Create placeholder icons
4. Test OAuth flow end-to-end
5. Test PWA integration

### Short-Term (Phase 1 Polish):

1. Add Google OAuth support
2. Improve error handling (device code expiration, network errors)
3. Add 25-hour test button to popup
4. Polish UI (better styling, loading states)

### Medium-Term (Phase 2):

1. Implement browsing classification module
2. Add Cloud Mode / Local Mode toggle
3. Integrate with LangGraph Store (IndexedDB)
4. Add audit logs and cost tracking

---

## Documentation References

- **Unified Requirements:** `docs/architecture/BROWSER_EXTENSION_UNIFIED_REQUIREMENTS.md`
- **OAuth Specification:** `docs/architecture/BROWSER_EXTENSION_SPECIFICATION.md`
- **Token Problem:** `docs/architecture/OAUTH_TOKEN_LIFETIME_PROBLEM.md`
- **Test Summary:** `docs/architecture/OAUTH_TOKEN_TEST_SUMMARY.md`
- **Azure Setup:** `tests/azure-setup.sh`
- **Quick Start:** `tests/QUICKSTART_TOKEN_TEST.md`

---

## Support

For issues or questions:
- Check browser console for errors
- Inspect `chrome.storage.local` for token data
- Review background service worker logs
- Consult unified requirements document

---

**Last Updated:** 2025-01-14
**Phase:** 1 (OAuth MVP)
**Status:** Core functionality implemented, UI pending
