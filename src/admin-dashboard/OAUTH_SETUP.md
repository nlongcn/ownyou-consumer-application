# OAuth Setup Guide

This guide walks you through setting up Gmail and Outlook OAuth for the admin dashboard.

## Prerequisites

- Access to Google Cloud Console (for Gmail)
- Access to Azure Portal (for Outlook/Microsoft)

## Gmail OAuth Setup

### Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Select your project (or create a new one)
3. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
4. If prompted, configure the OAuth consent screen first:
   - User Type: **External** (for testing) or **Internal** (for organization)
   - App name: "OwnYou Admin Dashboard"
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `gmail.readonly` scope
   - Test users: Add your Gmail address

### Step 2: Configure OAuth Client

1. Application type: **Web application**
2. Name: "OwnYou Admin Dashboard - Gmail"
3. Authorized redirect URIs:
   - Add: `http://localhost:3001/api/auth/gmail/callback`
4. Click **"Create"**
5. Copy the **Client ID** and **Client Secret**

### Step 3: Enable Gmail API

1. Go to [Gmail API Library](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
2. Click **"Enable"**

## Outlook OAuth Setup

### Step 1: Register Application

1. Go to [Azure Portal - App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. Click **"New registration"**
3. Name: "OwnYou Admin Dashboard"
4. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
5. Redirect URI:
   - Platform: **Web**
   - URI: `http://localhost:3001/api/auth/outlook/callback`
6. Click **"Register"**

### Step 2: Configure API Permissions

1. In your app, go to **"API permissions"**
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Find and check:
   - `Mail.Read` - Read user mail
   - `offline_access` - Maintain access to data
6. Click **"Add permissions"**
7. (Optional) Click **"Grant admin consent"** if you're an admin

### Step 3: Create Client Secret

1. Go to **"Certificates & secrets"**
2. Click **"New client secret"**
3. Description: "OwnYou Admin Dashboard"
4. Expires: 24 months (or your preference)
5. Click **"Add"**
6. **Copy the Value immediately** (it won't be shown again)

### Step 4: Get Application (Client) ID

1. Go to **"Overview"**
2. Copy the **Application (client) ID**

## Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cd src/admin-dashboard
   cp .env.example .env.local
   ```

2. Edit `.env.local` and replace the placeholder values:

   ```env
   # Gmail OAuth
   GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-actual-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/gmail/callback

   # Outlook OAuth
   MICROSOFT_CLIENT_ID=your-actual-application-id
   MICROSOFT_CLIENT_SECRET=your-actual-client-secret
   MICROSOFT_REDIRECT_URI=http://localhost:3001/api/auth/outlook/callback

   # OAuth Session Secret (generate with: openssl rand -base64 32)
   OAUTH_SESSION_SECRET=your-generated-secret-here
   ```

3. Generate session secret:
   ```bash
   openssl rand -base64 32
   ```

## Testing OAuth Flow

### Start Development Server

```bash
cd src/admin-dashboard
npm run dev
```

Server should start on `http://localhost:3001`

### Test Gmail OAuth

1. Open `http://localhost:3001/emails`
2. Click **"Connect Gmail"** button
3. You should be redirected to Google consent screen
4. Select your Google account
5. Grant permissions for "Read your email messages"
6. You should be redirected back to `/emails?gmail_connected=true`
7. You should see a green success message: "Gmail connected successfully!"
8. The "Connect Gmail" button should show a green "Connected" badge

### Test Outlook OAuth

1. Open `http://localhost:3001/emails`
2. Click **"Connect Outlook"** button
3. You should be redirected to Microsoft consent screen
4. Sign in with your Microsoft account
5. Grant permissions for "Read your mail"
6. You should be redirected back to `/emails?outlook_connected=true`
7. You should see a green success message: "Outlook connected successfully!"
8. The "Connect Outlook" button should show a green "Connected" badge

## Troubleshooting

### Error: `redirect_uri_mismatch`

**Problem**: The redirect URI in your OAuth app doesn't match the one configured in `.env.local`

**Solution**:
- Check that redirect URI in Google Cloud Console / Azure Portal exactly matches: `http://localhost:3001/api/auth/gmail/callback` (or `/outlook/callback`)
- No trailing slashes
- Exact port number (3001)

### Error: `OAuth not configured`

**Problem**: Environment variables not set correctly

**Solution**:
- Verify `.env.local` exists in `src/admin-dashboard/`
- Restart Next.js dev server after editing `.env.local`
- Check that all required variables are set (no "your-..." placeholders)

### Error: `invalid_client`

**Problem**: Client ID or Client Secret is incorrect

**Solution**:
- Double-check Client ID and Client Secret in `.env.local`
- For Outlook: Make sure you copied the **Value** of the client secret, not the **Secret ID**
- Regenerate client secret if needed

### Error: Access denied or insufficient permissions

**Gmail Problem**: App not published / not in test users

**Solution**:
- Add your Gmail address to test users in OAuth consent screen
- Or publish the app (not required for testing)

**Outlook Problem**: Permissions not granted

**Solution**:
- Go to Azure Portal → Your app → API permissions
- Verify `Mail.Read` and `offline_access` are listed
- Click "Grant admin consent" if available

### Tokens not persisting

**Problem**: Cookies not being set correctly

**Solution**:
- Check browser console for cookie errors
- Verify `sameSite: 'lax'` is compatible with your setup
- Check that cookies are enabled in browser

## Reusing Python OAuth Credentials (Advanced)

If you already have OAuth apps configured for the Python email parser:

### For Gmail

1. Go to your existing OAuth app in Google Cloud Console
2. Edit the **Authorized redirect URIs**
3. **Add** (don't replace): `http://localhost:3001/api/auth/gmail/callback`
4. Save
5. Use the same Client ID and Client Secret in `.env.local`

### For Outlook

1. Go to your existing app registration in Azure Portal
2. Go to **Authentication** → **Platform configurations** → **Web**
3. **Add** redirect URI: `http://localhost:3001/api/auth/outlook/callback`
4. Save
5. Use the same Application (client) ID and Client Secret in `.env.local`

This way, both Python and Next.js can use the same OAuth app with different redirect URIs.

## Security Notes

- **.env.local is gitignored** - Never commit credentials
- **HTTP-only cookies** - Tokens stored securely, not accessible to JavaScript
- **Access tokens expire after 1 hour** - Refresh tokens expire after 30 days
- **Session secret** - Used for additional security, keep it secret

## Next Steps

After successfully connecting:

1. Click **"Download & Classify Emails"** button
2. Emails will be downloaded using stored OAuth tokens (no manual entry needed)
3. Each email will be classified with IAB Taxonomy
4. Results displayed with confidence scores and reasoning

## Need Help?

- Gmail OAuth docs: https://developers.google.com/identity/protocols/oauth2/web-server
- Outlook OAuth docs: https://learn.microsoft.com/en-us/graph/auth-v2-user
- Microsoft Graph API: https://learn.microsoft.com/en-us/graph/overview
