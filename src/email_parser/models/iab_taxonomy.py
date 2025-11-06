#!/usr/bin/env python3
"""
IAB Taxonomy Data Models - Pydantic Schemas

Pydantic models for IAB Audience Taxonomy consumer profiles.
Includes validation, confidence scoring, and JSON serialization.

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional, Any
from datetime import datetime


# =============================================================================
# Taxonomy Entry Models
# =============================================================================

class TaxonomyEntry(BaseModel):
    """Single IAB Taxonomy entry."""

    id: int = Field(..., description="Unique IAB Taxonomy ID")
    parent_id: Optional[int] = Field(None, description="Parent taxonomy ID for hierarchy")
    name: str = Field(..., description="Full condensed name with pipe separation")
    tier_1: str = Field(default="", description="Tier 1 category")
    tier_2: str = Field(default="", description="Tier 2 category")
    tier_3: str = Field(default="", description="Tier 3 category")
    tier_4: str = Field(default="", description="Tier 4 category")
    tier_5: str = Field(default="", description="Tier 5 category")
    excel_row: int = Field(..., description="Excel row number (1-indexed)")


class PurchaseIntentClassification(BaseModel):
    """Purchase Intent Classification code (PIPR/PIPF/PIPV/PIFI)."""

    code: str = Field(..., description="Classification code (e.g., PIPR1, PIPF2)")
    description: str = Field(..., description="Human-readable description")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score [0, 1]")
    evidence: str = Field(..., description="Evidence supporting this classification")

    @field_validator('code')
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate classification code format."""
        if not v.startswith(('PIPR', 'PIPF', 'PIPV', 'PIFI')):
            raise ValueError(f"Invalid classification code: {v}")
        return v


# =============================================================================
# Taxonomy Selection Models
# =============================================================================

class TaxonomySelection(BaseModel):
    """
    User's classification within IAB Taxonomy.
    Represents a single taxonomy value selected for the user with confidence.
    """

    taxonomy_id: int = Field(..., description="IAB Taxonomy ID")
    tier_path: str = Field(..., description="Full tier path (e.g., 'Demographic | Age Range | 25-29')")
    value: str = Field(..., description="Selected taxonomy value")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score [0, 1]")
    evidence_count: int = Field(..., ge=0, description="Number of supporting email evidence")
    last_validated: str = Field(..., description="ISO 8601 date of last validation")
    days_since_validation: Optional[int] = Field(0, ge=0, description="Days since last validation")

    @field_validator('confidence')
    @classmethod
    def validate_confidence(cls, v: float) -> float:
        """Ensure confidence is within valid range."""
        if not 0.0 <= v <= 1.0:
            raise ValueError(f"Confidence must be between 0.0 and 1.0, got {v}")
        return v


class DemographicSelection(TaxonomySelection):
    """Demographic taxonomy selection (age, gender, education, etc.)."""
    pass


class InterestSelection(TaxonomySelection):
    """Interest category taxonomy selection."""
    pass


class PurchaseIntentSelection(TaxonomySelection):
    """Purchase intent taxonomy selection with optional classifications."""

    purchase_intent_flag: Optional[str] = Field(
        default=None,
        description="Purchase intent flag: PIPR_HIGH, PIPR_MEDIUM, PIPR_LOW, or ACTUAL_PURCHASE"
    )

    classifications: Optional[Dict[str, PurchaseIntentClassification]] = Field(
        default=None,
        description="PIPR/PIPF/PIPV/PIFI classifications"
    )


class ActualPurchaseSelection(TaxonomySelection):
    """Actual purchase with transaction details."""

    purchase_date: Optional[str] = Field(None, description="ISO 8601 date of purchase")
    evidence: str = Field(..., description="Evidence (receipt, confirmation email, etc.)")
    classifications: Optional[Dict[str, PurchaseIntentClassification]] = Field(
        default=None,
        description="PIPR/PIPF/PIPV classifications for purchase behavior"
    )


# =============================================================================
# Consumer Profile Sections
# =============================================================================

class DemographicsProfile(BaseModel):
    """Demographics section of consumer profile."""

    age_range: Optional[DemographicSelection] = None
    gender: Optional[DemographicSelection] = None
    education: Optional[DemographicSelection] = None
    occupation: Optional[DemographicSelection] = None
    marital_status: Optional[DemographicSelection] = None
    language: Optional[DemographicSelection] = None


class HouseholdLocation(BaseModel):
    """Household location data."""

    country: Optional[TaxonomySelection] = None
    region_state: Optional[TaxonomySelection] = None
    city: Optional[TaxonomySelection] = None
    metro_dma: Optional[TaxonomySelection] = None
    zip_postal: Optional[TaxonomySelection] = None


class HouseholdProfile(BaseModel):
    """Household data section of consumer profile."""

    location: Optional[HouseholdLocation] = None
    income: Optional[TaxonomySelection] = None
    length_of_residence: Optional[TaxonomySelection] = None
    life_stage: Optional[TaxonomySelection] = None
    median_home_value: Optional[TaxonomySelection] = None
    monthly_housing_payment: Optional[TaxonomySelection] = None
    number_of_adults: Optional[TaxonomySelection] = None
    number_of_children: Optional[TaxonomySelection] = None
    number_of_individuals: Optional[TaxonomySelection] = None
    ownership: Optional[TaxonomySelection] = None
    property_type: Optional[TaxonomySelection] = None
    urbanization: Optional[TaxonomySelection] = None


class PersonalFinanceProfile(BaseModel):
    """Personal finance section of consumer profile."""

    income: Optional[TaxonomySelection] = None
    affluence_level: Optional[TaxonomySelection] = None
    affluence_band: Optional[TaxonomySelection] = None


# =============================================================================
# Memory Statistics
# =============================================================================

class MemoryStats(BaseModel):
    """Statistics about stored memories and confidence distribution."""

    total_facts_stored: int = Field(..., ge=0)
    high_confidence_facts: int = Field(..., ge=0, description="Confidence >= 0.8")
    moderate_confidence_facts: int = Field(..., ge=0, description="Confidence 0.5-0.79")
    low_confidence_facts: int = Field(..., ge=0, description="Confidence < 0.5")
    facts_needing_validation: int = Field(..., ge=0, description="Stale facts (>30 days)")
    average_confidence: float = Field(..., ge=0.0, le=1.0)


# =============================================================================
# Complete IAB Consumer Profile
# =============================================================================

class DataCoverage(BaseModel):
    """Metadata about data coverage and processing."""

    total_emails_analyzed: int = Field(..., ge=0)
    emails_this_run: int = Field(..., ge=0)
    date_range: str = Field(..., description="Date range of emails (e.g., '2025-07-15 to 2025-09-30')")


class GeneratorMetadata(BaseModel):
    """Metadata about report generation."""

    system: str = Field(default="email_parser_iab_taxonomy")
    llm_model: str = Field(..., description="LLM model used (e.g., 'claude:sonnet-4')")
    workflow_version: str = Field(default="1.0")


class SectionConfidence(BaseModel):
    """Average confidence scores per profile section."""

    demographics: float = Field(..., ge=0.0, le=1.0)
    household: float = Field(..., ge=0.0, le=1.0)
    interests: float = Field(..., ge=0.0, le=1.0)
    purchase_intent: float = Field(..., ge=0.0, le=1.0)
    actual_purchases: float = Field(..., ge=0.0, le=1.0)


class IABConsumerProfile(BaseModel):
    """
    Complete IAB Audience Taxonomy consumer profile.

    This is the top-level model for JSON export.
    Follows the schema defined in IAB_TAXONOMY_PROFILE_REQUIREMENTS.md
    """

    # Metadata
    user_id: str = Field(..., description="User identifier")
    profile_version: int = Field(..., ge=1, description="Incremental profile version")
    generated_at: str = Field(..., description="ISO 8601 timestamp")
    schema_version: str = Field(default="1.0")
    generator: GeneratorMetadata
    data_coverage: DataCoverage

    # Profile Sections
    demographics: DemographicsProfile
    household: HouseholdProfile
    personal_finance: Optional[PersonalFinanceProfile] = None
    interests: List[InterestSelection] = Field(default_factory=list)
    purchase_intent: List[PurchaseIntentSelection] = Field(default_factory=list)
    actual_purchases: List[ActualPurchaseSelection] = Field(default_factory=list)

    # Statistics
    memory_stats: MemoryStats
    section_confidence: SectionConfidence

    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "user_id": "user_12345",
                "profile_version": 1,
                "generated_at": "2025-09-30T10:00:00Z",
                "schema_version": "1.0",
                "generator": {
                    "system": "email_parser_iab_taxonomy",
                    "llm_model": "claude:sonnet-4",
                    "workflow_version": "1.0"
                },
                "demographics": {
                    "age_range": {
                        "taxonomy_id": 5,
                        "tier_path": "Demographic | Age Range | 25-29",
                        "value": "25-29",
                        "confidence": 0.82,
                        "evidence_count": 12,
                        "last_validated": "2025-09-30",
                        "days_since_validation": 0
                    }
                }
            }
        }

    def export_json(self, file_path: str) -> None:
        """
        Export profile to JSON file.

        Args:
            file_path: Path to JSON output file
        """
        import json
        with open(file_path, 'w') as f:
            json.dump(self.model_dump(), f, indent=2)

    @classmethod
    def load_json(cls, file_path: str) -> "IABConsumerProfile":
        """
        Load profile from JSON file.

        Args:
            file_path: Path to JSON input file

        Returns:
            IABConsumerProfile instance
        """
        import json
        with open(file_path, 'r') as f:
            data = json.load(f)
        return cls(**data)