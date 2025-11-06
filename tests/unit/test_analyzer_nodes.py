#!/usr/bin/env python3
"""
Unit Tests for Analyzer Nodes

Tests analyzer nodes with mocked LLM responses to validate:
- Prompt construction
- Response parsing
- Taxonomy selection conversion
- Error handling
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any

from src.email_parser.workflow.nodes.analyzers import (
    demographics_analyzer_node,
    household_analyzer_node,
    interests_analyzer_node,
    purchase_analyzer_node
)
from src.email_parser.workflow.state import WorkflowState


@pytest.fixture
def sample_email() -> Dict[str, Any]:
    """Sample email for testing."""
    return {
        "id": "test_email_1",
        "subject": "Your Order Confirmation - Tech Store",
        "body": "Thank you for your purchase of the new laptop. Your order will ship within 2 business days."
    }


@pytest.fixture
def sample_state(sample_email) -> WorkflowState:
    """Sample workflow state for testing."""
    return {
        "emails": [sample_email],
        "current_email_index": 0,
        "demographics_results": [],
        "household_results": [],
        "interests_results": [],
        "purchase_results": [],
        "errors": [],
        "llm_provider": "claude",
        "llm_model": None
    }


class TestDemographicsAnalyzer:
    """Test demographics analyzer node."""

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_demographics_analyzer_success(self, mock_llm_client_class, sample_state):
        """Test successful demographics analysis."""
        # Mock LLM response
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 5,
                    "value": "25-29",
                    "confidence": 0.75,
                    "reasoning": "Language suggests young professional"
                },
                {
                    "taxonomy_id": 20,
                    "value": "Male",
                    "confidence": 0.70,
                    "reasoning": "Subscription to tech newsletter"
                }
            ]
        }
        mock_llm_client_class.return_value = mock_llm_client

        # Run analyzer
        result_state = demographics_analyzer_node(sample_state)

        # Verify LLM client was called
        mock_llm_client_class.assert_called_once_with(
            provider="claude",
            model=None
        )
        mock_llm_client.analyze_email.assert_called_once()

        # Verify results
        assert len(result_state["demographics_results"]) == 2

        # Check first classification
        first_result = result_state["demographics_results"][0]
        assert first_result["taxonomy_id"] == 5
        assert first_result["value"] == "25-29"
        assert first_result["section"] == "demographics"
        assert first_result["confidence"] == 0.75
        assert first_result["reasoning"] == "Language suggests young professional"

        # Check second classification
        second_result = result_state["demographics_results"][1]
        assert second_result["taxonomy_id"] == 20
        assert second_result["value"] == "Male"

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_demographics_analyzer_no_classifications(self, mock_llm_client_class, sample_state):
        """Test demographics analyzer with no classifications."""
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {"classifications": []}
        mock_llm_client_class.return_value = mock_llm_client

        result_state = demographics_analyzer_node(sample_state)

        assert len(result_state["demographics_results"]) == 0

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_demographics_analyzer_llm_error(self, mock_llm_client_class, sample_state):
        """Test demographics analyzer with LLM error."""
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.side_effect = Exception("LLM API error")
        mock_llm_client_class.return_value = mock_llm_client

        result_state = demographics_analyzer_node(sample_state)

        # Should have error in state
        assert len(result_state["errors"]) == 1
        assert "Demographics analysis failed" in result_state["errors"][0]

    def test_demographics_analyzer_no_email(self):
        """Test demographics analyzer with no email."""
        state = {
            "emails": [],
            "current_email_index": 0,
            "demographics_results": [],
            "errors": []
        }

        result_state = demographics_analyzer_node(state)

        # Should return state unchanged
        assert len(result_state["demographics_results"]) == 0


class TestHouseholdAnalyzer:
    """Test household analyzer node."""

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_household_analyzer_success(self, mock_llm_client_class, sample_state):
        """Test successful household analysis."""
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 100,
                    "value": "Urban",
                    "confidence": 0.80,
                    "reasoning": "City address in shipping information"
                },
                {
                    "taxonomy_id": 111,
                    "value": "Mid-Range",
                    "confidence": 0.70,
                    "reasoning": "Standard service providers"
                }
            ]
        }
        mock_llm_client_class.return_value = mock_llm_client

        result_state = household_analyzer_node(sample_state)

        assert len(result_state["household_results"]) == 2
        assert result_state["household_results"][0]["taxonomy_id"] == 100
        assert result_state["household_results"][0]["value"] == "Urban"
        assert result_state["household_results"][0]["section"] == "household"


class TestInterestsAnalyzer:
    """Test interests analyzer node."""

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_interests_analyzer_multiple_interests(self, mock_llm_client_class, sample_state):
        """Test interests analyzer with multiple interests."""
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 156,
                    "value": "Technology",
                    "confidence": 0.90,
                    "reasoning": "Tech newsletter subscription"
                },
                {
                    "taxonomy_id": 342,
                    "value": "Cryptocurrency",
                    "confidence": 0.85,
                    "reasoning": "Crypto exchange notification"
                },
                {
                    "taxonomy_id": 250,
                    "value": "Fitness",
                    "confidence": 0.75,
                    "reasoning": "Gym membership email"
                }
            ]
        }
        mock_llm_client_class.return_value = mock_llm_client

        result_state = interests_analyzer_node(sample_state)

        # Should have all 3 interests
        assert len(result_state["interests_results"]) == 3
        assert result_state["interests_results"][0]["section"] == "interests"

        # Check values
        values = [r["value"] for r in result_state["interests_results"]]
        assert "Technology" in values
        assert "Cryptocurrency" in values
        assert "Fitness" in values


class TestPurchaseAnalyzer:
    """Test purchase analyzer node."""

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_purchase_analyzer_order_confirmation(self, mock_llm_client_class, sample_state):
        """Test purchase analyzer with order confirmation."""
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 500,
                    "value": "PIPR_High",
                    "confidence": 0.95,
                    "reasoning": "Recent order confirmation email"
                },
                {
                    "taxonomy_id": 510,
                    "value": "Confirmed Purchase",
                    "confidence": 0.95,
                    "reasoning": "Order confirmation detected"
                },
                {
                    "taxonomy_id": 520,
                    "value": "Electronics",
                    "confidence": 0.90,
                    "reasoning": "Laptop purchase confirmed"
                }
            ]
        }
        mock_llm_client_class.return_value = mock_llm_client

        result_state = purchase_analyzer_node(sample_state)

        assert len(result_state["purchase_results"]) == 3

        # Check PIPR classification
        pipr_result = result_state["purchase_results"][0]
        assert pipr_result["taxonomy_id"] == 500
        assert pipr_result["value"] == "PIPR_High"
        assert pipr_result["section"] == "purchase_intent"
        assert pipr_result["confidence"] == 0.95

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_purchase_analyzer_no_purchase(self, mock_llm_client_class, sample_state):
        """Test purchase analyzer with non-purchase email."""
        # Change email to newsletter (no purchase)
        sample_state["emails"][0] = {
            "id": "test_email_2",
            "subject": "Weekly Tech Newsletter",
            "body": "Here are this week's top tech stories..."
        }

        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {"classifications": []}
        mock_llm_client_class.return_value = mock_llm_client

        result_state = purchase_analyzer_node(sample_state)

        # Should have no purchase results
        assert len(result_state["purchase_results"]) == 0


class TestAnalyzerIntegration:
    """Integration tests for analyzer nodes working together."""

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_all_analyzers_on_same_email(self, mock_llm_client_class, sample_state):
        """Test all analyzers processing the same email."""
        # Mock LLM client to return empty classifications for all
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {"classifications": []}
        mock_llm_client_class.return_value = mock_llm_client

        # Run all analyzers
        state = sample_state
        state = demographics_analyzer_node(state)
        state = household_analyzer_node(state)
        state = interests_analyzer_node(state)
        state = purchase_analyzer_node(state)

        # Verify LLM was called 4 times (once per analyzer)
        assert mock_llm_client.analyze_email.call_count == 4

        # State should have all result arrays
        assert "demographics_results" in state
        assert "household_results" in state
        assert "interests_results" in state
        assert "purchase_results" in state


class TestPromptConstruction:
    """Test prompt construction for analyzers."""

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_prompt_includes_email_content(self, mock_llm_client_class, sample_state):
        """Test that prompts include email subject and body."""
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {"classifications": []}
        mock_llm_client_class.return_value = mock_llm_client

        demographics_analyzer_node(sample_state)

        # Get the prompt that was passed to analyze_email
        call_args = mock_llm_client.analyze_email.call_args
        prompt = call_args[0][0]  # First positional argument

        # Verify email content is in prompt
        assert sample_state["emails"][0]["subject"] in prompt
        assert sample_state["emails"][0]["body"][:2000] in prompt

    @patch('src.email_parser.workflow.llm_wrapper.AnalyzerLLMClient')
    def test_prompt_includes_taxonomy_context(self, mock_llm_client_class, sample_state):
        """Test that prompts include taxonomy context."""
        mock_llm_client = Mock()
        mock_llm_client.analyze_email.return_value = {"classifications": []}
        mock_llm_client_class.return_value = mock_llm_client

        interests_analyzer_node(sample_state)

        call_args = mock_llm_client.analyze_email.call_args
        prompt = call_args[0][0]

        # Verify taxonomy categories are in prompt
        assert "Technology" in prompt or "Interests Categories" in prompt


if __name__ == "__main__":
    pytest.main([__file__, "-v"])