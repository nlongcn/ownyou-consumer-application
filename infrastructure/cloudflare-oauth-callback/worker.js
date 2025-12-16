/**
 * OwnYou OAuth Callback Worker
 *
 * Handles OAuth callbacks from Microsoft/Google:
 * 1. Receives authorization code from OAuth provider
 * 2. Exchanges code for tokens (using client_secret stored securely here)
 * 3. Shows success page
 * 4. Redirects to OwnYou app with tokens via deep link
 *
 * This allows the desktop app to remain a "public client" while we handle
 * the confidential token exchange server-side.
 */

// Token endpoint
const MS_TOKEN_URL = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only handle /callback path
    if (url.pathname !== '/callback') {
      return new Response('Not Found', { status: 404 });
    }

    // Get OAuth parameters
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Handle errors from OAuth provider
    if (error) {
      return generateErrorPage(error, errorDescription, state);
    }

    if (!code) {
      return generateErrorPage('missing_code', 'No authorization code received', state);
    }

    // Exchange code for tokens
    try {
      const tokens = await exchangeCodeForTokens(code, env);
      return generateSuccessPage(tokens, state);
    } catch (err) {
      console.error('Token exchange failed:', err);
      return generateErrorPage('token_exchange_failed', err.message, state);
    }
  },
};

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code, env) {
  const clientId = env.MICROSOFT_CLIENT_ID;
  const clientSecret = env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = 'https://ownyou-oauth-callback.nlongcroft.workers.dev/callback';

  if (!clientId || !clientSecret) {
    throw new Error('OAuth credentials not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
}

/**
 * Generate success page with deep link redirect
 */
function generateSuccessPage(tokens, state) {
  const providerName = state === 'gmail' || state === 'google-calendar' ? 'Google' : 'Microsoft';

  // Build deep link with tokens
  // Note: We only pass access_token in URL. Refresh token could be passed too but
  // for security, the app should ideally fetch it separately or we store it server-side.
  const deepLinkParams = new URLSearchParams({
    access_token: tokens.accessToken,
    expires_in: tokens.expiresIn.toString(),
    token_type: 'Bearer',
  });
  if (tokens.refreshToken) {
    deepLinkParams.set('refresh_token', tokens.refreshToken);
  }
  if (state) {
    deepLinkParams.set('state', state);
  }

  const deepLinkUrl = `ownyou://oauth/callback?${deepLinkParams.toString()}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OwnYou - Connected!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #87CEEB 0%, #70DF82 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #dcfce7;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 40px;
    }
    h1 { color: #1f2937; font-size: 24px; margin-bottom: 10px; }
    p { color: #6b7280; font-size: 16px; line-height: 1.5; margin-bottom: 20px; }
    .provider { color: #374151; font-weight: 600; }
    .status {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      margin-bottom: 20px;
      background: #dcfce7;
      color: #166534;
    }
    .open-app-btn {
      display: inline-block;
      background: #70DF82;
      color: white;
      padding: 12px 32px;
      border-radius: 25px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 10px 0;
      transition: background 0.2s;
    }
    .open-app-btn:hover { background: #5bc96d; }
    .close-hint { color: #9ca3af; font-size: 14px; margin-top: 15px; }
    .logo { font-size: 28px; font-weight: 700; color: #1f2937; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">OwnYou</div>
    <div class="icon">✓</div>
    <h1>Successfully Connected!</h1>
    <p>Your <span class="provider">${providerName}</span> account has been connected to OwnYou.</p>
    <div class="status">Connected</div>
    <br>
    <a id="openAppLink" href="${deepLinkUrl}" class="open-app-btn">Open OwnYou App</a>
    <p class="close-hint" id="hint">Opening app automatically...</p>
  </div>

  <iframe id="deepLinkFrame" style="display:none;"></iframe>

  <script>
    (function() {
      var deepLink = '${deepLinkUrl}';

      // Try iframe method (works better for custom protocols)
      try {
        document.getElementById('deepLinkFrame').src = deepLink;
      } catch(e) {}

      // Fallback: try window.location after delay
      setTimeout(function() {
        try { window.location.href = deepLink; } catch(e) {}
      }, 300);

      // Update hint
      setTimeout(function() {
        document.getElementById('hint').innerHTML =
          'If the app didn\\'t open, click the button above.<br>You can close this window.';
      }, 2000);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Generate error page
 */
function generateErrorPage(error, description, state) {
  const providerName = state === 'gmail' || state === 'google-calendar' ? 'Google' : 'Microsoft';

  const deepLinkParams = new URLSearchParams({
    error: error,
    error_description: description || error,
  });
  if (state) deepLinkParams.set('state', state);

  const deepLinkUrl = `ownyou://oauth/callback?${deepLinkParams.toString()}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OwnYou - Connection Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #87CEEB 0%, #70DF82 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #fee2e2;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 40px;
    }
    h1 { color: #1f2937; font-size: 24px; margin-bottom: 10px; }
    p { color: #6b7280; font-size: 16px; line-height: 1.5; margin-bottom: 20px; }
    .provider { color: #374151; font-weight: 600; }
    .status {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      margin-bottom: 20px;
      background: #fee2e2;
      color: #991b1b;
    }
    .open-app-btn {
      display: inline-block;
      background: #6b7280;
      color: white;
      padding: 12px 32px;
      border-radius: 25px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin: 10px 0;
    }
    .close-hint { color: #9ca3af; font-size: 14px; margin-top: 15px; }
    .logo { font-size: 28px; font-weight: 700; color: #1f2937; margin-bottom: 30px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">OwnYou</div>
    <div class="icon">✕</div>
    <h1>Connection Failed</h1>
    <p>Unable to connect to <span class="provider">${providerName}</span>.<br>${description || error}</p>
    <div class="status">Error</div>
    <br>
    <a href="${deepLinkUrl}" class="open-app-btn">Back to App</a>
    <p class="close-hint">You can close this window.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });
}
