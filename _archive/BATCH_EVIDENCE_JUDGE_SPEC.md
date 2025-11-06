# Batch Evidence Judge Validation - Detailed Specification

**Date**: 2025-10-10
**Priority**: HIGH - Performance Bottleneck (57% of Step 3 execution time)
**Target**: Reduce 100 evidence judge calls → 4 batch calls (10x speedup)

---

## Executive Summary

### Problem Statement
Evidence judge validation currently processes classifications **one at a time**, making individual LLM calls for each classification. This creates a massive performance bottleneck:

- **Current**: 100 classifications = 100 LLM calls = 20 minutes
- **Target**: 100 classifications = 4 batch calls (25 per batch) = 2 minutes
- **Speedup**: 10x faster Step 3 execution

### Current Performance Metrics (200-email test)
```
Step 3 Total Time: 35 minutes
├── Evidence Judge: 20 minutes (57%) ← BOTTLENECK
└── Everything Else: 15 minutes (43%)

Evidence Judge Breakdown:
- 100 individual LLM calls
- ~12 seconds per call (network + processing)
- Sequential execution (no parallelization)
```

### Target Performance
```
Step 3 Target Time: 7 minutes (80% reduction)
├── Evidence Judge: 2 minutes (29%)
└── Everything Else: 5 minutes (71%)

Evidence Judge Optimized:
- 4 batch LLM calls (25 classifications each)
- ~30 seconds per batch
- Same quality validation
```

---

## Critical Lessons from Previous Batch Migration

### What Went Wrong (October 9, 2025)

**Issue**: LLMs ignored `email_number` field despite heavy prompting, breaking provenance tracking.

**Root Cause**: LLMs optimize for core task completion and treat metadata fields as optional, even with:
- ⚠️ Warning emojis
- CAPITALIZED instructions
- Multiple reminders
- Inline examples
- Explicit "DO NOT FORGET" statements

**Impact**:
```
Logs showed: "Provenance tracked: 0/X have email_id"
Result: Lost audit trail, debugging difficult, compliance risk
```

**Affected Models**: Claude Sonnet 4.5, OpenAI GPT-5-mini, OpenAI GPT-4o-mini

### Key Design Principle for This Migration

**❌ DON'T**: Rely on LLM to return structured metadata (e.g., classification IDs, array indices)

**✅ DO**:
1. Pass classifications in **deterministic order** (numbered list)
2. Get **simple ordered response** from LLM
3. **Programmatically map** response items back to classifications by position
4. **Validate** mapping with sanity checks

---

## Current Architecture Analysis

### Evidence Judge Current Implementation

**File**: `src/email_parser/workflow/nodes/evidence_judge.py`

```python
def evaluate_evidence_quality(
    classification: Dict[str, Any],      # SINGLE classification
    email_context: str,                   # Full batch context
    section_guidelines: str,
    llm_client: Any
) -> Dict[str, Any]:
    """Evaluate evidence quality for ONE classification."""
```

**Current Call Pattern** in `analyzers.py:241-264`:

```python
validated_classifications = []
for classification in classifications:
    # ❌ BOTTLENECK: Individual LLM call per classification
    evidence_eval = evaluate_evidence_quality(
        classification=classification,
        email_context=email_context,
        section_guidelines=DEMOGRAPHICS_EVIDENCE_GUIDELINES,
        llm_client=llm_client
    )

    classification = adjust_confidence_with_evidence_quality(
        classification, evidence_eval
    )

    if should_block_classification(evidence_eval["quality_score"]):
        logger.warning(f"Blocked inappropriate inference...")
        continue

    validated_classifications.append(classification)
```

**Pattern Repeated**: All 4 analyzers (demographics, household, interests, purchase)

---

## Proposed Batch Architecture

### New Function Signature

**File**: `src/email_parser/workflow/nodes/evidence_judge.py` (NEW)

```python
def evaluate_evidence_quality_batch(
    classifications: List[Dict[str, Any]],  # Batch of classifications
    email_context: str,                      # Full batch context
    section_guidelines: str,                 # Section-specific rules
    llm_client: Any
) -> List[Dict[str, Any]]:
    """
    Batch evaluate evidence quality for multiple classifications.

    This replaces individual LLM calls with a single batch call for
    performance (10x speedup).

    Args:
        classifications: List of classification dicts to evaluate
        email_context: Email content context (already batched)
        section_guidelines: Evidence rules for this section
        llm_client: AnalyzerLLMClient instance

    Returns:
        List of evidence evaluation dicts, same order as input
        [
            {
                "is_valid": bool,
                "quality_score": float,
                "evidence_type": str,
                "issue": str
            },
            ...
        ]

    Design:
        1. Create numbered list of classifications for LLM
        2. Request ordered evaluation response
        3. Parse response and validate ordering
        4. Map evaluations back to classifications by position
        5. Return list maintaining input order

    Example:
        >>> evals = evaluate_evidence_quality_batch(
        ...     classifications=[c1, c2, c3],
        ...     email_context="...",
        ...     section_guidelines=DEMO_GUIDELINES,
        ...     llm_client=client
        ... )
        >>> len(evals) == len(classifications)  # True
        >>> evals[0]["quality_score"]           # Evaluation for c1
    """
```

### Batch Processing Strategy

#### Step 1: Build Batch Prompt

```python
def _build_batch_prompt(
    classifications: List[Dict[str, Any]],
    email_context: str,
    section_guidelines: str
) -> str:
    """
    Build prompt for batch evidence evaluation.

    Critical: Use NUMBERED LIST to establish order.
    LLM must return evaluations in SAME ORDER.
    """

    # Build classifications list
    classifications_text = []
    for i, classification in enumerate(classifications):
        classifications_text.append(
            f"{i+1}. Taxonomy Value: {classification.get('value')}\n"
            f"   Confidence: {classification.get('confidence', 0.0)}\n"
            f"   Reasoning: {classification.get('reasoning', '')}\n"
        )

    prompt = f"""## Section Evidence Guidelines:
{section_guidelines}

## Email Context:
{email_context[:500]}...

## Classifications to Evaluate (RETURN IN SAME ORDER):
{chr(10).join(classifications_text)}

## Your Task:
Evaluate ALL {len(classifications)} classifications for evidence quality.

For EACH classification, provide:
- is_valid: true/false
- quality_score: 0.0-1.0
- evidence_type: explicit|contextual|weak|inappropriate
- issue: explanation if invalid

CRITICAL: Return evaluations in SAME ORDER as classifications (1, 2, 3...).

Return JSON array:
[
  {{"is_valid": true, "quality_score": 0.9, "evidence_type": "explicit", "issue": ""}},
  {{"is_valid": false, "quality_score": 0.0, "evidence_type": "inappropriate", "issue": "..."}},
  ...
]

Array length MUST be {len(classifications)}."""

    return prompt
```

#### Step 2: Call LLM with Batch Prompt

```python
try:
    full_prompt = f"{JUDGE_SYSTEM_PROMPT}\n\n{user_prompt}"

    # Call LLM (max_tokens auto-calculated)
    response = llm_client.call_json(
        prompt=full_prompt,
        temperature=0.1
    )

    # Expect array response
    evaluations = response if isinstance(response, list) else response.get("evaluations", [])

except Exception as e:
    logger.error(f"Batch evidence judge error: {e}")
    # Fallback to individual validation
    return _fallback_to_individual_validation(
        classifications, email_context, section_guidelines, llm_client
    )
```

#### Step 3: Validate Response Structure

```python
def _validate_batch_response(
    evaluations: List[Dict],
    expected_count: int
) -> bool:
    """
    Validate batch response has correct structure.

    Checks:
    1. Is a list
    2. Has expected length
    3. All items have required keys
    """
    if not isinstance(evaluations, list):
        logger.error(f"Batch response not a list: {type(evaluations)}")
        return False

    if len(evaluations) != expected_count:
        logger.error(
            f"Batch response length mismatch: got {len(evaluations)}, "
            f"expected {expected_count}"
        )
        return False

    required_keys = ["is_valid", "quality_score", "evidence_type"]
    for i, eval_dict in enumerate(evaluations):
        if not all(k in eval_dict for k in required_keys):
            logger.error(
                f"Evaluation {i+1} missing required keys. "
                f"Has: {eval_dict.keys()}, needs: {required_keys}"
            )
            return False

    return True
```

#### Step 4: Map Back to Classifications

```python
def _map_evaluations_to_classifications(
    classifications: List[Dict[str, Any]],
    evaluations: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Map batch evaluations back to classifications by position.

    This is DETERMINISTIC - relies on array order, not LLM-generated IDs.

    Args:
        classifications: Original classification list
        evaluations: Evaluation list from LLM (same order)

    Returns:
        List of evaluations with sanity check validation
    """
    if len(classifications) != len(evaluations):
        raise ValueError(
            f"Length mismatch: {len(classifications)} classifications, "
            f"{len(evaluations)} evaluations"
        )

    # Map by position
    mapped_evaluations = []
    for i, (classification, evaluation) in enumerate(zip(classifications, evaluations)):
        # Sanity check: Does evaluation reference the classification value?
        # (Optional - helps catch response ordering issues)
        classification_value = classification.get('value', '')

        # Add classification context to evaluation
        evaluation['classification_index'] = i
        evaluation['classification_value'] = classification_value

        mapped_evaluations.append(evaluation)

        logger.debug(
            f"Mapped evaluation {i+1}/{len(classifications)}: "
            f"{classification_value} → {evaluation.get('evidence_type')} "
            f"(quality={evaluation.get('quality_score'):.2f})"
        )

    return mapped_evaluations
```

#### Step 5: Graceful Fallback

```python
def _fallback_to_individual_validation(
    classifications: List[Dict[str, Any]],
    email_context: str,
    section_guidelines: str,
    llm_client: Any
) -> List[Dict[str, Any]]:
    """
    Fallback to individual validation if batch fails.

    Use cases:
    - Batch response parsing error
    - Length mismatch
    - LLM timeout

    This ensures system never fails completely due to batch optimization.
    """
    logger.warning(
        f"Falling back to individual validation for {len(classifications)} "
        f"classifications"
    )

    evaluations = []
    for classification in classifications:
        try:
            # Call original single-classification function
            evaluation = evaluate_evidence_quality(
                classification=classification,
                email_context=email_context,
                section_guidelines=section_guidelines,
                llm_client=llm_client
            )
            evaluations.append(evaluation)
        except Exception as e:
            logger.error(f"Individual validation failed for {classification.get('value')}: {e}")
            # Default to neutral evaluation
            evaluations.append({
                "is_valid": True,
                "quality_score": 0.7,
                "evidence_type": "unknown",
                "issue": f"Validation error: {str(e)}"
            })

    return evaluations
```

### Updated Analyzer Call Pattern

**File**: `src/email_parser/workflow/nodes/analyzers.py` (MODIFIED)

```python
# BEFORE (Current):
validated_classifications = []
for classification in classifications:
    evidence_eval = evaluate_evidence_quality(...)  # ❌ 100 calls
    classification = adjust_confidence_with_evidence_quality(...)
    if should_block_classification(...):
        continue
    validated_classifications.append(classification)

# AFTER (Optimized):
from .evidence_judge import evaluate_evidence_quality_batch

# Single batch call for all classifications
evaluations = evaluate_evidence_quality_batch(
    classifications=classifications,
    email_context=email_context,
    section_guidelines=DEMOGRAPHICS_EVIDENCE_GUIDELINES,
    llm_client=llm_client
)

# Process results in parallel (no LLM calls)
validated_classifications = []
for classification, evaluation in zip(classifications, evaluations):
    classification = adjust_confidence_with_evidence_quality(
        classification, evaluation
    )

    if should_block_classification(evaluation["quality_score"]):
        logger.warning(f"Blocked inappropriate inference...")
        continue

    validated_classifications.append(classification)
```

---

## Edge Cases and Error Handling

### Edge Case Matrix

| Scenario | Behavior | Test |
|----------|----------|------|
| **Empty classifications list** | Return empty list immediately | `test_batch_empty_list()` |
| **Single classification** | Batch process (no special case) | `test_batch_single_item()` |
| **LLM returns wrong length** | Fall back to individual validation | `test_batch_length_mismatch()` |
| **LLM returns invalid JSON** | Fall back to individual validation | `test_batch_json_error()` |
| **LLM returns non-array** | Fall back to individual validation | `test_batch_non_array_response()` |
| **Missing required keys** | Fall back to individual validation | `test_batch_missing_keys()` |
| **LLM timeout** | Fall back to individual validation | `test_batch_timeout()` |
| **One evaluation fails** | Continue with remaining, log error | `test_batch_partial_failure()` |
| **Large batch (50+)** | Process successfully | `test_batch_large_size()` |
| **Context window exceeded** | Fall back or split batch | `test_batch_context_overflow()` |

### Error Handling Strategy

```python
def evaluate_evidence_quality_batch(
    classifications: List[Dict[str, Any]],
    email_context: str,
    section_guidelines: str,
    llm_client: Any
) -> List[Dict[str, Any]]:
    """Batch evidence evaluation with comprehensive error handling."""

    # Edge case: Empty list
    if not classifications:
        logger.debug("Empty classifications list, returning empty evaluations")
        return []

    # Edge case: Single classification (still batch)
    if len(classifications) == 1:
        logger.debug("Single classification batch (no special handling)")

    try:
        # Build batch prompt
        user_prompt = _build_batch_prompt(
            classifications, email_context, section_guidelines
        )

        # Estimate token count for context window check
        estimated_tokens = len(user_prompt) // 4
        if estimated_tokens > llm_client.context_window * 0.7:
            logger.warning(
                f"Batch prompt too large ({estimated_tokens} tokens), "
                f"falling back to individual validation"
            )
            return _fallback_to_individual_validation(
                classifications, email_context, section_guidelines, llm_client
            )

        # Call LLM
        full_prompt = f"{JUDGE_SYSTEM_PROMPT}\n\n{user_prompt}"
        response = llm_client.call_json(
            prompt=full_prompt,
            temperature=0.1
        )

        # Parse response
        evaluations = response if isinstance(response, list) else response.get("evaluations", [])

        # Validate structure
        if not _validate_batch_response(evaluations, len(classifications)):
            logger.warning("Batch response validation failed, falling back")
            return _fallback_to_individual_validation(
                classifications, email_context, section_guidelines, llm_client
            )

        # Map back to classifications
        mapped_evaluations = _map_evaluations_to_classifications(
            classifications, evaluations
        )

        logger.info(
            f"✅ Batch evidence judge: {len(classifications)} classifications "
            f"evaluated in single LLM call"
        )

        return mapped_evaluations

    except Exception as e:
        logger.error(f"Batch evidence judge error: {e}", exc_info=True)
        return _fallback_to_individual_validation(
            classifications, email_context, section_guidelines, llm_client
        )
```

---

## Context Window Management

### Batch Size Calculation

```python
def _calculate_optimal_batch_size(
    classifications: List[Dict[str, Any]],
    email_context_length: int,
    context_window: int
) -> int:
    """
    Calculate optimal batch size based on context window.

    Formula:
    - Email context: Fixed size (already trimmed to 500 chars/email)
    - Guidelines: ~2000 tokens
    - System prompt: ~1000 tokens
    - Per-classification overhead: ~100 tokens

    Reserve 30% of context window for response.
    """
    # Estimate base overhead
    base_tokens = 3000  # Guidelines + system prompt
    email_context_tokens = email_context_length // 4

    # Available for classifications
    available_for_classifications = int(context_window * 0.7) - base_tokens - email_context_tokens

    # Per-classification cost
    tokens_per_classification = 100

    max_batch_size = available_for_classifications // tokens_per_classification

    # Cap at reasonable limit
    max_batch_size = min(max_batch_size, 50)

    logger.debug(
        f"Batch size calculation: context_window={context_window}, "
        f"available={available_for_classifications}, "
        f"max_batch={max_batch_size}"
    )

    return max_batch_size
```

### Automatic Batch Splitting

```python
def evaluate_evidence_quality_batch_auto_split(
    classifications: List[Dict[str, Any]],
    email_context: str,
    section_guidelines: str,
    llm_client: Any
) -> List[Dict[str, Any]]:
    """
    Automatically split large batches to fit context window.

    If classifications list exceeds optimal batch size, split into
    multiple batches and process sequentially.
    """
    # Calculate optimal batch size
    optimal_size = _calculate_optimal_batch_size(
        classifications=classifications,
        email_context_length=len(email_context),
        context_window=llm_client.context_window
    )

    # Check if split needed
    if len(classifications) <= optimal_size:
        # Single batch
        return evaluate_evidence_quality_batch(
            classifications, email_context, section_guidelines, llm_client
        )

    # Split into batches
    logger.info(
        f"Splitting {len(classifications)} classifications into batches "
        f"of {optimal_size}"
    )

    all_evaluations = []
    for i in range(0, len(classifications), optimal_size):
        batch = classifications[i:i+optimal_size]
        batch_evaluations = evaluate_evidence_quality_batch(
            batch, email_context, section_guidelines, llm_client
        )
        all_evaluations.extend(batch_evaluations)

    return all_evaluations
```

---

## Testing Strategy

### Unit Tests (New File: `tests/unit/test_batch_evidence_judge.py`)

```python
"""
Unit tests for batch evidence judge validation.

Tests verify that batch processing:
1. Maintains correct evaluation order
2. Handles all edge cases gracefully
3. Falls back correctly on errors
4. Produces same quality as individual validation
"""

import pytest
from unittest.mock import MagicMock, patch
from src.email_parser.workflow.nodes.evidence_judge import (
    evaluate_evidence_quality_batch,
    _build_batch_prompt,
    _validate_batch_response,
    _map_evaluations_to_classifications,
    _fallback_to_individual_validation
)


class TestBatchEvidenceJudge:
    """Test batch evidence validation."""

    def test_batch_empty_list(self):
        """Test empty classifications list."""
        result = evaluate_evidence_quality_batch(
            classifications=[],
            email_context="",
            section_guidelines="",
            llm_client=MagicMock()
        )
        assert result == []

    def test_batch_single_classification(self, mock_llm_client):
        """Test single classification in batch mode."""
        mock_llm_client.call_json.return_value = [
            {
                "is_valid": True,
                "quality_score": 0.9,
                "evidence_type": "explicit",
                "issue": ""
            }
        ]

        classifications = [
            {"value": "Male", "confidence": 0.9, "reasoning": "Title"}
        ]

        result = evaluate_evidence_quality_batch(
            classifications=classifications,
            email_context="Email 1: Test",
            section_guidelines="Guidelines",
            llm_client=mock_llm_client
        )

        assert len(result) == 1
        assert result[0]["quality_score"] == 0.9
        assert result[0]["evidence_type"] == "explicit"

    def test_batch_multiple_classifications(self, mock_llm_client):
        """Test batch with multiple classifications."""
        mock_llm_client.call_json.return_value = [
            {"is_valid": True, "quality_score": 0.9, "evidence_type": "explicit", "issue": ""},
            {"is_valid": True, "quality_score": 0.7, "evidence_type": "contextual", "issue": ""},
            {"is_valid": False, "quality_score": 0.0, "evidence_type": "inappropriate", "issue": "Wrong evidence"}
        ]

        classifications = [
            {"value": "Male", "confidence": 0.9, "reasoning": "Title"},
            {"value": "25-29", "confidence": 0.7, "reasoning": "Graduation year"},
            {"value": "Female", "confidence": 0.8, "reasoning": "Product purchase"}
        ]

        result = evaluate_evidence_quality_batch(
            classifications=classifications,
            email_context="Email context",
            section_guidelines="Guidelines",
            llm_client=mock_llm_client
        )

        # Verify order preserved
        assert len(result) == 3
        assert result[0]["quality_score"] == 0.9
        assert result[1]["quality_score"] == 0.7
        assert result[2]["quality_score"] == 0.0
        assert result[2]["is_valid"] == False

    def test_batch_length_mismatch_fallback(self, mock_llm_client):
        """Test fallback when LLM returns wrong array length."""
        # LLM returns 2 evaluations for 3 classifications
        mock_llm_client.call_json.return_value = [
            {"is_valid": True, "quality_score": 0.9, "evidence_type": "explicit", "issue": ""},
            {"is_valid": True, "quality_score": 0.7, "evidence_type": "contextual", "issue": ""}
        ]

        classifications = [
            {"value": "Male", "confidence": 0.9, "reasoning": "Title"},
            {"value": "25-29", "confidence": 0.7, "reasoning": "Year"},
            {"value": "Bachelor", "confidence": 0.8, "reasoning": "Degree"}
        ]

        with patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_individual:
            mock_individual.return_value = {
                "is_valid": True,
                "quality_score": 0.7,
                "evidence_type": "contextual",
                "issue": ""
            }

            result = evaluate_evidence_quality_batch(
                classifications=classifications,
                email_context="Email context",
                section_guidelines="Guidelines",
                llm_client=mock_llm_client
            )

            # Should fall back to individual validation
            assert mock_individual.call_count == 3
            assert len(result) == 3

    def test_batch_invalid_json_fallback(self, mock_llm_client):
        """Test fallback when LLM returns invalid JSON."""
        mock_llm_client.call_json.side_effect = ValueError("Invalid JSON")

        classifications = [
            {"value": "Male", "confidence": 0.9, "reasoning": "Title"}
        ]

        with patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_individual:
            mock_individual.return_value = {
                "is_valid": True,
                "quality_score": 0.7,
                "evidence_type": "unknown",
                "issue": "Fallback"
            }

            result = evaluate_evidence_quality_batch(
                classifications=classifications,
                email_context="Email context",
                section_guidelines="Guidelines",
                llm_client=mock_llm_client
            )

            assert mock_individual.call_count == 1
            assert len(result) == 1

    def test_batch_missing_keys_fallback(self, mock_llm_client):
        """Test fallback when evaluations missing required keys."""
        mock_llm_client.call_json.return_value = [
            {"is_valid": True}  # Missing quality_score, evidence_type
        ]

        classifications = [
            {"value": "Male", "confidence": 0.9, "reasoning": "Title"}
        ]

        with patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_individual:
            mock_individual.return_value = {
                "is_valid": True,
                "quality_score": 0.7,
                "evidence_type": "unknown",
                "issue": ""
            }

            result = evaluate_evidence_quality_batch(
                classifications=classifications,
                email_context="Email context",
                section_guidelines="Guidelines",
                llm_client=mock_llm_client
            )

            assert mock_individual.call_count == 1

    def test_batch_large_size(self, mock_llm_client):
        """Test batch with 50 classifications (max reasonable size)."""
        mock_llm_client.call_json.return_value = [
            {
                "is_valid": True,
                "quality_score": 0.7,
                "evidence_type": "contextual",
                "issue": ""
            }
            for _ in range(50)
        ]

        classifications = [
            {"value": f"Value{i}", "confidence": 0.7, "reasoning": f"Reason{i}"}
            for i in range(50)
        ]

        result = evaluate_evidence_quality_batch(
            classifications=classifications,
            email_context="Email context",
            section_guidelines="Guidelines",
            llm_client=mock_llm_client
        )

        assert len(result) == 50


class TestBatchPromptBuilder:
    """Test batch prompt construction."""

    def test_prompt_includes_all_classifications(self):
        """Test prompt includes all classifications in order."""
        classifications = [
            {"value": "Male", "confidence": 0.9, "reasoning": "Title"},
            {"value": "25-29", "confidence": 0.7, "reasoning": "Year"}
        ]

        prompt = _build_batch_prompt(
            classifications=classifications,
            email_context="Test context",
            section_guidelines="Test guidelines"
        )

        # Verify numbered list
        assert "1. Taxonomy Value: Male" in prompt
        assert "2. Taxonomy Value: 25-29" in prompt

        # Verify context
        assert "Test context" in prompt
        assert "Test guidelines" in prompt

        # Verify instructions
        assert "SAME ORDER" in prompt
        assert f"Array length MUST be {len(classifications)}" in prompt


class TestResponseValidation:
    """Test batch response validation."""

    def test_validate_correct_response(self):
        """Test validation passes for correct response."""
        evaluations = [
            {"is_valid": True, "quality_score": 0.9, "evidence_type": "explicit", "issue": ""},
            {"is_valid": False, "quality_score": 0.0, "evidence_type": "inappropriate", "issue": "Bad"}
        ]

        assert _validate_batch_response(evaluations, expected_count=2)

    def test_validate_wrong_length(self):
        """Test validation fails for wrong length."""
        evaluations = [
            {"is_valid": True, "quality_score": 0.9, "evidence_type": "explicit", "issue": ""}
        ]

        assert not _validate_batch_response(evaluations, expected_count=2)

    def test_validate_non_array(self):
        """Test validation fails for non-array response."""
        evaluations = {"error": "Not an array"}

        assert not _validate_batch_response(evaluations, expected_count=1)

    def test_validate_missing_keys(self):
        """Test validation fails when keys missing."""
        evaluations = [
            {"is_valid": True}  # Missing quality_score, evidence_type
        ]

        assert not _validate_batch_response(evaluations, expected_count=1)


class TestEvaluationMapping:
    """Test mapping evaluations to classifications."""

    def test_mapping_preserves_order(self):
        """Test mapping maintains classification order."""
        classifications = [
            {"value": "Male", "confidence": 0.9},
            {"value": "25-29", "confidence": 0.7}
        ]

        evaluations = [
            {"is_valid": True, "quality_score": 0.9, "evidence_type": "explicit", "issue": ""},
            {"is_valid": True, "quality_score": 0.7, "evidence_type": "contextual", "issue": ""}
        ]

        mapped = _map_evaluations_to_classifications(classifications, evaluations)

        assert len(mapped) == 2
        assert mapped[0]["quality_score"] == 0.9
        assert mapped[0]["classification_value"] == "Male"
        assert mapped[1]["quality_score"] == 0.7
        assert mapped[1]["classification_value"] == "25-29"

    def test_mapping_length_mismatch_raises(self):
        """Test mapping raises on length mismatch."""
        classifications = [{"value": "Male"}]
        evaluations = [{"quality_score": 0.9}, {"quality_score": 0.7}]

        with pytest.raises(ValueError, match="Length mismatch"):
            _map_evaluations_to_classifications(classifications, evaluations)


@pytest.fixture
def mock_llm_client():
    """Mock LLM client for testing."""
    mock = MagicMock()
    mock.context_window = 128000
    return mock
```

### Integration Tests

```python
"""Integration tests with real LLM calls."""

def test_batch_evidence_judge_e2e_openai():
    """Test batch evidence judge with OpenAI."""
    from src.email_parser.workflow.llm_wrapper import AnalyzerLLMClient

    llm_client = AnalyzerLLMClient(provider="openai", model="gpt-5-mini")

    classifications = [
        {
            "value": "Male",
            "confidence": 0.9,
            "reasoning": "Email contains 'Mr.' title in subject line"
        },
        {
            "value": "Female",
            "confidence": 0.8,
            "reasoning": "User purchased women's clothing"
        }
    ]

    email_context = """
    Email 1:
    Subject: Hello Mr. Smith
    Body: Welcome to our service

    Email 2:
    Subject: Your order confirmation
    Body: Women's dress shipped
    """

    from src.email_parser.workflow.prompts import DEMOGRAPHICS_EVIDENCE_GUIDELINES

    evaluations = evaluate_evidence_quality_batch(
        classifications=classifications,
        email_context=email_context,
        section_guidelines=DEMOGRAPHICS_EVIDENCE_GUIDELINES,
        llm_client=llm_client
    )

    # Verify results
    assert len(evaluations) == 2

    # First should be explicit (title)
    assert evaluations[0]["evidence_type"] in ["explicit", "contextual"]
    assert evaluations[0]["quality_score"] > 0.5

    # Second should be inappropriate (gender from product)
    assert evaluations[1]["evidence_type"] == "inappropriate"
    assert evaluations[1]["quality_score"] < 0.3
```

---

## Implementation Checklist

### Phase 1: Core Implementation (2-3 hours)

- [ ] **1.1** Create `evaluate_evidence_quality_batch()` function
  - [ ] Build batch prompt with numbered classifications
  - [ ] Call LLM with batch prompt
  - [ ] Parse and validate response structure
  - [ ] Map evaluations back to classifications

- [ ] **1.2** Implement helper functions
  - [ ] `_build_batch_prompt()`
  - [ ] `_validate_batch_response()`
  - [ ] `_map_evaluations_to_classifications()`

- [ ] **1.3** Implement fallback logic
  - [ ] `_fallback_to_individual_validation()`
  - [ ] Add error handling for all failure modes
  - [ ] Log fallback events for monitoring

### Phase 2: Analyzer Integration (1-2 hours)

- [ ] **2.1** Update demographics_analyzer_node
  - [ ] Replace loop with batch call
  - [ ] Test with mock LLM client

- [ ] **2.2** Update household_analyzer_node
  - [ ] Replace loop with batch call
  - [ ] Test with mock LLM client

- [ ] **2.3** Update interests_analyzer_node
  - [ ] Replace loop with batch call
  - [ ] Test with mock LLM client

- [ ] **2.4** Update purchase_analyzer_node
  - [ ] Replace loop with batch call
  - [ ] Test with mock LLM client

### Phase 3: Testing (3-4 hours)

- [ ] **3.1** Write unit tests
  - [ ] Test empty list edge case
  - [ ] Test single classification
  - [ ] Test multiple classifications
  - [ ] Test length mismatch fallback
  - [ ] Test JSON error fallback
  - [ ] Test missing keys fallback
  - [ ] Test large batch (50 items)
  - [ ] Test prompt builder
  - [ ] Test response validator
  - [ ] Test evaluation mapper

- [ ] **3.2** Write integration tests
  - [ ] Test with OpenAI gpt-5-mini
  - [ ] Test with Claude Sonnet 4.5
  - [ ] Test end-to-end with real emails

- [ ] **3.3** Performance testing
  - [ ] Measure individual vs batch timing
  - [ ] Verify 10x speedup target
  - [ ] Test with 100-email corpus
  - [ ] Test with 200-email corpus

### Phase 4: E2E Validation (1-2 hours)

- [ ] **4.1** Run E2E test via dashboard
  - [ ] 100-email test (50 Gmail + 50 Outlook)
  - [ ] Verify Step 3 time reduced 35min → 7min
  - [ ] Verify evidence judge time 20min → 2min
  - [ ] Verify 0 errors in error log

- [ ] **4.2** Validate output quality
  - [ ] Same number of classifications as before
  - [ ] Quality scores match individual validation
  - [ ] No inappropriate inferences passed
  - [ ] Provenance tracking intact

### Phase 5: Documentation & Deployment (1 hour)

- [ ] **5.1** Update documentation
  - [ ] Add batch processing notes to evidence_judge.py
  - [ ] Update CLAUDE.md with performance improvements
  - [ ] Create migration notes document

- [ ] **5.2** Deployment
  - [ ] Merge to main branch
  - [ ] Tag release version
  - [ ] Update dashboard with performance notes

---

## Rollback Plan

### If Batch Processing Fails

**Symptoms**:
- Step 3 crashes during evidence validation
- Classification quality degrades
- Evidence judge errors in logs

**Rollback Steps**:

1. **Immediate**: Disable batch processing via feature flag
   ```python
   # In evidence_judge.py
   USE_BATCH_VALIDATION = False  # Set to False to rollback

   if USE_BATCH_VALIDATION:
       return evaluate_evidence_quality_batch(...)
   else:
       # Use original loop
       for classification in classifications:
           evaluate_evidence_quality(...)
   ```

2. **Monitor**: Check logs for fallback frequency
   ```bash
   grep "falling back to individual validation" logs/*.log
   ```

3. **Investigate**: Identify failure pattern
   - Which LLM provider?
   - Which analyzer (demographics, household, interests, purchase)?
   - Specific batch size?

4. **Fix**: Address root cause
   - Update prompt if LLM response format wrong
   - Adjust batch size if context window exceeded
   - Add additional validation if response parsing fails

---

## Success Metrics

### Performance Targets

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| **Step 3 Duration (100 emails)** | 35 minutes | 7 minutes | E2E test timing |
| **Evidence Judge Duration** | 20 minutes | 2 minutes | Evidence judge log timestamps |
| **LLM Calls per 100 classifications** | 100 | 4 | LLM call counter |
| **Average time per batch** | 12 sec/classification | 30 sec/batch | Performance logs |

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Classification count** | Same as before | Compare E2E outputs |
| **Quality score accuracy** | ±5% of individual | Compare batch vs individual |
| **Fallback frequency** | <5% of batches | Monitor fallback logs |
| **Error rate** | 0% | Error log size |

---

## Open Questions & Decisions Needed

### Question 1: Batch Size Limit
**Q**: Should we enforce a maximum batch size?
**Options**:
- A: No limit (trust context window calculation)
- B: Cap at 25 classifications
- C: Cap at 50 classifications

**Recommendation**: Option C (50 cap) for safety

### Question 2: Fallback Strategy
**Q**: When fallback triggered, should we retry batch with smaller size?
**Options**:
- A: Fall back to individual immediately
- B: Try half-size batch, then individual
- C: Log failure and skip validation (risky)

**Recommendation**: Option A for simplicity, Option B for resilience

### Question 3: Monitoring
**Q**: How to monitor batch validation performance in production?
**Options**:
- A: Log batch size and timing
- B: Track fallback frequency
- C: Compare batch vs individual quality scores
- D: All of the above

**Recommendation**: Option D

---

## Timeline

### Estimated Effort: 8-12 hours

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| **Phase 1: Core Implementation** | 2-3 hours | None |
| **Phase 2: Analyzer Integration** | 1-2 hours | Phase 1 complete |
| **Phase 3: Testing** | 3-4 hours | Phase 2 complete |
| **Phase 4: E2E Validation** | 1-2 hours | Phase 3 passing |
| **Phase 5: Documentation** | 1 hour | Phase 4 validated |

### Milestones

- [x] Specification complete (2025-10-10)
- [ ] Phase 1 complete (core implementation)
- [ ] Phase 2 complete (analyzer integration)
- [ ] Phase 3 complete (all tests passing)
- [ ] Phase 4 complete (E2E validation)
- [ ] Phase 5 complete (deployed to main)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Owner**: Claude Code
**Reviewers**: User
