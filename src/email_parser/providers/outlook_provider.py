"""
Outlook/Hotmail provider implementation using Microsoft Graph API.

Provides integration with Outlook.com and Hotmail accounts via Microsoft Graph.
"""

import os
import time
import json
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime, timedelta
import urllib.parse

import msal
import requests
from bs4 import BeautifulSoup

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


class OutlookProvider(BaseEmailProvider):
    """Outlook/Hotmail email provider using Microsoft Graph API."""
    
    # Microsoft Graph endpoints
    GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0"
    AUTHORITY_URL = "https://login.microsoftonline.com/consumers"  # Use consumers endpoint for personal accounts
    
    # Required scopes for email access
    SCOPES = [
        "https://graph.microsoft.com/Mail.Read",
        "https://graph.microsoft.com/User.Read"
    ]
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Outlook provider.
        
        Args:
            config: Outlook configuration dictionary
        """
        super().__init__(config)
        
        self.client_id = config.get('microsoft_client_id')
        self.client_secret = config.get('microsoft_client_secret')
        self.tenant_id = config.get('microsoft_tenant_id', 'common')
        self.token_file = config.get('microsoft_token_file', 'ms_token.json')
        self.scopes = config.get('microsoft_scopes', self.SCOPES)
        self.max_retries = config.get('retry_attempts', 3)
        self.retry_delay = config.get('retry_delay', 2)
        
        # Validate Microsoft credentials
        if not self.client_id:
            raise ValueError("Microsoft client ID is required")
        
        # Check if we have placeholder credentials
        if (self.client_id == "your_microsoft_client_id_here" or 
            self.client_secret == "your_microsoft_client_secret_here"):
            raise ValueError(
                "Microsoft credentials are placeholder values. Please set valid "
                "MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in your .env file. "
                "Register your app at https://portal.azure.com to get these credentials."
            )
        
        # Initialize MSAL application with persistent token cache
        # Use PublicClientApplication for device code flow
        # ConfidentialClient doesn't support device code flow for personal accounts
        # Use consumers endpoint for personal Microsoft accounts (Outlook.com, Hotmail.com)

        # Setup persistent token cache
        cache_file = "msal_token_cache.bin"
        cache = msal.SerializableTokenCache()

        # Load existing cache if available
        if os.path.exists(cache_file):
            with open(cache_file, 'r') as f:
                cache.deserialize(f.read())

        self.msal_app = msal.PublicClientApplication(
            client_id=self.client_id,
            authority="https://login.microsoftonline.com/consumers",
            token_cache=cache
        )

        # Save cache function for later use
        self.cache_file = cache_file
        self.token_cache = cache

        self.logger.info("Using PublicClientApplication with persistent token cache")

        self.access_token = None
        self.performance_logger = get_performance_logger(f"{__name__}.OutlookProvider")

        # Try to load existing token on initialization
        self._load_existing_token()
    
    def _load_existing_token(self) -> None:
        """Load existing token on initialization if available and valid."""
        try:
            token_data = self._load_token()
            if token_data and self._is_token_valid(token_data):
                self.access_token = token_data['access_token']
                self._authenticated = True
                self.logger.debug("Loaded existing valid token on initialization")
            else:
                self.logger.debug("No valid existing token found")
        except Exception as e:
            self.logger.debug(f"Failed to load existing token: {e}")
    
    def get_provider_type(self) -> EmailProvider:
        """Get the provider type."""
        # Return OUTLOOK for both Outlook and Hotmail
        return EmailProvider.OUTLOOK
    
    def is_available(self) -> bool:
        """Check if Microsoft Graph API is available."""
        if not self.access_token:
            return False
        
        try:
            # Try a minimal request to test connectivity
            headers = {'Authorization': f'Bearer {self.access_token}'}
            response = requests.get(
                f"{self.GRAPH_ENDPOINT}/me",
                headers=headers,
                timeout=10
            )
            return response.status_code == 200
        except Exception as e:
            self.logger.debug(f"Microsoft Graph availability check failed: {str(e)}")
            return False
    
    def authenticate(self) -> bool:
        """Authenticate with Microsoft Graph API using OAuth2.
        
        Returns:
            True if authentication successful, False otherwise
        """
        try:
            self.logger.info("Starting Microsoft Graph authentication")
            
            # Try to load existing token
            token_data = self._load_token()
            
            if token_data:
                self.logger.debug("Found existing token, checking validity")
                
                # Check if token is still valid
                if self._is_token_valid(token_data):
                    self.access_token = token_data['access_token']
                    self._authenticated = True
                    self.logger.info("Using existing valid token")
                    return True
                
                # Try to refresh token
                if 'refresh_token' in token_data:
                    self.logger.info("Attempting to refresh token")
                    new_token = self._refresh_token(token_data['refresh_token'])
                    if new_token:
                        self.access_token = new_token['access_token']
                        self._save_token(new_token)
                        self._authenticated = True
                        self.logger.info("Successfully refreshed token")
                        return True
            
            # Perform interactive authentication
            self.logger.info("Starting interactive authentication flow")
            result = self._interactive_auth()
            
            if result and 'access_token' in result:
                self.access_token = result['access_token']
                self._save_token(result)
                self._authenticated = True
                
                # Test the token by getting user info
                user_info = self.get_account_info()
                self.logger.info(
                    "Microsoft Graph authentication successful",
                    user_email=user_info.get('email'),
                    user_name=user_info.get('display_name')
                )
                
                return True
            else:
                self.logger.error("Interactive authentication failed")
                return False
        
        except Exception as e:
            self.logger.error(f"Microsoft Graph authentication failed: {e}")
            self._authenticated = False
            return False
    
    def _load_token(self) -> Optional[Dict[str, Any]]:
        """Load token from file."""
        token_path = Path(self.token_file)
        if token_path.exists():
            try:
                with open(token_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                self.logger.warning(f"Failed to load token file: {e}")
        return None
    
    def _save_token(self, token_data: Dict[str, Any]) -> None:
        """Save token to file and persist MSAL cache."""
        try:
            # Save token data to JSON file
            with open(self.token_file, 'w') as f:
                json.dump(token_data, f, indent=2)
            self.logger.debug(f"Token saved to {self.token_file}")

            # Also persist MSAL token cache
            if self.token_cache.has_state_changed:
                with open(self.cache_file, 'w') as f:
                    f.write(self.token_cache.serialize())
                self.logger.debug(f"MSAL cache saved to {self.cache_file}")

        except Exception as e:
            self.logger.warning(f"Failed to save token: {e}")
    
    def _is_token_valid(self, token_data: Dict[str, Any]) -> bool:
        """Check if token is still valid."""
        if 'expires_at' not in token_data:
            return False
        
        expires_at = datetime.fromtimestamp(token_data['expires_at'])
        return datetime.now() < expires_at - timedelta(minutes=5)  # 5 min buffer
    
    def _refresh_token(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Refresh access token using refresh token.

        MSAL's PublicClientApplication supports silent token acquisition
        which uses the refresh token automatically.
        """
        try:
            self.logger.info("Attempting silent token acquisition using refresh token")

            # Get accounts from cache
            accounts = self.msal_app.get_accounts()

            if accounts:
                # Try silent acquisition for the first account
                result = self.msal_app.acquire_token_silent(
                    scopes=self.scopes,
                    account=accounts[0]
                )

                if result and 'access_token' in result:
                    # Add expiration timestamp
                    if 'expires_in' in result:
                        result['expires_at'] = time.time() + result['expires_in']

                    self.logger.info("Successfully refreshed token silently")
                    return result
                else:
                    error = result.get('error_description', 'Unknown error')
                    self.logger.warning(f"Silent token acquisition failed: {error}")
                    return None
            else:
                self.logger.warning("No accounts in cache for silent token acquisition")
                return None

        except Exception as e:
            self.logger.error(f"Token refresh failed: {e}")
            return None
    
    def _interactive_auth(self) -> Optional[Dict[str, Any]]:
        """Perform interactive authentication."""
        try:
            print("🔄 Initiating device code flow with Microsoft...")
            
            # Check if we're using ConfidentialClient (which has client secret)
            if hasattr(self.msal_app, 'client_credential'):
                print("📝 Using ConfidentialClient authentication with client secret")
                # For ConfidentialClient, try device flow but with different method if needed
                try:
                    flow = self.msal_app.initiate_device_flow(scopes=self.scopes)
                except Exception as e:
                    print(f"⚠️  Device flow not supported with ConfidentialClient: {e}")
                    # Try alternative authentication method
                    return self._try_client_credentials_flow()
            else:
                print("📝 Using PublicClient authentication (device code flow)")
                flow = self.msal_app.initiate_device_flow(scopes=self.scopes)
            
            # Debug: Show the entire flow response
            print(f"📋 Device flow response keys: {list(flow.keys())}")
            
            if "user_code" not in flow:
                # Check if this is due to invalid client credentials
                error_details = flow.get('error_description', flow.get('error', 'Unknown error'))
                print(f"❌ Device flow failed - no user_code in response")
                print(f"📋 Full error details: {flow}")
                
                if 'client' in error_details.lower() or 'invalid' in error_details.lower():
                    raise ValueError(
                        f"Failed to create device flow - invalid Microsoft app registration. "
                        f"Error: {error_details}. Please verify your MICROSOFT_CLIENT_ID is correct "
                        f"and the app is registered for device code flow at https://portal.azure.com"
                    )
                else:
                    raise Exception(f"Failed to create device flow: {error_details}")
            
            # Display the device code prominently
            print("\n" + "="*60)
            print("🔐 MICROSOFT DEVICE CODE AUTHENTICATION")
            print("="*60)
            print(f"📟 DEVICE CODE: {flow['user_code']}")
            print(f"🌐 URL: {flow.get('verification_uri', 'https://microsoft.com/devicelogin')}")
            print("="*60)
            print("\n📋 INSTRUCTIONS:")
            print("1. Open your web browser")
            print(f"2. Go to: {flow.get('verification_uri', 'https://microsoft.com/devicelogin')}")
            print(f"3. Enter this code: {flow['user_code']}")
            print("4. Sign in with your Microsoft/Outlook account")
            print("5. Return here and wait for authentication to complete")
            print("\n⏰ You have 15 minutes to complete this process")
            print("-"*60)
            
            # Also print the original message from Microsoft
            if "message" in flow:
                print(f"\n📨 Microsoft's message: {flow['message']}")
            
            self.logger.info("Device code authentication initiated", 
                           user_code=flow['user_code'], 
                           verification_uri=flow.get('verification_uri'))
            
            print("\n⏳ Waiting for you to complete authentication in your browser...")
            
            # Wait for user to complete authentication
            result = self.msal_app.acquire_token_by_device_flow(flow, timeout=300)  # 5 minutes
            
            if "access_token" in result:
                # Add expiration timestamp
                if 'expires_in' in result:
                    result['expires_at'] = time.time() + result['expires_in']
                
                return result
            else:
                error_msg = result.get('error_description', result.get('error', 'Unknown error'))
                raise Exception(f"Authentication failed: {error_msg}")
        
        except Exception as e:
            self.logger.error(f"Interactive authentication failed: {e}")
            return None
    
    def _try_client_credentials_flow(self) -> Optional[Dict[str, Any]]:
        """Try client credentials flow as alternative to device code."""
        try:
            print("🔄 Trying client credentials flow...")
            
            # Note: Client credentials flow doesn't work for personal accounts
            # We need to guide user to fix their Azure app configuration instead
            print("❌ Client credentials flow cannot access personal email accounts")
            print("📋 Please configure your Azure app for device code flow:")
            print("   1. Go to Azure Portal > App registrations > Your app")
            print("   2. Authentication > Advanced settings")
            print("   3. Set 'Allow public client flows' to 'Yes'")
            print("   4. Save and try again")
            
            return None
            
        except Exception as e:
            self.logger.error(f"Client credentials flow failed: {e}")
            return None
    
    def is_authenticated(self) -> bool:
        """Check if currently authenticated."""
        if not self._authenticated or not self.access_token:
            return False
        
        # Load token data to check expiration
        token_data = self._load_token()
        if token_data and not self._is_token_valid(token_data):
            self.logger.debug("Token expired, attempting refresh")
            return self.refresh_authentication()
        
        return True
    
    def get_account_info(self) -> Dict[str, Any]:
        """Get Microsoft account information."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Microsoft Graph")
        
        try:
            with TimedOperation(self.performance_logger, "graph_get_user"):
                headers = {'Authorization': f'Bearer {self.access_token}'}
                
                response = requests.get(
                    f"{self.GRAPH_ENDPOINT}/me",
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    user_data = response.json()
                    return {
                        'provider': 'outlook',
                        'email': user_data.get('mail') or user_data.get('userPrincipalName'),
                        'display_name': user_data.get('displayName'),
                        'id': user_data.get('id'),
                        'job_title': user_data.get('jobTitle'),
                        'office_location': user_data.get('officeLocation'),
                    }
                else:
                    self._handle_http_error(response, "getting account info")
                    return {}
        
        except Exception as e:
            self.logger.error(f"Failed to get account info: {e}")
            return {}
    
    def get_stats(self) -> ProviderStats:
        """Get Outlook statistics."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Microsoft Graph")
        
        try:
            with TimedOperation(self.performance_logger, "graph_get_stats"):
                headers = {'Authorization': f'Bearer {self.access_token}'}
                
                # Get mailbox statistics
                response = requests.get(
                    f"{self.GRAPH_ENDPOINT}/me/mailFolders/inbox",
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    inbox_data = response.json()
                    total_items = inbox_data.get('totalItemCount', 0)
                    unread_items = inbox_data.get('unreadItemCount', 0)
                    
                    return ProviderStats(
                        total_emails=total_items,
                        available_emails=total_items,
                        last_sync=datetime.utcnow().isoformat()
                    )
                else:
                    self.logger.warning("Failed to get mailbox statistics")
                    return ProviderStats(total_emails=0, available_emails=0)
        
        except Exception as e:
            self.logger.error(f"Failed to get stats: {e}")
            return ProviderStats(total_emails=0, available_emails=0)
    
    def _handle_http_error(self, response: requests.Response, operation: str) -> None:
        """Handle Microsoft Graph API HTTP errors."""
        status_code = response.status_code
        
        try:
            error_data = response.json()
            error_msg = error_data.get('error', {}).get('message', response.text)
        except:
            error_msg = response.text
        
        if status_code == 401:
            self.logger.error(f"Authentication error during {operation}")
            self._authenticated = False
            raise AuthenticationError(f"Authentication failed: {error_msg}")
        elif status_code == 403:
            raise PermissionError(f"Insufficient permissions: {error_msg}")
        elif status_code == 429:
            raise RateLimitError(f"Rate limit exceeded: {error_msg}")
        elif status_code >= 500:
            raise EmailProviderError(f"Server error during {operation}: {error_msg}")
        else:
            raise EmailProviderError(f"API error during {operation}: {error_msg}")
    
    def _retry_api_call(self, api_call, *args, **kwargs):
        """Retry API call with exponential backoff."""
        for attempt in range(self.max_retries):
            try:
                response = api_call(*args, **kwargs)
                
                if response.status_code == 429:  # Rate limit
                    if attempt < self.max_retries - 1:
                        delay = self.retry_delay * (2 ** attempt)
                        retry_after = response.headers.get('Retry-After', delay)
                        try:
                            delay = int(retry_after)
                        except:
                            pass
                        
                        self.logger.warning(
                            f"Rate limited, retrying in {delay}s (attempt {attempt + 1})"
                        )
                        time.sleep(delay)
                        continue
                
                return response
                
            except requests.exceptions.RequestException as e:
                if attempt < self.max_retries - 1:
                    delay = self.retry_delay * (2 ** attempt)
                    self.logger.warning(
                        f"Request failed, retrying in {delay}s (attempt {attempt + 1}): {e}"
                    )
                    time.sleep(delay)
                    continue
                raise e
        
        raise EmailProviderError(f"API call failed after {self.max_retries} attempts")
    
    def list_emails(self, query: EmailQuery) -> List[str]:
        """List Outlook message IDs matching the query."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Microsoft Graph")
        
        try:
            headers = {'Authorization': f'Bearer {self.access_token}'}
            
            # Build query parameters
            params = {
                '$top': min(query.max_emails, 1000),  # Max 1000 per request
                '$select': 'id',
                '$orderby': 'receivedDateTime desc'
            }
            
            # Add filters
            filter_conditions = []
            
            if query.after_date:
                filter_conditions.append(f"receivedDateTime ge {query.after_date}")
            
            if query.before_date:
                filter_conditions.append(f"receivedDateTime le {query.before_date}")
            
            if filter_conditions:
                params['$filter'] = ' and '.join(filter_conditions)
            
            with TimedOperation(self.performance_logger, "graph_list_emails"):
                message_ids = []
                url = f"{self.GRAPH_ENDPOINT}/me/messages"
                
                while len(message_ids) < query.max_emails:
                    response = self._retry_api_call(
                        requests.get,
                        url,
                        headers=headers,
                        params=params,
                        timeout=60
                    )
                    
                    if response.status_code != 200:
                        self._handle_http_error(response, "listing emails")
                    
                    data = response.json()
                    messages = data.get('value', [])
                    
                    if not messages:
                        break
                    
                    batch_ids = [msg['id'] for msg in messages]
                    message_ids.extend(batch_ids)
                    
                    # Check for next page
                    next_link = data.get('@odata.nextLink')
                    if not next_link or len(message_ids) >= query.max_emails:
                        break
                    
                    # Update for next request
                    url = next_link
                    params = {}  # Parameters are in the next_link URL
                
                # Limit to requested count
                message_ids = message_ids[:query.max_emails]
                
                self.logger.info(
                    f"Found Outlook messages",
                    count=len(message_ids)
                )
                
                return message_ids
        
        except Exception as e:
            if not isinstance(e, EmailProviderError):
                raise EmailProviderError(f"Failed to list Outlook messages: {e}")
            raise
    
    def get_email(self, email_id: str) -> Optional[RawEmail]:
        """Get a single Outlook message by ID."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Microsoft Graph")
        
        try:
            with TimedOperation(self.performance_logger, "graph_get_email"):
                headers = {'Authorization': f'Bearer {self.access_token}'}
                
                response = self._retry_api_call(
                    requests.get,
                    f"{self.GRAPH_ENDPOINT}/me/messages/{email_id}",
                    headers=headers,
                    timeout=60
                )
                
                if response.status_code == 404:
                    self.logger.warning(f"Outlook message not found: {email_id}")
                    return None
                
                if response.status_code != 200:
                    self._handle_http_error(response, f"getting email {email_id}")
                
                message_data = response.json()
                return self._parse_outlook_message(message_data)
        
        except Exception as e:
            if isinstance(e, EmailProviderError):
                raise
            self.logger.error(f"Failed to get Outlook message {email_id}: {e}")
            return None
    
    def get_emails_batch(self, email_ids: List[str]) -> List[RawEmail]:
        """Get multiple Outlook messages in batch."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Microsoft Graph")
        
        emails = []
        
        # Process in smaller batches to avoid timeouts
        batch_size = 20
        for i in range(0, len(email_ids), batch_size):
            batch_ids = email_ids[i:i + batch_size]
            
            for email_id in batch_ids:
                try:
                    email = self.get_email(email_id)
                    if email:
                        emails.append(email)
                    
                    # Small delay to avoid rate limiting
                    time.sleep(0.2)
                    
                except Exception as e:
                    self.logger.error(f"Failed to get email {email_id}: {e}")
                    continue
        
        return emails
    
    def _parse_outlook_message(self, message: Dict[str, Any]) -> RawEmail:
        """Parse Outlook message into RawEmail object."""
        # Extract basic information
        email_data = {
            'id': message.get('id', ''),
            'provider': EmailProvider.OUTLOOK,
            'subject': message.get('subject', ''),
        }
        
        # Parse sender information
        sender = message.get('sender', {}).get('emailAddress', {})
        email_data['from_email'] = sender.get('address', '')
        
        # Parse recipient information
        to_recipients = message.get('toRecipients', [])
        email_data['to_email'] = [
            recipient.get('emailAddress', {}).get('address', '')
            for recipient in to_recipients
        ]
        
        # Parse date
        received_date = message.get('receivedDateTime')
        if received_date:
            try:
                # Parse ISO format date
                email_data['date'] = datetime.fromisoformat(received_date.replace('Z', '+00:00'))
            except Exception as e:
                self.logger.warning(f"Failed to parse date '{received_date}': {e}")
        
        # Extract body content
        body = message.get('body', {})
        content_type = body.get('contentType', 'html')
        body_content = body.get('content', '')
        
        if content_type.lower() == 'html':
            email_data['body_html'] = body_content
            email_data['body_plain'] = self._html_to_text(body_content) if body_content else None
        else:
            email_data['body_plain'] = body_content
            email_data['body_html'] = None
        
        # Extract attachments
        attachments = message.get('attachments', [])
        email_data['attachments'] = [att.get('name', '') for att in attachments if att.get('name')]
        
        # Store additional headers/metadata
        email_data['headers'] = {
            'Message-ID': message.get('internetMessageId', ''),
            'Subject': message.get('subject', ''),
            'From': email_data['from_email'],
            'To': ', '.join(email_data.get('to_email', [])),
            'Date': received_date or '',
            'Content-Type': content_type,
        }
        
        return RawEmail(**email_data)
    
    def _html_to_text(self, html: str) -> str:
        """Convert HTML to clean plain text."""
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get text and clean up whitespace
            text = soup.get_text(separator='\n')
            import re
            text = re.sub(r'\n\s*\n+', '\n\n', text).strip()
            
            return text
        
        except Exception as e:
            self.logger.warning(f"Failed to convert HTML to text: {e}")
            return html
    
    def get_folders(self) -> List[Dict[str, str]]:
        """Get Outlook mail folders."""
        if not self.is_authenticated():
            raise AuthenticationError("Not authenticated with Microsoft Graph")
        
        try:
            headers = {'Authorization': f'Bearer {self.access_token}'}
            
            response = self._retry_api_call(
                requests.get,
                f"{self.GRAPH_ENDPOINT}/me/mailFolders",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                folders = data.get('value', [])
                return [
                    {'id': folder['id'], 'name': folder['displayName']}
                    for folder in folders
                ]
            else:
                self._handle_http_error(response, "getting folders")
                return []
        
        except Exception as e:
            self.logger.error(f"Failed to get Outlook folders: {e}")
            return []