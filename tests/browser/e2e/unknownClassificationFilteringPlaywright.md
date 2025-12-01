# Playwright MCP E2E Test: Unknown Classification Filtering

**Test Date:** 2025-01-12
**Requirements:** UNKNOWN_CLASSIFICATION_FILTERING_SPEC.md
**Test Type:** End-to-End Browser Automation

---

## Test Objective

Verify that the Unknown classification filtering works correctly in the browser:
1. User classifies text with NO gender indicators
2. System returns Unknown Gender classification
3. Memory reconciliation boosts confidence to ~90%
4. Profile page shows gender=null (filtered)
5. Demographics count shows 0

---

## Prerequisites

1. Dev server running: `cd src/admin-dashboard && npm run dev`
2. Server accessible at `http://localhost:3000`
3. Fresh user profile: `test_user_e2e_unknown_filtering`

---

## Test Steps (Manual Playwright MCP Execution)

### Step 1: Navigate to Analyze Page

```typescript
await mcp__playwright__browser_navigate({ url: 'http://localhost:3000/analyze' })
await mcp__playwright__browser_snapshot()
```

**Expected:** Analyze page loads with text input and classification controls

---

### Step 2: Classify Text with NO Gender Indicators (Iteration 1)

```typescript
const textNoGender = 'Your order has been shipped. Track it online at our website.'

await mcp__playwright__browser_type({
  element: 'Text input field',
  ref: 'textarea[name="text"]',
  text: textNoGender
})

await mcp__playwright__browser_click({
  element: 'Classify Text button',
  ref: 'button:has-text("Classify Text")'
})

await mcp__playwright__browser_wait_for({ time: 30 })
```

**Expected:**
- Classification completes in ~25 seconds
- Console shows "Unknown Gender" with confidence ~25%
- Memory reconciliation stores classification

---

### Step 3: Classify Same Text Again (Iterations 2-10)

```typescript
// Repeat 9 more times to boost confidence via memory reconciliation
for (let i = 0; i < 9; i++) {
  await mcp__playwright__browser_click({
    element: 'Classify Text button',
    ref: 'button:has-text("Classify Text")'
  })

  await mcp__playwright__browser_wait_for({ time: 30 })
}
```

**Expected:**
- Confidence boosted from ~25% → ~90% over 10 iterations
- Each iteration adds evidence count
- Memory reconciliation formula: `new_confidence = old_confidence + (1 - old_confidence) × recall_strength`

---

### Step 4: Navigate to Profile Page

```typescript
await mcp__playwright__browser_navigate({
  url: 'http://localhost:3000/profile?user_id=test_user_e2e_unknown_filtering'
})

await mcp__playwright__browser_snapshot()
```

**Expected:** Profile page loads

---

### Step 5: Verify Demographics Count is 0

```typescript
const snapshot = await mcp__playwright__browser_snapshot()

// Should see "Demographics: 0" in summary cards
// This confirms gender tier group was filtered
```

**Expected Output:**
```
Demographics: 0
Household: 0
Interests: 0
Purchase Intent: 0

[Empty State Message]
No tiered classifications found. Download and classify emails to build your profile.
```

---

### Step 6: Take Screenshot Evidence

```typescript
await mcp__playwright__browser_take_screenshot({
  filename: 'profile_gender_filtered_unknown.png'
})
```

**Expected:** Screenshot saved showing empty profile (Demographics: 0)

---

### Step 7: Verify Console Logs Show Filtering

```typescript
const consoleLogs = await mcp__playwright__browser_console_messages({ onlyErrors: false })
```

**Expected Logs:**
```
Filtered tier group 'Gender' - highest confidence classification is 'Unknown Gender' (confidence: 91.0%)
```

---

### Step 8: Cleanup - Reset Profile

```typescript
await mcp__playwright__browser_navigate({
  url: 'http://localhost:3000/profile?user_id=test_user_e2e_unknown_filtering'
})

await mcp__playwright__browser_click({
  element: 'Reset Profile button',
  ref: 'button:has-text("Reset Profile")'
})

// Confirm deletion
await mcp__playwright__browser_handle_dialog({ accept: true })

await mcp__playwright__browser_wait_for({ time: 3 })
```

**Expected:** Profile reset successfully

---

## Success Criteria

✅ **All criteria must pass:**

1. Text with NO gender indicators classified successfully (10 iterations)
2. Memory reconciliation boosted confidence from ~25% to ~90%
3. Profile page shows Demographics: 0 (gender tier group filtered)
4. Empty state message displayed
5. Console logs show filtering warning
6. Screenshot captured: `profile_gender_filtered_unknown.png`
7. Profile reset successfully (cleanup)

---

## Alternative Test: Valid Gender Classification (Should NOT Filter)

### Test Data
```typescript
const textWithGender = 'Hello Mr. Smith, your order has been shipped. He should check his email.'
```

### Expected Outcome
- Male classification with ~85% confidence
- Profile shows Demographics: 1
- Gender tier group NOT filtered (primary: Male)
- No filtering warning in console

---

## Actual Test Results

**Test Date:** [TO BE FILLED AFTER EXECUTION]
**Test Duration:** [TO BE FILLED]
**Status:** [PASS / FAIL]

### Iteration Results

| Iteration | Confidence | Evidence Count | Status |
|-----------|-----------|----------------|--------|
| 1         | %         |                | ✅      |
| 2         | %         |                | ✅      |
| 3         | %         |                | ✅      |
| 4         | %         |                | ✅      |
| 5         | %         |                | ✅      |
| 6         | %         |                | ✅      |
| 7         | %         |                | ✅      |
| 8         | %         |                | ✅      |
| 9         | %         |                | ✅      |
| 10        | %         |                | ✅      |

### Profile Page Verification

- [ ] Demographics: 0 ✅
- [ ] Household: 0 ✅
- [ ] Interests: 0 ✅
- [ ] Purchase Intent: 0 ✅
- [ ] Empty state message displayed ✅
- [ ] Screenshot captured ✅

### Console Logs

```
[TO BE FILLED WITH ACTUAL CONSOLE OUTPUT]
```

### Screenshots

1. `profile_gender_filtered_unknown.png` - [CAPTURED ✅ / NOT CAPTURED ❌]

---

## Debugging Steps (If Test Fails)

### Issue 1: Unknown Gender NOT Filtered

**Symptoms:** Demographics: 1 instead of 0

**Debug:**
1. Check console for filtering warning
2. Verify tierSelector.ts has filtering logic (line 248-259)
3. Verify confidence is >0.5 (minimum threshold)
4. Check tier_2 value starts with "Unknown "

**Fix:** Ensure filtering logic is present and active

---

### Issue 2: Confidence Not Boosting

**Symptoms:** Confidence stays at ~25% after 10 iterations

**Debug:**
1. Check memory reconciliation in IAB classifier
2. Verify Store.put() calls for each iteration
3. Check IndexedDB for stored classifications

**Fix:** Verify memory reconciliation formula in reconcile.ts

---

### Issue 3: Profile Page Shows Error

**Symptoms:** Error message instead of empty state

**Debug:**
1. Check console logs for errors
2. Verify profile-reader.ts handles null tier groups
3. Check IndexedDB namespace: `[user_id, 'iab_taxonomy_profile']`

**Fix:** Verify profile reader gracefully handles filtered tier groups

---

## Notes

- This test requires a real LLM (OpenAI GPT-4o-mini) to classify text
- Each classification takes ~25 seconds (4 agents + evidence judge)
- Total test time: ~4-5 minutes (10 iterations × 25s)
- Memory reconciliation formula uses recall_strength 0.17-0.25
- Confidence approaches 1.0 asymptotically (never reaches exactly 1.0)

---

**Last Updated:** 2025-01-12
**Status:** 🔴 NOT RUN - Awaiting execution
**Next Steps:** Execute test steps manually using Playwright MCP tools

**CRITICAL:** This test is NOT complete until executed with ZERO bugs.
