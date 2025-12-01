/**
 * OAuth Module for OwnYou Browser Extension
 *
 * Implements Microsoft Device Code Flow for browser extensions
 * Uses native browser APIs (fetch, Web Crypto)
 *
 * Based on: docs/architecture/BROWSER_EXTENSION_UNIFIED_REQUIREMENTS.md
 */

// Microsoft OAuth Configuration
const MICROSOFT_CONFIG = {
  clientId: 'fb33f128-2613-47d2-a551-9552446705b7',  // From Azure setup
  authority: 'https://login.microsoftonline.com/common',
  scopes: [
    'https://graph.microsoft.com/Mail.Read',
    'offline_access',
    'openid',
    'profile',
    'email'
  ]
};

/**
 * Initiate Microsoft Device Code Flow
 * Returns device code and verification URL for user
 */
export async function initiateMicrosoftAuth() {
  const deviceCodeEndpoint = `${MICROSOFT_CONFIG.authority}/oauth2/v2.0/devicecode`;

  const params = new URLSearchParams({
    client_id: MICROSOFT_CONFIG.clientId,
    scope: MICROSOFT_CONFIG.scopes.join(' ')
  });

  try {
    const response = await fetch(deviceCodeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Device code request failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval,
      message: data.message
    };
  } catch (error) {
    console.error('Failed to initiate device code flow:', error);
    throw error;
  }
}

/**
 * Poll for token using device code
 *
 * @param {string} deviceCode - Device code from initiation
 * @param {number} interval - Polling interval in seconds
 * @param {number} expiresIn - Device code expiration in seconds
 */
export async function pollForToken(deviceCode, interval = 5, expiresIn = 900) {
  const tokenEndpoint = `${MICROSOFT_CONFIG.authority}/oauth2/v2.0/token`;
  const startTime = Date.now();
  const expirationTime = startTime + (expiresIn * 1000);

  console.log(`Starting token polling. Expires in ${expiresIn} seconds (${expiresIn / 60} minutes)`);

  let pollCount = 0;

  while (Date.now() < expirationTime) {
    pollCount++;
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    console.log(`Poll #${pollCount} (${elapsedSeconds}s elapsed, ${Math.floor((expirationTime - Date.now()) / 1000)}s remaining)`);

    const params = new URLSearchParams({
      client_id: MICROSOFT_CONFIG.clientId,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode
    });

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json();

      // Check for errors
      if (data.error) {
        console.log(`Poll response: ${data.error}${data.error_description ? ` - ${data.error_description}` : ''}`);

        if (data.error === 'authorization_pending') {
          // User hasn't completed authentication yet, continue polling
          await new Promise(resolve => setTimeout(resolve, interval * 1000));
          continue;
        } else if (data.error === 'slow_down') {
          // Increase polling interval
          interval += 5;
          console.log(`Slowing down polling to ${interval}s interval`);
          await new Promise(resolve => setTimeout(resolve, interval * 1000));
          continue;
        } else if (data.error === 'expired_token' || data.error === 'device_code_expired') {
          throw new Error(`Device code expired after ${elapsedSeconds}s. Please try again faster.`);
        } else {
          throw new Error(`Authentication failed: ${data.error} - ${data.error_description}`);
        }
      }

      // Success - we have tokens
      console.log(`✅ Token received successfully after ${elapsedSeconds}s and ${pollCount} polls`);
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
        idToken: data.id_token
      };

    } catch (error) {
      if (error.message && error.message.includes('Device code expired')) {
        throw error; // Re-throw expiration errors
      }
      console.error('Token polling error:', error);
      throw error;
    }

    // Wait before next poll (only if we're continuing)
    await new Promise(resolve => setTimeout(resolve, interval * 1000));
  }

  throw new Error(`Authentication timed out after ${Math.floor((Date.now() - startTime) / 1000)}s. Please try again.`);
}

/**
 * Refresh access token using refresh token
 *
 * @param {string} refreshToken - Refresh token
 */
export async function refreshAccessToken(refreshToken) {
  const tokenEndpoint = `${MICROSOFT_CONFIG.authority}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: MICROSOFT_CONFIG.clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: MICROSOFT_CONFIG.scopes.join(' ')
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Token refresh failed: ${data.error} - ${data.error_description}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,  // Some providers don't issue new refresh token
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };

  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Extract email from ID token (JWT)
 *
 * @param {string} idToken - JWT ID token
 */
export function extractEmailFromIdToken(idToken) {
  try {
    // JWT is base64url encoded: header.payload.signature
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode payload (middle part)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(decoded);

    return claims.preferred_username || claims.email || claims.upn || 'unknown';
  } catch (error) {
    console.error('Failed to extract email from ID token:', error);
    return 'unknown';
  }
}

/**
 * Complete OAuth flow
 * Combines initiation, polling, and token storage
 *
 * @returns {Promise<Object>} Token response with account email
 */
export async function authenticateMicrosoft() {
  try {
    // Step 1: Initiate device code flow
    const deviceCodeResponse = await initiateMicrosoftAuth();

    // Step 2: Send device code to popup for user display
    chrome.runtime.sendMessage({
      type: 'DEVICE_CODE',
      provider: 'microsoft',
      userCode: deviceCodeResponse.userCode,
      verificationUri: deviceCodeResponse.verificationUri,
      message: deviceCodeResponse.message
    });

    // Step 3: Poll for tokens
    const tokens = await pollForToken(
      deviceCodeResponse.deviceCode,
      deviceCodeResponse.interval,
      deviceCodeResponse.expiresIn
    );

    // Step 4: Extract account email from ID token
    const accountEmail = extractEmailFromIdToken(tokens.idToken);

    // Step 5: Calculate expiration timestamp
    const expiresAt = Date.now() + (tokens.expiresIn * 1000);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
      accountEmail,
      tokenType: tokens.tokenType
    };

  } catch (error) {
    console.error('Microsoft authentication failed:', error);
    throw error;
  }
}

/**
 * Schedule automatic token refresh
 *
 * @param {string} provider - Provider name ('microsoft' or 'google')
 */
export function scheduleTokenRefresh(provider) {
  const alarmName = `tokenRefresh-${provider}`;

  // Clear existing alarm
  chrome.alarms.clear(alarmName);

  // Create new alarm (refresh every 60 minutes)
  chrome.alarms.create(alarmName, {
    periodInMinutes: 60
  });

  console.log(`Scheduled token refresh for ${provider}`);
}

/**
 * Handle token refresh alarm
 *
 * @param {string} provider - Provider name
 */
export async function handleTokenRefresh(provider) {
  try {
    // Get stored encrypted tokens
    const storageKey = `tokens_${provider}`;
    const result = await chrome.storage.local.get(storageKey);

    if (!result[storageKey]) {
      console.log(`No tokens found for ${provider}, skipping refresh`);
      return;
    }

    const encryptedTokens = result[storageKey];

    // Decrypt tokens
    const { decryptTokens } = await import('./crypto-module.js');
    const tokens = await decryptTokens(encryptedTokens);

    // Refresh access token
    const newTokens = await refreshAccessToken(tokens.refreshToken);

    // Re-encrypt and store
    const { encryptTokens } = await import('./crypto-module.js');
    const newEncryptedTokens = await encryptTokens({
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresAt: Date.now() + (newTokens.expiresIn * 1000)
    });

    await chrome.storage.local.set({
      [storageKey]: {
        ...newEncryptedTokens,
        accountEmail: encryptedTokens.accountEmail  // Preserve email
      }
    });

    console.log(`Successfully refreshed ${provider} token`);

  } catch (error) {
    console.error(`Failed to refresh ${provider} token:`, error);

    // Notify user of refresh failure
    chrome.runtime.sendMessage({
      type: 'TOKEN_REFRESH_FAILED',
      provider,
      error: error.message
    });
  }
}
