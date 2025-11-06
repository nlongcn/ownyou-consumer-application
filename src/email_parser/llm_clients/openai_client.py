"""
OpenAI LLM client implementation.

Provides integration with OpenAI's GPT models.
"""

import time
from typing import Dict, Any, List, Optional
import openai
from ..llm_clients.base import BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage
from ..utils.logging import get_logger, TimedOperation, get_performance_logger


class OpenAIClient(BaseLLMClient):
    """Client for OpenAI GPT models."""
    
    # Model pricing per 1K tokens (as of 2024-2025)
    MODEL_PRICING = {
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-4-32k": {"input": 0.06, "output": 0.12},
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},
        "gpt-3.5-turbo": {"input": 0.001, "output": 0.002},
        "gpt-3.5-turbo-16k": {"input": 0.003, "output": 0.004},
        "gpt-5-mini": {"input": 0.002, "output": 0.004},  # Estimated pricing for GPT-5 models
        "gpt-5": {"input": 0.02, "output": 0.08},
        "o1-preview": {"input": 0.015, "output": 0.06},
        "o1-mini": {"input": 0.003, "output": 0.012},
    }
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize OpenAI client.

        Args:
            config: Configuration dictionary with OpenAI settings
        """
        import os
        super().__init__(config)

        # Get config from dict or fallback to environment variables
        self.api_key = config.get('openai_api_key') or os.getenv('OPENAI_API_KEY')
        self.default_model = config.get('openai_model') or os.getenv('OPENAI_MODEL')

        if not self.default_model:
            raise ValueError("OpenAI model must be specified in OPENAI_MODEL environment variable")

        # Default to 16384 (works for most models, refined per-model in generate())
        # Will be dynamically adjusted by _adjust_tokens_for_context() based on model-specific limits
        max_tokens_str = config.get('openai_max_tokens') or os.getenv('OPENAI_MAX_TOKENS')
        self.max_tokens = int(max_tokens_str) if max_tokens_str else 16384

        temperature_str = config.get('openai_temperature') or os.getenv('OPENAI_TEMPERATURE')
        self.default_temperature = float(temperature_str) if temperature_str else 0.7

        self.performance_logger = get_performance_logger(f"{__name__}.OpenAIClient")

        if not self.api_key:
            raise ValueError("OpenAI API key is required")

        # Initialize OpenAI client
        self.client = openai.OpenAI(api_key=self.api_key)

        # Verify connection
        self._verify_connection()
    
    def get_provider(self) -> LLMProvider:
        """Get the provider type."""
        return LLMProvider.OPENAI
    
    def is_available(self) -> bool:
        """Check if OpenAI API is available."""
        try:
            # Try to list models as a health check
            models = self.client.models.list()
            return len(models.data) > 0
        except Exception as e:
            self.logger.debug(f"OpenAI availability check failed: {e}")
            return False
    
    def _verify_connection(self) -> None:
        """Verify connection to OpenAI API."""
        try:
            # Test with a minimal request
            models = self.client.models.list()
            model_names = [model.id for model in models.data]
            self.logger.info(
                "Successfully connected to OpenAI API",
                available_models_count=len(model_names),
                default_model=self.default_model
            )
        except Exception as e:
            self.logger.error(
                "Failed to connect to OpenAI API. Please check your API key.",
                error=str(e)
            )
            raise
    
    def get_supported_models(self) -> List[str]:
        """Get list of available OpenAI models."""
        try:
            models = self.client.models.list()
            # Filter to only include GPT models suitable for chat
            gpt_models = [
                model.id for model in models.data 
                if "gpt" in model.id.lower() and 
                any(x in model.id for x in ["3.5", "4"])
            ]
            
            self.logger.debug(f"Available GPT models: {gpt_models}")
            return gpt_models
        except Exception as e:
            self.logger.error(f"Error getting supported models: {e}")
            return list(self.MODEL_PRICING.keys())  # Fallback to known models
    
    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        """Estimate the cost of a request."""
        model = request.model or self.default_model
        
        if model not in self.MODEL_PRICING:
            # Try to match partial model names
            for known_model in self.MODEL_PRICING:
                if known_model in model:
                    model = known_model
                    break
            else:
                self.logger.warning(f"Unknown model for cost estimation: {model}")
                return None
        
        # Rough token estimation (1 token ≈ 4 characters)
        input_text = "\n".join([msg.content for msg in request.messages])
        if request.system_prompt:
            input_text += "\n" + request.system_prompt
        
        estimated_input_tokens = len(input_text) // 4
        estimated_output_tokens = request.max_tokens or self.max_tokens
        
        pricing = self.MODEL_PRICING[model]
        estimated_cost = (
            (estimated_input_tokens / 1000) * pricing["input"] +
            (estimated_output_tokens / 1000) * pricing["output"]
        )
        
        return estimated_cost
    
    def _format_messages_for_openai(self, messages: List[LLMMessage]) -> List[Dict[str, str]]:
        """Format messages for OpenAI API."""
        return [
            {"role": message.role, "content": message.content}
            for message in messages
        ]
    
    def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate response using OpenAI API."""
        # CRITICAL: Always use the exact model specified in the request
        if not request.model:
            raise ValueError(f"Model must be explicitly specified in LLMRequest. No fallback to default model allowed.")
        
        # Validate request
        validation_errors = self.validate_request(request)
        if validation_errors:
            error_msg = "; ".join(validation_errors)
            return self.create_error_response(error_msg, request.model)
        
        # Prepare request parameters - use EXACT model specified
        messages = self.prepare_messages(request)
        model = request.model  # NO FALLBACK - use exact model requested
        max_tokens = request.max_tokens or self.max_tokens
        temperature = request.temperature or self.default_temperature
        
        # Log the exact model being used for this request
        self.logger.info(f"🎯 Using model: {model} for OpenAI request")
        
        # Format messages for OpenAI
        openai_messages = self._format_messages_for_openai(messages)
        
        # Dynamically adjust max_tokens based on input size and model limits
        max_tokens = self._adjust_tokens_for_context(openai_messages, model, max_tokens)
        
        self.logger.debug(
            "Sending request to OpenAI",
            model=model,
            messages_count=len(openai_messages),
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        start_time = time.time()
        
        with TimedOperation(self.performance_logger, "openai_generate", {"model": model}):
            try:
                kwargs = dict(
                    model=model,
                    messages=openai_messages,
                )
                
                # Handle parameter differences between model versions
                if "gpt-5" in model.lower() or "o1" in model.lower():
                    # Newer models: use max_completion_tokens and default temperature
                    kwargs["max_completion_tokens"] = max_tokens
                else:
                    # Older models: use max_tokens and custom parameters
                    kwargs["max_tokens"] = max_tokens
                    kwargs["temperature"] = temperature
                    kwargs["top_p"] = 0.9
                    kwargs["frequency_penalty"] = 0
                    kwargs["presence_penalty"] = 0
                
                if getattr(request, 'json_mode', None):
                    # Prefer structured JSON response when requested
                    try:
                        kwargs["response_format"] = {"type": "json_object"}
                    except Exception:
                        pass

                response = self.client.chat.completions.create(**kwargs)
                
                processing_time = time.time() - start_time
                
                # Extract response content
                content = response.choices[0].message.content or ""

                # DEBUG: Log when content is empty to diagnose JSON parsing errors
                if not content:
                    finish_reason = response.choices[0].finish_reason
                    self.logger.warning(
                        f"⚠️  EMPTY RESPONSE from OpenAI - finish_reason={finish_reason}, "
                        f"response_id={response.id}, model={model}, "
                        f"prompt_length={len(str(kwargs.get('messages', [])))} chars"
                    )
                    # Log the full prompt for debugging (truncate if very long)
                    prompt_text = str(kwargs.get('messages', []))
                    if len(prompt_text) > 1000:
                        prompt_text = prompt_text[:500] + "\n...[TRUNCATED]...\n" + prompt_text[-500:]
                    self.logger.debug(f"Empty response prompt: {prompt_text}")

                # Extract usage information
                usage = {
                    'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
                    'completion_tokens': response.usage.completion_tokens if response.usage else 0,
                    'total_tokens': response.usage.total_tokens if response.usage else 0,
                }
                
                # Calculate actual cost if possible
                actual_cost = None
                if model in self.MODEL_PRICING and response.usage:
                    pricing = self.MODEL_PRICING[model]
                    actual_cost = (
                        (response.usage.prompt_tokens / 1000) * pricing["input"] +
                        (response.usage.completion_tokens / 1000) * pricing["output"]
                    )
                
                self.logger.debug(
                    "Received response from OpenAI",
                    model=model,
                    content_length=len(content),
                    processing_time=processing_time,
                    tokens_used=usage['total_tokens'],
                    estimated_cost=actual_cost
                )
                
                return LLMResponse(
                    content=content,
                    model=model,
                    usage=usage,
                    metadata={
                        'provider': 'openai',
                        'processing_time': processing_time,
                        'estimated_cost': actual_cost,
                        'finish_reason': response.choices[0].finish_reason,
                        'response_id': response.id,
                    },
                    success=True
                )
            
            except openai.RateLimitError as e:
                error_msg = f"OpenAI rate limit exceeded: {str(e)}"
                self.logger.error(
                    "OpenAI rate limit exceeded",
                    model=model,
                    error=error_msg,
                    processing_time=time.time() - start_time
                )
                return self.create_error_response(error_msg, model)
            
            except openai.AuthenticationError as e:
                error_msg = f"OpenAI authentication failed: {str(e)}"
                self.logger.error(
                    "OpenAI authentication failed",
                    error=error_msg
                )
                return self.create_error_response(error_msg, model)
            
            except openai.BadRequestError as e:
                error_msg = f"OpenAI bad request: {str(e)}"
                
                # Handle various parameter compatibility issues with newer models
                should_retry = False
                retry_kwargs = kwargs.copy()
                
                if "max_tokens" in str(e) and "max_completion_tokens" in str(e):
                    self.logger.warning(f"Retrying with max_completion_tokens for model {model}")
                    should_retry = True
                    if "max_tokens" in retry_kwargs:
                        retry_kwargs["max_completion_tokens"] = retry_kwargs.pop("max_tokens")
                    elif "max_completion_tokens" in retry_kwargs:
                        retry_kwargs["max_tokens"] = retry_kwargs.pop("max_completion_tokens")
                
                elif "temperature" in str(e) and ("default" in str(e) or "1)" in str(e)):
                    self.logger.warning(f"Retrying without temperature parameter for model {model}")
                    should_retry = True
                    # Remove temperature and other unsupported parameters for newer models
                    for param in ["temperature", "top_p", "frequency_penalty", "presence_penalty"]:
                        retry_kwargs.pop(param, None)
                
                if should_retry:
                    try:
                        
                        response = self.client.chat.completions.create(**retry_kwargs)
                        processing_time = time.time() - start_time
                        
                        # Extract response content
                        content = response.choices[0].message.content or ""
                        
                        # Extract usage information
                        usage = {
                            'prompt_tokens': response.usage.prompt_tokens if response.usage else 0,
                            'completion_tokens': response.usage.completion_tokens if response.usage else 0,
                            'total_tokens': response.usage.total_tokens if response.usage else 0,
                        }
                        
                        # Calculate actual cost if possible
                        actual_cost = None
                        if model in self.MODEL_PRICING and response.usage:
                            pricing = self.MODEL_PRICING[model]
                            actual_cost = (
                                (response.usage.prompt_tokens / 1000) * pricing["input"] +
                                (response.usage.completion_tokens / 1000) * pricing["output"]
                            )
                        
                        self.logger.debug(
                            "Received response from OpenAI (retry successful)",
                            model=model,
                            content_length=len(content),
                            processing_time=processing_time,
                            tokens_used=usage['total_tokens'],
                            estimated_cost=actual_cost
                        )
                        
                        return LLMResponse(
                            content=content,
                            model=model,
                            usage=usage,
                            metadata={
                                'provider': 'openai',
                                'processing_time': processing_time,
                                'estimated_cost': actual_cost,
                                'finish_reason': response.choices[0].finish_reason,
                                'response_id': response.id,
                                'retry_used': True,
                            },
                            success=True
                        )
                    except Exception as retry_error:
                        error_msg = f"OpenAI retry failed: {str(retry_error)}"
                
                self.logger.error(
                    "OpenAI bad request",
                    model=model,
                    error=error_msg,
                    messages_count=len(openai_messages)
                )
                return self.create_error_response(error_msg, model)
            
            except Exception as e:
                error_msg = f"OpenAI API error: {str(e)}"
                self.logger.error(
                    "OpenAI generation failed",
                    model=model,
                    error=error_msg,
                    processing_time=time.time() - start_time
                )
                return self.create_error_response(error_msg, model)
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics (if available)."""
        # Note: OpenAI doesn't provide a direct API for usage stats
        # This would need to be implemented with external tracking
        return {
            'provider': 'openai',
            'note': 'Usage statistics not available via API. Check OpenAI dashboard.',
            'default_model': self.default_model,
            'max_tokens': self.max_tokens
        }
    
    def validate_model(self, model_name: str) -> bool:
        """Validate if a model is available."""
        try:
            available_models = self.get_supported_models()
            return model_name in available_models
        except Exception:
            # Fallback to known models
            return model_name in self.MODEL_PRICING
    
    def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model."""
        try:
            model = self.client.models.retrieve(model_name)
            return {
                'id': model.id,
                'object': model.object,
                'created': model.created,
                'owned_by': model.owned_by,
                'pricing': self.MODEL_PRICING.get(model_name, 'Unknown')
            }
        except Exception as e:
            self.logger.error(f"Error getting model info for {model_name}: {e}")
            return None
    
    def estimate_tokens(self, text: str) -> int:
        """Rough estimation of token count."""
        # Simple heuristic: ~4 characters per token for English text
        return len(text) // 4
    
    def truncate_to_token_limit(self, text: str, max_tokens: int) -> str:
        """Truncate text to approximate token limit."""
        max_chars = max_tokens * 4  # Rough conversion
        if len(text) <= max_chars:
            return text
        
        # Truncate and add ellipsis
        return text[:max_chars-3] + "..."
    
    def get_context_window(self, model_name: str) -> int:
        """
        Get context window size for a specific model.

        Attempts to retrieve from OpenAI API, falls back to known limits.
        Results are cached for performance.

        Args:
            model_name: Model identifier (e.g., "gpt-5-mini")

        Returns:
            Context window size in tokens

        Example:
            >>> client.get_context_window("gpt-5-mini")
            128000
        """
        # Try to get from API (may not be exposed for all models)
        try:
            model_info = self.client.models.retrieve(model_name)
            # OpenAI doesn't expose context_length in API yet, use known limits
        except Exception:
            pass

        # Known context limits (updated 2025)
        model_limits = {
            "gpt-4": 8192,
            "gpt-4-32k": 32768,
            "gpt-4-turbo": 128000,
            "gpt-4-turbo-preview": 128000,
            "gpt-4o": 128000,
            "gpt-4o-mini": 128000,
            "gpt-3.5-turbo": 16385,
            "gpt-3.5-turbo-16k": 16385,
            "gpt-5-mini": 128000,  # GPT-5 models
            "gpt-5-nano": 128000,
            "gpt-5": 128000,
            "o1-preview": 128000,
            "o1-mini": 128000,
        }

        context_window = model_limits.get(model_name, 128000)  # Default to 128K for newer models
        self.logger.debug(f"Context window for {model_name}: {context_window:,} tokens")
        return context_window

    def _adjust_tokens_for_context(self, messages: List[Dict[str, str]], model: str, requested_tokens: int) -> int:
        """Dynamically adjust max_tokens based on input size, context limits, and max_completion_tokens."""
        from ..llm_clients.model_registry import get_context_window_openai, get_max_completion_tokens_openai

        # Get model-specific limits from registry
        context_limit = get_context_window_openai(self.client, model)
        max_completion = get_max_completion_tokens_openai(self.client, model)

        # Estimate input tokens (rough approximation)
        input_text = "\n".join([msg["content"] for msg in messages])
        estimated_input_tokens = self.estimate_tokens(input_text)

        # Reserve some tokens for safety margin and system overhead
        safety_margin = 200
        available_tokens = context_limit - estimated_input_tokens - safety_margin

        # Cap at BOTH available tokens AND model's max_completion_tokens
        adjusted_tokens = min(requested_tokens, available_tokens, max_completion)

        # Ensure we have at least some tokens for output (minimum 100)
        if adjusted_tokens < 100:
            self.logger.warning(f"Very limited tokens available for response: {adjusted_tokens}")
            adjusted_tokens = max(100, available_tokens // 2, 100)

        if adjusted_tokens != requested_tokens:
            self.logger.info(
                f"🔧 Adjusted max_tokens from {requested_tokens:,} to {adjusted_tokens:,} "
                f"(input: ~{estimated_input_tokens:,} tokens, context_limit: {context_limit:,}, "
                f"max_completion: {max_completion:,})"
            )

        return adjusted_tokens
