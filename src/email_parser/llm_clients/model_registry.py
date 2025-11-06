#!/usr/bin/env python3
"""
Dynamic Model Registry

Fetches model context windows from vendor APIs when available,
falls back to cached values from official documentation.

This provides a single source of truth that can handle new model releases
without code changes (for vendors with APIs) and clearly documents
when fallback values are being used.
"""

import logging
from typing import Optional, Dict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Cache for API-fetched values (TTL: 24 hours)
_context_window_cache: Dict[str, tuple[int, datetime]] = {}
_CACHE_TTL = timedelta(hours=24)


def get_context_window_openai(client, model_name: str) -> Optional[int]:
    """
    Get context window for OpenAI model.

    OpenAI API does NOT expose context window in models endpoint.
    Falls back to documented values from https://platform.openai.com/docs/models

    Last updated: 2025-01-09
    """
    # Check cache first
    if model_name in _context_window_cache:
        cached_value, cached_time = _context_window_cache[model_name]
        if datetime.now() - cached_time < _CACHE_TTL:
            return cached_value

    # Try API (currently doesn't expose context_length)
    try:
        model_info = client.models.retrieve(model_name)
        # OpenAI doesn't expose context_length yet
        # When they do, access it here and cache it
    except Exception as e:
        logger.debug(f"OpenAI models API call failed: {e}")

    # Fallback to documented values
    # Source: https://platform.openai.com/docs/models (verified 2025-01-09)
    DOCUMENTED_LIMITS = {
        # GPT-4 family
        "gpt-4o": 128000,
        "gpt-4o-mini": 128000,
        "gpt-4-turbo": 128000,
        "gpt-4-turbo-preview": 128000,
        "gpt-4": 8192,
        "gpt-4-32k": 32768,

        # GPT-3.5 family
        "gpt-3.5-turbo": 16385,
        "gpt-3.5-turbo-16k": 16385,

        # GPT-5 family (experimental - update as released)
        "gpt-5": 128000,
        "gpt-5-mini": 128000,
        "gpt-5-nano": 128000,

        # o1 family
        "o1-preview": 128000,
        "o1-mini": 128000,
    }

    # Try exact match
    if model_name in DOCUMENTED_LIMITS:
        context_window = DOCUMENTED_LIMITS[model_name]
    else:
        # Try prefix match (e.g., "gpt-4o-2024-05-13" matches "gpt-4o")
        context_window = None
        for known_model, limit in DOCUMENTED_LIMITS.items():
            if model_name.startswith(known_model):
                context_window = limit
                break

        if context_window is None:
            # Default to 128K for unknown models (conservative for modern models)
            logger.warning(
                f"Unknown OpenAI model '{model_name}' - using fallback 128K context window. "
                f"Update model_registry.py if this is incorrect."
            )
            context_window = 128000

    # Cache the result
    _context_window_cache[model_name] = (context_window, datetime.now())

    logger.info(
        f"OpenAI context window for {model_name}: {context_window:,} tokens "
        f"(source: documented fallback)"
    )
    return context_window


def get_context_window_claude(client, model_name: str) -> Optional[int]:
    """
    Get context window for Claude model.

    Anthropic API does NOT expose context window in any endpoint.
    Falls back to documented values from https://docs.claude.com/en/docs/about-claude/models

    Last updated: 2025-01-09
    """
    # Check cache first
    if model_name in _context_window_cache:
        cached_value, cached_time = _context_window_cache[model_name]
        if datetime.now() - cached_time < _CACHE_TTL:
            return cached_value

    # Anthropic doesn't expose context_length in API

    # Fallback to documented values
    # Source: https://docs.claude.com/en/docs/about-claude/models (verified 2025-01-09)
    # Note: Sonnet 4/4.5 support 1M with beta header "context-1m-2025-08-07"
    DOCUMENTED_LIMITS = {
        # Claude 3.5+ models (all 200K standard, 1M with beta)
        "claude-sonnet-4": 200000,  # Can use 1M with beta header
        "claude-sonnet-4-5": 200000,  # Can use 1M with beta header
        "claude-3-5-sonnet": 200000,
        "claude-3-5-haiku": 200000,

        # Claude 3 models
        "claude-3-opus": 200000,
        "claude-3-sonnet": 200000,
        "claude-3-haiku": 200000,

        # Claude Opus 4 models
        "claude-opus-4": 200000,
        "claude-opus-4-1": 200000,
    }

    # Try exact match or prefix match
    context_window = None
    for known_model, limit in DOCUMENTED_LIMITS.items():
        if model_name == known_model or model_name.startswith(known_model):
            context_window = limit
            break

    if context_window is None:
        # Default to 200K for unknown Claude models (all Claude 3+ have 200K)
        logger.warning(
            f"Unknown Claude model '{model_name}' - using fallback 200K context window. "
            f"Update model_registry.py if this is incorrect."
        )
        context_window = 200000

    # Cache the result
    _context_window_cache[model_name] = (context_window, datetime.now())

    logger.info(
        f"Claude context window for {model_name}: {context_window:,} tokens "
        f"(source: documented fallback)"
    )
    return context_window


def get_context_window_google(client, model_name: str) -> Optional[int]:
    """
    Get context window for Google Gemini model.

    Google DOES expose context window via models.get() API!
    Falls back to documented values only if API fails.

    Last updated: 2025-01-09
    """
    # Check cache first
    if model_name in _context_window_cache:
        cached_value, cached_time = _context_window_cache[model_name]
        if datetime.now() - cached_time < _CACHE_TTL:
            return cached_value

    # Try API first (Google exposes input_token_limit!)
    try:
        model_info = client.models.get(model=model_name)
        if hasattr(model_info, 'input_token_limit'):
            context_window = model_info.input_token_limit
            _context_window_cache[model_name] = (context_window, datetime.now())
            logger.info(
                f"Google context window for {model_name}: {context_window:,} tokens "
                f"(source: API)"
            )
            return context_window
    except Exception as e:
        logger.warning(f"Failed to fetch Gemini model info from API: {e}")

    # Fallback to documented values
    # Source: https://ai.google.dev/gemini-api/docs/models (verified 2025-01-09)
    DOCUMENTED_LIMITS = {
        "gemini-2.0-flash": 1000000,
        "gemini-2.5-flash": 1000000,  # Added for testing
        "gemini-2.5-pro": 1000000,
        "gemini-1.5-pro": 1000000,
        "gemini-1.5-flash": 1000000,
        "gemini-1.0-pro": 30720,
    }

    # Try exact match or prefix match
    context_window = None
    for known_model, limit in DOCUMENTED_LIMITS.items():
        if model_name == known_model or model_name.startswith(known_model):
            context_window = limit
            break

    if context_window is None:
        # Default to 1M for unknown Gemini models (1.5+ have 1M)
        logger.warning(
            f"Unknown Gemini model '{model_name}' - using fallback 1M context window. "
            f"Update model_registry.py if this is incorrect."
        )
        context_window = 1000000

    # Cache the result
    _context_window_cache[model_name] = (context_window, datetime.now())

    logger.info(
        f"Google context window for {model_name}: {context_window:,} tokens "
        f"(source: documented fallback)"
    )
    return context_window


def get_max_completion_tokens_openai(client, model_name: str) -> int:
    """
    Get max completion (output) tokens for OpenAI model.

    OpenAI models have different max_completion_tokens limits than context_window.
    Falls back to documented values from https://platform.openai.com/docs/models

    Last updated: 2025-01-09

    Args:
        client: OpenAI client instance (unused, for API consistency)
        model_name: Model identifier (e.g., "gpt-4o-mini")

    Returns:
        Max completion tokens for this model

    Example:
        >>> get_max_completion_tokens_openai(client, "gpt-4o-mini")
        16384
    """
    # Documented max_completion_tokens limits
    # Source: https://platform.openai.com/docs/models (verified 2025-01-09)
    DOCUMENTED_LIMITS = {
        # GPT-4 family
        "gpt-4o": 16384,
        "gpt-4o-mini": 16384,
        "gpt-4-turbo": 4096,
        "gpt-4-turbo-preview": 4096,
        "gpt-4": 8192,
        "gpt-4-32k": 8192,

        # GPT-3.5 family
        "gpt-3.5-turbo": 4096,
        "gpt-3.5-turbo-16k": 4096,

        # GPT-5 family (experimental - update as released)
        "gpt-5": 4096,
        "gpt-5-mini": 16384,
        "gpt-5-nano": 16384,

        # o1 family
        "o1-preview": 32768,
        "o1-mini": 65536,
    }

    # Try exact match
    if model_name in DOCUMENTED_LIMITS:
        max_tokens = DOCUMENTED_LIMITS[model_name]
    else:
        # Try prefix match (e.g., "gpt-4o-2024-05-13" matches "gpt-4o")
        max_tokens = None
        for known_model, limit in DOCUMENTED_LIMITS.items():
            if model_name.startswith(known_model):
                max_tokens = limit
                break

        if max_tokens is None:
            # Default to 16384 for unknown models (standard for modern OpenAI models)
            logger.warning(
                f"Unknown OpenAI model '{model_name}' - using fallback 16384 max_completion_tokens. "
                f"Update model_registry.py if this is incorrect."
            )
            max_tokens = 16384

    logger.debug(
        f"Max completion tokens for {model_name}: {max_tokens:,} tokens "
        f"(source: documented fallback)"
    )
    return max_tokens


def get_max_completion_tokens_claude(client, model_name: str) -> int:
    """
    Get max completion (output) tokens for Claude model.

    All Claude 3+ models have 8,192 max output tokens (4,096 for legacy models).
    Source: https://docs.claude.com/en/docs/about-claude/models

    Last updated: 2025-01-09

    Args:
        client: Anthropic client instance (unused, for API consistency)
        model_name: Model identifier (e.g., "claude-sonnet-4-20250514")

    Returns:
        Max completion tokens for this model

    Example:
        >>> get_max_completion_tokens_claude(client, "claude-sonnet-4-20250514")
        8192
    """
    # Claude 3+ models all have 8,192 max output tokens
    # Legacy models (Claude 2.x) had 4,096
    if "claude-2" in model_name or "claude-1" in model_name:
        max_tokens = 4096
    else:
        max_tokens = 8192

    logger.debug(
        f"Max completion tokens for {model_name}: {max_tokens:,} tokens "
        f"(source: documented fallback)"
    )
    return max_tokens


def get_max_completion_tokens_google(client, model_name: str) -> int:
    """
    Get max completion (output) tokens for Google Gemini model.

    Gemini models have 8,192 max output tokens (except legacy 1.0: 2,048).
    Source: https://ai.google.dev/gemini-api/docs/models

    Last updated: 2025-01-09

    Args:
        client: Google client instance (unused, for API consistency)
        model_name: Model identifier (e.g., "gemini-2.0-flash-exp")

    Returns:
        Max completion tokens for this model

    Example:
        >>> get_max_completion_tokens_google(client, "gemini-2.0-flash-exp")
        8192
    """
    # Gemini 1.5+ and 2.0+ models all have 8,192 max output tokens
    # Gemini 1.0 had 2,048
    if "gemini-1.0" in model_name or "gemini-1-0" in model_name:
        max_tokens = 2048
    else:
        max_tokens = 8192

    logger.debug(
        f"Max completion tokens for {model_name}: {max_tokens:,} tokens "
        f"(source: documented fallback)"
    )
    return max_tokens


def get_model_context_window(provider: str, model_name: str) -> Optional[int]:
    """
    Generic dispatcher to get context window for any provider.

    This is a convenience function that dispatches to provider-specific functions.
    Note: Requires instantiating a client, which adds overhead.

    Args:
        provider: Provider name ("openai", "claude", "google")
        model_name: Model identifier (e.g., "gpt-5-mini", "claude-sonnet-4")

    Returns:
        Context window size in tokens, or None if provider unknown

    Example:
        >>> get_model_context_window("openai", "gpt-5-mini")
        128000
    """
    provider_lower = provider.lower()

    if provider_lower == "openai":
        # Import and instantiate OpenAI client (config falls back to env vars)
        try:
            from .openai_client import OpenAIClient
            client = OpenAIClient(config={})
            return get_context_window_openai(client.client, model_name)
        except Exception as e:
            logger.warning(f"Failed to get OpenAI context window: {e}")
            return None

    elif provider_lower in ["claude", "anthropic"]:
        # Import and instantiate Claude client (config falls back to env vars)
        try:
            from .claude_client import ClaudeClient
            client = ClaudeClient(config={})
            return get_context_window_claude(client.client, model_name)
        except Exception as e:
            logger.warning(f"Failed to get Claude context window: {e}")
            return None

    elif provider_lower in ["google", "gemini"]:
        # Import and instantiate Google client (config falls back to env vars)
        try:
            from .google_client import GoogleClient
            client = GoogleClient(config={})
            return get_context_window_google(client.client, model_name)
        except Exception as e:
            logger.warning(f"Failed to get Google context window: {e}")
            return None

    else:
        logger.warning(f"Unknown provider '{provider}' - cannot get context window")
        return None


__all__ = [
    'get_context_window_openai',
    'get_context_window_claude',
    'get_context_window_google',
    'get_max_completion_tokens_openai',
    'get_max_completion_tokens_claude',
    'get_max_completion_tokens_google',
    'get_model_context_window',
]
