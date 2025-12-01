# Unknown Classification Filtering Specification

**Date:** 2025-01-12
**Status:** 🔴 CRITICAL BUG - Not Implemented in Python or TypeScript
**Type:** Tier Selection Algorithm Enhancement
**Priority:** P0 - Blocks production deployment

---

## Executive Summary

**Problem:** The tier selection algorithm incorrectly selects "Unknown [Field]" classifications as primary when they have the highest confidence. "Unknown Gender" with 91% confidence (25 evidence items) was selected over "Male" with 34% confidence (2 evidence items).

**Root Cause:** "Unknown [Field]" indicates "inability to determine classification", NOT a valid classification value. The algorithm should filter these out for mutually-exclusive tier groups.

**Impact:** User profiles contain meaningless "Unknown" classifications instead of useful demographic data. This degrades profile quality and user experience.

**Solution:** Add filtering logic to tier selection algorithm: For mutually-exclusive tier groups, if the highest confidence classification value starts with "Unknown ", discard the ENTIRE tier group (return null, no primary, no alternatives).

---

## 1. Requirements

### 1.1 Core Requirement

**REQ-1.1**: For mutually-exclusive tier groups, the tier selection algorithm MUST filter out tier groups where the highest confidence classification value starts with "Unknown ".

**Rationale:** "Unknown [Field]" classifications indicate the system's inability to make a determination, not a valid classification. Storing these provides no value to the user.

### 1.2 Mutually-Exclusive Tier Groups

**REQ-1.2**: This filtering MUST apply to the following mutually-exclusive tier groups:

| Category | Tier 1 Value | Examples |
|----------|--------------|----------|
| **Gender** | "Gender" | Male, Female, Other Gender, Unknown Gender |
| **Age Range** | "Age Range" | 18-24, 25-34, 35-44, 45-54, 55-64, 65+, Unknown Age |
| **Education Level** | "Education Level" | High School, Associate, Bachelor, Graduate, Professional, Unknown Education |
| **Marital Status** | "Marital Status" | Single, Married, Divorced, Widowed, Unknown Marital Status |
| **Income Range** | "Income Range" | <$25k, $25k-$50k, $50k-$75k, $75k-$100k, $100k-$150k, $150k+, Unknown Income |
| **Property Type** | "Property Type" | Single Family, Multi Family, Condo, Apartment, Unknown Property |
| **Home Ownership** | "Home Ownership" | Owner, Renter, Unknown Ownership |

**Source:** IAB_PROFILE_SCHEMA_v2.md lines 180-230 (Demographics and Household sections)

### 1.3 Non-Exclusive Tier Groups (Not Affected)

**REQ-1.3**: This filtering MUST NOT apply to non-exclusive tier groups:

- **Interests** - User can have multiple interests
- **Purchase Intent** - User can have multiple purchase intents

**Rationale:** Non-exclusive groups allow multiple classifications, so "Unknown" is not a concern.

### 1.4 Filtering Behavior

**REQ-1.4**: When the highest confidence classification in a mutually-exclusive tier group has a value starting with "Unknown ":

1. **Discard the entire tier group** - Return `null` for that field
2. **No primary classification** - Do not select any classification as primary
3. **No alternatives** - Do not include any classifications as alternatives
4. **Log the decision** - Log that the tier group was filtered due to "Unknown" primary

**Example (Gender):**

```typescript
// Input classifications (after memory reconciliation)
[
  { tier_1: "Gender", tier_2: "Unknown Gender", confidence: 0.91, evidence_count: 25 },
  { tier_1: "Gender", tier_2: "Male", confidence: 0.34, evidence_count: 2 }
]

// Output (CORRECT - filtered)
gender: null  // Entire tier group discarded

// Output (WRONG - current behavior)
gender: {
  primary: { value: "Unknown Gender", confidence: 0.91 },  // ❌ WRONG
  alternatives: [{ value: "Male", confidence: 0.34 }]
}
```

### 1.5 Filtering Logic Location

**REQ-1.5**: The filtering logic MUST be implemented in the `select_primary_and_alternatives()` function, AFTER sorting by granularity score but BEFORE selecting the primary classification.

**Pseudocode:**
```
1. Filter classifications by minimum confidence (0.5)
2. Calculate granularity scores for each classification
3. Sort by granularity score (descending)
4. **CHECK: If highest confidence classification starts with "Unknown ", return null**  ← NEW
5. Select highest score as primary
6. Select alternatives within confidence delta (0.3)
7. Return { primary, alternatives }
```

---

## 2. Implementation Specification

### 2.1 Python Implementation

**File:** `src/email_parser/utils/classification_tier_selector.py`

**Function:** `select_primary_and_alternatives()` (lines 115-221)

**Changes Required:**

Add the following code at **line 185** (after sorting, before primary selection):

```python
# REQ-1.4: Filter out "Unknown" classifications in mutually-exclusive tiers
if scored and scored[0]["classification"]["tier_2"].startswith("Unknown "):
    logger.warning(
        f"Filtered tier group '{scored[0]['classification']['tier_1']}' - "
        f"highest confidence classification is '{scored[0]['classification']['tier_2']}' "
        f"(confidence: {scored[0]['classification']['confidence']:.2%})"
    )
    return {
        "primary": None,
        "alternatives": []
    }
```

**Full Context (lines 180-195 after change):**

```python
    # Sort by granularity score (highest first)
    scored.sort(key=lambda x: x["granularity_score"], reverse=True)

    # REQ-1.4: Filter out "Unknown" classifications in mutually-exclusive tiers
    if scored and scored[0]["classification"]["tier_2"].startswith("Unknown "):
        logger.warning(
            f"Filtered tier group '{scored[0]['classification']['tier_1']}' - "
            f"highest confidence classification is '{scored[0]['classification']['tier_2']}' "
            f"(confidence: {scored[0]['classification']['confidence']:.2%})"
        )
        return {
            "primary": None,
            "alternatives": []
        }

    # Step 4: Select primary
    primary_entry = scored[0]
    primary = primary_entry["classification"].copy()
```

### 2.2 TypeScript Implementation

**File:** `src/browser/agents/iab-classifier/tierSelector.ts`

**Function:** `selectPrimaryAndAlternatives()` (lines 115-221 equivalent)

**Changes Required:**

Add the following code after sorting, before primary selection:

```typescript
// REQ-1.4: Filter out "Unknown" classifications in mutually-exclusive tiers
if (scored.length > 0 && scored[0].classification.tier_2.startsWith('Unknown ')) {
  console.warn(
    `Filtered tier group '${scored[0].classification.tier_1}' - ` +
    `highest confidence classification is '${scored[0].classification.tier_2}' ` +
    `(confidence: ${(scored[0].classification.confidence * 100).toFixed(1)}%)`
  )
  return {
    primary: null,
    alternatives: []
  }
}
```

**Full Context (after change):**

```typescript
  // Sort by granularity score (highest first)
  scored.sort((a, b) => b.granularityScore - a.granularityScore)

  // REQ-1.4: Filter out "Unknown" classifications in mutually-exclusive tiers
  if (scored.length > 0 && scored[0].classification.tier_2.startsWith('Unknown ')) {
    console.warn(
      `Filtered tier group '${scored[0].classification.tier_1}' - ` +
      `highest confidence classification is '${scored[0].classification.tier_2}' ` +
      `(confidence: ${(scored[0].classification.confidence * 100).toFixed(1)}%)`
    )
    return {
      primary: null,
      alternatives: []
    }
  }

  // Step 4: Select primary
  const primaryEntry = scored[0]
  const primary: TaxonomySelection & { granularity_score: number; tier_depth: number; classification_type: string } = {
    ...primaryEntry.classification,
```

---

## 3. Test Specification

### 3.1 Unit Tests

**File (Python):** `tests/email_parser/utils/test_classification_tier_selector.py`

**File (TypeScript):** `tests/browser/agents/iab-classifier/tierSelector.test.ts`

#### Test Case 3.1.1: Unknown Gender Filtering

```typescript
describe('Unknown classification filtering', () => {
  it('should filter tier group when Unknown Gender has highest confidence', () => {
    const classifications: TaxonomySelection[] = [
      {
        tier_1: 'Gender',
        tier_2: 'Unknown Gender',
        tier_3: '', tier_4: '', tier_5: '',
        confidence: 0.91,
        evidence_count: 25,
        grouping_value: 'gender'
      },
      {
        tier_1: 'Gender',
        tier_2: 'Male',
        tier_3: '', tier_4: '', tier_5: '',
        confidence: 0.34,
        evidence_count: 2,
        grouping_value: 'gender'
      }
    ]

    const result = selectPrimaryAndAlternatives(classifications, 0.5, 0.3)

    // EXPECTED: Entire tier group filtered (null)
    expect(result.primary).toBeNull()
    expect(result.alternatives).toEqual([])
  })
})
```

#### Test Case 3.1.2: Unknown Age Filtering

```typescript
it('should filter tier group when Unknown Age has highest confidence', () => {
  const classifications: TaxonomySelection[] = [
    {
      tier_1: 'Age Range',
      tier_2: 'Unknown Age',
      tier_3: '', tier_4: '', tier_5: '',
      confidence: 0.88,
      evidence_count: 30,
      grouping_value: 'age_range'
    },
    {
      tier_1: 'Age Range',
      tier_2: '25-34',
      tier_3: '', tier_4: '', tier_5: '',
      confidence: 0.45,
      evidence_count: 5,
      grouping_value: 'age_range'
    }
  ]

  const result = selectPrimaryAndAlternatives(classifications, 0.5, 0.3)

  // EXPECTED: Entire tier group filtered (null)
  expect(result.primary).toBeNull()
  expect(result.alternatives).toEqual([])
})
```

#### Test Case 3.1.3: Valid Classification (No Filtering)

```typescript
it('should NOT filter tier group when valid classification has highest confidence', () => {
  const classifications: TaxonomySelection[] = [
    {
      tier_1: 'Gender',
      tier_2: 'Male',
      tier_3: '', tier_4: '', tier_5: '',
      confidence: 0.89,
      evidence_count: 15,
      grouping_value: 'gender'
    },
    {
      tier_1: 'Gender',
      tier_2: 'Female',
      tier_3: '', tier_4: '', tier_5: '',
      confidence: 0.72,
      evidence_count: 8,
      grouping_value: 'gender'
    }
  ]

  const result = selectPrimaryAndAlternatives(classifications, 0.5, 0.3)

  // EXPECTED: Male is primary, Female is alternative
  expect(result.primary).not.toBeNull()
  expect(result.primary?.tier_2).toBe('Male')
  expect(result.alternatives.length).toBe(1)
  expect(result.alternatives[0].tier_2).toBe('Female')
})
```

#### Test Case 3.1.4: All Mutually-Exclusive Tier Groups

```typescript
const mutuallyExclusiveTiers = [
  { tier_1: 'Gender', unknown: 'Unknown Gender' },
  { tier_1: 'Age Range', unknown: 'Unknown Age' },
  { tier_1: 'Education Level', unknown: 'Unknown Education' },
  { tier_1: 'Marital Status', unknown: 'Unknown Marital Status' },
  { tier_1: 'Income Range', unknown: 'Unknown Income' },
  { tier_1: 'Property Type', unknown: 'Unknown Property' },
  { tier_1: 'Home Ownership', unknown: 'Unknown Ownership' }
]

mutuallyExclusiveTiers.forEach(({ tier_1, unknown }) => {
  it(`should filter ${tier_1} tier group when ${unknown} has highest confidence`, () => {
    const classifications: TaxonomySelection[] = [
      {
        tier_1,
        tier_2: unknown,
        tier_3: '', tier_4: '', tier_5: '',
        confidence: 0.85,
        evidence_count: 20,
        grouping_value: tier_1.toLowerCase().replace(' ', '_')
      }
    ]

    const result = selectPrimaryAndAlternatives(classifications, 0.5, 0.3)

    // EXPECTED: Entire tier group filtered (null)
    expect(result.primary).toBeNull()
    expect(result.alternatives).toEqual([])
  })
})
```

#### Test Case 3.1.5: Unknown in Second Place (No Filtering)

```typescript
it('should NOT filter when Unknown is alternative, not primary', () => {
  const classifications: TaxonomySelection[] = [
    {
      tier_1: 'Gender',
      tier_2: 'Male',
      tier_3: '', tier_4: '', tier_5: '',
      confidence: 0.89,
      evidence_count: 15,
      grouping_value: 'gender'
    },
    {
      tier_1: 'Gender',
      tier_2: 'Unknown Gender',
      tier_3: '', tier_4: '', tier_5: '',
      confidence: 0.65,
      evidence_count: 8,
      grouping_value: 'gender'
    }
  ]

  const result = selectPrimaryAndAlternatives(classifications, 0.5, 0.3)

  // EXPECTED: Male is primary, Unknown Gender is filtered from alternatives
  expect(result.primary).not.toBeNull()
  expect(result.primary?.tier_2).toBe('Male')
  // Unknown Gender should still be in alternatives (only filter if primary)
  expect(result.alternatives.some(a => a.tier_2 === 'Unknown Gender')).toBe(true)
})
```

### 3.2 Integration Tests

**File (Python):** `tests/integration/test_tier_selection_with_unknown_filtering.py`

**File (TypeScript):** `tests/browser/agents/iab-classifier/integration/tierSelectionWithUnknownFiltering.test.ts`

#### Test Case 3.2.1: Full Profile Generation with Unknown Filtering

**Scenario:** Process 50 emails with mixed evidence:
- 25 emails with NO gender indicators (should produce "Unknown Gender")
- 15 emails with male indicators ("he", "his", "Mr.")
- 10 emails with female indicators ("she", "her", "Ms.")

**Expected Result:**
- Memory reconciliation will boost "Unknown Gender" to ~85-90% confidence
- "Male" will have ~35-40% confidence
- "Female" will have ~25-30% confidence
- **Gender tier group should be FILTERED (null)**
- Profile should have `demographics.gender = null`

**Test Code:**

```typescript
it('should filter gender tier group in full profile when Unknown Gender is primary', async () => {
  const store = new IndexedDBStore('ownyou_store')
  const userId = 'test_user_unknown_filtering'

  // Process 50 emails (25 no gender, 15 male, 10 female)
  for (let i = 0; i < 50; i++) {
    let text: string
    if (i < 25) {
      text = `Order #${i} has been shipped. Track your package.`  // No gender
    } else if (i < 40) {
      text = `Hello Mr. Smith, your order #${i} is ready. He should check his email.`  // Male
    } else {
      text = `Hello Ms. Jones, your order #${i} is ready. She should check her email.`  // Female
    }

    const classifications = await runIABClassifier(store, userId, text)
    await storeClassifications(store, userId, classifications)
  }

  // Read profile from store
  const reader = getBrowserProfileReader()
  const profile = await reader.getTieredProfile(userId)

  // EXPECTED: Gender tier group is null (filtered)
  expect(profile.demographics.gender).toBeNull()

  // Verify logs show filtering
  // Should see: "Filtered tier group 'Gender' - highest confidence classification is 'Unknown Gender' (confidence: 91.0%)"
})
```

#### Test Case 3.2.2: Multiple Tier Groups with Unknown Filtering

**Scenario:** Process emails with multiple "Unknown" classifications:
- Gender: Unknown Gender (90%)
- Age: Unknown Age (85%)
- Income: Unknown Income (80%)
- Education: Bachelor's Degree (75%)

**Expected Result:**
- Gender tier group: FILTERED (null)
- Age tier group: FILTERED (null)
- Income tier group: FILTERED (null)
- Education tier group: NOT filtered (Bachelor's Degree selected as primary)

### 3.3 End-to-End Test (Playwright MCP)

**File:** `tests/browser/e2e/unknownClassificationFiltering.playwright.test.ts`

#### Test Case 3.3.1: Browser UI Verification

**Steps:**
1. Navigate to `http://localhost:3000/analyze`
2. Enter text with NO gender indicators: "Your order has been shipped. Track it online."
3. Click "Classify Text"
4. Wait for classification to complete (~25s)
5. Navigate to `http://localhost:3000/profile?user_id=test_user_e2e`
6. Verify Demographics section shows 0 classifications (gender filtered)
7. Take screenshot: `profile_gender_filtered.png`

**Expected UI:**
```
Demographics: 0
Household: 0
Interests: 0
Purchase Intent: 0

[Empty State]
No tiered classifications found. Download and classify emails to build your profile.
```

**Playwright MCP Script:**

```typescript
// 1. Navigate to analyze page
await mcp__playwright__browser_navigate({ url: 'http://localhost:3000/analyze' })
await mcp__playwright__browser_snapshot()

// 2. Enter text with no gender indicators
const textWithNoGender = 'Your order has been shipped. Track it online at our website.'
await mcp__playwright__browser_type({
  element: 'Text input field',
  ref: 'textarea[name="text"]',
  text: textWithNoGender
})

// 3. Click classify button
await mcp__playwright__browser_click({
  element: 'Classify Text button',
  ref: 'button:has-text("Classify Text")'
})

// 4. Wait for classification to complete
await mcp__playwright__browser_wait_for({ time: 30 })

// 5. Navigate to profile page
await mcp__playwright__browser_navigate({ url: 'http://localhost:3000/profile?user_id=test_user_e2e' })
await mcp__playwright__browser_snapshot()

// 6. Verify Demographics count is 0
const snapshot = await mcp__playwright__browser_snapshot()
// Should see "Demographics: 0" in summary cards

// 7. Take screenshot
await mcp__playwright__browser_take_screenshot({
  filename: 'profile_gender_filtered.png'
})
```

---

## 4. Acceptance Criteria

### 4.1 Code Implementation

- [ ] Python implementation added to `classification_tier_selector.py` (line 185)
- [ ] TypeScript implementation added to `tierSelector.ts` (matching location)
- [ ] Both implementations use exact same logic (startsWith('Unknown '))
- [ ] Both implementations log filtering decisions at WARNING level
- [ ] Code compiles with zero TypeScript errors: `npx tsc --noEmit`

### 4.2 Unit Tests

- [ ] All 5 unit test cases pass (Python: pytest, TypeScript: vitest)
- [ ] Test coverage >80% for modified functions
- [ ] Tests verify filtering for all 7 mutually-exclusive tier groups
- [ ] Tests verify NO filtering when valid classification is primary
- [ ] Tests verify NO filtering when Unknown is alternative (not primary)

### 4.3 Integration Tests

- [ ] Full profile generation test passes with Unknown filtering
- [ ] Multiple tier groups with Unknown filtering test passes
- [ ] 50-email integration test produces correct filtered profile
- [ ] Memory reconciliation correctly boosts Unknown classifications but they are still filtered

### 4.4 End-to-End Tests

- [ ] Playwright MCP test completes successfully
- [ ] Browser UI shows correct filtered state (Demographics: 0)
- [ ] Profile page displays empty state when all tier groups filtered
- [ ] Screenshot evidence captured: `profile_gender_filtered.png`
- [ ] Console logs show filtering warnings

### 4.5 Documentation

- [ ] This specification document reviewed and approved
- [ ] Implementation changes documented in migration review
- [ ] Test results documented with screenshots
- [ ] TIER_SELECTION_50_EMAIL_TEST_RESULTS.md updated with corrected results
- [ ] README.md in migration2.0 folder updated with this requirement

### 4.6 Zero Bugs

- [ ] ALL tests pass with zero failures
- [ ] No TypeScript compilation errors
- [ ] No console errors in browser
- [ ] No Python exceptions or warnings (except filtering warnings)
- [ ] Full regression test suite passes

---

## 5. Risk Assessment

### 5.1 Breaking Changes

**Risk:** This change modifies the output of `select_primary_and_alternatives()`, which could break downstream code that expects a primary classification.

**Mitigation:**
- Profile reader (`profile-reader.ts` and `profile_reader.py`) already handles null values
- Profile UI already handles empty demographics sections
- Test all integration points before deploying

### 5.2 Data Loss

**Risk:** Existing profiles with "Unknown" classifications will lose that data when re-processed.

**Mitigation:**
- "Unknown" classifications provide no value to users (they indicate inability to classify)
- This is a data quality improvement, not data loss
- Users with existing "Unknown" classifications will see cleaner, more useful profiles after re-processing

### 5.3 Performance Impact

**Risk:** Additional check on every tier group could impact performance.

**Mitigation:**
- Check is O(1) string comparison (startsWith)
- Negligible performance impact (<1ms per tier group)
- Early return (when filtering) actually improves performance by skipping alternative selection

---

## 6. Rollout Plan

### Phase 1: Implementation (Day 1)
1. Implement Python changes in `classification_tier_selector.py`
2. Implement TypeScript changes in `tierSelector.ts`
3. Run `npx tsc --noEmit` to verify zero compilation errors
4. Create Python unit tests in `test_classification_tier_selector.py`
5. Create TypeScript unit tests in `tierSelector.test.ts`
6. Run unit tests and fix any failures

### Phase 2: Integration Testing (Day 2)
1. Create integration test script (50-email scenario)
2. Run integration test and verify filtering working
3. Create Playwright MCP E2E test script
4. Run E2E test and capture screenshots
5. Document test results

### Phase 3: Documentation and Review (Day 3)
1. Update TIER_SELECTION_50_EMAIL_TEST_RESULTS.md with corrected results
2. Update migration2.0 README.md
3. Archive outdated test scripts
4. Review all changes with user
5. Get approval for production deployment

### Phase 4: Production Deployment (Day 4)
1. Merge to main branch
2. Deploy to production
3. Monitor logs for filtering warnings
4. Verify user profiles no longer contain "Unknown" classifications

---

## 7. Related Documents

- **Original Requirements:** `_archive/IAB_PROFILE_SCHEMA_v2.md` (lines 180-230)
- **Python Source:** `src/email_parser/utils/classification_tier_selector.py` (lines 115-221)
- **TypeScript Source:** `src/browser/agents/iab-classifier/tierSelector.ts` (lines 115-221)
- **Test Results (Bug Discovery):** `docs/development/TIER_SELECTION_REAL_50_EMAIL_TEST_RESULTS.md` (lines 53-64)
- **Migration Documentation:** `docs/migration/migration2.0/README.md`

---

## 8. Glossary

- **Tier Selection Algorithm**: System for selecting primary and alternative classifications based on confidence and granularity scores
- **Mutually-Exclusive Tier Groups**: Categories where only one classification can be true (e.g., Gender: Male XOR Female)
- **Non-Exclusive Tier Groups**: Categories where multiple classifications can coexist (e.g., Interests)
- **Unknown Classification**: Classification value starting with "Unknown " indicating inability to determine the actual value
- **Granularity Score**: `confidence + (tier_depth × 0.05)` when `confidence >= 0.7`
- **Memory Reconciliation**: Confidence boosting formula when repeated classifications confirm existing memories
- **Primary Classification**: The highest confidence/granularity score classification selected for a tier group
- **Alternative Classifications**: Classifications within confidence delta (0.3) of primary

---

**Last Updated:** 2025-01-12
**Status:** 🔴 NOT IMPLEMENTED - Awaiting implementation and testing
**Next Steps:** Implement Python changes, then TypeScript changes, then run all tests

**CRITICAL:** This work is NOT complete until ALL tests pass with ZERO bugs.
