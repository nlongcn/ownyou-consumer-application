/**
 * Browser Extension Background Service Worker
 *
 * Handles OAuth flows for Gmail and Outlook.
 * Runs as a persistent service worker in Manifest V3.
 */

import { GmailOAuthHandler } from './lib/gmail-oauth'
import { OutlookOAuthHandler } from './lib/outlook-oauth'

// Initialize OAuth handlers
const gmailOAuth = new GmailOAuthHandler()
const outlookOAuth = new OutlookOAuthHandler()

/**
 * Message handler for dashboard <-> extension communication
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type)

  // Handle async responses
  ;(async () => {
    try {
      switch (message.type) {
        case 'GET_GMAIL_TOKEN':
          const gmailToken = await gmailOAuth.getAccessToken()
          sendResponse({ success: true, token: gmailToken })
          break

        case 'GET_OUTLOOK_TOKEN':
          const outlookToken = await outlookOAuth.getAccessToken()
          sendResponse({ success: true, token: outlookToken })
          break

        case 'REVOKE_GMAIL_TOKEN':
          await gmailOAuth.revokeToken()
          sendResponse({ success: true })
          break

        case 'REVOKE_OUTLOOK_TOKEN':
          await outlookOAuth.revokeToken()
          sendResponse({ success: true })
          break

        case 'CHECK_AUTH_STATUS':
          const gmailAuth = await gmailOAuth.isAuthenticated()
          const outlookAuth = await outlookOAuth.isAuthenticated()
          sendResponse({
            success: true,
            gmail: gmailAuth,
            outlook: outlookAuth
          })
          break

        default:
          sendResponse({ success: false, error: 'Unknown message type' })
      }
    } catch (error) {
      console.error('[Background] Error handling message:', error)
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })()

  // Return true to indicate async response
  return true
})

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed:', details.reason)

  if (details.reason === 'install') {
    // First-time installation
    console.log('[Background] First-time installation - showing welcome message')
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('[Background] Extension updated from version:', details.previousVersion)
  }
})

/**
 * Keep service worker alive with periodic alarm
 * (Chrome kills inactive service workers after 30 seconds)
 */
chrome.alarms.create('keepAlive', { periodInMinutes: 1 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[Background] Keep-alive ping')
  }
})

console.log('[Background] Service worker initialized')
