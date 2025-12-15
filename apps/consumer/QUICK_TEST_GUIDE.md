# Quick Test Guide - Wallet Persistence

## Run the Test (5 seconds)

```bash
cd apps/consumer
pnpm test:wallet:headed
```

That's it! The test will:
1. Open a browser window
2. Navigate to http://localhost:3002
3. Click "Get Started"
4. Reload the page
5. Verify wallet persists
6. Generate screenshots and report

## Prerequisites

✓ Dev server running: `pnpm dev` (port 3002)
✓ Playwright installed: `npx playwright install chromium`

## Expected Result

```
✓ should persist wallet after page reload (5s)
✓ should handle authentication flow correctly (3s)

2 passed (8s)
```

## Screenshots

Check `test-results/` for:
- `wallet-before-auth.png`
- `wallet-after-auth.png`
- `wallet-after-reload.png`

## If Test Fails

1. Check dev server is running on port 3002
2. Check console output for error details
3. View screenshots in `test-results/`
4. See `WALLET_TEST_RESULTS.md` for troubleshooting

## Manual Test (30 seconds)

1. Open http://localhost:3002
2. Open DevTools Console (F12)
3. Check: `localStorage.getItem('ownyou_wallet')` → null
4. Click "Get Started"
5. Check: `localStorage.getItem('ownyou_wallet')` → has address
6. Copy the address
7. Reload page (Cmd+R)
8. Check: `localStorage.getItem('ownyou_wallet')` → same address
9. **PASS** if addresses match!

## More Commands

```bash
# All E2E tests
pnpm test:e2e

# Interactive UI mode
pnpm test:e2e:ui

# View HTML report
npx playwright show-report
```

## Full Documentation

- `WALLET_PERSISTENCE_TEST_SUMMARY.md` - Complete overview
- `WALLET_PERSISTENCE_TEST.md` - Manual testing guide
- `WALLET_TEST_RESULTS.md` - Results template
- `e2e/README.md` - E2E testing docs
