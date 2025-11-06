#!/usr/bin/env python3
"""
Analyzer Node Stubs

Placeholder analyzer nodes that will be implemented with LLM integration in Phase 4.

For Phase 3, these return dummy taxonomy selections to enable workflow testing.
Phase 4 will replace these with actual LLM-based analysis.
"""

import logging
from typing import Dict, Any, Optional

from ..state import WorkflowState, get_current_email, get_current_batch

logger = logging.getLogger(__name__)

# Cache taxonomy loader instance
_taxonomy_loader = None

def _get_taxonomy_loader():
    """Get cached taxonomy loader instance."""
    global _taxonomy_loader
    if _taxonomy_loader is None:
        from ...utils.iab_taxonomy_loader import IABTaxonomyLoader
        _taxonomy_loader = IABTaxonomyLoader()
    return _taxonomy_loader


def lookup_taxonomy_entry(taxonomy_id: int) -> Optional[Dict[str, Any]]:
    """
    Look up taxonomy entry by ID and return tier information.

    Args:
        taxonomy_id: IAB Taxonomy ID

    Returns:
        Dict with tier_1, tier_2, tier_3, tier_4, tier_5, category_path, name
        or None if not found
    """
    try:
        loader = _get_taxonomy_loader()
        entry = loader.taxonomy_by_id.get(taxonomy_id)

        if not entry:
            logger.warning(f"Taxonomy ID {taxonomy_id} not found in IAB taxonomy")
            return None

        # Build category_path from tiers
        tiers = [entry['tier_1'], entry['tier_2'], entry['tier_3'], entry['tier_4'], entry['tier_5']]
        non_empty_tiers = [t for t in tiers if t]
        category_path = " | ".join(non_empty_tiers)

        return {
            "tier_1": entry['tier_1'],
            "tier_2": entry['tier_2'],
            "tier_3": entry['tier_3'],
            "tier_4": entry['tier_4'],
            "tier_5": entry['tier_5'],
            "category_path": category_path,
            "name": entry['name'],
            "grouping_tier_key": entry.get('grouping_tier_key', 'tier_2'),
            "grouping_value": entry.get('grouping_value', entry['tier_2'])
        }
    except Exception as e:
        logger.error(f"Error looking up taxonomy {taxonomy_id}: {e}")
        return None


def get_taxonomy_value(taxonomy_entry: Dict[str, Any]) -> str:
    """
    Extract the actual classification value from a taxonomy entry.

    The value is the deepest non-empty tier (tier_5 > tier_4 > tier_3).

    Args:
        taxonomy_entry: Taxonomy entry dict from lookup_taxonomy_entry

    Returns:
        The actual classification value (e.g., "Male", "25-29", "Bachelor's Degree")

    Examples:
        >>> # ID 50: Demographic | Gender | Male
        >>> entry = lookup_taxonomy_entry(50)
        >>> get_taxonomy_value(entry)
        "Male"  # tier_3

        >>> # ID 21: Demographic | Education & Occupation | Education (Highest Level) | College Education | Professional School
        >>> entry = lookup_taxonomy_entry(21)
        >>> get_taxonomy_value(entry)
        "Professional School"  # tier_5
    """
    # Check tiers from deepest to shallowest
    for tier_key in ['tier_5', 'tier_4', 'tier_3']:
        value = taxonomy_entry.get(tier_key, "").strip()
        if value:
            return value

    # Fallback to tier_2 if all deeper tiers are empty (shouldn't happen for leaf nodes)
    return taxonomy_entry.get('tier_2', "").strip()


def validate_taxonomy_classification(
    taxonomy_id: int,
    llm_value: str,
    taxonomy_entry: Dict[str, Any]
) -> bool:
    """
    Validate that LLM's classification value matches the taxonomy entry.

    This prevents data corruption from LLM errors where wrong taxonomy IDs
    are paired with incorrect values.

    Args:
        taxonomy_id: IAB Taxonomy ID from LLM
        llm_value: Classification value from LLM
        taxonomy_entry: Taxonomy entry from lookup_taxonomy_entry

    Returns:
        True if valid (value matches taxonomy), False if mismatch

    Examples:
        >>> # Valid: LLM returns ID=50, value="Male"
        >>> entry = lookup_taxonomy_entry(50)
        >>> validate_taxonomy_classification(50, "Male", entry)
        True

        >>> # Invalid: LLM returns ID=50, value="Employed Full-Time"
        >>> entry = lookup_taxonomy_entry(50)
        >>> validate_taxonomy_classification(50, "Employed Full-Time", entry)
        False  # Logs warning and returns False
    """
    expected_value = get_taxonomy_value(taxonomy_entry)

    # Handle asterisk placeholders (e.g., "*Country Extension", "*Language")
    # For these entries, the LLM provides the actual value (e.g., "United Kingdom", "English")
    # and we should NOT validate against the placeholder
    if expected_value.startswith("*"):
        # Asterisk entries: accept any non-empty value from LLM
        if not llm_value or not llm_value.strip():
            logger.warning(
                f"VALIDATION FAILED: Taxonomy ID {taxonomy_id} with placeholder '{expected_value}' "
                f"received empty value from LLM"
            )
            return False
        # Valid: LLM provided actual value for placeholder entry
        return True

    # Non-asterisk entries: validate exact match
    # Normalize for comparison (case-insensitive, strip whitespace)
    llm_normalized = llm_value.strip().lower()
    expected_normalized = expected_value.strip().lower()

    if llm_normalized != expected_normalized:
        logger.warning(
            f"VALIDATION FAILED: Taxonomy ID {taxonomy_id} mismatch - "
            f"LLM returned value '{llm_value}' but taxonomy defines '{expected_value}'. "
            f"Skipping this classification to prevent data corruption."
        )
        return False

    return True


def demographics_analyzer_node(state: WorkflowState) -> WorkflowState:
    """
    Analyze email batch for demographic signals using ReAct agent.

    BATCH PROCESSING: Processes multiple emails per LLM call for performance.

    Args:
        state: Current workflow state

    Returns:
        Updated state with demographics_results

    Example taxonomy selections:
    - Age: 25-29 (taxonomy_id=5)
    - Gender: Male (taxonomy_id=20)
    - Education: Bachelor's Degree (taxonomy_id=32)
    """
    try:
        # Get current batch of emails
        emails = get_current_batch(state)

        if not emails:
            logger.warning("No emails in batch to analyze for demographics")
            return state

        batch_size = len(emails)
        email_ids = [email.get('id', 'unknown') for email in emails]
        logger.info(
            f"📦 BATCH PROCESSING: Demographics agent processing {batch_size} emails in single LLM call\n"
            f"   Email IDs: {', '.join(email_ids[:5])}{'...' if len(email_ids) > 5 else ''}"
        )

        # Import agent and LLM components
        from ..llm_wrapper import AnalyzerLLMClient
        from ...agents.demographics_agent import extract_demographics_with_agent

        # Get LLM client (provider from state or env var LLM_PROVIDER)
        llm_client = AnalyzerLLMClient(
            provider=state.get("llm_provider"),  # None uses env var default
            model=state.get("llm_model"),
            cost_tracker=state.get("cost_tracker"),  # Pass cost tracker if available
            workflow_tracker=state.get("tracker")  # Pass workflow tracker for dashboard analytics
        )

        # Run agent with reflection capability (max 3 iterations)
        # Agent processes entire batch and returns multiple classifications
        agent_result = extract_demographics_with_agent(
            emails=emails,  # Pass entire batch
            llm_client=llm_client,
            max_iterations=3
        )

        # Log agent metrics
        logger.info(
            f"Demographics agent completed: iterations={agent_result.get('iterations')}, "
            f"tool_calls={agent_result.get('tool_calls')}"
        )

        # Parse classifications from agent
        classifications = agent_result.get("classifications", [])

        # ===== EVIDENCE QUALITY VALIDATION =====
        # Use LLM-as-Judge to validate evidence appropriateness
        from .evidence_judge import (
            evaluate_evidence_quality,
            adjust_confidence_with_evidence_quality,
            should_block_classification
        )
        from ..prompts import DEMOGRAPHICS_EVIDENCE_GUIDELINES

        # Build email context from entire batch for validation
        email_context = "\n\n".join([
            f"Email {i+1}:\n"
            f"Subject: {email.get('subject', 'N/A')}\n"
            f"Body: {email.get('body', '')[:500]}..."
            for i, email in enumerate(emails)
        ])

        validated_classifications = []
        for classification in classifications:
            # Evaluate evidence quality
            evidence_eval = evaluate_evidence_quality(
                classification=classification,
                email_context=email_context,  # Pass full batch context
                section_guidelines=DEMOGRAPHICS_EVIDENCE_GUIDELINES,
                llm_client=llm_client
            )

            # Adjust confidence based on evidence quality
            classification = adjust_confidence_with_evidence_quality(
                classification, evidence_eval
            )

            # Block completely inappropriate inferences
            if should_block_classification(evidence_eval["quality_score"]):
                logger.warning(
                    f"Blocked inappropriate demographics inference: {classification.get('value')} "
                    f"(quality_score={evidence_eval['quality_score']:.2f}, "
                    f"issue={evidence_eval.get('issue', 'N/A')})"
                )
                continue  # Skip this classification

            validated_classifications.append(classification)

        logger.info(
            f"Demographics evidence validation: {len(classifications)} → "
            f"{len(validated_classifications)} after quality check"
        )

        # Convert to taxonomy selections with validation (same as before)
        for classification in validated_classifications:
            taxonomy_id = classification.get("taxonomy_id")
            llm_value = classification.get("value", "").strip()

            # Look up actual taxonomy entry
            taxonomy_entry = lookup_taxonomy_entry(taxonomy_id)
            if not taxonomy_entry:
                logger.warning(f"Skipping invalid taxonomy_id: {taxonomy_id}")
                continue

            # Agent already validated, but double-check for safety
            if not validate_taxonomy_classification(taxonomy_id, llm_value, taxonomy_entry):
                logger.warning(
                    f"Agent classification failed final validation: taxonomy_id={taxonomy_id}, "
                    f"value='{llm_value}'"
                )
                continue

            # Determine which value to use:
            # - For asterisk placeholders (e.g., "*Country Extension"), use LLM's actual value
            # - For non-asterisk entries, use taxonomy value as source of truth
            taxonomy_value = get_taxonomy_value(taxonomy_entry)
            final_value = llm_value if taxonomy_value.startswith("*") else taxonomy_value

            selection = {
                "taxonomy_id": taxonomy_id,
                "section": "demographics",
                "value": final_value,  # LLM value for placeholders, taxonomy value otherwise
                "confidence": classification.get("confidence", 0.7),
                "category_path": taxonomy_entry["category_path"],
                "tier_1": taxonomy_entry["tier_1"],
                "tier_2": taxonomy_entry["tier_2"],
                "tier_3": taxonomy_entry["tier_3"],
                "tier_4": taxonomy_entry["tier_4"],
                "tier_5": taxonomy_entry["tier_5"],
                "grouping_tier_key": taxonomy_entry["grouping_tier_key"],
                "grouping_value": taxonomy_entry["grouping_value"],
                "reasoning": classification.get("reasoning", "Agent analysis")
            }
            state["demographics_results"].append(selection)

        # ===== ENHANCED LOGGING: Validation Pipeline Summary =====
        logger.info(f"📊 Demographics Validation Pipeline:")
        logger.info(f"  - LLM returned: {len(classifications)} raw classifications")
        logger.info(f"  - After evidence judge: {len(validated_classifications)} passed quality check")
        logger.info(f"  - After taxonomy validation: {len(state['demographics_results'])} final")

        if len(classifications) > len(validated_classifications):
            rejected = len(classifications) - len(validated_classifications)
            logger.warning(f"⚠️  Evidence judge rejected {rejected} classifications (weak evidence)")

        if len(validated_classifications) > len(state['demographics_results']):
            rejected = len(validated_classifications) - len(state['demographics_results'])
            logger.warning(f"⚠️  Final validation rejected {rejected} classifications (taxonomy mismatch)")

        # Log summary with provenance info
        classifications_with_provenance = sum(1 for c in state["demographics_results"] if c.get("email_id"))
        logger.info(
            f"✅ Demographics agent complete: {len(state['demographics_results'])} classifications added\n"
            f"   Provenance tracked: {classifications_with_provenance}/{len(state['demographics_results'])} have email_id"
        )

    except Exception as e:
        logger.error(f"Demographics agent failed: {e}", exc_info=True)
        from ..state import add_error
        add_error(state, f"Demographics analysis failed: {str(e)}")

    return state


def household_analyzer_node(state: WorkflowState) -> WorkflowState:
    """
    Analyze email batch for household signals using ReAct agent.

    BATCH PROCESSING: Processes multiple emails per LLM call for performance.

    Args:
        state: Current workflow state

    Returns:
        Updated state with household_results

    Example taxonomy selections:
    - Income: Budget-Conscious (taxonomy_id=110)
    - Property: Urban Apartment (taxonomy_id=100, 120)
    - Household Size: 2 people (taxonomy_id=131)
    """
    try:
        # Get current batch of emails
        emails = get_current_batch(state)

        if not emails:
            logger.warning("No emails in batch to analyze for household")
            return state

        batch_size = len(emails)
        email_ids = [email.get('id', 'unknown') for email in emails]
        logger.info(
            f"📦 BATCH PROCESSING: Household agent processing {batch_size} emails in single LLM call\n"
            f"   Email IDs: {', '.join(email_ids[:5])}{'...' if len(email_ids) > 5 else ''}"
        )

        # Import agent and LLM components
        from ..llm_wrapper import AnalyzerLLMClient
        from ...agents.household_agent import extract_household_with_agent

        # Get LLM client
        llm_client = AnalyzerLLMClient(
            provider=state.get("llm_provider"),
            model=state.get("llm_model"),
            cost_tracker=state.get("cost_tracker"),
            workflow_tracker=state.get("tracker")
        )

        # Run agent with reflection capability
        agent_result = extract_household_with_agent(
            emails=emails,  # Pass entire batch
            llm_client=llm_client,
            max_iterations=3
        )

        # Log agent metrics
        logger.info(
            f"Household agent completed: iterations={agent_result.get('iterations')}, "
            f"tool_calls={agent_result.get('tool_calls')}"
        )

        # Parse classifications from agent
        classifications = agent_result.get("classifications", [])

        # ===== EVIDENCE QUALITY VALIDATION =====
        # Use LLM-as-Judge to validate evidence appropriateness
        from .evidence_judge import (
            evaluate_evidence_quality,
            adjust_confidence_with_evidence_quality,
            should_block_classification
        )
        from ..prompts import HOUSEHOLD_EVIDENCE_GUIDELINES

        # Build email context from entire batch for validation
        email_context = "\n\n".join([
            f"Email {i+1}:\n"
            f"Subject: {email.get('subject', 'N/A')}\n"
            f"Body: {email.get('body', '')[:500]}..."
            for i, email in enumerate(emails)
        ])

        validated_classifications = []
        for classification in classifications:
            # Evaluate evidence quality
            evidence_eval = evaluate_evidence_quality(
                classification=classification,
                email_context=email_context,  # Pass full batch context
                section_guidelines=HOUSEHOLD_EVIDENCE_GUIDELINES,
                llm_client=llm_client
            )

            # Adjust confidence based on evidence quality
            classification = adjust_confidence_with_evidence_quality(
                classification, evidence_eval
            )

            # Block completely inappropriate inferences
            if should_block_classification(evidence_eval["quality_score"]):
                logger.warning(
                    f"Blocked inappropriate household inference: {classification.get('value')} "
                    f"(quality_score={evidence_eval['quality_score']:.2f}, "
                    f"issue={evidence_eval.get('issue', 'N/A')})"
                )
                continue  # Skip this classification

            validated_classifications.append(classification)

        logger.info(
            f"Household evidence validation: {len(classifications)} → "
            f"{len(validated_classifications)} after quality check"
        )

        # Convert to taxonomy selections with validation
        for classification in validated_classifications:
            taxonomy_id = classification.get("taxonomy_id")
            llm_value = classification.get("value", "").strip()

            # Look up actual taxonomy entry
            taxonomy_entry = lookup_taxonomy_entry(taxonomy_id)
            if not taxonomy_entry:
                logger.warning(f"Skipping invalid taxonomy_id: {taxonomy_id}")
                continue

            # Agent already validated, but double-check
            if not validate_taxonomy_classification(taxonomy_id, llm_value, taxonomy_entry):
                logger.warning(
                    f"Agent classification failed final validation: taxonomy_id={taxonomy_id}, "
                    f"value='{llm_value}'"
                )
                continue

            # Determine which value to use:
            # - For asterisk placeholders (e.g., "*Language"), use LLM's actual value
            # - For non-asterisk entries, use taxonomy value as source of truth
            taxonomy_value = get_taxonomy_value(taxonomy_entry)
            final_value = llm_value if taxonomy_value.startswith("*") else taxonomy_value

            selection = {
                "taxonomy_id": taxonomy_id,
                "section": "household",
                "value": final_value,  # LLM value for placeholders, taxonomy value otherwise
                "confidence": classification.get("confidence", 0.7),
                "category_path": taxonomy_entry["category_path"],
                "tier_1": taxonomy_entry["tier_1"],
                "tier_2": taxonomy_entry["tier_2"],
                "tier_3": taxonomy_entry["tier_3"],
                "tier_4": taxonomy_entry["tier_4"],
                "tier_5": taxonomy_entry["tier_5"],
                "grouping_tier_key": taxonomy_entry["grouping_tier_key"],
                "grouping_value": taxonomy_entry["grouping_value"],
                "reasoning": classification.get("reasoning", "Agent analysis")
            }
            state["household_results"].append(selection)

        # ===== ENHANCED LOGGING: Validation Pipeline Summary =====
        logger.info(f"📊 Household Validation Pipeline:")
        logger.info(f"  - LLM returned: {len(classifications)} raw classifications")
        logger.info(f"  - After evidence judge: {len(validated_classifications)} passed quality check")
        logger.info(f"  - After taxonomy validation: {len(state['household_results'])} final")

        if len(classifications) > len(validated_classifications):
            rejected = len(classifications) - len(validated_classifications)
            logger.warning(f"⚠️  Evidence judge rejected {rejected} classifications (weak evidence)")

        if len(validated_classifications) > len(state['household_results']):
            rejected = len(validated_classifications) - len(state['household_results'])
            logger.warning(f"⚠️  Final validation rejected {rejected} classifications (taxonomy mismatch)")

        # Log summary with provenance info
        classifications_with_provenance = sum(1 for c in state["household_results"] if c.get("email_id"))
        logger.info(
            f"✅ Household agent complete: {len(state['household_results'])} classifications added\n"
            f"   Provenance tracked: {classifications_with_provenance}/{len(state['household_results'])} have email_id"
        )

    except Exception as e:
        logger.error(f"Household agent failed: {e}", exc_info=True)
        from ..state import add_error
        add_error(state, f"Household analysis failed: {str(e)}")

    return state


def interests_analyzer_node(state: WorkflowState) -> WorkflowState:
    """
    Analyze email batch for interest signals using ReAct agent.

    BATCH PROCESSING: Processes multiple emails per LLM call for performance.

    Phase 4 (Agent Version): Uses ReAct agent with taxonomy search tools

    Args:
        state: Current workflow state

    Returns:
        Updated state with interests_results

    Example taxonomy selections:
    - Interest: Cryptocurrency (taxonomy_id=342)
    - Interest: Technology (taxonomy_id=156)
    - Interest: Fitness (taxonomy_id=250)
    """
    try:
        # Get current batch of emails
        emails = get_current_batch(state)

        if not emails:
            logger.warning("No emails in batch to analyze for interests")
            return state

        batch_size = len(emails)
        email_ids = [email.get('id', 'unknown') for email in emails]
        logger.info(
            f"📦 BATCH PROCESSING: Interests agent processing {batch_size} emails in single LLM call\n"
            f"   Email IDs: {', '.join(email_ids[:5])}{'...' if len(email_ids) > 5 else ''}"
        )

        # Import agent and LLM components
        from ..llm_wrapper import AnalyzerLLMClient
        from ...agents.interests_agent import extract_interests_with_agent

        # Get LLM client
        llm_client = AnalyzerLLMClient(
            provider=state.get("llm_provider"),
            model=state.get("llm_model"),
            cost_tracker=state.get("cost_tracker"),
            workflow_tracker=state.get("tracker")
        )

        # Run agent with reflection capability
        agent_result = extract_interests_with_agent(
            emails=emails,  # Pass entire batch
            llm_client=llm_client,
            max_iterations=3
        )

        # Log agent metrics
        logger.info(
            f"Interests agent completed: iterations={agent_result.get('iterations')}, "
            f"tool_calls={agent_result.get('tool_calls')}"
        )

        # Parse classifications from agent
        classifications = agent_result.get("classifications", [])

        # ===== EVIDENCE QUALITY VALIDATION =====
        # Use LLM-as-Judge to validate evidence appropriateness
        from .evidence_judge import (
            evaluate_evidence_quality,
            adjust_confidence_with_evidence_quality,
            should_block_classification
        )
        from ..prompts import INTERESTS_EVIDENCE_GUIDELINES

        # Build email context from entire batch for validation
        email_context = "\n\n".join([
            f"Email {i+1}:\n"
            f"Subject: {email.get('subject', 'N/A')}\n"
            f"Body: {email.get('body', '')[:500]}..."
            for i, email in enumerate(emails)
        ])

        validated_classifications = []
        for classification in classifications:
            # Evaluate evidence quality
            evidence_eval = evaluate_evidence_quality(
                classification=classification,
                email_context=email_context,  # Pass full batch context
                section_guidelines=INTERESTS_EVIDENCE_GUIDELINES,
                llm_client=llm_client
            )

            # Adjust confidence based on evidence quality
            classification = adjust_confidence_with_evidence_quality(
                classification, evidence_eval
            )

            # Block completely inappropriate inferences
            if should_block_classification(evidence_eval["quality_score"]):
                logger.warning(
                    f"Blocked inappropriate interest inference: {classification.get('value')} "
                    f"(quality_score={evidence_eval['quality_score']:.2f}, "
                    f"issue={evidence_eval.get('issue', 'N/A')})"
                )
                continue  # Skip this classification

            validated_classifications.append(classification)

        logger.info(
            f"Interests evidence validation: {len(classifications)} → "
            f"{len(validated_classifications)} after quality check"
        )

        # Convert to taxonomy selections with validation
        for classification in validated_classifications:
            taxonomy_id = classification.get("taxonomy_id")
            llm_value = classification.get("value", "").strip()

            # Look up actual taxonomy entry
            taxonomy_entry = lookup_taxonomy_entry(taxonomy_id)
            if not taxonomy_entry:
                logger.warning(f"Skipping invalid taxonomy_id: {taxonomy_id}")
                continue

            # Agent already validated, but double-check
            if not validate_taxonomy_classification(taxonomy_id, llm_value, taxonomy_entry):
                logger.warning(
                    f"Agent classification failed final validation: taxonomy_id={taxonomy_id}, "
                    f"value='{llm_value}'"
                )
                continue

            # Determine which value to use:
            # - For asterisk placeholders, use LLM's actual value
            # - For non-asterisk entries, use taxonomy value as source of truth
            taxonomy_value = get_taxonomy_value(taxonomy_entry)
            final_value = llm_value if taxonomy_value.startswith("*") else taxonomy_value

            selection = {
                "taxonomy_id": taxonomy_id,
                "section": "interests",
                "value": final_value,  # LLM value for placeholders, taxonomy value otherwise
                "confidence": classification.get("confidence", 0.7),
                "category_path": taxonomy_entry["category_path"],
                "tier_1": taxonomy_entry["tier_1"],
                "tier_2": taxonomy_entry["tier_2"],
                "tier_3": taxonomy_entry["tier_3"],
                "tier_4": taxonomy_entry["tier_4"],
                "tier_5": taxonomy_entry["tier_5"],
                "grouping_tier_key": taxonomy_entry["grouping_tier_key"],
                "grouping_value": taxonomy_entry["grouping_value"],
                "reasoning": classification.get("reasoning", "Agent analysis")
            }
            state["interests_results"].append(selection)

        # ===== ENHANCED LOGGING: Validation Pipeline Summary =====
        logger.info(f"📊 Interests Validation Pipeline:")
        logger.info(f"  - LLM returned: {len(classifications)} raw classifications")
        logger.info(f"  - After evidence judge: {len(validated_classifications)} passed quality check")
        logger.info(f"  - After taxonomy validation: {len(state['interests_results'])} final")

        if len(classifications) > len(validated_classifications):
            rejected = len(classifications) - len(validated_classifications)
            logger.warning(f"⚠️  Evidence judge rejected {rejected} classifications (weak evidence)")

        if len(validated_classifications) > len(state['interests_results']):
            rejected = len(validated_classifications) - len(state['interests_results'])
            logger.warning(f"⚠️  Final validation rejected {rejected} classifications (taxonomy mismatch)")

        # Log summary with provenance info
        classifications_with_provenance = sum(1 for c in state["interests_results"] if c.get("email_id"))
        logger.info(
            f"✅ Interests agent complete: {len(state['interests_results'])} classifications added\n"
            f"   Provenance tracked: {classifications_with_provenance}/{len(state['interests_results'])} have email_id"
        )

    except Exception as e:
        logger.error(f"Interests agent failed: {e}", exc_info=True)
        from ..state import add_error
        add_error(state, f"Interests analysis failed: {str(e)}")

    return state


def purchase_analyzer_node(state: WorkflowState) -> WorkflowState:
    """
    Analyze email batch for purchase intent using ReAct agent.

    BATCH PROCESSING: Processes multiple emails per LLM call for performance.

    Phase 4 (Agent Version): Uses ReAct agent with taxonomy search tools

    Args:
        state: Current workflow state

    Returns:
        Updated state with purchase_results

    Example taxonomy selections:
    - Purchase Intent: PIPR_High (taxonomy_id=500)
    - Product Category: Electronics (taxonomy_id=520)
    - Actual Purchase: Confirmed (taxonomy_id=510)
    """
    try:
        # Get current batch of emails
        emails = get_current_batch(state)

        if not emails:
            logger.warning("No emails in batch to analyze for purchase")
            return state

        batch_size = len(emails)
        email_ids = [email.get('id', 'unknown') for email in emails]
        logger.info(
            f"📦 BATCH PROCESSING: Purchase agent processing {batch_size} emails in single LLM call\n"
            f"   Email IDs: {', '.join(email_ids[:5])}{'...' if len(email_ids) > 5 else ''}"
        )

        # Import agent and LLM components
        from ..llm_wrapper import AnalyzerLLMClient
        from ...agents.purchase_agent import extract_purchase_with_agent

        # Get LLM client
        llm_client = AnalyzerLLMClient(
            provider=state.get("llm_provider"),
            model=state.get("llm_model"),
            cost_tracker=state.get("cost_tracker"),
            workflow_tracker=state.get("tracker")
        )

        # Run agent with reflection capability
        agent_result = extract_purchase_with_agent(
            emails=emails,  # Pass entire batch
            llm_client=llm_client,
            max_iterations=3
        )

        # Log agent metrics
        logger.info(
            f"Purchase agent completed: iterations={agent_result.get('iterations')}, "
            f"tool_calls={agent_result.get('tool_calls')}"
        )

        # Parse classifications from agent
        classifications = agent_result.get("classifications", [])

        # ===== EVIDENCE QUALITY VALIDATION =====
        # Use LLM-as-Judge to validate evidence appropriateness
        from .evidence_judge import (
            evaluate_evidence_quality,
            adjust_confidence_with_evidence_quality,
            should_block_classification
        )
        from ..prompts import PURCHASE_EVIDENCE_GUIDELINES

        # Build email context from entire batch for validation
        email_context = "\n\n".join([
            f"Email {i+1}:\n"
            f"Subject: {email.get('subject', 'N/A')}\n"
            f"Body: {email.get('body', '')[:500]}..."
            for i, email in enumerate(emails)
        ])

        validated_classifications = []
        for classification in classifications:
            # Evaluate evidence quality
            evidence_eval = evaluate_evidence_quality(
                classification=classification,
                email_context=email_context,  # Pass full batch context
                section_guidelines=PURCHASE_EVIDENCE_GUIDELINES,
                llm_client=llm_client
            )

            # Adjust confidence based on evidence quality
            classification = adjust_confidence_with_evidence_quality(
                classification, evidence_eval
            )

            # Block completely inappropriate inferences
            if should_block_classification(evidence_eval["quality_score"]):
                logger.warning(
                    f"Blocked inappropriate purchase inference: {classification.get('value')} "
                    f"(quality_score={evidence_eval['quality_score']:.2f}, "
                    f"issue={evidence_eval.get('issue', 'N/A')})"
                )
                continue  # Skip this classification

            validated_classifications.append(classification)

        logger.info(
            f"Purchase evidence validation: {len(classifications)} → "
            f"{len(validated_classifications)} after quality check"
        )

        # Convert to taxonomy selections with validation
        for classification in validated_classifications:
            taxonomy_id = classification.get("taxonomy_id")
            llm_value = classification.get("value", "").strip()

            # Look up actual taxonomy entry
            taxonomy_entry = lookup_taxonomy_entry(taxonomy_id)
            if not taxonomy_entry:
                logger.warning(f"Skipping invalid taxonomy_id: {taxonomy_id}")
                continue

            # Agent already validated, but double-check
            if not validate_taxonomy_classification(taxonomy_id, llm_value, taxonomy_entry):
                logger.warning(
                    f"Agent classification failed final validation: taxonomy_id={taxonomy_id}, "
                    f"value='{llm_value}'"
                )
                continue

            # Determine which value to use:
            # - For asterisk placeholders, use LLM's actual value
            # - For non-asterisk entries, use taxonomy value as source of truth
            taxonomy_value = get_taxonomy_value(taxonomy_entry)
            final_value = llm_value if taxonomy_value.startswith("*") else taxonomy_value

            # Extract purchase intent flag (PIPR_HIGH, PIPR_MEDIUM, PIPR_LOW, ACTUAL_PURCHASE)
            purchase_intent_flag = classification.get("purchase_intent_flag", "PIPR_MEDIUM")

            selection = {
                "taxonomy_id": taxonomy_id,
                "section": "purchase_intent",
                "value": final_value,  # LLM value for placeholders, taxonomy value otherwise
                "purchase_intent_flag": purchase_intent_flag,  # Store the flag
                "confidence": classification.get("confidence", 0.7),
                "category_path": taxonomy_entry["category_path"],
                "tier_1": taxonomy_entry["tier_1"],
                "tier_2": taxonomy_entry["tier_2"],
                "tier_3": taxonomy_entry["tier_3"],
                "tier_4": taxonomy_entry["tier_4"],
                "tier_5": taxonomy_entry["tier_5"],
                "grouping_tier_key": taxonomy_entry["grouping_tier_key"],
                "grouping_value": taxonomy_entry["grouping_value"],
                "reasoning": classification.get("reasoning", "Agent analysis")
            }
            state["purchase_results"].append(selection)

        # ===== ENHANCED LOGGING: Validation Pipeline Summary =====
        logger.info(f"📊 Purchase Validation Pipeline:")
        logger.info(f"  - LLM returned: {len(classifications)} raw classifications")
        logger.info(f"  - After evidence judge: {len(validated_classifications)} passed quality check")
        logger.info(f"  - After taxonomy validation: {len(state['purchase_results'])} final")

        if len(classifications) > len(validated_classifications):
            rejected = len(classifications) - len(validated_classifications)
            logger.warning(f"⚠️  Evidence judge rejected {rejected} classifications (weak evidence)")

        if len(validated_classifications) > len(state['purchase_results']):
            rejected = len(validated_classifications) - len(state['purchase_results'])
            logger.warning(f"⚠️  Final validation rejected {rejected} classifications (taxonomy mismatch)")

        # Log summary with provenance info
        classifications_with_provenance = sum(1 for c in state["purchase_results"] if c.get("email_id"))
        logger.info(
            f"✅ Purchase agent complete: {len(state['purchase_results'])} classifications added\n"
            f"   Provenance tracked: {classifications_with_provenance}/{len(state['purchase_results'])} have email_id"
        )

    except Exception as e:
        logger.error(f"Purchase agent failed: {e}", exc_info=True)
        from ..state import add_error
        add_error(state, f"Purchase analysis failed: {str(e)}")

    return state


def analyze_all_node(state: WorkflowState) -> WorkflowState:
    """
    Combined analyzer node that runs all 4 analyzers sequentially.

    This replaces the previous conditional routing approach which could only
    route to one analyzer at a time. By running all analyzers in one node,
    we ensure every email is checked for all signal types.

    Design Decision (2025-10-07):
    - Removed brittle regex routing that missed global variations
    - Run all analyzers, let LLMs decide if signals exist
    - Each analyzer returns empty if no signals found
    - Cost: ~33% increase vs selective routing
    - Benefit: Never miss data, globally scalable

    Args:
        state: Current workflow state

    Returns:
        Updated state with all analyzer results populated

    Example:
        >>> state = analyze_all_node(state)
        >>> # All 4 result arrays populated:
        >>> # - demographics_results
        >>> # - household_results
        >>> # - interests_results
        >>> # - purchase_results
    """
    logger.info("Running all 4 analyzers on current email")

    # Run each analyzer in sequence
    # Each analyzer appends to its respective results array
    state = demographics_analyzer_node(state)
    state = household_analyzer_node(state)
    state = interests_analyzer_node(state)
    state = purchase_analyzer_node(state)

    # Log summary
    demographics_count = len(state.get("demographics_results", []))
    household_count = len(state.get("household_results", []))
    interests_count = len(state.get("interests_results", []))
    purchase_count = len(state.get("purchase_results", []))

    logger.info(
        f"All analyzers complete - Results: "
        f"demographics={demographics_count}, household={household_count}, "
        f"interests={interests_count}, purchase={purchase_count}"
    )

    return state


# =============================================================================
# Helper Functions for Phase 4 LLM Integration
# =============================================================================

def _prepare_llm_prompt(email: Dict[str, Any], taxonomy_section: str) -> str:
    """
    Prepare LLM prompt for taxonomy classification.

    This will be used in Phase 4 when implementing actual LLM analysis.

    Args:
        email: Email dictionary
        taxonomy_section: Section to analyze (demographics, household, etc.)

    Returns:
        Formatted prompt string

    Example:
        >>> prompt = _prepare_llm_prompt(email, "demographics")
        >>> # Phase 4: Pass to LLM for analysis
    """
    prompt = f"""
    Analyze the following email for {taxonomy_section} signals and return
    taxonomy classifications with confidence scores.

    Email Subject: {email.get('subject', '')}
    Email Body: {email.get('body', '')[:1000]}  # Limit to first 1000 chars

    Task: Identify relevant IAB Taxonomy classifications for {taxonomy_section}.
    Return only classifications you are confident about (confidence >= 0.6).

    Format: Return JSON array of taxonomy selections.
    """

    return prompt.strip()


def _parse_llm_response(llm_response: str) -> list:
    """
    Parse LLM response into taxonomy selections.

    This will be used in Phase 4 when implementing actual LLM analysis.

    Args:
        llm_response: Raw LLM response (JSON string)

    Returns:
        List of taxonomy selection dictionaries

    Example:
        >>> selections = _parse_llm_response(llm_json_response)
        >>> # Returns: [{"taxonomy_id": 5, "value": "25-29", ...}, ...]
    """
    import json

    try:
        selections = json.loads(llm_response)
        return selections
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM response as JSON")
        return []