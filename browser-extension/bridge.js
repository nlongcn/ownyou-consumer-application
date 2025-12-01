/**
 * Bridge Script for OwnYou Browser Extension
 *
 * Injected into PWA page context to provide OwnYouAuth API
 * This script runs in the page context (not extension context)
 */

(function() {
  'use strict';

  console.log('OwnYou Bridge Script Loaded');

  // Create OwnYouAuth API
  window.OwnYouAuth = {
    /**
     * Get access token for Microsoft Outlook
     * @returns {Promise<{accessToken: string, expiresAt: number}>}
     */
    async getAccessToken(provider = 'microsoft') {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substr(2, 9);

        // Listen for response
        const handler = (event) => {
          if (event.data.type === 'OWNYOU_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);

            if (event.data.payload.success) {
              resolve({
                accessToken: event.data.payload.accessToken,
                expiresAt: event.data.payload.expiresAt
              });
            } else {
              reject(new Error(event.data.payload.error || 'Failed to get access token'));
            }
          }
        };

        window.addEventListener('message', handler);

        // Send request to content script
        window.postMessage({
          type: 'OWNYOU_REQUEST',
          source: 'ownyou-pwa',
          requestId,
          payload: {
            type: 'GET_ACCESS_TOKEN',
            provider
          }
        }, '*');

        // Timeout after 5 seconds
        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Request timeout - is the OwnYou extension installed?'));
        }, 5000);
      });
    },

    /**
     * Get authentication status
     * @returns {Promise<{authenticated: boolean, accountEmail?: string, daysRemaining?: number}>}
     */
    async getStatus(provider = 'microsoft') {
      return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substr(2, 9);

        const handler = (event) => {
          if (event.data.type === 'OWNYOU_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handler);

            if (event.data.payload.success) {
              resolve(event.data.payload);
            } else {
              reject(new Error(event.data.payload.error || 'Failed to get status'));
            }
          }
        };

        window.addEventListener('message', handler);

        window.postMessage({
          type: 'OWNYOU_REQUEST',
          source: 'ownyou-pwa',
          requestId,
          payload: {
            type: 'GET_TOKEN_STATUS',
            provider
          }
        }, '*');

        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Request timeout'));
        }, 5000);
      });
    },

    /**
     * Check if extension is installed
     * @returns {boolean}
     */
    isExtensionInstalled() {
      return typeof window.OwnYouAuth !== 'undefined';
    }
  };

  console.log('OwnYouAuth API Ready:', window.OwnYouAuth);

})();
