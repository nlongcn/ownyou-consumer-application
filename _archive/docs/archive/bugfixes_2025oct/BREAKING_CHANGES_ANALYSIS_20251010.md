# Breaking Changes Analysis - 2025-10-10

## Problem Statement

**Issue**: Workflow broke after applying stashed changes (32 files modified) to commit b06274f (known working state).

**Symptom**: User reported workflow broken after applying changes, though test output showed HTTP requests to OpenAI suggesting partial execution.

**Context**:
- Commit b06274f (baseline): WORKED ✅
- Commit b06274f + my stashed changes: BROKEN ❌

## Changes Applied (32 Files)

### Critical Workflow Files Modified:
- `src/email_parser/workflow/state.py` - Added REQUIRED validation for model_context_window
- `src/email_parser/workflow/executor.py` - Added context window fetching logic
- `src/email_parser/workflow/llm_wrapper.py` - Added dynamic max_tokens calculation
- `src/email_parser/workflow/nodes/analyzers.py` - Switched to batch evidence validation
- `src/email_parser/workflow/nodes/evidence_judge.py` - Added batch validation function (459-601)

### Agent Files Modified (Prompt Changes):
- `src/email_parser/agents/demographics_agent.py`
- `src/email_parser/agents/household_agent.py`
- `src/email_parser/agents/interests_agent.py`
- `src/email_parser/agents/purchase_agent.py`

### Provider Support Added:
- `src/email_parser/utils/config.py` - Added "google" to valid providers
- `src/email_parser/llm_clients/google_client.py` - Implemented abstract methods
- `src/email_parser/llm_clients/model_registry.py` - Added Google models

### Dashboard Changes:
- `dashboard/backend/api/analyze.py`
- `dashboard/frontend/app/analyze/page.tsx`
- `dashboard/frontend/app/dashboard/page.tsx`

### Other Files:
- Various memory, reconciliation, and tracking files (20+ additional files)

---

## Most Likely Breaking Changes (Ranked by Risk)

### 🔴 HIGH RISK #1: State Validation Fail-Fast (state.py:229-243)

**File**: `src/email_parser/workflow/state.py`

**Change**: Added REQUIRED validation that raises ValueError if `model_context_window` is None:

```python
# CRITICAL: model_context_window is None - TAXONOMY_MODEL not set.
if not model_context_window:
    error_msg = (
        "CRITICAL: model_context_window is None - TAXONOMY_MODEL not set.\n\n"
        "IAB Classification requires TAXONOMY_MODEL to calculate batch sizes.\n"
        "This is REQUIRED for proper batch processing performance.\n\n"
        "Fix: Set TAXONOMY_MODEL environment variable or --taxonomy-model flag:\n"
        "  TAXONOMY_MODEL=provider:model python -m src.email_parser.main ...\n"
    )
    logger.error(error_msg)
    raise ValueError(error_msg)  # <-- HARD FAIL
```

**Why It Could Break**:
- If context window fetch in `executor.py` fails silently, workflow crashes immediately
- No graceful fallback to default batch size
- Breaks backward compatibility with code that worked without context window

**Impact**: Workflow dies at initialization, preventing any processing

---

### 🔴 HIGH RISK #2: Agent Response Format Change (All 4 Agents)

**Files**:
- `src/email_parser/agents/demographics_agent.py`
- `src/email_parser/agents/household_agent.py`
- `src/email_parser/agents/interests_agent.py`
- `src/email_parser/agents/purchase_agent.py`

**Change**: Modified prompts to request `email_numbers` array instead of `email_number` scalar:

```python
# OLD FORMAT (working at commit b06274f):
{
  "classifications": [
    {
      "taxonomy_id": 50,
      "email_number": 5,  # <-- Single value
      ...
    }
  ]
}

# NEW FORMAT (my change):
{
  "classifications": [
    {
      "taxonomy_id": 50,
      "email_numbers": [1, 5, 12],  # <-- Array for provenance tracking
      ...
    }
  ]
}
```

**Why It Could Break**:
- If parsing code in `analyzers.py` expects `email_number` but gets `email_numbers`, KeyError
- If LLM doesn't follow new format, validation fails
- If downstream code iterates over `email_number` assuming scalar, TypeError

**Impact**: Classifications fail to parse, causing empty results or crashes

---

### 🟡 MEDIUM RISK #3: Batch Evidence Validation (evidence_judge.py:459-601)

**File**: `src/email_parser/workflow/nodes/evidence_judge.py`

**Change**: Added new function `evaluate_evidence_quality_batch()` that:
1. Creates numbered list of classifications (1-indexed)
2. Requests ordered evaluation response from LLM
3. Parses ordering validation
4. Maps evaluations back to classifications by position

**Example Prompt**:
```
Evaluate these 15 classifications:

1. ID 49 (Female) - "Emails addressed to 'Ms. Sarah'"
2. ID 50 (Male) - "User signs emails as 'Mr. Thompson'"
...
15. ID 703 (Books) - "Order confirmation from Amazon Books"

Return evaluations in EXACT ORDER (1-15):
[
  {"quality_score": 0.8, "is_valid": true, ...},  # Evaluation for #1
  {"quality_score": 0.6, "is_valid": true, ...},  # Evaluation for #2
  ...
]
```

**Why It Could Break**:
- LLM returns evaluations out of order → mismatched quality scores
- LLM skips evaluations (returns 14 instead of 15) → index mismatch
- Parsing fails if LLM doesn't follow format → silent fallback to individual validation
- Batch too large, LLM truncates response → incomplete evaluations

**Impact**: Classifications get wrong quality scores, causing incorrect confidence adjustments or blocking

---

### 🟡 MEDIUM RISK #4: Switched to Batch Validation (analyzers.py)

**File**: `src/email_parser/workflow/nodes/analyzers.py`

**Change**: Replaced individual validation loop with single batch call:

```python
# OLD (working at b06274f):
validated_classifications = []
for classification in classifications:
    evidence_eval = evaluate_evidence_quality(classification, ...)
    classification = adjust_confidence_with_evidence_quality(classification, evidence_eval)
    if should_block_classification(evidence_eval["quality_score"]):
        continue
    validated_classifications.append(classification)

# NEW (my change):
evidence_evaluations = evaluate_evidence_quality_batch(
    classifications=classifications,
    email_context=email_context,
    section_guidelines=DEMOGRAPHICS_EVIDENCE_GUIDELINES,
    llm_client=llm_client
)

validated_classifications = []
for classification, evidence_eval in zip(classifications, evidence_evaluations):
    classification = adjust_confidence_with_evidence_quality(classification, evidence_eval)
    if should_block_classification(evidence_eval["quality_score"]):
        continue
    validated_classifications.append(classification)
```

**Why It Could Break**:
- If batch validation returns fewer evaluations than classifications, zip truncates silently
- If batch validation raises exception, no fallback to individual validation
- If batch validation returns None or empty list, all classifications blocked

**Impact**: Some or all classifications disappear without error logging

---

### 🟢 LOW RISK #5: Dynamic max_tokens (llm_wrapper.py)

**File**: `src/email_parser/workflow/llm_wrapper.py`

**Change**: Added dynamic max_tokens calculation based on context window:

```python
def _calculate_max_tokens(self, messages, model_name: str) -> int:
    """Calculate max_tokens dynamically based on prompt size and context window."""
    estimated_prompt_tokens = self._estimate_token_count(messages)
    available_tokens = self.context_window - estimated_prompt_tokens
    max_tokens = int(available_tokens * 0.8)  # Use 80% of available space
    max_tokens = max(500, min(max_tokens, 4096))  # Clamp to reasonable range
    return max_tokens
```

**Why It Could Break**:
- If token estimation is wrong, available_tokens could be negative → max_tokens = 500 (min)
- If model refuses request with calculated max_tokens, API error
- If max_tokens too small, response truncated mid-JSON → parsing fails

**Impact**: LLM calls fail or return truncated responses

---

### 🟢 LOW RISK #6: Google Provider Support

**Files**:
- `src/email_parser/utils/config.py`
- `src/email_parser/llm_clients/google_client.py`
- `src/email_parser/llm_clients/model_registry.py`

**Change**: Added "google" as valid provider and implemented Google client abstract methods.

**Why It Could Break**:
- Only breaks if user actually tries to use Google provider
- Should not affect OpenAI provider (used in test)

**Impact**: Minimal - isolated to Google provider usage

---

## Incremental Testing Strategy

To isolate the breaking change, test changes **one group at a time**:

### Phase 1: Google Provider Support (Low Risk)
1. Revert to commit b06274f (known working)
2. Apply ONLY:
   - `config.py` (google provider)
   - `google_client.py` (abstract methods)
   - `model_registry.py` (google models)
3. **Test**: Run IAB classification with OpenAI
4. **Expected**: PASS ✅ (isolated change, shouldn't affect OpenAI)

### Phase 2: Agent Prompt Changes (HIGH RISK)
5. Keep Phase 1 changes
6. Add ONLY:
   - All 4 agent files (demographics, household, interests, purchase)
7. **Test**: Run IAB classification with OpenAI
8. **Expected**: If FAIL ❌, culprit = email_numbers format change

### Phase 3: Batch Evidence Validation (MEDIUM RISK)
9. Keep Phase 1-2 changes
10. Add ONLY:
    - `evidence_judge.py` (batch validation function)
    - `analyzers.py` (switch to batch validation)
11. **Test**: Run IAB classification with OpenAI
12. **Expected**: If FAIL ❌, culprit = batch validation logic

### Phase 4: Context Window & State Validation (HIGH RISK)
13. Keep Phase 1-3 changes
14. Add ONLY:
    - `state.py` (fail-fast validation)
    - `executor.py` (context window fetching)
    - `llm_wrapper.py` (dynamic max_tokens)
15. **Test**: Run IAB classification with OpenAI
16. **Expected**: If FAIL ❌, culprit = context window logic or validation

### Phase 5: Remaining Changes (Dashboard, Memory, Tracking)
17. Keep Phase 1-4 changes
18. Add ALL remaining files (dashboard, memory, reconciliation, tracking)
19. **Test**: Run IAB classification with OpenAI
20. **Expected**: If FAIL ❌, culprit in non-critical files

---

## Testing Commands

### Test Command Template:
```bash
MEMORY_DATABASE_PATH=data/test_incremental_X.db \
TAXONOMY_MODEL=openai:gpt-4o-mini \
python -m src.email_parser.main \
  --iab-csv data/test_final_validation.csv \
  --iab-output data/profile_incremental_X.json \
  --user-id test_incremental_X \
  --force-reprocess \
  2>&1 | tee /tmp/test_incremental_X.log
```

### Success Criteria:
- Workflow completes without hanging
- All 4 agents execute (demographics → household → interests → purchase)
- Classifications saved to output JSON
- No TypeErrors or ValueErrors in log

### Failure Indicators:
- Workflow hangs between agents (HTTP requests stop)
- TypeError (wrong data type)
- ValueError (validation fails)
- KeyError (missing field in dict)
- Empty classifications in output JSON

---

## Root Cause Hypothesis

**Most Likely Culprit**: Phase 2 - Agent Prompt Changes

**Reasoning**:
1. Changed fundamental response format (`email_number` → `email_numbers`)
2. Affects all 4 agents (demographics, household, interests, purchase)
3. Parsing code downstream expects old format
4. User reported workflow "broken" after applying changes
5. Similar to previous issues where format mismatches caused silent failures

**Secondary Suspect**: Phase 4 - State Validation Fail-Fast

**Reasoning**:
1. Added hard requirement for `model_context_window`
2. If context window fetch fails silently in executor.py, workflow crashes
3. No graceful degradation to fallback batch size
4. Could explain immediate failure at workflow initialization

---

## Lessons Learned

1. **Never apply 32 files at once** - Apply changes incrementally to isolate breaking changes
2. **Test format changes immediately** - Response format changes (email_number → email_numbers) are HIGH RISK
3. **Fail-fast vs. graceful degradation** - REQUIRED validation (ValueError) breaks backward compatibility
4. **Document assumptions** - Batch validation assumes LLM follows ordering perfectly
5. **Git stash is dangerous** - Stashing 32 files makes debugging impossible when it breaks

---

## Next Steps

1. Execute incremental testing strategy (Phases 1-5)
2. Identify exact change that breaks workflow
3. Fix breaking change (add fallback, update parsing, revert format change)
4. Add regression test to prevent future breaks
5. Document fix in separate bugfix document

---

## References

- Commit b06274f: "Fix two critical bugs blocking provenance tracking" (baseline working state)
- Previous bug: BATCH_SIZE_BUG_FIX.md (TypeError in batch_optimizer.py)
- Workflow architecture: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md

---

## Test Results

### Phase 1: Google Provider Changes ✅ PASSED

**Timestamp**: 2025-10-10 17:01-17:02  
**Commit**: b06274f + Google provider changes only  
**Files Modified**:
- src/email_parser/utils/config.py (added "google" to valid providers)
- src/email_parser/llm_clients/google_client.py (implemented abstract methods)
- src/email_parser/llm_clients/model_registry.py (added Google models)

**Test Command**:
```bash
MEMORY_DATABASE_PATH=data/test_phase1_google.db \
TAXONOMY_MODEL=openai:gpt-4o-mini \
python -m src.email_parser.main \
  --iab-csv data/test_final_validation.csv \
  --iab-output data/profile_phase1_google.json \
  --user-id test_phase1 \
  --force-reprocess
```

**Result**: ✅ **PASSED** - Workflow completed successfully

**Evidence**:
- All 4 agents executed without hanging:
  - Demographics agent: 0 classifications
  - Household agent: 0 classifications (NO HANG - this was the original issue!)
  - Interests agent: 3 classifications
  - Purchase agent: 1 classification
- Profile generated at data/profile_phase1_google.json (1.5K)
- No TypeErrors, ValueErrors, or workflow hangs
- Process completed in ~72 seconds

**Conclusion**: Google provider support changes DO NOT break the workflow. Safe to keep.

**Next Step**: Proceed to Phase 2 - Test agent prompt changes (email_numbers format)

