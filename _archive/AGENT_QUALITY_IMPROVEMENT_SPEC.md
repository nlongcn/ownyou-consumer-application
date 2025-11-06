# Agent Quality & Performance Improvement Specification

**Date:** 2025-10-13
**Status:** Draft
**Target Release:** Immediate

## Executive Summary

Performance analysis of the IAB Classification pipeline (Step 3) revealed critical issues causing 48-minute processing time for 159 emails (target: 5-8 minutes) and poor classification quality (e.g., "Unknown Gender" for user named "William"). This spec addresses root causes and provides systematic improvements.

## Problem Statement

### Performance Issues
- **Actual:** 48.4 minutes for 159 emails (18.3s/email average)
- **Target:** 5-8 minutes for 159 emails (2-3s/email average)
- **Gap:** 6-10x slower than target

### Quality Issues
1. **Agent Hallucination:** Citing non-existent emails (e.g., "Email 12" when only 2 emails in context)
2. **Inappropriate Gender Inference:** Using names for gender classification (privacy concern)
3. **Evidence Judge Overhead:** 35+ blocks in single run, each taking 10-30 seconds
4. **Excessive Reflections:** 18 reflection loops across 4 batches (should be ~0-4)

## Root Cause Analysis

### 1. Email Body vs Summary (CRITICAL)
**Problem:** Agents may be receiving full email bodies instead of summaries
**Evidence:** Log shows `body_len=133` in context, should be using summaries
**Impact:** Privacy violation, bloated context, slower processing

### 2. Agent Hallucination
**Problem:** Agents citing "Email 12" when only emails 1-2 provided in context
**Root Cause:** Batch context window management issue or agent confabulation
**Impact:** Invalid classifications, evidence judge blocks, wasted iterations

### 3. Evidence Judge as Bottleneck
**Problem:** Each classification validated serially, 10-30s per call
**Evidence:** 35 blocks/warnings × 20s average = 11.7 minutes wasted
**Impact:** Major performance bottleneck

### 4. Gender Classification Policy
**Problem:** Using names for gender inference violates privacy guidelines
**User Feedback:** "William" is user's son's name, not evidence of user's gender
**Impact:** Incorrect classifications, privacy concerns

## Improvement Plan

### Phase 1: Critical Fixes (Est. 2 hours)

#### 1.1 Use Email Summaries, Not Bodies
**Priority:** P0 (Privacy & Performance)

**Files to Modify:**
- `src/email_parser/workflow/nodes/load_emails.py` (lines 50-80)
- All 4 agent files (demographics, household, interests, purchase)

**Changes:**
1. Verify `load_emails` node passes `summary` field to agents
2. Update agent prompts to explicitly state "use email summaries only"
3. Add validation: reject if `body` field present in agent context
4. Log context structure for verification

**Acceptance Criteria:**
- Agent logs show `summary_len=X` not `body_len=X`
- No raw email bodies in agent context
- Classification evidence cites summaries explicitly

#### 1.2 Fix Agent Hallucination
**Priority:** P0 (Quality)

**Root Cause Hypothesis:**
- Agents seeing email IDs but not full context
- LLM confabulating evidence from training data

**Changes:**
1. Add explicit email ID list to agent prompt: "You have access to emails: [1, 2, 5, 7]. Do NOT cite any other email IDs."
2. Add validation tool: `verify_email_exists(email_id)` before using evidence
3. Evidence judge checks: cited email ID must exist in provided context

**Acceptance Criteria:**
- No citations to non-existent emails
- Evidence judge catches any hallucinations before storage

#### 1.3 Remove Name-Based Gender Classification
**Priority:** P0 (Privacy)

**Changes:**
1. Update demographics agent prompt:
   - Remove name-based gender examples
   - Add explicit prohibition: "Do NOT infer gender from names in sender/recipient fields"
   - Valid evidence: pronouns, self-identification, explicit statements only

2. Update evidence judge for gender:
   - Auto-block any gender classification citing name evidence
   - Require pronoun usage or explicit self-identification

**Acceptance Criteria:**
- No gender classifications based on names
- "Unknown Gender" becomes valid classification when no pronoun evidence exists

### Phase 2: Performance Optimizations (Est. 3 hours)

#### 2.1 Parallel Evidence Judge Processing
**Priority:** P1 (Performance)

**Current:** Serial processing (4 classifications × 20s = 80s)
**Target:** Parallel processing (max(20s) = 20s)

**Implementation:**
```python
# In demographics_agent.py, household_agent.py, etc.
# After agent returns all classifications
async def validate_in_parallel(classifications):
    tasks = [
        asyncio.create_task(evidence_judge.validate(c))
        for c in classifications
    ]
    return await asyncio.gather(*tasks)
```

**Files to Modify:**
- All 4 agent files
- `evidence_judge.py` (ensure async-safe)

**Acceptance Criteria:**
- 4 evidence judge calls complete in ~20-30s (not 80-120s)
- No race conditions or validation errors

#### 2.2 Evidence Judge Caching
**Priority:** P1 (Performance)

**Problem:** Same classification+context validated multiple times across batches

**Implementation:**
- Cache key: `hash(taxonomy_id + value + email_context_summary)`
- TTL: Session lifetime
- Storage: In-memory dict

**Acceptance Criteria:**
- 30-50% reduction in evidence judge calls
- No cache misses for identical contexts

#### 2.3 Reduce Agent Reflection Loops
**Priority:** P1 (Performance)

**Changes:**
1. Improve initial prompts to reduce validation failures
2. Add few-shot examples showing correct taxonomy ID selection
3. Early exit: If 2 reflections fail, accept best-effort result instead of iterating to max

**Acceptance Criteria:**
- <5 total reflections across all batches (down from 18)
- Agent converges in 1-2 iterations typically

### Phase 3: Context Window Optimization (Est. 2 hours)

#### 3.1 Limit Email Context Growth
**Priority:** P2 (Performance)

**Problem:** Context grows from 251 chars (1 email) to 11,194 chars (20+ emails)

**Changes:**
- Cap email context to most recent 10 emails for evidence judge
- Use summarized evidence snippets instead of full summaries

**Acceptance Criteria:**
- Evidence judge context never exceeds 3,000 chars
- No quality degradation from reduced context

#### 3.2 Optimize Agent Prompts
**Priority:** P2 (Quality & Performance)

**Changes:**
1. Remove redundant taxonomy examples (reduce prompt by ~30%)
2. Add targeted few-shot examples for common categories
3. Consolidate evidence guidelines into concise checklist

**Acceptance Criteria:**
- Prompt size reduced by 1,000-1,500 chars
- No quality degradation
- Faster LLM response times (fewer input tokens)

## Testing Strategy

### Per-Phase Testing

**After Each Phase:**
1. Run pipeline with test CSV (20 emails)
2. Measure timing breakdown:
   - Total time
   - Evidence judge time
   - Agent iteration count
   - Reflection count
3. Check log for:
   - Hallucination patterns
   - Privacy violations (name-based gender)
   - Context structure (summary vs body)

### Final E2E Testing

**Test Suite:**
1. **CLI Test:** Process 40 real emails with timing
2. **Dashboard Test:** Upload CSV → Run Step 3 → Validate output
3. **Playwright Test:** Full UI workflow with assertions

**Success Criteria:**
- 40 emails processed in <5 minutes
- Zero hallucinated evidence
- Zero name-based gender classifications
- Zero privacy violations (no raw bodies in agent context)
- Dashboard shows correct classifications

## Performance Targets

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| **Total Time (159 emails)** | 48.4 min | 5-8 min | All phases |
| **Time per Email** | 18.3s | 2-3s | All phases |
| **Evidence Judge Time** | ~12 min | ~2 min | Parallel + Cache |
| **Agent Reflections** | 18 loops | <5 loops | Better prompts |
| **Evidence Judge Calls** | 35+ | <20 | Caching |
| **Hallucinated Citations** | 3+ | 0 | Validation |
| **Name-Based Gender** | Multiple | 0 | Prompt change |

## Risk Assessment

### High Risk
- **Parallel Evidence Judge:** Potential race conditions
  - Mitigation: Thorough async testing, add locks if needed

### Medium Risk
- **Caching:** False positives from collisions
  - Mitigation: Include enough context in cache key

### Low Risk
- **Prompt Changes:** May affect classification accuracy
  - Mitigation: A/B test with existing baseline

## Implementation Order

1. **Phase 1.1** - Email summaries (CRITICAL for privacy)
2. **Phase 1.3** - Gender classification policy (CRITICAL for privacy)
3. **Phase 1.2** - Agent hallucination fix (HIGH impact on quality)
4. **Phase 2.1** - Parallel evidence judge (HIGH impact on performance)
5. **Phase 2.2** - Evidence judge caching (MEDIUM impact)
6. **Phase 2.3** - Reduce reflections (MEDIUM impact)
7. **Phase 3.1** - Context window limits (LOW impact)
8. **Phase 3.2** - Prompt optimization (LOW impact)

## Rollback Plan

- Keep current code in git branch `before-agent-improvements`
- Each phase committed separately for granular rollback
- If quality degrades >10%, rollback phase and reassess

## Success Metrics

**Must Have (P0):**
- ✅ No raw email bodies in agent context
- ✅ No gender classification from names
- ✅ Zero hallucinated email citations

**Should Have (P1):**
- ✅ 5-8 minute processing time for 159 emails
- ✅ <5 agent reflection loops per run
- ✅ Evidence judge caching working

**Nice to Have (P2):**
- ✅ Prompt size reduced 30%
- ✅ Context window capped at 3K chars

## Appendix: Log Analysis Summary

### Batch Performance Breakdown
- Batch 1 (emails 1-50): 4.2 min (5.0s/email) ✅
- Batch 2 (emails 51-100): 11.7 min (14.1s/email) ⚠️
- Batch 3 (emails 101-150): 13.3 min (16.0s/email) ⚠️
- Batch 4 (emails 151-158): 11.3 min (84.5s/email) 🔴
- Final (email 159): 8.0 min (477s/email) 🔴

### Evidence Judge Blocks
- Total: 35 blocks/warnings
- Avg time per call: ~20 seconds
- Total wasted time: ~11.7 minutes
- Primary causes: Hallucinated evidence, name-based gender

### Agent Iteration Breakdown
- Total iterations: 24 (should be 16 baseline)
- Reflection loops: 18
- Avg iterations per agent: 1.5x (should be 1.0-1.1x)
