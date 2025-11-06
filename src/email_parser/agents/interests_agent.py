"""
Interests ReAct Agent for IAB Taxonomy Classification.

Uses ReAct pattern (Reason-Act-Observe) with taxonomy search tools
to extract and validate interest-related classifications from emails.

Integrates with existing AnalyzerLLMClient infrastructure.
"""

import logging
import json
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Import prompts from centralized location
from ..workflow.prompts import (
    INTERESTS_AGENT_SYSTEM_PROMPT,
    INTERESTS_AGENT_USER_PROMPT,
)


def extract_interests_with_agent(
    emails: List[Dict[str, Any]],
    llm_client: Any,
    max_iterations: int = 1,
) -> Dict[str, Any]:
    """
    Extract interest classifications using ReAct-style agent with tools.

    Args:
        emails: List of email dicts with 'subject', 'sender', 'body'
        llm_client: AnalyzerLLMClient instance
        max_iterations: Max reflection loops (default: 3)

    Returns:
        {
            "classifications": List[Classification],
            "iterations": int,
            "tool_calls": int
        }

    Example:
        >>> from ..workflow.llm_wrapper import AnalyzerLLMClient
        >>> llm_client = AnalyzerLLMClient(provider="claude")
        >>> emails = [{{"subject": "...", "body": "..."}}]
        >>> result = extract_interests_with_agent(emails, llm_client)
    """
    from .tools import (
        search_interests_taxonomy,
        validate_classification,
        get_tier_details,
    )
    from ..workflow.taxonomy_context import get_cached_taxonomy_context

    # Get taxonomy context for prompt
    taxonomy_context = get_cached_taxonomy_context("interests")

    # Format emails for prompt and create email_number → email_id mapping
    email_number_to_id = {}  # Map email numbers (1,2,3...) to actual email IDs
    email_text_parts = []

    for i, email in enumerate(emails[:50]):  # Process up to 50 emails per batch
        email_number = i + 1
        email_id = email.get('id', f'unknown_{i}')
        email_number_to_id[email_number] = email_id

        # Handle NaN values from pandas CSV (float type, not string)
        summary_content = email.get('summary', '')
        subject = email.get('subject', 'N/A')
        sender = email.get('from', 'N/A')

        # Convert pandas NaN (float) to empty string
        if not isinstance(summary_content, str):
            summary_content = "" if summary_content is None or (isinstance(summary_content, float) and summary_content != summary_content) else str(summary_content)
        if not isinstance(subject, str):
            subject = "N/A" if subject is None or (isinstance(subject, float) and subject != subject) else str(subject)
        if not isinstance(sender, str):
            sender = "N/A" if sender is None or (isinstance(sender, float) and sender != sender) else str(sender)

        logger.info(f"Email {email_number}: subject={subject}, sender={sender}, summary_len={len(summary_content)}")
        if not summary_content:
            logger.warning(f"Email {email_number} ({email_id}) has empty summary field!")

        email_text_parts.append(
            f"Email {email_number}:\n"
            f"Subject: {subject}\n"
            f"From: {sender}\n"
            f"Summary: {summary_content[:500]}..."
        )

    email_text = "\n\n".join(email_text_parts)

    # Log the actual email content being sent to LLM
    logger.info(f"Email content for LLM (first 500 chars): {email_text[:500]}")

    # Build initial prompt with taxonomy context
    system_prompt_with_taxonomy = f"""{INTERESTS_AGENT_SYSTEM_PROMPT}

## Available Taxonomy Entries

{taxonomy_context}

IMPORTANT:
- Select the taxonomy_id from the list above (the number after "ID")
- For the "value" field, use ONLY the FINAL tier value (rightmost part after last "|")
- Example: For "ID 342: Interests | Technology & Computing | Cryptocurrency", use taxonomy_id=342 and value="Cryptocurrency"
- AVOID category entries (short paths with 2-3 tiers) - choose the most specific entry (4+ tiers when available)
- Do NOT include the full tier path in the value field"""

    user_prompt = INTERESTS_AGENT_USER_PROMPT.format(
        email_batch=email_text,
        batch_size=len(emails[:50])
    )

    # Track agent execution
    tool_calls = 0
    iterations = 0
    classifications = []

    try:
        for iteration in range(max_iterations):
            iterations += 1
            logger.info(f"Interests agent iteration {iteration + 1}/{max_iterations}")

            # Call LLM (analyze_email returns parsed JSON with "classifications" key)
            # max_tokens auto-calculated from model's context window
            response = llm_client.analyze_email(
                prompt=f"{system_prompt_with_taxonomy}\n\n{user_prompt}",
                temperature=0.1
            )

            # Extract classifications directly from parsed response
            parsed_classifications = response.get("classifications", [])

            # ===== ENHANCED LOGGING: Raw LLM Response =====
            logger.info(f"📝 Interests LLM Response: {len(parsed_classifications)} classifications returned")
            for i, c in enumerate(parsed_classifications):
                logger.info(
                    f"  [{i+1}] ID={c.get('taxonomy_id')}, value='{c.get('value')}', "
                    f"confidence={c.get('confidence', 0):.2f}, emails={c.get('email_numbers', [])}"
                )

            if not parsed_classifications:
                logger.warning("No classifications found in agent output")
                break

            # Validate each classification (taxonomy validation only)
            all_valid = True
            taxonomy_valid_classifications = []

            for classification in parsed_classifications:
                taxonomy_id = classification.get("taxonomy_id")
                value = classification.get("value")

                if not taxonomy_id or not value:
                    continue

                # Validate using tool
                tool_calls += 1
                validation_result = json.loads(
                    validate_classification.invoke({
                        "taxonomy_id": taxonomy_id,
                        "value": value
                    })
                )

                if validation_result.get("valid"):
                    # Taxonomy validation passed - add to batch for evidence judge
                    taxonomy_valid_classifications.append(classification)
                else:
                    # Validation failed - agent needs to reflect
                    all_valid = False
                    expected_value = validation_result.get("expected_value", "")
                    logger.info(
                        f"Validation failed: taxonomy_id={taxonomy_id}, "
                        f"provided='{value}', expected='{expected_value}'"
                    )

                    # Update prompt for reflection
                    user_prompt += (
                        f"\n\nREFLECTION: Classification {taxonomy_id}={value} is INVALID. "
                        f"Expected value: '{expected_value}'. "
                        f"Please search again and use the correct taxonomy_id for '{expected_value}'."
                    )
                    break  # Trigger reflection loop

            # ===== BATCH EVIDENCE QUALITY VALIDATION =====
            # Use parallel LLM-as-Judge for all taxonomy-valid classifications
            if taxonomy_valid_classifications:
                from ..workflow.nodes.evidence_judge import (
                    evaluate_evidence_quality_batch,
                    adjust_confidence_with_evidence_quality,
                    should_block_classification
                )
                from ..workflow.prompts import INTERESTS_EVIDENCE_GUIDELINES

                # Evaluate all classifications in parallel
                # Pass actual batch size to distinguish true hallucinations from context truncation
                actual_batch_size = len(emails[:50])
                evidence_evals = evaluate_evidence_quality_batch(
                    classifications=taxonomy_valid_classifications,
                    email_context=email_text,
                    section_guidelines=INTERESTS_EVIDENCE_GUIDELINES,
                    llm_client=llm_client,
                    max_workers=5,
                    actual_batch_size=actual_batch_size
                )

                # Process results
                validated_classifications = []
                for classification, evidence_eval in zip(taxonomy_valid_classifications, evidence_evals):
                    # Adjust confidence based on evidence quality
                    classification = adjust_confidence_with_evidence_quality(
                        classification, evidence_eval
                    )

                    # ===== ENHANCED LOGGING: Evidence Judge Decision =====
                    will_block = should_block_classification(evidence_eval["quality_score"])
                    logger.info(
                        f"🔍 Evidence Judge: '{classification.get('value')}' → "
                        f"quality={evidence_eval['quality_score']:.2f}, "
                        f"type={evidence_eval.get('evidence_type', 'N/A')}, "
                        f"decision={'BLOCK' if will_block else 'PASS'}"
                    )

                    # Block completely inappropriate inferences
                    if will_block:
                        logger.warning(
                            f"Blocked inappropriate interest inference: {classification.get('value')} "
                            f"(quality_score={evidence_eval['quality_score']:.2f}, "
                            f"issue={evidence_eval.get('issue', 'N/A')})"
                        )
                        continue  # Skip this classification

                    # Map email_numbers array to email_ids for provenance tracking
                    email_numbers = classification.get("email_numbers", [])

                    # Backward compatibility: check for old single email_number field
                    if not email_numbers:
                        email_number = classification.get("email_number")
                        if email_number:
                            email_numbers = [email_number]

                    if email_numbers and all(n in email_number_to_id for n in email_numbers):
                        classification["email_ids"] = [email_number_to_id[n] for n in email_numbers]
                    else:
                        logger.warning(f"Classification missing email_numbers or invalid: {classification}")
                        classification["email_ids"] = []

                    validated_classifications.append(classification)
            else:
                validated_classifications = []

            if all_valid and validated_classifications:
                # All classifications validated - we're done
                classifications = validated_classifications
                logger.info(f"Agent converged with {len(classifications)} validated classifications")
                break

        return {
            "classifications": classifications,
            "iterations": iterations,
            "tool_calls": tool_calls,
        }

    except Exception as e:
        logger.error(f"Interests agent error: {e}", exc_info=True)
        return {
            "classifications": [],
            "iterations": iterations,
            "tool_calls": tool_calls,
            "error": str(e)
        }


def _parse_classifications(text: str) -> List[Dict[str, Any]]:
    """
    Parse classifications from agent output.

    Expects JSON format with "classifications" array.

    Args:
        text: Agent's output text

    Returns:
        List of classification dicts
    """
    try:
        # Try to find JSON in output
        if "{" in text and "}}" in text:
            json_start = text.index("{")
            json_end = text.rindex("}}") + 1
            json_str = text[json_start:json_end]

            data = json.loads(json_str)
            return data.get("classifications", [])

    except (ValueError, json.JSONDecodeError) as e:
        logger.warning(f"Failed to parse agent output as JSON: {e}")

    return []


__all__ = [
    'extract_interests_with_agent',
]
