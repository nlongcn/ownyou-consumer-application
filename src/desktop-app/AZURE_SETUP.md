# Azure App Registration for OwnYou Desktop

**Purpose:** Enable Microsoft OAuth for 90-day email access tokens
**Last Updated:** 2025-01-17

---

## 📋 Prerequisites

- Microsoft Azure account (free tier works)
- Azure Portal access: https://portal.azure.com

---

## 🔧 Step-by-Step Setup

### 1. Register Application

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations**
2. Click **"New registration"**
3. Fill in details:
   - **Name:** `OwnYou Desktop App`
   - **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI:**
     - Platform: **Public client/native (mobile & desktop)**
     - URI: `http://localhost:8080/callback`
4. Click **"Register"**

### 2. Configure Authentication

1. Go to **Authentication** in left sidebar
2. Under **Platform configurations** → **Mobile and desktop applications**:
   - Add redirect URI: `http://localhost:8080/callback`
   - Enable **"Allow public client flows"** = **Yes**
3. Click **Save**

### 3. API Permissions

1. Go to **API permissions** in left sidebar
2. Click **"Add a permission"**
3. Select **Microsoft Graph** → **Delegated permissions**
4. Add these permissions:
   - ✅ `offline_access` (Maintain access to data)
   - ✅ `Mail.Read` (Read user mail)
   - ✅ `User.Read` (Sign in and read user profile)
5. Click **"Add permissions"**
6. (Optional) Click **"Grant admin consent"** if you have admin rights

### 4. Get Application (Client) ID

1. Go to **Overview** in left sidebar
2. Copy **Application (client) ID**
   - Example: `12345678-1234-1234-1234-123456789012`
3. Save this ID - you'll need it for the desktop app

---

## 🔐 Configuration for Desktop App

### Create `.env` file

Create file at: `src/desktop-app/.env`

```bash
# Azure App Registration
AZURE_CLIENT_ID=your-client-id-here
AZURE_TENANT_ID=common
AZURE_REDIRECT_URI=http://localhost:8080/callback

# OAuth Scopes
OAUTH_SCOPES=offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read
```

### Security Notes

- **No Client Secret Needed** - Desktop apps use PKCE (public clients)
- **Tenant ID = "common"** - Works with personal + work accounts
- **Redirect URI** - Must match Azure configuration exactly

---

## ✅ Verification Checklist

Before testing OAuth flow:

- [ ] App registered in Azure Portal
- [ ] Platform = "Mobile and desktop applications"
- [ ] "Allow public client flows" = Yes
- [ ] Redirect URI = `http://localhost:8080/callback`
- [ ] Permissions added: `offline_access`, `Mail.Read`, `User.Read`
- [ ] Client ID copied to `.env` file

---

## 🧪 Test OAuth Flow

### Quick Test (Manual)

1. Start the desktop app
2. Click "Sign in with Microsoft"
3. Browser opens to Microsoft login
4. Sign in with your Microsoft account
5. Grant permissions when prompted
6. Browser redirects to `http://localhost:8080/callback?code=...`
7. App exchanges code for tokens
8. Tokens stored in Tauri Store

### Expected Token Response

```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJub25jZSI6...",
  "refresh_token": "0.AX0A...",
  "expires_at": "2025-04-17T16:00:00Z",
  "scope": "Mail.Read User.Read offline_access"
}
```

### Token Lifetimes

- **Access Token:** ~1 hour
- **Refresh Token:** **90 days** ← This is what we need!
- **ID Token:** ~1 hour

---

## 🚨 Troubleshooting

### Error: "AADSTS50011: The redirect URI specified in the request does not match"
**Fix:** Verify redirect URI in Azure exactly matches `http://localhost:8080/callback`

### Error: "AADSTS65001: The user or administrator has not consented"
**Fix:** Go to API Permissions → Grant admin consent (or user consents during login)

### Error: "invalid_client"
**Fix:** Ensure "Allow public client flows" is enabled in Authentication settings

### No refresh token received
**Fix:** Ensure `offline_access` scope is requested and approved

---

## 📚 References

- [Azure App Registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [MSAL for Desktop Apps](https://learn.microsoft.com/en-us/entra/msal/dotnet/acquiring-tokens/desktop-mobile/acquiring-tokens-interactively)
- [Microsoft Graph Permissions](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [OAuth 2.0 PKCE Flow](https://oauth.net/2/pkce/)

---

**Next Step:** Create frontend UI to trigger OAuth flow
