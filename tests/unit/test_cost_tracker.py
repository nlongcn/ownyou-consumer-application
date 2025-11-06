#!/usr/bin/env python3
"""Unit tests for CostTracker."""

import pytest
from src.email_parser.workflow.cost_tracker import CostTracker


class TestCostTracker:
    """Test LLM cost tracking."""

    def test_openai_cost_calculation(self):
        """Test OpenAI API cost calculation."""
        tracker = CostTracker()

        # gpt-4o-mini: $0.15/1M input, $0.60/1M output
        # 10,000 input tokens = 10k/1M * $0.15 = $0.0015
        # 5,000 output tokens = 5k/1M * $0.60 = $0.0030
        # Total = $0.0045
        cost = tracker.track_call("openai", "gpt-4o-mini", 10_000, 5_000)

        assert abs(cost - 0.0045) < 0.0001
        assert tracker.get_total_cost() == cost
        assert tracker.get_total_tokens() == 15_000

    def test_claude_cost_calculation(self):
        """Test Claude API cost calculation."""
        tracker = CostTracker()

        # claude-sonnet-4: $3.00/1M input, $15.00/1M output
        # 20,000 input tokens = 20k/1M * $3.00 = $0.06
        # 10,000 output tokens = 10k/1M * $15.00 = $0.15
        # Total = $0.21
        cost = tracker.track_call("claude", "claude-sonnet-4", 20_000, 10_000)

        assert abs(cost - 0.21) < 0.001
        assert tracker.get_total_cost() == cost

    def test_ollama_free(self):
        """Test that Ollama calls are free."""
        tracker = CostTracker()

        cost = tracker.track_call("ollama", "deepseek-r1:70b", 100_000, 50_000)

        assert cost == 0.0
        assert tracker.get_total_cost() == 0.0

    def test_multiple_providers(self):
        """Test tracking across multiple providers."""
        tracker = CostTracker()

        cost1 = tracker.track_call("openai", "gpt-4o-mini", 10_000, 5_000)  # $0.0045
        cost2 = tracker.track_call("claude", "claude-sonnet-4", 20_000, 10_000)  # $0.21
        cost3 = tracker.track_call("ollama", "qwen", 50_000, 25_000)  # $0.0

        total_cost = cost1 + cost2 + cost3
        assert abs(tracker.get_total_cost() - total_cost) < 0.001
        assert tracker.get_total_tokens() == 10_000 + 5_000 + 20_000 + 10_000 + 50_000 + 25_000

    def test_provider_stats(self):
        """Test provider-specific statistics."""
        tracker = CostTracker()

        tracker.track_call("openai", "gpt-4o-mini", 10_000, 5_000)
        tracker.track_call("openai", "gpt-4o-mini", 15_000, 7_500)
        tracker.track_call("claude", "claude-sonnet-4", 20_000, 10_000)

        assert len(tracker.provider_stats) == 2
        assert tracker.provider_stats["openai"].calls == 2
        assert tracker.provider_stats["claude"].calls == 1
        assert tracker.provider_stats["openai"].prompt_tokens == 25_000
        assert tracker.provider_stats["openai"].completion_tokens == 12_500

    def test_unknown_provider(self):
        """Test that unknown providers default to free."""
        tracker = CostTracker()

        cost = tracker.track_call("unknown_provider", "unknown_model", 10_000, 5_000)

        assert cost == 0.0

    def test_fuzzy_model_matching(self):
        """Test that model names are matched fuzzily."""
        tracker = CostTracker()

        # gpt-4o-2024-08-06 should match gpt-4o pricing
        cost = tracker.track_call("openai", "gpt-4o-2024-08-06", 10_000, 5_000)

        # gpt-4o: $2.50/1M input, $10.00/1M output
        # 10k * $2.50/1M = $0.025
        # 5k * $10.00/1M = $0.05
        # Total = $0.075
        assert abs(cost - 0.075) < 0.001

    def test_summary_generation(self):
        """Test summary string generation."""
        tracker = CostTracker()

        tracker.track_call("openai", "gpt-4o-mini", 10_000, 5_000)
        tracker.track_call("claude", "claude-sonnet-4", 20_000, 10_000)

        summary = tracker.get_summary(emails_processed=10)

        assert "Total Calls: 2" in summary
        assert "Total Cost:" in summary
        assert "Cost per Email:" in summary
        assert "openai:" in summary
        assert "claude:" in summary

    def test_stats_dict_export(self):
        """Test statistics dictionary export."""
        tracker = CostTracker()

        tracker.track_call("openai", "gpt-4o-mini", 10_000, 5_000)

        stats = tracker.get_stats_dict()

        assert stats["total_calls"] == 1
        assert stats["total_tokens"] == 15_000
        assert "providers" in stats
        assert "openai" in stats["providers"]
        assert stats["providers"]["openai"]["calls"] == 1
        assert len(stats["calls"]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
