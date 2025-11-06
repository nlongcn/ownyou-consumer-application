"""
Cost tracking for LLM API usage.

Tracks token usage and calculates costs across different LLM providers.
"""

from dataclasses import dataclass, field
from typing import Dict, Optional
from datetime import datetime


@dataclass
class LLMCall:
    """Record of a single LLM API call."""
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat() + "Z")


@dataclass
class ProviderStats:
    """Statistics for a single LLM provider."""
    provider: str
    calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_cost_usd: float = 0.0


class CostTracker:
    """
    Track LLM API costs across multiple providers.

    Pricing as of 2025-10-01 (per 1M tokens):
    - OpenAI gpt-4o-mini: $0.15 input, $0.60 output
    - OpenAI gpt-4o: $2.50 input, $10.00 output
    - Claude Sonnet 4: $3.00 input, $15.00 output
    - Claude Sonnet 3.5: $3.00 input, $15.00 output
    - Ollama: Free (local)
    """

    PRICING = {
        "openai": {
            "gpt-4o-mini": {
                "input_per_1m": 0.15,
                "output_per_1m": 0.60
            },
            "gpt-4o": {
                "input_per_1m": 2.50,
                "output_per_1m": 10.00
            },
            "gpt-4": {
                "input_per_1m": 30.00,
                "output_per_1m": 60.00
            }
        },
        "claude": {
            "claude-sonnet-4": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00
            },
            "claude-3-5-sonnet-20241022": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00
            },
            "claude-3-5-sonnet": {
                "input_per_1m": 3.00,
                "output_per_1m": 15.00
            }
        },
        "ollama": {
            "default": {
                "input_per_1m": 0.0,
                "output_per_1m": 0.0
            }
        }
    }

    def __init__(self):
        """Initialize cost tracker."""
        self.calls: list[LLMCall] = []
        self.provider_stats: Dict[str, ProviderStats] = {}
        self.session_start = datetime.now().isoformat() + "Z"

    def track_call(
        self,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> float:
        """
        Track a single LLM API call and calculate cost.

        Args:
            provider: LLM provider name (openai, claude, ollama)
            model: Model name (gpt-4o-mini, claude-sonnet-4, etc.)
            prompt_tokens: Number of input tokens
            completion_tokens: Number of output tokens

        Returns:
            Cost in USD for this call
        """
        # Get pricing for this model
        provider_lower = provider.lower()
        model_lower = model.lower()

        # Find matching pricing
        if provider_lower in self.PRICING:
            pricing = None
            # Exact match
            if model_lower in self.PRICING[provider_lower]:
                pricing = self.PRICING[provider_lower][model_lower]
            # Fuzzy match (e.g., gpt-4o-2024-08-06 → gpt-4o)
            else:
                for known_model in self.PRICING[provider_lower]:
                    if known_model in model_lower or known_model == "default":
                        pricing = self.PRICING[provider_lower][known_model]
                        break

            if pricing:
                input_cost = (prompt_tokens / 1_000_000) * pricing["input_per_1m"]
                output_cost = (completion_tokens / 1_000_000) * pricing["output_per_1m"]
                total_cost = input_cost + output_cost
            else:
                # Unknown model - assume free
                total_cost = 0.0
        else:
            # Unknown provider - assume free
            total_cost = 0.0

        # Record call
        call = LLMCall(
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=total_cost
        )
        self.calls.append(call)

        # Update provider stats
        if provider not in self.provider_stats:
            self.provider_stats[provider] = ProviderStats(provider=provider)

        stats = self.provider_stats[provider]
        stats.calls += 1
        stats.prompt_tokens += prompt_tokens
        stats.completion_tokens += completion_tokens
        stats.total_cost_usd += total_cost

        return total_cost

    def get_total_cost(self) -> float:
        """Get total cost across all providers."""
        return sum(stats.total_cost_usd for stats in self.provider_stats.values())

    def get_total_tokens(self) -> int:
        """Get total tokens (input + output) across all providers."""
        return sum(
            stats.prompt_tokens + stats.completion_tokens
            for stats in self.provider_stats.values()
        )

    def get_summary(self, emails_processed: Optional[int] = None) -> str:
        """
        Get formatted cost summary.

        Args:
            emails_processed: Number of emails processed (for per-email cost)

        Returns:
            Formatted summary string
        """
        total_cost = self.get_total_cost()
        total_tokens = self.get_total_tokens()
        total_calls = len(self.calls)

        lines = []
        lines.append("=== LLM COST SUMMARY ===")
        lines.append(f"Total Calls: {total_calls}")
        lines.append(f"Total Tokens: {total_tokens:,}")
        lines.append(f"Total Cost: ${total_cost:.4f} USD")

        if emails_processed and emails_processed > 0:
            cost_per_email = total_cost / emails_processed
            lines.append(f"Cost per Email: ${cost_per_email:.4f} USD")

        if len(self.provider_stats) > 1:
            lines.append("")
            lines.append("=== BY PROVIDER ===")
            for provider, stats in sorted(self.provider_stats.items()):
                lines.append(f"{provider}:")
                lines.append(f"  Calls: {stats.calls}")
                lines.append(f"  Tokens: {stats.prompt_tokens + stats.completion_tokens:,}")
                lines.append(f"  Cost: ${stats.total_cost_usd:.4f} USD")

        return "\n".join(lines)

    def get_stats_dict(self) -> Dict:
        """Get statistics as dictionary (for JSON export)."""
        return {
            "session_start": self.session_start,
            "total_calls": len(self.calls),
            "total_tokens": self.get_total_tokens(),
            "total_cost_usd": self.get_total_cost(),
            "providers": {
                provider: {
                    "calls": stats.calls,
                    "prompt_tokens": stats.prompt_tokens,
                    "completion_tokens": stats.completion_tokens,
                    "total_cost_usd": stats.total_cost_usd
                }
                for provider, stats in self.provider_stats.items()
            },
            "calls": [
                {
                    "provider": call.provider,
                    "model": call.model,
                    "prompt_tokens": call.prompt_tokens,
                    "completion_tokens": call.completion_tokens,
                    "cost_usd": call.cost_usd,
                    "timestamp": call.timestamp
                }
                for call in self.calls
            ]
        }
