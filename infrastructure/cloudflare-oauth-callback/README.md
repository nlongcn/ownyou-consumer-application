# OwnYou OAuth Callback Worker

Cloudflare Worker that handles OAuth callbacks for the OwnYou desktop app.

## Purpose

When users authenticate with Microsoft/Google, the OAuth provider redirects to this worker.
The worker:
1. Displays a success/error message
2. Redirects to the OwnYou app via deep link (`ownyou://oauth/callback`)
3. Attempts to close the browser popup

## Deployment

```bash
cd infrastructure/cloudflare-oauth-callback
npx wrangler deploy
```

The worker will be deployed to: `https://ownyou-oauth-callback.nlongcroft.workers.dev`

## Azure AD Configuration

After deploying, add this redirect URI to your Azure AD app registration:

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
Worker shows success page
    ↓
Page redirects to: ownyou://oauth/callback?code=...&state=...
    ↓
OwnYou app receives deep link and completes OAuth
    ↓
Browser popup closes (or shows "You can close this window")
```
