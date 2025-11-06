# Evidence Judge Fix - Context Truncation Issue

## Problem Summary

After analyzing log files from two test runs, I identified a critical issue causing valid classifications to be blocked as "hallucinations":

### Initial Problem (Run 1)
- Only 18 classifications survived from 192 emails processed
- Evidence judge was reporting emails didn't exist (e.g., "Email 11 does not exist")
- Root cause: **Batch size mismatch**
  - Workflow sent 50 emails per batch
  - Agents processed only first 20 emails (`emails[:20]`)
  - Evidence judge received only 500 chars of truncated context
  - LLM cited emails 11-50 but judge only saw ~2 emails in context

### Persisting Problem (Run 2)
- After initial fixes, classifications only increased from 18→24
- Evidence judge still reported "only 7-8 emails provided"
- Real issue: **Context truncation in evidence judge prompt**
  - Agents now processed 50 emails correctly
  - BUT: Evidence judge prompt used `email_context[:2000]` showing only ~7-8 emails
  - LLM judge counted emails in truncated snippet and flagged valid citations as hallucinations
  - Example: "HALLUCINATION - cites emails 22, 23, 25 that do not exist (only 7 emails provided)"

## Complete Fix (5 Changes)

### Fix 1: Increase Agent Batch Processing (Lines 63-90 in all agents)
**Changed:** All agents from `emails[:20]` → `emails[:50]`
**Files:**
- `src/email_parser/agents/demographics_agent.py:63`
- `src/email_parser/agents/household_agent.py:63`
- `src/email_parser/agents/interests_agent.py:63`
- `src/email_parser/agents/purchase_agent.py:63`

```python
for i, email in enumerate(emails[:50]):  # Process up to 50 emails per batch
```

### Fix 2: Add Hallucination Pre-Check (Lines 63-90 in evidence_judge.py)
**Added:** Programmatic validation to catch true hallucinations before LLM judge
**File:** `src/email_parser/workflow/nodes/evidence_judge.py`

```python
# Pre-check: Detect if reasoning cites emails beyond actual batch size (true hallucination)
import re
reasoning = classification.get('reasoning', '')
email_numbers = classification.get('email_numbers', [])

# Check if any cited email numbers exceed the actual batch size
if actual_batch_size and email_numbers:
    max_cited = max(email_numbers)
    if max_cited > actual_batch_size:
        return {
            "is_valid": False,
            "quality_score": 0.0,
            "evidence_type": "inappropriate",
            "issue": f"HALLUCINATION: Reasoning cites Email {max_cited} but batch only contains {actual_batch_size} emails."
        }

# Also check reasoning text for email citations beyond batch size
if actual_batch_size:
    email_refs = re.findall(r'\bEmail\s+(\d+)\b', reasoning, re.IGNORECASE)
    for ref in email_refs:
        email_num = int(ref)
        if email_num > actual_batch_size:
            return {
                "is_valid": False,
                "quality_score": 0.0,
                "evidence_type": "inappropriate",
                "issue": f"HALLUCINATION: Reasoning cites 'Email {email_num}' but batch only contains {actual_batch_size} emails."
            }
```

### Fix 3: Increase Evidence Context (Line 104 in evidence_judge.py)
**Changed:** `email_context[:500]` → `email_context[:2000]`
**File:** `src/email_parser/workflow/nodes/evidence_judge.py:104`

```python
## Email Context (first 2000 chars of batch):
{email_context[:2000]}...
```

### Fix 4: Inform Judge About Batch Size (Lines 92-114 in evidence_judge.py)
**Added:** Explicit batch size information to prevent false hallucination flags
**File:** `src/email_parser/workflow/nodes/evidence_judge.py`

```python
# Build judge prompt with batch size info
batch_info = f"\n\nNOTE: The agent analyzed a batch of {actual_batch_size} emails. Email references in reasoning should not exceed this number." if actual_batch_size else ""

user_prompt = f"""## Section Evidence Guidelines:
{section_guidelines}

## Classification to Evaluate:
- Taxonomy Value: {classification.get('value', 'N/A')}
- Confidence: {classification.get('confidence', 0.0)}
- Reasoning: {classification.get('reasoning', '')}

## Email Context (first 2000 chars of batch):
{email_context[:2000]}...
{batch_info}

## Your Task:
Evaluate if the reasoning provides VALID evidence per the guidelines above.

Focus on:
1. Is this the correct TYPE of evidence for this classification?
2. How strong is the evidence? (explicit, contextual, weak, or inappropriate)
3. Cite specific guideline violations if invalid
4. NOTE: If the reasoning cites emails beyond the snippet shown above but within the batch size ({actual_batch_size} emails), do NOT flag as hallucination - focus on evidence TYPE quality instead
```

### Fix 5: Reduce Evidence Quality Penalties (Lines 211-219 in evidence_judge.py)
**Changed:** Less harsh penalties for contextual/weak evidence
**File:** `src/email_parser/workflow/nodes/evidence_judge.py`

```python
# Adjust confidence with less harsh penalties for contextual/weak evidence
# - Explicit (1.0): No penalty
# - Contextual (0.7): Reduce penalty from 0.7x to 0.85x multiplier
# - Weak (0.4): Reduce penalty from 0.4x to 0.65x multiplier
# - Inappropriate (0.0): Full block
if evidence_type == "contextual" and 0.6 <= quality_score <= 0.8:
    # Less harsh penalty for contextual evidence
    adjusted_conf = original_conf * min(0.85, quality_score + 0.15)
elif evidence_type == "weak" and 0.3 <= quality_score <= 0.5:
    # Less harsh penalty for weak evidence
    adjusted_conf = original_conf * min(0.65, quality_score + 0.25)
else:
    # Standard penalty for explicit/inappropriate evidence
    adjusted_conf = original_conf * quality_score
```

### Fix 6: Relax Block Threshold (Line 242 in evidence_judge.py)
**Changed:** Block threshold from `0.01` → `0.15`
**File:** `src/email_parser/workflow/nodes/evidence_judge.py:242`

```python
def should_block_classification(quality_score: float, threshold: float = 0.15) -> bool:
```

## Technical Root Cause

The core issue was a **mismatch between what the agent analyzed vs. what the judge could verify**:

1. **Agent perspective**: Processes full 50-email batch with complete email content
2. **Evidence judge perspective**: Receives full email context BUT only shows 2000 chars in prompt to LLM judge
3. **Result**: LLM judge counts emails in truncated snippet (7-8 emails) and incorrectly flags citations to emails 9-50 as hallucinations

## Validation Strategy

The fix uses a **two-layer validation approach**:

1. **Pre-check (Programmatic)**: Catches true hallucinations where cited email numbers exceed actual batch size
2. **LLM Judge (Contextual)**: Evaluates evidence TYPE quality, explicitly told not to flag citations within batch size as hallucinations

This separates concerns:
- **Hallucination detection**: Handled programmatically with exact batch size
- **Evidence quality**: Handled by LLM judge focusing on appropriateness, not existence

## Testing Recommendations

After running the next test, verify:

1. **Fewer hallucination flags**: Check logs for "HALLUCINATION" warnings - should only appear for true hallucinations (citations > batch_size)
2. **More classifications passing**: Compare total classifications in database to previous runs (was 18→24, should increase significantly)
3. **Evidence quality focus**: Judge should focus on evidence TYPE (explicit/contextual/weak/inappropriate) rather than email existence
4. **Log patterns**: Look for "Evidence Judge Decision" logs showing PASS vs BLOCK with quality scores

## Files Modified

1. `src/email_parser/agents/demographics_agent.py` - Lines 63, 202
2. `src/email_parser/agents/household_agent.py` - Lines 63, 197
3. `src/email_parser/agents/interests_agent.py` - Lines 63, 200
4. `src/email_parser/agents/purchase_agent.py` - Lines 63, 201
5. `src/email_parser/workflow/nodes/evidence_judge.py` - Lines 63-90, 92-114, 211-219, 242

## Expected Outcome

With these fixes:
- **True hallucinations** (citations > batch_size) will be caught by pre-check
- **Valid classifications** with citations to emails within batch will pass through judge
- **Evidence quality** will be evaluated based on appropriateness, not email visibility
- **More classifications** should survive to final profile, providing better user reflection
