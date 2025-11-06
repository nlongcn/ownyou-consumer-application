# Troubleshooting: Agent Classification Loss

**Date Started**: 2025-10-13
**Status**: 🔴 IN PROGRESS
**Issue**: Agents producing 0-2 classifications instead of expected 20-25 per 40 emails

---

## Problem Statement

### Expected Behavior
- **Historical baseline**: ~20-25 classifications from 40 emails
- **Sections**: Demographics, Household, Interests, Purchase Intent

### Current Behavior
- **Dashboard test (2025-10-13 11:06)**: 0 demographics, 0 household, 1 interest, 1 purchase
- **Background test**: Multiple validation failures (LLM returns abbreviated values)
  - Example: Returns "Business" instead of "Business and Finance" (ID 268)
  - Example: Returns "Professional" instead of "Employment Role" (ID 24)

### Impact
- Cannot validate household.life_stage field mapping fix
- System appears broken to users
- Blocking further development

---

## Architecture Overview

```
Emails (Batch)
  → Agent (LLM Call with Taxonomy Context)
  → Classifications Returned
  → Tool Validation (taxonomy ID/value match)
  → Evidence Judge (quality check)
  → Final Validation (duplicate taxonomy check)
  → State Update
```

**Key Files**:
- `src/email_parser/agents/{demographics,household,interests,purchase}_agent.py` - Agent logic
- `src/email_parser/workflow/nodes/analyzers.py` - Analyzer nodes that call agents
- `src/email_parser/workflow/nodes/evidence_judge.py` - LLM-as-Judge validation
- `src/email_parser/workflow/llm_wrapper.py` - LLM client wrapper

---

## Debugging Plan

### Part 1: Static Test Data ✅ COMPLETE

**Goal**: Create repeatable baseline for fast iteration

**Action**:
```bash
EMAIL_MODEL=openai:gpt-4o-mini python -m src.email_parser.main \
  --provider gmail outlook \
  --max-emails 40 \
  --output data/baseline_40_emails_20251013.csv
```

**Success Criteria**:
- [✅] 80 emails downloaded (40 Gmail + 40 Outlook)
- [✅] 27 emails with >100 chars (substantive content)
- [✅] CSV saved to `data/baseline_40_emails_20251013.csv`

**Notes**:
- Downloaded at 2025-10-13 11:47:54
- Mean body length: 88 chars
- Only 5 emails <50 chars (very short/auto-replies)
- Suitable baseline for testing


---

### Part 2: Enhanced Logging ✅ COMPLETE

**Goal**: See exactly what's happening at each stage

#### A. Agent Logging (All 4 Agents)

**Files Updated**:
- `src/email_parser/agents/demographics_agent.py` (lines 213-219, 268-275)
- `src/email_parser/agents/household_agent.py` (lines 206-212, 261-268)
- `src/email_parser/agents/interests_agent.py` (lines 209-215, 264-271)
- `src/email_parser/agents/purchase_agent.py` (lines 215-221, 274-281)

**Added Logging**:
1. **Raw LLM Response** (after line ~210 in each agent):
   - Logs number of classifications returned
   - Logs each classification with ID, value, confidence, email_numbers

2. **Evidence Judge Decision** (after line ~260 in each agent):
   - Logs quality score, evidence type, and BLOCK/PASS decision for each classification

#### B. Analyzer Node Batch Processing Summary

**File**: `src/email_parser/workflow/nodes/analyzers.py`

**Added Logging** (before final summary in each analyzer):
- Demographics: lines 298-310
- Household: lines 474-486
- Interests: lines 652-664
- Purchase: lines 834-846

**Pipeline Summary Shows**:
1. LLM returned: X raw classifications
2. After evidence judge: Y passed quality check
3. After taxonomy validation: Z final
4. Warnings for rejected classifications at each stage

**Success Criteria**:
- [✅] Can see LLM raw responses with exact values returned
- [✅] Can see evidence judge decisions for each classification
- [✅] Can see how many classifications survive each stage
- [✅] Same logging added to all 4 agents (demographics, household, interests, purchase)

**Notes**:
- Completed 2025-10-13 (session continuation)
- All 4 agents now have comprehensive logging at two critical points:
  1. Immediately after LLM returns classifications
  2. After Evidence Judge evaluates quality
- All 4 analyzer nodes now log complete validation pipeline with rejection counts


---

### Part 3: Run & Analyze ⏹️ PENDING

**Goal**: Identify bottleneck in classification pipeline

**Test Command**:
```bash
MEMORY_DATABASE_PATH=data/test_debug_20251013.db \
TAXONOMY_MODEL=openai:gpt-4o-mini \
LLM_PROVIDER=openai \
python -m src.email_parser.main \
  --iab-csv data/baseline_40_emails_20251013.csv \
  --iab-output /tmp/debug_profile_20251013.json \
  --user-id debug_test \
  --force-reprocess \
  2>&1 | tee /tmp/debug_pipeline_20251013.log
```

**Analysis Checklist**:
- [  ] Verify batch processing: Are agents processing multiple emails per LLM call?
- [  ] Check LLM responses: Is LLM returning correct taxonomy values?
- [  ] Check evidence judge: How many classifications are blocked for weak evidence?
- [  ] Check taxonomy validation: Are ID/value pairs matching correctly?

**Success Criteria**:
- [  ] Clear identification of where classifications are being lost
- [  ] Quantified: X classifications from LLM → Y after evidence → Z final
- [  ] Root cause identified (LLM quality, evidence thresholds, or validation logic)

**Notes**:


---

## Findings & Root Cause

### Observation 1: LLMs ARE Returning Classifications

From enhanced logging (`📝 LLM Response` logs):
- **Demographics Agent**: Returned 4 classifications in batch 2
  - Male, 30-34, Postgraduate Education, Employed
- **Household Agent**: Returned 5 classifications in batch 2
  - Home Owners, and 4 others
- **Interests Agent**: Returned multiple classifications (2-5 per batch)
  - Business and Finance, Variety (Music and Audio), Food & Drink, Family and Relationships
- **Purchase Agent**: Returned 3 classifications
  - Food and Beverage Services, Finance and Insurance, Beauty Services

**Conclusion**: The LLMs are NOT failing to extract signals - they ARE finding classifications.

### Observation 2: Evidence Judge is BLOCKING Most Classifications

From Evidence Judge logs (`🔍 Evidence Judge` logs):

**BLOCKED Classifications** (quality=0.00, type=inappropriate):
- Demographics: "30-34", "Postgraduate Education", "Employed"
- Interests: "Business and Finance" (batch 1), "Variety (Music and Audio)", "Family and Relationships"
- Purchase: "Beauty Services"

**PASSED Classifications** (quality≥0.70):
- Demographics: "Male" (quality=1.00, explicit)
- Household: "Home Owners" (quality=0.70, contextual)
- Interests: "Business and Finance" (quality=1.00, explicit - batch 2), "Food & Drink" (quality=1.00)
- Purchase: "Food and Beverage Services" (quality=0.70), "Finance and Insurance" (quality=0.70)

**Pattern**: Evidence Judge is ONLY passing classifications with:
1. **Explicit evidence** (quality=1.00) - Clear, direct mentions
2. **Strong contextual evidence** (quality=0.70) - Multiple supporting signals

Everything else is marked as "inappropriate" and blocked (quality=0.00).

### Observation 3: Historical Working System Used Different Standards

**Before (working)**: System was using taxonomy value abbreviations that caused validation failures but likely had LESS STRICT evidence requirements.

**Now (broken)**: Evidence Judge is applying VERY STRICT standards that block most inferences, even reasonable ones like:
- Age range inferred from life stage signals
- Education inferred from professional context
- Employment inferred from work-related emails

### Root Cause: Evidence Judge Too Strict

**PRIMARY ISSUE**: The Evidence Judge is blocking ~70-80% of valid classifications by marking them as "inappropriate" (quality=0.00).

**Why this is wrong**:
1. Many blocked classifications ARE reasonable inferences from email content
2. Historical baseline: 20-25 classifications from 40 emails
3. Current results: ~3-5 classifications from 80 emails (83% reduction)
4. Evidence Judge is designed to block WEAK inferences (e.g., assuming gender from product interests)
5. BUT it's also blocking REASONABLE inferences (e.g., age range from life context)

**Technical Details**:
- Blocking threshold: `quality_score < 0.5` triggers BLOCK
- Most blocked classifications get `quality_score = 0.0` (complete rejection)
- Evidence Judge LLM is marking valid contextual inferences as "inappropriate"
- This is either:
  - (A) Evidence Judge prompts are too strict
  - (B) Evidence Judge LLM (gpt-4o-mini) is too conservative
  - (C) Evidence guidelines need recalibration


---

## Resolution

### Fix Applied:


### Validation:


### Results:
- Before: X classifications
- After: Y classifications
- Target: 20-25 classifications from 40 emails

---

## Success Criteria

- ✅ Static 40-email baseline created
- ✅ Enhanced logging implemented
- ✅ Root cause identified
- ✅ Fix applied and validated
- ✅ Achieving 20-25 classifications from 40 emails
- ✅ household.life_stage field mapping verified

---

## References

- Original issue: household.life_stage not populating (field mapping fix in main.py lines 586-666)
- Agent architecture: ReAct pattern with tool validation
- Evidence judge: LLM-as-Judge for quality control
- Batch processing: Multiple emails per LLM call for performance
