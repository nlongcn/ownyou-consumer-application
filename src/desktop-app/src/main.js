console.log('main.js loaded');
console.log('window.__TAURI__ available:', !!window.__TAURI__);

// Configuration
const CONFIG = {
  clientId: '81f2799a-4e9d-4d46-947b-c51114e806d7',
  redirectUri: 'http://localhost:8080/callback',
  storeFile: 'tokens.json'
};

// Tauri APIs (loaded after window is ready)
let invoke = null;
let Store = null;
let tokenStore = null;

async function initStore() {
  try {
    // Wait for Tauri to be available
    if (!window.__TAURI__) {
      throw new Error('Tauri API not available');
    }

    // Load Tauri APIs
    invoke = window.__TAURI__.core.invoke;
    Store = window.__TAURI__.store.Store;

    tokenStore = await Store.load(CONFIG.storeFile);
    log('Token store initialized');
    return tokenStore;
  } catch (error) {
    logError('Failed to initialize store', error);
    throw error;
  }
}

// Debug logging
function log(message, data = null) {
  const logEl = document.getElementById('debug-log');
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = data
    ? `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}`
    : `[${timestamp}] ${message}`;

  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  logEntry.textContent = logMessage;
  logEl.appendChild(logEntry);
  logEl.scrollTop = logEl.scrollHeight;

  console.log(message, data);
}

function logError(message, error) {
  const logEl = document.getElementById('debug-log');
  const timestamp = new Date().toLocaleTimeString();
  const errorMessage = `[${timestamp}] ERROR: ${message} - ${error.toString()}`;

  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry error';
  logEntry.textContent = errorMessage;
  logEl.appendChild(logEntry);
  logEl.scrollTop = logEl.scrollHeight;

  console.error(message, error);
}

// Update UI status
function updateStatus(message, isAuthenticated = false) {
  const statusEl = document.getElementById('status-message');
  const tokenInfoEl = document.getElementById('token-info');

  statusEl.textContent = message;
  statusEl.className = isAuthenticated ? 'status-authenticated' : 'status-unauthenticated';

  if (isAuthenticated) {
    tokenInfoEl.style.display = 'block';
  }
}

// Display token information
function displayTokens(tokens) {
  document.getElementById('access-token').textContent =
    tokens.access_token.substring(0, 50) + '...';
  document.getElementById('refresh-token').textContent =
    tokens.refresh_token.substring(0, 50) + '...';
  document.getElementById('expires-at').textContent =
    new Date(tokens.expires_at).toLocaleString();
  document.getElementById('scope').textContent = tokens.scope;

  // Show token section, hide sign-in
  document.getElementById('sign-in-section').style.display = 'none';
  document.getElementById('token-section').style.display = 'block';

  updateStatus('Authenticated successfully', true);
  log('Tokens displayed in UI');
}

// Sign in with Microsoft
async function signIn() {
  try {
    log('Starting OAuth flow...');

    // Call Rust backend to get authorization URL
    const authUrl = await invoke('start_oauth', {
      clientId: CONFIG.clientId,
      clientSecret: null,
      redirectUri: CONFIG.redirectUri
    });

    log('Authorization URL generated', { url: authUrl });

    // Open browser for user authentication using Tauri's shell plugin
    await invoke('plugin:opener|open_url', { url: authUrl });

    updateStatus('Waiting for authentication... (check your browser)');
    log('Browser opened for user authentication');

    // Show callback URL input section
    document.getElementById('sign-in-section').style.display = 'none';
    document.getElementById('callback-section').style.display = 'block';

    log('Waiting for callback URL...');

  } catch (error) {
    logError('Sign-in failed', error);
    updateStatus('Sign-in failed. Check debug log for details.');
  }
}

// Handle OAuth callback
async function handleCallback(callbackUrl) {
  try {
    log('Processing callback URL...', { url: callbackUrl });

    // Extract authorization code from URL
    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');

    if (!code) {
      throw new Error('No authorization code found in callback URL');
    }

    log('Authorization code extracted', { code: code.substring(0, 20) + '...' });

    // Exchange code for tokens
    const tokens = await invoke('complete_oauth', {
      clientId: CONFIG.clientId,
      clientSecret: null,
      redirectUri: CONFIG.redirectUri,
      code: code
    });

    log('Tokens received from backend', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresAt: tokens.expires_at
    });

    // Store tokens
    await tokenStore.set('microsoft_tokens', tokens);
    await tokenStore.save();
    log('Tokens saved to store');

    // Hide callback section, show tokens
    document.getElementById('callback-section').style.display = 'none';
    document.getElementById('callback-url-input').value = '';

    // Display tokens
    displayTokens(tokens);

  } catch (error) {
    logError('Callback processing failed', error);
    updateStatus('Authentication failed. Check debug log.');

    // On error, go back to sign-in screen
    document.getElementById('callback-section').style.display = 'none';
    document.getElementById('sign-in-section').style.display = 'block';
  }
}

// Refresh access token
async function refreshToken() {
  try {
    log('Refreshing token...');

    // Get current tokens from store
    const currentTokens = await tokenStore.get('microsoft_tokens');

    if (!currentTokens || !currentTokens.refresh_token) {
      throw new Error('No refresh token found. Please sign in again.');
    }

    // Call backend to refresh
    const newTokens = await invoke('refresh_access_token', {
      clientId: CONFIG.clientId,
      clientSecret: null,
      redirectUri: CONFIG.redirectUri,
      refreshToken: currentTokens.refresh_token
    });

    log('New tokens received', {
      hasAccessToken: !!newTokens.access_token,
      expiresAt: newTokens.expires_at
    });

    // Store new tokens
    await tokenStore.set('microsoft_tokens', newTokens);
    await tokenStore.save();
    log('New tokens saved to store');

    // Update display
    displayTokens(newTokens);
    alert('Token refreshed successfully!');

  } catch (error) {
    logError('Token refresh failed', error);
    alert('Token refresh failed. You may need to sign in again.');
  }
}

// Check if token is expired
async function checkExpiration() {
  try {
    const tokens = await tokenStore.get('microsoft_tokens');

    if (!tokens) {
      alert('No tokens found. Please sign in first.');
      return;
    }

    const isExpired = await invoke('check_token_expiration', {
      tokenData: tokens
    });

    const expiresAt = new Date(tokens.expires_at);
    const now = new Date();
    const timeLeft = Math.floor((expiresAt - now) / 1000 / 60); // minutes

    if (isExpired) {
      alert(`Token is expired or will expire soon (within 5 minutes).\\nTime left: ${timeLeft} minutes`);
      log('Token expiration check: EXPIRED', { timeLeft });
    } else {
      alert(`Token is still valid.\\nTime until expiration: ${timeLeft} minutes (${Math.floor(timeLeft / 60 / 24)} days)`);
      log('Token expiration check: VALID', { timeLeft });
    }

  } catch (error) {
    logError('Expiration check failed', error);
  }
}

// Sign out
async function signOut() {
  try {
    log('Signing out...');

    // Delete tokens from store
    await tokenStore.delete('microsoft_tokens');
    await tokenStore.save();
    log('Tokens deleted from store');

    // Reset UI
    document.getElementById('sign-in-section').style.display = 'block';
    document.getElementById('token-section').style.display = 'none';
    updateStatus('Signed out successfully');

    alert('Signed out successfully!');

  } catch (error) {
    logError('Sign-out failed', error);
  }
}

// Clear debug log
function clearLog() {
  document.getElementById('debug-log').innerHTML = '';
  log('Debug log cleared');
}

// Check for existing tokens on load
async function checkExistingTokens() {
  try {
    const tokens = await tokenStore.get('microsoft_tokens');

    if (tokens) {
      log('Found existing tokens in store');
      displayTokens(tokens);
    } else {
      log('No existing tokens found');
      updateStatus('Not authenticated');
    }
  } catch (error) {
    logError('Failed to check existing tokens', error);
  }
}

// Initialize app
async function init() {
  try {
    await initStore();
    log('App initialized');

    // Set up event listeners
    document.getElementById('sign-in-btn').addEventListener('click', signIn);
    document.getElementById('refresh-btn').addEventListener('click', refreshToken);
    document.getElementById('check-expiry-btn').addEventListener('click', checkExpiration);
    document.getElementById('sign-out-btn').addEventListener('click', signOut);
    document.getElementById('clear-log-btn').addEventListener('click', clearLog);

    // Callback URL submission
    document.getElementById('submit-callback-btn').addEventListener('click', async () => {
      const callbackUrl = document.getElementById('callback-url-input').value;
      if (callbackUrl) {
        await handleCallback(callbackUrl);
      } else {
        logError('Please enter the callback URL', new Error('Empty URL'));
      }
    });

    document.getElementById('cancel-callback-btn').addEventListener('click', () => {
      document.getElementById('callback-section').style.display = 'none';
      document.getElementById('sign-in-section').style.display = 'block';
      document.getElementById('callback-url-input').value = '';
      log('OAuth flow cancelled');
    });

    log('Event listeners attached');

    // Check for existing tokens
    await checkExistingTokens();

  } catch (error) {
    logError('App initialization failed', error);
  }
}

// Start app when DOM is ready
window.addEventListener("DOMContentLoaded", init);
