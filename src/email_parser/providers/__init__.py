"""
Email providers for the email parser system.

Provides unified interfaces for different email providers (Gmail, Outlook, etc.).
"""

from .base import (
    BaseEmailProvider,
    EmailProviderError,
    AuthenticationError,
    PermissionError,
    QuotaExceededError,
    RateLimitError,
    EmailQuery,
    ProviderStats,
    EmailProviderFactory,
)
from .gmail_provider import GmailProvider
from .outlook_provider import OutlookProvider

__all__ = [
    'BaseEmailProvider',
    'EmailProviderError',
    'AuthenticationError',
    'PermissionError',
    'QuotaExceededError',
    'RateLimitError',
    'EmailQuery',
    'ProviderStats',
    'EmailProviderFactory',
    'GmailProvider',
    'OutlookProvider',
]