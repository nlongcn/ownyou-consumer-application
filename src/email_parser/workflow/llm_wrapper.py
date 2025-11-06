"""
LLM Wrapper for Analyzer Nodes

Provides unified interface for calling LLM clients in workflow.
Handles retries, error handling, and response parsing.
"""

import logging
from typing import Dict, Any, Optional
import json
import time

from ..llm_clients.base import LLMRequest, LLMMessage, BaseLLMClient
from ..llm_clients.claude_client import ClaudeClient
from ..llm_clients.openai_client import OpenAIClient
from ..llm_clients.ollama_client import OllamaClient
from .cost_tracker import CostTracker

logger = logging.getLogger(__name__)


class AnalyzerLLMClient:
    """Unified LLM client for analyzer nodes with retry logic."""

    def __init__(
        self,
        provider: str = None,
        model: Optional[str] = None,
        max_retries: int = 3,
        cost_tracker: Optional[CostTracker] = None,
        workflow_tracker: Optional[Any] = None
    ):
        """
        Initialize LLM client for analyzer use.

        Args:
            provider: "claude", "openai", or "ollama" (defaults to LLM_PROVIDER env var)
            model: Specific model name (optional, uses default from client)
            max_retries: Number of retry attempts on failure (default: 3)
            cost_tracker: Optional CostTracker instance to track API costs
            workflow_tracker: Optional WorkflowTracker instance for dashboard analytics

        Example:
            >>> client = AnalyzerLLMClient(provider="claude")
            >>> response = client.analyze_email(prompt)
        """
        import os

        # Parse model spec if it contains provider (format: "provider:model")
        if model and ':' in model:
            provider_from_model, model_name = model.split(':', 1)
            if provider is None:
                provider = provider_from_model
            model = model_name
            logger.debug(f"Parsed model spec: provider={provider}, model={model}")

        # Default to LLM_PROVIDER from environment, or "openai" as fallback
        if provider is None:
            provider = os.getenv("LLM_PROVIDER", "openai")

        self.provider = provider.lower()
        self.max_retries = max_retries
        self.cost_tracker = cost_tracker
        self.workflow_tracker = workflow_tracker

        # Initialize appropriate client
        self.client = self._create_client()

        # Use provided model or fallback to client's default model
        self.model = model or self.client.default_model

        logger.info(f"Initialized {self.provider} LLM client for analyzers (model: {self.model})")

    def _create_client(self) -> BaseLLMClient:
        """
        Create the appropriate LLM client instance.

        Returns:
            Initialized LLM client

        Raises:
            ValueError: If provider is unknown
        """
        config = {}  # Clients load config from environment

        if self.provider == "claude":
            return ClaudeClient(config)
        elif self.provider == "openai":
            return OpenAIClient(config)
        elif self.provider == "ollama":
            return OllamaClient(config)
        else:
            raise ValueError(
                f"Unknown provider: {self.provider}. "
                f"Must be 'claude', 'openai', or 'ollama'"
            )

    def analyze_email(
        self,
        prompt: str,
        max_tokens: int = None,
        temperature: float = 0.1
    ) -> Dict[str, Any]:
        """
        Analyze email using LLM with retry logic.

        Args:
            prompt: Complete prompt with email content and instructions
            max_tokens: Maximum response tokens (default: 1000)
            temperature: Sampling temperature, lower = more deterministic (default: 0.1)

        Returns:
            Parsed JSON response with classifications array

        Example:
            >>> response = client.analyze_email(prompt)
            >>> classifications = response["classifications"]
        """
        logger.info(f"analyze_email: max_tokens={max_tokens} (will be auto-adjusted by client)")

        request = LLMRequest(
            messages=[LLMMessage(role="user", content=prompt)],
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            json_mode=True  # Request JSON response
        )

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug(f"LLM call attempt {attempt}/{self.max_retries}")

                # Call LLM
                response = self.client.generate(request)

                if not response.success:
                    raise Exception(f"LLM call failed: {response.error}")

                # Parse JSON response
                result = self._parse_json_response(response.content)

                # Validate structure
                if not isinstance(result, dict):
                    raise ValueError("Response is not a JSON object")

                if "classifications" not in result:
                    logger.warning("Response missing 'classifications' key, adding empty array")
                    result = {"classifications": []}

                # Track costs if tracker provided
                if self.cost_tracker and response.usage:
                    prompt_tokens = response.usage.get("prompt_tokens", 0)
                    completion_tokens = response.usage.get("completion_tokens", 0)

                    if prompt_tokens > 0 or completion_tokens > 0:
                        cost = self.cost_tracker.track_call(
                            provider=self.provider,
                            model=self.model,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens
                        )
                        logger.debug(f"Tracked LLM cost: ${cost:.6f} USD")

                        # Also track to WorkflowTracker if available in state
                        if hasattr(self, 'workflow_tracker') and self.workflow_tracker:
                            self.workflow_tracker.record_cost(
                                provider=self.provider,
                                cost=cost,
                                model_name=self.model,
                                input_tokens=prompt_tokens,
                                output_tokens=completion_tokens
                            )

                # Log success
                logger.info(
                    f"LLM call successful",
                    extra={
                        "provider": self.provider,
                        "attempt": attempt,
                        "tokens": response.usage.get("total_tokens", 0),
                        "classifications": len(result.get("classifications", []))
                    }
                )

                return result

            except json.JSONDecodeError as e:
                logger.warning(
                    f"JSON parse error (attempt {attempt}/{self.max_retries}): {e}",
                    extra={"response_preview": response.content[:200] if 'response' in locals() else None}
                )

                if attempt < self.max_retries:
                    time.sleep(2 ** (attempt - 1))  # Exponential backoff: 1s, 2s, 4s
                    continue
                else:
                    logger.error("All retry attempts failed due to JSON parsing errors")
                    return {"classifications": []}

            except Exception as e:
                logger.error(
                    f"LLM call error (attempt {attempt}/{self.max_retries}): {e}",
                    exc_info=True
                )

                if attempt < self.max_retries:
                    time.sleep(2 ** (attempt - 1))
                    continue
                else:
                    logger.error("All retry attempts exhausted")
                    raise

        # Should not reach here, but safety fallback
        return {"classifications": []}

    def call_json(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: float = 0.1
    ) -> Dict[str, Any]:
        """
        Call LLM and parse JSON response without enforcing specific structure.

        This is useful for LLM-as-Judge and other tasks that don't return
        classifications. Unlike analyze_email(), this doesn't normalize
        the response to have a "classifications" key.

        Args:
            prompt: Complete prompt
            max_tokens: Maximum response tokens (default: None, uses model's max_completion_tokens)
            temperature: Sampling temperature (default: 0.1)

        Returns:
            Parsed JSON response as-is

        Example:
            >>> response = client.call_json(judge_prompt)
            >>> quality_score = response["quality_score"]
        """
        # If max_tokens not provided, use a high value so _adjust_tokens_for_context
        # can calculate the optimal value based on context window and input size
        if max_tokens is None:
            max_tokens = 100000  # High ceiling, will be adjusted by client
            logger.info(f"call_json: max_tokens=None, using ceiling of {max_tokens} (will be auto-adjusted by client)")
        else:
            logger.info(f"call_json: max_tokens={max_tokens} (explicitly requested)")

        request = LLMRequest(
            messages=[LLMMessage(role="user", content=prompt)],
            model=self.model,
            max_tokens=max_tokens,
            temperature=temperature,
            json_mode=True
        )

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug(f"LLM call_json attempt {attempt}/{self.max_retries}")

                # Call LLM
                response = self.client.generate(request)

                if not response.success:
                    raise Exception(f"LLM call failed: {response.error}")

                # Parse JSON response
                result = self._parse_json_response(response.content)

                # Validate structure (just check it's a dict)
                if not isinstance(result, dict):
                    raise ValueError("Response is not a JSON object")

                # Track costs if tracker provided
                if self.cost_tracker and response.usage:
                    prompt_tokens = response.usage.get("prompt_tokens", 0)
                    completion_tokens = response.usage.get("completion_tokens", 0)

                    if prompt_tokens > 0 or completion_tokens > 0:
                        cost = self.cost_tracker.track_call(
                            provider=self.provider,
                            model=self.model,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens
                        )
                        logger.debug(f"Tracked LLM cost: ${cost:.6f} USD")

                        if hasattr(self, 'workflow_tracker') and self.workflow_tracker:
                            self.workflow_tracker.record_cost(
                                provider=self.provider,
                                cost=cost,
                                model_name=self.model,
                                input_tokens=prompt_tokens,
                                output_tokens=completion_tokens
                            )

                logger.debug(f"call_json successful (keys: {list(result.keys())})")
                return result

            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error (attempt {attempt}/{self.max_retries}): {e}")

                if attempt < self.max_retries:
                    time.sleep(2 ** (attempt - 1))
                    continue
                else:
                    logger.error("All retry attempts failed due to JSON parsing errors")
                    raise

            except Exception as e:
                logger.error(f"call_json error (attempt {attempt}/{self.max_retries}): {e}", exc_info=True)

                if attempt < self.max_retries:
                    time.sleep(2 ** (attempt - 1))
                    continue
                else:
                    logger.error("All retry attempts exhausted")
                    raise

        # Should not reach here
        raise Exception("call_json: max retries exceeded")

    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """
        Parse JSON from LLM response, handling common formatting issues.

        Args:
            content: Raw LLM response content

        Returns:
            Parsed JSON object

        Raises:
            json.JSONDecodeError: If parsing fails after cleanup attempts
        """
        # Remove markdown code blocks if present
        content = content.strip()

        if content.startswith("```json"):
            content = content[7:]  # Remove ```json
        if content.startswith("```"):
            content = content[3:]  # Remove ```
        if content.endswith("```"):
            content = content[:-3]  # Remove trailing ```

        content = content.strip()

        # Parse JSON
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON from text
            # Look for first { and last }
            start = content.find('{')
            end = content.rfind('}')

            if start != -1 and end != -1:
                content = content[start:end+1]
                return json.loads(content)
            else:
                raise

    def estimate_cost(self, prompt_tokens: int, response_tokens: int) -> Optional[float]:
        """
        Estimate cost of LLM call (if applicable).

        Args:
            prompt_tokens: Number of tokens in prompt
            response_tokens: Number of tokens in response

        Returns:
            Estimated cost in USD, or None if not applicable

        Example:
            >>> cost = client.estimate_cost(1000, 500)
            >>> print(f"Estimated cost: ${cost:.4f}")
        """
        # Approximate pricing (as of 2024)
        pricing = {
            "claude": {
                "prompt": 3.0 / 1_000_000,  # $3 per 1M input tokens
                "response": 15.0 / 1_000_000  # $15 per 1M output tokens
            },
            "openai": {
                "prompt": 5.0 / 1_000_000,  # $5 per 1M tokens (GPT-4)
                "response": 15.0 / 1_000_000  # $15 per 1M tokens
            },
            "ollama": {
                "prompt": 0.0,  # Free (local)
                "response": 0.0
            }
        }

        if self.provider not in pricing:
            return None

        rates = pricing[self.provider]
        cost = (prompt_tokens * rates["prompt"]) + (response_tokens * rates["response"])

        return cost


__all__ = ['AnalyzerLLMClient']