# Batch Evidence Judge Bug Fix - 2025-10-10

## Bug Summary

**Date Found**: 2025-10-10 at 13:02 UTC
**Session ID**: 20251010_130223
**Severity**: Critical (100% batch call failure rate)

## Problem

The batch evidence judge implementation was failing with 100% failure rate. All 9 batch calls fell back to individual validation.

### Root Cause

The LLM (gpt-5-mini) was returning evaluations in **dict-with-numeric-keys format** instead of array format:

**Expected (what we coded for)**:
```json
[
  {"is_valid": true, "quality_score": 0.9, "evidence_type": "explicit", "issue": ""},
  {"is_valid": false, "quality_score": 0.0, "evidence_type": "inappropriate", "issue": "..."}
]
```

**Actual (what LLM returned)**:
```json
{
  "0": {"is_valid": true, "quality_score": 0.9, "evidence_type": "explicit", "issue": ""},
  "1": {"is_valid": false, "quality_score": 0.0, "evidence_type": "inappropriate", "issue": "..."}
}
```

### Symptoms

1. Logs showed: `call_json successful (keys: ['0'])` instead of array structure
2. All batch calls failed with: `Batch response length mismatch: got 0, expected X`
3. 100% fallback to individual validation
4. NO performance improvement from batch processing

### Why It Happened

Our prompt used numbered lists (1, 2, 3...) to establish order:
```
## Classifications to Evaluate (RETURN IN SAME ORDER):
1. Taxonomy Value: Student
   Confidence: 0.95
   Reasoning: ...

2. Taxonomy Value: Male
   Confidence: 0.85
   Reasoning: ...
```

The LLM interpreted these numbers as **dict keys** rather than **array indices**.

## Fix

Updated response parsing logic in `src/email_parser/workflow/nodes/evidence_judge.py` (lines 549-564):

**Before (BROKEN)**:
```python
# Parse response (handle both array and dict with "evaluations" key)
evaluations = response if isinstance(response, list) else response.get("evaluations", [])
```

**After (FIXED)**:
```python
# Parse response (handle multiple formats)
if isinstance(response, list):
    # Format 1: Direct array
    evaluations = response
elif "evaluations" in response:
    # Format 2: Dict with "evaluations" key
    evaluations = response["evaluations"]
elif all(str(k).isdigit() for k in response.keys()):
    # Format 3: Dict with numeric keys ({"0": {...}, "1": {...}})
    # Convert to array by sorting keys numerically
    logger.debug(f"Converting dict with numeric keys to array (keys: {list(response.keys())})")
    evaluations = [response[str(i)] for i in sorted([int(k) for k in response.keys()])]
else:
    # Unknown format
    logger.error(f"Unknown response format, keys: {list(response.keys())}")
    evaluations = []
```

## Solution Approach

Added **robust multi-format parsing** that handles:
1. **Direct array**: `[{...}, {...}]` (original expected format)
2. **Dict with "evaluations" key**: `{"evaluations": [{...}, {...}]}` (alternative format)
3. **Dict with numeric keys**: `{"0": {...}, "1": {...}}` (actual LLM behavior) ← **NEW**
4. **Unknown formats**: Gracefully log error and return empty array (triggers fallback)

The fix converts dict-with-numeric-keys to array by:
1. Detecting numeric keys via `all(str(k).isdigit() for k in response.keys())`
2. Converting keys to integers and sorting
3. Building array in correct order: `[response[str(i)] for i in sorted(...)]`

## Verification Plan

Run new E2E test (100 emails) via dashboard and verify:
1. ✅ Zero "Batch response length mismatch" errors
2. ✅ Log shows "Converting dict with numeric keys to array"
3. ✅ Log shows "✅ Batch evidence judge: X classifications evaluated in single LLM call"
4. ✅ Zero fallbacks (or < 5% fallback rate)
5. ✅ Performance improvement: expect ~15-20min for Step 3 instead of 35-40min

## Files Modified

- `src/email_parser/workflow/nodes/evidence_judge.py` (lines 549-564)

## Test Results

### Session 20251010_130223 (BEFORE FIX)
- **Batch calls attempted**: 9
- **Batch calls succeeded**: 0 (0%)
- **Fallback rate**: 100%
- **Result**: NO performance improvement

### Session PENDING (AFTER FIX)
- **Status**: Test pending
- **Expected**: >90% batch success rate
- **Expected improvement**: 20min → 2min for evidence validation

## Related Issues

- Original batch processing spec: `docs/requirements/BATCH_EVIDENCE_JUDGE_SPEC.md`
- Oct 9 lesson: "LLMs ignore metadata fields" → use position-based mapping (we did this correctly)
- This bug: "LLMs interpret numbered prompts as dict keys" → need flexible parsing

## Lesson Learned

**Always handle multiple LLM response formats**, especially when:
- Using numbered lists in prompts
- Requesting JSON arrays
- Different models may interpret same prompt differently

**Mitigation Strategy**: Robust parsing with multiple format handlers + fallback logic.
