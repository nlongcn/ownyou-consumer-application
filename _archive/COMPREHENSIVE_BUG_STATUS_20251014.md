# Comprehensive Bug Status Report - October 14, 2025

## Executive Summary

Through systematic E2E testing and bug fixing, I've identified **5 distinct bugs** affecting classification accuracy. One bug has been fixed, revealing 4 additional underlying issues. This report documents all findings with root cause analysis.

---

## ✅ FIXED: Bug #1 - Evidence Judge Context Truncation

### Status: **FIXED AND VERIFIED**

### Root Cause
Evidence judge only received first 500 characters of email context, causing it to reject valid classifications as "hallucinations" when agents referenced emails beyond char 500.

### Fix Applied
**File**: `src/email_parser/workflow/nodes/evidence_judge.py:71`
```python
# BEFORE:
## Email Context:
{email_context[:500]}...

# AFTER:
## Email Context:
{email_context}
```

### Test Results
- Evidence judge now receives **full email context** (6,000-7,000 chars vs 500)
- Logs confirm: `email_context_length=7001 chars`
- Evidence quality scores now accurate: contextual (0.80), weak (0.50), inappropriate (0.00)

### Impact
✅ Evidence judge working correctly
⚠️ Revealed 4 additional bugs that were masked by truncation

---

## ❌ ACTIVE: Bug #1A - Agent Taxonomy ID Hallucination (CRITICAL)

### Status: **ROOT CAUSE IDENTIFIED - NEEDS FIX**

### Symptoms
Interests agent returns completely wrong taxonomy IDs:
```
Validation failed: taxonomy_id=520, provided='Cryptocurrency', expected='Variety (Music and Audio)'
```

### Root Cause Analysis

**Problem**: Agent picks taxonomy IDs from limited prompt context instead of search results.

**Why This Happens**:
1. **Limited Taxonomy Context**: Prompt shows only first 100 entries (20 categories × 5 entries)
   - Location: `taxonomy_context.py:204-214`
   - Interests context limited to prevent token overflow

2. **Missing Cryptocurrency**: Finance/crypto topics exist ONLY in Purchase Intent taxonomy (IDs 1383-1399), NOT in Interests
   - Confirmed via taxonomy search: `search_interests_taxonomy("Cryptocurrency")` returns `[]`

3. **Agent Hallucinates**: When topic not in limited context, agent guesses from visible IDs
   - Picks ID 520 (Music) because it's visible in prompt
   - Should use search tools or skip classification

4. **Reflection Fails**: Agent has `max_iterations=3` but reflection message unhelpful:
   ```
   "Expected value: 'Variety (Music and Audio)'. Please search again..."
   ```
   Doesn't explain WHY it's wrong or that crypto belongs in Purchase Intent

### Impact
- **Interests agent**: 0 classifications stored (all rejected)
- **Household agent**: Some success (different issue - see Bug #1B)
- **Demographics agent**: Partial success
- **Purchase Intent agent**: Working (finance IS in this taxonomy)

### Fix Strategy

**Option 1: Improve Reflection Messages** (Recommended)
When validation fails, provide actionable feedback:
```
"Cryptocurrency is not an Interest category in IAB Taxonomy.
Finance/investment topics belong in Purchase Intent (ID 1383: Finance and Insurance).
Search the Interests taxonomy for related topics like 'Technology & Computing' instead."
```

**Option 2: Expand Taxonomy Context**
Show more entries per category (current: 5-8, increase to 15-20)
- Pro: More topics visible to LLM
- Con: Increases token usage significantly

**Option 3: Enforce Search Tool Usage**
Make search tools mandatory before classification:
```
REQUIRED STEPS:
1. Search taxonomy with keyword
2. If no results, skip this classification
3. Only use taxonomy_ids from search results
```

**Recommendation**: Implement Option 1 + Option 3 together

### Files Affected
- `src/email_parser/agents/interests_agent.py:182-185` - Reflection prompt
- `src/email_parser/agents/household_agent.py` - Same reflection issue
- `src/email_parser/workflow/prompts/__init__.py` - Agent system prompts

---

## ❌ ACTIVE: Bug #1B - Agent Value Formatting Mismatches (HIGH)

### Status: **ROOT CAUSE IDENTIFIED - NEEDS FIX**

### Symptoms
Household agent formatting doesn't match taxonomy:
```
Validation failed: taxonomy_id=66, provided='$50,000-$74,999', expected='$50000 - $74999'
```

### Root Cause
Agent formats values with commas and different spacing than taxonomy defines:
- **Agent returns**: `$50,000-$74,999` (commas, no spaces around hyphen)
- **Taxonomy expects**: `$50000 - $74999` (no commas, spaces around hyphen)

### Impact
- **Household income classifications**: 0 stored (all formatting rejected)
- Other household classifications may work if no formatting issues

### Fix Strategy

**Option 1: Extract From Taxonomy** (Recommended)
Agent should use exact value from taxonomy entry:
```python
# In agent prompt:
"After searching, copy the EXACT value from the taxonomy entry.
Do NOT reformat currency, dates, or numerical ranges.
Example: If taxonomy shows '$50000 - $74999', use that exact format."
```

**Option 2: Normalization Layer**
Add formatting normalization before validation:
- Remove commas from currency
- Normalize spacing around hyphens
- Pro: Handles LLM variations
- Con: May mask taxonomy lookup errors

**Recommendation**: Option 1 (teach agent to copy exact format)

### Files Affected
- `src/email_parser/agents/household_agent.py` - System prompt
- `src/email_parser/agents/demographics_agent.py` - May have same issue with ages

---

## ❌ ACTIVE: Bug #2 - Analytics Dashboard Data Issues (HIGH)

### Status: **ROOT CAUSE IDENTIFIED - NEEDS FIX**

### Symptoms
Analytics dashboard displays incorrect metrics:
- **Total Emails**: Shows 1 (should be 40)
- **Analysis Runs**: Shows 2 but missing metadata
- **Timestamps**: Shows "01/01/1970" Unix epoch
- **Latest Run**: Shows "0 emails" despite processing 40

### Root Cause Analysis

#### Issue 2A: Missing Analysis Run Metadata
**Database Evidence**:
```sql
SELECT * FROM analysis_runs WHERE user_id='phase1_test';

phase1_test_...|2|3|0||546.5|completed|...||||
                ↑ emails_processed=2 (WRONG!)
                                        ↑↑↑↑ NULL started_at/completed_at/provider/model
```

**Cause**: `save_analysis_run()` not called with correct parameters after workflow completion

#### Issue 2B: Incorrect Total Emails Count
**Current Code** (`queries.py:401-408`):
```python
cursor.execute("""
    SELECT COUNT(DISTINCT key) as email_count
    FROM memories
    WHERE namespace = ? AND key LIKE 'episodic_%'
""", (namespace,))
```

**Problem**: Query counts episodic memories (1 found) instead of emails processed

**Database Confirms**:
```sql
SELECT COUNT(*) FROM memories
WHERE namespace='phase1_test/iab_taxonomy_profile' AND key LIKE 'episodic_%';
-- Result: 1 (should show 40)
```

#### Issue 2C: Unix Epoch Timestamps
**Frontend Code** (`analytics/page.tsx:231`):
```typescript
{new Date(run.started_at).toLocaleString()}
```

**Problem**: When `started_at` is NULL, `new Date(null)` returns invalid date (01/01/1970)

### Fix Strategy

**Fix 2A: Correct Analysis Run Tracking**
Location: Workflow execution loop
```python
# At workflow start
started_at = datetime.utcnow().isoformat()

# At workflow end
completed_at = datetime.utcnow().isoformat()
save_analysis_run(
    user_id=user_id,
    run_date=started_at,
    emails_processed=len(all_emails_processed),  # Actual count
    provider="both",  # or actual provider
    model=taxonomy_model,
    started_at=started_at,
    completed_at=completed_at
)
```

**Fix 2B: Use analysis_runs for Total Emails**
```python
# queries.py:401-408
cursor.execute("""
    SELECT SUM(emails_processed) as email_count
    FROM analysis_runs
    WHERE user_id = ?
""", (user_id,))
```

**Fix 2C: Handle NULL Timestamps**
```typescript
{run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}
```

### Files Affected
- Workflow executor (needs investigation - exact file TBD)
- `dashboard/backend/db/queries.py:401-408`
- `dashboard/frontend/app/analytics/page.tsx:231`

---

## ❌ ACTIVE: Bug #3 - Extension Category Placeholder Display (MEDIUM)

### Status: **ROOT CAUSE IDENTIFIED - NEEDS FIX**

### Symptoms
Classifications with asterisk placeholders show placeholder instead of actual value:
- **Expected**: "United Kingdom"
- **Actual**: "Country Extension"

### Database Evidence
```json
{
  "taxonomy_id": 55,
  "tier_4": "*Country Extension",
  "value": "Country Extension",  // ← Should be "United Kingdom"
  "reasoning": "...collectively indicate the user is located in the United Kingdom."
}
```

The actual value ("United Kingdom") is in reasoning but not extracted to value field.

### Root Cause
Agents don't extract actual values for asterisk placeholders - they copy the placeholder itself.

**Code Analysis** (`analyzers.py:293-297`):
```python
taxonomy_value = get_taxonomy_value(taxonomy_entry)
final_value = llm_value if taxonomy_value.startswith("*") else taxonomy_value
```

Analyzer correctly checks for asterisk, but `llm_value` = "Country Extension" (placeholder), not "United Kingdom" (actual).

### Fix Strategy

**Update Agent Prompts**:
```
For taxonomy entries with asterisk placeholders (e.g., "*Country Extension", "*Language"):
- Extract the ACTUAL VALUE from your reasoning
- Return that value in the "value" field
- Example: If reasoning says "United Kingdom", return value="United Kingdom" (not "Country Extension")
```

### Files Affected
- `src/email_parser/agents/demographics_agent.py`
- `src/email_parser/agents/household_agent.py`
- `src/email_parser/agents/interests_agent.py`
- `src/email_parser/agents/purchase_agent.py`

---

## Classification Results Summary

### Before Any Fixes
- **3 classifications** from 40 emails (90% data loss)
- Evidence judge truncation blocking everything

### After Bug #1 Fix Only
- **4 classifications** from 40 emails (still very low)
- Evidence judge working BUT agents have validation errors

**Breakdown by Agent**:
- Demographics: 2 classifications ✓ (some success)
- Household: 0 classifications ✗ (formatting errors)
- Interests: 0 classifications ✗ (wrong taxonomy IDs)
- Purchase Intent: 2 classifications ✓ (working)

### Expected After All Fixes
- **20-30 classifications** from 40 emails
- All 4 agents contributing proportionally

---

## Implementation Priority

### Phase 1: Agent Validation Fixes (CRITICAL - Blocking 90%+ of classifications)
1. **Bug #1A**: Improve reflection messages + enforce search tool usage
2. **Bug #1B**: Fix value formatting (exact taxonomy format)
3. **Bug #3**: Fix asterisk placeholder extraction

### Phase 2: Dashboard Analytics (HIGH - UX issue but doesn't block core functionality)
4. **Bug #2**: Fix analysis run tracking and metrics display

---

## Test Strategy

### Verification Test
After each fix:
```bash
MEMORY_DATABASE_PATH=data/test_bug_fixes.db \
  TAXONOMY_MODEL=openai:gpt-4o-mini \
  python -m src.email_parser.main \
  --iab-csv data/test_final_validation.csv \
  --iab-output /tmp/test_bug_fixes.json \
  --user-id bug_fix_test \
  --force-reprocess
```

### Success Criteria
- 20-30 classifications from 40 emails
- All 4 agents contributing
- No validation errors in logs
- Dashboard shows correct metrics

---

## Lessons Learned

### Root Cause Layering
This investigation revealed **bugs layered on top of bugs**:
1. Evidence judge truncation (FIXED) masked...
2. Agent taxonomy hallucination (ACTIVE) and...
3. Agent formatting errors (ACTIVE) and...
4. Asterisk placeholder issues (ACTIVE) and...
5. Analytics tracking gaps (ACTIVE)

**Key Insight**: Fixing outer layers reveals inner layers. Each fix is progress even if total classification count remains low initially.

### Testing Approach
**What Worked**:
- E2E testing via Playwright MCP revealed real-world failures
- Database inspection confirmed classification counts
- Log analysis showed exact validation errors
- Systematic root cause analysis for each layer

**What To Improve**:
- Unit tests for agent reflection loops
- Integration tests for taxonomy search tools
- Validation layer test fixtures

---

## Files Modified
- ✅ `src/email_parser/workflow/nodes/evidence_judge.py:71` - Removed truncation

## Documentation Created
- ✅ `docs/bugfixing/PHASE1_PHASE2_CRITICAL_BUGS_20251014.md` - Original bug report
- ✅ `docs/bugfixing/BUG_FIX_SUMMARY_20251014.md` - Fix progress summary
- ✅ `docs/bugfixing/COMPREHENSIVE_BUG_STATUS_20251014.md` - This complete status report
