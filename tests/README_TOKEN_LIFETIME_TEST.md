# OAuth Token Lifetime Verification Test

## Purpose

This test verifies whether your Azure app registration grants **90-day refresh tokens** (required for the browser extension) or **24-hour tokens** (SPA behavior).

**CRITICAL:** This test MUST pass before building the browser extension. Building the extension with a misconfigured Azure app wastes development time.

---

## Prerequisites

### 1. Create Azure App Registration (Azure CLI)

**AUTOMATED SETUP (Recommended):**

```bash
# Run the automated setup script
./tests/azure-setup.sh
```

This script will:
- Create app registration as "Mobile and Desktop" platform
- Configure redirect URI for native client
- Add Microsoft Graph API permissions
- Enable public client flows
- Output client ID for token test

**MANUAL SETUP (Alternative):**

If you prefer to run commands manually, see [Manual Azure CLI Setup](#manual-azure-cli-setup) section below.

### 2. Copy Application (Client) ID

After running the setup script:
- Client ID is displayed in terminal output
- Client ID is saved to `.azure-client-id` file

Or retrieve it manually:
```bash
az ad app list --display-name "OwnYou Email Agent (Test)" --query "[0].appId" -o tsv
```

### 3. Install Dependencies

```bash
cd /Volumes/T7_new/developer_old/ownyou_consumer_application
npm install @azure/msal-node
```

---

## Running the Test

### Step 1: Initial Authentication

```bash
# Set your Azure client ID
export AZURE_CLIENT_ID="your_client_id_here"

# Optional: Set tenant (default: common)
export AZURE_TENANT_ID="common"

# Run the test
node tests/oauth-token-lifetime-test.js
```

**You will see:**
```
╔════════════════════════════════════════════════════════════╗
║         OAuth Token Lifetime Verification Test           ║
╚════════════════════════════════════════════════════════════╝

Azure Client ID: 12345678-1234-1234-1234-123456789012
Azure Tenant: common

📝 No cached tokens found - performing initial authentication...

=== INITIAL AUTHENTICATION ===
Starting device code flow (simulates extension behavior)...

⚠️  ACTION REQUIRED:
1. Open this URL in your browser: https://microsoft.com/devicelogin
2. Enter this code: ABC123XYZ
3. Complete authentication

Waiting for you to complete authentication...
```

**Action:**
1. Open the URL in your browser
2. Enter the code shown
3. Sign in with your Microsoft account
4. Grant permissions

**After successful authentication:**
```
✅ Authentication successful!
Account: youremail@outlook.com
Access token expires: 2025-01-14T15:30:00.000Z
Refresh token received: Yes

╔════════════════════════════════════════════════════════════╗
║                   NEXT STEPS (CRITICAL)                    ║
╚════════════════════════════════════════════════════════════╝

⏰ Wait 25 hours, then run this script again:
   node tests/oauth-token-lifetime-test.js

Expected Result:
  ✅ Silent refresh succeeds = 90-day tokens (proceed with extension)
  ❌ Interaction required = 24-hour tokens (FIX Azure config)

Test state saved to: .oauth-test-log.json
```

### Step 2: Wait 25 Hours

**Why 25 hours?**
- SPA apps have 24-hour token lifetime
- Need to exceed 24 hours to verify you DON'T have SPA behavior
- 25 hours provides a safe margin

**During the wait:**
- Do NOT clear browser cache
- Do NOT delete the test cache files (`.oauth-test-cache.json`, `.oauth-test-log.json`)
- Leave your computer on OR the cached tokens will persist

### Step 3: Verification Test (After 25 Hours)

```bash
# Run the same command again
node tests/oauth-token-lifetime-test.js
```

**Expected Output (SUCCESS - 90-day tokens):**
```
✓ Found cached account: youremail@outlook.com
⏰ Time since initial auth: 25.3 hours
   Initial auth: 2025-01-13T14:30:00.000Z

✅ Sufficient time has passed (>24 hours) - ready to verify!

=== TESTING SILENT REFRESH ===
Attempting silent token refresh...

✅ Silent refresh successful!
Account: youremail@outlook.com
Access token expires: 2025-01-14T16:00:00.000Z
From cache: false

╔════════════════════════════════════════════════════════════╗
║                      TEST RESULTS                          ║
╚════════════════════════════════════════════════════════════╝

🎉 SUCCESS! Your Azure app grants 90-day refresh tokens!

✅ Token Lifetime: >24 hours (likely 90 days)
✅ Platform Type: Mobile/Desktop (native client)
✅ Ready to proceed: Build the browser extension

Next steps:
1. Document these results in OAUTH_EXTENSION_IMPLEMENTATION.md (Section 3.2)
2. Begin extension development (Section 11)
```

**Expected Output (FAILURE - 24-hour tokens):**
```
✓ Found cached account: youremail@outlook.com
⏰ Time since initial auth: 25.3 hours

❌ CRITICAL: Silent refresh failed - interaction required!
This indicates the refresh token has expired (likely 24-hour SPA behavior).

Possible causes:
1. App registered as "Web" or "SPA" platform (should be "Mobile and Desktop")
2. Redirect URI registered as "spa" type (should be nativeclient or mobile)
3. Conditional Access policy forcing re-authentication

╔════════════════════════════════════════════════════════════╗
║                      TEST RESULTS                          ║
╚════════════════════════════════════════════════════════════╝

❌ FAILED: App is configured for 24-hour tokens (SPA behavior)

Time since auth: 25.3 hours
Token lifetime: <24 hours (SPA/Web platform)

🛠️  FIX REQUIRED:
1. Go to Azure Portal → App Registrations
2. Select your app: 12345678-1234-1234-1234-123456789012
3. Authentication → Platform configuration
4. REMOVE any "Web" or "Single-page application" platforms
5. ADD "Mobile and desktop applications" platform
6. Redirect URI: https://login.microsoftonline.com/common/oauth2/nativeclient
7. Advanced settings → Allow public client flows: Yes
8. Delete cache files and run this test again:
   rm .oauth-test-cache.json
   rm .oauth-test-log.json
   node tests/oauth-token-lifetime-test.js
```

---

## Troubleshooting

### Error: "AZURE_CLIENT_ID environment variable not set"

**Fix:**
```bash
export AZURE_CLIENT_ID="your_actual_client_id"
```

To make permanent (add to `~/.zshrc` or `~/.bashrc`):
```bash
echo 'export AZURE_CLIENT_ID="your_actual_client_id"' >> ~/.zshrc
source ~/.zshrc
```

### Error: "Cannot find module '@azure/msal-node'"

**Fix:**
```bash
npm install @azure/msal-node
```

### Test shows <24 hours when you've waited 25+

**Check:**
1. Did you delete `.oauth-test-log.json`? The initial auth timestamp is stored there.
2. Run `cat .oauth-test-log.json` to see the initial auth time.

### Silent refresh fails immediately (before 24 hours)

**Possible causes:**
1. Network issue - check internet connection
2. Microsoft outage - check https://status.azure.com
3. Token revoked manually - re-run test from Step 1

---

## Understanding the Results

### ✅ SUCCESS (90-day tokens)

**What this means:**
- Your Azure app is correctly configured as "Mobile and Desktop" platform
- Refresh tokens last ~90 days (tenant policy dependent)
- Browser extension will work as designed
- Users re-authenticate every 2-3 months (not daily)

**Action:**
1. Document results in `OAUTH_EXTENSION_IMPLEMENTATION.md` Section 3.2
2. Proceed with extension development

### ❌ FAILURE (24-hour tokens)

**What this means:**
- Your Azure app is configured as "Web" or "SPA" platform
- Refresh tokens expire after 24 hours
- Browser extension would NOT improve user experience
- Users would still re-authenticate daily

**Action:**
1. FIX Azure app registration (follow instructions in error output)
2. Delete cache files
3. Re-run test from Step 1
4. Wait another 25 hours
5. Verify again

**DO NOT proceed with extension development until test passes.**

---

## Files Created by Test

```
.oauth-test-cache.json       # MSAL token cache (contains refresh tokens)
.oauth-test-log.json         # Test event log (timestamps, results)
```

**⚠️ Security:**
- These files contain OAuth tokens - DO NOT commit to git
- Already included in `.gitignore`
- Delete after test completes: `rm .oauth-test-*.json`

---

## Integration with CI/CD (Future)

This test can be automated in CI/CD with a service principal, but for initial development, manual testing is sufficient.

---

## Questions?

See `docs/architecture/OAUTH_EXTENSION_IMPLEMENTATION.md` for complete context.

**Still stuck?**
1. Check Azure app registration matches Section 3.1 exactly
2. Verify API permissions are granted (not just added)
3. Try with a different Microsoft account (personal vs work)
4. Check for tenant Conditional Access policies blocking long-lived tokens

---

## Manual Azure CLI Setup

If you prefer to run commands manually instead of using the setup script:

### Step 1: Login to Azure CLI

```bash
az login
```

### Step 2: Create App Registration

```bash
APP_NAME="OwnYou Email Agent (Test)"

# Create app registration (multi-tenant)
APP_ID=$(az ad app create \
    --display-name "$APP_NAME" \
    --sign-in-audience "AzureADandPersonalMicrosoftAccount" \
    --enable-access-token-issuance false \
    --enable-id-token-issuance false \
    --query appId -o tsv)

echo "Created app: $APP_ID"
```

### Step 3: Configure as Public Client

```bash
REDIRECT_URI="https://login.microsoftonline.com/common/oauth2/nativeclient"

# Enable public client flows
az ad app update \
    --id "$APP_ID" \
    --set publicClient.redirectUris="[\"$REDIRECT_URI\"]" \
    --is-fallback-public-client true

echo "Public client flows enabled"
```

### Step 4: Add Microsoft Graph Permissions

```bash
# Microsoft Graph resource ID
GRAPH_RESOURCE_ID="00000003-0000-0000-c000-000000000000"

# Permission IDs (constant GUIDs)
OFFLINE_ACCESS_ID="7427e0e9-2fba-42fe-b0c0-848c9e6a8182"  # offline_access
OPENID_ID="37f7f235-527c-4136-accd-4a02d197296e"          # openid
PROFILE_ID="14dad69e-099b-42c9-810b-d002981feec1"         # profile
EMAIL_ID="64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0"           # email
MAIL_READ_ID="570282fd-fa5c-430d-a7fd-fc8dc98a9dca"       # Mail.Read

# Create permissions JSON
REQUIRED_RESOURCE_ACCESS="[{\"resourceAppId\":\"$GRAPH_RESOURCE_ID\",\"resourceAccess\":[{\"id\":\"$OFFLINE_ACCESS_ID\",\"type\":\"Scope\"},{\"id\":\"$OPENID_ID\",\"type\":\"Scope\"},{\"id\":\"$PROFILE_ID\",\"type\":\"Scope\"},{\"id\":\"$EMAIL_ID\",\"type\":\"Scope\"},{\"id\":\"$MAIL_READ_ID\",\"type\":\"Scope\"}]}]"

# Apply permissions
az ad app update \
    --id "$APP_ID" \
    --required-resource-accesses "$REQUIRED_RESOURCE_ACCESS"

echo "API permissions added"
```

### Step 5: Grant Admin Consent (Optional)

```bash
# If you're admin, grant consent
az ad app permission admin-consent --id "$APP_ID"

# Otherwise, consent will be requested during first login
```

### Step 6: Save Client ID

```bash
echo "$APP_ID" > .azure-client-id
export AZURE_CLIENT_ID="$APP_ID"
echo "Client ID: $APP_ID"
```

### Step 7: Run Token Test

```bash
node tests/oauth-token-lifetime-test.js
```
