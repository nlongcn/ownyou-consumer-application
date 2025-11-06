# Active Bugs - Email Parser

**Last Updated**: 2025-10-10 14:20 UTC
**Session**: Afternoon bug investigation

---

## Critical Bugs (Must Fix)

### 🔴 Bug #2: Batch Evidence Judge - Response Format Issues
**Status**: 🔧 IN PROGRESS
**Severity**: CRITICAL
**Frequency**: 30-50% of batch evidence calls
**Impact**: Batch validation fails → 20x slower processing

**Issue**: LLM returns unexpected response formats that aren't handled:
- `{'results': [...]}` instead of expected array or `{'evaluations': [...]}`
- Single dict for single-item batches instead of array
- `{'error': 'message'}` for failures (error message not logged)

**Files**:
- `src/email_parser/workflow/nodes/evidence_judge.py:556-576`

**Fix Status**:
- ✅ Single dict handling (completed earlier)
- ✅ Numeric keys conversion (completed earlier)
- 🔧 Add 'results' key handling (IN PROGRESS)

**Related**: `BATCH_EVIDENCE_JUDGE_BUG_FIX.md`, `BUG_INVESTIGATION_20251010_AFTERNOON.md`

---

### 🔴 Bug #3: Agent Tool Calling Confusion (ROOT CAUSE)
**Status**: 🔧 IN PROGRESS
**Severity**: CRITICAL
**Frequency**: 10-30% of agent calls
**Impact**: Household agent appears "not working", wasted API calls

**Issue**: System prompts say "Available Tools:" and list functions. `gpt-5-mini` interprets this as OpenAI function calling and tries to invoke tools instead of returning JSON classifications.

**Evidence**:
```json
{"tool": "search_household_taxonomy", "args": ["United Kingdom"]}
{"error":"Tool call not executed..."}
```

**Files**:
- `src/email_parser/agents/demographics_agent.py`
- `src/email_parser/agents/household_agent.py`
- `src/email_parser/agents/interests_agent.py`
- `src/email_parser/agents/purchase_agent.py`

**Fix**: Remove "Available Tools:" section, replace with clear "Return JSON only, no function calling" instruction

**Related**: This is the ROOT CAUSE of Bug #4

---

## High Priority Bugs

### 🟠 Bug #1: Cost Tracking Database Schema Missing
**Status**: 📋 PENDING
**Severity**: HIGH
**Frequency**: 100% (every LLM call)
**Impact**: Cannot track API spending

**Issue**: `Failed to record cost: no such table: cost_tracking`

**Files**:
- `src/email_parser/workflow/tracking.py`

**Fix**: Add cost_tracking table initialization in WorkflowTracker setup

---

## Medium Priority Bugs

### 🟡 Bug #4: Empty Classifications from Agents
**Status**: 📋 PENDING (Monitor after Bug #3 fix)
**Severity**: MEDIUM
**Frequency**: Common for sparse emails
**Impact**: Missing legitimate classifications

**Issue**: Agents return `{"classifications": []}` for emails with sparse content

**Root Cause**: Likely caused by Bug #3 (tool calling confusion) → Will monitor after fixing Bug #3

**Files**:
- `src/email_parser/agents/demographics_agent.py`
- `src/email_parser/agents/household_agent.py`

---

### 🟡 Bug #5: Missing Provenance Tracking
**Status**: 📋 PENDING
**Severity**: MEDIUM
**Frequency**: 100% of interests classifications
**Impact**: Cannot trace which email generated which classification

**Issue**: `Provenance tracked: 0/3 have email_id`

**Files**:
- `src/email_parser/workflow/nodes/analyzers.py` (interests agent section)

**Fix**: Debug email_numbers → email_ids mapping

---

## Bug Dependency Chain

```
Bug #3 (Tool Calling Confusion)
    ↓ causes
Bug #4 (Empty Classifications)
    ↓ particularly affects
Household Agent ("not working")
```

---

## Test Results

### Session: email_parser_20251010_135736.log
- **Duration**: 40 emails processed
- **Bug #1**: 100% occurrence (every LLM call)
- **Bug #2**: 1 occurrence (batch evidence judge)
- **Bug #3**: Multiple occurrences (tool calling attempts)
- **Bug #4**: Demographics and household agents returned empty
- **Bug #5**: All interests classifications missing provenance

### Session: email_parser_20251010_141744.log
- **Duration**: 20 emails (test interrupted)
- **Bug #1**: 12 occurrences
- **Bug #2**: 1 occurrence (`'results'` key)
- **Bug #3**: 2 occurrences (interests, purchase agents)
- **Bug #4**: Empty classifications from demographics, household
- **Bug #5**: Not checked

---

## Resolution Plan

### Phase 1: Critical Fixes (Now)
1. Fix Bug #2: Add 'results' key handling
2. Fix Bug #3: Remove tool calling prompts from all agents
3. Fix Bug #1: Initialize cost_tracking table

### Phase 2: Validation (Next)
4. Run 20-email test
5. Verify all bugs resolved in logs

### Phase 3: Monitor (After)
6. Monitor Bug #4 (may auto-resolve after Bug #3)
7. Debug Bug #5 (provenance tracking)

---

## Related Files

- `BATCH_EVIDENCE_JUDGE_BUG_FIX.md` - Original batch judge bug (numeric keys)
- `BUG_INVESTIGATION_20251010_AFTERNOON.md` - Detailed investigation of all 5 bugs
- `logs/email_parser_20251010_135736.log` - Primary bug discovery session
- `logs/email_parser_20251010_141744.log` - Validation session

---

## Status Legend
- 🔴 Critical - Must fix immediately
- 🟠 High - Fix soon
- 🟡 Medium - Fix when ready
- 📋 PENDING - Not started
- 🔧 IN PROGRESS - Currently working
- ✅ FIXED - Completed
- 👀 MONITORING - Waiting to verify
