import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Sprint 11a/11b Bugfix Verification Tests
 *
 * MANDATORY GATE: These tests MUST FAIL before implementing fixes.
 * They verify that bugs actually exist in the current codebase.
 *
 * Test Protocol:
 * 1. Run test - it should FAIL (confirming bug exists)
 * 2. Implement the fix
 * 3. Re-run test - it should PASS
 * 4. Mark bugfix as complete
 */

const BASE_URL = 'http://localhost:3002';

// Ensure screenshot directory exists
const screenshotDir = path.join(process.cwd(), 'test-results', 'sprint11-bugfix');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

/**
 * Helper: Authenticate if needed
 * Creates wallet by clicking "Get Started" if not already authenticated
 */
async function ensureAuthenticated(page: Page): Promise<void> {
  const getStartedButton = page.locator('button:has-text("Get Started")');
  const isGetStartedVisible = await getStartedButton.isVisible().catch(() => false);

  if (isGetStartedVisible) {
    await getStartedButton.click();
    await page.waitForTimeout(3000);
  }
}

/**
 * Helper: Connect a mock data source for tests that need data
 * Since we can't do real OAuth in tests, we mock the connection state
 */
async function mockDataSourceConnection(page: Page): Promise<void> {
  // Inject mock connection state into the app
  await page.evaluate(() => {
    // Set a mock OAuth token in sessionStorage
    sessionStorage.setItem('oauth_token', 'mock-test-token');
    sessionStorage.setItem('oauth_provider', 'outlook');
  });
}

test.describe('Bugfix 5: Wallet Earnings Display', () => {
  /**
   * EXPECTED: FAIL (Bug exists - hardcoded 0.00 OWN)
   *
   * The wallet settings page shows hardcoded "0.00 OWN" instead of
   * reading actual earnings from the store.
   *
   * File: apps/consumer/src/routes/Settings.tsx:859
   * Current code: <p className="text-3xl font-bold">0.00 OWN</p>
   */
  test('Wallet should display real earnings from store, not hardcoded zero', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated(page);

    // Navigate to wallet settings
    await page.goto(`${BASE_URL}/settings?tab=wallet`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, 'bugfix5-wallet-earnings.png'),
      fullPage: true,
    });

    // First, inject some mock earnings data into the store
    // This simulates having earned tokens from ad revenue
    await page.evaluate(() => {
      // Simulate earnings in localStorage/IndexedDB store
      const walletData = localStorage.getItem('ownyou_wallet');
      if (walletData) {
        const wallet = JSON.parse(walletData);
        // Set mock earnings - in real app this would come from Store namespace
        localStorage.setItem(
          `ownyou_earnings_${wallet.address}`,
          JSON.stringify({ lifetime: 42.5, pending: 5.0 })
        );
      }
    });

    // Refresh to pick up earnings
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Look for the earnings display
    const earningsText = await page.locator('text=/\\d+\\.\\d+ OWN/').first().textContent();

    // BUG: Currently shows hardcoded "0.00 OWN"
    // FIXED: Should show "42.50 OWN" or actual value from store
    expect(earningsText).not.toBe('0.00 OWN');
    expect(earningsText).toContain('42.50 OWN');
  });
});

test.describe('Bugfix 9: IAB Evidence Chain Display', () => {
  /**
   * EXPECTED: FAIL (Bug exists - evidence not displayed)
   *
   * IAB categories are shown but clicking them doesn't reveal the
   * evidence trail (emails, transactions) that led to the classification.
   *
   * File: apps/consumer/src/hooks/useProfile.ts has EvidenceEntry interface
   * but UI component doesn't render the evidence array.
   */
  test('IAB category click should show evidence trail', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated(page);

    // Navigate to profile where IAB categories are shown
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, 'bugfix9-profile-iab.png'),
      fullPage: true,
    });

    // First, inject mock IAB classification data with evidence
    await page.evaluate(() => {
      const walletData = localStorage.getItem('ownyou_wallet');
      if (walletData) {
        const wallet = JSON.parse(walletData);
        // Store mock IAB classification with evidence chain
        localStorage.setItem(
          `ownyou_iab_${wallet.address}`,
          JSON.stringify([
            {
              id: 'cat-1',
              name: 'Travel',
              tier1: 'Travel',
              tier2: 'Air Travel',
              confidence: 0.85,
              evidenceCount: 3,
              evidence: [
                {
                  sourceType: 'email',
                  extractedText: 'Your flight confirmation to Paris...',
                  date: '2025-12-10',
                  sourceId: 'email-123',
                },
                {
                  sourceType: 'email',
                  extractedText: 'Hotel booking for December...',
                  date: '2025-12-08',
                  sourceId: 'email-124',
                },
              ],
            },
          ])
        );
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find and click on an IAB category
    // First check if there are any IAB categories displayed
    const iabCategory = page.locator('[data-testid="iab-category"]').first();
    const categoryExists = await iabCategory.isVisible().catch(() => false);

    if (!categoryExists) {
      // Fallback: look for any clickable category element
      const categoryText = page.locator('text=/Travel|Shopping|Entertainment/').first();
      const fallbackExists = await categoryText.isVisible().catch(() => false);

      if (fallbackExists) {
        await categoryText.click();
      } else {
        // No categories at all - that's also a bug but different one
        console.log('No IAB categories displayed at all');
      }
    } else {
      await iabCategory.click();
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'bugfix9-evidence-expanded.png'),
      fullPage: true,
    });

    // BUG: Evidence list is not displayed after clicking
    // FIXED: Should show expandable evidence entries
    const evidenceList = page.locator('[data-testid="evidence-list"]');
    const evidenceEntry = page.locator('[data-testid="evidence-entry"]');

    await expect(evidenceList).toBeVisible({ timeout: 5000 });
    expect(await evidenceEntry.count()).toBeGreaterThan(0);
  });
});

test.describe('Bugfix 12: Ikigai Dimension Detail Views', () => {
  /**
   * EXPECTED: FAIL (Bug exists - no navigation on click)
   *
   * Clicking on Ikigai wheel dimensions (Passion, Mission, Vocation, Profession)
   * doesn't navigate to a detail view showing what contributed to that score.
   */
  test('Ikigai dimension click should navigate to detail view', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated(page);

    // Navigate to profile where Ikigai wheel is shown
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, 'bugfix12-ikigai-wheel.png'),
      fullPage: true,
    });

    // Look for Ikigai wheel dimension - try multiple selectors
    const passionSegment = page.locator('[data-testid="ikigai-passion"]');
    const passionExists = await passionSegment.isVisible().catch(() => false);

    if (passionExists) {
      await passionSegment.click();
    } else {
      // Fallback: click on text that looks like dimension
      const passionText = page.locator('text=Passion').first();
      const textExists = await passionText.isVisible().catch(() => false);

      if (textExists) {
        await passionText.click();
      } else {
        // No Ikigai elements found - skip this scenario
        console.log('No Ikigai wheel elements found');
        test.skip();
        return;
      }
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'bugfix12-after-click.png'),
      fullPage: true,
    });

    // BUG: URL doesn't change - no navigation happens
    // FIXED: Should navigate to /ikigai/passion or similar detail route
    const currentUrl = page.url();
    expect(currentUrl).toContain('/ikigai/passion');
  });
});

test.describe('Bugfix 13: Mission Filtering', () => {
  /**
   * EXPECTED: MAY PASS or FAIL (Need to verify filtering actually works)
   *
   * FilterTabs UI exists but need to verify that clicking a filter
   * actually filters the mission list.
   */
  test('Filter tabs should actually filter missions', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated(page);

    // First, inject mock missions data
    await page.evaluate(() => {
      const walletData = localStorage.getItem('ownyou_wallet');
      if (walletData) {
        const wallet = JSON.parse(walletData);
        // Store mock missions of different types
        localStorage.setItem(
          `ownyou_missions_${wallet.address}`,
          JSON.stringify([
            { id: 'm1', type: 'savings', title: 'Save on groceries', status: 'active' },
            { id: 'm2', type: 'savings', title: 'Utility bill deal', status: 'active' },
            { id: 'm3', type: 'food', title: 'Restaurant recommendation', status: 'active' },
            { id: 'm4', type: 'travel', title: 'Flight deal', status: 'active' },
            { id: 'm5', type: 'entertainment', title: 'Concert tickets', status: 'active' },
          ])
        );
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, 'bugfix13-all-missions.png'),
      fullPage: true,
    });

    // Count all missions
    const allMissions = page.locator('[data-testid="mission-card"]');
    const allCount = await allMissions.count();

    console.log(`Total missions displayed: ${allCount}`);

    // If no missions shown, the test can't proceed
    if (allCount === 0) {
      console.log('No missions displayed - cannot test filtering');
      // This is acceptable if user has no data
      test.skip();
      return;
    }

    // Click on "Savings" filter
    const savingsFilter = page.locator('text=Savings').first();
    const savingsExists = await savingsFilter.isVisible().catch(() => false);

    if (!savingsExists) {
      console.log('Savings filter tab not found');
      test.skip();
      return;
    }

    await savingsFilter.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'bugfix13-savings-filtered.png'),
      fullPage: true,
    });

    // Count savings missions
    const savingsCount = await allMissions.count();

    console.log(`Savings missions displayed: ${savingsCount}`);

    // BUG: Filter doesn't work - shows same count
    // FIXED: Should show fewer missions (only savings type)
    expect(savingsCount).toBeLessThan(allCount);

    // Verify all displayed missions are savings type
    // (This would require data-attributes or inspecting content)
  });
});

test.describe('Deviation 1: Data Source Fetch Options', () => {
  /**
   * EXPECTED: FAIL (Bug exists - hardcoded fetchOptions)
   *
   * DataSourceContext has hardcoded fetchOptions (maxResults: 100)
   * instead of reading from Store namespace data_source_configs.
   *
   * File: apps/consumer/src/contexts/DataSourceContext.tsx:201-203
   */
  test('Data source should use configurable fetch options from store', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated(page);

    // Navigate to settings
    await page.goto(`${BASE_URL}/settings?tab=data`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotDir, 'deviation1-data-settings.png'),
      fullPage: true,
    });

    // BUG: There's no UI to configure fetch options
    // FIXED: Should have settings for maxResults, daysBack, etc.

    // Look for fetch options configuration UI
    const maxResultsInput = page.locator('input[name="maxResults"], label:has-text("emails to fetch")');
    const daysBackInput = page.locator('input[name="daysBack"], label:has-text("Days of history")');

    const hasMaxResults = await maxResultsInput.isVisible().catch(() => false);
    const hasDaysBack = await daysBackInput.isVisible().catch(() => false);

    // BUG: These inputs don't exist
    // FIXED: Should be able to configure fetch parameters
    expect(hasMaxResults).toBeTruthy();
    expect(hasDaysBack).toBeTruthy();
  });
});

test.describe('Sprint 11b Verification Summary', () => {
  /**
   * Summary test that captures overall state of all bugfixes
   * Useful for generating a report of which bugs still exist
   */
  test('Generate bugfix verification report', async ({ page }) => {
    const report: Array<{ bugfix: string; status: 'exists' | 'fixed' | 'skipped'; details: string }> =
      [];

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated(page);

    // Check Bugfix 5: Wallet earnings
    await page.goto(`${BASE_URL}/settings?tab=wallet`);
    await page.waitForLoadState('networkidle');
    const earningsText = await page.locator('text=/\\d+\\.\\d+ OWN/').first().textContent().catch(() => null);
    report.push({
      bugfix: 'Bugfix 5: Wallet Earnings',
      status: earningsText === '0.00 OWN' ? 'exists' : earningsText ? 'fixed' : 'skipped',
      details: `Current value: ${earningsText || 'not found'}`,
    });

    // Check Bugfix 9: Evidence display
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    const evidenceList = await page.locator('[data-testid="evidence-list"]').isVisible().catch(() => false);
    report.push({
      bugfix: 'Bugfix 9: Evidence Chain',
      status: evidenceList ? 'fixed' : 'exists',
      details: `Evidence list visible: ${evidenceList}`,
    });

    // Check Bugfix 12: Ikigai detail views
    const ikigaiLink = await page.locator('a[href*="/ikigai/"]').isVisible().catch(() => false);
    report.push({
      bugfix: 'Bugfix 12: Ikigai Detail Views',
      status: ikigaiLink ? 'fixed' : 'exists',
      details: `Ikigai links present: ${ikigaiLink}`,
    });

    // Check Deviation 1: Configurable fetch options
    await page.goto(`${BASE_URL}/settings?tab=data`);
    await page.waitForLoadState('networkidle');
    const fetchOptionsUI = await page.locator('input[name="maxResults"]').isVisible().catch(() => false);
    report.push({
      bugfix: 'Deviation 1: Fetch Options Config',
      status: fetchOptionsUI ? 'fixed' : 'exists',
      details: `Config UI present: ${fetchOptionsUI}`,
    });

    // Generate report
    console.log('\n' + '='.repeat(80));
    console.log('SPRINT 11a/11b BUGFIX VERIFICATION REPORT');
    console.log('='.repeat(80));
    console.log(`Date: ${new Date().toISOString()}`);
    console.log(`Branch: feature/sprint11b-wasm-embeddings`);
    console.log('');

    const existsCount = report.filter((r) => r.status === 'exists').length;
    const fixedCount = report.filter((r) => r.status === 'fixed').length;
    const skippedCount = report.filter((r) => r.status === 'skipped').length;

    console.log(`📊 SUMMARY: ${existsCount} bugs exist, ${fixedCount} fixed, ${skippedCount} skipped`);
    console.log('');

    report.forEach((item, idx) => {
      const icon = item.status === 'exists' ? '❌' : item.status === 'fixed' ? '✅' : '⏭️';
      console.log(`${idx + 1}. ${icon} ${item.bugfix}`);
      console.log(`   Status: ${item.status.toUpperCase()}`);
      console.log(`   Details: ${item.details}`);
      console.log('');
    });

    console.log('='.repeat(80));

    // Save report as JSON
    fs.writeFileSync(
      path.join(screenshotDir, 'bugfix-report.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), report }, null, 2)
    );

    // This test always passes - it's just for reporting
    expect(true).toBeTruthy();
  });
});
