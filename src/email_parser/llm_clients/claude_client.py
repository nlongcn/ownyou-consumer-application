"""
Claude (Anthropic) LLM client implementation.

Provides integration with Anthropic's Claude models.
"""

import time
from typing import Dict, Any, List, Optional
import anthropic
from ..llm_clients.base import BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage
from ..utils.logging import get_logger, TimedOperation, get_performance_logger


class ClaudeClient(BaseLLMClient):
    """Client for Anthropic's Claude models."""
    
    # Model pricing per 1M tokens (as of 2025)
    MODEL_PRICING = {
        "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
        "claude-3-sonnet-20240229": {"input": 3.0, "output": 15.0},
        "claude-3-opus-20240229": {"input": 15.0, "output": 75.0},
        "claude-3-5-sonnet-20240620": {"input": 3.0, "output": 15.0},
        "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0},  # Claude-4 pricing
    }
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Claude client.

        Args:
            config: Configuration dictionary with Anthropic settings
        """
        import os
        super().__init__(config)

        # Get config from dict or fallback to environment variables
        self.api_key = config.get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY')
        self.default_model = config.get('anthropic_model') or os.getenv('ANTHROPIC_MODEL')
        if not self.default_model:
            raise ValueError("Anthropic model must be specified in ANTHROPIC_MODEL environment variable")

        # Default to 8192 (Claude 3+ standard, refined per-model in generate())
        # Will be dynamically adjusted by _adjust_tokens_for_context() based on model-specific limits
        max_tokens_str = config.get('anthropic_max_tokens') or os.getenv('ANTHROPIC_MAX_TOKENS')
        self.max_tokens = int(max_tokens_str) if max_tokens_str else 8192
        self.performance_logger = get_performance_logger(f"{__name__}.ClaudeClient")
        
        if not self.api_key:
            raise ValueError("Anthropic API key is required")
        
        # Initialize Anthropic client
        self.client = anthropic.Anthropic(api_key=self.api_key)
        
        # Verify connection
        self._verify_connection()
    
    def get_provider(self) -> LLMProvider:
        """Get the provider type."""
        return LLMProvider.CLAUDE
    
    def is_available(self) -> bool:
        """Check if Anthropic API is available."""
        try:
            # Try a minimal request to test connectivity
            response = self.client.messages.create(
                model=self.default_model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Test"}]
            )
            return True
        except anthropic.APIConnectionError:
            return False
        except anthropic.AuthenticationError:
            return False
        except Exception:
            # If we get any other error, assume the service is available
            # but there might be an issue with the specific request
            return True
    
    def _verify_connection(self) -> None:
        """Verify connection to Anthropic API."""
        try:
            # Test with a minimal request
            response = self.client.messages.create(
                model=self.default_model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hello"}]
            )
            
            self.logger.info(
                "Successfully connected to Anthropic API",
                default_model=self.default_model,
                test_response_length=len(response.content[0].text) if response.content else 0
            )
        except anthropic.AuthenticationError as e:
            self.logger.error(
                "Failed to authenticate with Anthropic API. Please check your API key.",
                error=str(e)
            )
            raise
        except Exception as e:
            self.logger.error(
                "Failed to connect to Anthropic API",
                error=str(e)
            )
            raise
    
    def get_supported_models(self) -> List[str]:
        """Get list of available Claude models."""
        # Anthropic doesn't provide a models endpoint, so return known models
        return list(self.MODEL_PRICING.keys())

    def get_context_window(self, model_name: str) -> int:
        """
        Get context window size for a Claude model.

        Args:
            model_name: Model identifier (e.g., "claude-sonnet-4-20250514")

        Returns:
            Context window size in tokens

        Example:
            >>> client.get_context_window("claude-sonnet-4-20250514")
            200000
        """
        # Known Claude context windows
        context_limits = {
            "claude-3-5-sonnet-20241022": 200000,
            "claude-3-5-sonnet-20240620": 200000,
            "claude-3-5-haiku-20241022": 200000,
            "claude-3-opus-20240229": 200000,
            "claude-3-sonnet-20240229": 200000,
            "claude-3-haiku-20240307": 200000,
            "claude-sonnet-4-20250514": 200000,  # Sonnet 4 / 4.5
        }

        # Match by exact name or partial match
        if model_name in context_limits:
            context_window = context_limits[model_name]
        else:
            # Try partial match (e.g., "claude-sonnet-4" matches "claude-sonnet-4-*")
            for known_model, limit in context_limits.items():
                if model_name in known_model or known_model.startswith(model_name):
                    context_window = limit
                    break
            else:
                context_window = 200000  # Default for all Claude 3+ models

        self.logger.debug(f"Context window for {model_name}: {context_window:,} tokens")
        return context_window

    def _adjust_tokens_for_context(self, model: str, requested_tokens: int) -> int:
        """Dynamically adjust max_tokens based on model-specific max_completion_tokens limit."""
        from ..llm_clients.model_registry import get_max_completion_tokens_claude

        # Get model-specific max output tokens from registry
        max_completion = get_max_completion_tokens_claude(self.client, model)

        # Cap at model's max_completion_tokens
        adjusted_tokens = min(requested_tokens, max_completion)

        if adjusted_tokens != requested_tokens:
            self.logger.debug(
                f"Adjusted max_tokens from {requested_tokens} to {adjusted_tokens} "
                f"(max_completion: {max_completion})"
            )

        return adjusted_tokens

    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        """Estimate the cost of a request."""
        model = request.model or self.default_model
        
        if model not in self.MODEL_PRICING:
            # Try to match partial model names
            for known_model in self.MODEL_PRICING:
                if any(part in model for part in known_model.split('-')):
                    model = known_model
                    break
            else:
                self.logger.warning(f"Unknown model for cost estimation: {model}")
                return None
        
        # Rough token estimation (1 token ≈ 3.5 characters for Claude)
        input_text = "\n".join([msg.content for msg in request.messages])
        if request.system_prompt:
            input_text += "\n" + request.system_prompt
        
        estimated_input_tokens = len(input_text) // 3.5
        estimated_output_tokens = request.max_tokens or self.max_tokens
        
        pricing = self.MODEL_PRICING[model]
        estimated_cost = (
            (estimated_input_tokens / 1_000_000) * pricing["input"] +
            (estimated_output_tokens / 1_000_000) * pricing["output"]
        )
        
        return estimated_cost
    
    def _format_messages_for_claude(self, messages: List[LLMMessage]) -> tuple[List[Dict[str, str]], Optional[str]]:
        """Format messages for Claude API.
        
        Returns:
            Tuple of (messages_list, system_prompt)
        """
        system_prompt = None
        formatted_messages = []
        
        for message in messages:
            if message.role == "system":
                # Claude uses a separate system parameter
                if system_prompt is None:
                    system_prompt = message.content
                else:
                    # Combine multiple system messages
                    system_prompt += "\n\n" + message.content
            else:
                formatted_messages.append({
                    "role": message.role,
                    "content": message.content
                })
        
        return formatted_messages, system_prompt
    
    def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate response using Claude API."""
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
        max_tokens = self._adjust_tokens_for_context(model, request.max_tokens or self.max_tokens)
        temperature = request.temperature or 0.7
        
        # Format messages for Claude
        claude_messages, system_prompt = self._format_messages_for_claude(messages)
        
        # Ensure we have at least one user message
        if not claude_messages or claude_messages[0]["role"] != "user":
            error_msg = "Claude requires at least one user message"
            return self.create_error_response(error_msg, model)
        
        self.logger.debug(
            "Sending request to Claude",
            model=model,
            messages_count=len(claude_messages),
            has_system_prompt=system_prompt is not None,
            max_tokens=max_tokens,
            temperature=temperature
        )
        
        start_time = time.time()
        
        with TimedOperation(self.performance_logger, "claude_generate", {"model": model}):
            try:
                # Prepare request parameters
                request_params = {
                    "model": model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "messages": claude_messages,
                }
                
                # Add system prompt if present
                if system_prompt:
                    request_params["system"] = system_prompt
                
                response = self.client.messages.create(**request_params)
                
                processing_time = time.time() - start_time
                
                # Extract response content
                content = ""
                if response.content:
                    # Claude returns a list of content blocks
                    content = "\n".join([
                        block.text for block in response.content
                        if hasattr(block, 'text')
                    ])
                
                # Extract usage information
                usage = {
                    'input_tokens': response.usage.input_tokens if response.usage else 0,
                    'output_tokens': response.usage.output_tokens if response.usage else 0,
                    'total_tokens': (
                        (response.usage.input_tokens if response.usage else 0) +
                        (response.usage.output_tokens if response.usage else 0)
                    ),
                }
                
                # Calculate actual cost if possible
                actual_cost = None
                if model in self.MODEL_PRICING and response.usage:
                    pricing = self.MODEL_PRICING[model]
                    actual_cost = (
                        (response.usage.input_tokens / 1_000_000) * pricing["input"] +
                        (response.usage.output_tokens / 1_000_000) * pricing["output"]
                    )
                
                self.logger.debug(
                    "Received response from Claude",
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
                        'provider': 'claude',
                        'processing_time': processing_time,
                        'estimated_cost': actual_cost,
                        'stop_reason': response.stop_reason,
                        'response_id': response.id,
                        'role': response.role,
                    },
                    success=True
                )
            
            except anthropic.RateLimitError as e:
                error_msg = f"Claude rate limit exceeded: {str(e)}"
                self.logger.error(
                    "Claude rate limit exceeded",
                    model=model,
                    error=error_msg,
                    processing_time=time.time() - start_time
                )
                return self.create_error_response(error_msg, model)
            
            except anthropic.AuthenticationError as e:
                error_msg = f"Claude authentication failed: {str(e)}"
                self.logger.error(
                    "Claude authentication failed",
                    error=error_msg
                )
                return self.create_error_response(error_msg, model)
            
            except anthropic.BadRequestError as e:
                error_msg = f"Claude bad request: {str(e)}"
                self.logger.error(
                    "Claude bad request",
                    model=model,
                    error=error_msg,
                    messages_count=len(claude_messages)
                )
                return self.create_error_response(error_msg, model)
            
            except anthropic.APIConnectionError as e:
                error_msg = f"Claude connection error: {str(e)}"
                self.logger.error(
                    "Claude connection error",
                    error=error_msg
                )
                return self.create_error_response(error_msg, model)
            
            except Exception as e:
                error_msg = f"Claude API error: {str(e)}"
                self.logger.error(
                    "Claude generation failed",
                    model=model,
                    error=error_msg,
                    processing_time=time.time() - start_time
                )
                return self.create_error_response(error_msg, model)
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics (if available)."""
        # Note: Anthropic doesn't provide a direct API for usage stats
        return {
            'provider': 'claude',
            'note': 'Usage statistics not available via API. Check Anthropic console.',
            'default_model': self.default_model,
            'max_tokens': self.max_tokens
        }
    
    def validate_model(self, model_name: str) -> bool:
        """Validate if a model is available."""
        return model_name in self.MODEL_PRICING
    
    def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model."""
        if model_name not in self.MODEL_PRICING:
            return None
        
        return {
            'id': model_name,
            'provider': 'anthropic',
            'pricing': self.MODEL_PRICING[model_name],
            'capabilities': [
                'text_generation',
                'conversation',
                'analysis',
                'reasoning'
            ]
        }
    
    def estimate_tokens(self, text: str) -> int:
        """Rough estimation of token count for Claude."""
        # Simple heuristic: ~3.5 characters per token for Claude
        return int(len(text) / 3.5)
    
    def truncate_to_token_limit(self, text: str, max_tokens: int) -> str:
        """Truncate text to approximate token limit."""
        max_chars = int(max_tokens * 3.5)  # Rough conversion for Claude
        if len(text) <= max_chars:
            return text
        
        # Truncate and add ellipsis
        return text[:max_chars-3] + "..."
    
    def count_message_tokens(self, messages: List[LLMMessage]) -> int:
        """Estimate token count for a list of messages."""
        total_text = "\n".join([msg.content for msg in messages])
        return self.estimate_tokens(total_text)