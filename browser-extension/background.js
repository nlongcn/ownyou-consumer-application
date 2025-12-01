/**
 * Background Service Worker for OwnYou Browser Extension
 *
 * Manifest V3 background service worker
 * Handles OAuth flows, token management, and message passing
 *
 * Based on: docs/architecture/BROWSER_EXTENSION_UNIFIED_REQUIREMENTS.md
 */

import { authenticateMicrosoft, scheduleTokenRefresh, handleTokenRefresh } from './modules/oauth-module.js';
import { storeEncryptedTokens, getDecryptedTokens, areTokensValid } from './modules/crypto-module.js';

console.log('OwnYou Extension Background Worker Started');

// =======================
// OAuth Message Handlers
// =======================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async responses
  if (message.type === 'AUTHENTICATE_MICROSOFT') {
    handleMicrosoftAuth(sendResponse);
    return true;  // Keep channel open for async response
  }

  if (message.type === 'GET_ACCESS_TOKEN') {
    handleGetAccessToken(message.provider, sendResponse);
    return true;  // Async
  }

  if (message.type === 'GET_TOKEN_STATUS') {
    handleGetTokenStatus(message.provider, sendResponse);
    return true;  // Async
  }

  if (message.type === 'LOGOUT') {
    handleLogout(message.provider, sendResponse);
    return true;  // Async
  }
});

/**
 * Handle Microsoft authentication request
 */
async function handleMicrosoftAuth(sendResponse) {
  try {
    console.log('Starting Microsoft authentication...');

    // Authenticate using device code flow
    const result = await authenticateMicrosoft();

    // Store encrypted tokens
    await storeEncryptedTokens('microsoft', result);

    // Schedule automatic token refresh (every 60 minutes)
    scheduleTokenRefresh('microsoft');

    sendResponse({
      success: true,
      accountEmail: result.accountEmail,
      expiresAt: result.expiresAt
    });

  } catch (error) {
    console.error('Microsoft authentication failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle access token request from PWA
 */
async function handleGetAccessToken(provider, sendResponse) {
  try {
    // Check if tokens are valid
    const isValid = await areTokensValid(provider);

    if (!isValid) {
      sendResponse({
        success: false,
        error: 'No valid tokens found. Please authenticate first.'
      });
      return;
    }

    // Get decrypted tokens
    const tokens = await getDecryptedTokens(provider);

    if (!tokens) {
      sendResponse({
        success: false,
        error: 'Failed to retrieve tokens'
      });
      return;
    }

    sendResponse({
      success: true,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt
    });

  } catch (error) {
    console.error('Failed to get access token:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle token status request
 */
async function handleGetTokenStatus(provider, sendResponse) {
  try {
    const storageKey = `tokens_${provider}`;
    const result = await chrome.storage.local.get(storageKey);

    if (!result[storageKey]) {
      sendResponse({
        success: true,
        authenticated: false
      });
      return;
    }

    const tokenData = result[storageKey];
    const now = Date.now();
    const daysRemaining = Math.floor((tokenData.expiresAt - now) / (1000 * 60 * 60 * 24));

    sendResponse({
      success: true,
      authenticated: true,
      accountEmail: tokenData.accountEmail,
      expiresAt: tokenData.expiresAt,
      daysRemaining: daysRemaining
    });

  } catch (error) {
    console.error('Failed to get token status:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle logout request
 */
async function handleLogout(provider, sendResponse) {
  try {
    const { clearTokens } = await import('./modules/crypto-module.js');
    await clearTokens(provider);

    // Clear token refresh alarm
    chrome.alarms.clear(`tokenRefresh-${provider}`);

    sendResponse({
      success: true
    });

  } catch (error) {
    console.error('Logout failed:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// =======================
// Alarm Handlers (Token Refresh)
// =======================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('Alarm triggered:', alarm.name);

  // Handle token refresh alarms
  if (alarm.name.startsWith('tokenRefresh-')) {
    const provider = alarm.name.replace('tokenRefresh-', '');
    console.log(`Refreshing ${provider} token...`);

    try {
      await handleTokenRefresh(provider);
      console.log(`Successfully refreshed ${provider} token`);
    } catch (error) {
      console.error(`Failed to refresh ${provider} token:`, error);
    }
  }
});

// =======================
// Extension Installation
// =======================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('OwnYou Extension installed');

    // Open welcome page or popup
    chrome.action.openPopup();
  }

  if (details.reason === 'update') {
    console.log('OwnYou Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// =======================
// Keep Service Worker Alive
// =======================

// Service workers can be terminated by the browser
// This ensures we stay alive for critical operations
let keepAliveInterval;

function startKeepAlive() {
  if (!keepAliveInterval) {
    keepAliveInterval = setInterval(() => {
      // Send a message to ourselves to keep worker alive
      chrome.runtime.sendMessage({ type: 'KEEP_ALIVE' }, () => {
        if (chrome.runtime.lastError) {
          // Ignore errors (expected if no listeners)
        }
      });
    }, 20000);  // Every 20 seconds
  }
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keep-alive when service worker starts
startKeepAlive();

console.log('Background service worker initialized');
