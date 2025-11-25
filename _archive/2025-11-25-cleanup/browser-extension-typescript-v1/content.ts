/**
 * Content Script - Dashboard <-> Extension Bridge
 *
 * Injected into dashboard pages (localhost:3001, ownyou.app).
 * Forwards messages between the dashboard and background service worker.
 *
 * Communication Flow:
 * 1. Dashboard sends message via window.postMessage
 * 2. Content script receives message
 * 3. Content script forwards to background via chrome.runtime.sendMessage
 * 4. Background processes request (OAuth, etc.)
 * 5. Content script receives response
 * 6. Content script sends response back to dashboard via window.postMessage
 */

console.log('[OwnYou Extension] Content script loaded')

// Message type prefix to identify OwnYou messages
const MESSAGE_PREFIX = 'OWNYOU_'
const RESPONSE_TYPE = 'OWNYOU_RESPONSE'

/**
 * Listen for messages from dashboard page
 */
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) {
    return
  }

  // Only process OwnYou messages
  if (!event.data.type || !event.data.type.startsWith(MESSAGE_PREFIX)) {
    return
  }

  console.log('[OwnYou Extension] Received message from dashboard:', event.data.type)

  // Forward message to background service worker
  chrome.runtime.sendMessage(event.data, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[OwnYou Extension] Error:', chrome.runtime.lastError)

      // Send error response back to dashboard
      window.postMessage(
        {
          type: RESPONSE_TYPE,
          requestType: event.data.type,
          success: false,
          error: chrome.runtime.lastError.message
        },
        '*'
      )
      return
    }

    console.log('[OwnYou Extension] Received response from background:', response)

    // Send response back to dashboard
    window.postMessage(
      {
        type: RESPONSE_TYPE,
        requestType: event.data.type,
        ...response
      },
      '*'
    )
  })
})

/**
 * Notify dashboard that extension is ready
 */
window.postMessage(
  {
    type: 'OWNYOU_EXTENSION_READY',
    extensionId: chrome.runtime.id
  },
  '*'
)

console.log('[OwnYou Extension] Content script initialized, extension ID:', chrome.runtime.id)
