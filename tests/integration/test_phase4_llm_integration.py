#!/usr/bin/env python3
"""
Phase 4 Integration Tests with Real LLM

Tests the complete analyzer workflow with actual LLM API calls.
Requires API keys to be configured in environment.

Run with:
    pytest tests/integration/test_phase4_llm_integration.py -v
"""

import pytest
import os
from typing import Dict, Any

from src.email_parser.workflow.state import WorkflowState, create_initial_state
from src.email_parser.workflow.nodes.analyzers import (
    demographics_analyzer_node,
    household_analyzer_node,
    interests_analyzer_node,
    purchase_analyzer_node,
)


# =============================================================================
# Configuration and Fixtures
# =============================================================================

def has_claude_api_key() -> bool:
    """Check if Claude API key is configured."""
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def has_openai_api_key() -> bool:
    """Check if OpenAI API key is configured."""
    return bool(os.getenv("OPENAI_API_KEY"))


# Skip tests if no API keys are available
pytestmark = pytest.mark.skipif(
    not (has_claude_api_key() or has_openai_api_key()),
    reason="No LLM API keys configured"
)


@pytest.fixture
def llm_provider() -> str:
    """Determine which LLM provider to use for tests."""
    if has_claude_api_key():
        return "claude"
    elif has_openai_api_key():
        return "openai"
    else:
        pytest.skip("No LLM API keys configured")


# =============================================================================
# Test Email Fixtures
# =============================================================================

@pytest.fixture
def tech_newsletter_email() -> Dict[str, Any]:
    """Sample tech newsletter email."""
    return {
        "id": "test_tech_newsletter",
        "subject": "Weekly Tech Digest - AI, Blockchain, and More",
        "body": """
        Welcome to this week's top tech stories!

        - OpenAI releases GPT-5 with groundbreaking capabilities
        - Ethereum 2.0 staking rewards reach new highs
        - Apple announces M3 chip for MacBook Pro
        - Tesla unveils new self-driving features

        Subscribe to our premium newsletter for deeper analysis.
        """,
        "from": "newsletter@techdigest.com",
        "date": "2025-09-30"
    }


@pytest.fixture
def order_confirmation_email() -> Dict[str, Any]:
    """Sample order confirmation email."""
    return {
        "id": "test_order_confirmation",
        "subject": "Your Order Confirmation #12345 - Dell XPS Laptop",
        "body": """
        Thank you for your purchase!

        Order Number: 12345
        Item: Dell XPS 15 Laptop - Intel Core i7, 32GB RAM, 1TB SSD
        Price: $2,499.99
        Shipping Address: 123 Main St, San Francisco, CA 94105

        Your order will ship within 2-3 business days.
        Estimated delivery: October 5-7, 2025
        """,
        "from": "orders@dell.com",
        "date": "2025-09-30"
    }


@pytest.fixture
def utility_bill_email() -> Dict[str, Any]:
    """Sample utility bill email."""
    return {
        "id": "test_utility_bill",
        "subject": "Your September Electric Bill - $145.23",
        "body": """
        Pacific Gas & Electric
        Account Number: 98765432

        Your September electric bill is ready.

        Current Charges: $145.23
        Service Address: 456 Oak Avenue, Apartment 3B, Oakland, CA 94610
        Usage: 425 kWh

        Due Date: October 15, 2025
        """,
        "from": "billing@pge.com",
        "date": "2025-09-28"
    }


@pytest.fixture
def fitness_newsletter_email() -> Dict[str, Any]:
    """Sample fitness newsletter email."""
    return {
        "id": "test_fitness_newsletter",
        "subject": "Your Weekly Fitness Tips - Marathon Training Edition",
        "body": """
        Hi Runner!

        This week's marathon training tips:

        1. Progressive Long Runs: Increase your weekend long run by 10%
        2. Nutrition: Focus on complex carbs before long runs
        3. Recovery: Don't skip rest days
        4. Cross-training: Add yoga or swimming twice a week

        Join our premium coaching program for personalized plans.
        """,
        "from": "coach@marathontraining.com",
        "date": "2025-09-29"
    }


# =============================================================================
# Demographics Analyzer Integration Tests
# =============================================================================

class TestDemographicsAnalyzerIntegration:
    """Integration tests for demographics analyzer with real LLM."""

    def test_demographics_from_newsletter(
        self,
        tech_newsletter_email,
        llm_provider
    ):
        """Test demographics analysis on tech newsletter."""
        state = create_initial_state()
        state["emails"] = [tech_newsletter_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        result_state = demographics_analyzer_node(state)

        # Should extract some demographic signals (age, interests suggest tech-savvy demographic)
        # Note: Results may vary based on LLM interpretation
        assert "demographics_results" in result_state
        # LLM might not find strong demographic signals in a newsletter
        # This is acceptable behavior

    def test_demographics_from_order(
        self,
        order_confirmation_email,
        llm_provider
    ):
        """Test demographics analysis on order confirmation."""
        state = create_initial_state()
        state["emails"] = [order_confirmation_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        result_state = demographics_analyzer_node(state)

        # High-end laptop purchase might suggest certain demographics
        assert "demographics_results" in result_state


# =============================================================================
# Household Analyzer Integration Tests
# =============================================================================

class TestHouseholdAnalyzerIntegration:
    """Integration tests for household analyzer with real LLM."""

    def test_household_from_utility_bill(
        self,
        utility_bill_email,
        llm_provider
    ):
        """Test household analysis on utility bill."""
        state = create_initial_state()
        state["emails"] = [utility_bill_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        result_state = household_analyzer_node(state)

        # Should extract household signals (location, property type)
        results = result_state["household_results"]

        # Utility bills often have strong household signals
        if len(results) > 0:
            # Verify structure
            assert results[0]["section"] == "household"
            assert 0.0 <= results[0]["confidence"] <= 1.0
            assert "value" in results[0]

    def test_household_from_order_with_address(
        self,
        order_confirmation_email,
        llm_provider
    ):
        """Test household analysis on order with shipping address."""
        state = create_initial_state()
        state["emails"] = [order_confirmation_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        result_state = household_analyzer_node(state)

        # Address in email should provide location signals
        assert "household_results" in result_state


# =============================================================================
# Interests Analyzer Integration Tests
# =============================================================================

class TestInterestsAnalyzerIntegration:
    """Integration tests for interests analyzer with real LLM."""

    def test_interests_from_tech_newsletter(
        self,
        tech_newsletter_email,
        llm_provider
    ):
        """Test interests analysis on tech newsletter."""
        state = create_initial_state()
        state["emails"] = [tech_newsletter_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        result_state = interests_analyzer_node(state)

        # Should identify multiple tech-related interests
        results = result_state["interests_results"]

        # Tech newsletter should yield interests
        if len(results) > 0:
            assert results[0]["section"] == "interests"
            # Verify confidence is reasonable
            for result in results:
                assert 0.6 <= result["confidence"] <= 0.95
                assert len(result["value"]) > 0

    def test_interests_from_fitness_newsletter(
        self,
        fitness_newsletter_email,
        llm_provider
    ):
        """Test interests analysis on fitness newsletter."""
        state = create_initial_state()
        state["emails"] = [fitness_newsletter_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        result_state = interests_analyzer_node(state)

        # Should identify fitness/health interests
        results = result_state["interests_results"]

        if len(results) > 0:
            # Check for fitness-related interests
            values_lower = [r["value"].lower() for r in results]
            # Should find something fitness-related
            assert any(
                term in " ".join(values_lower)
                for term in ["fitness", "running", "health", "sports"]
            )


# =============================================================================
# Purchase Analyzer Integration Tests
# =============================================================================

class TestPurchaseAnalyzerIntegration:
    """Integration tests for purchase analyzer with real LLM."""

    def test_purchase_from_order_confirmation(
        self,
        order_confirmation_email,
        llm_provider
    ):
        """Test purchase analysis on order confirmation."""
        state = create_initial_state()
        state["emails"] = [order_confirmation_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        result_state = purchase_analyzer_node(state)

        # Should strongly identify actual purchase
        results = result_state["purchase_results"]

        # Order confirmation should yield purchase signals
        assert len(results) > 0, "Should detect purchase from order confirmation"

        # Verify high confidence for actual purchase
        for result in results:
            assert result["section"] == "purchase_intent"
            # Order confirmations typically have high confidence
            if "purchase" in result["value"].lower() or "confirmed" in result["value"].lower():
                assert result["confidence"] >= 0.8

    def test_purchase_from_newsletter_no_signal(
        self,
        tech_newsletter_email,
        llm_provider
    ):
        """Test purchase analyzer on newsletter (should find no purchase)."""
        state = create_initial_state()
        state["emails"] = [tech_newsletter_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        result_state = purchase_analyzer_node(state)

        # Newsletter should not trigger purchase signals
        # (unless it has affiliate links, which this doesn't)
        results = result_state["purchase_results"]

        # Either no results, or low confidence
        for result in results:
            # If any purchase signals found, they should be low confidence
            assert result["confidence"] < 0.8


# =============================================================================
# End-to-End Workflow Tests
# =============================================================================

class TestCompleteWorkflow:
    """Test complete analyzer workflow with real emails."""

    def test_complete_analysis_pipeline(
        self,
        order_confirmation_email,
        llm_provider
    ):
        """Test running all analyzers on a single email."""
        state = create_initial_state()
        state["emails"] = [order_confirmation_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        # Run all analyzers
        state = demographics_analyzer_node(state)
        state = household_analyzer_node(state)
        state = interests_analyzer_node(state)
        state = purchase_analyzer_node(state)

        # Verify all analyzer results are present
        assert "demographics_results" in state
        assert "household_results" in state
        assert "interests_results" in state
        assert "purchase_results" in state

        # Order confirmation should trigger at least household and purchase
        assert len(state["household_results"]) > 0 or len(state["purchase_results"]) > 0

    def test_multiple_emails_batch(
        self,
        tech_newsletter_email,
        order_confirmation_email,
        fitness_newsletter_email,
        llm_provider
    ):
        """Test analyzing multiple emails in sequence."""
        state = create_initial_state()
        state["emails"] = [
            tech_newsletter_email,
            order_confirmation_email,
            fitness_newsletter_email
        ]
        state["llm_provider"] = llm_provider

        # Process each email
        for i in range(len(state["emails"])):
            state["current_email_index"] = i

            # Run all analyzers
            state = demographics_analyzer_node(state)
            state = household_analyzer_node(state)
            state = interests_analyzer_node(state)
            state = purchase_analyzer_node(state)

        # Should have accumulated results from all emails
        total_results = (
            len(state["demographics_results"]) +
            len(state["household_results"]) +
            len(state["interests_results"]) +
            len(state["purchase_results"])
        )

        assert total_results > 0, "Should have found some signals across all emails"


# =============================================================================
# Performance and Cost Tests
# =============================================================================

@pytest.mark.slow
class TestPerformance:
    """Performance and cost tracking tests."""

    def test_response_time(
        self,
        tech_newsletter_email,
        llm_provider
    ):
        """Test that analyzer response time is reasonable."""
        import time

        state = create_initial_state()
        state["emails"] = [tech_newsletter_email]
        state["current_email_index"] = 0
        state["llm_provider"] = llm_provider

        start_time = time.time()
        demographics_analyzer_node(state)
        elapsed_time = time.time() - start_time

        # Should complete within reasonable time (5 seconds)
        assert elapsed_time < 5.0, f"Analyzer took {elapsed_time:.2f}s (expected < 5s)"

    @pytest.mark.skip(reason="Cost tracking not yet implemented")
    def test_cost_tracking(
        self,
        tech_newsletter_email,
        llm_provider
    ):
        """Test that cost tracking works correctly."""
        # TODO: Implement cost tracking
        pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])