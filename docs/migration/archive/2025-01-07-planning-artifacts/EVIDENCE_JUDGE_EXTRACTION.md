# Evidence Judge Extraction Document

**Source:** `src/email_parser/workflow/nodes/evidence_judge.py`
**Lines:** 366 lines
**Purpose:** LLM-as-Judge pattern to validate classification evidence quality

---

## Overview

The Evidence Judge prevents inappropriate inferences (e.g., age from products, gender from interests) by validating evidence quality BEFORE confidence enters Bayesian tracking.

**Core Concept:**
- Agent makes classification with reasoning
- Judge LLM evaluates if reasoning provides appropriate evidence
- Quality score adjusts confidence (inappropriate evidence → 0 confidence)
- Blocks completely inappropriate classifications from memory

**Key Innovation:** Prevents garbage-in-garbage-out in Bayesian tracking by validating evidence TYPE, not just presence.

---

## Elements to Port (16 total)

### 1. Quality Scale Constants (Lines 22-25)
```python
QUALITY_EXPLICIT = 1.0      # Direct statement (stated age, title Mr./Ms.)
QUALITY_CONTEXTUAL = 0.7    # Strong inference (graduation year → age)
QUALITY_WEAK = 0.4          # Indirect signal (barely supports)
QUALITY_INAPPROPRIATE = 0.0 # Wrong evidence type (products → age)
```

**Purpose:** Standard scale for evidence quality scoring

### 2. Function: `evaluate_evidence_quality` (Lines 28-181)
**Purpose:** Single classification evaluation with LLM-as-Judge
**Parameters:**
- `classification: Dict[str, Any]` - Agent's classification with reasoning
- `email_context: str` - Email content for context
- `section_guidelines: str` - Section-specific evidence rules
- `llm_client: Any` - AnalyzerLLMClient instance
- `actual_batch_size: int` - For hallucination detection
**Returns:** Dict with is_valid, quality_score, evidence_type, issue

**Key Logic:**
1. **Hallucination Detection (lines 63-90):**
   - Check if email_numbers array contains values > actual_batch_size
   - Regex search reasoning for "Email N" citations
   - Return quality_score=0.0 with HALLUCINATION issue

2. **Build Judge Prompt (lines 93-122):**
   - Include section guidelines
   - Show classification (value, confidence, reasoning)
   - Show email context (first 2000 chars)
   - Add batch size note
   - Request JSON response

3. **Call Judge LLM (lines 124-140):**
   - Use `llm_client.call_json()` (not analyze_email)
   - Temperature: 0.1 (deterministic)
   - Auto-calculate max_tokens from context window

4. **Parse Response (lines 142-170):**
   - Extract is_valid, quality_score, evidence_type, issue
   - Clamp quality_score to [0.0, 1.0]
   - Map evidence_type to quality_score if missing

5. **Error Handling (lines 173-181):**
   - Return neutral (is_valid=true, quality=0.7) on error
   - Don't block on judge failure

### 3. Function: `evaluate_evidence_quality_batch` (Lines 184-265)
**Purpose:** Parallel batch evaluation for performance
**Parameters:**
- `classifications: List[Dict[str, Any]]` - Multiple classifications
- `email_context: str` - Email content
- `section_guidelines: str` - Evidence rules
- `llm_client: Any` - AnalyzerLLMClient
- `max_workers: int` - Parallel threads (default: 5)
- `actual_batch_size: int` - For hallucination detection
**Returns:** List of evidence evaluation dicts (same order as input)

**Key Logic:**
1. **Empty Check (lines 220-221):** Return [] if no classifications
2. **Single Optimization (lines 224-227):** Direct call if len==1 (no threading)
3. **Parallel Execution (lines 229-265):**
   - ThreadPoolExecutor with max_workers
   - Submit all tasks with index tracking
   - Collect results as_completed
   - Preserve order with results[index]

**Browser Challenge:** ThreadPoolExecutor → Web Workers OR sequential

### 4. Function: `adjust_confidence_with_evidence_quality` (Lines 268-330)
**Purpose:** Adjust classification confidence based on evidence quality
**Parameters:**
- `classification: Dict[str, Any]` - Original classification
- `evidence_evaluation: Dict[str, Any]` - Judge result
**Returns:** Updated classification dict

**Key Logic:**
1. **Extract Values (lines 293-295):**
   - original_conf from classification
   - quality_score from evaluation
   - evidence_type from evaluation

2. **Adjusted Penalties (lines 297-310):**
   - Explicit (1.0): No penalty (multiplier = 1.0)
   - Contextual (0.7): Less harsh → 0.85x multiplier
   - Weak (0.4): Less harsh → 0.65x multiplier
   - Inappropriate (0.0): Full block (multiplier = 0.0)

3. **Formula:**
   ```python
   # Standard:
   adjusted_conf = original_conf * quality_score

   # Contextual (0.6-0.8):
   adjusted_conf = original_conf * min(0.85, quality_score + 0.15)

   # Weak (0.3-0.5):
   adjusted_conf = original_conf * min(0.65, quality_score + 0.25)
   ```

4. **Update Classification (lines 322-329):**
   - Set confidence = adjusted_conf
   - Set original_confidence = original_conf
   - Set evidence_quality = quality_score
   - Set evidence_type = type
   - Set evidence_issue = issue (if present)

5. **Logging (lines 313-319):** Warn if confidence drops >20%

### 5. Function: `should_block_classification` (Lines 333-353)
**Purpose:** Determine if classification should be blocked entirely
**Parameters:**
- `quality_score: float` - Evidence quality [0.0, 1.0]
- `threshold: float` - Minimum quality (default: 0.15)
**Returns:** bool (True = block, False = allow)

**Logic:** `return quality_score < threshold`

**Usage:** Filter out completely inappropriate classifications before memory storage

---

## Hallucination Detection Details

### Method 1: email_numbers Array Check (Lines 69-77)
```python
if actual_batch_size and email_numbers:
    max_cited = max(email_numbers)
    if max_cited > actual_batch_size:
        return {
            "is_valid": False,
            "quality_score": 0.0,
            "evidence_type": "inappropriate",
            "issue": f"HALLUCINATION: Reasoning cites Email {max_cited} but batch only contains {actual_batch_size} emails."
        }
```

**Purpose:** Catch when agent cites non-existent emails in structured data

### Method 2: Regex Text Search (Lines 80-90)
```python
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

**Purpose:** Catch when agent mentions emails in free-text reasoning

**Pattern:** Matches "Email 15", "email 20", "EMAIL 5"

---

## Judge Prompt Structure

### System Prompt (Line 126)
From centralized `JUDGE_SYSTEM_PROMPT` constant in prompts module.

### User Prompt (Lines 95-122)
```
## Section Evidence Guidelines:
{section_guidelines}

## Classification to Evaluate:
- Taxonomy Value: {value}
- Confidence: {confidence}
- Reasoning: {reasoning}

## Email Context (first 2000 chars of batch):
{email_context[:2000]}...

NOTE: The agent analyzed a batch of {actual_batch_size} emails.

## Your Task:
Evaluate if the reasoning provides VALID evidence per the guidelines above.

Focus on:
1. Is this the correct TYPE of evidence for this classification?
2. How strong is the evidence? (explicit, contextual, weak, or inappropriate)
3. Cite specific guideline violations if invalid
4. NOTE: If the reasoning cites emails beyond the snippet shown above but within the batch size, do NOT flag as hallucination

Return ONLY JSON (no markdown):
{
  "is_valid": true/false,
  "quality_score": 0.0-1.0,
  "evidence_type": "explicit|contextual|weak|inappropriate",
  "issue": "explanation if invalid"
}
```

**Key Design:**
- Shows section-specific guidelines (different for demographics vs interests)
- Shows classification to evaluate
- Shows partial email context (first 2000 chars only to save tokens)
- Clarifies batch size to prevent false hallucination flags
- Requests structured JSON response

---

## Parallel Execution Strategy

### Python Implementation (Lines 251-263)
```python
with ThreadPoolExecutor(max_workers=max_workers) as executor:
    # Submit all tasks
    futures = {
        executor.submit(evaluate_single, i, classification): i
        for i, classification in enumerate(classifications)
    }

    # Collect results as they complete
    for future in as_completed(futures):
        index, result = future.result()
        results[index] = result
```

**Features:**
- Parallel execution (5 workers by default)
- Index tracking to preserve order
- Error handling per task (doesn't crash batch)

### Browser Options

**Option 1: Web Workers (Complex)**
- Create Worker pool for parallel LLM calls
- Message passing for communication
- Requires separate worker file
- Better performance for large batches

**Option 2: Sequential Execution (Simple)**
- Use async/await with sequential loop
- Simpler implementation
- Still fast with async I/O
- Recommended for initial migration

**Option 3: Promise.all (Middle Ground)**
- Launch all LLM calls concurrently
- `await Promise.all(promises)`
- Browser handles I/O concurrency
- Good balance of simplicity and performance

**Recommended:** Option 3 (Promise.all) for browser

---

## Confidence Adjustment Formula

### Standard Penalty
```python
adjusted_conf = original_conf * quality_score
```

**Examples:**
- 0.9 × 1.0 = 0.9 (explicit, no penalty)
- 0.9 × 0.7 = 0.63 (contextual, 30% penalty)
- 0.9 × 0.4 = 0.36 (weak, 60% penalty)
- 0.9 × 0.0 = 0.0 (inappropriate, full block)

### Less Harsh Penalties (Lines 302-310)

**Contextual Evidence (0.6-0.8 quality):**
```python
adjusted_conf = original_conf * min(0.85, quality_score + 0.15)
```
- 0.9 × 0.85 = 0.765 (instead of 0.63)
- Reduces penalty from 30% to 15%

**Weak Evidence (0.3-0.5 quality):**
```python
adjusted_conf = original_conf * min(0.65, quality_score + 0.25)
```
- 0.9 × 0.65 = 0.585 (instead of 0.36)
- Reduces penalty from 60% to 35%

**Rationale:** Don't be too harsh on valid but indirect evidence. Reserve full penalties for truly inappropriate evidence.

---

## Quality Score Mapping (Lines 152-159)

If LLM provides evidence_type but quality_score==0.0, map type to score:

```python
quality_map = {
    "explicit": QUALITY_EXPLICIT,       # 1.0
    "contextual": QUALITY_CONTEXTUAL,   # 0.7
    "weak": QUALITY_WEAK,               # 0.4
    "inappropriate": QUALITY_INAPPROPRIATE # 0.0
}
quality_score = quality_map.get(evidence_type, 0.0)
```

**Purpose:** Fallback if judge LLM doesn't provide numeric score

---

## Error Handling Philosophy

### On Judge Failure (Lines 173-181)
```python
except Exception as e:
    logger.error(f"Evidence judge error: {e}", exc_info=True)
    # Default to neutral (don't block) on error
    return {
        "is_valid": True,
        "quality_score": 0.7,  # Neutral default
        "evidence_type": "unknown",
        "issue": f"Judge error: {str(e)}"
    }
```

**Philosophy:** Don't block classifications if judge fails. Better to allow questionable evidence than block valid evidence due to technical failure.

**Neutral Score:** 0.7 (contextual quality level)

---

## Browser Adaptations

### 1. Regex Pattern Matching
✅ Native support in browser JavaScript
```typescript
const emailRefs = reasoning.match(/\bEmail\s+(\d+)\b/gi)
```

### 2. ThreadPoolExecutor → Promise.all
```typescript
// Python: ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {...}

// TypeScript: Promise.all
const promises = classifications.map((cls, i) =>
  evaluateSingle(i, cls)
)
const results = await Promise.all(promises)
```

### 3. Async/Await Throughout
All functions should be async:
- `evaluateEvidenceQuality()` → async
- `evaluateEvidenceQualityBatch()` → async
- LLM calls with await

### 4. Import from Prompts Module
```typescript
import { JUDGE_SYSTEM_PROMPT } from '../prompts'
```

---

## Usage Patterns

### Pattern 1: Single Classification Validation
```python
evaluation = evaluate_evidence_quality(
    classification={"value": "Male", "reasoning": "Marital status mentioned"},
    email_context=email_batch,
    section_guidelines=DEMOGRAPHICS_GUIDELINES,
    llm_client=client,
    actual_batch_size=20
)

if evaluation["quality_score"] < 0.15:
    # Block completely inappropriate
    pass
else:
    # Adjust confidence
    classification = adjust_confidence_with_evidence_quality(
        classification, evaluation
    )
```

### Pattern 2: Batch Validation
```python
evaluations = evaluate_evidence_quality_batch(
    classifications=all_classifications,
    email_context=email_batch,
    section_guidelines=DEMOGRAPHICS_GUIDELINES,
    llm_client=client,
    max_workers=5,
    actual_batch_size=20
)

for classification, evaluation in zip(all_classifications, evaluations):
    if should_block_classification(evaluation["quality_score"]):
        continue  # Skip this classification

    adjust_confidence_with_evidence_quality(classification, evaluation)
```

---

## Summary

**Total Elements:** 16
- 4 quality constants
- 4 main functions
- Hallucination detection (2 methods)
- Parallel execution
- Confidence adjustment with less harsh penalties
- Blocking threshold

**Key Features:**
- **LLM-as-Judge pattern** - Validates evidence TYPE not just presence
- **Hallucination detection** - Catches citations of non-existent emails
- **Parallel execution** - 5-20x faster for batches
- **Confidence adjustment** - Reduces impact of inappropriate evidence
- **Graceful degradation** - Neutral default on judge failure

**Migration Priority:** HIGH - Critical for preventing garbage inferences in Bayesian tracking

---

**Next Steps:**
1. Create TypeScript implementation
2. Use Promise.all for parallel execution (browser-friendly)
3. Adapt regex for browser
4. Keep all hallucination detection logic
5. Test with all quality levels (explicit, contextual, weak, inappropriate)
6. Verify confidence adjustment formulas
