# Taxonomy Validation Formatting Bug

**Date:** 2025-01-12
**Status:** IDENTIFIED - Not yet fixed
**Severity:** HIGH - Causes all classifications to fail validation
**Affected Files:**
- TypeScript: `/src/browser/agents/iab-classifier/analyzers/tools.ts` (validateClassification function)
- All 4 agents: demographics, household, interests, purchase

---

## Problem Description

LLM returns taxonomy values with formatting variations that don't exactly match the taxonomy definitions, causing validation to fail and ALL classifications to be rejected.

### Observed Failures

**Test Run: 2025-01-12 with 5 emails**
- **Result**: 5/5 classifications FAILED validation
- **Outcome**: All emails show "Classification Error: Classification failed"

### Validation Error Examples

1. **Taxonomy ID 66 (Income Level)**
   - **LLM returned**: `'$50,000-$74,999'` (with commas and hyphens)
   - **Taxonomy expects**: `'$50000 - $74999'` (no commas, spaces around hyphen)
   - **Error**: "VALIDATION FAILED: Taxonomy ID 66 mismatch"

2. **Taxonomy ID 268 (Interests Category)**
   - **LLM returned**: `'Business and Finance | Business'` (full tier path with separator)
   - **Taxonomy expects**: `'Business and Finance'` (only the value, not full path)
   - **Error**: "VALIDATION FAILED: Taxonomy ID 268 mismatch"

---

## Root Cause

The `validateClassification` function performs **EXACT string matching** between LLM output and taxonomy definitions:

```typescript
// From tools.ts (validation logic)
if (value === expected_value) {
  return { valid: true }
} else {
  return { valid: false, expected_value }
}
```

**Problems with exact matching:**
1. **Number formatting**: LLM adds commas to numbers (`$50,000` vs `$50000`)
2. **Whitespace variations**: Inconsistent spacing around hyphens/separators
3. **Tier path inclusion**: LLM sometimes returns full path instead of just the final value
4. **Case sensitivity**: Potential uppercase/lowercase mismatches

---

## Impact

### Current Behavior (BROKEN)
- LLM generates valid classifications
- Validation rejects them due to formatting differences
- ALL classifications fail
- User sees "Classification Error: Classification failed" for ALL emails
- Workflow returns 0 successful classifications

### Expected Behavior
- Validation should handle formatting variations
- Only reject if taxonomy_id + normalized_value don't match
- Accept: `$50,000-$74,999` ≈ `$50000 - $74999` (same meaning, different format)

---

## Solution Approaches

### Option 1: Normalize Values Before Comparison (RECOMMENDED)

Add normalization function to handle common variations:

```typescript
function normalizeValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/,/g, '')  // Remove commas
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/\s*-\s*/g, '-')  // Normalize hyphens
    // Extract final tier value if full path provided
    .split('|').pop()?.trim() || value
}

// In validateClassification:
if (normalizeValue(value) === normalizeValue(expected_value)) {
  return { valid: true }
}
```

**Pros:**
- Handles most common formatting variations
- Preserves strict validation for actual mismatches
- Easy to implement

**Cons:**
- May need to handle edge cases (e.g., legitimate "|" in values)

### Option 2: Update Prompts to Match Taxonomy Formatting

Modify agent prompts to specify exact formatting rules:

```typescript
// In prompts.ts
"CRITICAL FORMATTING RULES:
- Numbers: NO commas (use $50000 not $50,000)
- Ranges: Spaces around hyphen ($50000 - $74999)
- Values: ONLY final tier value, NOT full path"
```

**Pros:**
- No code changes to validation logic
- Forces LLM to follow exact format

**Cons:**
- LLMs often ignore formatting instructions
- Brittle (breaks if LLM doesn't follow rules)
- Requires re-prompting for each formatting issue

### Option 3: Fuzzy Matching with Similarity Score

Use string similarity algorithm (e.g., Levenshtein distance):

```typescript
function stringSimilarity(a: string, b: string): number {
  // Calculate similarity score 0.0-1.0
}

if (stringSimilarity(value, expected_value) > 0.9) {
  return { valid: true }
}
```

**Pros:**
- Handles any formatting variation
- Most robust solution

**Cons:**
- More complex
- Risk of false positives

---

## Recommended Fix

**Use Option 1 (Normalization)** with the following logic:

1. **Normalize both values** before comparison
2. **Log warnings** for formatting differences (for monitoring)
3. **Accept normalized matches** as valid
4. **Reject true mismatches** (different actual values)

### Implementation Plan

1. Add `normalizeValue()` function to `tools.ts`
2. Update `validateClassification()` to use normalization
3. Add tests for common formatting variations
4. Monitor logs for new formatting patterns

---

## Testing

### Test Cases to Add

```typescript
// Should PASS validation:
validateClassification(66, '$50,000-$74,999')  // Commas + no spaces
validateClassification(66, '$50000-$74999')    // No commas + no spaces
validateClassification(66, '$50000 - $74999')  // No commas + spaces (correct)

validateClassification(268, 'Business and Finance | Business')  // Full path
validateClassification(268, 'Business and Finance')  // Just value (correct)

// Should FAIL validation:
validateClassification(66, '$25000 - $49999')  // Wrong income bracket
validateClassification(268, 'Technology')      // Wrong category
```

---

## Files to Modify

1. **`/src/browser/agents/iab-classifier/analyzers/tools.ts`**
   - Add `normalizeValue()` function
   - Update `validateClassification()` to use normalization
   - Add logging for formatting differences

2. **Tests (if exist)**
   - Add tests for formatting variations
   - Ensure strict validation still works for true mismatches

---

## Current Status

**Identified:** 2025-01-12 during OpenAI summarization fix testing
**Impact:** All 5 test emails failed classification (100% failure rate)
**Blocker:** Cannot test email_id provenance fix until this is resolved

---

## Related Issues

- **Email ID Provenance Bug** (`2025-01-12-batch-classification-email-provenance-bug.md`) - Cannot test this until validation works
- **Email Summarization** - Fixed (switched from Google to OpenAI)

---

## Next Steps

1. Implement `normalizeValue()` function
2. Update validation logic
3. Test with 5 diverse emails
4. Verify classifications pass validation
5. Then proceed to test email_id provenance
