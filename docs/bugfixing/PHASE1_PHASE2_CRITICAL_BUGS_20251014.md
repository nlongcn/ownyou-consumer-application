# Phase 1 & Phase 2 Critical Bugs - October 14, 2025

**Created**: 2025-10-14
**Status**: In Progress
**Test Run**: phase1_test user, 40 emails processed
**Dashboard Session**: Playwright MCP E2E test

## Executive Summary

Three critical bugs were discovered during E2E testing of Phase 1 & Phase 2 optimizations through the dashboard:

1. **Bug #1 (CRITICAL)**: Only 3 classifications from 40 emails (expected 20-30) - 90% data loss
2. **Bug #2 (HIGH)**: Analytics dashboard showing incorrect metrics (wrong counts, epoch timestamps)
3. **Bug #3 (MEDIUM)**: Extension categories displaying placeholder names instead of actual values

All bugs are now root-cause analyzed and ready for fixes.

---

## Bug #1: Evidence Judge Context Truncation (CRITICAL)

### Description
Only 3 classifications generated from 40 emails when 20-30 are expected. Evidence judge rejects 90%+ of valid classifications as "hallucinations".

### Impact
- **Severity**: CRITICAL - Blocks 90% of valid classifications
- **Affected**: All 4 agents (Demographics, Household, Interests, Purchase Intent)
- **User Experience**: Essentially broken - users get almost no useful profile data

### Root Cause

**Location**: `src/email_parser/workflow/nodes/evidence_judge.py:71`

```python
## Email Context:
{email_context[:500]}...
```

The evidence judge only receives **first 500 characters** of email context in validation prompt. With batch processing of 40 emails:
- Full email context: ~50,000+ characters (40 emails × ~1,250 chars each)
- Evidence judge sees: **500 characters** (only ~2 emails)
- Agent references: Emails 3, 8, 12, 13, 14, 17, 19 in reasoning
- Evidence judge verdict: **"Hallucination - emails not in context"**

### Evidence from Logs

**File**: `logs/email_parser_20251014_100358.log`

```
2025-10-14 10:10:32,224 Evidence judge: Business Accounting & Finance → inappropriate (quality=0.00)
Issue: "The reasoning cites many specific emails (Email 3, 8, 12, 13, 14, 17, 19)
that are not present in the provided Email Context (only Email 1 and Email 2 are shown)"

2025-10-14 10:10:40,211 Interests evidence validation: 2 → 0 after quality check
2025-10-14 10:10:40,216 ✅ Interests agent complete: 0 classifications added
```

The agent correctly identified "Business Accounting & Finance" from finance research emails across the batch, but the evidence judge rejected it because it couldn't see those emails.

### Database Verification

```sql
sqlite3 data/email_parser_memory.db "SELECT COUNT(*) FROM classification_history WHERE user_id='phase1_test';"
-- Result: 3 classifications (taxonomy_ids: 52, 55, 1383)
```

Only 3 classifications stored despite processing 40 emails. Expected: 20-30 classifications.

### Affected Code Paths

1. **Demographics agent** (analyzers.py:236-241)
2. **Household agent** (analyzers.py:126-131)
3. **Interests agent** (analyzers.py:307-312)
4. **Purchase Intent agent** (analyzers.py:488-493)

All build full email context string but evidence judge truncates to 500 chars.

### Fix Plan

**Option 1: Remove Truncation (Recommended)**
- Remove `[:500]` limit from evidence_judge.py:71
- Evidence judge gets full email context (up to model's context window)
- Pro: Simple fix, complete context for validation
- Con: Increases token usage for evidence validation

**Option 2: Batch-Aware Evidence Judge**
- Track which email_ids agent references in reasoning
- Only include referenced emails in context (not all 40)
- Pro: Reduces token usage while maintaining accuracy
- Con: More complex implementation

**Recommendation**: Option 1 for immediate fix, Option 2 for future optimization.

### Test Plan

1. Remove `[:500]` truncation from evidence_judge.py:71
2. Re-run analysis on test_final_validation.csv (40 emails)
3. Verify classifications increase from 3 → 20-30
4. Check logs show evidence judge accepting valid classifications
5. Verify all 4 agents contributing classifications

### Status
- [x] Root cause identified
- [x] Fix implemented (removed [:500] truncation from evidence_judge.py:71)
- [~] Tests **partially passed** - evidence judge now sees full context BUT revealed additional bugs
- [ ] Deployed

### Test Results (PARTIAL SUCCESS)

**Test Configuration**: 40 emails, fresh database, Bug #1 fix applied

**Results**:
- **Before Fix**: 3 classifications (90% blocked by truncation)
- **After Fix**: 4 classifications (still low, but different reasons)

**Root Cause Update**: Fixing evidence judge truncation revealed **TWO ADDITIONAL CRITICAL BUGS**:

#### Additional Bug #1A: Agent Taxonomy ID Errors
**Interests agent returning WRONG taxonomy IDs:**
```
Validation failed: taxonomy_id=520, provided='Cryptocurrency', expected='Variety (Music and Audio)'
```

Agent searches for "Cryptocurrency" but returns taxonomy_id=520 which is actually "Variety (Music and Audio)". This suggests:
- Taxonomy search tools returning incorrect IDs
- Agent not validating taxonomy_id matches the value

**Impact**: All Interests classifications rejected (0 stored)

#### Additional Bug #1B: Agent Value Formatting Mismatches
**Household agent formatting doesn't match taxonomy:**
```
Validation failed: taxonomy_id=66, provided='$50,000-$74,999', expected='$50000 - $74999'
```

Agent returns formatted currency with commas but taxonomy expects no commas and spaces around hyphen.

**Impact**: Household income classifications rejected (0 stored)

### Conclusion
Bug #1 fix (evidence judge truncation) is **working correctly** - evidence judge now receives full email context. However, this revealed that agents have **fundamental issues with taxonomy lookup and value formatting** that must be fixed separately.

### Fix Implementation (2025-10-14)

**File Modified**: `src/email_parser/workflow/nodes/evidence_judge.py:71`

**Change**:
```python
# BEFORE:
## Email Context:
{email_context[:500]}...

# AFTER:
## Email Context:
{email_context}
```

Evidence judge now receives full email context (up to model's context window) for proper validation of batch processing results.

---

## Bug #2: Analytics Dashboard Data Issues (HIGH)

### Description
Analytics dashboard displays incorrect metrics:
- **Total Emails**: Shows 1 (should be 40)
- **Analysis Runs**: Shows 2 (correct but missing metadata)
- **Timestamps**: Shows "01/01/1970" Unix epoch (should show actual run time)
- **Latest Run**: Shows "0 emails" despite processing 40

### Impact
- **Severity**: HIGH - Dashboard shows meaningless data
- **User Experience**: Cannot track costs or processing history
- **Business Value**: Analytics feature essentially non-functional

### Root Cause Analysis

#### Issue 2A: Missing Run Metadata

**Location**: `dashboard/backend/db/queries.py:513-565` (save_analysis_run)

**Database Evidence**:
```sql
SELECT * FROM analysis_runs WHERE user_id='phase1_test' ORDER BY run_date DESC LIMIT 2;

-- Result:
phase1_test_2025-10-14T09:13:05.077825|phase1_test|...|2|3|0||546.516753|completed|...||||
                                                        ↑ emails_processed=2 (wrong!)
                                                                                    ↑↑↑↑ NULL started_at/completed_at

phase1_test_2025-10-14T09:02:27.008282|phase1_test|...|0|19|0|0.0|640.736858|completed|...|both|openai:gpt-5-mini|2025-10-14T09:02:27.008282|2025-10-14T09:13:07.745140
```

**Problems**:
1. Latest run shows `emails_processed=2` instead of 40
2. Latest run has NULL values for `started_at`, `completed_at`, `provider`, `model`
3. Earlier run shows `emails_processed=0` despite adding 19 classifications

**Cause**: The analysis run metadata is not being saved correctly after workflow completion. The save_analysis_run() function is being called but not with correct parameters.

#### Issue 2B: Incorrect Total Emails Count

**Location**: `dashboard/backend/db/queries.py:401-408` (get_total_cost)

```python
# Get unique email count from episodic memories (actual emails in user's profile)
namespace = f"{user_id}/iab_taxonomy_profile"
cursor.execute("""
    SELECT COUNT(DISTINCT key) as email_count
    FROM memories
    WHERE namespace = ? AND key LIKE 'episodic_%'
""", (namespace,))
```

**Database Evidence**:
```sql
SELECT COUNT(*) FROM memories WHERE namespace='phase1_test/iab_taxonomy_profile' AND key LIKE 'episodic_%';
-- Result: 1
```

**Problem**: The query counts episodic memories (individual email observations) but the system may not be creating episodic memories for every email processed. The count should come from `analysis_runs.emails_processed` instead.

#### Issue 2C: Unix Epoch Timestamps (01/01/1970)

**Location**: `dashboard/frontend/app/analytics/page.tsx:231`

```typescript
<p className="text-xs text-muted-foreground">
  {new Date(run.started_at).toLocaleString()}
</p>
```

**Cause**: When `started_at` is NULL in database, JavaScript's `new Date(null)` returns invalid date, which displays as Unix epoch (January 1, 1970).

### Affected Components

1. **Backend**: Analysis run tracking not saving complete metadata
2. **Database**: analysis_runs table has incomplete data
3. **Frontend**: Displaying NULL timestamps as epoch zero
4. **Cost Tracking**: Likely affected (total_cost=0.0 in runs)

### Fix Plan

#### Fix 2A: Correct Analysis Run Tracking

**File**: `src/email_parser/workflow/nodes/load_emails.py` or workflow runner

1. Capture `started_at` timestamp at workflow start
2. Track actual `emails_processed` count (from batch_email_ids)
3. Capture `completed_at` timestamp at workflow end
4. Pass correct `provider` and `model` to save_analysis_run()
5. Ensure save_analysis_run() is called AFTER all batches complete

**Code Location to Modify**: Likely in workflow execution loop that calls save_analysis_run()

#### Fix 2B: Correct Total Emails Calculation

**File**: `dashboard/backend/db/queries.py:401-408`

**Option 1**: Sum emails_processed from analysis_runs
```python
cursor.execute("""
    SELECT SUM(emails_processed) as email_count
    FROM analysis_runs
    WHERE user_id = ?
""", (user_id,))
```

**Option 2**: Keep episodic approach but fix episodic memory creation
- Ensure every processed email creates an episodic memory
- Check that episodic memories are being created during workflow

**Recommendation**: Option 1 (use analysis_runs) for consistency with dashboard display.

#### Fix 2C: Handle NULL Timestamps

**File**: `dashboard/frontend/app/analytics/page.tsx:231`

```typescript
<p className="text-xs text-muted-foreground">
  {run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}
</p>
```

Add NULL checks before creating Date objects.

### Test Plan

1. Run full analysis with new metadata tracking
2. Verify analysis_runs table has complete data:
   - Correct emails_processed count
   - Valid started_at/completed_at timestamps
   - Provider and model populated
3. Check dashboard displays correct counts and timestamps
4. Verify cost tracking calculations are correct

### Status
- [x] Root cause identified
- [ ] Fix implemented (Fix 2A)
- [ ] Fix implemented (Fix 2B)
- [ ] Fix implemented (Fix 2C)
- [ ] Tests passed
- [ ] Deployed

---

## Bug #3: Extension Category Display (MEDIUM)

### Description
Classifications with asterisk placeholders (e.g., `*Country Extension`, `*Language`) display the placeholder name instead of the actual value extracted from reasoning.

**Expected**: "United Kingdom"
**Actual**: "Country Extension"

### Impact
- **Severity**: MEDIUM - Data is captured but displayed incorrectly
- **User Experience**: Confusing, looks like placeholder wasn't filled in
- **Data Quality**: Actual values are in reasoning field but not in value field

### Root Cause Analysis

**Evidence from Database**:
```json
{
  "taxonomy_id": 55,
  "tier_4": "*Country Extension",
  "value": "Country Extension",  // ← Should be "United Kingdom"
  "reasoning": "Multiple emails originate from UK organisations and reference UK locations:
                Telegraph newsletters (Emails 1, 16), Elmbridge Borough Council planning alerts
                (Emails 7 and 9)... collectively indicate the user is located in the United Kingdom."
}
```

The reasoning contains "United Kingdom" but the value field stores "Country Extension".

**Code Analysis**: `src/email_parser/workflow/nodes/analyzers.py:293-297`

```python
# Determine which value to use:
# - For asterisk placeholders (e.g., "*Country Extension"), use LLM's actual value
# - For non-asterisk entries, use taxonomy value as source of truth
taxonomy_value = get_taxonomy_value(taxonomy_entry)
final_value = llm_value if taxonomy_value.startswith("*") else taxonomy_value
```

The analyzer correctly checks for asterisk and uses `llm_value`. But the stored value is still the placeholder, which means **the agent is returning the placeholder instead of the actual value**.

### Agent Response Format Issue

The agents (Demographics, Household, Interests, Purchase) need to extract actual values for asterisk placeholders:

**Current Behavior**:
```json
{
  "taxonomy_id": 55,
  "value": "Country Extension",  // ← Placeholder copied from taxonomy
  "reasoning": "... United Kingdom ..."
}
```

**Expected Behavior**:
```json
{
  "taxonomy_id": 55,
  "value": "United Kingdom",  // ← Actual value extracted from reasoning
  "reasoning": "... United Kingdom ..."
}
```

### Affected Agents

All 4 agents when they encounter asterisk placeholders:
1. **Demographics agent**: `*Ethnicity`, `*Nationality`
2. **Household agent**: `*Country Extension`, `*Language`, `*Religion`, `*Political Affiliation`
3. **Interests agent**: (minimal asterisk entries)
4. **Purchase agent**: (minimal asterisk entries)

### Fix Plan

**Option 1: Fix in Agent Prompts (Recommended)**

Update agent system prompts to explicitly instruct:

```
For taxonomy entries with asterisk placeholders (e.g., "*Country Extension", "*Language"):
- Extract the ACTUAL VALUE from your reasoning
- Return that value in the "value" field
- Example: If reasoning says "United Kingdom", return value="United Kingdom" (not "Country Extension")
```

**Files to Modify**:
- `src/email_parser/agents/demographics_agent.py`
- `src/email_parser/agents/household_agent.py`
- `src/email_parser/agents/interests_agent.py`
- `src/email_parser/agents/purchase_agent.py`

**Option 2: Post-Process in Analyzer**

Extract actual value from reasoning using LLM:

```python
if taxonomy_value.startswith("*"):
    # LLM returned placeholder - extract actual value from reasoning
    extracted_value = extract_value_from_reasoning(
        reasoning=classification.get("reasoning"),
        placeholder=taxonomy_value,
        llm_client=llm_client
    )
    final_value = extracted_value if extracted_value else llm_value
```

**Recommendation**: Option 1 (fix prompts) is cleaner and more efficient. Option 2 as fallback if prompt fixes insufficient.

### Test Plan

1. Update agent prompts with asterisk placeholder instructions
2. Re-run analysis on test_final_validation.csv
3. Check database for classifications with asterisk placeholders:
   ```sql
   SELECT taxonomy_id, value, reasoning
   FROM classification_history
   WHERE user_id='phase1_test'
   AND (value LIKE '%Extension%' OR value LIKE '*%');
   ```
4. Verify actual values are extracted (e.g., "United Kingdom" not "Country Extension")
5. Check dashboard displays correct values

### Status
- [x] Root cause identified
- [ ] Fix implemented (Option 1: Agent prompts)
- [ ] Tests passed
- [ ] Deployed

---

## Fix Priority Order

1. **Bug #1 (CRITICAL)**: Fix evidence judge truncation - blocks 90% of classifications
2. **Bug #3 (MEDIUM)**: Fix agent asterisk value extraction - data quality issue
3. **Bug #2 (HIGH)**: Fix analytics tracking - dashboard UX issue but doesn't block core functionality

## Test Strategy

After all fixes:

1. **Clean Test Run**: Fresh database with 40 emails
2. **Expected Results**:
   - 20-30 classifications stored (Bug #1 fixed)
   - Actual values for asterisk placeholders (Bug #3 fixed)
   - Correct analytics metrics (Bug #2 fixed)
3. **Verification**:
   - Check database classification counts
   - Inspect classification values for asterisk entries
   - Review dashboard analytics page
   - Compare with Playwright screenshots

## Notes

- All bugs discovered during Phase 1 & Phase 2 E2E testing via Playwright MCP
- Test database: `data/email_parser_memory.db`
- Test user: `phase1_test`
- Test dataset: `data/test_final_validation.csv` (40 emails)
- Session log: `logs/email_parser_20251014_100358.log`
