#!/usr/bin/env python3
"""
Memory Schema Definitions

Defines the structure for semantic and episodic memories stored in LangMem.
These schemas ensure consistent memory storage and retrieval.

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md - Memory Structure section
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime


# =============================================================================
# Namespace Structure
# =============================================================================

def get_user_namespace(user_id: str, collection: str = "iab_taxonomy_profile") -> tuple:
    """
    Get the namespace tuple for a user's data collection.

    Namespace Structure: (user_id, collection_name)

    This isolates each user's memories and ensures privacy.
    Different users cannot access each other's namespaces.

    Design Decision:
    - We do NOT include taxonomy_id or section in the namespace
    - We do NOT include timestamps in the namespace
    - These are stored in the memory data itself for flexibility
    - Memory IDs use prefixes to encode type and section: "semantic_demographics_5_25-29"

    Args:
        user_id: Unique user identifier
        collection: Collection name (default: "iab_taxonomy_profile")
                   Options: "iab_taxonomy_profile", "processed_emails", "bank_transactions"

    Returns:
        Tuple for LangMem namespace

    Examples:
        >>> get_user_namespace("user_12345")
        ("user_12345", "iab_taxonomy_profile")

        >>> get_user_namespace("user_12345", "processed_emails")
        ("user_12345", "processed_emails")

        >>> # Future: Bank transaction data
        >>> get_user_namespace("user_12345", "bank_transactions")
        ("user_12345", "bank_transactions")
    """
    return (user_id, collection)


def get_processed_emails_namespace(user_id: str) -> tuple:
    """
    Get the namespace for tracking processed emails.

    This is a convenience wrapper for get_user_namespace().

    Args:
        user_id: Unique user identifier

    Returns:
        Tuple for LangMem namespace
    """
    return get_user_namespace(user_id, "processed_emails")


# =============================================================================
# Memory ID Construction Utilities
# =============================================================================

def build_semantic_memory_id(section: str, taxonomy_id: int, value: str) -> str:
    """
    Build a standardized memory_id for semantic memories.

    Format: semantic_{section}_{taxonomy_id}_{value_slug}

    This encoding allows us to:
    1. Identify memory type (semantic vs episodic)
    2. Filter by section without namespace overhead
    3. Uniquely identify each classification

    Args:
        section: Taxonomy section (demographics, interests, etc.)
        taxonomy_id: IAB Taxonomy unique ID
        value: Taxonomy value (e.g., "25-29", "Cryptocurrency")

    Returns:
        Standardized memory_id

    Examples:
        >>> build_semantic_memory_id("demographics", 5, "25-29")
        "semantic_demographics_5_25-29"

        >>> build_semantic_memory_id("interests", 342, "Cryptocurrency")
        "semantic_interests_342_cryptocurrency"
    """
    # Slugify value: lowercase, replace spaces/special chars with underscores
    value_slug = value.lower().replace(" ", "_").replace("|", "").replace("-", "_")
    # Remove multiple underscores
    value_slug = "_".join(filter(None, value_slug.split("_")))

    return f"semantic_{section}_{taxonomy_id}_{value_slug}"


def build_episodic_memory_id(email_id: str) -> str:
    """
    Build a standardized memory_id for episodic memories.

    Format: episodic_email_{email_id}

    Args:
        email_id: Source email ID

    Returns:
        Standardized memory_id

    Examples:
        >>> build_episodic_memory_id("19989c11387876ec")
        "episodic_email_19989c11387876ec"
    """
    return f"episodic_email_{email_id}"


def build_tracker_memory_id() -> str:
    """
    Build the memory_id for the processed emails tracker.

    Returns:
        Standardized memory_id for the tracker
    """
    return "tracker_processed_emails"


# =============================================================================
# Semantic Memory Schema (Facts about user)
# =============================================================================

class SemanticMemory(BaseModel):
    """
    Semantic memory represents a fact about the user.

    In our system, this is a taxonomy classification with confidence score
    and evidence tracking.

    Example: User's age range is 25-29 with 82% confidence based on 12 emails.
    """

    memory_id: str = Field(
        ...,
        description="Unique identifier for this memory (e.g., 'demo_age_range_25_29')"
    )

    # Taxonomy classification
    taxonomy_id: int = Field(..., description="IAB Taxonomy ID")

    category_path: str = Field(
        ...,
        description="Full taxonomy path (e.g., 'Demographic | Age Range | 25-29')"
    )

    # Tier breakdown for filtering and querying
    tier_1: str = Field(..., description="Tier 1 category (e.g., 'Demographic', 'Interest')")
    tier_2: str = Field(default="", description="Tier 2 subcategory (e.g., 'Age Range', 'Technology')")
    tier_3: str = Field(default="", description="Tier 3 value (e.g., '25-29', 'Cryptocurrency')")
    tier_4: str = Field(default="", description="Tier 4 (if applicable)")
    tier_5: str = Field(default="", description="Tier 5 (if applicable)")

    # Grouping metadata (pre-computed from taxonomy structure)
    grouping_tier_key: str = Field(
        default="tier_2",
        description="Which tier to use for grouping ('tier_2' or 'tier_3')"
    )
    grouping_value: str = Field(
        default="",
        description="The grouping value (e.g., 'Gender', 'Education (Highest Level)')"
    )

    value: str = Field(..., description="Final selected value (typically tier_3)")

    # Confidence and evidence
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score [0, 1]")
    evidence_count: int = Field(..., ge=0, description="Number of supporting emails")

    supporting_evidence: List[str] = Field(
        default_factory=list,
        description="Email IDs that support this classification"
    )

    contradicting_evidence: List[str] = Field(
        default_factory=list,
        description="Email IDs that contradict this classification"
    )

    # Temporal tracking
    first_observed: str = Field(
        ...,
        description="ISO 8601 timestamp when first observed"
    )

    last_validated: str = Field(
        ...,
        description="ISO 8601 timestamp of last validation"
    )

    last_updated: str = Field(
        ...,
        description="ISO 8601 timestamp of last update (any change to this memory)"
    )

    days_since_validation: int = Field(
        default=0,
        ge=0,
        description="Days since last validation (for temporal decay)"
    )

    # Data provenance
    data_source: str = Field(
        ...,
        description="Source of this classification (email, bank_transaction, manual, etc.)"
    )

    source_ids: List[str] = Field(
        default_factory=list,
        description="IDs of source data (email_ids, transaction_ids, etc.)"
    )

    # Metadata
    section: str = Field(
        ...,
        description="Taxonomy section (demographics, interests, purchase_intent, etc.)"
    )

    reasoning: Optional[str] = Field(
        None,
        description="LLM reasoning for this classification"
    )

    # Purchase Intent specific fields
    purchase_intent_flag: Optional[str] = Field(
        None,
        description="Purchase intent probability/recency flag (PIPR_HIGH, PIPR_MEDIUM, PIPR_LOW, ACTUAL_PURCHASE)"
    )

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "memory_id": "semantic_demographics_5_25-29",
                "taxonomy_id": 5,
                "category_path": "Demographic | Age Range | 25-29",
                "tier_1": "Demographic",
                "tier_2": "Age Range",
                "tier_3": "25-29",
                "tier_4": "",
                "tier_5": "",
                "grouping_tier_key": "tier_2",
                "grouping_value": "Age",
                "value": "25-29",
                "confidence": 0.82,
                "evidence_count": 12,
                "supporting_evidence": [
                    "email_19989c11387876ec",
                    "email_199876daa93f05dd"
                ],
                "contradicting_evidence": [],
                "first_observed": "2025-09-15T08:00:00Z",
                "last_validated": "2025-09-30T10:00:00Z",
                "last_updated": "2025-09-30T10:00:00Z",
                "days_since_validation": 0,
                "data_source": "email",
                "source_ids": [
                    "email_19989c11387876ec",
                    "email_199876daa93f05dd",
                    "email_19987250f7b0e7df"
                ],
                "section": "demographics",
                "reasoning": "Newsletter topics and language suggest professional aged 25-35"
            }
        }


# =============================================================================
# Episodic Memory Schema (Evidence trail from specific event)
# =============================================================================

class EpisodicMemory(BaseModel):
    """
    Episodic memory represents a specific event/email and what we learned from it.

    This creates an evidence trail showing which emails contributed to which
    taxonomy classifications and with what confidence.

    Example: Email from Sept 27 about crypto suggested 3 classifications with
    varying confidence levels.
    """

    episode_id: str = Field(
        ...,
        description="Unique identifier (typically email_id)"
    )

    # Email details
    email_id: str = Field(..., description="Source email ID")
    email_date: str = Field(..., description="ISO 8601 date of email")
    email_subject: Optional[str] = Field(None, description="Email subject line")
    email_summary: Optional[str] = Field(None, description="Email summary")

    # Taxonomy selections from this email
    taxonomy_selections: List[int] = Field(
        default_factory=list,
        description="List of taxonomy IDs inferred from this email"
    )

    confidence_contributions: Dict[int, float] = Field(
        default_factory=dict,
        description="Map of taxonomy_id -> confidence_contribution [0, 1]"
    )

    # LLM reasoning
    reasoning: str = Field(
        ...,
        description="LLM explanation of why these classifications were selected"
    )

    # Processing metadata
    processed_at: str = Field(
        ...,
        description="ISO 8601 timestamp when processed"
    )

    llm_model: str = Field(
        ...,
        description="LLM model used for analysis (e.g., 'claude:sonnet-4')"
    )

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "episode_id": "email_19989c11387876ec",
                "email_id": "19989c11387876ec",
                "email_date": "2025-09-27",
                "email_subject": "Crypto Venture Weekly",
                "email_summary": "Newsletter about crypto fundraising and market trends",
                "taxonomy_selections": [5, 156, 342],
                "confidence_contributions": {
                    5: 0.8,    # Age: 25-29
                    156: 0.6,  # Interest: Technology
                    342: 0.9   # Interest: Cryptocurrency
                },
                "reasoning": "Newsletter topics (crypto, tech startups) suggest tech professional age 25-35 with strong interest in cryptocurrency and investment",
                "processed_at": "2025-09-30T10:00:00Z",
                "llm_model": "claude:sonnet-4"
            }
        }


# =============================================================================
# Processed Email Tracking
# =============================================================================

class ProcessedEmailsTracker(BaseModel):
    """
    Tracks which emails have been processed to enable incremental daily runs.

    Only new emails need to be analyzed each day.
    """

    user_id: str = Field(..., description="User identifier")

    processed_email_ids: List[str] = Field(
        default_factory=list,
        description="List of email IDs that have been processed"
    )

    last_updated: str = Field(
        ...,
        description="ISO 8601 timestamp of last update"
    )

    total_processed: int = Field(
        default=0,
        ge=0,
        description="Total number of emails processed"
    )

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "user_id": "user_12345",
                "processed_email_ids": [
                    "19989c11387876ec",
                    "199876daa93f05dd",
                    "19987250f7b0e7df"
                ],
                "last_updated": "2025-09-30T10:00:00Z",
                "total_processed": 200
            }
        }


# =============================================================================
# Evidence Classification Types
# =============================================================================

class EvidenceType:
    """
    Evidence classification types for reconciliation.

    These determine how confidence scores are updated.
    """

    CONFIRMING = "confirming"       # New evidence supports existing classification
    CONTRADICTING = "contradicting" # New evidence conflicts with existing
    NEUTRAL = "neutral"             # New evidence neither supports nor contradicts
    NO_NEW_EVIDENCE = "no_new_evidence"  # No relevant evidence in new emails


# =============================================================================
# Memory Query Filters
# =============================================================================

class MemoryQueryFilter(BaseModel):
    """Filter criteria for querying memories."""

    section: Optional[str] = Field(
        None,
        description="Filter by section (demographics, interests, etc.)"
    )

    min_confidence: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold"
    )

    max_days_since_validation: Optional[int] = Field(
        None,
        ge=0,
        description="Maximum days since last validation (for finding stale memories)"
    )

    taxonomy_ids: Optional[List[int]] = Field(
        None,
        description="Filter by specific taxonomy IDs"
    )