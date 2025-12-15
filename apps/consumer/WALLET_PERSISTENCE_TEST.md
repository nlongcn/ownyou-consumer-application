# Wallet Persistence Test Guide

## Overview
This test verifies that wallet authentication state persists correctly after page reload in the OwnYou Consumer application.

## Prerequisites
- Dev server running at http://localhost:3002
- Playwright installed (`pnpm add -D @playwright/test`)
- Chromium browser installed (`npx playwright install chromium`)

## Test Execution

### Option 1: Automated Playwright Test

Run the automated test:

```bash
cd /Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer
npx playwright install chromium  # First time only
npx playwright test e2e/wallet-persistence.spec.ts --headed
```

This will:
1. Navigate to http://localhost:3002
2. Create a wallet by clicking "Get Started"
3. Capture the wallet address
4. Reload the page
5. Verify the same wallet is still authenticated
6. Generate screenshots in `test-results/`

### Option 2: Manual Testing

Follow these steps manually:

#### Step 1: Initial State
1. Navigate to http://localhost:3002
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Expected: You should see a "Get Started" button
5. **Screenshot**: Take screenshot named `step1-initial-state.png`

#### Step 2: Check localStorage (Before Auth)
In Console, run:
```javascript
localStorage.getItem('ownyou_wallet')
// Expected: null
```

#### Step 3: Create Wallet
1. Click the "Get Started" button
2. Wait for authentication to complete (1-2 seconds)
3. Expected: Button should disappear and you should see the main UI
4. **Screenshot**: Take screenshot named `step3-authenticated.png`

#### Step 4: Capture Wallet Address (Before Reload)
In Console, run:
```javascript
const walletBefore = JSON.parse(localStorage.getItem('ownyou_wallet'));
console.log('Wallet before reload:', walletBefore);
console.log('Address before reload:', walletBefore.address);
// Copy the address - you'll compare it after reload
```

Expected output:
```javascript
{
  address: "0x..." // 42 characters, starts with 0x
  publicKey: "mock-public-key-..."
}
```

**IMPORTANT**: Copy the `address` value - you'll need to compare it after reload.

#### Step 5: Reload the Page
1. Press Cmd+R (Mac) or Ctrl+R (Windows/Linux) to reload
2. Wait for page to fully load
3. Expected: You should still be authenticated (NO "Get Started" button)
4. **Screenshot**: Take screenshot named `step5-after-reload.png`

#### Step 6: Verify Wallet Persistence
In Console, run:
```javascript
const walletAfter = JSON.parse(localStorage.getItem('ownyou_wallet'));
console.log('Wallet after reload:', walletAfter);
console.log('Address after reload:', walletAfter.address);
```

#### Step 7: Compare Addresses
Compare the address from Step 4 with the address from Step 6.

**SUCCESS CRITERIA**:
- ✓ Wallet data exists after reload
- ✓ Address matches exactly before and after reload
- ✓ No "Get Started" button visible after reload
- ✓ No console errors related to authentication or persistence

**FAILURE INDICATORS**:
- ✗ "Get Started" button appears after reload
- ✗ localStorage.getItem('ownyou_wallet') returns null after reload
- ✗ Address is different before and after reload
- ✗ Console errors about IndexedDB, localStorage, or authentication

#### Step 8: Check Console Logs
Look for these types of messages in the Console:
- Auth check messages
- IndexedDB initialization
- Store initialization
- Any errors or warnings

## Test Report Template

After completing the test, fill out this report:

### Test Execution Report

**Date**: [Current date]
**Tester**: [Your name]
**Environment**: Dev server at http://localhost:3002

#### Results

| Test Step | Status | Notes |
|-----------|--------|-------|
| Initial state shows "Get Started" | ✓ / ✗ | |
| localStorage empty before auth | ✓ / ✗ | |
| Wallet created successfully | ✓ / ✗ | |
| Wallet data in localStorage | ✓ / ✗ | |
| Address format correct (0x...) | ✓ / ✗ | |
| Still authenticated after reload | ✓ / ✗ | |
| Wallet data persisted | ✓ / ✗ | |
| Address matches before/after | ✓ / ✗ | |

#### Wallet Addresses

- **Before reload**: `[paste address here]`
- **After reload**: `[paste address here]`
- **Match**: ✓ / ✗

#### Console Logs

Paste any relevant console messages here:

```
[Paste console logs]
```

#### Errors

List any errors encountered:

```
[Paste errors if any]
```

#### Screenshots

Attach the following screenshots:
- `step1-initial-state.png` - Before authentication
- `step3-authenticated.png` - After clicking "Get Started"
- `step5-after-reload.png` - After page reload

#### Overall Result

**PASS** / **FAIL**

#### Additional Notes

[Any additional observations or issues]

---

## Troubleshooting

### Issue: Wallet doesn't persist after reload

**Possible causes**:
1. localStorage is disabled in browser
2. Private/Incognito mode (doesn't persist localStorage)
3. Bug in AuthContext localStorage persistence
4. Browser clearing storage between reloads

**Debug steps**:
1. Check if localStorage is available:
   ```javascript
   typeof localStorage !== 'undefined'
   ```
2. Check browser console for storage quota errors
3. Try in a non-incognate window
4. Check AuthContext.tsx line 49-59 for localStorage logic

### Issue: "Get Started" button doesn't work

**Debug steps**:
1. Check console for JavaScript errors
2. Verify AuthContext is properly wrapped around the app
3. Check network tab for any failed requests
4. Verify React is rendering correctly

### Issue: Address format is wrong

**Expected format**: `0x` followed by 40 hexadecimal characters (0-9, a-f)
**Example**: `0x1234567890abcdef1234567890abcdef12345678`

If format is different, check `AuthContext.tsx` line 87-89 for wallet generation logic.

---

## Additional Verification Tests

### Test: Multiple Reloads
1. Reload the page 3-5 times
2. Verify wallet persists across all reloads
3. Verify address stays the same

### Test: Browser Tab Close/Reopen
1. Note the wallet address
2. Close the browser tab completely
3. Open a new tab and navigate to http://localhost:3002
4. Verify the same wallet is still authenticated

### Test: Disconnect and Reconnect
1. Add a "Disconnect" button to the UI (if available)
2. Click Disconnect
3. Verify localStorage is cleared
4. Click "Get Started" again
5. Verify a new wallet is created
6. Verify the new wallet persists after reload

---

## Code References

- **AuthContext**: `/Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer/src/contexts/AuthContext.tsx`
- **Wallet persistence logic**: Lines 49-59 (check auth) and 100-102 (save wallet)
- **localStorage key**: `'ownyou_wallet'`

## Test Automation

The automated Playwright test performs all these steps programmatically. To view the test code:

```bash
cat /Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer/e2e/wallet-persistence.spec.ts
```

## Next Steps

After testing, update the main documentation with findings and create issues for any bugs discovered.
