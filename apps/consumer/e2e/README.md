# E2E Tests for OwnYou Consumer App

This directory contains end-to-end tests for the OwnYou Consumer application using Playwright.

## Setup

### Prerequisites

1. Dev server running on port 3002:
   ```bash
   pnpm dev
   ```

2. Install Playwright browsers (first time only):
   ```bash
   npx playwright install chromium
   ```

## Running Tests

### Quick Commands

From the `apps/consumer` directory:

```bash
# Run all e2e tests (headless)
pnpm test:e2e

# Run wallet persistence test only (headless)
pnpm test:wallet

# Run wallet persistence test with browser visible
pnpm test:wallet:headed

# Run tests with Playwright UI (interactive mode)
pnpm test:e2e:ui

# Run specific test file
npx playwright test e2e/wallet-persistence.spec.ts
```

### Test Output

- **Console output**: Real-time test progress
- **Screenshots**: Saved to `test-results/`
- **HTML report**: Run `npx playwright show-report` to view
- **Videos**: Recorded on test failure (in `test-results/`)

## Available Tests

### Wallet Persistence Test

**File**: `e2e/wallet-persistence.spec.ts`

**What it tests**:
1. Initial unauthenticated state
2. Wallet creation via "Get Started" button
3. Wallet data persistence in localStorage
4. Authentication state after page reload
5. Wallet address preservation across reloads

**Success criteria**:
- Wallet data exists in localStorage after creation
- Wallet address matches before and after reload
- User remains authenticated after reload
- No console errors

**Run it**:
```bash
pnpm test:wallet:headed
```

## Test Structure

Each test follows this pattern:

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: navigate, clear state, etc.
  });

  test('should do something', async ({ page }) => {
    // Arrange: set up test conditions
    // Act: perform user actions
    // Assert: verify expected outcomes
  });
});
```

## Writing New Tests

### 1. Create a new test file

```bash
touch e2e/your-feature.spec.ts
```

### 2. Basic template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Your Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3002');
  });

  test('should work correctly', async ({ page }) => {
    // Your test code here
  });
});
```

### 3. Useful Playwright APIs

```typescript
// Navigation
await page.goto('http://localhost:3002');
await page.reload();

// Selectors
page.getByRole('button', { name: /text/i })
page.getByText('exact text')
page.locator('#id')
page.locator('.class')

// Actions
await button.click();
await input.fill('text');
await input.press('Enter');

// Assertions
await expect(element).toBeVisible();
await expect(element).toHaveText('text');
await expect(element).not.toBeVisible();

// Screenshots
await page.screenshot({ path: 'screenshot.png' });

// Execute JavaScript
const result = await page.evaluate(() => {
  return localStorage.getItem('key');
});

// Wait
await page.waitForTimeout(1000);
await page.waitForLoadState('networkidle');
```

## Debugging Tests

### Visual Debugging

Run tests with browser visible:
```bash
pnpm test:wallet:headed
```

### Step-by-step Debugging

Use Playwright UI mode:
```bash
pnpm test:e2e:ui
```

This opens an interactive UI where you can:
- Step through tests
- View DOM snapshots
- Inspect network requests
- See console logs

### VS Code Debugging

Install the Playwright extension for VS Code, then:
1. Set breakpoints in your test file
2. Click "Debug Test" in the test gutter

### Console Logs

Capture console messages in tests:
```typescript
page.on('console', msg => {
  console.log(`Browser console [${msg.type()}]: ${msg.text()}`);
});
```

## Configuration

Edit `playwright.config.ts` to customize:

- **Browser**: Add Firefox, Safari, etc.
- **Timeouts**: Adjust global and assertion timeouts
- **Viewport**: Change default screen size
- **Screenshots**: Configure when to capture
- **Videos**: Configure recording settings
- **Base URL**: Change default test URL

## CI/CD Integration

The tests are configured to work in CI environments:

```yaml
# GitHub Actions example
- name: Install dependencies
  run: pnpm install

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Start dev server
  run: pnpm dev &

- name: Run E2E tests
  run: pnpm test:e2e
```

## Troubleshooting

### Dev server not running

**Error**: `Error: Connection refused`

**Solution**: Make sure dev server is running on port 3002
```bash
pnpm dev
```

### Playwright browsers not installed

**Error**: `Executable doesn't exist at ...`

**Solution**: Install browsers
```bash
npx playwright install chromium
```

### Test timeout

**Error**: `Test timeout of 30000ms exceeded`

**Solution**:
1. Increase timeout in test:
   ```typescript
   test('slow test', async ({ page }) => {
     test.setTimeout(60000);
     // ... test code
   });
   ```
2. Or in config: `timeout: 60000`

### Element not found

**Error**: `locator.click: Target closed`

**Solution**: Wait for element before interacting
```typescript
await element.waitFor({ state: 'visible' });
await element.click();
```

### localStorage not persisting

**Possible causes**:
1. Browser in incognito mode (Playwright uses isolated context)
2. localStorage cleared between tests
3. Different origin/domain

**Debug**:
```typescript
const storage = await page.evaluate(() => localStorage);
console.log('localStorage:', storage);
```

## Best Practices

### 1. Use meaningful selectors

```typescript
// Good - semantic and stable
await page.getByRole('button', { name: 'Get Started' });
await page.getByLabel('Email address');

// Avoid - brittle
await page.locator('button:nth-child(3)');
await page.locator('.btn-primary');
```

### 2. Clean state between tests

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3002');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});
```

### 3. Take screenshots at key points

```typescript
await page.screenshot({
  path: `test-results/${testName}-step-${step}.png`,
  fullPage: true
});
```

### 4. Use explicit waits

```typescript
// Good
await page.waitForLoadState('networkidle');
await element.waitFor({ state: 'visible' });

// Avoid
await page.waitForTimeout(5000);
```

### 5. Group related tests

```typescript
test.describe('Wallet', () => {
  test.describe('Creation', () => {
    test('should create wallet on button click', ...);
    test('should persist wallet data', ...);
  });

  test.describe('Deletion', () => {
    test('should clear wallet on disconnect', ...);
  });
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Debugging Guide](https://playwright.dev/docs/debug)
