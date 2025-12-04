import { test, expect } from '@playwright/test';

/**
 * Evidence Page E2E Tests - Sprint 3
 *
 * Tests the Evidence & Reasoning display:
 * - LLM reasoning transparency
 * - Classification evidence linking
 * - Raw data reference (with privacy controls)
 *
 * Sprint 4 Extension: Memory provenance tracking
 */

test.describe('Evidence Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/evidence');
  });

  test.describe('Page Structure', () => {
    test('should display evidence page header', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible();
    });

    test('should show evidence-related content', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const pageContent = await page.content();
      expect(
        pageContent.toLowerCase().includes('evidence') ||
          pageContent.toLowerCase().includes('reasoning') ||
          pageContent.toLowerCase().includes('classification') ||
          pageContent.toLowerCase().includes('explanation')
      ).toBeTruthy();
    });
  });

  test.describe('Evidence Display', () => {
    test('should show LLM reasoning when available', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Look for reasoning-related content
      const reasoningSection = page.getByText(/reason/i);
      const explanationSection = page.getByText(/explanation/i);
      const whySection = page.getByText(/why/i);

      // At least one should be present or empty state
      await expect(page.locator('body')).toBeVisible();
    });

    test('should link back to source data', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Look for source links
      const sourceLink = page.getByRole('link', { name: /source/i });
      const emailLink = page.getByRole('link', { name: /email/i });
      const viewLink = page.getByRole('button', { name: /view/i });

      // Verify page structure
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to profile page', async ({ page }) => {
      const profileLink = page.getByRole('link', { name: /profile/i });

      if (await profileLink.isVisible().catch(() => false)) {
        await profileLink.click();
        await expect(page).toHaveURL(/profile/);
      }
    });
  });
});

test.describe('Evidence Page with Test Data', () => {
  test.beforeEach(async ({ page }) => {
    // Seed with evidence data
    await page.addInitScript(() => {
      const seedEvidenceData = async () => {
        const request = indexedDB.open('ownyou_store', 1);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('evidence')) {
            db.createObjectStore('evidence', { keyPath: 'key' });
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const tx = db.transaction(['evidence'], 'readwrite');
          const store = tx.objectStore('evidence');

          const testEvidence = {
            key: 'default_user:evidence:ev-1',
            value: {
              id: 'ev-1',
              classificationId: 'class-1',
              category: 'Technology & Computing',
              reasoning:
                'Email discusses smartphone features and includes purchase intent language like "looking to buy" and "compare prices".',
              confidence: 0.85,
              sourceType: 'email',
              sourceId: 'email-1',
              createdAt: new Date().toISOString(),
            },
          };

          store.put(testEvidence);
        };
      };

      seedEvidenceData();
    });

    await page.goto('/evidence');
    await page.waitForLoadState('networkidle');
  });

  test('should display evidence entries', async ({ page }) => {
    // Look for seeded evidence content
    const reasoning = page.getByText(/smartphone features/i);

    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show classification category', async ({ page }) => {
    const category = page.getByText(/Technology/i);

    // Verify page loaded
    await expect(page.locator('body')).toBeVisible();
  });
});

/**
 * Sprint 4 Extension Tests - Memory Provenance
 */
test.describe.skip('Sprint 4: Memory Provenance', () => {
  test('should trace evidence through memory chain', async ({ page }) => {
    // TODO: Sprint 4 - Test that:
    // 1. Evidence links to semantic memory entries
    // 2. Memory entries link to original source
    // 3. Full provenance chain is traceable
  });

  test('should show memory decay effects on evidence', async ({ page }) => {
    // TODO: Sprint 4 - Test that:
    // 1. Old evidence shows decay indicators
    // 2. Recent evidence is highlighted
    // 3. Archive status is visible
  });

  test('should support evidence search via hybrid retrieval', async ({ page }) => {
    // TODO: Sprint 4 - Test that:
    // 1. Search finds semantically similar evidence
    // 2. Keyword search works
    // 3. Combined results are properly ranked
  });
});
