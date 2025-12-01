# Browser Extension Testing Guide

## Quick Load Instructions

1. **Open Extensions Page**
   - Already open at `chrome://extensions/`
   - Developer mode is already ON ✅

2. **Load Unpacked Extension**
   - Click the "Load unpacked" button (top left)
   - Navigate to: `/Volumes/T7_new/developer_old/ownyou_consumer_application/browser-extension`
   - Click "Select" to load the extension

3. **Verify Extension Loaded**
   - You should see "OwnYou Personal AI Extension" in the list
   - Version: 1.0.0
   - Status: Enabled

## Testing Checklist

### Step 1: Verify Extension Popup
- [ ] Click extensions icon (puzzle piece) in Chrome toolbar
- [ ] Click "OwnYou Personal AI Extension"
- [ ] Popup displays with "🔐 OwnYou OAuth Manager" title
- [ ] Shows Microsoft Outlook section
- [ ] Status shows "❌ Not authenticated"
- [ ] "Authenticate" button is visible

### Step 2: Test Device Code Flow
- [ ] Click "Authenticate" button
- [ ] Button changes to "Authenticating..."
- [ ] Device code UI appears in popup
- [ ] Shows code like "A1B2-C3D4"
- [ ] Shows link to https://microsoft.com/devicelogin
- [ ] New tab opens automatically to Microsoft login

### Step 3: Complete Authentication
- [ ] Enter device code in Microsoft page
- [ ] Sign in with Microsoft account (use test account or personal)
- [ ] Grant permissions when prompted
- [ ] Return to extension popup (keep open during flow)

### Step 4: Verify Success
- [ ] Popup status changes to "✅ Authenticated"
- [ ] Displays email address
- [ ] Shows "Expires in: X days" (should be ~90 days)
- [ ] "Logout" button appears
- [ ] "Authenticate" button is hidden

### Step 5: Check Background Worker Logs
1. Go to `chrome://extensions/`
2. Find "OwnYou Personal AI Extension"
3. Click "service worker" (under "Inspect views")
4. Check Console for:
   ```
   OwnYou Extension Background Service Worker Loaded
   Received message: {type: "AUTHENTICATE_MICROSOFT"}
   Starting device code flow
   Device code received: [code]
   Polling for token...
   Token received successfully
   ```

### Step 6: Verify Token Storage
1. Go to `chrome://extensions/`
2. Find "OwnYou Personal AI Extension"
3. Click "service worker" (under "Inspect views")
4. Open the file `verify-tokens.js` in this directory
5. Copy the entire script and paste into the console
6. Press Enter to run

Expected output:
```
✅ Microsoft tokens found in storage!

📊 Token Storage Structure:
├─ data (encrypted): Array[XXX]
├─ iv (initialization vector): Array[12]
├─ accountEmail: your-email@example.com
└─ expiresAt: 2025-XX-XX...

🔒 Encryption Verified:
├─ Encrypted data length: XXX bytes
├─ IV length: 12 bytes (should be 12)
└─ Algorithm: AES-GCM with PBKDF2 key derivation

⏰ Token Expiration:
├─ Expires at: [date]
├─ Time remaining: 89 days XX hours
└─ ✅ GREAT! This is a 90-day refresh token

✅ Token refresh is scheduled:
├─ Next refresh: [date]
├─ In: XX minutes
└─ Alarm name: refresh_microsoft
```

Or run manually:
```javascript
chrome.storage.local.get(['ownyou_tokens_microsoft'], (result) => {
  console.log('Stored tokens:', result);
});
```

### Step 7: Test PWA Integration (Optional)
1. Navigate to http://localhost:3000
2. Open DevTools Console
3. Run:
   ```javascript
   // Check API availability
   console.log('OwnYouAuth:', window.OwnYouAuth);

   // Get access token
   await window.OwnYouAuth.getAccessToken('microsoft');
   ```

Expected: Returns `{ accessToken: "eyJ...", expiresAt: 1234567890 }`

### Step 8: Test Token Refresh
Wait 1 hour and verify:
- [ ] Background worker automatically refreshes token
- [ ] No user intervention needed
- [ ] Console shows: "Token refreshed successfully"

### Step 9: Test Logout
- [ ] Click "Logout" button in popup
- [ ] Status changes to "❌ Not authenticated"
- [ ] "Authenticate" button reappears
- [ ] Token is removed from chrome.storage.local

## Troubleshooting

### Extension Not Loading
- Check manifest.json is valid JSON
- Ensure all referenced files exist
- Check for syntax errors in JavaScript files

### Device Code Not Appearing
- Check background.js console for errors
- Verify AZURE_CLIENT_ID is correct
- Check network tab for failed API calls

### Authentication Failing
- Verify Azure app registration settings:
  - Platform: Mobile and desktop applications
  - Redirect URI: https://login.microsoftonline.com/common/oauth2/nativeclient
  - Refresh token: Enabled (90 days)

### Token Not Persisting
- Check chrome.storage.local permissions in manifest
- Verify encryption/decryption working in background worker
- Check for console errors

## Known Issues

1. **First Run**: Extension may require page reload after loading
2. **Service Worker**: May sleep after 30 seconds of inactivity (normal)
3. **Debugging Port**: Puppeteer automation had connection issues (not blocking manual testing)

## Success Criteria

✅ Extension loads without errors
✅ Popup displays correctly
✅ Device code flow completes successfully
✅ Tokens are encrypted and stored
✅ PWA can access tokens via window.OwnYouAuth
✅ Automatic token refresh works
✅ 90-day refresh token lifetime confirmed

## Next Steps After Testing

1. Document any bugs found
2. Test with real email download flow
3. Verify token works for Microsoft Graph API calls
4. Run 25-hour test to confirm 90-day token behavior
5. Create production build and test in normal (non-developer) mode
