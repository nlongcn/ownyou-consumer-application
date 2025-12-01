/**
 * Popup Logic for OwnYou Browser Extension
 *
 * Handles UI interactions and communication with background worker
 */

console.log('OwnYou Extension Popup Loaded');

// DOM Elements
const msStatus = document.getElementById('ms-status');
const msAuthBtn = document.getElementById('ms-auth-btn');
const msLogoutBtn = document.getElementById('ms-logout-btn');
const msDeviceCode = document.getElementById('ms-device-code');
const msCode = document.getElementById('ms-code');
const msError = document.getElementById('ms-error');
const msVerifyLink = document.getElementById('ms-verify-link');

// Check Microsoft token status on load
checkMicrosoftStatus();

// Authenticate button
msAuthBtn.addEventListener('click', async () => {
  console.log('Authenticate button clicked');

  // Disable button and show loading
  msAuthBtn.disabled = true;
  msAuthBtn.textContent = 'Authenticating...';
  msError.style.display = 'none';

  try {
    // Request authentication from background worker
    chrome.runtime.sendMessage({ type: 'AUTHENTICATE_MICROSOFT' }, (response) => {
      console.log('Auth response:', response);

      if (response.success) {
        // Authentication successful
        msDeviceCode.style.display = 'none';
        msAuthBtn.disabled = false;
        msAuthBtn.textContent = 'Authenticate';

        updateMicrosoftStatus({
          authenticated: true,
          accountEmail: response.accountEmail,
          expiresAt: response.expiresAt
        });

        showSuccess('Authentication successful!');
      } else {
        // Authentication failed
        msDeviceCode.style.display = 'none';
        msAuthBtn.disabled = false;
        msAuthBtn.textContent = 'Authenticate';

        showError(response.error || 'Authentication failed');
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    msAuthBtn.disabled = false;
    msAuthBtn.textContent = 'Authenticate';
    showError(error.message);
  }
});

// Logout button
msLogoutBtn.addEventListener('click', () => {
  console.log('Logout button clicked');

  chrome.runtime.sendMessage({ type: 'LOGOUT', provider: 'microsoft' }, (response) => {
    if (response.success) {
      updateMicrosoftStatus({ authenticated: false });
      showSuccess('Logged out successfully');
    } else {
      showError(response.error || 'Logout failed');
    }
  });
});

// Listen for device code from background worker
chrome.runtime.onMessage.addListener((message) => {
  console.log('Popup received message:', message);

  if (message.type === 'DEVICE_CODE' && message.provider === 'microsoft') {
    // Show device code UI
    msDeviceCode.style.display = 'block';
    msCode.textContent = message.userCode;

    // DO NOT auto-open - let user manually click link
    // This prevents popup from closing before user sees code
    msVerifyLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: message.verificationUri });
    });
  }

  if (message.type === 'TOKEN_REFRESH_FAILED') {
    showError(`Token refresh failed for ${message.provider}: ${message.error}`);
  }
});

/**
 * Check Microsoft token status
 */
function checkMicrosoftStatus() {
  chrome.runtime.sendMessage({ type: 'GET_TOKEN_STATUS', provider: 'microsoft' }, (response) => {
    console.log('Token status:', response);

    if (response && response.success) {
      updateMicrosoftStatus(response);
    } else {
      msStatus.innerHTML = '<span style="color:#999;">❓ Status unknown</span>';
    }
  });
}

/**
 * Update Microsoft status UI
 */
function updateMicrosoftStatus(status) {
  if (status.authenticated) {
    const daysRemaining = Math.floor((status.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

    msStatus.innerHTML = `
      <div style="color:#28a745; font-weight:500;">✅ Authenticated</div>
      <div style="margin-top:5px;">
        <strong>Account:</strong> ${status.accountEmail}<br>
        <strong>Expires in:</strong> ${daysRemaining} days
      </div>
    `;

    msAuthBtn.style.display = 'none';
    msLogoutBtn.style.display = 'inline-block';
  } else {
    msStatus.innerHTML = '<div style="color:#dc3545; font-weight:500;">❌ Not authenticated</div><div style="margin-top:5px;">Click "Authenticate" to connect your Microsoft account</div>';

    msAuthBtn.style.display = 'inline-block';
    msLogoutBtn.style.display = 'none';
  }
}

/**
 * Show error message
 */
function showError(message) {
  msError.textContent = message;
  msError.style.display = 'block';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    msError.style.display = 'none';
  }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.style.cssText = 'background:#d4edda;border:1px solid #c3e6cb;color:#155724;padding:10px;border-radius:4px;margin:10px 0;font-size:13px;';
  successDiv.textContent = message;

  msError.parentElement.insertBefore(successDiv, msError);

  setTimeout(() => {
    successDiv.remove();
  }, 3000);
}

console.log('OwnYou Extension Popup Ready');
