#!/usr/bin/env node
/**
 * OAuth Token Lifetime Test
 *
 * Tests whether a custom Azure app registration grants 90-day refresh tokens
 * using the device code flow (simulates extension behavior).
 *
 * CRITICAL: This test MUST pass before building the browser extension.
 *
 * Usage:
 *   1. Create Azure app registration (see OAUTH_EXTENSION_IMPLEMENTATION.md Section 3.1)
 *   2. Set environment variables:
 *      export AZURE_CLIENT_ID="your_client_id"
 *      export AZURE_TENANT_ID="common"  # or your tenant ID
 *   3. Run: node tests/oauth-token-lifetime-test.js
 *   4. Complete authentication in browser
 *   5. Wait 25 hours
 *   6. Run again to verify silent token refresh works
 *
 * Expected Result:
 *   - After 25 hours: Silent refresh succeeds (90-day behavior)
 *   - If fails: App is configured as SPA (24-hour behavior) - FIX BEFORE PROCEEDING
 */

const msal = require('@azure/msal-node');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const TOKEN_CACHE_FILE = path.join(__dirname, '../.oauth-test-cache.json');
const TEST_LOG_FILE = path.join(__dirname, '../.oauth-test-log.json');

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || 'common';

if (!AZURE_CLIENT_ID) {
  console.error('❌ Error: AZURE_CLIENT_ID environment variable not set');
  console.error('');
  console.error('Setup instructions:');
  console.error('1. Create Azure app registration (Mobile and Desktop platform)');
  console.error('2. Copy Application (client) ID');
  console.error('3. Run: export AZURE_CLIENT_ID="your_client_id_here"');
  console.error('4. Run this script again');
  process.exit(1);
}

// MSAL configuration (same as extension will use)
const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
  },
  cache: {
    cachePlugin: {
      beforeCacheAccess: async (cacheContext) => {
        try {
          const cacheFile = await fs.readFile(TOKEN_CACHE_FILE, 'utf-8');
          cacheContext.tokenCache.deserialize(cacheFile);
        } catch (err) {
          // Cache file doesn't exist yet - this is normal for first run
        }
      },
      afterCacheAccess: async (cacheContext) => {
        if (cacheContext.cacheHasChanged) {
          await fs.writeFile(TOKEN_CACHE_FILE, cacheContext.tokenCache.serialize());
        }
      }
    }
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        console.log(`[MSAL] ${message}`);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Info,
    }
  }
};

const pca = new msal.PublicClientApplication(msalConfig);

const tokenRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'offline_access',
    'https://graph.microsoft.com/Mail.Read'
  ],
};

/**
 * Log test event
 */
async function logEvent(event, data = {}) {
  const timestamp = new Date().toISOString();
  let log = { events: [] };

  try {
    const logContent = await fs.readFile(TEST_LOG_FILE, 'utf-8');
    log = JSON.parse(logContent);
  } catch {
    // Log file doesn't exist yet
  }

  log.events.push({
    timestamp,
    event,
    ...data
  });

  await fs.writeFile(TEST_LOG_FILE, JSON.stringify(log, null, 2));

  console.log(`\n[${timestamp}] ${event}`);
  if (Object.keys(data).length > 0) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Perform initial authentication (device code flow)
 */
async function initialAuth() {
  console.log('\n=== INITIAL AUTHENTICATION ===');
  console.log('Starting device code flow (simulates extension behavior)...\n');

  const deviceCodeRequest = {
    ...tokenRequest,
    deviceCodeCallback: (response) => {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('1. Open this URL in your browser:', response.verificationUri);
      console.log('2. Enter this code:', response.userCode);
      console.log('3. Complete authentication\n');
      console.log('Waiting for you to complete authentication...');
    }
  };

  try {
    const response = await pca.acquireTokenByDeviceCode(deviceCodeRequest);

    await logEvent('INITIAL_AUTH_SUCCESS', {
      account: response.account.username,
      expiresOn: response.expiresOn,
      scopes: response.scopes,
      hasRefreshToken: !!response.refreshToken
    });

    console.log('\n✅ Authentication successful!');
    console.log('Account:', response.account.username);
    console.log('Access token expires:', response.expiresOn);
    console.log('Refresh token received:', !!response.refreshToken ? 'Yes' : 'No');

    return response.account;

  } catch (error) {
    await logEvent('INITIAL_AUTH_FAILED', {
      error: error.message,
      errorCode: error.errorCode
    });

    console.error('\n❌ Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Test silent token refresh
 */
async function testSilentRefresh(account) {
  console.log('\n=== TESTING SILENT REFRESH ===');
  console.log('Attempting silent token refresh...\n');

  const silentRequest = {
    ...tokenRequest,
    account: account,
    forceRefresh: false
  };

  try {
    const response = await pca.acquireTokenSilent(silentRequest);

    await logEvent('SILENT_REFRESH_SUCCESS', {
      account: response.account.username,
      expiresOn: response.expiresOn,
      fromCache: response.fromCache
    });

    console.log('✅ Silent refresh successful!');
    console.log('Account:', response.account.username);
    console.log('Access token expires:', response.expiresOn);
    console.log('From cache:', response.fromCache);

    return { success: true, response };

  } catch (error) {
    if (error.errorCode === 'interaction_required') {
      await logEvent('SILENT_REFRESH_FAILED_INTERACTION_REQUIRED', {
        error: error.message,
        errorCode: error.errorCode,
        subError: error.subError
      });

      console.error('\n❌ CRITICAL: Silent refresh failed - interaction required!');
      console.error('This indicates the refresh token has expired (likely 24-hour SPA behavior).');
      console.error('');
      console.error('Possible causes:');
      console.error('1. App registered as "Web" or "SPA" platform (should be "Mobile and Desktop")');
      console.error('2. Redirect URI registered as "spa" type (should be nativeclient or mobile)');
      console.error('3. Conditional Access policy forcing re-authentication');
      console.error('');
      console.error('FIX: Check Azure app registration configuration (see OAUTH_EXTENSION_IMPLEMENTATION.md Section 3.1)');

      return { success: false, error };

    } else {
      await logEvent('SILENT_REFRESH_FAILED_OTHER', {
        error: error.message,
        errorCode: error.errorCode
      });

      console.error('\n❌ Silent refresh failed:', error.message);
      return { success: false, error };
    }
  }
}

/**
 * Calculate time since initial auth
 */
async function getTimeSinceInitialAuth() {
  try {
    const logContent = await fs.readFile(TEST_LOG_FILE, 'utf-8');
    const log = JSON.parse(logContent);

    const initialAuthEvent = log.events.find(e => e.event === 'INITIAL_AUTH_SUCCESS');
    if (!initialAuthEvent) {
      return null;
    }

    const initialTime = new Date(initialAuthEvent.timestamp);
    const now = new Date();
    const hoursSince = (now - initialTime) / (1000 * 60 * 60);

    return { initialTime, hoursSince };

  } catch {
    return null;
  }
}

/**
 * Main test runner
 */
async function runTest() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         OAuth Token Lifetime Verification Test           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Azure Client ID:', AZURE_CLIENT_ID);
  console.log('Azure Tenant:', AZURE_TENANT_ID);
  console.log('');

  // Check if we already have cached tokens
  const accounts = await pca.getTokenCache().getAllAccounts();

  if (accounts.length === 0) {
    console.log('📝 No cached tokens found - performing initial authentication...');
    const account = await initialAuth();

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   NEXT STEPS (CRITICAL)                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('⏰ Wait 25 hours, then run this script again:');
    console.log('   node tests/oauth-token-lifetime-test.js');
    console.log('');
    console.log('Expected Result:');
    console.log('  ✅ Silent refresh succeeds = 90-day tokens (proceed with extension)');
    console.log('  ❌ Interaction required = 24-hour tokens (FIX Azure config)');
    console.log('');
    console.log('Test state saved to:', TEST_LOG_FILE);
    console.log('');

  } else {
    const account = accounts[0];
    console.log('✓ Found cached account:', account.username);

    const timeSince = await getTimeSinceInitialAuth();
    if (timeSince) {
      console.log('⏰ Time since initial auth:', timeSince.hoursSince.toFixed(1), 'hours');
      console.log('   Initial auth:', timeSince.initialTime.toISOString());

      if (timeSince.hoursSince < 24) {
        console.log('');
        console.log('⚠️  WARNING: Only', timeSince.hoursSince.toFixed(1), 'hours have passed.');
        console.log('   Need to wait at least 25 hours to verify 90-day behavior.');
        console.log('   (SPA tokens expire at 24 hours)');
        console.log('');
        console.log('Wait', (25 - timeSince.hoursSince).toFixed(1), 'more hours, then run again.');
      } else if (timeSince.hoursSince >= 24 && timeSince.hoursSince < 26) {
        console.log('');
        console.log('✅ Sufficient time has passed (>24 hours) - ready to verify!');
        console.log('');
      } else {
        console.log('');
        console.log('⏰ Time since auth:', timeSince.hoursSince.toFixed(1), 'hours');
        console.log('');
      }
    }

    // Test silent refresh
    const result = await testSilentRefresh(account);

    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST RESULTS                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    if (result.success) {
      if (timeSince && timeSince.hoursSince >= 24) {
        console.log('🎉 SUCCESS! Your Azure app grants 90-day refresh tokens!');
        console.log('');
        console.log('✅ Token Lifetime: >24 hours (likely 90 days)');
        console.log('✅ Platform Type: Mobile/Desktop (native client)');
        console.log('✅ Ready to proceed: Build the browser extension');
        console.log('');
        console.log('Next steps:');
        console.log('1. Document these results in OAUTH_EXTENSION_IMPLEMENTATION.md (Section 3.2)');
        console.log('2. Begin extension development (Section 11)');
        console.log('');

        await logEvent('TEST_PASSED_90DAY_TOKENS', {
          hoursSinceAuth: timeSince.hoursSince,
          verdict: '90-day tokens confirmed'
        });

      } else {
        console.log('✅ Silent refresh works, but need to wait 25+ hours for full verification.');
        console.log('');
        console.log('Current time since auth:', timeSince ? timeSince.hoursSince.toFixed(1) + ' hours' : 'unknown');
        console.log('Run again after 25 hours total.');
      }

    } else {
      if (timeSince && timeSince.hoursSince >= 24) {
        console.log('❌ FAILED: App is configured for 24-hour tokens (SPA behavior)');
        console.log('');
        console.log('Time since auth:', timeSince.hoursSince.toFixed(1), 'hours');
        console.log('Token lifetime: <24 hours (SPA/Web platform)');
        console.log('');
        console.log('🛠️  FIX REQUIRED:');
        console.log('1. Go to Azure Portal → App Registrations');
        console.log('2. Select your app:', AZURE_CLIENT_ID);
        console.log('3. Authentication → Platform configuration');
        console.log('4. REMOVE any "Web" or "Single-page application" platforms');
        console.log('5. ADD "Mobile and desktop applications" platform');
        console.log('6. Redirect URI: https://login.microsoftonline.com/common/oauth2/nativeclient');
        console.log('7. Advanced settings → Allow public client flows: Yes');
        console.log('8. Delete cache files and run this test again:');
        console.log('   rm', TOKEN_CACHE_FILE);
        console.log('   rm', TEST_LOG_FILE);
        console.log('   node tests/oauth-token-lifetime-test.js');
        console.log('');

        await logEvent('TEST_FAILED_24HOUR_TOKENS', {
          hoursSinceAuth: timeSince.hoursSince,
          verdict: '24-hour tokens detected - Azure config needs fixing'
        });

      } else {
        console.log('⚠️  Silent refresh failed, but less than 24 hours have passed.');
        console.log('Wait', timeSince ? (25 - timeSince.hoursSince).toFixed(1) + ' more hours' : '25 hours', 'then run again.');
      }
    }

    console.log('');
    console.log('Test log:', TEST_LOG_FILE);
    console.log('');
  }
}

// Run the test
runTest().catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});
