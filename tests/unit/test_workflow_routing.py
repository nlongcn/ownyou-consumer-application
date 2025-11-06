#!/usr/bin/env python3
"""
Unit Tests for Workflow Routing

Tests conditional routing logic for analyzer selection.
"""

import pytest
from src.email_parser.workflow.state import create_initial_state
from src.email_parser.workflow.routing import (
    route_email_to_analyzers,
    should_continue_processing,
    _is_purchase_email,
    _is_household_email,
    _is_interests_email,
    _is_demographics_email,
)


class TestEmailClassification:
    """Test individual email classification helpers."""

    def test_is_purchase_email_order_confirmation(self):
        """Detect order confirmation emails."""
        content = "Your order #12345 has been confirmed. Total paid: $99.99"
        assert _is_purchase_email(content) is True

    def test_is_purchase_email_shipping(self):
        """Detect shipping notification emails."""
        content = "Your package has shipped! Tracking number: 1Z999AA"
        assert _is_purchase_email(content) is True

    def test_is_purchase_email_receipt(self):
        """Detect receipt emails."""
        content = "Receipt for your purchase. Amount charged: $50.00"
        assert _is_purchase_email(content) is True

    def test_is_purchase_email_negative(self):
        """Non-purchase emails not detected."""
        content = "Here's our weekly newsletter with tech news"
        assert _is_purchase_email(content) is False

    def test_is_household_email_utility_bill(self):
        """Detect utility bill emails."""
        content = "Your electric bill is ready. Amount due: $120"
        assert _is_household_email(content) is True

    def test_is_household_email_internet_service(self):
        """Detect internet service emails."""
        content = "Your internet service plan has been updated"
        assert _is_household_email(content) is True

    def test_is_household_email_property(self):
        """Detect property-related emails."""
        content = "Mortgage statement for your property at 123 Main St"
        assert _is_household_email(content) is True

    def test_is_household_email_negative(self):
        """Non-household emails not detected."""
        content = "Check out these great crypto investment opportunities"
        assert _is_household_email(content) is False

    def test_is_interests_email_newsletter(self):
        """Detect newsletter emails."""
        content = "Your weekly tech newsletter: AI, cryptocurrency, and more"
        assert _is_interests_email(content) is True

    def test_is_interests_email_crypto(self):
        """Detect crypto interest emails."""
        content = "Bitcoin price hits new high! Ethereum updates"
        assert _is_interests_email(content) is True

    def test_is_interests_email_technology(self):
        """Detect technology interest emails."""
        content = "New software development tools and programming tips"
        assert _is_interests_email(content) is True

    def test_is_interests_email_negative(self):
        """Non-interest emails not detected."""
        content = "Your order #123 has been shipped"
        assert _is_interests_email(content) is False

    def test_is_demographics_email_birthday(self):
        """Detect demographic signals from birthday mentions."""
        content = "Happy birthday! Hope you enjoy your special day"
        assert _is_demographics_email(content) is True

    def test_is_demographics_email_family(self):
        """Detect demographic signals from family mentions."""
        content = "Family gathering this weekend with the kids"
        assert _is_demographics_email(content) is True

    def test_is_demographics_email_education(self):
        """Detect demographic signals from education mentions."""
        content = "Congratulations on your college graduation!"
        assert _is_demographics_email(content) is True

    def test_is_demographics_email_negative(self):
        """Non-demographic emails not detected."""
        content = "Your internet bill is due"
        assert _is_demographics_email(content) is False


class TestRouteEmailToAnalyzers:
    """Test email routing logic."""

    def test_route_purchase_email(self):
        """Route purchase email to purchase analyzer."""
        emails = [{
            "id": "email_1",
            "subject": "Order Confirmation #12345",
            "body": "Your order has been confirmed"
        }]
        state = create_initial_state("user_123", emails)

        analyzers = route_email_to_analyzers(state)

        assert "purchase" in analyzers

    def test_route_household_email(self):
        """Route household email to household analyzer."""
        emails = [{
            "id": "email_1",
            "subject": "Your Electric Bill is Ready",
            "body": "Your monthly electric bill"
        }]
        state = create_initial_state("user_123", emails)

        analyzers = route_email_to_analyzers(state)

        assert "household" in analyzers

    def test_route_interests_email(self):
        """Route interests email to interests analyzer."""
        emails = [{
            "id": "email_1",
            "subject": "Tech Newsletter - Cryptocurrency Updates",
            "body": "Weekly digest of crypto news"
        }]
        state = create_initial_state("user_123", emails)

        analyzers = route_email_to_analyzers(state)

        assert "interests" in analyzers

    def test_route_demographics_email(self):
        """Route demographics email to demographics analyzer."""
        emails = [{
            "id": "email_1",
            "subject": "Family Reunion",
            "body": "Let's celebrate graduation with the kids"
        }]
        state = create_initial_state("user_123", emails)

        analyzers = route_email_to_analyzers(state)

        assert "demographics" in analyzers

    def test_route_multi_signal_email(self):
        """Route multi-signal email detects at least one analyzer."""
        emails = [{
            "id": "email_1",
            "subject": "Newsletter: Crypto Startup Raises Funding",
            "body": "Young entrepreneur's cryptocurrency startup"
        }]
        state = create_initial_state("user_123", emails)

        analyzers = route_email_to_analyzers(state)

        # Should route to at least one analyzer (interests likely)
        assert len(analyzers) >= 1
        assert "interests" in analyzers

    def test_route_generic_email_default(self):
        """Generic email routes to default analyzers."""
        emails = [{
            "id": "email_1",
            "subject": "Hello there",
            "body": "Just saying hi"
        }]
        state = create_initial_state("user_123", emails)

        analyzers = route_email_to_analyzers(state)

        # Default: demographics + interests
        assert "demographics" in analyzers
        assert "interests" in analyzers

    def test_route_no_email_returns_empty(self):
        """No email returns empty analyzer list."""
        state = create_initial_state("user_123", [])

        analyzers = route_email_to_analyzers(state)

        assert analyzers == []


class TestShouldContinueProcessing:
    """Test workflow continuation logic."""

    def test_should_continue_with_more_emails(self):
        """Should continue when more emails remain."""
        emails = [
            {"id": "email_1"},
            {"id": "email_2"},
            {"id": "email_3"}
        ]
        state = create_initial_state("user_123", emails)
        state["current_email_index"] = 0

        result = should_continue_processing(state)

        assert result == "continue"

    def test_should_continue_at_last_email(self):
        """Should continue at last email."""
        emails = [
            {"id": "email_1"},
            {"id": "email_2"}
        ]
        state = create_initial_state("user_123", emails)
        state["current_email_index"] = 1  # At last

        result = should_continue_processing(state)

        assert result == "continue"

    def test_should_end_after_last_email(self):
        """Should end after processing all emails."""
        emails = [
            {"id": "email_1"},
            {"id": "email_2"}
        ]
        state = create_initial_state("user_123", emails)
        state["current_email_index"] = 2  # Past last

        result = should_continue_processing(state)

        assert result == "end"

    def test_should_end_with_no_emails(self):
        """Should end with no emails."""
        state = create_initial_state("user_123", [])

        result = should_continue_processing(state)

        assert result == "end"