# Wallet Persistence Test - Execution Guide and Results

## Test Overview

**Purpose**: Verify that wallet authentication state persists correctly after page reload

**Location**: `/Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer`

**Dev Server**: http://localhost:3002

## Quick Start

### Option 1: Automated Playwright Test (Recommended)

```bash
cd /Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer

# Make sure dev server is running
pnpm dev  # In separate terminal

# Install Playwright browsers (first time only)
npx playwright install chromium

# Run the test with visible browser
pnpm test:wallet:headed

# Or run headless
pnpm test:wallet
```

### Option 2: Manual Testing

Follow the step-by-step guide in `WALLET_PERSISTENCE_TEST.md`

## Test Files Created

| File | Purpose |
|------|---------|
| `e2e/wallet-persistence.spec.ts` | Playwright test specification |
| `playwright.config.ts` | Playwright configuration |
| `WALLET_PERSISTENCE_TEST.md` | Manual testing guide |
| `e2e/README.md` | E2E testing documentation |
| `run-wallet-test.sh` | Shell script to run tests |
| `test-wallet-persistence.js` | Node.js test runner |

## What the Test Verifies

### Before Reload
1. ✓ Initial state shows "Get Started" button (unauthenticated)
2. ✓ localStorage is empty
3. ✓ Clicking "Get Started" creates a wallet
4. ✓ Wallet data is stored in localStorage with key `ownyou_wallet`
5. ✓ Wallet has valid structure: `{ address: string, publicKey: string }`
6. ✓ Address follows Ethereum format: `0x` + 40 hex characters

### After Reload
7. ✓ Page reloads successfully
8. ✓ User remains authenticated (no "Get Started" button)
9. ✓ Wallet data still exists in localStorage
10. ✓ Wallet address matches exactly before and after reload
11. ✓ No console errors related to authentication or persistence

## Expected Test Output

### Successful Test Run

```
================================================
OwnYou Consumer - Wallet Persistence Test
================================================

Step 1: Navigate to http://localhost:3002
Step 2: Clear localStorage to start fresh
Step 3: Check initial state (should be unauthenticated)
✓ Get Started button is visible

Step 4: Take screenshot before authentication
✓ Screenshot saved: test-results/wallet-before-auth.png

Step 5: Click "Get Started" to create a wallet
Step 6: Get wallet address from localStorage
✓ Wallet created successfully
  Address: 0x1a2b3c4d5e6f7890abcdef1234567890abcdef12
  Public Key: mock-public-key-1734192000000

Step 7: Take screenshot after authentication
✓ Screenshot saved: test-results/wallet-after-auth.png

Step 8: Reload the page
--- RELOAD ---

Step 9: Check if still authenticated after reload
✓ Still authenticated (Get Started button is hidden)

Step 10: Verify wallet data persisted in localStorage
✓ Wallet data persisted after reload
  Address: 0x1a2b3c4d5e6f7890abcdef1234567890abcdef12
  Public Key: mock-public-key-1734192000000

Step 11: Verify the same wallet address is preserved
✓ PASS: Wallet address matches before and after reload
  Address: 0x1a2b3c4d5e6f7890abcdef1234567890abcdef12

Step 12: Take screenshot after reload
✓ Screenshot saved: test-results/wallet-after-reload.png

Step 13: Check console logs for errors
✓ No console errors found

================================================
TEST SUMMARY
================================================
Wallet persisted: YES
Address before reload: 0x1a2b3c4d5e6f7890abcdef1234567890abcdef12
Address after reload:  0x1a2b3c4d5e6f7890abcdef1234567890abcdef12
Addresses match: YES
Errors found: 0

✓ ALL TESTS PASSED
```

### Failed Test Indicators

If the test fails, you'll see errors like:

```
✗ Wallet not created - localStorage is empty
✗ Not authenticated after reload (Get Started button is visible)
✗ Wallet data lost after reload
✗ FAIL: Wallet address changed after reload
```

## Screenshots Generated

After running the test, check the `test-results/` directory for:

1. **wallet-before-auth.png** - Initial unauthenticated state
   - Should show: "Get Started" button visible
   - Should show: Login/onboarding UI

2. **wallet-after-auth.png** - After clicking "Get Started"
   - Should show: Main application UI
   - Should show: No "Get Started" button
   - May show: Wallet address in header/profile

3. **wallet-after-reload.png** - After page reload
   - Should show: Same UI as after-auth
   - Should show: User still authenticated
   - Should NOT show: "Get Started" button

## Verification Checklist

Use this checklist when running the test manually:

- [ ] Dev server is running on http://localhost:3002
- [ ] Initial page load shows "Get Started" button
- [ ] localStorage is empty before authentication
- [ ] Clicking "Get Started" creates a wallet
- [ ] Wallet address starts with "0x" and is 42 characters long
- [ ] Wallet publicKey is present
- [ ] After reload, "Get Started" button is NOT visible
- [ ] localStorage still contains wallet data after reload
- [ ] Wallet address is identical before and after reload
- [ ] No JavaScript errors in console
- [ ] No authentication errors in console

## Code References

### AuthContext Implementation

**File**: `src/contexts/AuthContext.tsx`

**Key sections**:

1. **Check for existing wallet on mount** (lines 38-74):
   ```typescript
   useEffect(() => {
     const checkAuth = async () => {
       const savedWallet = localStorage.getItem('ownyou_wallet');
       if (savedWallet) {
         const wallet = JSON.parse(savedWallet);
         setState({ isAuthenticated: true, wallet, ... });
       }
     };
     checkAuth();
   }, []);
   ```

2. **Save wallet to localStorage** (lines 100-102):
   ```typescript
   localStorage.setItem('ownyou_wallet', JSON.stringify(mockWallet));
   ```

3. **Wallet interface** (lines 4-7):
   ```typescript
   interface Wallet {
     address: string;
     publicKey: string;
   }
   ```

### localStorage Key

- **Key**: `'ownyou_wallet'`
- **Value**: JSON stringified wallet object
- **Example**:
  ```json
  {
    "address": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    "publicKey": "mock-public-key-1734192000000"
  }
  ```

## Troubleshooting

### Test Fails: Wallet Not Created

**Symptom**: `✗ Wallet not created - localStorage is empty`

**Possible causes**:
1. "Get Started" button selector changed
2. Click event not triggering
3. AuthContext not connected

**Debug**:
```typescript
// Check if button exists
const button = await page.getByRole('button', { name: /get started/i });
console.log('Button found:', await button.isVisible());

// Check for JavaScript errors
page.on('console', msg => console.log(msg.text()));
```

### Test Fails: Wallet Lost After Reload

**Symptom**: `✗ Wallet data lost after reload`

**Possible causes**:
1. localStorage.setItem() not being called
2. Browser in private/incognito mode
3. localStorage cleared on reload

**Debug**:
```javascript
// In browser console after creating wallet
localStorage.getItem('ownyou_wallet')

// After reload
localStorage.getItem('ownyou_wallet')
```

### Test Fails: Address Mismatch

**Symptom**: `✗ FAIL: Wallet address changed after reload`

**This should never happen** - if it does, there's a critical bug in the wallet generation logic.

**Debug**:
1. Check if wallet is being regenerated on each auth check
2. Verify localStorage.setItem() is called only once
3. Check for race conditions in AuthContext

### Dev Server Not Running

**Symptom**: `Error: Connection refused` or `net::ERR_CONNECTION_REFUSED`

**Solution**:
```bash
cd /Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer
pnpm dev
```

Wait for:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3002/
```

## Next Steps After Testing

### If Test Passes

1. Document the results
2. Run the test multiple times to ensure consistency
3. Test with different browsers (Firefox, Safari)
4. Test with network throttling
5. Test with slow devices

### If Test Fails

1. Capture the error message
2. Save the screenshots
3. Check console logs for errors
4. Review AuthContext implementation
5. Create a bug report with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots
   - Console errors
   - Browser version

## Additional Tests to Consider

1. **Multiple reloads** - Does wallet persist after 5+ reloads?
2. **Browser close/reopen** - Does wallet persist after closing browser?
3. **Different tabs** - Is wallet shared across tabs?
4. **Disconnect and reconnect** - Can user create a new wallet?
5. **Corrupted data** - What happens if localStorage has invalid JSON?
6. **Missing fields** - What if wallet object is missing `address` or `publicKey`?

## Performance Metrics

Track these metrics during testing:

- **Wallet creation time**: < 100ms
- **Auth check time (on mount)**: < 50ms
- **localStorage read time**: < 10ms
- **Page reload time**: < 2000ms
- **Total test duration**: < 30s

## Test Results Template

```markdown
## Test Execution Results

**Date**: [YYYY-MM-DD]
**Tester**: [Your name]
**Browser**: Chrome/Firefox/Safari [version]
**Test Mode**: Automated / Manual

### Results

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Initial state | Show "Get Started" | [Actual behavior] | ✓ / ✗ |
| Wallet creation | Create wallet | [Actual behavior] | ✓ / ✗ |
| localStorage save | Save wallet data | [Actual behavior] | ✓ / ✗ |
| Page reload | Remain authenticated | [Actual behavior] | ✓ / ✗ |
| Address match | Same address | [Actual behavior] | ✓ / ✗ |

### Wallet Addresses

- **Before reload**: `[paste address]`
- **After reload**: `[paste address]`
- **Match**: ✓ / ✗

### Screenshots

- [x] wallet-before-auth.png
- [x] wallet-after-auth.png
- [x] wallet-after-reload.png

### Console Logs

```
[Paste relevant console logs]
```

### Errors

```
[Paste any errors]
```

### Overall Result

**PASS** / **FAIL**

### Notes

[Any additional observations]
```

---

**Test created by**: Claude (AI Assistant)
**Date**: 2025-12-14
**Version**: 1.0
