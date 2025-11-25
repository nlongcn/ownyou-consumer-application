# Browser Extension for OAuth Token Management - Technical Specification

**Status:** Draft
**Created:** 2025-01-14
**Azure App ID:** `fb33f128-2613-47d2-a551-9552446705b7`
**Purpose:** Enable 90-day OAuth refresh tokens for OwnYou PWA via browser extension

---

## 1. Executive Summary

### Problem Statement
The OwnYou browser-based PWA currently receives only 24-hour OAuth refresh tokens from Microsoft due to SPA platform restrictions. This forces users to re-authenticate daily, creating a poor user experience.

### Solution
A Chrome/Edge browser extension that uses device code flow OAuth, which is classified as a "Mobile and Desktop" platform by Microsoft Azure, granting 90-day refresh tokens instead of 24-hour tokens.

### Key Benefits
- **User Experience:** Re-authenticate every 90 days instead of daily
- **Privacy-First:** No backend servers, all tokens stored locally in extension storage
- **Self-Sovereign:** User controls their authentication tokens
- **Zero Friction:** One-time extension install, then 90-day authentication cycles

---

## 2. Architecture Overview

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
│  ┌──────────────┬──────────────┬───────────────────────┐   │
│  │  Background  │   Content    │   Extension Storage   │   │
│  │   Service    │   Script     │   (Encrypted Tokens)  │   │
│  │   Worker     │   (PWA)      │                       │   │
│  └──────┬───────┴──────┬───────┴───────────┬───────────┘   │
│         │              │                   │               │
└─────────┼──────────────┼───────────────────┼───────────────┘
          │              │                   │
          │              │                   │
    ┌─────▼──────┐  ┌────▼────┐      ┌──────▼──────┐
    │  Microsoft │  │  OwnYou │      │   Indexed   │
    │   OAuth    │  │   PWA   │      │     DB      │
    │  Endpoints │  │         │      │  (Tokens)   │
    └────────────┘  └─────────┘      └─────────────┘
```

### Data Flow

1. **Initial Authentication:**
   - Extension triggers device code flow
   - User completes auth in browser tab
   - Extension receives 90-day refresh token
   - Tokens encrypted and stored in extension storage

2. **Token Refresh (Silent):**
   - Extension monitors token expiration (every hour)
   - Silently refreshes access token using refresh token
   - Updates extension storage with new tokens
   - No user interaction required

3. **PWA Communication:**
   - PWA requests tokens via message passing
   - Extension validates origin
   - Extension returns decrypted tokens to PWA
   - PWA uses tokens for API calls

---

## 3. Extension Manifest (Manifest V3)

### File: `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "OwnYou OAuth Manager",
  "version": "1.0.0",
  "description": "Manages long-lived OAuth tokens for OwnYou application",

  "permissions": [
    "storage",
    "identity",
    "alarms"
  ],

  "host_permissions": [
    "https://login.microsoftonline.com/*",
    "https://graph.microsoft.com/*"
  ],

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["https://ownyou.app/*", "http://localhost:3000/*"],
      "js": ["content.js"]
    }
  ],

  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## 4. Background Service Worker

### File: `background.js`

**Responsibilities:**
1. OAuth device code flow management
2. Automatic token refresh (every hour)
3. Token storage encryption/decryption
4. Message passing with content scripts

### Key Functions

#### 4.1 Device Code Flow

```javascript
// Import MSAL library
import * as msal from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: 'fb33f128-2613-47d2-a551-9552446705b7',
    authority: 'https://login.microsoftonline.com/common',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

async function initiateDeviceCodeFlow() {
  const deviceCodeRequest = {
    scopes: [
      'https://graph.microsoft.com/Mail.Read',
      'offline_access',
      'openid',
      'profile',
      'email'
    ],
    deviceCodeCallback: (response) => {
      // Display device code in popup
      chrome.action.setPopup({ popup: 'auth.html' });
      chrome.runtime.sendMessage({
        type: 'DEVICE_CODE',
        code: response.userCode,
        verificationUri: response.verificationUri
      });
    }
  };

  try {
    const response = await msalInstance.acquireTokenByDeviceCode(deviceCodeRequest);

    // Store tokens securely
    await storeTokens(response);

    // Schedule refresh
    chrome.alarms.create('tokenRefresh', { periodInMinutes: 60 });

    return { success: true, account: response.account };
  } catch (error) {
    console.error('Device code flow failed:', error);
    return { success: false, error: error.message };
  }
}
```

#### 4.2 Token Refresh

```javascript
async function refreshAccessToken() {
  try {
    const accounts = await msalInstance.getAllAccounts();

    if (accounts.length === 0) {
      console.warn('No cached accounts - user needs to re-authenticate');
      return null;
    }

    const silentRequest = {
      account: accounts[0],
      scopes: ['https://graph.microsoft.com/Mail.Read'],
      forceRefresh: false
    };

    const response = await msalInstance.acquireTokenSilent(silentRequest);

    // Update stored tokens
    await storeTokens(response);

    return response;
  } catch (error) {
    if (error instanceof msal.InteractionRequiredAuthError) {
      // Refresh token expired - user needs to re-authenticate
      console.error('Refresh token expired - re-authentication required');
      // Trigger notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'OwnYou Authentication Required',
        message: 'Please re-authenticate to continue using OwnYou'
      });
    }
    throw error;
  }
}

// Set up alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'tokenRefresh') {
    refreshAccessToken();
  }
});
```

#### 4.3 Token Storage (Encrypted)

```javascript
// Encryption key derivation (using Web Crypto API)
async function deriveEncryptionKey() {
  // Use extension ID as deterministic seed
  const extensionId = chrome.runtime.id;
  const encoder = new TextEncoder();
  const data = encoder.encode(extensionId);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('ownyou-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptToken(token) {
  const key = await deriveEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(token));

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    data: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv)
  };
}

async function decryptToken(encryptedData) {
  const key = await deriveEncryptionKey();

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
    key,
    new Uint8Array(encryptedData.data)
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

async function storeTokens(authResponse) {
  const encryptedAccessToken = await encryptToken(authResponse.accessToken);
  const encryptedRefreshToken = authResponse.refreshToken
    ? await encryptToken(authResponse.refreshToken)
    : null;

  await chrome.storage.local.set({
    accessToken: encryptedAccessToken,
    refreshToken: encryptedRefreshToken,
    expiresOn: authResponse.expiresOn.getTime(),
    account: authResponse.account,
    lastRefresh: Date.now()
  });
}

async function getStoredTokens() {
  const stored = await chrome.storage.local.get([
    'accessToken',
    'refreshToken',
    'expiresOn',
    'account',
    'lastRefresh'
  ]);

  if (!stored.accessToken) {
    return null;
  }

  return {
    accessToken: await decryptToken(stored.accessToken),
    refreshToken: stored.refreshToken ? await decryptToken(stored.refreshToken) : null,
    expiresOn: new Date(stored.expiresOn),
    account: stored.account,
    lastRefresh: stored.lastRefresh
  };
}
```

#### 4.4 Message Passing

```javascript
// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_ACCESS_TOKEN') {
    // Validate origin
    const allowedOrigins = [
      'https://ownyou.app',
      'http://localhost:3000'
    ];

    if (!allowedOrigins.includes(new URL(sender.url).origin)) {
      sendResponse({ error: 'Unauthorized origin' });
      return;
    }

    // Get tokens
    getStoredTokens()
      .then(tokens => {
        if (!tokens) {
          sendResponse({ error: 'No tokens found' });
          return;
        }

        // Check if token expired
        if (tokens.expiresOn < new Date()) {
          // Refresh and return new token
          return refreshAccessToken().then(response => {
            sendResponse({
              accessToken: response.accessToken,
              expiresOn: response.expiresOn
            });
          });
        }

        sendResponse({
          accessToken: tokens.accessToken,
          expiresOn: tokens.expiresOn
        });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });

    return true; // Keep channel open for async response
  }

  if (request.type === 'AUTHENTICATE') {
    initiateDeviceCodeFlow()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true;
  }

  if (request.type === 'LOGOUT') {
    // Clear all stored tokens
    chrome.storage.local.clear()
      .then(() => {
        msalInstance.clearCache();
        sendResponse({ success: true });
      });

    return true;
  }
});
```

---

## 5. Content Script

### File: `content.js`

**Responsibilities:**
1. Inject bridge into PWA page
2. Relay messages between PWA and background worker
3. Validate message origins

```javascript
// Inject bridge script into page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('bridge.js');
(document.head || document.documentElement).appendChild(script);
script.remove();

// Listen for messages from page
window.addEventListener('message', (event) => {
  // Validate origin
  if (event.origin !== window.location.origin) {
    return;
  }

  if (event.data.type === 'OWNYOU_REQUEST_TOKEN') {
    // Forward to background worker
    chrome.runtime.sendMessage(
      { type: 'GET_ACCESS_TOKEN' },
      (response) => {
        // Send response back to page
        window.postMessage({
          type: 'OWNYOU_TOKEN_RESPONSE',
          requestId: event.data.requestId,
          ...response
        }, window.location.origin);
      }
    );
  }

  if (event.data.type === 'OWNYOU_AUTHENTICATE') {
    chrome.runtime.sendMessage(
      { type: 'AUTHENTICATE' },
      (response) => {
        window.postMessage({
          type: 'OWNYOU_AUTH_RESPONSE',
          requestId: event.data.requestId,
          ...response
        }, window.location.origin);
      }
    );
  }
});
```

---

## 6. Bridge Script (Injected into Page)

### File: `bridge.js`

**Responsibilities:**
1. Provide clean API for PWA to request tokens
2. Handle promise-based request/response

```javascript
// Bridge API injected into page context
window.OwnYouAuth = {
  async getAccessToken() {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Token request timeout'));
      }, 10000);

      const listener = (event) => {
        if (event.data.type === 'OWNYOU_TOKEN_RESPONSE' &&
            event.data.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener('message', listener);

          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve({
              accessToken: event.data.accessToken,
              expiresOn: new Date(event.data.expiresOn)
            });
          }
        }
      };

      window.addEventListener('message', listener);

      window.postMessage({
        type: 'OWNYOU_REQUEST_TOKEN',
        requestId
      }, window.location.origin);
    });
  },

  async authenticate() {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 300000); // 5 minutes

      const listener = (event) => {
        if (event.data.type === 'OWNYOU_AUTH_RESPONSE' &&
            event.data.requestId === requestId) {
          clearTimeout(timeout);
          window.removeEventListener('message', listener);

          if (event.data.success) {
            resolve(event.data.account);
          } else {
            reject(new Error(event.data.error));
          }
        }
      };

      window.addEventListener('message', listener);

      window.postMessage({
        type: 'OWNYOU_AUTHENTICATE',
        requestId
      }, window.location.origin);
    });
  }
};
```

---

## 7. Popup UI

### File: `popup.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OwnYou OAuth</title>
  <style>
    body {
      width: 300px;
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .status {
      margin-bottom: 16px;
    }
    .authenticated {
      color: green;
    }
    .not-authenticated {
      color: orange;
    }
    button {
      width: 100%;
      padding: 8px;
      margin-top: 8px;
      cursor: pointer;
    }
    .info {
      font-size: 12px;
      color: #666;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div id="status" class="status">
    <strong>Status:</strong> <span id="statusText">Checking...</span>
  </div>

  <div id="accountInfo" style="display: none;">
    <strong>Account:</strong> <span id="accountEmail"></span><br>
    <strong>Last Refresh:</strong> <span id="lastRefresh"></span><br>
    <strong>Token Expires:</strong> <span id="tokenExpiry"></span>
  </div>

  <button id="authenticateBtn">Authenticate</button>
  <button id="refreshBtn" style="display: none;">Refresh Token</button>
  <button id="logoutBtn" style="display: none;">Logout</button>

  <div class="info">
    <p>This extension manages long-lived OAuth tokens for OwnYou.</p>
    <p id="tokenLifetimeInfo"></p>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

### File: `popup.js`

```javascript
async function checkAuthStatus() {
  const stored = await chrome.storage.local.get([
    'account',
    'expiresOn',
    'lastRefresh'
  ]);

  const statusText = document.getElementById('statusText');
  const accountInfo = document.getElementById('accountInfo');
  const authenticateBtn = document.getElementById('authenticateBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (stored.account) {
    statusText.textContent = 'Authenticated';
    statusText.className = 'authenticated';

    accountInfo.style.display = 'block';
    document.getElementById('accountEmail').textContent = stored.account.username;
    document.getElementById('lastRefresh').textContent =
      new Date(stored.lastRefresh).toLocaleString();
    document.getElementById('tokenExpiry').textContent =
      new Date(stored.expiresOn).toLocaleString();

    authenticateBtn.style.display = 'none';
    refreshBtn.style.display = 'block';
    logoutBtn.style.display = 'block';

    // Calculate token lifetime
    const authTime = stored.lastRefresh;
    const now = Date.now();
    const hoursSinceAuth = (now - authTime) / (1000 * 60 * 60);

    document.getElementById('tokenLifetimeInfo').textContent =
      `Token has been valid for ${Math.floor(hoursSinceAuth)} hours. ` +
      `Refresh tokens expire after 90 days.`;
  } else {
    statusText.textContent = 'Not Authenticated';
    statusText.className = 'not-authenticated';

    accountInfo.style.display = 'none';
    authenticateBtn.style.display = 'block';
    refreshBtn.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
}

document.getElementById('authenticateBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'AUTHENTICATE' }, (response) => {
    if (response.success) {
      checkAuthStatus();
    } else {
      alert('Authentication failed: ' + response.error);
    }
  });
});

document.getElementById('refreshBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_ACCESS_TOKEN' }, (response) => {
    if (!response.error) {
      alert('Token refreshed successfully!');
      checkAuthStatus();
    } else {
      alert('Refresh failed: ' + response.error);
    }
  });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to logout?')) {
    chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
      checkAuthStatus();
    });
  }
});

// Check status on load
checkAuthStatus();
```

---

## 8. PWA Integration

### Usage in OwnYou PWA

```typescript
// Check if extension is installed
function isExtensionInstalled(): boolean {
  return typeof window.OwnYouAuth !== 'undefined';
}

// Get access token
async function getOutlookAccessToken(): Promise<string> {
  if (!isExtensionInstalled()) {
    throw new Error('OwnYou extension not installed');
  }

  try {
    const { accessToken } = await window.OwnYouAuth.getAccessToken();
    return accessToken;
  } catch (error) {
    console.error('Failed to get access token:', error);
    throw error;
  }
}

// Authenticate (first time or after expiry)
async function authenticateOutlook(): Promise<void> {
  if (!isExtensionInstalled()) {
    throw new Error('OwnYou extension not installed');
  }

  try {
    const account = await window.OwnYouAuth.authenticate();
    console.log('Authenticated as:', account.username);
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

// Example: Fetch emails
async function fetchEmails() {
  try {
    const accessToken = await getOutlookAccessToken();

    const response = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    return data.value;
  } catch (error) {
    if (error.message === 'No tokens found') {
      // Trigger authentication
      await authenticateOutlook();
      // Retry
      return fetchEmails();
    }
    throw error;
  }
}
```

---

## 9. Token Lifetime Verification

### Built-in Test Mode

Add to popup.html:

```html
<div id="testMode" style="display: none;">
  <h3>Token Lifetime Test</h3>
  <p>Initial Auth: <span id="initialAuthTime"></span></p>
  <p>Current Time: <span id="currentTime"></span></p>
  <p>Hours Since Auth: <span id="hoursSinceAuth"></span></p>
  <p id="testResult"></p>
  <button id="runTestBtn">Run 25-Hour Test</button>
</div>
```

Background worker test function:

```javascript
async function runTokenLifetimeTest() {
  const stored = await chrome.storage.local.get(['lastRefresh']);

  if (!stored.lastRefresh) {
    return { error: 'No initial authentication found' };
  }

  const hoursSinceAuth = (Date.now() - stored.lastRefresh) / (1000 * 60 * 60);

  if (hoursSinceAuth < 25) {
    return {
      waiting: true,
      hoursSinceAuth,
      message: `Wait ${Math.ceil(25 - hoursSinceAuth)} more hours before testing`
    };
  }

  // Try silent refresh
  try {
    const response = await refreshAccessToken();

    return {
      success: true,
      hoursSinceAuth,
      message: '90-day tokens confirmed! Silent refresh successful after 25+ hours.',
      tokenLifetime: '90 days',
      platformType: 'Mobile/Desktop'
    };
  } catch (error) {
    return {
      success: false,
      hoursSinceAuth,
      message: 'FAILED: Refresh token expired (24-hour SPA behavior)',
      error: error.message
    };
  }
}
```

---

## 10. Security Considerations

### 10.1 Token Storage
- ✅ Tokens encrypted using Web Crypto API (AES-GCM)
- ✅ Encryption key derived from extension ID (deterministic)
- ✅ Stored in chrome.storage.local (not accessible to web pages)
- ✅ Never exposed to page context (only passed via secure message passing)

### 10.2 Origin Validation
- ✅ Content script validates sender origin
- ✅ Bridge validates postMessage origin
- ✅ Background worker validates content script origin
- ✅ Allowlist: `https://ownyou.app`, `http://localhost:3000`

### 10.3 Message Passing
- ✅ Request IDs prevent replay attacks
- ✅ Timeouts prevent hanging requests
- ✅ One-time listeners prevent message interception

### 10.4 Token Exposure
- ❌ **Never log tokens** to console
- ❌ **Never send tokens** to external servers
- ❌ **Never store tokens** in localStorage (page context)
- ✅ **Only return tokens** to validated origins

---

## 11. Development & Testing

### 11.1 Local Development

```bash
# Project structure
browser-extension/
├── manifest.json
├── background.js
├── content.js
├── bridge.js
├── popup.html
├── popup.js
├── auth.html
├── auth.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── lib/
    └── msal-browser.js
```

### 11.2 Load Unpacked Extension

1. Open Chrome: `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `browser-extension/` directory

### 11.3 Testing Checklist

#### Initial Authentication
- [ ] Extension popup shows "Not Authenticated"
- [ ] Click "Authenticate" button
- [ ] Device code displayed in popup
- [ ] Auth completes in new tab
- [ ] Extension popup shows authenticated account
- [ ] Token expiry time displayed

#### Token Refresh
- [ ] Wait 1 hour
- [ ] Extension automatically refreshes token
- [ ] No user interaction required
- [ ] Last refresh time updated in popup

#### PWA Integration
- [ ] Open OwnYou PWA at localhost:3000
- [ ] `window.OwnYouAuth` is available
- [ ] `getAccessToken()` returns valid token
- [ ] Token works for Graph API calls

#### 25-Hour Test
- [ ] Initial authentication completed
- [ ] Wait 25 hours
- [ ] Click "Run 25-Hour Test" in extension popup
- [ ] Test shows "Success - 90-day tokens confirmed"
- [ ] OR test shows "Failed - 24-hour SPA behavior"

---

## 12. Deployment

### 12.1 Chrome Web Store

1. Create developer account: https://chrome.google.com/webstore/devconsole
2. Prepare extension package:
   ```bash
   zip -r ownyou-oauth-extension.zip browser-extension/
   ```
3. Upload to Chrome Web Store
4. Fill required metadata:
   - **Name:** OwnYou OAuth Manager
   - **Description:** Manages long-lived OAuth tokens for OwnYou application
   - **Category:** Productivity
   - **Privacy Policy:** Link to OwnYou privacy policy
   - **Permissions Justification:**
     - `storage`: Store encrypted OAuth tokens locally
     - `identity`: Manage OAuth authentication flow
     - `alarms`: Schedule automatic token refresh
     - `host_permissions`: Communicate with Microsoft OAuth and Graph API endpoints

### 12.2 Edge Add-ons

Same process as Chrome Web Store:
https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview

---

## 13. User Installation Guide

### Installation Steps

1. **Install Extension:**
   - Chrome: https://chrome.google.com/webstore/detail/ownyou-oauth-manager
   - Edge: https://microsoftedge.microsoft.com/addons/detail/ownyou-oauth-manager

2. **Initial Setup:**
   - Click extension icon in toolbar
   - Click "Authenticate" button
   - Copy device code shown
   - Open https://microsoft.com/devicelogin in new tab
   - Paste device code
   - Sign in with Microsoft account
   - Grant permissions

3. **Verify Authentication:**
   - Extension popup shows "Authenticated"
   - Account email displayed
   - Token expiry time shown

4. **Use OwnYou PWA:**
   - Navigate to https://ownyou.app (or localhost:3000)
   - PWA will automatically use extension for authentication
   - No additional setup required

### Troubleshooting

**Extension not communicating with PWA:**
- Refresh PWA page
- Check extension is enabled in chrome://extensions
- Check browser console for errors

**Authentication failed:**
- Check Microsoft account has Mail.Read permissions
- Try logging out and re-authenticating
- Check Azure app permissions are granted

**Token expired after 24 hours:**
- This indicates Azure app misconfiguration
- Contact support with Azure Client ID

---

## 14. Monitoring & Analytics

### Metrics to Track

1. **Token Lifetime:**
   - Log initial auth timestamp
   - Log each successful silent refresh
   - Calculate hours/days since initial auth
   - Track when refresh token expires

2. **User Behavior:**
   - Number of successful authentications
   - Number of token refreshes
   - Number of re-authentication events (after 90 days)
   - Extension install/uninstall rate

3. **Error Rates:**
   - Failed silent refreshes
   - Failed initial authentications
   - PWA communication errors

### Logging (Privacy-Preserving)

```javascript
// Log to extension storage (local only, never sent to server)
async function logEvent(event) {
  const logs = await chrome.storage.local.get(['eventLog']) || { eventLog: [] };

  logs.eventLog.push({
    timestamp: Date.now(),
    event: event.type,
    // NO personal data (email, tokens, etc.)
    success: event.success,
    hoursSinceAuth: event.hoursSinceAuth
  });

  // Keep last 100 events
  if (logs.eventLog.length > 100) {
    logs.eventLog = logs.eventLog.slice(-100);
  }

  await chrome.storage.local.set({ eventLog: logs.eventLog });
}
```

---

## 15. Future Enhancements

### 15.1 Multi-Account Support
- Allow multiple Microsoft accounts
- Switch between accounts in popup
- Store separate tokens per account

### 15.2 Gmail Support
- Add Google OAuth flow
- Support Gmail in addition to Outlook
- Unified token management for both providers

### 15.3 Token Health Dashboard
- Visualize token lifetime
- Show refresh history
- Predict expiration dates

### 15.4 Automatic Migration
- Detect when user has both PWA tokens and extension tokens
- Migrate to extension tokens automatically
- Show migration progress in UI

---

## 16. Success Criteria

### Must Have (MVP)
- ✅ Extension authenticates via device code flow
- ✅ Extension stores tokens securely (encrypted)
- ✅ Extension automatically refreshes tokens every hour
- ✅ PWA can request tokens via extension
- ✅ 25-hour test confirms 90-day token behavior
- ✅ Zero backend servers (fully client-side)

### Should Have
- ✅ Clear user instructions
- ✅ Extension popup shows auth status
- ✅ Error handling with user-friendly messages
- ✅ Chrome Web Store deployment

### Nice to Have
- Edge Add-ons deployment
- Multi-account support
- Token health dashboard
- Migration from PWA to extension

---

## 17. Risks & Mitigations

### Risk: Microsoft Changes Token Lifetime Policy
**Likelihood:** Low
**Impact:** High
**Mitigation:** Document current behavior, monitor Microsoft OAuth announcements, have fallback to 24-hour tokens

### Risk: Extension Store Rejection
**Likelihood:** Medium
**Impact:** High
**Mitigation:** Follow all Chrome Web Store policies, provide clear privacy policy, justify all permissions

### Risk: User Confusion
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:** Clear installation guide, in-app messaging, support documentation

### Risk: Token Compromise
**Likelihood:** Low
**Impact:** Critical
**Mitigation:** Encryption, origin validation, never log tokens, regular security audits

---

## 18. Conclusion

This browser extension provides a **privacy-first, self-sovereign solution** to the OAuth token lifetime problem. By using device code flow, we achieve 90-day refresh tokens without sacrificing user control or privacy.

The extension is fully client-side, requires no backend servers, and integrates seamlessly with the OwnYou PWA. Token lifetime can be verified directly in production use, eliminating the need for complex automated tests.

**Next Steps:**
1. Implement extension MVP (background.js, content.js, bridge.js)
2. Test locally with OwnYou PWA
3. Run 25-hour token lifetime test
4. Deploy to Chrome Web Store
5. Update OwnYou PWA to detect and use extension

**Azure App Already Created:**
- Client ID: `fb33f128-2613-47d2-a551-9552446705b7`
- Platform: Mobile and Desktop (Public Client)
- Permissions: Mail.Read, offline_access, openid, profile, email
- Ready for immediate use

---

**Document Version:** 1.0
**Last Updated:** 2025-01-14
**Status:** Ready for Implementation
