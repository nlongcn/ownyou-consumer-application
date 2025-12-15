import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * E2E Test: Authentication State Persistence Across Routes
 *
 * This test verifies that user authentication state (wallet-based) is preserved
 * when navigating between different routes in the consumer application.
 *
 * Test Scenario:
 * 1. Navigate to home page
 * 2. Create/verify wallet authentication
 * 3. Navigate through all routes: /, /profile, /wallet, /settings
 * 4. Verify auth state is maintained on each route
 * 5. Capture screenshots and console errors
 */

const BASE_URL = 'http://localhost:3002';
const ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/profile', name: 'Profile' },
  { path: '/wallet', name: 'Wallet' },
  { path: '/settings', name: 'Settings' },
  { path: '/', name: 'Home (return)' },
];

// Ensure screenshot directory exists
const screenshotDir = path.join(process.cwd(), 'test-results', 'auth-persistence');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

test.describe('Authentication State Persistence', () => {
  let consoleErrors: Array<{ text: string; url: string; lineNumber: number }> = [];

  test.beforeEach(async ({ page }) => {
    // Reset console errors for each test
    consoleErrors = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          url: msg.location().url,
          lineNumber: msg.location().lineNumber,
        });
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      consoleErrors.push({
        text: error.message,
        url: 'page-error',
        lineNumber: 0,
      });
    });
  });

  test('should preserve auth state across all routes', async ({ page }) => {
    const results: Array<{
      route: string;
      name: string;
      isAuthenticated: boolean;
      walletAddress: string | null;
      hasNavigation: boolean;
      hasGetStarted: boolean;
      currentUrl: string;
    }> = [];

    // Step 1: Navigate to home page
    console.log('Step 1: Navigate to home page');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: path.join('test-results', 'auth-persistence', '01-initial-load.png'),
      fullPage: true,
    });

    // Step 2: Check if already authenticated or need to create wallet
    const getStartedButton = page.locator('button:has-text("Get Started")');
    const isGetStartedVisible = await getStartedButton.isVisible().catch(() => false);

    if (isGetStartedVisible) {
      console.log('Step 2: Creating wallet by clicking "Get Started"');
      await getStartedButton.click();

      // Wait for wallet creation (could take a moment)
      await page.waitForTimeout(3000);

      // Check if wallet was created
      const walletAfterClick = await page.evaluate(() => {
        const walletData = localStorage.getItem('ownyou_wallet');
        return walletData;
      });

      console.log('Wallet after click:', walletAfterClick ? 'Created' : 'Not created');

      await page.screenshot({
        path: path.join('test-results', 'auth-persistence', '02-after-wallet-creation.png'),
        fullPage: true,
      });

      // If still on landing page, there might be an issue
      const stillHasGetStarted = await page
        .locator('button:has-text("Get Started")')
        .isVisible()
        .catch(() => false);

      if (stillHasGetStarted) {
        console.log('WARNING: Still showing Get Started button after click');
        // Check console for errors
        console.log('Console errors so far:', consoleErrors.length);
      }
    } else {
      console.log('Step 2: Already authenticated');
      await page.screenshot({
        path: path.join('test-results', 'auth-persistence', '02-already-authenticated.png'),
        fullPage: true,
      });
    }

    // Step 3-6: Navigate through all routes and verify auth state
    for (let i = 0; i < ROUTES.length; i++) {
      const route = ROUTES[i];
      const stepNumber = i + 3;

      console.log(`Step ${stepNumber}: Navigate to ${route.path} (${route.name})`);

      await page.goto(`${BASE_URL}${route.path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Give UI time to render

      // Check authentication state
      const authState = await page.evaluate(() => {
        const walletData = localStorage.getItem('ownyou_wallet');
        const wallet = walletData ? JSON.parse(walletData) : null;
        return {
          hasWalletInStorage: !!walletData,
          walletAddress: wallet?.address || null,
          walletData: walletData,
        };
      });

      // Check for UI indicators
      const hasGetStarted = await page
        .locator('button:has-text("Get Started")')
        .isVisible()
        .catch(() => false);
      const hasNavigation = await page.locator('nav').isVisible().catch(() => false);

      const currentUrl = page.url();
      const isAuthenticated = authState.hasWalletInStorage && !hasGetStarted;

      const routeResult = {
        route: route.path,
        name: route.name,
        isAuthenticated,
        walletAddress: authState.walletAddress,
        hasNavigation,
        hasGetStarted,
        currentUrl,
      };

      results.push(routeResult);

      // Take screenshot
      const screenshotName = `0${stepNumber}-${route.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')}.png`;
      await page.screenshot({
        path: path.join('test-results', 'auth-persistence', screenshotName),
        fullPage: true,
      });

      // Log result
      if (isAuthenticated) {
        console.log(`  ✅ Auth preserved at ${route.name}`);
      } else {
        console.log(`  ❌ Auth LOST at ${route.name}`);
      }

      // Assert authentication is maintained
      expect(
        isAuthenticated,
        `Authentication should be maintained on ${route.name} (${route.path})`
      ).toBeTruthy();

      // Verify no "Get Started" button on authenticated pages
      expect(
        hasGetStarted,
        `"Get Started" button should not be visible on ${route.name} when authenticated`
      ).toBeFalsy();

      // Verify navigation is present on authenticated pages
      expect(
        hasNavigation,
        `Navigation should be visible on ${route.name} when authenticated`
      ).toBeTruthy();
    }

    // Step 7: Final summary screenshot
    await page.screenshot({
      path: path.join('test-results', 'auth-persistence', '08-final-state.png'),
      fullPage: true,
    });

    // Generate summary report
    console.log('\n' + '='.repeat(80));
    console.log('AUTH PERSISTENCE TEST RESULTS');
    console.log('='.repeat(80));

    console.log('\n📊 SUMMARY:');
    const allAuthenticated = results.every((r) => r.isAuthenticated);
    console.log(`Overall: ${allAuthenticated ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Routes tested: ${results.length}`);

    console.log('\n📍 ROUTE DETAILS:');
    results.forEach((result, idx) => {
      console.log(`\n${idx + 1}. ${result.name} (${result.route})`);
      console.log(
        `   Auth State: ${result.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`
      );
      console.log(`   Wallet: ${result.walletAddress || 'None'}`);
      console.log(`   Has Navigation: ${result.hasNavigation ? 'Yes' : 'No'}`);
      console.log(`   Has Get Started: ${result.hasGetStarted ? 'Yes' : 'No'}`);
    });

    // Report console errors
    if (consoleErrors.length > 0) {
      console.log('\n⚠️  CONSOLE ERRORS:');
      consoleErrors.forEach((error, idx) => {
        console.log(`\n${idx + 1}. ${error.text}`);
        console.log(`   URL: ${error.url}`);
        console.log(`   Line: ${error.lineNumber}`);
      });

      // Fail test if there are auth-related errors
      const authErrors = consoleErrors.filter(
        (e) =>
          e.text.toLowerCase().includes('auth') ||
          e.text.toLowerCase().includes('wallet') ||
          e.text.toLowerCase().includes('unauthorized')
      );

      if (authErrors.length > 0) {
        throw new Error(
          `Found ${authErrors.length} auth-related console errors: ${authErrors
            .map((e) => e.text)
            .join(', ')}`
        );
      }
    } else {
      console.log('\n✅ No console errors detected');
    }

    console.log('\n' + '='.repeat(80));

    // Assert overall success
    expect(allAuthenticated, 'All routes should maintain authentication').toBeTruthy();
  });

  test('should maintain wallet address consistency across routes', async ({ page }) => {
    // Navigate to home and get authenticated
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const getStartedButton = page.locator('button:has-text("Get Started")');
    const isGetStartedVisible = await getStartedButton.isVisible().catch(() => false);

    if (isGetStartedVisible) {
      await getStartedButton.click();
      await page.waitForTimeout(3000);
    }

    // Get initial wallet address
    const initialWallet = await page.evaluate(() => {
      const walletData = localStorage.getItem('ownyou_wallet');
      const wallet = walletData ? JSON.parse(walletData) : null;
      return wallet?.address || null;
    });

    expect(initialWallet, 'Wallet address should exist').toBeTruthy();

    // Navigate through all routes and verify wallet address doesn't change
    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route.path}`);
      await page.waitForLoadState('networkidle');

      const currentWallet = await page.evaluate(() => {
        const walletData = localStorage.getItem('ownyou_wallet');
        const wallet = walletData ? JSON.parse(walletData) : null;
        return wallet?.address || null;
      });

      expect(currentWallet, `Wallet address should exist on ${route.name}`).toBeTruthy();
      expect(
        currentWallet,
        `Wallet address should remain consistent on ${route.name}`
      ).toBe(initialWallet);
    }
  });
});
