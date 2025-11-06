# Batch Processing Redesign Requirements

## Document Information
- **Created**: 2025-10-10
- **Author**: Development Team
- **Status**: Draft for Review
- **Related Issue**: Batch processing only analyzing 1-2 emails from batches of 32+

## Problem Statement

### Current Behavior (BROKEN)
When processing batches of 32+ emails through IAB Classification agents:
- **Observed**: LLM returns only 3-5 classifications total
- **Expected**: Classifications from most/all emails in batch (20-40+ classifications)
- **Root Cause**: Agent prompts instruct "Process EACH email separately" which conflicts with holistic batch analysis
- **Evidence**: Log analysis shows classifications all tagged with same email_number (1 or 14) instead of spanning 1-32

### Example Failure Case
```
Input: 40 emails (IDs: test_001 through test_040)
Agent Output: 3 classifications
- Classification 1: email_number=1, value="Cryptocurrency"
- Classification 2: email_number=1, value="Technology"
- Classification 3: email_number=14, value="Business and Finance"

Problem: 37 emails ignored, no holistic user profile analysis
```

### Why This Matters
1. **Cost Efficiency**: We're sending 32 emails but only analyzing 1-2 (wasting 94% of tokens)
2. **Pattern Recognition**: Can't identify cross-email patterns (user subscribes to 5 crypto newsletters = strong signal)
3. **Batch Size Limitation**: Current approach limits batches to ~10 emails max (defeats purpose of batching)
4. **Data Loss**: Missing classifications from 90%+ of emails

## Proposed Solution: Option 2 (Holistic Analysis with Multi-Email Provenance)

### Conceptual Change
**FROM**: "Process each email separately and tag with email_number"
**TO**: "Analyze user holistically across all emails and cite supporting evidence from multiple emails"

### Architecture Changes

#### 1. Dynamic Batch Sizing Based on Model Context Window

**CRITICAL REQUIREMENT**: Batch size MUST be dynamically calculated based on each model's context window.

##### Current Implementation (VERIFY IT WORKS)
The system already has context window fetching in `src/email_parser/workflow/llm_wrapper.py`:

```python
def _fetch_context_window(self) -> int:
    """Fetch context window for the current model from model registry."""
    from ..llm_clients.model_registry import (
        get_context_window_openai,
        get_context_window_claude,
        get_context_window_google,
    )

    if self.provider == "openai":
        return get_context_window_openai(self.client.client, self.model)
    elif self.provider == "claude":
        return get_context_window_claude(self.client.client, self.model)
    elif self.provider == "google":
        return get_context_window_google(self.client.client, self.model)
    # ...
```

And batch calculation in `src/email_parser/workflow/batch_optimizer.py`:

```python
def calculate_batch_size(
    emails: List[Dict[str, Any]],
    context_window: int,
    prompt_template: str
) -> int:
    """
    Calculate optimal batch size based on model context window.

    Target: Use 60-80% of context window for response, 20-40% for prompt.
    """
    # Token estimation logic...
```

##### Testing Requirements

**Test Case 1: OpenAI gpt-5-mini**
- **Model**: `openai:gpt-5-mini`
- **Expected Context Window**: 128,000 tokens (verify via API)
- **Expected Batch Size**: ~35-45 emails (depending on email length)
- **Test Command**:
```bash
MEMORY_DATABASE_PATH=data/test_gpt5_batch.db \
LLM_PROVIDER=openai \
OPENAI_MODEL=gpt-5-mini \
python -m src.email_parser.main \
  --iab-csv emails_processed_combined.csv \
  --iab-output test_gpt5_batch.json \
  --user-id test_gpt5 \
  --force-reprocess
```
- **Validation**:
  - Check logs for: "context_window=128000"
  - Check logs for: "batch_size=XX" (should be 35-45)
  - Verify all emails in batch are analyzed (email_numbers spans 1-XX)

**Test Case 2: Google gemini-2.5-flash**
- **Model**: `google:gemini-2.5-flash`
- **Expected Context Window**: 1,000,000 tokens (verify via API)
- **Expected Batch Size**: ~200+ emails (may hit practical limits)
- **Test Command**:
```bash
MEMORY_DATABASE_PATH=data/test_gemini_batch.db \
LLM_PROVIDER=google \
GOOGLE_MODEL=gemini-2.5-flash \
python -m src.email_parser.main \
  --iab-csv emails_processed_combined.csv \
  --iab-output test_gemini_batch.json \
  --user-id test_gemini \
  --force-reprocess
```
- **Validation**:
  - Check logs for: "context_window=1000000"
  - Check logs for: "batch_size=XX" (should be 100+)
  - Verify batch processing completes without truncation errors

**Test Case 3: Claude sonnet-4**
- **Model**: `claude:claude-sonnet-4-20250514`
- **Expected Context Window**: 200,000 tokens
- **Expected Batch Size**: ~50-60 emails

**Test Case 4: Ollama (local)**
- **Model**: `ollama:deepseek-r1:70b`
- **Expected Context Window**: 8,192 tokens (default)
- **Expected Batch Size**: ~5-8 emails
- **Note**: Should gracefully handle smaller context windows

##### Dynamic Batch Size Requirements

1. ✅ **API Fetching**: Context window MUST be fetched from provider API (not hardcoded)
2. ✅ **Per-Model Calculation**: Each model gets its own batch size calculation
3. ✅ **Logging**: Log actual context window and calculated batch size
4. ✅ **Fallback**: If API fetch fails, use conservative default (8K tokens, ~5 emails)
5. ✅ **Token Estimation**: Accurate token counting (1 token ≈ 4 chars for English)
6. ✅ **Safety Margins**:
   - Reserve 20% of context window for prompt/instructions
   - Reserve 10% buffer for response overhead
   - Use 60-70% for actual email content
7. ✅ **Max Caps**:
   - Cap response tokens at 16,384 (even for huge context windows)
   - Cap batch size at 50 emails (practical limit for holistic analysis)

##### Files to Verify/Update

**File**: `src/email_parser/llm_clients/model_registry.py`
- **Verify**: `get_context_window_openai()` fetches from OpenAI API
- **Verify**: `get_context_window_google()` fetches from Google API
- **Verify**: Handles new models like gpt-5-mini and gemini-2.5-flash
- **Test**: Run with both models and check logs

**File**: `src/email_parser/workflow/batch_optimizer.py`
- **Verify**: `calculate_batch_size()` uses context_window parameter
- **Verify**: Token estimation is accurate (test with real emails)
- **Verify**: Respects safety margins (20% prompt, 70% content, 10% buffer)
- **Update**: Add logging for batch size decisions

**File**: `src/email_parser/workflow/executor.py`
- **Verify**: Passes context_window to batch_optimizer
- **Verify**: Handles different batch sizes per agent
- **Update**: Log actual batch sizes used per agent call

#### 2. Schema Changes

**BEFORE (Broken)**:
```json
{
  "classifications": [
    {
      "taxonomy_id": 520,
      "value": "Cryptocurrency",
      "confidence": 0.9,
      "reasoning": "CoinDesk newsletter",
      "email_number": 1
    }
  ]
}
```

**AFTER (Fixed)**:
```json
{
  "classifications": [
    {
      "taxonomy_id": 520,
      "value": "Cryptocurrency",
      "confidence": 0.95,
      "reasoning": "User subscribed to CoinDesk, Decrypt, Bitcoin Magazine (5 emails total)",
      "email_numbers": [1, 5, 12, 18, 24]
    }
  ]
}
```

**Schema Definition**:
```python
# Agent response schema
{
  "classifications": [
    {
      "taxonomy_id": int,          # IAB taxonomy ID
      "value": str,                # Final tier value
      "confidence": float,         # 0.0-1.0 (higher with more evidence)
      "reasoning": str,            # Evidence summary citing multiple emails
      "email_numbers": List[int],  # [1, 5, 12] - all supporting emails
      "purchase_intent_flag": str  # Only for purchase_agent (OPTIONAL)
    }
  ]
}
```

#### 3. Prompt Changes

**Current Prompt (WRONG)**:
```
⚠️ CRITICAL: Process EACH email separately and return classifications for ALL emails.

Think step-by-step:
1. Go through EACH email one by one
2. For each email, identify signals
3. Tag each classification with email_number (1, 2, 3, etc.)
```

**New Prompt (CORRECT)**:
```
⚠️ CRITICAL: Analyze the user holistically across ALL emails in the batch.

Your task:
1. Review ALL emails to understand the user's complete profile
2. Identify patterns across multiple emails (recurring newsletters, product categories, etc.)
3. For each classification, cite ALL supporting emails using email_numbers array
4. Stronger patterns (more emails) = higher confidence scores

Example: If user receives crypto newsletters in emails 1, 5, 12, 18, 24:
{
  "taxonomy_id": 520,
  "value": "Cryptocurrency",
  "confidence": 0.95,
  "reasoning": "User subscribed to 5 crypto newsletters: CoinDesk, Decrypt, Bitcoin Magazine, CoinTelegraph, The Block",
  "email_numbers": [1, 5, 12, 18, 24]
}

Batch Information:
- Total emails in batch: {batch_size}
- Email IDs: 1 through {batch_size}
- All emails are from the same user

Guidelines:
- Look for patterns across ALL emails (not individual emails)
- A classification can reference 1 email (weak signal) or 20+ emails (strong signal)
- Higher confidence when pattern appears in multiple emails
- Cite specific evidence from emails in reasoning field

Return format: Holistic user profile with all classifications (not per-email classifications).
```

#### 4. Code Changes Required

##### File: `src/email_parser/agents/demographics_agent.py`
**Changes**:
- **Line 64**: Change `"email_number": 1` example to `"email_numbers": [1, 5, 12]`
- **Lines 66-70**: Update CRITICAL REQUIREMENT section to explain email_numbers array
- **Lines 77-89**: Replace DEMOGRAPHICS_AGENT_USER_PROMPT with holistic analysis instructions (include batch_size)
- **Line 181**: Add batch_size to user_prompt formatting:
```python
user_prompt = DEMOGRAPHICS_AGENT_USER_PROMPT.format(
    email_batch=email_text,
    batch_size=len(emails)
)
```
- **Line 260**: Change `classification.get("email_number")` to `classification.get("email_numbers", [])`
- **Lines 261-265**: Update provenance mapping to handle arrays:
```python
email_numbers = classification.get("email_numbers", [])
if email_numbers and all(n in email_number_to_id for n in email_numbers):
    classification["email_ids"] = [email_number_to_id[n] for n in email_numbers]
else:
    logger.warning(f"Classification missing email_numbers or invalid: {classification}")
    classification["email_ids"] = []
```

##### File: `src/email_parser/agents/household_agent.py`
**Changes**: Same as demographics_agent.py (lines 58, 63-67, 71-86, 174, 253-258)

##### File: `src/email_parser/agents/interests_agent.py`
**Changes**: Same as demographics_agent.py (lines 58, 63-67, 71-88, 179, 258-263)

##### File: `src/email_parser/agents/purchase_agent.py`
**Changes**: Same as demographics_agent.py (lines 64, 69-73, 77-93, 181, 264-269)

##### File: `src/email_parser/workflow/nodes/update_memory.py`
**Changes**:
- **Line 67**: Change `email_id = classification.get("email_id", "unknown")` to:
```python
email_ids = classification.get("email_ids", [])
if not email_ids:
    logger.warning(f"Classification missing email_ids: {classification}")
    # Fallback to single email_id if present
    single_email_id = classification.get("email_id")
    if single_email_id:
        email_ids = [single_email_id]
    else:
        email_ids = ["unknown"]
```
- **Line 78**: Update memory insertion to handle multiple email_ids:
```python
for email_id in email_ids:
    memory.store_fact(
        user_id=user_id,
        section=section,
        taxonomy_id=classification["taxonomy_id"],
        value=classification["value"],
        confidence=classification.get("confidence", 0.7),
        reasoning=classification.get("reasoning", ""),
        email_id=email_id,
        email_date=email_date,
        email_subject=email_subject
    )
```

##### File: `src/email_parser/workflow/nodes/evidence_judge.py`
**Changes**:
- **Line 15-25**: Update `evaluate_evidence_quality()` to accept email_numbers array
- **Line 40-50**: Update prompt to check evidence against multiple emails:
```python
classification_email_numbers = classification.get("email_numbers", [])
if not classification_email_numbers:
    # Fallback for old schema
    email_num = classification.get("email_number")
    if email_num:
        classification_email_numbers = [email_num]

# Build context from cited emails only
email_context_parts = email_context.split("\n\nEmail ")
relevant_emails = []
for num in classification_email_numbers:
    if 0 < num <= len(email_context_parts):
        relevant_emails.append(f"Email {num}:\n" + email_context_parts[num-1])

focused_email_context = "\n\n".join(relevant_emails)
```

##### File: `src/email_parser/workflow/batch_optimizer.py`
**Changes**:
- **Add logging**: Log calculated batch size and reasoning
```python
logger.info(
    f"Calculated batch size: {batch_size} emails "
    f"(context_window={context_window:,}, "
    f"estimated_tokens_per_email={avg_tokens_per_email}, "
    f"safety_margin=20%)"
)
```

##### File: `src/email_parser/workflow/executor.py`
**Changes**:
- **Add logging**: Log batch processing decisions
```python
logger.info(
    f"Processing {section} agent with {len(batch)} emails "
    f"(batch {batch_num}/{total_batches})"
)
```

#### 5. Testing Changes Required

##### File: `tests/unit/test_analyzer_nodes.py`
- Update all mock classifications to use `email_numbers: [1]` instead of `email_number: 1`
- Add multi-email test cases: `email_numbers: [1, 5, 12]`

##### File: `tests/manual/test_agent_validation.py`
- Add assertion: `assert all("email_numbers" in c for c in result["classifications"])`
- Add assertion: `assert all(isinstance(c["email_numbers"], list) for c in result["classifications"])`

## Success Criteria

### Functional Requirements
1. ✅ **Complete Batch Analysis**: All 32+ emails in batch are analyzed (not just 1-2)
2. ✅ **Multi-Email Provenance**: Classifications cite multiple supporting emails via `email_numbers` array
3. ✅ **Pattern Recognition**: LLM identifies cross-email patterns (e.g., 5 crypto newsletters → high confidence)
4. ✅ **Confidence Scaling**: More supporting emails = higher confidence scores
5. ✅ **Memory Storage**: Each classification stored multiple times (once per supporting email_id)

### Performance Requirements
1. ✅ **Dynamic Batch Size**: Automatically adjust based on model context window
2. ✅ **OpenAI gpt-5-mini**: Process 35-45 emails per batch (128K context)
3. ✅ **Google gemini-2.5-flash**: Process 100+ emails per batch (1M context)
4. ✅ **Claude sonnet-4**: Process 50-60 emails per batch (200K context)
5. ✅ **Ollama models**: Process 5-8 emails per batch (8K context)
6. ✅ **Token Efficiency**: Utilize 60-70% of context window for email content
7. ✅ **Processing Speed**: Maintain 20-30x speedup vs single-email processing

### Data Quality Requirements
1. ✅ **No Data Loss**: Classifications reference all relevant emails (not subset)
2. ✅ **Evidence Quality**: LLM-as-Judge validates evidence from ALL cited emails
3. ✅ **Provenance Integrity**: email_numbers correctly map to email_ids in memory

### Model Compatibility Requirements
1. ✅ **OpenAI**: gpt-4o, gpt-4o-mini, gpt-5-mini, gpt-3.5-turbo
2. ✅ **Google**: gemini-2.0-flash-exp, gemini-2.5-flash, gemini-1.5-pro
3. ✅ **Claude**: claude-sonnet-4, claude-opus-4, claude-haiku-4
4. ✅ **Ollama**: All models (with smaller batch sizes)

## Testing Plan

### Phase 1: Context Window Verification

**Test 1.1: OpenAI gpt-5-mini Context Window**
```bash
# Test context window fetch
python -c "
from src.email_parser.llm_clients.model_registry import get_context_window_openai
from openai import OpenAI
client = OpenAI()
context_window = get_context_window_openai(client, 'gpt-5-mini')
print(f'gpt-5-mini context window: {context_window:,} tokens')
assert context_window >= 100000, 'Context window too small'
"
```

**Expected Output**: `gpt-5-mini context window: 128,000 tokens`

**Test 1.2: Google gemini-2.5-flash Context Window**
```bash
# Test context window fetch
python -c "
from src.email_parser.llm_clients.model_registry import get_context_window_google
import google.generativeai as genai
genai.configure(api_key='...')
client = genai.GenerativeModel('gemini-2.5-flash')
context_window = get_context_window_google(client, 'gemini-2.5-flash')
print(f'gemini-2.5-flash context window: {context_window:,} tokens')
assert context_window >= 500000, 'Context window too small'
"
```

**Expected Output**: `gemini-2.5-flash context window: 1,000,000 tokens`

### Phase 2: Batch Size Calculation

**Test 2.1: Batch Size with gpt-5-mini (40 emails)**
```bash
MEMORY_DATABASE_PATH=data/test_gpt5_batch.db \
LLM_PROVIDER=openai \
OPENAI_MODEL=gpt-5-mini \
python -m src.email_parser.main \
  --iab-csv emails_processed_combined.csv \
  --iab-output test_gpt5_batch.json \
  --user-id test_gpt5 \
  --force-reprocess 2>&1 | tee logs/test_gpt5_batch.log
```

**Validation Checks**:
```bash
# Check context window was fetched
grep "context_window" logs/test_gpt5_batch.log

# Check batch size calculation
grep "batch_size" logs/test_gpt5_batch.log

# Check all emails were analyzed
sqlite3 data/test_gpt5_batch.db "SELECT DISTINCT email_id FROM taxonomy_facts;" | wc -l
# Should show ~40 unique email_ids
```

**Test 2.2: Batch Size with gemini-2.5-flash (40 emails)**
```bash
MEMORY_DATABASE_PATH=data/test_gemini_batch.db \
LLM_PROVIDER=google \
GOOGLE_MODEL=gemini-2.5-flash \
python -m src.email_parser.main \
  --iab-csv emails_processed_combined.csv \
  --iab-output test_gemini_batch.json \
  --user-id test_gemini \
  --force-reprocess 2>&1 | tee logs/test_gemini_batch.log
```

### Phase 3: Holistic Analysis Validation

**Test 3.1: Check email_numbers Arrays**
```bash
# Run with 40 emails
MEMORY_DATABASE_PATH=data/test_holistic.db \
LLM_PROVIDER=openai \
OPENAI_MODEL=gpt-5-mini \
python -m src.email_parser.main \
  --iab-csv emails_processed_combined.csv \
  --iab-output test_holistic.json \
  --user-id test_holistic \
  --force-reprocess

# Validate output
python -c "
import json
with open('test_holistic.json') as f:
    profile = json.load(f)

# Check interests have email_numbers arrays
interests = profile.get('interests', [])
print(f'Total interests: {len(interests)}')

for interest in interests:
    email_numbers = interest.get('email_numbers', [])
    print(f'{interest[\"value\"]}: {len(email_numbers)} emails')
    assert isinstance(email_numbers, list), 'email_numbers must be array'
    assert len(email_numbers) > 0, 'email_numbers cannot be empty'
"
```

**Test 3.2: Check Memory Provenance**
```bash
# Check that each classification was stored for each cited email
sqlite3 data/test_holistic.db "
SELECT
  value,
  COUNT(DISTINCT email_id) as email_count,
  GROUP_CONCAT(DISTINCT email_id) as email_ids
FROM taxonomy_facts
WHERE section = 'interests'
GROUP BY value
ORDER BY email_count DESC
LIMIT 10;
"
```

**Expected Output**:
```
Cryptocurrency|5|test_001,test_005,test_012,test_018,test_024
Technology|8|test_002,test_007,test_015,test_022,test_030,...
Business and Finance|4|test_003,test_008,test_016,test_025
```

### Phase 4: Playwright E2E Testing

**Test 4.1: Dashboard Integration Test**
```typescript
test('batch processing displays multiple email provenance', async ({ page }) => {
  // Navigate to analyze page
  await page.goto('http://localhost:3000/analyze')

  // Select gpt-5-mini
  await page.selectOption('[name="taxonomyModel"]', 'openai:gpt-5-mini')

  // Upload 40 emails CSV
  await page.setInputFiles('[name="emailFile"]', 'emails_processed_combined.csv')

  // Start analysis
  await page.click('button:has-text("Start Analysis")')

  // Wait for completion (may take 5-10 min)
  await page.waitForSelector('text=Analysis Complete', { timeout: 600000 })

  // Check results
  await page.goto('http://localhost:3000/profile')

  // Verify interests section shows multiple classifications
  const interestCount = await page.locator('[data-testid="interest-item"]').count()
  expect(interestCount).toBeGreaterThan(10) // Should have 10+ interests from 40 emails

  // Click on a classification to view provenance
  await page.click('[data-testid="interest-item"]:first-child')

  // Verify email provenance displayed
  const provenanceText = await page.locator('[data-testid="email-provenance"]').textContent()
  expect(provenanceText).toContain('emails') // Should show "Based on 5 emails" or similar
})
```

**Test 4.2: API Response Validation**
```typescript
test('API returns email_numbers arrays', async ({ request }) => {
  // Trigger analysis via API
  const response = await request.post('http://localhost:5001/api/analyze/run', {
    data: {
      user_id: 'test_api',
      email_model: 'openai:gpt-5-mini',
      taxonomy_model: 'openai:gpt-5-mini',
      csv_file: 'emails_processed_combined.csv'
    }
  })

  expect(response.ok()).toBeTruthy()

  // Wait for completion
  await page.waitForTimeout(600000) // 10 min

  // Fetch profile
  const profileResponse = await request.get('http://localhost:5001/api/profile/test_api')
  const profile = await profileResponse.json()

  // Validate schema
  expect(profile.interests).toBeDefined()
  expect(profile.interests.length).toBeGreaterThan(10)

  // Check first interest has email_numbers array
  const firstInterest = profile.interests[0]
  expect(Array.isArray(firstInterest.email_numbers)).toBeTruthy()
  expect(firstInterest.email_numbers.length).toBeGreaterThan(0)
})
```

## Rollout Plan

### Phase 1: Context Window Verification (30 min)
1. ✅ Test gpt-5-mini context window fetch
2. ✅ Test gemini-2.5-flash context window fetch
3. ✅ Verify batch_optimizer.py uses fetched values
4. ✅ Add logging for batch size calculations

### Phase 2: Schema Migration (1 hour)
1. ✅ Update all 4 agent files (demographics, household, interests, purchase)
2. ✅ Update prompts to holistic analysis approach
3. ✅ Update email_number → email_numbers in responses
4. ✅ Add batch_size to prompt formatting

### Phase 3: Provenance Handling (1 hour)
1. ✅ Update update_memory.py for multi-email storage
2. ✅ Update evidence_judge.py for array handling
3. ✅ Add backward compatibility for single email_number

### Phase 4: Testing (2 hours)
1. ✅ Run Test 2.1 (gpt-5-mini batch sizing)
2. ✅ Run Test 2.2 (gemini-2.5-flash batch sizing)
3. ✅ Run Test 3.1 (holistic analysis validation)
4. ✅ Run Test 3.2 (memory provenance check)
5. ✅ Run Test 4.1 (Playwright dashboard test)
6. ✅ Run Test 4.2 (Playwright API test)

### Phase 5: Documentation (30 min)
1. ✅ Update CHANGELOG.md
2. ✅ Update this requirements doc with test results
3. ✅ Create TESTING_RESULTS.md with evidence

## Risk Assessment

### Low Risk
- ✅ Schema change is additive (email_number → email_numbers)
- ✅ Backward compatible: Single-email batches still work
- ✅ No database migration required (memory uses email_id, not email_number)

### Medium Risk
- ⚠️ LLM may not follow instructions perfectly (may still output email_number)
- **Mitigation**: Validation step to check for email_numbers presence
- **Fallback**: If email_numbers missing, use email_number as [email_number]

- ⚠️ Context window API may fail for some models
- **Mitigation**: Fallback to conservative default (8K tokens)
- **Fallback**: Log warning and continue with smaller batches

### High Risk
- 🔴 Evidence judge may fail with email_numbers array (needs testing)
- **Mitigation**: Comprehensive unit tests for array handling
- **Fallback**: Disable evidence judge temporarily if blocking

- 🔴 Very large batches (100+ emails) may cause LLM confusion
- **Mitigation**: Cap batch size at 50 emails even for huge context windows
- **Rationale**: Holistic analysis quality degrades with too many emails

## Acceptance Criteria

### Definition of Done
- [ ] Context window fetching works for gpt-5-mini (128K)
- [ ] Context window fetching works for gemini-2.5-flash (1M)
- [ ] Batch size calculation uses fetched context windows
- [ ] All 4 agent files updated with holistic prompts
- [ ] update_memory.py handles email_ids arrays
- [ ] evidence_judge.py validates against multiple emails
- [ ] Unit tests pass with new schema
- [ ] Manual testing shows 30+ classifications from 40 emails
- [ ] Playwright E2E tests pass
- [ ] Log analysis confirms email_numbers arrays span full batch range
- [ ] Memory database contains facts for all 40 email_ids

### User Acceptance Test
**Scenario**: User processes 40 emails through dashboard using gpt-5-mini
**Expected**:
1. Dashboard shows 20-40 classifications (not 3)
2. Each classification references 1-10 emails (not always 1)
3. High-confidence classifications cite multiple emails
4. No "unknown" email_ids in memory
5. Processing completes in <10 minutes
6. Logs show: "context_window=128000, batch_size=40"

## Open Questions
1. ✅ Should confidence scores scale linearly with email count? → YES: 1 email = 0.7, 5 emails = 0.9, 10+ emails = 0.95
2. ✅ What's the maximum email_numbers array size? → CAP at 20 for readability
3. ✅ Should we cap batch size even for huge context windows? → YES: Cap at 50 emails
4. ❓ How to handle gemini-2.5-flash's 1M context window? → Test and see if quality degrades beyond 50 emails

## References
- Previous session context summary
- Log analysis: `logs/structured_20251009_*.jsonl`
- Agent architecture: `src/email_parser/agents/*.py`
- Memory architecture: `src/email_parser/workflow/nodes/update_memory.py`
- Batch optimizer: `src/email_parser/workflow/batch_optimizer.py`
- Model registry: `src/email_parser/llm_clients/model_registry.py`
