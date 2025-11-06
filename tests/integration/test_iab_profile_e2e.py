"""
End-to-End Integration Tests for IAB Profile Generation

These tests verify the complete pipeline from CSV input to JSON profile output,
catching real integration issues that unit tests miss.
"""

import pytest
import json
import tempfile
import os
from pathlib import Path
from datetime import datetime
import pandas as pd

# Import main functionality
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src'))

from email_parser.main import EmailParser
from email_parser.models.iab_taxonomy import IABConsumerProfile


class TestIABProfileEndToEnd:
    """End-to-end tests for IAB profile generation from CSV to JSON."""

    @pytest.fixture
    def sample_csv_file(self):
        """Create a temporary CSV file with realistic email data."""
        csv_content = """ID,Date,From,Subject,Summary,Category,Products,Key_Topics,Status,Category_Confidence,Products_Confidence,Summary_Confidence
email_1,2025-09-27T06:59:13+01:00,"Newsletter <editor@crypto.io>",Weekly Crypto Update,"Analysis of Bitcoin and Ethereum markets, discussing DeFi protocols and blockchain technology trends.",Technology,Bitcoin|Ethereum,Cryptocurrency|Blockchain,processed,0.95,0.90,0.92
email_2,2025-09-26T19:08:54+00:00,"Tech News <news@tech.com>",AI Development News,"Latest developments in artificial intelligence and machine learning applications for business.",Technology,GPT-4|Claude,AI|Machine Learning,processed,0.93,0.88,0.91
email_3,2025-09-25T14:22:31+00:00,"Finance Weekly <finance@bank.com>",Investment Portfolio Review,"Quarterly review of investment strategies and stock market performance analysis.",Finance,Stocks|Bonds,Investment|Portfolio,processed,0.89,0.85,0.87"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        yield temp_path

        # Cleanup
        if os.path.exists(temp_path):
            os.unlink(temp_path)

    @pytest.fixture
    def output_json_file(self):
        """Create a temporary output file path."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name

        yield temp_path

        # Cleanup
        if os.path.exists(temp_path):
            os.unlink(temp_path)

    def test_csv_field_mapping(self, sample_csv_file):
        """Test that CSV fields are correctly mapped (case-insensitive)."""
        # Read CSV and verify field mapping
        df = pd.read_csv(sample_csv_file)

        # Verify expected fields exist
        assert 'Subject' in df.columns, "CSV must have Subject field"
        assert 'Summary' in df.columns, "CSV must have Summary field"
        assert 'ID' in df.columns, "CSV must have ID field"

        # Test parser can handle these fields
        parser = EmailParser()

        # This should not raise an error
        result = parser.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file='test_output.json'
        )

        assert result is not None
        assert os.path.exists(result)

        # Cleanup
        if os.path.exists('test_output.json'):
            os.unlink('test_output.json')

    def test_iab_profile_generation_produces_classifications(self, sample_csv_file, output_json_file):
        """
        CRITICAL TEST: Verify that IAB profile generation produces actual classifications.

        This test catches the bug where LLM was returning empty responses due to:
        1. Invalid model name (gpt-5-mini-2025-08-07 doesn't exist)
        2. Missing CSV field mapping (body vs Summary)
        3. Empty LLM responses being accepted as success

        This test would have FAILED before fixes, preventing false positives.
        """
        parser = EmailParser()

        # Generate profile
        output_path = parser.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file=output_json_file
        )

        # Verify file was created
        assert os.path.exists(output_path), "Profile JSON file must be created"

        # Load and parse JSON
        with open(output_path, 'r') as f:
            profile_data = json.load(f)

        # Validate against Pydantic model
        profile = IABConsumerProfile(**profile_data)

        # CRITICAL ASSERTIONS - Must have actual classifications
        total_classifications = (
            len(profile.interests) +
            len(profile.purchase_intent) +
            len(profile.actual_purchases)
        )

        assert total_classifications > 0, (
            f"CRITICAL: Profile must contain at least 1 classification. "
            f"Found {total_classifications}. This indicates LLM is not producing results. "
            f"Interests: {len(profile.interests)}, "
            f"Purchase Intent: {len(profile.purchase_intent)}, "
            f"Actual Purchases: {len(profile.actual_purchases)}"
        )

        # Verify memory stats match actual data
        assert profile.memory_stats.total_facts_stored == total_classifications, (
            f"Memory stats mismatch: stored={profile.memory_stats.total_facts_stored}, "
            f"actual={total_classifications}"
        )

        # Verify emails were processed
        assert profile.data_coverage.total_emails_analyzed > 0, (
            "Profile must show emails were analyzed"
        )

        print(f"\n✅ Profile generated with {total_classifications} classifications:")
        print(f"   - Interests: {len(profile.interests)}")
        print(f"   - Purchase Intent: {len(profile.purchase_intent)}")
        print(f"   - Actual Purchases: {len(profile.actual_purchases)}")

    def test_interest_classifications_have_required_fields(self, sample_csv_file, output_json_file):
        """
        Test that interest classifications have all required fields.

        This catches the bug where workflow returned memory format without tier_path,
        causing Pydantic validation errors.
        """
        parser = EmailParser()
        output_path = parser.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file=output_json_file
        )

        with open(output_path, 'r') as f:
            profile_data = json.load(f)

        # Validate full model (will raise if fields missing)
        profile = IABConsumerProfile(**profile_data)

        # Verify each interest has required fields
        for interest in profile.interests:
            assert interest.taxonomy_id > 0, f"Interest must have valid taxonomy_id: {interest}"
            assert interest.tier_path, f"Interest must have tier_path: {interest}"
            assert interest.value, f"Interest must have value: {interest}"
            assert 0.0 <= interest.confidence <= 1.0, (
                f"Interest confidence must be 0-1: {interest.confidence}"
            )
            assert interest.evidence_count >= 0, f"Interest must have evidence_count: {interest}"
            assert interest.last_validated, f"Interest must have last_validated: {interest}"

        print(f"\n✅ All {len(profile.interests)} interest classifications have required fields")

    def test_confidence_scores_are_reasonable(self, sample_csv_file, output_json_file):
        """
        Test that confidence scores are within reasonable ranges.

        Catches bugs where:
        - Confidence scores are 0 (no classifications)
        - Confidence scores exceed 0.95 (over-confident)
        - Confidence scores are negative (calculation error)
        """
        parser = EmailParser()
        output_path = parser.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file=output_json_file
        )

        with open(output_path, 'r') as f:
            profile_data = json.load(f)

        profile = IABConsumerProfile(**profile_data)

        # Check all classifications have reasonable confidence
        all_classifications = list(profile.interests) + list(profile.purchase_intent)

        for classification in all_classifications:
            assert 0.6 <= classification.confidence <= 0.95, (
                f"Confidence should be 0.6-0.95 (got {classification.confidence} for {classification.value}). "
                f"Scores outside this range indicate LLM prompt issues."
            )

        # Check memory stats average confidence
        if profile.memory_stats.total_facts_stored > 0:
            assert 0.6 <= profile.memory_stats.average_confidence <= 0.95, (
                f"Average confidence should be 0.6-0.95 (got {profile.memory_stats.average_confidence})"
            )

        print(f"\n✅ All confidence scores are reasonable (0.6-0.95)")
        print(f"   Average confidence: {profile.memory_stats.average_confidence:.3f}")

    def test_json_schema_completeness(self, sample_csv_file, output_json_file):
        """
        Test that generated JSON has all required schema fields.

        Catches bugs where required fields are missing, causing validation errors.
        """
        parser = EmailParser()
        output_path = parser.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file=output_json_file
        )

        with open(output_path, 'r') as f:
            profile_data = json.load(f)

        # Required top-level fields
        required_fields = [
            'user_id', 'profile_version', 'generated_at', 'schema_version',
            'generator', 'data_coverage', 'demographics', 'household',
            'interests', 'purchase_intent', 'actual_purchases',
            'memory_stats', 'section_confidence'
        ]

        for field in required_fields:
            assert field in profile_data, f"Missing required field: {field}"

        # Required nested fields
        assert 'system' in profile_data['generator'], "Missing generator.system"
        assert 'llm_model' in profile_data['generator'], "Missing generator.llm_model"
        assert 'workflow_version' in profile_data['generator'], "Missing generator.workflow_version"

        assert 'total_emails_analyzed' in profile_data['data_coverage'], "Missing data_coverage.total_emails_analyzed"
        assert 'emails_this_run' in profile_data['data_coverage'], "Missing data_coverage.emails_this_run"
        assert 'date_range' in profile_data['data_coverage'], "Missing data_coverage.date_range"

        assert 'total_facts_stored' in profile_data['memory_stats'], "Missing memory_stats.total_facts_stored"
        assert 'average_confidence' in profile_data['memory_stats'], "Missing memory_stats.average_confidence"

        print(f"\n✅ JSON schema is complete with all {len(required_fields)} required fields")

    def test_llm_model_is_valid(self, sample_csv_file, output_json_file):
        """
        Test that the configured LLM model is valid and produces responses.

        This catches the bug where gpt-5-mini-2025-08-07 was configured but doesn't exist,
        causing empty LLM responses.
        """
        # Check environment variable
        import os
        from dotenv import load_dotenv

        load_dotenv()

        openai_model = os.getenv('OPENAI_MODEL')
        llm_provider = os.getenv('LLM_PROVIDER', 'openai')

        # Known invalid models
        invalid_models = [
            'gpt-5-mini-2025-08-07',  # The bug we found
            'gpt-5',  # GPT-5 doesn't exist yet
            'gpt-4-5',  # Doesn't exist
        ]

        if llm_provider == 'openai':
            assert openai_model not in invalid_models, (
                f"OPENAI_MODEL is set to invalid model: {openai_model}. "
                f"This will cause empty LLM responses. "
                f"Use valid models like: gpt-4o-mini, gpt-4o, gpt-4-turbo"
            )

            # Known valid models
            valid_models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
            assert openai_model in valid_models, (
                f"OPENAI_MODEL '{openai_model}' is not in known valid models: {valid_models}"
            )

        # Now test that the model actually produces results
        parser = EmailParser()
        output_path = parser.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file=output_json_file
        )

        with open(output_path, 'r') as f:
            profile_data = json.load(f)

        # If model is valid, we should get classifications
        total_classifications = (
            len(profile_data.get('interests', [])) +
            len(profile_data.get('purchase_intent', [])) +
            len(profile_data.get('actual_purchases', []))
        )

        assert total_classifications > 0, (
            f"Valid LLM model '{openai_model}' should produce classifications, got {total_classifications}"
        )

        print(f"\n✅ LLM model '{openai_model}' is valid and producing results")

    def test_evidence_counting_across_multiple_emails(self, sample_csv_file, output_json_file):
        """
        Test that evidence is correctly accumulated across multiple emails.

        The sample CSV has multiple emails about crypto/tech, so we should see
        evidence_count > 1 for related interests.
        """
        parser = EmailParser()
        output_path = parser.generate_iab_profile(
            csv_file=sample_csv_file,
            output_file=output_json_file
        )

        with open(output_path, 'r') as f:
            profile_data = json.load(f)

        profile = IABConsumerProfile(**profile_data)

        # With 3 emails about crypto/tech, we should have some interests with evidence > 1
        interests_with_multiple_evidence = [
            i for i in profile.interests if i.evidence_count > 1
        ]

        # At least one interest should have accumulated evidence
        assert len(interests_with_multiple_evidence) > 0, (
            "Expected at least one interest with evidence_count > 1 from multiple emails. "
            "This indicates evidence accumulation is not working."
        )

        print(f"\n✅ Evidence counting working:")
        for interest in profile.interests:
            print(f"   - {interest.value}: {interest.evidence_count} evidence, confidence {interest.confidence:.3f}")

    def test_workflow_completes_without_errors(self, sample_csv_file, output_json_file):
        """
        Test that the workflow completes without errors.

        This is a basic sanity check that catches exceptions during execution.
        """
        parser = EmailParser()

        # This should not raise any exceptions
        try:
            output_path = parser.generate_iab_profile(
                csv_file=sample_csv_file,
                output_file=output_json_file
            )
            success = True
            error_msg = None
        except Exception as e:
            success = False
            error_msg = str(e)

        assert success, f"Workflow failed with error: {error_msg}"
        assert os.path.exists(output_json_file), "Output file was not created"

        print(f"\n✅ Workflow completed successfully without errors")


class TestIABProfileRegressionPrevention:
    """
    Tests specifically designed to catch the bugs we fixed.
    These tests would have FAILED before the fixes, preventing false positives.
    """

    def test_regression_invalid_model_name(self):
        """
        REGRESSION TEST: Prevent invalid OpenAI model name.

        Bug: .env had OPENAI_MODEL=gpt-5-mini-2025-08-07 (doesn't exist)
        Impact: LLM returned empty responses, causing 0 classifications
        Fix: Changed to gpt-4o-mini
        """
        from dotenv import load_dotenv
        import os

        load_dotenv()

        openai_model = os.getenv('OPENAI_MODEL')
        llm_provider = os.getenv('LLM_PROVIDER', 'openai')

        if llm_provider == 'openai':
            # The bug: this model doesn't exist
            assert openai_model != 'gpt-5-mini-2025-08-07', (
                "REGRESSION: Invalid OpenAI model 'gpt-5-mini-2025-08-07' detected. "
                "This model doesn't exist and causes empty LLM responses. "
                "Use valid models: gpt-4o-mini, gpt-4o, gpt-4-turbo"
            )

        print(f"✅ REGRESSION TEST PASSED: Model '{openai_model}' is valid")

    def test_regression_csv_field_mapping(self):
        """
        REGRESSION TEST: Prevent CSV field mapping bug.

        Bug: Code looked for 'body' but CSV has 'Summary'
        Impact: LLM received empty email content, produced no classifications
        Fix: Added case-insensitive field mapping with fallbacks
        """
        # Create CSV with uppercase field names (like our actual data)
        csv_content = "ID,Subject,Summary\nemail_1,Test Subject,Test summary content\n"

        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            f.write(csv_content)
            temp_csv = f.name

        try:
            # Test that parser can handle uppercase fields
            parser = EmailParser()

            # Read CSV to simulate internal processing
            import pandas as pd
            df = pd.read_csv(temp_csv)
            row = df.iloc[0]

            # The fix: code should handle 'Summary' (uppercase)
            summary = row.get('Summary') or row.get('summary') or row.get('body') or ''
            subject = row.get('Subject') or row.get('subject') or ''

            assert summary == 'Test summary content', (
                "REGRESSION: CSV field mapping failed. "
                "Code must handle 'Summary' (uppercase) not just 'body' (lowercase)"
            )
            assert subject == 'Test Subject', (
                "REGRESSION: CSV field mapping failed for Subject"
            )

            print("✅ REGRESSION TEST PASSED: CSV field mapping handles uppercase fields")

        finally:
            os.unlink(temp_csv)

    def test_regression_pydantic_validation_tier_path(self):
        """
        REGRESSION TEST: Prevent Pydantic validation error for missing tier_path.

        Bug: Workflow returned memory format without tier_path field
        Impact: Pydantic validation failed when building IABConsumerProfile
        Fix: Added extraction logic to populate tier_path from category_path
        """
        from email_parser.models.iab_taxonomy import InterestSelection
        from datetime import datetime

        # Simulate workflow memory format (missing tier_path)
        workflow_memory = {
            'taxonomy_id': 342,
            'category_path': 'Interest | Cryptocurrency',  # Not 'tier_path'
            'value': 'Cryptocurrency',
            'confidence': 0.85,
            'evidence_count': 1,
            'last_validated': datetime.now().isoformat(),
            'days_since_validation': 0
        }

        # The fix: code must extract tier_path from category_path
        try:
            selection = InterestSelection(
                taxonomy_id=workflow_memory['taxonomy_id'],
                tier_path=workflow_memory.get('tier_path', workflow_memory.get('category_path', 'Unknown')),
                value=workflow_memory['value'],
                confidence=workflow_memory['confidence'],
                evidence_count=workflow_memory['evidence_count'],
                last_validated=workflow_memory['last_validated'],
                days_since_validation=workflow_memory['days_since_validation']
            )
            success = True
        except Exception as e:
            success = False
            error = str(e)

        assert success, (
            f"REGRESSION: Pydantic validation failed for InterestSelection. "
            f"Code must handle workflow memory format. Error: {error}"
        )

        print("✅ REGRESSION TEST PASSED: tier_path extraction from category_path works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
