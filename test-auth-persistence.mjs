import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create screenshots directory
const screenshotsDir = join(__dirname, 'test-screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function testAuthPersistence() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const results = {
    routes: [],
    consoleErrors: [],
    success: true
  };

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  try {
    console.log('Step 1: Navigate to http://localhost:3002');
    await page.goto('http://localhost:3002');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: join(screenshotsDir, '01-initial-load.png'),
      fullPage: true
    });

    // Check if already authenticated or need to create wallet
    const getStartedButton = page.locator('button:has-text("Get Started")');
    const isGetStartedVisible = await getStartedButton.isVisible().catch(() => false);

    if (isGetStartedVisible) {
      console.log('Step 2: Creating wallet (clicking Get Started)');
      await getStartedButton.click();
      await page.waitForTimeout(2000); // Wait for wallet creation
      await page.screenshot({
        path: join(screenshotsDir, '02-after-wallet-creation.png'),
        fullPage: true
      });
    } else {
      console.log('Step 2: Already authenticated, skipping wallet creation');
      await page.screenshot({
        path: join(screenshotsDir, '02-already-authenticated.png'),
        fullPage: true
      });
    }

    // Helper function to check auth state
    async function checkAuthState(route) {
      const authState = await page.evaluate(() => {
        // Check for wallet address in DOM or local storage
        const walletInStorage = localStorage.getItem('ownyou_wallet_address');
        const authContext = window.__OWNYOU_AUTH_STATE__; // If exposed for debugging

        return {
          hasWalletInStorage: !!walletInStorage,
          walletAddress: walletInStorage,
          timestamp: new Date().toISOString()
        };
      });
      return authState;
    }

    // Test routes
    const routes = [
      { path: '/', name: 'Home', step: 3 },
      { path: '/profile', name: 'Profile', step: 3 },
      { path: '/wallet', name: 'Wallet', step: 4 },
      { path: '/settings', name: 'Settings', step: 5 },
      { path: '/', name: 'Home (return)', step: 6 }
    ];

    for (const route of routes) {
      console.log(`Step ${route.step}: Navigate to ${route.path} (${route.name})`);

      await page.goto(`http://localhost:3002${route.path}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const authState = await checkAuthState(route.path);

      // Check if redirected to login or showing unauthenticated state
      const currentUrl = page.url();
      const isAuthenticated = authState.hasWalletInStorage;

      // Check for visual indicators
      const hasGetStarted = await page.locator('button:has-text("Get Started")').isVisible().catch(() => false);
      const hasNavigation = await page.locator('nav').isVisible().catch(() => false);

      const routeResult = {
        route: route.path,
        name: route.name,
        currentUrl,
        authState,
        isAuthenticated,
        hasGetStarted,
        hasNavigation,
        timestamp: new Date().toISOString()
      };

      results.routes.push(routeResult);

      if (!isAuthenticated) {
        results.success = false;
        console.log(`  ❌ Auth LOST at ${route.name}`);
      } else {
        console.log(`  ✅ Auth preserved at ${route.name}`);
      }

      // Take screenshot
      const screenshotName = `0${route.step}-${route.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
      await page.screenshot({
        path: join(screenshotsDir, screenshotName),
        fullPage: true
      });
    }

    // Final summary screenshot
    await page.screenshot({
      path: join(screenshotsDir, '07-final-state.png'),
      fullPage: true
    });

  } catch (error) {
    console.error('Test failed with error:', error);
    results.success = false;
    results.error = error.message;

    // Screenshot on error
    await page.screenshot({
      path: join(screenshotsDir, 'error-state.png'),
      fullPage: true
    }).catch(() => {});
  } finally {
    await browser.close();
  }

  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('AUTH PERSISTENCE TEST REPORT');
  console.log('='.repeat(80));

  console.log('\n📊 SUMMARY:');
  console.log(`Overall: ${results.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Routes tested: ${results.routes.length}`);
  console.log(`Console errors: ${results.consoleErrors.length}`);

  console.log('\n📍 ROUTE DETAILS:');
  results.routes.forEach((route, idx) => {
    console.log(`\n${idx + 1}. ${route.name} (${route.route})`);
    console.log(`   Auth State: ${route.isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}`);
    console.log(`   Wallet: ${route.authState.walletAddress || 'None'}`);
    console.log(`   Has Navigation: ${route.hasNavigation ? 'Yes' : 'No'}`);
    console.log(`   Has Get Started: ${route.hasGetStarted ? 'Yes' : 'No'}`);
    console.log(`   Current URL: ${route.currentUrl}`);
  });

  if (results.consoleErrors.length > 0) {
    console.log('\n⚠️  CONSOLE ERRORS:');
    results.consoleErrors.forEach((error, idx) => {
      console.log(`\n${idx + 1}. ${error.text}`);
      console.log(`   Location: ${JSON.stringify(error.location)}`);
    });
  } else {
    console.log('\n✅ No console errors detected');
  }

  console.log('\n📸 SCREENSHOTS:');
  console.log(`Location: ${screenshotsDir}`);
  const screenshots = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
  screenshots.forEach(screenshot => {
    console.log(`  - ${screenshot}`);
  });

  console.log('\n' + '='.repeat(80));

  // Save detailed JSON report
  const reportPath = join(__dirname, 'auth-persistence-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  return results;
}

// Run the test
testAuthPersistence()
  .then(results => {
    process.exit(results.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
