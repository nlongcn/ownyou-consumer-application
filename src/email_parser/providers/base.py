"""
Abstract base class for email providers.

Provides a unified interface for different email providers (Gmail, Outlook, etc.).
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Iterator
from dataclasses import dataclass
from enum import Enum
import logging

from ..models.email import RawEmail, EmailBatch, EmailProvider


class EmailProviderError(Exception):
    """Base exception for email provider errors."""
    pass


class AuthenticationError(EmailProviderError):
    """Authentication failed."""
    pass


class PermissionError(EmailProviderError):
    """Insufficient permissions."""
    pass


class QuotaExceededError(EmailProviderError):
    """API quota exceeded."""
    pass


class RateLimitError(EmailProviderError):
    """Rate limit exceeded."""
    pass


@dataclass
class EmailQuery:
    """Email query parameters."""
    max_emails: int = 100
    query: Optional[str] = None  # Search query
    label_ids: Optional[List[str]] = None  # Label/folder IDs
    after_date: Optional[str] = None  # Date filter (YYYY/MM/DD)
    before_date: Optional[str] = None  # Date filter (YYYY/MM/DD)
    include_spam: bool = False
    include_trash: bool = False


@dataclass
class ProviderStats:
    """Statistics from email provider."""
    total_emails: int
    available_emails: int
    quota_used: Optional[int] = None
    quota_limit: Optional[int] = None
    last_sync: Optional[str] = None


class BaseEmailProvider(ABC):
    """Abstract base class for email providers."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the email provider.
        
        Args:
            config: Provider-specific configuration
        """
        self.config = config
        # Use structlog for proper structured logging
        from ..utils.logging import get_logger
        self.logger = get_logger(f"{__name__}.{self.__class__.__name__}")
        self._authenticated = False
        self._credentials = None
    
    @abstractmethod
    def get_provider_type(self) -> EmailProvider:
        """Get the provider type."""
        pass
    
    @abstractmethod
    def authenticate(self) -> bool:
        """Authenticate with the email provider.
        
        Returns:
            True if authentication successful, False otherwise
        """
        pass
    
    @abstractmethod
    def is_authenticated(self) -> bool:
        """Check if currently authenticated."""
        pass
    
    @abstractmethod
    def get_account_info(self) -> Dict[str, Any]:
        """Get account information."""
        pass
    
    @abstractmethod
    def get_stats(self) -> ProviderStats:
        """Get provider statistics."""
        pass
    
    @abstractmethod
    def list_emails(self, query: EmailQuery) -> List[str]:
        """List email IDs matching the query.
        
        Args:
            query: Email query parameters
            
        Returns:
            List of email IDs
        """
        pass
    
    @abstractmethod
    def get_email(self, email_id: str) -> Optional[RawEmail]:
        """Get a single email by ID.
        
        Args:
            email_id: Email ID
            
        Returns:
            RawEmail object or None if not found
        """
        pass
    
    @abstractmethod
    def get_emails_batch(self, email_ids: List[str]) -> List[RawEmail]:
        """Get multiple emails in batch.
        
        Args:
            email_ids: List of email IDs
            
        Returns:
            List of RawEmail objects
        """
        pass
    
    def download_emails(self, query: EmailQuery) -> EmailBatch:
        """Download emails matching the query.
        
        Args:
            query: Email query parameters
            
        Returns:
            EmailBatch with downloaded emails
        """
        # Ensure authentication
        if not self.is_authenticated():
            if not self.authenticate():
                raise AuthenticationError("Failed to authenticate with email provider")
        
        self.logger.info(
            f"Starting email download",
            provider=self.get_provider_type().value,
            max_emails=query.max_emails,
            query=query.query
        )
        
        try:
            # Get email IDs
            email_ids = self.list_emails(query)
            
            if not email_ids:
                self.logger.warning("No emails found matching query")
                return EmailBatch(
                    emails=[],
                    batch_id=f"{self.get_provider_type().value}_{int(time.time())}",
                    provider=self.get_provider_type(),
                    total_count=0
                )
            
            self.logger.info(f"Found {len(email_ids)} emails to download")
            
            # Download emails in batches
            batch_size = self.config.get('batch_size', 50)
            emails = []
            
            for i in range(0, len(email_ids), batch_size):
                batch_ids = email_ids[i:i + batch_size]
                self.logger.debug(f"Downloading batch {i//batch_size + 1} ({len(batch_ids)} emails)")
                
                try:
                    batch_emails = self.get_emails_batch(batch_ids)
                    emails.extend(batch_emails)
                except Exception as e:
                    self.logger.error(f"Failed to download batch: {e}")
                    # Continue with next batch
                    continue
            
            batch = EmailBatch(
                emails=emails,
                batch_id=f"{self.get_provider_type().value}_{int(time.time())}",
                provider=self.get_provider_type(),
                total_count=len(emails)
            )
            
            self.logger.info(
                f"Successfully downloaded emails",
                total_requested=len(email_ids),
                total_downloaded=len(emails),
                success_rate=len(emails) / len(email_ids) * 100
            )
            
            return batch
        
        except Exception as e:
            self.logger.error(f"Email download failed: {e}")
            raise EmailProviderError(f"Failed to download emails: {e}")
    
    def test_connection(self) -> bool:
        """Test connection to email provider.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            if not self.is_authenticated():
                return self.authenticate()
            
            # Try to get account info as a connection test
            account_info = self.get_account_info()
            return account_info is not None
        
        except Exception as e:
            self.logger.error(f"Connection test failed: {e}")
            return False
    
    def refresh_authentication(self) -> bool:
        """Refresh authentication credentials.
        
        Returns:
            True if refresh successful, False otherwise
        """
        self._authenticated = False
        return self.authenticate()


class EmailProviderFactory:
    """Factory for creating email providers."""
    
    @staticmethod
    def create_provider(provider_type: EmailProvider, config: Dict[str, Any]) -> BaseEmailProvider:
        """Create an email provider instance.
        
        Args:
            provider_type: Type of email provider
            config: Provider configuration
            
        Returns:
            Email provider instance
        """
        if provider_type == EmailProvider.GMAIL:
            from .gmail_provider import GmailProvider
            return GmailProvider(config)
        elif provider_type in [EmailProvider.OUTLOOK, EmailProvider.HOTMAIL]:
            from .outlook_provider import OutlookProvider
            return OutlookProvider(config)
        else:
            raise ValueError(f"Unsupported email provider: {provider_type}")
    
    @staticmethod
    def get_supported_providers() -> List[EmailProvider]:
        """Get list of supported email providers."""
        return [EmailProvider.GMAIL, EmailProvider.OUTLOOK, EmailProvider.HOTMAIL]


# Import time module for timestamp generation
import time