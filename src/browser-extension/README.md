# OwnYou Browser Extension - Setup Guide

**Phase 1.5 - Week 1: Browser Extension OAuth Foundation**

Self-sovereign OAuth handler for OwnYou consumer application. All tokens stay in user's browser (chrome.storage.local) - no centralized OwnYou backend.

---

## Architecture

### Self-Sovereign Principles
✅ All OAuth tokens stay in user's browser (chrome.storage.local)
✅ No tokens sent to OwnYou servers
✅ User controls token revocation
✅ Chrome automatically encrypts storage

### Components
- **Background Service Worker** (`background.ts`) - OAuth coordinator
- **Gmail OAuth Handler** (`lib/gmail-oauth.ts`) - Chrome Identity API
- **Outlook OAuth Handler** (`lib/outlook-oauth.ts`) - Microsoft OAuth 2.0
- **Content Script** (`content.ts`) - Dashboard ↔ Extension bridge
- **Popup UI** (`popup/`) - Quick auth status and logout
- **Dashboard Library** (`src/admin-dashboard/lib/extension-bridge.ts`) - Clean async API

---

## Prerequisites

### 1. Register OAuth Applications

#### Gmail OAuth App (Google Cloud Console)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project (or select existing)
3. Enable **Gmail API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Navigate to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: **Chrome app**
   - Name: "OwnYou Email OAuth"
   - **Application ID**: `<your-extension-id>`
     - **Important**: You need to load the extension first to get the ID (see step 2 below)
     - Extension ID format: `abcdefghijklmnopqrstuvwxyz123456`
5. Configure OAuth consent screen:
   - User type: **External** (for testing) or **Internal** (for organization)
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
6. Copy **Client ID** (format: `123456789-abcd1234.apps.googleusercontent.com`)

#### Outlook OAuth App (Azure Portal)

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click "New registration":
   - Name: "OwnYou Email OAuth"
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI:
     - Platform: **Single-page application (SPA)**
     - URI: `https://<your-extension-id>.chromiumapp.org/`
     - **Important**: Replace `<your-extension-id>` with actual extension ID after loading
4. Configure API permissions:
   - Click "API permissions" → "Add a permission"
   - Select **Microsoft Graph**
   - Select **Delegated permissions**
   - Add:
     - `Mail.Read`
     - `User.Read`
5. Copy **Application (client) ID** (format: `12345678-1234-1234-1234-123456789abc`)

---

## Installation

### Step 1: Build the Extension

```bash
cd src/browser-extension

# Install dependencies (first time only)
npm install

# Build extension
npm run build
```

**Output:** All compiled files will be in `dist/` folder:
- `background.js` - Service worker
- `content.js` - Content script
- `popup.js` - Popup logic
- `popup.html`, `popup.css` - Popup UI
- `manifest.json` - Extension manifest
- `lib/` - OAuth handlers

### Step 2: Load Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the `dist/` folder:
   ```
   /path/to/ownyou_consumer_application/src/browser-extension/dist/
   ```
6. **Copy the Extension ID** from the extension card
   - Format: `abcdefghijklmnopqrstuvwxyz123456`
   - **IMPORTANT**: You need this ID for OAuth app configuration (see step 3)

### Step 3: Configure OAuth Client IDs

Now that you have the extension ID, go back and update your OAuth apps:

#### Update Gmail OAuth App
1. Return to [Google Cloud Console](https://console.cloud.google.com/)
2. Go to "APIs & Services" → "Credentials"
3. Edit your OAuth client ID
4. Set **Application ID** to your extension ID
5. Save changes

#### Update Outlook OAuth App
1. Return to [Azure Portal](https://portal.azure.com/)
2. Go to "App registrations" → Your app
3. Click "Authentication"
4. Update **Redirect URI** to: `https://<your-extension-id>.chromiumapp.org/`
5. Save changes

#### Update Extension Manifest
1. Open `src/browser-extension/manifest.json`
2. Update OAuth client IDs:
   ```json
   {
     "oauth2": {
       "client_id": "YOUR_GMAIL_CLIENT_ID.apps.googleusercontent.com",
       ...
     }
   }
   ```
3. For Outlook, update `lib/outlook-oauth.ts`:
   ```typescript
   const MSAL_CONFIG = {
     auth: {
       clientId: 'YOUR_AZURE_AD_CLIENT_ID',
       ...
     }
   }
   ```
4. Rebuild extension:
   ```bash
   npm run build
   ```
5. Reload extension in Chrome:
   - Go to `chrome://extensions/`
   - Click reload icon on the extension card

---

## Usage

### Dashboard Integration

The dashboard can communicate with the extension using the `ExtensionBridge` library:

```typescript
import { ExtensionBridge } from '@/lib/extension-bridge'

const bridge = new ExtensionBridge()

// Check if extension is installed
if (!bridge.isExtensionInstalled()) {
  console.error('Extension not installed')
  return
}

// Get Gmail token (triggers OAuth flow if needed)
try {
  const gmailToken = await bridge.getGmailToken()
  console.log('Gmail token:', gmailToken)
} catch (error) {
  console.error('Failed to get Gmail token:', error)
}

// Check auth status
const status = await bridge.checkAuthStatus()
console.log('Gmail authenticated:', status.gmail)
console.log('Outlook authenticated:', status.outlook)

// Revoke tokens
await bridge.revokeGmailToken()
await bridge.revokeOutlookToken()
```

### Extension Popup

Click the extension icon to see:
- Authentication status (Gmail ✓, Outlook ✗)
- Quick logout buttons
- Link to dashboard

---

## OAuth Flow Details

### Gmail OAuth Flow (Chrome Identity API)

1. User clicks "Authenticate Gmail" in dashboard
2. Dashboard sends `OWNYOU_GET_GMAIL_TOKEN` message
3. Content script forwards to background service worker
4. Background calls `chrome.identity.getAuthToken()`
5. Chrome shows Google OAuth consent screen
6. User grants permissions
7. Extension receives access token
8. Token cached in encrypted `chrome.storage.local`
9. Extension returns token to dashboard

**Token Storage:**
```javascript
{
  gmail_tokens: {
    access_token: "ya29....",
    expires_at: 1704924000000  // Unix timestamp
  }
}
```

### Outlook OAuth Flow (Microsoft OAuth 2.0)

1. User clicks "Authenticate Outlook" in dashboard
2. Dashboard sends `OWNYOU_GET_OUTLOOK_TOKEN` message
3. Content script forwards to background service worker
4. Background builds authorization URL with state parameter (CSRF protection)
5. Background calls `chrome.identity.launchWebAuthFlow()`
6. User grants permissions on Microsoft login page
7. Microsoft redirects to extension with authorization code
8. Extension exchanges code for access token + refresh token
9. Tokens cached in encrypted `chrome.storage.local`
10. Extension returns access token to dashboard

**Token Storage:**
```javascript
{
  outlook_tokens: {
    access_token: "eyJ0...",
    refresh_token: "0.AX0...",
    expires_at: 1704927600000  // Unix timestamp
  }
}
```

---

## Troubleshooting

### Extension Not Showing Up

**Problem:** Extension doesn't appear in Chrome toolbar
**Solution:**
1. Check `chrome://extensions/` - is extension enabled?
2. Look for errors in extension card
3. Check console: Right-click extension → "Inspect popup"

### OAuth Errors

**Problem:** "OAuth client ID not found"
**Solution:**
1. Verify client ID in `manifest.json` is correct
2. Ensure OAuth app is configured in Google Cloud Console
3. Check that Application ID in Google Cloud matches extension ID

**Problem:** "Redirect URI mismatch"
**Solution:**
1. Verify redirect URI in Azure Portal matches: `https://<extension-id>.chromiumapp.org/`
2. Ensure extension ID is correct (copy from `chrome://extensions/`)

**Problem:** "Token expired"
**Solution:**
- Extension automatically refreshes tokens
- If refresh fails, logout and re-authenticate
- Check token expiration: Open background page console (Inspect views → service worker)

### Content Script Not Injecting

**Problem:** Dashboard can't communicate with extension
**Solution:**
1. Check manifest.json `content_scripts.matches` includes dashboard URL
2. Default: `http://localhost:3001/*`
3. Reload dashboard page after enabling extension

### Build Errors

**Problem:** `npm run build` fails
**Solution:**
1. Delete `node_modules` and `dist` folders
2. Run `npm install` again
3. Ensure TypeScript version is 5.3+
4. Check for TypeScript errors: `npm run type-check`

---

## Development

### File Structure

```
src/browser-extension/
├── manifest.json              # Chrome Manifest V3
├── background.ts              # Service worker (OAuth coordinator)
├── content.ts                 # Dashboard ↔ Extension bridge
├── lib/
│   ├── gmail-oauth.ts        # Gmail OAuth handler
│   └── outlook-oauth.ts      # Outlook OAuth handler
├── popup/
│   ├── popup.html            # Popup UI
│   ├── popup.ts              # Popup logic
│   └── popup.css             # Popup styles
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── webpack.config.js         # Build config
└── dist/                     # Compiled extension (generated)
```

### npm Scripts

```bash
npm run build       # Build extension (TypeScript + Webpack)
npm run type-check  # Type check without emitting files
```

### Debugging

**Background Service Worker:**
1. Go to `chrome://extensions/`
2. Find "OwnYou Email OAuth"
3. Click "Inspect views" → "service worker"
4. Console shows background logs

**Content Script:**
1. Open dashboard page (localhost:3001)
2. Open DevTools (F12)
3. Console shows content script logs

**Popup:**
1. Right-click extension icon
2. Select "Inspect popup"
3. Console shows popup logs

---

## Security

### Token Encryption
- Chrome automatically encrypts `chrome.storage.local`
- Tokens never stored in plaintext
- Tokens never sent to OwnYou servers

### CSRF Protection
- Outlook OAuth uses `state` parameter
- Random 32-byte state generated per request
- State validated on redirect

### Token Refresh
- Gmail tokens expire in 1 hour
- Outlook tokens expire based on Azure configuration
- Both handlers automatically refresh expired tokens
- 5-minute buffer before expiration

---

## Next Steps

After completing Week 1 setup, proceed with:

1. **Week 2:** Gmail & Outlook API TypeScript clients
2. **Week 3:** Email summarization LangGraph workflows
3. **Week 4:** Admin dashboard UI integration

See [Phase 1.5 Strategic Roadmap](../../docs/plans/2025-01-04-ownyou-strategic-roadmap.md) for full timeline.

---

## Support

- **Errors:** Check browser console and extension console
- **OAuth Issues:** Verify client IDs and redirect URIs
- **Token Issues:** Try logout and re-authenticate

**Architecture validated** ✅ Self-sovereign browser-based OAuth working as designed.
