"""
LLM clients for the email parser system.

Provides unified interfaces for different LLM providers.
"""

from .base import (
    BaseLLMClient,
    LLMProvider,
    LLMRequest,
    LLMResponse,
    LLMMessage,
    LLMClientFactory,
    create_simple_request,
    create_conversation_request
)
from .ollama_client import OllamaClient
from .openai_client import OpenAIClient
from .claude_client import ClaudeClient
from .google_client import GoogleClient

__all__ = [
    'BaseLLMClient',
    'LLMProvider',
    'LLMRequest',
    'LLMResponse',
    'LLMMessage',
    'LLMClientFactory',
    'OllamaClient',
    'OpenAIClient',
    'ClaudeClient',
    'GoogleClient',
    'create_simple_request',
    'create_conversation_request',
]