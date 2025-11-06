"""
Abstract base class and interfaces for LLM clients.

Provides a unified interface for different LLM providers (Ollama, OpenAI, Claude).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass
from enum import Enum
import logging


class LLMProvider(Enum):
    """Supported LLM providers."""
    OLLAMA = "ollama"
    OPENAI = "openai"
    CLAUDE = "claude"
    GOOGLE = "google"


@dataclass
class LLMMessage:
    """Represents a message in the conversation."""
    role: str  # "system", "user", "assistant"
    content: str


@dataclass
class LLMRequest:
    """Represents a request to an LLM."""
    messages: List[LLMMessage]
    model: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    system_prompt: Optional[str] = None
    json_mode: Optional[bool] = None


@dataclass
class LLMResponse:
    """Represents a response from an LLM."""
    content: str
    model: str
    usage: Dict[str, Any]
    metadata: Dict[str, Any]
    success: bool
    error: Optional[str] = None


class BaseLLMClient(ABC):
    """Abstract base class for LLM clients."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the LLM client with configuration."""
        self.config = config
        # Use structlog for proper structured logging
        from ..utils.logging import get_logger
        self.logger = get_logger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    def get_provider(self) -> LLMProvider:
        """Get the provider type."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if the LLM service is available."""
        pass
    
    @abstractmethod
    def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate a response from the LLM."""
        pass
    
    @abstractmethod
    def get_supported_models(self) -> List[str]:
        """Get list of supported models."""
        pass
    
    @abstractmethod
    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        """Estimate the cost of a request (if applicable)."""
        pass
    
    def validate_request(self, request: LLMRequest) -> List[str]:
        """Validate the request and return list of errors."""
        errors = []
        
        if not request.messages:
            errors.append("At least one message is required")
        
        for i, message in enumerate(request.messages):
            if not message.role:
                errors.append(f"Message {i}: role is required")
            if message.role not in ["system", "user", "assistant"]:
                errors.append(f"Message {i}: invalid role '{message.role}'")
            if not message.content:
                errors.append(f"Message {i}: content is required")
        
        # Check if system prompt is duplicated
        system_messages = [msg for msg in request.messages if msg.role == "system"]
        if request.system_prompt and system_messages:
            errors.append("Cannot have both system_prompt and system messages")
        
        return errors
    
    def prepare_messages(self, request: LLMRequest) -> List[LLMMessage]:
        """Prepare messages for the specific provider."""
        messages = request.messages.copy()
        
        # Add system prompt as first message if provided
        if request.system_prompt:
            system_message = LLMMessage(role="system", content=request.system_prompt)
            messages.insert(0, system_message)
        
        return messages
    
    def create_error_response(self, error: str, model: str = "unknown") -> LLMResponse:
        """Create an error response."""
        return LLMResponse(
            content="",
            model=model,
            usage={},
            metadata={"error": error},
            success=False,
            error=error
        )
    
    def analyze_email(self, email_content: str, model: str) -> Dict[str, Any]:
        """Analyze email content and extract structured information.

        Args:
            email_content: Raw email content to analyze
            model: Specific model to use for analysis (required)

        Returns:
            Dictionary with extracted information
        """
        system_prompt = """You are an email analysis AI that returns ONLY JSON responses.

CRITICAL RULES:
1. Do NOT show your thinking process
2. Do NOT include explanations 
3. Do NOT use <think> tags
4. Return ONLY the JSON object
5. No text before or after the JSON

Your task: Extract email information into this exact JSON format:
{
  "summary": "Brief summary of email content",
  "products": "Product1, Product2" or "",
  "category": "Purchase|Newsletter|Spam|Personal Communication|Invoice|Shipment Related|Insurance|Bank Related|Car|House Related|Other",
  "sentiment": "positive|negative|neutral",
  "key_topics": "topic1, topic2, topic3",
  "action_required": "Yes|No"
}

REMEMBER: Output ONLY the JSON object. No thinking, no explanations, no extra text."""

        user_prompt = f"""EMAIL CONTENT:
{email_content}

RESPOND WITH ONLY THE JSON OBJECT (no thinking, no explanations, no other text):"""
        
        try:
            request = create_simple_request(
                user_message=user_prompt,
                system_prompt=system_prompt,
                model=model,  # Use exact model name specified - no fallback
                temperature=0.1  # Low temperature for consistent extraction
            )
            
            response = self.generate(request)
            
            if response.success:
                # Try to parse JSON response
                import json
                try:
                    content = response.content
                    
                    # Clean up reasoning model artifacts (DeepSeek-R1, etc.)
                    import re
                    if '<think>' in content:
                        # Extract content after </think> tag
                        content = re.sub(r'<think>.*?</think>\s*', '', content, flags=re.DOTALL)
                    
                    # Look for JSON object in the cleaned content
                    json_match = re.search(r'\{[^{}]*"summary"[^{}]*?\}', content, re.DOTALL)
                    if json_match:
                        content = json_match.group(0)
                    
                    analysis = json.loads(content)
                    
                    # Helper function to parse comma-separated strings into lists
                    def parse_comma_list(value):
                        if isinstance(value, list):
                            return value
                        if isinstance(value, str) and value.strip():
                            return [item.strip() for item in value.split(',') if item.strip()]
                        return []
                    
                    return {
                        'summary': analysis.get('summary', ''),
                        'products': parse_comma_list(analysis.get('products', '')),
                        'category': analysis.get('category', 'Other'),
                        'sentiment': analysis.get('sentiment', 'neutral'),
                        'key_topics': parse_comma_list(analysis.get('key_topics', '')),
                        'action_required': analysis.get('action_required', 'No')
                    }
                except (json.JSONDecodeError, AttributeError):
                    # Fallback: parse plain text response
                    return self._parse_plain_text_analysis(response.content)
            else:
                self.logger.error(f"LLM analysis failed: {response.error}")
                return self._get_default_analysis()
                
        except Exception as e:
            self.logger.error(f"Email analysis error: {str(e)}")
            return self._get_default_analysis()
    
    def _parse_plain_text_analysis(self, content: str) -> Dict[str, Any]:
        """Parse plain text LLM response as fallback."""
        analysis = self._get_default_analysis()
        
        # Simple keyword-based parsing as fallback
        content_lower = content.lower()
        
        # Extract category based on keywords
        if any(word in content_lower for word in ['purchase', 'order', 'buy', 'payment']):
            analysis['category'] = 'Purchase'
        elif any(word in content_lower for word in ['invoice', 'bill', 'payment due']):
            analysis['category'] = 'Invoice'
        elif any(word in content_lower for word in ['shipping', 'delivered', 'shipment']):
            analysis['category'] = 'Shipment Related'
        elif any(word in content_lower for word in ['insurance', 'policy', 'claim']):
            analysis['category'] = 'Insurance'
        elif any(word in content_lower for word in ['bank', 'account', 'balance']):
            analysis['category'] = 'Bank Related'
        elif any(word in content_lower for word in ['car', 'vehicle', 'auto']):
            analysis['category'] = 'Car'
        elif any(word in content_lower for word in ['house', 'home', 'mortgage', 'real estate']):
            analysis['category'] = 'House Related'
        elif 'unsubscribe' in content_lower or any(word in content_lower for word in ['lottery', 'win money', 'guaranteed returns']):
            analysis['category'] = 'Spam'
        elif any(word in content_lower for word in ['newsletter']):
            analysis['category'] = 'Newsletter'
        elif any(word in content_lower for word in ['blog', 'news', 'update']):
            analysis['category'] = 'News/Blog/Spam'
        
        # Extract sentiment
        if any(word in content_lower for word in ['thank', 'great', 'excellent', 'happy']):
            analysis['sentiment'] = 'positive'
        elif any(word in content_lower for word in ['problem', 'issue', 'error', 'cancel']):
            analysis['sentiment'] = 'negative'
        
        # Use first 100 chars as summary
        analysis['summary'] = content[:100] + "..." if len(content) > 100 else content
        
        return analysis
    
    def _get_default_analysis(self) -> Dict[str, Any]:
        """Get default analysis structure."""
        return {
            'summary': 'Unable to analyze email content',
            'products': [],
            'category': 'Other',
            'sentiment': 'neutral',
            'key_topics': [],
            'action_required': 'No'
        }


class LLMClientFactory:
    """Factory for creating LLM clients."""
    
    @staticmethod
    def create_client(provider: Union[str, LLMProvider], config: Dict[str, Any]) -> BaseLLMClient:
        """Create an LLM client for the specified provider."""
        if isinstance(provider, str):
            try:
                provider = LLMProvider(provider.lower())
            except ValueError:
                raise ValueError(f"Unsupported LLM provider: {provider}")
        
        if provider == LLMProvider.OLLAMA:
            from .ollama_client import OllamaClient
            return OllamaClient(config)
        elif provider == LLMProvider.OPENAI:
            from .openai_client import OpenAIClient
            return OpenAIClient(config)
        elif provider == LLMProvider.CLAUDE:
            from .claude_client import ClaudeClient
            return ClaudeClient(config)
        elif provider == LLMProvider.GOOGLE:
            from .google_client import GoogleClient
            return GoogleClient(config)
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")


# Utility functions for working with LLM clients

def create_simple_request(
    user_message: str,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    json_mode: Optional[bool] = None,
) -> LLMRequest:
    """Create a simple LLM request with a user message."""
    messages = [LLMMessage(role="user", content=user_message)]
    
    return LLMRequest(
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system_prompt=system_prompt,
        json_mode=json_mode
    )


def create_conversation_request(
    conversation: List[tuple],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None
) -> LLMRequest:
    """Create an LLM request from a conversation.
    
    Args:
        conversation: List of (role, content) tuples
        system_prompt: Optional system prompt
        model: Optional model name
        max_tokens: Optional max tokens
        temperature: Optional temperature
    
    Returns:
        LLMRequest object
    """
    messages = [LLMMessage(role=role, content=content) for role, content in conversation]
    
    return LLMRequest(
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        system_prompt=system_prompt
    )
