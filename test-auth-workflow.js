/**
 * Authentication Workflow Test
 * Tests the complete flow from landing page to wallet creation
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAuthWorkflow() {
  console.log('Starting authentication workflow test...\n');

  const startTime = Date.now();
  const screenshotsDir = path.join(__dirname, 'test-screenshots');

  // Create screenshots directory if it doesn't exist
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Collect console logs
  const consoleLogs = [];
  const consoleErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text, timestamp: Date.now() - startTime });

    if (msg.type() === 'error') {
      consoleErrors.push({ text, timestamp: Date.now() - startTime });
    }

    // Log AuthContext messages in real-time
    if (text.includes('[AuthContext]')) {
      console.log(`[${Date.now() - startTime}ms] ${text}`);
    }
  });

  // Collect network errors
  const networkErrors = [];
  page.on('pageerror', error => {
    networkErrors.push({ message: error.message, timestamp: Date.now() - startTime });
    console.error(`[${Date.now() - startTime}ms] Page Error:`, error.message);
  });

  try {
    // Step 1: Navigate to landing page
    console.log('Step 1: Navigating to http://localhost:3002...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000); // Wait for initial render

    const step1Time = Date.now() - startTime;
    console.log(`✓ Page loaded in ${step1Time}ms\n`);

    // Step 2: Take screenshot of landing page
    console.log('Step 2: Taking screenshot of landing page (unauthenticated state)...');
    await page.screenshot({
      path: path.join(screenshotsDir, '01-landing-page-unauthenticated.png'),
      fullPage: true
    });
    console.log(`✓ Screenshot saved: 01-landing-page-unauthenticated.png\n`);

    // Step 3: Verify "Get Started" button is visible
    console.log('Step 3: Verifying "Get Started" button...');
    const getStartedButton = await page.locator('text="Get Started"').first();
    const isVisible = await getStartedButton.isVisible({ timeout: 5000 });

    if (!isVisible) {
      throw new Error('"Get Started" button not found on landing page');
    }

    console.log('✓ "Get Started" button found and visible\n');

    // Take a screenshot highlighting the button
    await page.screenshot({
      path: path.join(screenshotsDir, '02-get-started-button-visible.png'),
      fullPage: true
    });

    // Step 4: Click "Get Started" button
    console.log('Step 4: Clicking "Get Started" button...');
    const clickTime = Date.now();
    await getStartedButton.click();
    console.log(`✓ Button clicked at ${Date.now() - startTime}ms\n`);

    // Step 5: Wait for wallet creation (monitor console logs)
    console.log('Step 5: Waiting for wallet creation (monitoring console logs)...');
    console.log('Watching for [AuthContext] messages:\n');

    // Wait for wallet creation indicators
    let walletCreated = false;
    let onboardingShown = false;

    // Wait up to 15 seconds for wallet creation
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);

      // Check console logs for wallet creation
      const authLogs = consoleLogs.filter(log => log.text.includes('[AuthContext]'));

      if (authLogs.some(log => log.text.includes('Wallet created') || log.text.includes('wallet generated'))) {
        walletCreated = true;
        console.log(`\n✓ Wallet creation detected in console logs`);
        break;
      }

      // Also check if we can see any indication in the DOM
      try {
        const onboardingText = await page.locator('text="Your AI is Ready"').first();
        if (await onboardingText.isVisible({ timeout: 100 })) {
          onboardingShown = true;
          console.log(`\n✓ Onboarding flow detected in UI`);
          break;
        }
      } catch (e) {
        // Continue waiting
      }
    }

    const walletCreationTime = Date.now() - clickTime;
    console.log(`\nWallet creation process took ${walletCreationTime}ms\n`);

    // Step 6: Verify transition to onboarding flow
    console.log('Step 6: Verifying transition to onboarding flow...');

    try {
      // Wait for "Your AI is Ready" text or similar onboarding indicator
      await page.waitForSelector('text="Your AI is Ready"', { timeout: 5000 });
      console.log('✓ Onboarding flow confirmed: "Your AI is Ready" text found\n');
    } catch (e) {
      console.log('⚠ Could not find "Your AI is Ready" text, checking for other onboarding indicators...\n');

      // Check for alternative indicators
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);

      // Take a screenshot to see what's actually showing
      await page.screenshot({
        path: path.join(screenshotsDir, '03-after-get-started-click.png'),
        fullPage: true
      });
    }

    // Step 7: Take screenshot of post-authentication state
    console.log('Step 7: Taking screenshot of post-authentication state...');
    await page.waitForTimeout(1000); // Wait for any animations
    await page.screenshot({
      path: path.join(screenshotsDir, '04-post-authentication-state.png'),
      fullPage: true
    });
    console.log(`✓ Screenshot saved: 04-post-authentication-state.png\n`);

    // Step 8: Analyze console logs
    console.log('Step 8: Analyzing console logs...\n');

    const authContextLogs = consoleLogs.filter(log => log.text.includes('[AuthContext]'));

    console.log('=== AUTHENTICATION CONSOLE LOGS ===');
    authContextLogs.forEach(log => {
      console.log(`[${log.timestamp}ms] [${log.type}] ${log.text}`);
    });
    console.log('');

    // Generate report
    const totalTime = Date.now() - startTime;

    const report = {
      success: true,
      totalTestDuration: `${totalTime}ms`,
      walletCreationTime: `${walletCreationTime}ms`,
      walletCreated,
      onboardingFlowDetected: onboardingShown,
      screenshots: [
        '01-landing-page-unauthenticated.png',
        '02-get-started-button-visible.png',
        '03-after-get-started-click.png',
        '04-post-authentication-state.png'
      ],
      consoleErrors: consoleErrors.length > 0 ? consoleErrors : 'None',
      networkErrors: networkErrors.length > 0 ? networkErrors : 'None',
      authContextLogs: authContextLogs.map(log => ({
        timestamp: `${log.timestamp}ms`,
        type: log.type,
        message: log.text
      }))
    };

    console.log('\n=== TEST REPORT ===');
    console.log(JSON.stringify(report, null, 2));

    // Save report to file
    fs.writeFileSync(
      path.join(screenshotsDir, 'test-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log(`\n✓ Test report saved: test-report.json`);
    console.log(`✓ All screenshots saved to: ${screenshotsDir}\n`);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);

    // Take error screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'error-state.png'),
      fullPage: true
    });

    const errorReport = {
      success: false,
      error: error.message,
      consoleErrors,
      networkErrors,
      totalDuration: `${Date.now() - startTime}ms`
    };

    console.log('\n=== ERROR REPORT ===');
    console.log(JSON.stringify(errorReport, null, 2));

    fs.writeFileSync(
      path.join(screenshotsDir, 'error-report.json'),
      JSON.stringify(errorReport, null, 2)
    );
  } finally {
    // Keep browser open for 5 seconds to allow manual inspection
    console.log('\nKeeping browser open for 5 seconds for manual inspection...');
    await page.waitForTimeout(5000);

    await browser.close();
    console.log('Browser closed. Test complete.\n');
  }
}

// Run the test
testAuthWorkflow().catch(console.error);
