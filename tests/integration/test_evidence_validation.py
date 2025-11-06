"""
Integration Tests for Evidence Quality Validation

Tests LLM-as-Judge evidence validation across all 4 agents.
Verifies that inappropriate inferences are blocked and confidence is adjusted.
"""

import pytest
from src.email_parser.agents.demographics_agent import extract_demographics_with_agent
from src.email_parser.agents.household_agent import extract_household_with_agent
from src.email_parser.agents.interests_agent import extract_interests_with_agent
from src.email_parser.agents.purchase_agent import extract_purchase_with_agent
from src.email_parser.workflow.llm_wrapper import AnalyzerLLMClient


class TestEvidenceJudge:
    """Test LLM-as-Judge evidence quality validation."""

    @pytest.fixture
    def llm_client(self):
        """Create LLM client for testing."""
        return AnalyzerLLMClient(provider="openai", model="gpt-4o-mini")

    def test_blocks_age_from_products(self, llm_client):
        """Should block age classification from product purchases."""
        email = {
            "subject": "Order confirmation",
            "body": "Your iPhone 15 has shipped. Tracking: XYZ123"
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should NOT have age classification based on product
        age_classes = [c for c in result["classifications"]
                      if "age" in c.get("value", "").lower() or
                         c.get("taxonomy_id") in range(2, 11)]
        assert len(age_classes) == 0, "Age should not be inferred from product purchases"

    def test_blocks_gender_from_marital_status(self, llm_client):
        """Should block gender classification from marital status mentions."""
        email = {
            "subject": "Wedding invitation",
            "body": "Congratulations on getting married! We're so happy for you."
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should NOT have gender classification based on marriage
        gender_classes = [c for c in result["classifications"]
                         if c.get("taxonomy_id") in [49, 50]]
        assert len(gender_classes) == 0, "Gender should not be inferred from marital status"

    def test_blocks_education_from_job_title(self, llm_client):
        """Should NOT infer education from job title alone."""
        email = {
            "subject": "Career update",
            "body": "Excited to start my new role as Senior Software Engineer!"
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should NOT have education classification based on job title
        edu_classes = [c for c in result["classifications"]
                      if c.get("taxonomy_id") in range(18, 39)]
        assert len(edu_classes) == 0, "Education should not be inferred from job title alone"

    def test_blocks_job_related_interests(self, llm_client):
        """Should block interests from job-related emails."""
        email = {
            "subject": "Work newsletter",
            "body": "Required reading for all engineers: New technology stack overview."
        }

        result = extract_interests_with_agent([email], llm_client)

        # Should NOT classify as personal interest (it's required reading)
        # This is a judgment call - evidence judge should detect job context
        tech_interests = [c for c in result["classifications"]
                         if "technology" in c.get("value", "").lower()]

        # If classified, confidence should be very low due to job context
        if len(tech_interests) > 0:
            assert tech_interests[0]["confidence"] < 0.5, \
                "Job-related interests should have low confidence or be blocked"

    def test_allows_explicit_age_mention(self, llm_client):
        """Should allow age classification from explicit mention."""
        email = {
            "subject": "Birthday",
            "body": "Can't believe I'm turning 32 tomorrow!"
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should have age classification
        age_classes = [c for c in result["classifications"]
                      if "30" in c.get("value", "") or "32" in c.get("value", "")]
        assert len(age_classes) > 0, "Explicit age mention should be classified"
        assert age_classes[0]["confidence"] >= 0.8, "Explicit evidence should have high confidence"

    def test_allows_gender_from_title(self, llm_client):
        """Should allow gender classification from Mr./Ms. title."""
        email = {
            "subject": "Account notification",
            "body": "Dear Mr. Johnson, your account has been updated."
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should have Male classification
        gender_classes = [c for c in result["classifications"]
                         if c.get("value") == "Male"]
        assert len(gender_classes) > 0, "Gender from title should be classified"
        assert gender_classes[0]["confidence"] >= 0.85, "Title is strong evidence"

    def test_allows_education_from_degree_mention(self, llm_client):
        """Should allow education classification from degree mention."""
        email = {
            "subject": "Alumni newsletter",
            "body": "As a holder of a Bachelor's degree in Computer Science..."
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should have education classification (taxonomy_id 18-39 or contains "education")
        edu_classes = [c for c in result["classifications"]
                      if c.get("taxonomy_id") in range(18, 39) or
                         "education" in c.get("value", "").lower()]
        assert len(edu_classes) > 0, "Explicit degree mention should be classified"
        assert edu_classes[0]["confidence"] >= 0.8

    def test_adjusts_contextual_evidence_confidence(self, llm_client):
        """Should reduce confidence for contextual (indirect) evidence."""
        email = {
            "subject": "Apartment notice",
            "body": "Building maintenance scheduled for all units in the complex."
        }

        result = extract_household_with_agent([email], llm_client)

        # Might classify as "Apartment" but confidence should be moderate
        apartment_classes = [c for c in result["classifications"]
                            if "apartment" in c.get("value", "").lower()]

        if len(apartment_classes) > 0:
            # Contextual evidence should have reduced confidence (not > 0.7)
            assert apartment_classes[0]["confidence"] < 0.75, \
                "Contextual evidence should have reduced confidence"

    def test_evidence_judge_handles_errors_gracefully(self, llm_client):
        """Evidence judge should not crash workflow on errors."""
        email = {
            "subject": "Test",
            "body": "This is a test email with minimal content."
        }

        # Should complete without errors even if judge has issues
        result = extract_demographics_with_agent([email], llm_client)
        assert "classifications" in result, "Workflow should complete even if judge fails"

    def test_blocking_preserves_taxonomy_validation(self, llm_client):
        """Evidence validation should run AFTER taxonomy validation."""
        # Both validation layers should work together:
        # 1. Taxonomy validation blocks wrong IDs
        # 2. Evidence validation blocks inappropriate reasoning

        email = {
            "subject": "Newsletter",
            "body": "Tech news for professionals."
        }

        result = extract_demographics_with_agent([email], llm_client)

        # All returned classifications should have valid taxonomy IDs
        for c in result["classifications"]:
            assert c.get("taxonomy_id") is not None
            assert isinstance(c.get("taxonomy_id"), int)
            assert c.get("value") is not None

    def test_multiple_classifications_validated_independently(self, llm_client):
        """Each classification should be validated separately."""
        email = {
            "subject": "Profile",
            "body": "I'm 35 years old. Dear Mr. Smith, welcome!"
        }

        result = extract_demographics_with_agent([email], llm_client)

        # Should have both age and gender (both valid evidence)
        age_classes = [c for c in result["classifications"]
                      if "30" in c.get("value", "") or "35" in c.get("value", "")]
        gender_classes = [c for c in result["classifications"]
                         if c.get("value") == "Male"]

        # Both should pass validation independently
        assert len(age_classes) > 0, "Valid age should be classified"
        assert len(gender_classes) > 0, "Valid gender should be classified"

    def test_evidence_validation_cost_reasonable(self, llm_client):
        """Evidence validation should not significantly increase cost."""
        from src.email_parser.workflow.cost_tracker import CostTracker

        cost_tracker = CostTracker()
        llm_client_with_tracker = AnalyzerLLMClient(
            provider="openai",
            model="gpt-4o-mini",
            cost_tracker=cost_tracker
        )

        email = {
            "subject": "Test",
            "body": "I'm turning 30. Dear Mr. Smith."
        }

        result = extract_demographics_with_agent([email], llm_client_with_tracker)

        total_cost = cost_tracker.get_total_cost()

        # Evidence validation adds judge calls but should be < $0.01 per email
        assert total_cost < 0.01, "Evidence validation cost should be minimal"
