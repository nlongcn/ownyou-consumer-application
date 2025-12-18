# OwnYou OAuth Callback Worker

Cloudflare Worker that handles OAuth callbacks for the OwnYou desktop app.

## Purpose

When users authenticate with Microsoft/Google, the OAuth provider redirects to this worker.
The worker:
1. Exchanges the authorization code for tokens (access_token + refresh_token)
2. Displays a success/error message
3. Redirects to the OwnYou app via deep link (`ownyou://oauth/callback`)
4. Provides a `/refresh` endpoint for token refresh

## Endpoints

### `/callback` - OAuth Callback
Handles the OAuth callback from Microsoft/Google:
- Exchanges authorization code for access_token and refresh_token
- Redirects to app via deep link with tokens

### `/refresh` - Token Refresh
Refreshes an access token using a refresh token:
```
GET /refresh?refresh_token=xxx&provider=google|microsoft
```
Returns JSON: `{ accessToken, refreshToken, expiresIn }`

## Environment Variables

Set these secrets in Cloudflare Workers:

```bash
# Microsoft
npx wrangler secret put MICROSOFT_CLIENT_ID
npx wrangler secret put MICROSOFT_CLIENT_SECRET

# Google (for Gmail OAuth)
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

## Deployment

```bash
cd infrastructure/cloudflare-oauth-callback
npx wrangler deploy
```

The worker will be deployed to: `https://ownyou-oauth-callback.nlongcroft.workers.dev`

## Provider Configuration

### Azure AD (Microsoft)
Add this redirect URI to your Azure AD app registration:
```
https://ownyou-oauth-callback.nlongcroft.workers.dev/callback
```

### Google Cloud Console
Add this redirect URI to your Google OAuth 2.0 Client:
```
https://ownyou-oauth-callback.nlongcroft.workers.dev/callback
```

## Flow

```
User clicks "Connect" in OwnYou app
    ↓
Browser opens Microsoft/Google auth
    ↓
User authenticates
    ↓
OAuth provider redirects to:
https://ownyou-oauth-callback.nlongcroft.workers.dev/callback?code=...&state=...
    ↓
Worker exchanges code for tokens (using client_secret)
    ↓
Worker shows success page
    ↓
Page redirects to: ownyou://oauth/callback?access_token=...&refresh_token=...&expires_in=...
    ↓
OwnYou app receives deep link with tokens
    ↓
App stores tokens securely (including refresh_token for auto-refresh)
```

## Token Refresh Flow

```
App detects access_token is expired
    ↓
App calls: /refresh?refresh_token=xxx&provider=google
    ↓
Worker exchanges refresh_token for new access_token
    ↓
Worker returns new tokens to app
    ↓
App stores new tokens and retries API call
```
