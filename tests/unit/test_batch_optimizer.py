#!/usr/bin/env python3
"""
Unit Tests for Batch Optimizer

Tests the batch size calculation and email batching logic.
"""

import pytest
from src.email_parser.workflow.batch_optimizer import (
    estimate_email_tokens,
    calculate_batch_size,
    get_batch_from_state,
    has_more_batches,
    advance_to_next_batch
)


def test_estimate_email_tokens():
    """Test token estimation for single email."""
    email = {
        "subject": "Test Subject",
        "sender": "test@example.com",
        "body": "This is a test email body with some content."
    }

    tokens = estimate_email_tokens(email)

    # Should be roughly (subject + sender + body + overhead) / 4
    # ~80 chars / 4 = ~20 tokens
    assert tokens > 0
    assert tokens < 100  # Sanity check


def test_estimate_email_tokens_large():
    """Test token estimation for large email."""
    email = {
        "subject": "Test",
        "sender": "test@example.com",
        "body": "x" * 4000  # 4000 character body
    }

    tokens = estimate_email_tokens(email)

    # Should be roughly 4000 / 4 = 1000 tokens
    assert tokens > 900
    assert tokens < 1100


def test_calculate_batch_size_fits_many():
    """Test batch size when many emails fit in context."""
    # Create 100 small emails
    emails = [
        {
            "subject": f"Email {i}",
            "sender": "test@example.com",
            "body": "Short email body"
        }
        for i in range(100)
    ]

    # With 128K context window, should fit 20-50 small emails
    batch_size = calculate_batch_size(
        emails=emails,
        context_window=128000,
        start_index=0
    )

    assert batch_size >= 5  # At least minimum
    assert batch_size <= 50  # At most maximum
    assert batch_size < len(emails)  # Not all emails


def test_calculate_batch_size_respects_max():
    """Test batch size respects maximum."""
    # Create 100 tiny emails
    emails = [
        {
            "subject": f"E{i}",
            "sender": "t@x.com",
            "body": "x"
        }
        for i in range(100)
    ]

    # Even with huge context, should max out at 50
    batch_size = calculate_batch_size(
        emails=emails,
        context_window=1000000,  # 1M tokens
        start_index=0,
        max_batch_size=50
    )

    assert batch_size == 50


def test_calculate_batch_size_respects_min():
    """Test batch size respects minimum when possible."""
    # Create emails that would normally fit fewer than min_batch_size
    emails = [
        {
            "subject": "Test",
            "sender": "test@example.com",
            "body": "x" * 50000  # Very large emails
        }
        for i in range(20)
    ]

    # Should enforce minimum (or fewer if not enough emails)
    batch_size = calculate_batch_size(
        emails=emails,
        context_window=128000,
        start_index=0,
        min_batch_size=5
    )

    assert batch_size >= 1  # At least one email


def test_get_batch_from_state():
    """Test extracting batch from state."""
    emails = [{"id": f"email_{i}"} for i in range(20)]

    state = {
        "emails": emails,
        "current_batch_start": 0,
        "batch_size": 5
    }

    batch = get_batch_from_state(state)

    assert len(batch) == 5
    assert batch[0]["id"] == "email_0"
    assert batch[4]["id"] == "email_4"


def test_get_batch_from_state_partial():
    """Test extracting final partial batch."""
    emails = [{"id": f"email_{i}"} for i in range(12)]

    state = {
        "emails": emails,
        "current_batch_start": 10,  # Near end
        "batch_size": 5  # Want 5 but only 2 left
    }

    batch = get_batch_from_state(state)

    assert len(batch) == 2  # Only 2 emails remaining
    assert batch[0]["id"] == "email_10"
    assert batch[1]["id"] == "email_11"


def test_has_more_batches_true():
    """Test checking for more batches when some remain."""
    state = {
        "emails": [{"id": i} for i in range(20)],
        "current_batch_start": 10
    }

    assert has_more_batches(state) is True


def test_has_more_batches_false():
    """Test checking for more batches when done."""
    emails = [{"id": i} for i in range(20)]

    state = {
        "emails": emails,
        "current_batch_start": 20  # At end
    }

    assert has_more_batches(state) is False


def test_advance_to_next_batch():
    """Test advancing to next batch."""
    emails = [{"id": f"email_{i}", "body": "test" * 100} for i in range(30)]

    state = {
        "emails": emails,
        "current_batch_start": 0,
        "batch_size": 10,
        "model_context_window": 128000
    }

    # Advance from first batch to second
    new_state = advance_to_next_batch(state)

    assert new_state["current_batch_start"] == 10  # Moved forward by batch_size
    assert new_state["batch_size"] > 0  # Recalculated batch size


def test_advance_to_next_batch_final():
    """Test advancing to final partial batch."""
    emails = [{"id": f"email_{i}", "body": "test" * 100} for i in range(25)]

    state = {
        "emails": emails,
        "current_batch_start": 20,
        "batch_size": 10,
        "model_context_window": 128000
    }

    # Advance to final partial batch
    new_state = advance_to_next_batch(state)

    assert new_state["current_batch_start"] == 30  # Moved past end
    # Batch size should be recalculated (likely 0 since we're past end)


def test_batch_workflow_simulation():
    """Test complete batch processing workflow."""
    # Simulate processing 100 emails in batches
    emails = [
        {
            "id": f"email_{i}",
            "subject": f"Subject {i}",
            "sender": "test@example.com",
            "body": "x" * 500  # Medium-sized email
        }
        for i in range(100)
    ]

    state = {
        "emails": emails,
        "current_batch_start": 0,
        "batch_size": 1,
        "model_context_window": 128000
    }

    # Calculate initial batch size
    initial_batch_size = calculate_batch_size(
        emails=emails,
        context_window=state["model_context_window"],
        start_index=0
    )
    state["batch_size"] = initial_batch_size

    batches_processed = 0
    emails_processed = 0

    # Process all batches
    while has_more_batches(state):
        batch = get_batch_from_state(state)
        emails_processed += len(batch)
        batches_processed += 1

        # Advance to next batch
        state = advance_to_next_batch(state)

        # Safety limit
        if batches_processed > 50:
            break

    # Should have processed all 100 emails
    assert emails_processed == 100
    # Should have used multiple batches (not single-email processing)
    assert batches_processed > 2
    # Should have used batch optimization (not 100 batches)
    assert batches_processed < 50


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
