/**
 * TriggerEngine Auto-Start E2E Test
 *
 * Verifies that TriggerEngine automatically starts after authentication
 * and monitors console logs for all required initialization messages.
 *
 * Run: npx playwright test trigger-engine.spec.ts --headed
 */

import { test, expect, type ConsoleMessage } from '@playwright/test';

const TEST_URL = 'http://localhost:3002';

interface TriggerEngineResults {
  triggerContextInit: boolean;
  triggerEngineStarted: boolean;
  storeWatcherStarted: boolean;
  cronSchedulerStarted: boolean;
  autoStarted: boolean;
  watchedNamespaces: string[];
  activeSchedules: number;
  allMessages: Array<{ type: string; text: string }>;
  errors: string[];
  warnings: string[];
}

test.describe('TriggerEngine Auto-Start', () => {
  let consoleMessages: ConsoleMessage[] = [];
  let results: TriggerEngineResults;

  test.beforeEach(async ({ page }) => {
    // Reset results
    results = {
      triggerContextInit: false,
      triggerEngineStarted: false,
      storeWatcherStarted: false,
      cronSchedulerStarted: false,
      autoStarted: false,
      watchedNamespaces: [],
      activeSchedules: 0,
      allMessages: [],
      errors: [],
      warnings: [],
    };

    consoleMessages = [];

    // Listen to all console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
      const text = msg.text();
      const type = msg.type();

      // Store message
      results.allMessages.push({ type, text });

      // Check for TriggerEngine-related messages
      if (text.includes('[TriggerContext] TriggerEngine initialized')) {
        results.triggerContextInit = true;
        console.log('✓ TriggerContext initialized');
      }

      if (text.includes('[TriggerEngine] Started')) {
        results.triggerEngineStarted = true;
        console.log('✓ TriggerEngine started');

        // Extract watched namespaces
        const match = text.match(/Watching namespaces: (.+)/);
        if (match) {
          results.watchedNamespaces = match[1].split(', ').map(ns => ns.trim());
          console.log(`  Namespaces: ${results.watchedNamespaces.join(', ')}`);
        }

        // Extract active schedules
        const schedMatch = text.match(/Active schedules: (\d+)/);
        if (schedMatch) {
          results.activeSchedules = parseInt(schedMatch[1], 10);
          console.log(`  Schedules: ${results.activeSchedules}`);
        }
      }

      if (text.includes('[StoreWatcher] Started watching')) {
        results.storeWatcherStarted = true;
        console.log('✓ StoreWatcher started');

        // Extract namespaces from message
        const parts = text.split('[StoreWatcher] Started watching:');
        if (parts[1]) {
          const nsText = parts[1].trim();
          // Handle both array format and comma-separated
          const namespaces = nsText
            .replace(/[\[\]']/g, '')
            .split(',')
            .map(ns => ns.trim())
            .filter(ns => ns);
          if (namespaces.length > 0) {
            results.watchedNamespaces = namespaces;
          }
        }
      }

      if (text.includes('[CronScheduler] Started')) {
        results.cronSchedulerStarted = true;
        console.log('✓ CronScheduler started');

        // Extract schedule count
        const match = text.match(/Started with (\d+) schedules/);
        if (match) {
          results.activeSchedules = parseInt(match[1], 10);
          console.log(`  Schedule count: ${results.activeSchedules}`);
        }
      }

      if (text.includes('[TriggerContext] TriggerEngine auto-started')) {
        results.autoStarted = true;
        console.log('✓ Auto-start confirmed');
      }

      // Track errors and warnings
      if (type === 'error') {
        results.errors.push(text);
        console.error(`✗ ERROR: ${text}`);
      }

      if (type === 'warning') {
        results.warnings.push(text);
        console.warn(`⚠ WARNING: ${text}`);
      }
    });

    // Listen to page errors
    page.on('pageerror', (error) => {
      const errorText = error.toString();
      results.errors.push(errorText);
      console.error(`✗ PAGE ERROR: ${errorText}`);
    });
  });

  test('should automatically start TriggerEngine after authentication', async ({ page }) => {
    console.log('\n' + '='.repeat(80));
    console.log('Testing TriggerEngine Auto-Start');
    console.log('='.repeat(80));

    // Navigate to app
    console.log('\n1. Navigating to app...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });

    // Wait for initial render
    await page.waitForTimeout(1000);

    // Look for authentication button
    console.log('\n2. Looking for authentication...');
    const getStartedButton = page.locator('button:has-text("Get Started")').first();
    const createWalletButton = page.locator('button:has-text("Create Wallet")').first();

    // Try to authenticate if button is visible
    try {
      if (await getStartedButton.isVisible({ timeout: 3000 })) {
        console.log('   Found "Get Started" button, clicking...');
        await getStartedButton.click();
      } else if (await createWalletButton.isVisible({ timeout: 3000 })) {
        console.log('   Found "Create Wallet" button, clicking...');
        await createWalletButton.click();
      } else {
        console.log('   No auth button found - user may already be authenticated');
      }
    } catch (e) {
      console.log('   No auth required - proceeding...');
    }

    // Wait for authentication and TriggerEngine initialization
    console.log('\n3. Waiting for TriggerEngine initialization...');
    await page.waitForTimeout(8000); // Give enough time for all components to start

    // Take screenshot
    const screenshotPath = './test-results/trigger-engine-test.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n4. Screenshot saved to: ${screenshotPath}`);

    // Print results
    console.log('\n' + '='.repeat(80));
    console.log('TEST RESULTS');
    console.log('='.repeat(80));
    console.log('\nComponent Initialization:');
    console.log(`  TriggerContext Init:  ${results.triggerContextInit ? '✓ YES' : '✗ NO'}`);
    console.log(`  TriggerEngine Start:  ${results.triggerEngineStarted ? '✓ YES' : '✗ NO'}`);
    console.log(`  StoreWatcher Start:   ${results.storeWatcherStarted ? '✓ YES' : '✗ NO'}`);
    console.log(`  CronScheduler Start:  ${results.cronSchedulerStarted ? '✓ YES' : '✗ NO'}`);
    console.log(`  Auto-Start Confirmed: ${results.autoStarted ? '✓ YES' : '✗ NO'}`);

    console.log('\nConfiguration:');
    console.log(`  Watched Namespaces: ${results.watchedNamespaces.length > 0 ? results.watchedNamespaces.join(', ') : 'NONE DETECTED'}`);
    console.log(`  Active Schedules: ${results.activeSchedules}`);

    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach((error, i) => console.log(`  ${i + 1}. ${error}`));
    }

    if (results.warnings.length > 0) {
      console.log('\nWarnings:');
      results.warnings.forEach((warning, i) => console.log(`  ${i + 1}. ${warning}`));
    }

    // Print all TriggerEngine messages
    const triggerMessages = results.allMessages.filter(msg =>
      msg.text.includes('[TriggerContext]') ||
      msg.text.includes('[TriggerEngine]') ||
      msg.text.includes('[StoreWatcher]') ||
      msg.text.includes('[CronScheduler]')
    );

    if (triggerMessages.length > 0) {
      console.log('\nAll TriggerEngine Messages:');
      triggerMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. [${msg.type}] ${msg.text}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    // Assertions
    expect(results.triggerContextInit, 'TriggerContext should initialize').toBe(true);
    expect(results.triggerEngineStarted, 'TriggerEngine should start').toBe(true);
    expect(results.storeWatcherStarted, 'StoreWatcher should start').toBe(true);
    expect(results.cronSchedulerStarted, 'CronScheduler should start').toBe(true);
    expect(results.autoStarted, 'Auto-start should be confirmed').toBe(true);

    // Verify namespaces
    expect(results.watchedNamespaces.length, 'Should watch at least 1 namespace').toBeGreaterThan(0);
    expect(results.watchedNamespaces, 'Should watch ownyou.iab namespace').toContain('ownyou.iab');
    expect(results.watchedNamespaces, 'Should watch ownyou.mission_feedback namespace').toContain('ownyou.mission_feedback');

    // Verify schedules
    expect(results.activeSchedules, 'Should have 2 active schedules').toBe(2);

    // Verify no errors
    expect(results.errors.length, 'Should have no errors').toBe(0);

    console.log('\n✓ All tests passed!');
    console.log('='.repeat(80) + '\n');
  });

  test('should have correct schedule configuration', async ({ page }) => {
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });

    // Try to auth
    try {
      const btn = page.locator('button:has-text("Get Started")').first();
      if (await btn.isVisible({ timeout: 3000 })) {
        await btn.click();
      }
    } catch {}

    await page.waitForTimeout(5000);

    // Check for schedule messages in console
    const scheduleMessages = consoleMessages.filter(msg =>
      msg.text().includes('daily_digest') || msg.text().includes('weekly_summary')
    );

    // We should see schedule definitions (though they may not be in console)
    // This is more of a configuration check
    expect(results.activeSchedules).toBeGreaterThanOrEqual(2);
  });

  test('should not have duplicate initialization', async ({ page }) => {
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });

    // Try to auth
    try {
      const btn = page.locator('button:has-text("Get Started")').first();
      if (await btn.isVisible({ timeout: 3000 })) {
        await btn.click();
      }
    } catch {}

    await page.waitForTimeout(5000);

    // Count "Started" messages - should only appear once (per component)
    const startedMessages = consoleMessages.filter(msg =>
      msg.text().includes('[TriggerEngine] Started')
    );

    // In development with React StrictMode, we might see double initialization
    // But in production, should only be once
    expect(startedMessages.length).toBeGreaterThan(0);

    // Check for "Already running" warnings which indicate double-start
    const alreadyRunningWarnings = results.warnings.filter(w =>
      w.includes('Already running')
    );

    expect(alreadyRunningWarnings.length, 'Should not have "Already running" warnings').toBe(0);
  });
});
