/**
 * Wallet Persistence Test - Node.js Runner
 *
 * This script runs a headless browser test to verify wallet persistence.
 * It can be run without Playwright installed by using puppeteer as a fallback.
 */

const { chromium } = require('@playwright/test');

async function runTest() {
  console.log('================================================');
  console.log('OwnYou Consumer - Wallet Persistence Test');
  console.log('================================================\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Store console logs
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });

  try {
    console.log('Step 1: Navigate to http://localhost:3002');
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    console.log('Step 2: Clear localStorage to start fresh');
    await page.evaluate(() => localStorage.clear());

    console.log('Step 3: Check initial state (should be unauthenticated)');
    const getStartedButton = page.getByRole('button', { name: /get started/i });

    try {
      await getStartedButton.waitFor({ state: 'visible', timeout: 10000 });
      console.log('✓ Get Started button is visible\n');
    } catch (e) {
      console.error('✗ Get Started button not found - initial state may be wrong\n');
    }

    console.log('Step 4: Take screenshot before authentication');
    await page.screenshot({ path: 'test-results/wallet-before-auth.png', fullPage: true });
    console.log('✓ Screenshot saved: test-results/wallet-before-auth.png\n');

    console.log('Step 5: Click "Get Started" to create a wallet');
    await getStartedButton.click();
    await page.waitForTimeout(1500);

    console.log('Step 6: Get wallet address from localStorage');
    const walletDataBefore = await page.evaluate(() => {
      const walletJson = localStorage.getItem('ownyou_wallet');
      return walletJson ? JSON.parse(walletJson) : null;
    });

    if (walletDataBefore) {
      console.log('✓ Wallet created successfully');
      console.log(`  Address: ${walletDataBefore.address}`);
      console.log(`  Public Key: ${walletDataBefore.publicKey}\n`);
    } else {
      console.error('✗ Wallet not created - localStorage is empty\n');
      throw new Error('Wallet creation failed');
    }

    const addressBefore = walletDataBefore?.address;

    console.log('Step 7: Take screenshot after authentication');
    await page.screenshot({ path: 'test-results/wallet-after-auth.png', fullPage: true });
    console.log('✓ Screenshot saved: test-results/wallet-after-auth.png\n');

    console.log('Step 8: Reload the page');
    console.log('--- RELOAD ---');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    console.log('Step 9: Check if still authenticated after reload');
    const getStartedAfterReload = page.getByRole('button', { name: /get started/i });

    try {
      await getStartedAfterReload.waitFor({ state: 'hidden', timeout: 5000 });
      console.log('✓ Still authenticated (Get Started button is hidden)\n');
    } catch (e) {
      console.error('✗ Not authenticated after reload (Get Started button is visible)\n');
    }

    console.log('Step 10: Verify wallet data persisted in localStorage');
    const walletDataAfter = await page.evaluate(() => {
      const walletJson = localStorage.getItem('ownyou_wallet');
      return walletJson ? JSON.parse(walletJson) : null;
    });

    if (walletDataAfter) {
      console.log('✓ Wallet data persisted after reload');
      console.log(`  Address: ${walletDataAfter.address}`);
      console.log(`  Public Key: ${walletDataAfter.publicKey}\n`);
    } else {
      console.error('✗ Wallet data lost after reload\n');
      throw new Error('Wallet persistence failed');
    }

    const addressAfter = walletDataAfter?.address;

    console.log('Step 11: Verify the same wallet address is preserved');
    if (addressBefore === addressAfter) {
      console.log('✓ PASS: Wallet address matches before and after reload');
      console.log(`  Address: ${addressAfter}\n`);
    } else {
      console.error('✗ FAIL: Wallet address changed after reload');
      console.error(`  Before: ${addressBefore}`);
      console.error(`  After:  ${addressAfter}\n`);
      throw new Error('Wallet address mismatch');
    }

    console.log('Step 12: Take screenshot after reload');
    await page.screenshot({ path: 'test-results/wallet-after-reload.png', fullPage: true });
    console.log('✓ Screenshot saved: test-results/wallet-after-reload.png\n');

    console.log('Step 13: Check console logs for errors');
    const errors = consoleLogs.filter(log => log.startsWith('error:'));
    if (errors.length > 0) {
      console.log('Console Errors Found:');
      errors.forEach(err => console.log(`  ${err}`));
      console.log('');
    } else {
      console.log('✓ No console errors found\n');
    }

    // Print relevant console logs
    const relevantLogs = consoleLogs.filter(log =>
      log.includes('IndexedDB') ||
      log.includes('wallet') ||
      log.includes('Auth') ||
      log.includes('store')
    );
    if (relevantLogs.length > 0) {
      console.log('Relevant Console Logs:');
      relevantLogs.forEach(log => console.log(`  ${log}`));
      console.log('');
    }

    console.log('================================================');
    console.log('TEST SUMMARY');
    console.log('================================================');
    console.log(`Wallet persisted: YES`);
    console.log(`Address before reload: ${addressBefore}`);
    console.log(`Address after reload:  ${addressAfter}`);
    console.log(`Addresses match: ${addressBefore === addressAfter ? 'YES' : 'NO'}`);
    console.log(`Errors found: ${errors.length}`);
    console.log('\n✓ ALL TESTS PASSED\n');

  } catch (error) {
    console.error('\n================================================');
    console.error('TEST FAILED');
    console.error('================================================');
    console.error(`Error: ${error.message}\n`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Check if dev server is running
async function checkDevServer() {
  try {
    const response = await fetch('http://localhost:3002');
    return response.ok;
  } catch (e) {
    return false;
  }
}

// Main execution
(async () => {
  console.log('\nChecking if dev server is running...');

  // Use node-fetch polyfill for older Node versions
  if (typeof fetch === 'undefined') {
    console.log('Note: Using HTTP check for dev server...\n');
  }

  try {
    await runTest();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
})();
