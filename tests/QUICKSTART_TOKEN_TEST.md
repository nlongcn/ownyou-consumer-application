# OAuth Token Test - Quick Start (Azure CLI)

**Goal:** Verify your Azure app gives 90-day tokens before building the browser extension.

**Time:** 5 minutes setup + 25-hour wait

---

## Step 1: One Command Setup (30 seconds)

```bash
# Login to Azure (if not already)
az login

# Run automated setup
./tests/azure-setup.sh
```

**Output:**
```
✅ App created successfully
   Application (client) ID: 12345678-abcd-1234-abcd-123456789012

🚀 Next Steps:

1. Set environment variable:
   export AZURE_CLIENT_ID="12345678-abcd-1234-abcd-123456789012"
```

---

## Step 2: Run Initial Test (2 minutes)

```bash
# Set client ID (copy from setup output)
export AZURE_CLIENT_ID="your_client_id_here"

# Run test
node tests/oauth-token-lifetime-test.js
```

**You'll see:**
```
⚠️  ACTION REQUIRED:
1. Open this URL in your browser: https://microsoft.com/devicelogin
2. Enter this code: ABC123XYZ
3. Complete authentication
```

**Do this:**
1. Open the URL
2. Enter the code
3. Sign in with your Microsoft account
4. Grant permissions

**Success looks like:**
```
✅ Authentication successful!
Account: youremail@outlook.com
Access token expires: 2025-01-14T15:30:00.000Z
Refresh token received: Yes

⏰ Wait 25 hours, then run this script again
```

---

## Step 3: Wait 25 Hours

**Why 25 hours?**
- SPA tokens expire at 24 hours
- Need to exceed 24 hours to prove you DON'T have SPA behavior
- 25 hours = safe margin

**During the wait:**
- ✅ Leave `.oauth-test-cache.json` and `.oauth-test-log.json` files (DO NOT delete)
- ✅ Computer can sleep/restart (tokens are saved to disk)
- ❌ Do NOT run the test again before 25 hours

---

## Step 4: Run Verification Test (1 minute)

**After 25+ hours, run the SAME command:**

```bash
node tests/oauth-token-lifetime-test.js
```

### Success (90-day tokens) ✅

```
🎉 SUCCESS! Your Azure app grants 90-day refresh tokens!

✅ Token Lifetime: >24 hours (likely 90 days)
✅ Platform Type: Mobile/Desktop (native client)
✅ Ready to proceed: Build the browser extension
```

**Action:** Proceed with extension development! 🚀

### Failure (24-hour tokens) ❌

```
❌ FAILED: App is configured for 24-hour tokens (SPA behavior)

Time since auth: 25.3 hours
Token lifetime: <24 hours (SPA/Web platform)

🛠️  FIX REQUIRED:
[Instructions to reconfigure Azure app]
```

**Action:** Something went wrong with Azure CLI setup. Check the full error message for fix instructions.

---

## Troubleshooting

### "AZURE_CLIENT_ID environment variable not set"

```bash
# Load from saved file
export AZURE_CLIENT_ID=$(cat .azure-client-id)

# Or set manually
export AZURE_CLIENT_ID="your_client_id_here"
```

### "Cannot find module '@azure/msal-node'"

```bash
npm install @azure/msal-node
```

### "az: command not found"

Install Azure CLI:
- **macOS:** `brew install azure-cli`
- **Linux:** `curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash`
- **Windows:** https://aka.ms/installazurecliwindows

### "Not logged in to Azure CLI"

```bash
az login
```

### Test shows <24 hours when you've waited 25+

Check the log file:
```bash
cat .oauth-test-log.json
```

Initial auth timestamp is stored there. If you deleted this file, the test can't calculate elapsed time.

---

## What This Test Proves

**Success = Extension will work as designed:**
- Users authenticate once every 90 days (not daily)
- No backend servers storing tokens
- Browser extension can refresh tokens silently
- Privacy-first architecture maintained

**Failure = Fix Azure config before proceeding:**
- 24-hour tokens = users re-authenticate daily
- Extension provides NO user experience improvement
- Wasted development time building extension

---

## Full Documentation

For complete details, see:
- **Full test documentation:** `tests/README_TOKEN_LIFETIME_TEST.md`
- **Implementation guide:** `docs/architecture/OAUTH_EXTENSION_IMPLEMENTATION.md`
- **Problem context:** `docs/architecture/OAUTH_TOKEN_LIFETIME_PROBLEM.md`

---

**Questions?** Check the full README or review the Azure CLI setup script (`tests/azure-setup.sh`) to understand what's being configured.
