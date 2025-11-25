"""
Manual validation test for all four ReAct agents.

Tests each agent with carefully crafted emails containing clear signals.
Validates that agents correctly classify and use reflection loops.
"""

import sys
import os
import json
import csv
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(project_root / ".env")

from src.email_parser.workflow.llm_wrapper import AnalyzerLLMClient
from src.email_parser.agents.demographics_agent import extract_demographics_with_agent
from src.email_parser.agents.household_agent import extract_household_with_agent
from src.email_parser.agents.interests_agent import extract_interests_with_agent
from src.email_parser.agents.purchase_agent import extract_purchase_with_agent


def load_test_emails(csv_path):
    """Load test emails from CSV."""
    emails = []
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            emails.append(row)
    return emails


def test_demographics_agent(emails, llm_client):
    """Test Demographics agent with relevant emails."""
    print("\n" + "="*80)
    print("TESTING DEMOGRAPHICS AGENT")
    print("="*80)

    # Test with emails 1 and 5 (have clear demographic signals)
    test_emails = [emails[0], emails[4]]

    for i, email in enumerate(test_emails, 1):
        print(f"\n--- Email {i}: {email['subject'][:50]}... ---")
        print(f"Body preview: {email['body'][:100]}...")

        result = extract_demographics_with_agent(
            emails=[email],
            llm_client=llm_client,
            max_iterations=3
        )

        print(f"\nAgent Metrics:")
        print(f"  Iterations: {result.get('iterations')}")
        print(f"  Tool Calls: {result.get('tool_calls')}")
        print(f"  Classifications: {len(result.get('classifications', []))}")

        if result.get('error'):
            print(f"  ERROR: {result['error']}")

        for classification in result.get('classifications', []):
            print(f"\n  Classification:")
            print(f"    Taxonomy ID: {classification.get('taxonomy_id')}")
            print(f"    Value: {classification.get('value')}")
            print(f"    Confidence: {classification.get('confidence')}")
            print(f"    Reasoning: {classification.get('reasoning', 'N/A')[:80]}...")

    return True


def test_household_agent(emails, llm_client):
    """Test Household agent with relevant emails."""
    print("\n" + "="*80)
    print("TESTING HOUSEHOLD AGENT")
    print("="*80)

    # Test with emails 2, 5, 10 (have clear household signals)
    test_emails = [emails[1], emails[4], emails[9]]

    for i, email in enumerate(test_emails, 1):
        print(f"\n--- Email {i}: {email['subject'][:50]}... ---")
        print(f"Body preview: {email['body'][:100]}...")

        result = extract_household_with_agent(
            emails=[email],
            llm_client=llm_client,
            max_iterations=3
        )

        print(f"\nAgent Metrics:")
        print(f"  Iterations: {result.get('iterations')}")
        print(f"  Tool Calls: {result.get('tool_calls')}")
        print(f"  Classifications: {len(result.get('classifications', []))}")

        if result.get('error'):
            print(f"  ERROR: {result['error']}")

        for classification in result.get('classifications', []):
            print(f"\n  Classification:")
            print(f"    Taxonomy ID: {classification.get('taxonomy_id')}")
            print(f"    Value: {classification.get('value')}")
            print(f"    Confidence: {classification.get('confidence')}")
            print(f"    Reasoning: {classification.get('reasoning', 'N/A')[:80]}...")

    return True


def test_interests_agent(emails, llm_client):
    """Test Interests agent with relevant emails."""
    print("\n" + "="*80)
    print("TESTING INTERESTS AGENT")
    print("="*80)

    # Test with emails 3, 6, 7, 9 (have clear interest signals)
    test_emails = [emails[2], emails[5], emails[6], emails[8]]

    for i, email in enumerate(test_emails, 1):
        print(f"\n--- Email {i}: {email['subject'][:50]}... ---")
        print(f"Body preview: {email['body'][:100]}...")

        result = extract_interests_with_agent(
            emails=[email],
            llm_client=llm_client,
            max_iterations=3
        )

        print(f"\nAgent Metrics:")
        print(f"  Iterations: {result.get('iterations')}")
        print(f"  Tool Calls: {result.get('tool_calls')}")
        print(f"  Classifications: {len(result.get('classifications', []))}")

        if result.get('error'):
            print(f"  ERROR: {result['error']}")

        for classification in result.get('classifications', []):
            print(f"\n  Classification:")
            print(f"    Taxonomy ID: {classification.get('taxonomy_id')}")
            print(f"    Value: {classification.get('value')}")
            print(f"    Confidence: {classification.get('confidence')}")
            print(f"    Reasoning: {classification.get('reasoning', 'N/A')[:80]}...")

    return True


def test_purchase_agent(emails, llm_client):
    """Test Purchase agent with relevant emails."""
    print("\n" + "="*80)
    print("TESTING PURCHASE AGENT")
    print("="*80)

    # Test with emails 4 and 8 (have clear purchase signals)
    test_emails = [emails[3], emails[7]]

    for i, email in enumerate(test_emails, 1):
        print(f"\n--- Email {i}: {email['subject'][:50]}... ---")
        print(f"Body preview: {email['body'][:100]}...")

        result = extract_purchase_with_agent(
            emails=[email],
            llm_client=llm_client,
            max_iterations=3
        )

        print(f"\nAgent Metrics:")
        print(f"  Iterations: {result.get('iterations')}")
        print(f"  Tool Calls: {result.get('tool_calls')}")
        print(f"  Classifications: {len(result.get('classifications', []))}")

        if result.get('error'):
            print(f"  ERROR: {result['error']}")

        for classification in result.get('classifications', []):
            print(f"\n  Classification:")
            print(f"    Taxonomy ID: {classification.get('taxonomy_id')}")
            print(f"    Value: {classification.get('value')}")
            print(f"    Confidence: {classification.get('confidence')}")
            print(f"    Purchase Intent Flag: {classification.get('purchase_intent_flag', 'N/A')}")
            print(f"    Reasoning: {classification.get('reasoning', 'N/A')[:80]}...")

    return True


def main():
    """Run all agent validation tests."""
    print("\n" + "="*80)
    print("AGENT VALIDATION TEST SUITE")
    print("="*80)
    print("\nThis test validates all four ReAct agents with sample emails.")
    print("Each agent should:")
    print("  1. Extract correct classifications from emails")
    print("  2. Use taxonomy search tools")
    print("  3. Validate classifications")
    print("  4. Use reflection loops when needed")

    # Load test emails
    csv_path = project_root / "test_agent_validation.csv"
    if not csv_path.exists():
        print(f"\nERROR: Test CSV not found at {csv_path}")
        return False

    emails = load_test_emails(csv_path)
    print(f"\nLoaded {len(emails)} test emails from CSV")

    # Initialize LLM client
    print("\nInitializing LLM client...")
    print("Using LLM_PROVIDER from environment (claude, openai, or ollama)")

    llm_client = AnalyzerLLMClient(
        provider=None,  # Uses LLM_PROVIDER env var
        model=None,     # Uses default model for provider
        max_retries=2
    )

    print(f"LLM Client: {llm_client.provider} ({llm_client.model})")

    # Run tests for each agent
    try:
        test_demographics_agent(emails, llm_client)
        test_household_agent(emails, llm_client)
        test_interests_agent(emails, llm_client)
        test_purchase_agent(emails, llm_client)

        print("\n" + "="*80)
        print("ALL AGENT TESTS COMPLETED")
        print("="*80)
        print("\nReview the output above to verify:")
        print("  ✓ Each agent made classifications")
        print("  ✓ Taxonomy IDs are valid (1-1568)")
        print("  ✓ Values match IAB taxonomy entries")
        print("  ✓ Reflection loops used when needed (iterations > 1)")
        print("  ✓ Tool calls logged properly")

        return True

    except Exception as e:
        print(f"\n\nERROR during testing: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
