/**
 * Token Verification Script
 *
 * INSTRUCTIONS:
 * 1. Go to chrome://extensions/
 * 2. Find "OwnYou Personal AI Extension"
 * 3. Click "service worker" link
 * 4. Copy and paste this entire script into the console
 * 5. Press Enter to run
 */

console.log('🔍 Verifying OwnYou Token Storage...\n');

// Check token storage
chrome.storage.local.get(['ownyou_tokens_microsoft'], (result) => {
  console.log('📦 Raw Storage Result:', result);

  if (!result.ownyou_tokens_microsoft) {
    console.error('❌ No Microsoft tokens found in storage');
    console.log('\nℹ️ This means authentication did not complete successfully.');
    console.log('ℹ️ Try authenticating again from the extension popup.');
    return;
  }

  const encryptedTokens = result.ownyou_tokens_microsoft;

  console.log('\n✅ Microsoft tokens found in storage!');
  console.log('\n📊 Token Storage Structure:');
  console.log('├─ data (encrypted):', encryptedTokens.data ? `Array[${encryptedTokens.data.length}]` : '❌ MISSING');
  console.log('├─ iv (initialization vector):', encryptedTokens.iv ? `Array[${encryptedTokens.iv.length}]` : '❌ MISSING');
  console.log('├─ accountEmail:', encryptedTokens.accountEmail || '❌ MISSING');
  console.log('└─ expiresAt:', encryptedTokens.expiresAt ? new Date(encryptedTokens.expiresAt).toISOString() : '❌ MISSING');

  if (encryptedTokens.data && encryptedTokens.iv) {
    console.log('\n🔒 Encryption Verified:');
    console.log('├─ Encrypted data length:', encryptedTokens.data.length, 'bytes');
    console.log('├─ IV length:', encryptedTokens.iv.length, 'bytes (should be 12)');
    console.log('└─ Algorithm: AES-GCM with PBKDF2 key derivation');

    if (encryptedTokens.iv.length !== 12) {
      console.warn('⚠️ WARNING: IV should be 12 bytes for AES-GCM');
    }
  } else {
    console.error('\n❌ Encryption data incomplete!');
    console.error('├─ data present:', !!encryptedTokens.data);
    console.error('└─ iv present:', !!encryptedTokens.iv);
  }

  if (encryptedTokens.expiresAt) {
    const now = Date.now();
    const expiresAt = encryptedTokens.expiresAt;
    const daysRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor(((expiresAt - now) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    console.log('\n⏰ Token Expiration:');
    console.log('├─ Expires at:', new Date(expiresAt).toLocaleString());
    console.log('├─ Time remaining:', daysRemaining, 'days', hoursRemaining, 'hours');

    if (daysRemaining >= 60) {
      console.log('└─ ✅ GREAT! This is a 90-day refresh token');
    } else if (daysRemaining >= 1) {
      console.log('└─ ⚠️ WARNING: Token expires in less than 60 days (expected 90 days)');
    } else {
      console.log('└─ ❌ ERROR: Token expires in less than 1 day (should be 90 days)');
    }
  }

  if (encryptedTokens.accountEmail) {
    console.log('\n👤 Account Information:');
    console.log('└─ Email:', encryptedTokens.accountEmail);
  }

  console.log('\n✅ Verification Complete!');
  console.log('\n📋 Summary:');
  console.log('├─ Storage key: ownyou_tokens_microsoft');
  console.log('├─ Encryption: AES-GCM');
  console.log('├─ Token type: Microsoft OAuth 2.0');
  console.log('└─ Status:', encryptedTokens.data && encryptedTokens.iv ? '✅ Valid' : '❌ Invalid');
});

// Check if token refresh is scheduled
chrome.alarms.getAll((alarms) => {
  console.log('\n⏰ Scheduled Token Refresh:');

  const refreshAlarm = alarms.find(a => a.name === 'refresh_microsoft');

  if (refreshAlarm) {
    const nextRefresh = new Date(refreshAlarm.scheduledTime);
    const minutesUntilRefresh = Math.floor((refreshAlarm.scheduledTime - Date.now()) / (1000 * 60));

    console.log('✅ Token refresh is scheduled:');
    console.log('├─ Next refresh:', nextRefresh.toLocaleString());
    console.log('├─ In:', minutesUntilRefresh, 'minutes');
    console.log('└─ Alarm name:', refreshAlarm.name);
  } else {
    console.log('⚠️ No token refresh scheduled');
    console.log('ℹ️ Refresh should be scheduled automatically after successful authentication');
  }
});

console.log('\n---\n');
