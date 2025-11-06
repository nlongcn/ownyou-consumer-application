"""
Gmail provider implementation with enhanced authentication and error handling.

Provides integration with Gmail API using OAuth2 authentication.
"""

import os
import time
import base64
import pickle
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime, timedelta

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import threading
from bs4 import BeautifulSoup
import re

from .base import (
    BaseEmailProvider, 
    EmailProviderError, 
    AuthenticationError, 
    PermissionError, 
    QuotaExceededError,
    RateLimitError,
    EmailQuery,
    ProviderStats
)
from ..models.email import RawEmail, EmailProvider
from ..utils.logging import get_logger, get_performance_logger, TimedOperation


class GmailProvider(BaseEmailProvider):
    """Gmail email provider with enhanced authentication and error handling."""
    
    # Class-level lock to prevent concurrent authentication
    _auth_lock = threading.Lock()
    
    # Gmail API scopes
    SCOPES = {
        'readonly': 'https://www.googleapis.com/auth/gmail.readonly',
        'modify': 'https://www.googleapis.com/auth/gmail.modify',
        'full': 'https://www.googleapis.com/auth/gmail.full-access'
    }
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Gmail provider.
        
        Args:
            config: Gmail configuration dictionary
        """
        super().__init__(config)
        
        self.credentials_file = config.get('gmail_credentials_file', 'credentials.json')
        self.token_file = config.get('gmail_token_file', 'token.json')
        self.scopes = config.get('gmail_scopes', [self.SCOPES['readonly']])
        self.max_retries = config.get('retry_attempts', 3)
        self.retry_delay = config.get('retry_delay', 2)
        
        self.service = None
        self.performance_logger = get_performance_logger(f"{__name__}.GmailProvider")
        
        # Ensure scopes is a list and flatten if needed
        if isinstance(self.scopes, str):
            self.scopes = [self.scopes]
        elif isinstance(self.scopes, list) and len(self.scopes) == 1 and isinstance(self.scopes[0], list):
            # Handle case where scopes is wrapped in another list: [['scope']] -> ['scope']
            self.scopes = self.scopes[0]
        
        # Validate credentials file exists
        if not Path(self.credentials_file).exists():
            raise FileNotFoundError(f"Gmail credentials file not found: {self.credentials_file}")
    
    def get_provider_type(self) -> EmailProvider:
        """Get the provider type."""
        return EmailProvider.GMAIL
    
    def authenticate(self) -> bool:
        """Authenticate with Gmail API using OAuth2.
        
        Returns:
            True if authentication successful, False otherwise
        """
        try:
            self.logger.info("Starting Gmail authentication")
            
            creds = None
            token_path = Path(self.token_file)
            
            # Load existing token if it exists
            if token_path.exists():
                self.logger.debug("Loading existing credentials")
                try:
                    creds = Credentials.from_authorized_user_file(self.token_file, self.scopes)
                except Exception as e:
                    self.logger.warning(f"Failed to load existing credentials: {e}")
                    # Remove invalid token file
                    try:
                        token_path.unlink()
                    except Exception:
                        pass
            
            # Refresh or create new credentials
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    self.logger.info("Refreshing expired credentials")
                    try:
                        creds.refresh(Request())
                    except Exception as e:
                        self.logger.warning(f"Failed to refresh credentials: {e}")
                        creds = None
                
                if not creds:
                    # Use class-level lock to prevent concurrent authentication
                    with GmailProvider._auth_lock:
                        # Check again in case another thread just authenticated
                        if Path(self.token_file).exists():
                            try:
                                creds = Credentials.from_authorized_user_file(
                                    self.token_file, self.scopes
                                )
                                if creds and creds.valid:
                                    self.logger.info("Using credentials from concurrent authentication")
                                else:
                                    creds = None
                            except Exception:
                                creds = None
                        
                        if not creds:
                            self.logger.info("Starting OAuth2 flow for new credentials")
                            try:
                                flow = InstalledAppFlow.from_client_secrets_file(
                                    self.credentials_file, 
                                    self.scopes
                                )
                                creds = flow.run_local_server(
                                    port=0,
                                    prompt='consent',
                                    authorization_prompt_message='Please visit this URL to authorize the application: {url}',
                                    success_message='The auth flow is complete; you may close this window.',
                                    open_browser=True
                                )
                            except Exception as e:
                                self.logger.error(f"OAuth2 flow failed: {e}")
                                raise AuthenticationError(f"Gmail authentication failed: {e}")
                
                # Save credentials for next run
                try:
                    with open(self.token_file, 'w') as token:
                        token.write(creds.to_json())
                    self.logger.info(f"Saved credentials to {self.token_file}")
                except Exception as e:
                    self.logger.warning(f"Failed to save credentials: {e}")
            
            # Build Gmail service
            try:
                self.service = build('gmail', 'v1', credentials=creds)
                self._credentials = creds
                self._authenticated = True
                
                # Test the connection
                profile = self.service.users().getProfile(userId='me').execute()
                self.logger.info(
                    "Gmail authentication successful",
                    email_address=profile.get('emailAddress'),
                    messages_total=profile.get('messagesTotal'),
                    threads_total=profile.get('threadsTotal')
                )
                
                return True
                
            except Exception as e:
                self.logger.error(f"Failed to build Gmail service: {e}")
                raise AuthenticationError(f"Failed to initialize Gmail service: {e}")
        
        except Exception as e:
            self.logger.error(f"Gmail authentication failed: {e}")
            self._authenticated = False
            return False
    
    def is_authenticated(self) -> bool:
        """Check if currently authenticated."""
        if not self._authenticated or not self.service:
            return False
        
        # Check if credentials are still valid
        if self._credentials and self._credentials.expired:
            self.logger.debug("Credentials expired, attempting refresh")
            return self.refresh_authentication()
        
        return True
    
    def get_account_info(self) -> Dict[str, Any]:
        """Get Gmail account information."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Gmail")
        
        try:
            profile = self.service.users().getProfile(userId='me').execute()
            
            return {
                'provider': 'gmail',
                'email_address': profile.get('emailAddress'),
                'messages_total': profile.get('messagesTotal', 0),
                'threads_total': profile.get('threadsTotal', 0),
                'history_id': profile.get('historyId'),
            }
        
        except HttpError as e:
            self._handle_http_error(e, "getting account info")
            return {}
        except Exception as e:
            self.logger.error(f"Failed to get account info: {e}")
            return {}
    
    def get_stats(self) -> ProviderStats:
        """Get Gmail statistics."""
        account_info = self.get_account_info()
        
        return ProviderStats(
            total_emails=account_info.get('messages_total', 0),
            available_emails=account_info.get('messages_total', 0),
            last_sync=datetime.utcnow().isoformat()
        )
    
    def _handle_http_error(self, error: HttpError, operation: str) -> None:
        """Handle Gmail API HTTP errors."""
        status_code = error.resp.status
        
        if status_code == 401:
            self.logger.error(f"Authentication error during {operation}")
            self._authenticated = False
            raise AuthenticationError(f"Authentication failed: {error}")
        elif status_code == 403:
            if 'quotaExceeded' in str(error):
                raise QuotaExceededError(f"Gmail API quota exceeded: {error}")
            else:
                raise PermissionError(f"Insufficient permissions: {error}")
        elif status_code == 429:
            raise RateLimitError(f"Rate limit exceeded: {error}")
        else:
            raise EmailProviderError(f"Gmail API error during {operation}: {error}")
    
    def _retry_api_call(self, api_call, *args, **kwargs):
        """Retry API call with exponential backoff."""
        for attempt in range(self.max_retries):
            try:
                return api_call(*args, **kwargs)
            except HttpError as e:
                if e.resp.status == 429:  # Rate limit
                    if attempt < self.max_retries - 1:
                        delay = self.retry_delay * (2 ** attempt)
                        self.logger.warning(
                            f"Rate limited, retrying in {delay}s (attempt {attempt + 1})"
                        )
                        time.sleep(delay)
                        continue
                raise e
            except Exception as e:
                if attempt < self.max_retries - 1:
                    delay = self.retry_delay * (2 ** attempt)
                    self.logger.warning(
                        f"API call failed, retrying in {delay}s (attempt {attempt + 1}): {e}"
                    )
                    time.sleep(delay)
                    continue
                raise e
        
        raise EmailProviderError(f"API call failed after {self.max_retries} attempts")
    
    def list_emails(self, query: EmailQuery) -> List[str]:
        """List Gmail message IDs matching the query."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Gmail")
        
        try:
            # Build Gmail query string
            gmail_query = self._build_gmail_query(query)
            
            self.logger.debug(f"Gmail query: {gmail_query}")
            
            with TimedOperation(self.performance_logger, "gmail_list_emails"):
                # Get message IDs
                messages = []
                page_token = None
                
                while len(messages) < query.max_emails:
                    request_params = {
                        'userId': 'me',
                        'q': gmail_query,
                        'maxResults': min(500, query.max_emails - len(messages))
                    }
                    
                    if page_token:
                        request_params['pageToken'] = page_token
                    
                    try:
                        result = self._retry_api_call(
                            self.service.users().messages().list,
                            **request_params
                        ).execute()
                        
                        batch_messages = result.get('messages', [])
                        messages.extend(batch_messages)
                        
                        page_token = result.get('nextPageToken')
                        if not page_token or not batch_messages:
                            break
                    
                    except HttpError as e:
                        self._handle_http_error(e, "listing emails")
                
                message_ids = [msg['id'] for msg in messages]
                
                self.logger.info(
                    f"Found Gmail messages",
                    count=len(message_ids),
                    query=gmail_query
                )
                
                return message_ids
        
        except Exception as e:
            if not isinstance(e, EmailProviderError):
                raise EmailProviderError(f"Failed to list Gmail messages: {e}")
            raise
    
    def _build_gmail_query(self, query: EmailQuery) -> str:
        """Build Gmail search query string."""
        query_parts = []
        
        # Add custom query
        if query.query:
            query_parts.append(query.query)
        
        # Add date filters
        if query.after_date:
            query_parts.append(f"after:{query.after_date}")
        
        if query.before_date:
            query_parts.append(f"before:{query.before_date}")
        
        # Add label filters
        if query.label_ids:
            for label_id in query.label_ids:
                query_parts.append(f"label:{label_id}")
        
        # Exclude spam and trash by default
        if not query.include_spam:
            query_parts.append("-in:spam")
        
        if not query.include_trash:
            query_parts.append("-in:trash")
        
        return " ".join(query_parts) if query_parts else ""
    
    def get_email(self, email_id: str) -> Optional[RawEmail]:
        """Get a single Gmail message by ID."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Gmail")
        
        try:
            with TimedOperation(self.performance_logger, "gmail_get_email"):
                message = self._retry_api_call(
                    self.service.users().messages().get,
                    userId='me',
                    id=email_id,
                    format='full'
                ).execute()
                
                return self._parse_gmail_message(message)
        
        except HttpError as e:
            if e.resp.status == 404:
                self.logger.warning(f"Gmail message not found: {email_id}")
                return None
            self._handle_http_error(e, f"getting email {email_id}")
        
        except Exception as e:
            self.logger.error(f"Failed to get Gmail message {email_id}: {e}")
            return None
    
    def get_emails_batch(self, email_ids: List[str]) -> List[RawEmail]:
        """Get multiple Gmail messages in batch."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Gmail")
        
        emails = []
        
        # Gmail API doesn't support true batch requests for messages().get()
        # So we'll process them individually with retry logic
        for email_id in email_ids:
            try:
                email = self.get_email(email_id)
                if email:
                    emails.append(email)
                    
                # Small delay to avoid rate limiting
                time.sleep(0.1)
                
            except Exception as e:
                self.logger.error(f"Failed to get email {email_id}: {e}")
                continue
        
        return emails
    
    def _parse_gmail_message(self, message: Dict[str, Any]) -> RawEmail:
        """Parse Gmail message into RawEmail object."""
        payload = message.get('payload', {})
        headers = {h['name']: h['value'] for h in payload.get('headers', [])}
        
        # Extract basic information
        email_data = {
            'id': message['id'],
            'provider': EmailProvider.GMAIL,
            'from_email': headers.get('From', ''),
            'subject': headers.get('Subject', ''),
            'headers': headers
        }
        
        # Parse date
        date_str = headers.get('Date', '')
        if date_str:
            try:
                # Use email.utils.parsedate_to_datetime for proper parsing
                from email.utils import parsedate_to_datetime
                email_data['date'] = parsedate_to_datetime(date_str)
            except Exception as e:
                self.logger.warning(f"Failed to parse date '{date_str}': {e}")
        
        # Parse recipient information
        to_header = headers.get('To', '')
        if to_header:
            email_data['to_email'] = [addr.strip() for addr in to_header.split(',')]
        
        # Extract body content
        body_plain, body_html = self._extract_body_content(payload)
        email_data['body_plain'] = body_plain
        email_data['body_html'] = body_html
        
        # Extract attachments
        attachments = self._extract_attachments(payload)
        email_data['attachments'] = attachments
        
        return RawEmail(**email_data)
    
    def _extract_body_content(self, payload: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Extract plain text and HTML content from email payload."""
        plain_text = None
        html_content = None
        
        def extract_from_part(part: Dict[str, Any]) -> None:
            nonlocal plain_text, html_content
            
            mime_type = part.get('mimeType', '')
            
            if mime_type == 'text/plain' and not plain_text:
                data = part.get('body', {}).get('data', '')
                if data:
                    try:
                        plain_text = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                    except Exception as e:
                        self.logger.warning(f"Failed to decode plain text: {e}")
            
            elif mime_type == 'text/html' and not html_content:
                data = part.get('body', {}).get('data', '')
                if data:
                    try:
                        html_content = base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
                    except Exception as e:
                        self.logger.warning(f"Failed to decode HTML: {e}")
            
            # Recursively check parts
            for sub_part in part.get('parts', []):
                extract_from_part(sub_part)
        
        # Extract from main payload and all parts
        extract_from_part(payload)
        
        # Convert HTML to plain text if no plain text available
        if not plain_text and html_content:
            plain_text = self._html_to_text(html_content)
        
        return plain_text, html_content
    
    def _html_to_text(self, html: str) -> str:
        """Convert HTML to clean plain text."""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get text and clean up whitespace
            text = soup.get_text(separator='\n')
            text = re.sub(r'\n\s*\n+', '\n\n', text).strip()
            
            return text
        
        except Exception as e:
            self.logger.warning(f"Failed to convert HTML to text: {e}")
            return html
    
    def _extract_attachments(self, payload: Dict[str, Any]) -> List[str]:
        """Extract attachment filenames from email payload."""
        attachments = []
        
        def extract_from_part(part: Dict[str, Any]) -> None:
            filename = part.get('filename')
            if filename:
                attachments.append(filename)
            
            # Check sub-parts
            for sub_part in part.get('parts', []):
                extract_from_part(sub_part)
        
        extract_from_part(payload)
        return attachments
    
    def get_labels(self) -> List[Dict[str, str]]:
        """Get Gmail labels."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Gmail")
        
        try:
            result = self._retry_api_call(
                self.service.users().labels().list,
                userId='me'
            ).execute()
            
            labels = result.get('labels', [])
            return [{'id': label['id'], 'name': label['name']} for label in labels]
        
        except HttpError as e:
            self._handle_http_error(e, "getting labels")
            return []
        except Exception as e:
            self.logger.error(f"Failed to get Gmail labels: {e}")
            return []