/**
 * Extension Popup UI Logic
 *
 * Shows authentication status and provides logout buttons.
 */

// DOM elements
const gmailStatus = document.getElementById('gmail-status') as HTMLElement
const outlookStatus = document.getElementById('outlook-status') as HTMLElement
const gmailLogoutBtn = document.getElementById('gmail-logout') as HTMLButtonElement
const outlookLogoutBtn = document.getElementById('outlook-logout') as HTMLButtonElement

/**
 * Update authentication status on popup load
 */
async function updateAuthStatus(): Promise<void> {
  try {
    // Send message to background to check auth status
    chrome.runtime.sendMessage(
      { type: 'CHECK_AUTH_STATUS' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Popup] Error:', chrome.runtime.lastError)
          setStatus('gmail', false, true)
          setStatus('outlook', false, true)
          return
        }

        if (response && response.success) {
          setStatus('gmail', response.gmail, false)
          setStatus('outlook', response.outlook, false)
        } else {
          setStatus('gmail', false, true)
          setStatus('outlook', false, true)
        }
      }
    )
  } catch (error) {
    console.error('[Popup] Error checking auth status:', error)
    setStatus('gmail', false, true)
    setStatus('outlook', false, true)
  }
}

/**
 * Set status badge and enable/disable logout button
 */
function setStatus(provider: 'gmail' | 'outlook', authenticated: boolean, error: boolean): void {
  const statusElement = provider === 'gmail' ? gmailStatus : outlookStatus
  const logoutButton = provider === 'gmail' ? gmailLogoutBtn : outlookLogoutBtn

  if (error) {
    statusElement.textContent = 'Error'
    statusElement.className = 'status-badge error'
    logoutButton.disabled = true
    return
  }

  if (authenticated) {
    statusElement.textContent = 'Connected'
    statusElement.className = 'status-badge connected'
    logoutButton.disabled = false
  } else {
    statusElement.textContent = 'Not connected'
    statusElement.className = 'status-badge disconnected'
    logoutButton.disabled = true
  }
}

/**
 * Handle Gmail logout
 */
gmailLogoutBtn.addEventListener('click', async () => {
  gmailLogoutBtn.disabled = true
  gmailStatus.textContent = 'Logging out...'

  try {
    chrome.runtime.sendMessage(
      { type: 'REVOKE_GMAIL_TOKEN' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Popup] Logout error:', chrome.runtime.lastError)
          alert('Failed to logout: ' + chrome.runtime.lastError.message)
          return
        }

        if (response && response.success) {
          setStatus('gmail', false, false)
        } else {
          alert('Failed to logout: ' + (response?.error || 'Unknown error'))
        }
      }
    )
  } catch (error) {
    console.error('[Popup] Logout error:', error)
    alert('Failed to logout')
    updateAuthStatus()
  }
})

/**
 * Handle Outlook logout
 */
outlookLogoutBtn.addEventListener('click', async () => {
  outlookLogoutBtn.disabled = true
  outlookStatus.textContent = 'Logging out...'

  try {
    chrome.runtime.sendMessage(
      { type: 'REVOKE_OUTLOOK_TOKEN' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Popup] Logout error:', chrome.runtime.lastError)
          alert('Failed to logout: ' + chrome.runtime.lastError.message)
          return
        }

        if (response && response.success) {
          setStatus('outlook', false, false)
        } else {
          alert('Failed to logout: ' + (response?.error || 'Unknown error'))
        }
      }
    )
  } catch (error) {
    console.error('[Popup] Logout error:', error)
    alert('Failed to logout')
    updateAuthStatus()
  }
})

// Initialize on popup open
updateAuthStatus()
