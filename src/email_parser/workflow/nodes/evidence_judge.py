"""
Evidence Quality Judge

Uses LLM-as-Judge pattern to evaluate if classification reasoning
provides appropriate evidence per IAB Taxonomy guidelines.

This prevents inappropriate inferences (e.g., age from products, gender from interests)
by validating evidence quality BEFORE confidence enters Bayesian tracking.
"""

import logging
from typing import Dict, Any, List
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import prompt from centralized location
from ..prompts import JUDGE_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


# Evidence quality scale
QUALITY_EXPLICIT = 1.0      # Direct statement (stated age, title Mr./Ms.)
QUALITY_CONTEXTUAL = 0.7    # Strong inference (graduation year → age)
QUALITY_WEAK = 0.4          # Indirect signal (barely supports)
QUALITY_INAPPROPRIATE = 0.0 # Wrong evidence type (products → age)


def evaluate_evidence_quality(
    classification: Dict[str, Any],
    email_context: str,
    section_guidelines: str,
    llm_client: Any,
    actual_batch_size: int = None
) -> Dict[str, Any]:
    """
    Use LLM to judge if reasoning is appropriate evidence for classification.

    Args:
        classification: Agent's classification dict with reasoning
        email_context: Email content (for context in judgment)
        section_guidelines: Section-specific evidence rules (from prompts)
        llm_client: AnalyzerLLMClient instance
        actual_batch_size: Actual number of emails in batch (for hallucination detection)

    Returns:
        {
            "is_valid": bool,
            "quality_score": float (0.0-1.0),
            "evidence_type": str,
            "issue": str
        }

    Example:
        >>> eval = evaluate_evidence_quality(
        ...     classification={"value": "Male", "reasoning": "Marital status mentioned"},
        ...     email_context="...",
        ...     section_guidelines=DEMOGRAPHICS_GUIDELINES,
        ...     llm_client=client
        ... )
        >>> eval["quality_score"]
        0.0  # Inappropriate evidence
    """
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
                "issue": f"HALLUCINATION: Reasoning cites Email {max_cited} but batch only contains {actual_batch_size} emails. This email does not exist in the provided data."
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
                    "issue": f"HALLUCINATION: Reasoning cites 'Email {email_num}' but batch only contains {actual_batch_size} emails. This email does not exist in the provided data."
                }

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

Return ONLY JSON (no markdown):
{{
  "is_valid": true/false,
  "quality_score": 0.0-1.0,
  "evidence_type": "explicit|contextual|weak|inappropriate",
  "issue": "explanation if invalid"
}}"""

    try:
        # Build full prompt
        full_prompt = f"{JUDGE_SYSTEM_PROMPT}\n\n{user_prompt}"

        # DEBUG: Log the prompt being sent (helps diagnose empty responses)
        logger.debug(
            f"🔍 Evidence judge prompt for {classification.get('value', 'unknown')}: "
            f"length={len(full_prompt)} chars, "
            f"email_context_length={len(email_context)} chars"
        )

        # Call judge LLM using call_json (doesn't enforce "classifications" structure)
        # Uses default max_tokens from call_json (automatically calculated from model context window)
        response = llm_client.call_json(
            prompt=full_prompt,
            temperature=0.1
        )

        # Parse response
        is_valid = response.get("is_valid", False)
        quality_score = float(response.get("quality_score", 0.0))
        evidence_type = response.get("evidence_type", "unknown")
        issue = response.get("issue", "")

        # Validate quality_score bounds
        quality_score = max(0.0, min(1.0, quality_score))

        # Map evidence type to score if LLM didn't provide score
        if quality_score == 0.0 and evidence_type in ["explicit", "contextual", "weak"]:
            quality_map = {
                "explicit": QUALITY_EXPLICIT,
                "contextual": QUALITY_CONTEXTUAL,
                "weak": QUALITY_WEAK,
                "inappropriate": QUALITY_INAPPROPRIATE
            }
            quality_score = quality_map.get(evidence_type, 0.0)

        logger.debug(
            f"Evidence judge: {classification.get('value')} → "
            f"{evidence_type} (quality={quality_score:.2f})"
        )

        return {
            "is_valid": is_valid,
            "quality_score": quality_score,
            "evidence_type": evidence_type,
            "issue": issue
        }

    except Exception as e:
        logger.error(f"Evidence judge error: {e}", exc_info=True)
        # Default to neutral (don't block) on error
        return {
            "is_valid": True,
            "quality_score": 0.7,  # Neutral default
            "evidence_type": "unknown",
            "issue": f"Judge error: {str(e)}"
        }


def evaluate_evidence_quality_batch(
    classifications: List[Dict[str, Any]],
    email_context: str,
    section_guidelines: str,
    llm_client: Any,
    max_workers: int = 5,
    actual_batch_size: int = None
) -> List[Dict[str, Any]]:
    """
    Evaluate evidence quality for multiple classifications in parallel.

    This is a performance optimization that runs evidence judge in parallel
    instead of sequentially, reducing overall processing time significantly.

    Args:
        classifications: List of classification dicts to evaluate
        email_context: Email content (for context in judgment)
        section_guidelines: Section-specific evidence rules (from prompts)
        llm_client: AnalyzerLLMClient instance
        max_workers: Max parallel threads (default: 5)
        actual_batch_size: Actual number of emails in batch (for hallucination detection)

    Returns:
        List of evidence evaluation dicts (same order as input classifications)

    Example:
        >>> classifications = [
        ...     {"value": "Male", "reasoning": "..."},
        ...     {"value": "35-44", "reasoning": "..."}
        ... ]
        >>> results = evaluate_evidence_quality_batch(
        ...     classifications, email_context, guidelines, client, actual_batch_size=20
        ... )
        >>> len(results) == len(classifications)
        True
    """
    if not classifications:
        return []

    # Single classification - use direct call (no threading overhead)
    if len(classifications) == 1:
        return [evaluate_evidence_quality(
            classifications[0], email_context, section_guidelines, llm_client, actual_batch_size
        )]

    # Multiple classifications - parallel evaluation
    logger.info(f"⚡ Parallel evidence judge: evaluating {len(classifications)} classifications")

    results = [None] * len(classifications)  # Preserve order

    def evaluate_single(index: int, classification: Dict[str, Any]) -> tuple:
        """Wrapper to evaluate single classification with index tracking"""
        try:
            result = evaluate_evidence_quality(
                classification, email_context, section_guidelines, llm_client, actual_batch_size
            )
            return (index, result)
        except Exception as e:
            logger.error(f"Parallel evidence judge error for classification {index}: {e}")
            # Return neutral evaluation on error
            return (index, {
                "is_valid": True,
                "quality_score": 0.7,
                "evidence_type": "unknown",
                "issue": f"Evaluation error: {str(e)}"
            })

    # Execute in parallel with thread pool
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

    logger.info(f"✅ Parallel evidence judge complete: {len(results)} evaluations")
    return results


def adjust_confidence_with_evidence_quality(
    classification: Dict[str, Any],
    evidence_evaluation: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Adjust classification confidence based on evidence quality.

    Formula: adjusted_confidence = original_confidence × quality_score

    This ensures inappropriate evidence → low confidence → minimal Bayesian impact.

    Args:
        classification: Original classification dict
        evidence_evaluation: Result from evaluate_evidence_quality()

    Returns:
        Updated classification dict with adjusted confidence

    Example:
        >>> classification = {"value": "Male", "confidence": 0.9, "reasoning": "..."}
        >>> evaluation = {"quality_score": 0.0, "evidence_type": "inappropriate"}
        >>> result = adjust_confidence_with_evidence_quality(classification, evaluation)
        >>> result["confidence"]
        0.0  # Blocked
    """
    original_conf = classification.get("confidence", 0.0)
    quality_score = evidence_evaluation.get("quality_score", 1.0)
    evidence_type = evidence_evaluation.get("evidence_type", "unknown")

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

    # Log significant adjustments
    if adjusted_conf < original_conf * 0.8:
        logger.warning(
            f"Evidence quality concern: {classification.get('value')} "
            f"confidence adjusted {original_conf:.2f} → {adjusted_conf:.2f} "
            f"(evidence_type={evidence_evaluation.get('evidence_type')}, "
            f"issue={evidence_evaluation.get('issue', 'N/A')})"
        )

    # Update classification
    classification["confidence"] = adjusted_conf
    classification["original_confidence"] = original_conf
    classification["evidence_quality"] = quality_score
    classification["evidence_type"] = evidence_evaluation.get("evidence_type")

    if evidence_evaluation.get("issue"):
        classification["evidence_issue"] = evidence_evaluation["issue"]

    return classification


def should_block_classification(quality_score: float, threshold: float = 0.15) -> bool:
    """
    Determine if classification should be blocked entirely.

    Classifications with quality_score below threshold are completely inappropriate
    and should not enter memory at all.

    Args:
        quality_score: Evidence quality score [0.0, 1.0]
        threshold: Minimum quality to allow (default: 0.15)

    Returns:
        True if should block, False if should allow

    Example:
        >>> should_block_classification(0.0)  # Inappropriate
        True
        >>> should_block_classification(0.4)  # Weak but allowed
        False
    """
    return quality_score < threshold


__all__ = [
    'evaluate_evidence_quality',
    'evaluate_evidence_quality_batch',
    'adjust_confidence_with_evidence_quality',
    'should_block_classification',
    'QUALITY_EXPLICIT',
    'QUALITY_CONTEXTUAL',
    'QUALITY_WEAK',
    'QUALITY_INAPPROPRIATE',
]
