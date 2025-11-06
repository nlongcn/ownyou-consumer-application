# Email Provenance Tracking Issue

**Date**: 2025-10-09
**Status**: CRITICAL BUG - Cross-vendor LLM prompt adherence failure
**Severity**: High - Affects audit trail and classification traceability

## Problem Summary

Both Claude Sonnet 4.5 and OpenAI GPT-5-mini consistently fail to include the required `email_number` field in classification responses during batch processing, despite explicit and heavily emphasized prompt instructions. This breaks the email provenance tracking system that maps classifications back to their source emails.

## Background

The system processes emails in batches (up to 20 emails per LLM call) for efficiency. To track which email produced which classification, we:

1. Number emails in the prompt (Email 1, Email 2, etc.)
2. Create `email_number_to_id` mapping dictionary
3. Require LLM to return `email_number` field in each classification
4. Map `email_number` → `email_id` for provenance tracking

## Test Results

### Test 1: Claude Sonnet 4.5 (10 emails, batch mode)
- **Date**: 2025-10-09 11:24:20
- **Model**: claude-sonnet-4-5-20250929
- **Output**: data/profile_nick_20251009_112420.json
- **Results**:
  - ✅ Classifications generated: Demographics (6), Household (12), Interests (15), Purchase Intent (12)
  - ❌ **Provenance: ALL showing "0/X have email_id"**
- **Log Evidence**:
  ```
  logs/email_parser_20251009_122525.log:   Provenance tracked: 0/0 have email_id
  logs/email_parser_20251009_122525.log:   Provenance tracked: 0/2 have email_id
  logs/email_parser_20251009_122525.log:   Provenance tracked: 0/1 have email_id
  ```

### Test 2: OpenAI GPT-5-mini (10 emails, batch mode)
- **Date**: 2025-10-09 11:31:55
- **Model**: gpt-5-mini
- **Output**: data/profile_nick_20251009_113155.json
- **Results**:
  - ✅ Classifications generated: Demographics (6), Household (12), Interests (17), Purchase Intent (12)
  - ❌ **Provenance: ALL showing "0/X have email_id"**
- **Log Evidence**: Same pattern - all provenance tracking shows 0/X

## Prompt Modifications Attempted

Enhanced all 4 agent prompts (demographics, household, interests, purchase) with:

1. **⚠️ Warnings**: "CRITICAL REQUIREMENT" section with warning emoji
2. **Multiple reminders**: Repeated throughout system prompt
3. **Bold/formatting emphasis**: Used capitalization and symbols
4. **Inline examples**: Showed exact JSON format with email_number
5. **Inline comments**: Added `<-- REQUIRED` annotations
6. **Explicit instructions**: "DO NOT FORGET email_number - it is MANDATORY"

**Example from demographics_agent.py:53-70**:
```python
Return format (JSON) - YOU MUST INCLUDE email_number FOR EVERY CLASSIFICATION:
{
  "classifications": [
    {
      "taxonomy_id": 50,
      "value": "Male",
      "confidence": 0.9,
      "reasoning": "Subject line contains 'Mr.' title",
      "email_number": 1  <-- REQUIRED: MUST be the email number (1, 2, 3...)
    }
  ]
}

⚠️ CRITICAL REQUIREMENT ⚠️: Every single classification MUST include "email_number" field!
- If processing Email 1 → "email_number": 1
- If processing Email 2 → "email_number": 2
- If processing Email 3 → "email_number": 3
DO NOT FORGET email_number - it is MANDATORY for provenance tracking!
```

**Result**: No improvement - both models continue to ignore the email_number requirement.

## Code Implementation

### Agent Pattern (All 4 Agents)

**File**: `src/email_parser/agents/demographics_agent.py:127-141`
```python
# Format emails for prompt and create email_number → email_id mapping
email_number_to_id = {}  # Map email numbers (1,2,3...) to actual email IDs
email_text_parts = []

for i, email in enumerate(emails[:20]):  # Limit to 20 emails per batch
    email_number = i + 1
    email_id = email.get('id', f'unknown_{i}')
    email_number_to_id[email_number] = email_id

    email_text_parts.append(
        f"Email {email_number}:\n"
        f"Subject: {email.get('subject', 'N/A')}\n"
        f"From: {email.get('sender', 'N/A')}\n"
        f"Body: {email.get('body', '')[:500]}..."
    )
```

**File**: `src/email_parser/agents/demographics_agent.py:238-244`
```python
# Map email_number to email_id for provenance tracking
email_number = classification.get("email_number")
if email_number and email_number in email_number_to_id:
    classification["email_id"] = email_number_to_id[email_number]
else:
    logger.warning(f"Classification missing email_number or invalid: {classification}")
    classification["email_id"] = "unknown"
```

### Logging Implementation

**File**: `src/email_parser/workflow/nodes/analyzers.py:298-303`
```python
# Log summary with provenance info
classifications_with_provenance = sum(1 for c in state["demographics_results"] if c.get("email_id"))
logger.info(
    f"✅ Demographics agent complete: {len(state['demographics_results'])} classifications added\n"
    f"   Provenance tracked: {classifications_with_provenance}/{len(state['demographics_results'])} have email_id"
)
```

## Root Cause Analysis

This is a **fundamental LLM prompt adherence issue** affecting multiple vendors:

1. **Not model-specific**: Affects both Claude (Anthropic) and GPT (OpenAI)
2. **Not prompt-quality issue**: Extensive emphasis and examples didn't help
3. **Likely cause**: LLMs optimize for completing the core classification task and may treat metadata fields like `email_number` as optional/extraneous

## Alternative Solutions

### Option 1: Function Calling / Structured Outputs (RECOMMENDED)
Use provider-specific structured output features:
- **OpenAI**: Use `response_format` with JSON schema enforcement
- **Anthropic**: Use function/tool calling with strict schema
- **Benefit**: Schema validation at LLM level, not just prompt-based

### Option 2: Post-Processing Injection
- Parse LLM response JSON
- Infer email_number from position in classifications array
- Inject email_number programmatically before validation
- **Risk**: May misattribute classifications if LLM reorders them

### Option 3: Single-Email Processing Mode
- Process one email per LLM call instead of batches
- Provenance is implicit (1 email = 1 classification source)
- **Downside**: Higher cost and latency (20x more LLM calls)

### Option 4: Hybrid Approach
- Use batch processing for efficiency
- Fall back to single-email processing if provenance tracking fails
- Log when falling back

## Impact Assessment

### Current Impact
- ❌ **No audit trail**: Cannot trace which email produced which classification
- ❌ **Debugging difficult**: Can't identify problematic emails causing incorrect classifications
- ❌ **Compliance risk**: May violate data provenance requirements for regulated industries

### System Still Functions
- ✅ Classifications are generated correctly
- ✅ Confidence scores work
- ✅ Batch processing efficiency maintained
- ⚠️ Only provenance metadata is lost

## Files Modified

### Agent Prompts (All Updated 2025-10-09)
- `src/email_parser/agents/demographics_agent.py:19-71`
- `src/email_parser/agents/household_agent.py:19-71`
- `src/email_parser/agents/interests_agent.py:19-71`
- `src/email_parser/agents/purchase_agent.py:19-76`

### Agent Implementation
- `src/email_parser/agents/demographics_agent.py:127-244`
- Same pattern in household, interests, purchase agents

### Logging
- `src/email_parser/workflow/nodes/analyzers.py:175-180, 298-303` (demographics)
- Same pattern for household, interests, purchase analyzer nodes

## Bug Fixes Applied (Related)

### Bug #1: Evidence Judge NameError
- **File**: `src/email_parser/workflow/nodes/evidence_judge.py:125`
- **Fix**: Changed `email_content` to `email_context`
- **Commit**: b06274f
- **Impact**: Evidence judge was crashing before email_id could be added

### Bug #2: Batch Optimizer TypeError
- **File**: `src/email_parser/workflow/batch_optimizer.py:85-88`
- **Fix**: Added None check for context_window
- **Commit**: b06274f
- **Impact**: Pipeline crash during batch size calculation

## Next Steps

1. **Investigate Option 1**: Test OpenAI's `response_format` with strict JSON schema
2. **Prototype Option 2**: Test post-processing injection approach
3. **Consider Option 3**: Measure cost/latency impact of single-email mode
4. **Decision needed**: Choose approach based on testing results

## Testing Checklist

When implementing fix:
- [ ] Test with Claude Sonnet 4.5
- [ ] Test with OpenAI GPT-5-mini
- [ ] Test with OpenAI GPT-4o-mini
- [ ] Verify provenance logs show "X/X have email_id" (not 0/X)
- [ ] Verify output JSON contains email_id fields
- [ ] Test with various batch sizes (5, 10, 20 emails)
- [ ] Run unit tests: `pytest tests/unit/test_batch_provenance.py`

## References

- **Test Branch**: `test/agent-validation`
- **Unit Tests**: `tests/unit/test_batch_provenance.py` (468 lines, 10 tests)
- **Manual Test**: Run analysis via dashboard at http://localhost:3000/analyze
- **Logs**: Check `logs/email_parser_*.log` for provenance tracking stats

## Related Issues

- Evidence judge crashes were blocking email_id addition (now fixed)
- Batch optimizer None handling was causing pipeline crashes (now fixed)
- Both models also show JSON parsing errors during batch processing

---

**Last Updated**: 2025-10-09
**Assigned To**: TBD
**Priority**: High - Blocks production audit trail requirements
