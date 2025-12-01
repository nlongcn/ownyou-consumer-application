/**
 * Content Script for OwnYou Browser Extension
 *
 * Injected into PWA pages to relay messages between PWA and background worker
 * Runs at document_start to ensure bridge is available early
 */

console.log('OwnYou Extension Content Script Loaded');

// Inject bridge script into page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('bridge.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Message relay: PWA → Background Worker
window.addEventListener('message', (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;

  // Only accept OwnYou requests
  if (!event.data.type || event.data.source !== 'ownyou-pwa') return;

  console.log('Content script received message from PWA:', event.data);

  // Forward to background worker
  chrome.runtime.sendMessage(event.data.payload, (response) => {
    console.log('Content script received response from background:', response);

    // Send response back to PWA
    window.postMessage({
      type: 'OWNYOU_RESPONSE',
      requestId: event.data.requestId,
      payload: response
    }, '*');
  });
});

console.log('OwnYou Extension Content Script Ready');
