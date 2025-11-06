"""
Google Gemini LLM client implementation.

Provides integration with Google's Gemini models.
"""

import time
from typing import Dict, Any, List, Optional
import google.generativeai as genai
from ..llm_clients.base import BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage
from ..utils.logging import get_logger, TimedOperation, get_performance_logger


class GoogleClient(BaseLLMClient):
    """Client for Google Gemini models."""

    # Model pricing per 1M tokens (as of 2025)
    MODEL_PRICING = {
        "gemini-2.5-pro": {"input": 1.25, "output": 5.00},
        "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
        "gemini-2.5-flash-lite": {"input": 0.0375, "output": 0.15},
        "gemini-2.0-flash": {"input": 0.10, "output": 0.40},
        "gemini-2.0-flash-lite": {"input": 0.05, "output": 0.20},
        "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
        "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    }

    def __init__(self, config: Dict[str, Any]):
        """Initialize Google Gemini client.

        Args:
            config: Configuration dictionary with Google settings
        """
        import os
        super().__init__(config)

        # Get config from dict or fallback to environment variables
        self.api_key = config.get('google_api_key') or os.getenv('GOOGLE_API_KEY')
        self.default_model = config.get('google_model') or os.getenv('GOOGLE_MODEL') or ''

        # Model can be specified at call time, so default_model is optional

        max_tokens_str = config.get('google_max_tokens') or os.getenv('GOOGLE_MAX_TOKENS')
        self.max_tokens = int(max_tokens_str) if max_tokens_str else 8192

        temperature_str = config.get('google_temperature') or os.getenv('GOOGLE_TEMPERATURE')
        self.default_temperature = float(temperature_str) if temperature_str else 0.7

        self.performance_logger = get_performance_logger(f"{__name__}.GoogleClient")

        if not self.api_key:
            raise ValueError("Google API key is required")

        # Configure Google Gemini
        genai.configure(api_key=self.api_key)

        # Verify connection
        self._verify_connection()

    def get_provider(self) -> LLMProvider:
        """Get the provider type."""
        return LLMProvider.GOOGLE

    def is_available(self) -> bool:
        """Check if Google Gemini API is available."""
        try:
            # Try to list models as a health check
            models = genai.list_models()
            return len(list(models)) > 0
        except Exception as e:
            self.logger.debug(f"Google Gemini availability check failed: {e}")
            return False

    def get_supported_models(self) -> List[str]:
        """Get list of available Google Gemini models."""
        try:
            models = genai.list_models()
            # Filter to only include generative models (not embedding models)
            gemini_models = [
                model.name.replace('models/', '') for model in models
                if 'generateContent' in model.supported_generation_methods
            ]

            self.logger.debug(f"Available Gemini models: {gemini_models}")
            return gemini_models
        except Exception as e:
            self.logger.error(f"Error getting supported models: {e}")
            return list(self.MODEL_PRICING.keys())  # Fallback to known models

    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        """Estimate the cost of a request."""
        model = request.model or self.default_model

        # Get pricing for the model (default to gemini-2.0-flash if not found)
        if model not in self.MODEL_PRICING:
            # Try to match partial model names
            for known_model in self.MODEL_PRICING:
                if known_model in model:
                    model = known_model
                    break
            else:
                self.logger.warning(f"Unknown model for cost estimation: {model}")
                return None

        # Estimate tokens from messages
        input_text = "\n".join([msg.content for msg in request.messages])
        input_tokens = self._estimate_tokens(input_text)

        # Estimate output tokens (rough approximation)
        max_tokens = request.max_tokens or self.max_tokens
        output_tokens = max_tokens // 2  # Assume 50% of max tokens

        return self._estimate_cost(model, input_tokens, output_tokens)

    def _verify_connection(self):
        """Verify connection to Google Gemini API."""
        try:
            # Try to list models to verify API key
            list(genai.list_models())
            self.logger.debug("Google Gemini API connection verified")
        except Exception as e:
            raise ValueError(f"Failed to connect to Google Gemini API: {e}")

    def _convert_messages_to_gemini_format(self, messages: List[LLMMessage]) -> tuple:
        """Convert LLM messages to Gemini chat format.

        Returns:
            Tuple of (system_instruction, chat_history)
        """
        system_instruction = None
        chat_history = []

        for msg in messages:
            if msg.role == "system":
                # Gemini uses system_instruction separately
                system_instruction = msg.content
            elif msg.role == "user":
                chat_history.append({
                    "role": "user",
                    "parts": [msg.content]
                })
            elif msg.role == "assistant":
                chat_history.append({
                    "role": "model",  # Gemini uses "model" instead of "assistant"
                    "parts": [msg.content]
                })

        return system_instruction, chat_history

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for text (rough approximation)."""
        # Gemini uses roughly 4 characters per token on average
        return len(text) // 4

    def _estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost based on token usage."""
        # Get pricing for the model (default to gemini-2.0-flash if not found)
        pricing = self.MODEL_PRICING.get(model, self.MODEL_PRICING.get("gemini-2.0-flash", {"input": 0.10, "output": 0.40}))

        # Calculate cost (prices are per 1M tokens)
        input_cost = (input_tokens / 1_000_000) * pricing["input"]
        output_cost = (output_tokens / 1_000_000) * pricing["output"]

        return input_cost + output_cost

    def _adjust_tokens_for_context(self, model: str, requested_tokens: int) -> int:
        """Dynamically adjust max_tokens based on model-specific max_completion_tokens limit."""
        from ..llm_clients.model_registry import get_max_completion_tokens_google

        # Get model-specific max output tokens from registry
        max_completion = get_max_completion_tokens_google(self.client, model)

        # Cap at model's max_completion_tokens
        adjusted_tokens = min(requested_tokens, max_completion)

        if adjusted_tokens != requested_tokens:
            self.logger.debug(
                f"Adjusted max_tokens from {requested_tokens} to {adjusted_tokens} "
                f"(max_completion: {max_completion})"
            )

        return adjusted_tokens

    def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate a response using Google Gemini.

        Args:
            request: LLM request with prompt and parameters

        Returns:
            LLM response with generated text and metadata
        """
        model = request.model or self.default_model
        temperature = request.temperature if request.temperature is not None else self.default_temperature
        max_tokens = self._adjust_tokens_for_context(model, request.max_tokens or self.max_tokens)

        # Convert messages to Gemini format
        system_instruction, chat_history = self._convert_messages_to_gemini_format(request.messages)

        # Build generation config
        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }

        # Add optional parameters
        if request.top_p is not None:
            generation_config["top_p"] = request.top_p

        try:
            with TimedOperation(f"Google Gemini generate ({model})", self.performance_logger) as timer:
                # Create model with system instruction if provided
                if system_instruction:
                    gemini_model = genai.GenerativeModel(
                        model_name=model,
                        system_instruction=system_instruction,
                        generation_config=generation_config
                    )
                else:
                    gemini_model = genai.GenerativeModel(
                        model_name=model,
                        generation_config=generation_config
                    )

                # Start chat or generate response
                if len(chat_history) > 0:
                    # Use chat for multi-turn conversations
                    chat = gemini_model.start_chat(history=chat_history[:-1])  # Exclude last message
                    response = chat.send_message(chat_history[-1]["parts"][0])
                else:
                    # Single prompt generation
                    prompt = request.messages[-1].content if request.messages else ""
                    response = gemini_model.generate_content(prompt)

                # Extract text from response
                response_text = response.text if hasattr(response, 'text') else str(response)

                # Estimate token usage (Gemini doesn't always provide exact counts)
                input_text = system_instruction or ""
                for msg in chat_history:
                    input_text += msg["parts"][0]

                input_tokens = self._estimate_tokens(input_text)
                output_tokens = self._estimate_tokens(response_text)
                total_tokens = input_tokens + output_tokens

                # Calculate cost
                cost = self._estimate_cost(model, input_tokens, output_tokens)

                # Log performance
                timer.log_with_cost(total_tokens, cost)

                return LLMResponse(
                    content=response_text,
                    model=model,
                    provider=self.get_provider(),
                    usage={
                        "prompt_tokens": input_tokens,
                        "completion_tokens": output_tokens,
                        "total_tokens": total_tokens
                    },
                    finish_reason="stop",
                    cost=cost,
                    latency_ms=timer.elapsed_ms
                )

        except Exception as e:
            self.logger.error(f"Google Gemini generation error: {e}")
            raise

    def generate_structured(self, request: LLMRequest, response_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Generate structured output (JSON) using Google Gemini.

        Note: Gemini supports JSON mode natively.

        Args:
            request: LLM request with prompt
            response_schema: JSON schema for expected response

        Returns:
            Parsed JSON response
        """
        import json

        # Add JSON instruction to the last message
        if request.messages:
            last_message = request.messages[-1]
            schema_str = json.dumps(response_schema, indent=2)
            last_message.content += f"\n\nRespond with valid JSON matching this schema:\n{schema_str}"

        # Generate response
        response = self.generate(request)

        # Try to parse JSON from response
        try:
            # Extract JSON from markdown code blocks if present
            content = response.content.strip()
            if content.startswith("```json"):
                content = content.split("```json")[1].split("```")[0].strip()
            elif content.startswith("```"):
                content = content.split("```")[1].split("```")[0].strip()

            return json.loads(content)
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            self.logger.debug(f"Raw response: {response.content}")
            raise ValueError(f"Invalid JSON response from Gemini: {e}")
