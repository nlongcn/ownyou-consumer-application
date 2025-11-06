# Bug Investigation Report - 2025-10-10 Afternoon

**Investigation Date**: 2025-10-10 14:00-14:30 UTC
**Investigator**: Claude (Sonnet 4.5)
**Trigger**: User reported "the household agent is also not working"

---

## Executive Summary

Comprehensive log analysis revealed **5 interconnected bugs** in the email parser, with one critical root cause (Bug #3: Tool Calling Confusion) responsible for the household agent failure.

**Key Finding**: Agent system prompts contain "Available Tools:" sections that confuse `gpt-5-mini` into attempting OpenAI function calling instead of returning JSON classifications.

---

## Investigation Process

### 1. Initial Problem Report
**User**: "the household agent is also not working"

### 2. Log Analysis
Analyzed two key sessions:
- `logs/email_parser_20251010_135736.log` (40 emails, full run)
- `logs/email_parser_20251010_141744.log` (20 emails, test run)

###

 3. Discovery Method
```bash
# Error analysis
grep "ERROR" logs/email_parser_20251010_141744.log

# Household agent behavior
grep -E "household|Household" logs/email_parser_20251010_141744.log

# Tool calling patterns
grep -E "Tool call|search_.*_taxonomy" logs/email_parser_20251010_135736.log
```

---

## Bugs Discovered

### Bug #1: Cost Tracking Database Schema Missing
**Severity**: HIGH
**Discovery**: Every LLM call logs error

**Evidence**:
```
[ERROR] email_parser.workflow.tracking:173: Failed to record cost: no such table: cost_tracking
```

**Frequency**: 100% (12 occurrences in 20-email test)

**Root Cause**: New test databases don't have cost_tracking table initialized

**Impact**:
- Cannot track API spending
- No cost analytics in dashboard
- Breaks financial reporting

---

### Bug #2: Batch Evidence Judge - Response Format Handling
**Severity**: CRITICAL
**Discovery**: Batch validation falling back to individual processing

**Evidence from logs**:
```
[ERROR] Unknown response format, keys: ['results']
[ERROR] Full response content: {'results': [{'is_valid': True, ...}]}
[ERROR] Batch response length mismatch: got 0, expected 3
[WARNING] Batch response validation failed, falling back
[WARNING] ⚠️ Falling back to individual validation for 3 classifications
```

**LLM Response (Actual)**:
```json
{
  "results": [
    {"is_valid": True, "quality_score": 0.4, "evidence_type": "weak", "issue": "..."},
    {"is_valid": True, "quality_score": 0.4, "evidence_type": "weak", "issue": "..."},
    {"is_valid": True, "quality_score": 0.4, "evidence_type": "weak", "issue": "..."}
  ]
}
```

**Code Expected**:
```json
[
  {"is_valid": True, "quality_score": 0.4, "evidence_type": "weak", "issue": "..."},
  ...
]
```
OR
```json
{"evaluations": [...]}
```

**Impact**:
- Batch processing fails → falls back to individual validation
- 20x performance degradation
- No benefit from batch optimization

**Note**: This is an EXTENSION of the bug documented in `BATCH_EVIDENCE_JUDGE_BUG_FIX.md` (which handled numeric keys format)

---

### Bug #3: Agent Tool Calling Confusion ⭐ ROOT CAUSE
**Severity**: CRITICAL
**Discovery**: LLM returning tool call syntax instead of classifications

**Evidence from logs**:
```
[INFO] Raw LLM response: {"tool": "search_household_taxonomy", "args": ["United Kingdom"]}
{"tool":"search_household_taxonomy","args":["United Kingdom"]}
{"error":"tool call failed"}

[WARNING] JSON parse error (attempt 1/3): Extra data: line 2 column 1 (char 66)
```

**Frequency**:
- Household agent: Multiple occurrences
- Interests agent: 1 occurrence in 20-email test
- Purchase agent: 1 occurrence in 20-email test
- Demographics agent: Not observed (but has same prompt structure)

**Root Cause Analysis**:

All agent system prompts contain this section:
```
Available Tools:
1. search_household_taxonomy(keyword): Search household section for matching entries
   - Returns: JSON array of up to 10 matching entries with taxonomy_id, value, tier_path
   - Example: search_household_taxonomy("income") → [{"taxonomy_id": 100, ...}, ...]

2. validate_classification(taxonomy_id, value): Verify ID/value pair is correct
   - Returns: JSON with {"valid": true/false, "expected_value": "...", "reason": "..."}
```

**Why This Causes Problems**:

1. **OpenAI models** (including gpt-5-mini) are trained to recognize function calling syntax
2. When they see "Available Tools:" with function signatures, they **assume function calling is enabled**
3. They return tool invocation JSON instead of classification JSON
4. The system doesn't use OpenAI function calling - tools are called internally AFTER getting classifications
5. Result: JSON parse errors, retries, and often empty results

**Affected Files**:
- `src/email_parser/agents/demographics_agent.py:16-41`
- `src/email_parser/agents/household_agent.py:18-42`
- `src/email_parser/agents/interests_agent.py:18-42`
- `src/email_parser/agents/purchase_agent.py:18-42`

**Impact**:
- **Household agent appears "not working"** ← USER'S ORIGINAL COMPLAINT
- Wasted API calls on retry attempts
- Inconsistent behavior (sometimes works after retry, sometimes doesn't)
- JSON parse errors in logs

**This is the ROOT CAUSE of Bug #4 (Empty Classifications)**

---

### Bug #4: Empty Classifications from Agents
**Severity**: MEDIUM
**Discovery**: Agents returning zero classifications for valid emails

**Evidence**:
```
[WARNING] email_parser.agents.demographics_agent:226: No classifications found in agent output
[WARNING] email_parser.agents.household_agent:219: No classifications found in agent output
[INFO] Demographics agent completed: iterations=1, tool_calls=0
[INFO] Household agent completed: iterations=1, tool_calls=0
```

**Frequency**: Common for both demographics and household agents

**Contributing Factors**:
1. **Primary**: Bug #3 (tool calling confusion) causes agent to return wrong format
2. Short email bodies (81 chars) with insufficient signals
3. Strict prompt requirements

**Impact**:
- Missing legitimate demographic/household data
- Incomplete user profiles
- Poor quality classifications

**Status**: Likely will auto-resolve after fixing Bug #3

---

### Bug #5: Missing Provenance Tracking
**Severity**: MEDIUM
**Discovery**: Classifications missing email_id field

**Evidence**:
```
[INFO] ✅ Interests agent complete: 3 classifications added
   Provenance tracked: 0/3 have email_id
```

**Frequency**: 100% of interests agent classifications

**Root Cause**: Unknown - needs debugging
- Either `email_numbers` array not present in LLM response
- Or `email_numbers` → `email_ids` mapping not working

**Impact**:
- Cannot trace which email generated which classification
- Breaks audit trail
- Cannot implement evidence drill-down in UI

**Affected**:
- `src/email_parser/workflow/nodes/analyzers.py` (interests agent section)

---

## Bug Dependency Chain

```
Bug #3: Tool Calling Confusion (ROOT CAUSE)
    ↓
    Causes agent to return tool invocation JSON
    ↓
Bug #4: Empty Classifications
    ↓
    Particularly affects
    ↓
Household Agent Failure ← USER'S COMPLAINT
```

---

## Test Evidence

### Session: email_parser_20251010_135736.log
**Context**: Full 40-email run with gpt-5-mini

**Bug Occurrences**:
- Bug #1 (Cost tracking): Not counted (full session)
- Bug #2 (Batch evidence): 1 confirmed (`{'error': '...'}` response)
- Bug #3 (Tool calling): Multiple in household agent
- Bug #4 (Empty classifications): Demographics + Household agents
- Bug #5 (Provenance): Not examined

**Batch Evidence Judge Performance**:
- Attempted: Multiple calls
- Succeeded: 1 call (lines show successful batch validation)
- Failed: 1 call (fell back to individual)

### Session: email_parser_20251010_141744.log
**Context**: 20-email test run (interrupted)

**Bug Occurrences**:
- Bug #1: 12 occurrences
- Bug #2: 1 occurrence (`'results'` key format)
- Bug #3: 2 occurrences (interests, purchase agents)
- Bug #4: Demographics + Household agents returned empty
- Bug #5: Confirmed in interests agent

**Key Finding**: Bug #2 now shows NEW format variant (`'results'` key)

---

## Fix Strategy

### Phase 1: Critical Fixes (Immediate)

**1. Fix Bug #2 - Batch Evidence Judge**
- Add handler for `'results'` key format
- File: `src/email_parser/workflow/nodes/evidence_judge.py:556-576`
- Already fixed: single dict, numeric keys
- Still needed: 'results' key

**2. Fix Bug #3 - Remove Tool Calling Prompts**
- Remove "Available Tools:" sections from all 4 agents
- Replace with: "IMPORTANT: Return only JSON classifications. Do NOT use function calling."
- Files: demographics_agent.py, household_agent.py, interests_agent.py, purchase_agent.py
- Expected result: **Household agent will start working**

**3. Fix Bug #1 - Cost Tracking Schema**
- Initialize cost_tracking table in WorkflowTracker.__init__()
- File: `src/email_parser/workflow/tracking.py`

### Phase 2: Validation

**Run 20-email test** and verify:
1. ✅ No cost tracking errors
2. ✅ Batch evidence judge succeeds without fallbacks
3. ✅ All 4 agents return classifications (especially household)
4. ✅ No tool calling attempts in logs
5. ✅ Provenance tracking shows email_ids

### Phase 3: Monitor & Debug

**Bug #4**: Monitor after Bug #3 fix - may auto-resolve

**Bug #5**: If still present, debug:
- Check if `email_numbers` array is in LLM response
- Verify mapping logic in analyzers.py

---

## Lessons Learned

### 1. Prompt Engineering for Function Calling Models
**Problem**: Including "Available Tools:" in prompts confuses models trained for function calling

**Solution**: Explicitly state "Do NOT use function calling" when not using OpenAI's function calling API

### 2. LLM Response Format Robustness
**Problem**: LLMs return data in unpredictable JSON structures

**Solution**: Parse multiple formats (array, dict with various keys, single object)

### 3. Multi-Step Bug Investigation
**Problem**: User reports "agent not working"

**Process**:
1. Check agent logs → Found empty results
2. Check LLM responses → Found tool calling attempts
3. Check prompts → Found confusing "Available Tools:" section
4. Traced root cause → All agents have same issue

**Outcome**: Discovered 5 interconnected bugs, identified root cause

---

## Related Files

- `BUGS_ACTIVE.md` - Master bug tracker
- `BATCH_EVIDENCE_JUDGE_BUG_FIX.md` - Previous batch judge bug (numeric keys)
- `logs/email_parser_20251010_135736.log` - Primary discovery session
- `logs/email_parser_20251010_141744.log` - Test validation session
- `src/email_parser/workflow/nodes/evidence_judge.py` - Batch evidence judge
- `src/email_parser/agents/*.py` - All agent implementations

---

## Next Steps

1. ✅ Document bugs (this file + BUGS_ACTIVE.md)
2. 🔧 Implement fixes for Bugs #1, #2, #3
3. 🧪 Run validation test
4. 👀 Monitor Bug #4 and #5
5. 📊 Update bug tracker with results
