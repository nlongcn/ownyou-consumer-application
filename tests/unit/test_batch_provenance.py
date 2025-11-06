"""
Unit tests for batch processing with email provenance tracking.

Tests verify that email_id tracking works correctly across all analyzer agents
in batch processing mode.
"""

import pytest
from unittest.mock import MagicMock, patch
from src.email_parser.agents.demographics_agent import extract_demographics_with_agent
from src.email_parser.agents.household_agent import extract_household_with_agent
from src.email_parser.agents.interests_agent import extract_interests_with_agent
from src.email_parser.agents.purchase_agent import extract_purchase_with_agent


class TestProvenanceTracking:
    """Test email provenance tracking in batch processing."""

    @pytest.fixture
    def mock_llm_client(self):
        """Mock LLM client that returns valid classifications."""
        mock_client = MagicMock()
        mock_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 50,
                    "value": "Male",
                    "confidence": 0.9,
                    "reasoning": "Subject contains 'Mr.' title",
                    "email_number": 1
                },
                {
                    "taxonomy_id": 49,
                    "value": "Female",
                    "confidence": 0.85,
                    "reasoning": "Subject contains 'Ms.' title",
                    "email_number": 2
                }
            ]
        }
        return mock_client

    @pytest.fixture
    def sample_emails(self):
        """Sample emails with explicit IDs for provenance tracking."""
        return [
            {
                "id": "email_001",
                "subject": "Hello Mr. Smith",
                "sender": "test@example.com",
                "body": "This is a test email with male pronouns."
            },
            {
                "id": "email_002",
                "subject": "Dear Ms. Johnson",
                "sender": "test2@example.com",
                "body": "This is a test email with female pronouns."
            },
            {
                "id": "email_003",
                "subject": "Newsletter update",
                "sender": "news@example.com",
                "body": "Generic content without clear signals."
            }
        ]

    def test_demographics_agent_provenance_tracking(self, mock_llm_client, sample_emails):
        """Test demographics agent correctly maps email_number to email_id."""
        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.9,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            # Run agent
            result = extract_demographics_with_agent(sample_emails, mock_llm_client, max_iterations=1)

            # Verify provenance tracking
            assert len(result["classifications"]) == 2

            # First classification should map to email_001
            assert result["classifications"][0]["email_id"] == "email_001"
            assert result["classifications"][0]["email_number"] == 1

            # Second classification should map to email_002
            assert result["classifications"][1]["email_id"] == "email_002"
            assert result["classifications"][1]["email_number"] == 2

    def test_household_agent_provenance_tracking(self, sample_emails):
        """Test household agent correctly maps email_number to email_id."""
        mock_llm_client = MagicMock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 100,
                    "value": "$50,000-$74,999",
                    "confidence": 0.75,
                    "reasoning": "Mortgage payment suggests this income range",
                    "email_number": 1
                }
            ]
        }

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.8,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_household_with_agent(sample_emails, mock_llm_client, max_iterations=1)

            # Verify provenance
            assert len(result["classifications"]) == 1
            assert result["classifications"][0]["email_id"] == "email_001"
            assert result["classifications"][0]["email_number"] == 1

    def test_interests_agent_provenance_tracking(self, sample_emails):
        """Test interests agent correctly maps email_number to email_id."""
        mock_llm_client = MagicMock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 520,
                    "value": "Cryptocurrency",
                    "confidence": 0.9,
                    "reasoning": "Newsletter from CoinDesk",
                    "email_number": 3
                }
            ]
        }

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.9,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_interests_with_agent(sample_emails, mock_llm_client, max_iterations=1)

            # Verify provenance
            assert len(result["classifications"]) == 1
            assert result["classifications"][0]["email_id"] == "email_003"
            assert result["classifications"][0]["email_number"] == 3

    def test_purchase_agent_provenance_tracking(self, sample_emails):
        """Test purchase agent correctly maps email_number to email_id."""
        mock_llm_client = MagicMock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 1200,
                    "value": "Consumer Electronics",
                    "confidence": 0.95,
                    "reasoning": "Order confirmation for iPhone",
                    "purchase_intent_flag": "ACTUAL_PURCHASE",
                    "email_number": 2
                }
            ]
        }

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.95,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_purchase_with_agent(sample_emails, mock_llm_client, max_iterations=1)

            # Verify provenance
            assert len(result["classifications"]) == 1
            assert result["classifications"][0]["email_id"] == "email_002"
            assert result["classifications"][0]["email_number"] == 2
            assert result["classifications"][0]["purchase_intent_flag"] == "ACTUAL_PURCHASE"


class TestEdgeCases:
    """Test edge cases in batch processing."""

    def test_single_email_batch(self):
        """Test batch processing with a single email."""
        mock_llm_client = MagicMock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 50,
                    "value": "Male",
                    "confidence": 0.9,
                    "reasoning": "Test reasoning",
                    "email_number": 1
                }
            ]
        }

        single_email = [{
            "id": "solo_email",
            "subject": "Test",
            "sender": "test@example.com",
            "body": "Single email test"
        }]

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.9,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_demographics_with_agent(single_email, mock_llm_client, max_iterations=1)

            # Verify single email provenance
            assert len(result["classifications"]) == 1
            assert result["classifications"][0]["email_id"] == "solo_email"
            assert result["classifications"][0]["email_number"] == 1

    def test_missing_email_id(self):
        """Test handling of emails without explicit IDs."""
        mock_llm_client = MagicMock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 50,
                    "value": "Male",
                    "confidence": 0.9,
                    "reasoning": "Test reasoning",
                    "email_number": 1
                }
            ]
        }

        # Email without 'id' field
        email_no_id = [{
            "subject": "Test",
            "sender": "test@example.com",
            "body": "Email without ID"
        }]

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.9,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_demographics_with_agent(email_no_id, mock_llm_client, max_iterations=1)

            # Verify fallback ID is used
            assert len(result["classifications"]) == 1
            assert result["classifications"][0]["email_id"] == "unknown_0"

    def test_missing_email_number_in_classification(self):
        """Test handling when LLM forgets to include email_number."""
        mock_llm_client = MagicMock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 50,
                    "value": "Male",
                    "confidence": 0.9,
                    "reasoning": "Test reasoning"
                    # Missing email_number!
                }
            ]
        }

        emails = [{
            "id": "test_email",
            "subject": "Test",
            "sender": "test@example.com",
            "body": "Test body"
        }]

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.9,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_demographics_with_agent(emails, mock_llm_client, max_iterations=1)

            # Verify fallback to "unknown"
            assert len(result["classifications"]) == 1
            assert result["classifications"][0]["email_id"] == "unknown"

    def test_large_batch_provenance(self):
        """Test provenance tracking with 20 emails (max batch size)."""
        mock_llm_client = MagicMock()

        # Create 20 classifications
        classifications = []
        for i in range(1, 21):
            classifications.append({
                "taxonomy_id": 50,
                "value": "Male",
                "confidence": 0.9,
                "reasoning": f"Classification {i}",
                "email_number": i
            })

        mock_llm_client.analyze_email.return_value = {
            "classifications": classifications
        }

        # Create 25 emails (should only process first 20)
        large_batch = []
        for i in range(1, 26):
            large_batch.append({
                "id": f"email_{i:03d}",
                "subject": f"Email {i}",
                "sender": f"sender{i}@example.com",
                "body": f"Body of email {i}"
            })

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.9,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_demographics_with_agent(large_batch, mock_llm_client, max_iterations=1)

            # Verify all 20 classifications have correct provenance
            assert len(result["classifications"]) == 20

            for i, classification in enumerate(result["classifications"]):
                expected_email_id = f"email_{i+1:03d}"
                expected_email_number = i + 1

                assert classification["email_id"] == expected_email_id
                assert classification["email_number"] == expected_email_number


class TestIterationMetrics:
    """Test agent iteration and tool call metrics."""

    def test_iterations_tracked(self):
        """Test that iteration count is tracked correctly."""
        mock_llm_client = MagicMock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 50,
                    "value": "Male",
                    "confidence": 0.9,
                    "reasoning": "Test",
                    "email_number": 1
                }
            ]
        }

        emails = [{"id": "test", "subject": "Test", "sender": "test@example.com", "body": "Test"}]

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.9,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_demographics_with_agent(emails, mock_llm_client, max_iterations=3)

            # Should converge in 1 iteration since validation passes
            assert result["iterations"] == 1
            assert result["tool_calls"] == 1  # One validate_classification call

    def test_tool_calls_tracked(self):
        """Test that tool call count is tracked correctly."""
        mock_llm_client = MagicMock()
        mock_llm_client.analyze_email.return_value = {
            "classifications": [
                {
                    "taxonomy_id": 50,
                    "value": "Male",
                    "confidence": 0.9,
                    "reasoning": "Test 1",
                    "email_number": 1
                },
                {
                    "taxonomy_id": 49,
                    "value": "Female",
                    "confidence": 0.85,
                    "reasoning": "Test 2",
                    "email_number": 2
                }
            ]
        }

        emails = [
            {"id": "test1", "subject": "Test", "sender": "test@example.com", "body": "Test"},
            {"id": "test2", "subject": "Test", "sender": "test@example.com", "body": "Test"}
        ]

        with patch('src.email_parser.agents.tools.validate_classification') as mock_validate, \
             patch('src.email_parser.workflow.taxonomy_context.get_cached_taxonomy_context') as mock_context, \
             patch('src.email_parser.workflow.nodes.evidence_judge.evaluate_evidence_quality') as mock_eval:

            # Setup mocks - validate_classification is the tool, not a factory
            mock_validate.invoke.return_value = '{"valid": true}'
            mock_context.return_value = "Sample taxonomy context"
            mock_eval.return_value = {
                "quality_score": 0.9,
                "is_appropriate": True,
                "confidence_adjustment": 0.0
            }

            result = extract_demographics_with_agent(emails, mock_llm_client, max_iterations=3)

            # Should have 2 validate_classification calls (one per classification)
            assert result["tool_calls"] == 2
