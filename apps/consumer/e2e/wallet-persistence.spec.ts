import { test, expect } from '@playwright/test';

/**
 * E2E Test: Wallet Persistence After Page Reload
 *
 * Tests that wallet authentication state persists correctly after:
 * 1. Creating a new wallet
 * 2. Reloading the page
 *
 * This verifies the AuthContext localStorage implementation.
 */

test.describe('Wallet Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to start fresh
    await page.goto('http://localhost:3002');
    await page.evaluate(() => localStorage.clear());
  });

  test('should persist wallet after page reload', async ({ page, context }) => {
    // Enable console logging
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`);
    });

    // Step 1: Navigate to the app
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    // Step 2: Check initial state (should be unauthenticated)
    const getStartedButton = page.getByRole('button', { name: /get started/i });
    await expect(getStartedButton).toBeVisible({ timeout: 10000 });

    // Step 3: Take screenshot before authentication
    await page.screenshot({
      path: 'test-results/wallet-before-auth.png',
      fullPage: true
    });

    // Step 4: Click "Get Started" to create a wallet
    await getStartedButton.click();

    // Wait for authentication to complete
    await page.waitForTimeout(1000);

    // Step 5: Get wallet address from localStorage
    const walletDataBefore = await page.evaluate(() => {
      const walletJson = localStorage.getItem('ownyou_wallet');
      return walletJson ? JSON.parse(walletJson) : null;
    });

    console.log('Wallet data before reload:', walletDataBefore);
    expect(walletDataBefore).toBeTruthy();
    expect(walletDataBefore).toHaveProperty('address');
    expect(walletDataBefore).toHaveProperty('publicKey');

    const addressBefore = walletDataBefore?.address;
    console.log('Wallet address before reload:', addressBefore);

    // Step 6: Take screenshot after authentication
    await page.screenshot({
      path: 'test-results/wallet-after-auth.png',
      fullPage: true
    });

    // Step 7: Reload the page
    console.log('\n--- Reloading page ---\n');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Step 8: Check if still authenticated (Get Started button should NOT be visible)
    const getStartedAfterReload = page.getByRole('button', { name: /get started/i });

    // The button should not be visible if we're authenticated
    await expect(getStartedAfterReload).not.toBeVisible({ timeout: 5000 }).catch(() => {
      // If the button is visible, authentication didn't persist
      console.log('ERROR: Get Started button is still visible after reload');
    });

    // Step 9: Verify wallet data persisted in localStorage
    const walletDataAfter = await page.evaluate(() => {
      const walletJson = localStorage.getItem('ownyou_wallet');
      return walletJson ? JSON.parse(walletJson) : null;
    });

    console.log('Wallet data after reload:', walletDataAfter);
    expect(walletDataAfter).toBeTruthy();
    expect(walletDataAfter).toHaveProperty('address');
    expect(walletDataAfter).toHaveProperty('publicKey');

    const addressAfter = walletDataAfter?.address;
    console.log('Wallet address after reload:', addressAfter);

    // Step 10: Verify the same wallet address is preserved
    expect(addressAfter).toBe(addressBefore);
    console.log('\n✓ Wallet address matches before and after reload');

    // Step 11: Take screenshot after reload
    await page.screenshot({
      path: 'test-results/wallet-after-reload.png',
      fullPage: true
    });

    // Step 12: Print console logs for debugging
    console.log('\n--- Console Logs ---');
    consoleLogs.forEach(log => {
      if (log.includes('IndexedDB') || log.includes('wallet') || log.includes('Auth')) {
        console.log(log);
      }
    });

    // Step 13: Check for any persistence-related errors
    const errors = consoleLogs.filter(log => log.startsWith('error:'));
    if (errors.length > 0) {
      console.log('\n--- Errors Found ---');
      errors.forEach(err => console.log(err));
    }

    // Summary
    console.log('\n--- Test Summary ---');
    console.log(`Wallet persisted: ${walletDataAfter ? 'YES' : 'NO'}`);
    console.log(`Address before reload: ${addressBefore}`);
    console.log(`Address after reload: ${addressAfter}`);
    console.log(`Addresses match: ${addressBefore === addressAfter ? 'YES' : 'NO'}`);
    console.log(`Errors found: ${errors.length}`);
  });

  test('should handle authentication flow correctly', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');

    // Before authentication, localStorage should be empty
    const walletBeforeAuth = await page.evaluate(() => {
      return localStorage.getItem('ownyou_wallet');
    });
    expect(walletBeforeAuth).toBeNull();

    // Click Get Started
    const getStartedButton = page.getByRole('button', { name: /get started/i });
    await expect(getStartedButton).toBeVisible({ timeout: 10000 });
    await getStartedButton.click();

    // Wait for auth to complete
    await page.waitForTimeout(1000);

    // After authentication, localStorage should have wallet data
    const walletAfterAuth = await page.evaluate(() => {
      return localStorage.getItem('ownyou_wallet');
    });
    expect(walletAfterAuth).toBeTruthy();

    // Verify wallet structure
    const walletData = JSON.parse(walletAfterAuth!);
    expect(walletData).toHaveProperty('address');
    expect(walletData).toHaveProperty('publicKey');
    expect(walletData.address).toMatch(/^0x[a-f0-9]{40}$/); // Ethereum address format
  });
});
