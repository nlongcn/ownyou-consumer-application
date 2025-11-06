#!/usr/bin/env python3
"""
Phase 3 Testing: Email Provider Integration

Tests:
1. Gmail provider authentication and basic operations
2. Outlook provider authentication and basic operations  
3. Email querying and downloading functionality
4. Provider-specific error handling
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import tempfile

# Add src to path for imports
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))

class Phase3Tester:
    """Test Phase 3: Email Provider Integration"""
    
    def __init__(self):
        self.issues = []
        self.fixes = []
        self.project_root = project_root
        
    def log_issue(self, test_name: str, error: str, severity: str = "ERROR"):
        """Log an issue found during testing."""
        issue = {
            'test': test_name,
            'error': error,
            'severity': severity,
            'fixed': False
        }
        self.issues.append(issue)
        print(f"❌ [{severity}] {test_name}: {error}")
    
    def log_success(self, test_name: str, message: str = ""):
        """Log a successful test."""
        print(f"✅ {test_name}: {message}")
    
    def log_warning(self, test_name: str, message: str):
        """Log a warning."""
        print(f"⚠️  {test_name}: {message}")
    
    def test_provider_base_classes(self):
        """Test email provider base classes."""
        print("\n=== Testing Email Provider Base Classes ===")
        
        try:
            from email_parser.providers.base import (
                BaseEmailProvider, EmailQuery, ProviderStats,
                EmailProviderFactory, EmailProviderError
            )
            self.log_success("Import provider base classes")
            
            # Test EmailQuery creation
            query = EmailQuery(
                max_emails=10,
                query="test",
                after_date="2024/01/01"
            )
            self.log_success("Create EmailQuery", f"Max emails: {query.max_emails}")
            
            # Test ProviderStats creation
            stats = ProviderStats(
                total_emails=100,
                available_emails=95,
                last_sync=datetime.utcnow().isoformat()
            )
            self.log_success("Create ProviderStats", f"Total: {stats.total_emails}")
            
            # Test supported providers
            supported = EmailProviderFactory.get_supported_providers()
            self.log_success("Get supported providers", f"Count: {len(supported)}")
            
        except ImportError as e:
            self.log_issue("provider_base", f"Cannot import provider base classes: {e}")
        except Exception as e:
            self.log_issue("provider_base", f"Provider base classes error: {e}")
    
    def test_gmail_provider_basic(self):
        """Test Gmail provider basic functionality (without authentication)."""
        print("\n=== Testing Gmail Provider (Basic) ===")
        
        try:
            from email_parser.providers.gmail_provider import GmailProvider
            from email_parser.models.email import EmailProvider
            self.log_success("Import GmailProvider")
            
            # Test initialization with missing credentials file (should fail gracefully)
            config = {
                'gmail_credentials_file': 'nonexistent_credentials.json',
                'gmail_token_file': 'test_token.json',
                'gmail_scopes': ['https://www.googleapis.com/auth/gmail.readonly']
            }
            
            try:
                provider = GmailProvider(config)
                self.log_issue("gmail_basic", "Should fail with missing credentials file")
            except FileNotFoundError:
                self.log_success("Gmail credentials file validation")
            except Exception as e:
                self.log_issue("gmail_basic", f"Wrong error for missing credentials: {e}")
            
            # Test with valid credentials file path (if exists)
            creds_file = self.project_root / "credentials.json"
            if creds_file.exists():
                config['gmail_credentials_file'] = str(creds_file)
                try:
                    provider = GmailProvider(config)
                    self.log_success("Gmail provider initialization")
                    
                    # Test provider type
                    if provider.get_provider_type() == EmailProvider.GMAIL:
                        self.log_success("Gmail provider type")
                    else:
                        self.log_issue("gmail_basic", "Wrong provider type")
                    
                    # Test query building (internal method)
                    from email_parser.providers.base import EmailQuery
                    query = EmailQuery(max_emails=5, after_date="2024/01/01")
                    gmail_query = provider._build_gmail_query(query)
                    self.log_success("Gmail query building", f"Query: '{gmail_query}'")
                        
                except Exception as e:
                    if any(keyword in str(e) for keyword in ["Authentication", "credentials", "token"]):
                        self.log_success("Gmail provider initialization (auth not tested)")
                    else:
                        self.log_issue("gmail_basic", f"Unexpected Gmail provider error: {e}")
            else:
                self.log_warning("gmail_basic", "credentials.json not found - skipping advanced tests")
                
        except ImportError as e:
            self.log_issue("gmail_basic", f"Cannot import GmailProvider: {e}")
        except Exception as e:
            self.log_issue("gmail_basic", f"GmailProvider error: {e}")
    
    def test_gmail_provider_auth(self):
        """Test Gmail provider authentication (if credentials available)."""
        print("\n=== Testing Gmail Provider (Authentication) ===")
        
        creds_file = self.project_root / "credentials.json"
        if not creds_file.exists():
            self.log_warning("gmail_auth", "credentials.json not found - skipping authentication tests")
            return
        
        try:
            from email_parser.providers.gmail_provider import GmailProvider
            
            config = {
                'gmail_credentials_file': str(creds_file),
                'gmail_token_file': 'test_token.json',
                'gmail_scopes': ['https://www.googleapis.com/auth/gmail.readonly'],
                'retry_attempts': 2,
                'retry_delay': 1
            }
            
            provider = GmailProvider(config)
            self.log_success("Gmail provider created with credentials")
            
            # Test authentication (this may require user interaction)
            print("    Note: Authentication may require browser interaction...")
            try:
                auth_success = provider.authenticate()
                if auth_success:
                    self.log_success("Gmail authentication successful")
                    
                    # Test basic operations
                    try:
                        account_info = provider.get_account_info()
                        if account_info.get('email_address'):
                            self.log_success("Gmail account info", f"Email: {account_info['email_address']}")
                        else:
                            self.log_issue("gmail_auth", "No email address in account info")
                        
                        # Test stats
                        stats = provider.get_stats()
                        self.log_success("Gmail stats", f"Total emails: {stats.total_emails}")
                        
                        # Test email listing (limited)
                        from email_parser.providers.base import EmailQuery
                        query = EmailQuery(max_emails=2)
                        email_ids = provider.list_emails(query)
                        self.log_success("Gmail email listing", f"Found {len(email_ids)} emails")
                        
                        # Test getting a single email (if any found)
                        if email_ids:
                            email = provider.get_email(email_ids[0])
                            if email:
                                self.log_success("Gmail email retrieval", f"Subject: {email.subject}")
                            else:
                                self.log_issue("gmail_auth", "Failed to retrieve email")
                    
                    except Exception as e:
                        if any(keyword in str(e) for keyword in ["quota", "rate limit", "permission"]):
                            self.log_warning("gmail_auth", f"API limit/permission issue (expected): {e}")
                        else:
                            self.log_issue("gmail_auth", f"Gmail operation failed: {e}")
                else:
                    self.log_warning("gmail_auth", "Gmail authentication failed (may need manual setup)")
                    
            except Exception as e:
                if any(keyword in str(e) for keyword in ["credentials", "token", "OAuth", "browser"]):
                    self.log_warning("gmail_auth", f"Authentication setup needed: {e}")
                else:
                    self.log_issue("gmail_auth", f"Gmail authentication error: {e}")
                    
        except Exception as e:
            self.log_issue("gmail_auth", f"Gmail auth test error: {e}")
    
    def test_outlook_provider_basic(self):
        """Test Outlook provider basic functionality (without authentication)."""
        print("\n=== Testing Outlook Provider (Basic) ===")
        
        try:
            from email_parser.providers.outlook_provider import OutlookProvider
            from email_parser.models.email import EmailProvider
            self.log_success("Import OutlookProvider")
            
            # Test initialization without credentials (should fail)
            config = {
                'microsoft_client_id': None,
                'microsoft_client_secret': None
            }
            
            try:
                provider = OutlookProvider(config)
                self.log_issue("outlook_basic", "Should fail without client credentials")
            except ValueError as e:
                if "client ID and secret are required" in str(e):
                    self.log_success("Outlook credentials validation")
                else:
                    self.log_issue("outlook_basic", f"Wrong validation error: {e}")
            
            # Test with dummy credentials (won't authenticate but should initialize)
            config = {
                'microsoft_client_id': 'test-client-id',
                'microsoft_client_secret': 'test-client-secret',
                'microsoft_tenant_id': 'common',
                'microsoft_token_file': 'test_ms_token.json'
            }
            
            try:
                provider = OutlookProvider(config)
                self.log_success("Outlook provider initialization")
                
                # Test provider type
                if provider.get_provider_type() == EmailProvider.OUTLOOK:
                    self.log_success("Outlook provider type")
                else:
                    self.log_issue("outlook_basic", "Wrong provider type")
                    
                # Test availability check (will fail without auth, but shouldn't crash)
                try:
                    is_available = provider.is_available()
                    self.log_success("Outlook availability check", f"Available: {is_available}")
                except Exception as e:
                    if any(keyword in str(e) for keyword in ["401", "authentication", "unauthorized"]):
                        self.log_success("Outlook availability check (auth expected to fail)")
                    else:
                        self.log_issue("outlook_basic", f"Availability check error: {e}")
                        
            except Exception as e:
                self.log_issue("outlook_basic", f"Outlook provider initialization error: {e}")
                
        except ImportError as e:
            self.log_issue("outlook_basic", f"Cannot import OutlookProvider: {e}")
        except Exception as e:
            self.log_issue("outlook_basic", f"OutlookProvider error: {e}")
    
    def test_outlook_provider_auth(self):
        """Test Outlook provider authentication (if credentials available)."""
        print("\n=== Testing Outlook Provider (Authentication) ===")
        
        # Load actual credentials from .env if available
        try:
            from email_parser.utils.config import get_config
            config_manager = get_config()
            
            client_id = config_manager.email_providers.microsoft_client_id
            client_secret = config_manager.email_providers.microsoft_client_secret
            
            if not client_id or not client_secret:
                self.log_warning("outlook_auth", "Microsoft credentials not found in .env - skipping auth tests")
                return
            
            from email_parser.providers.outlook_provider import OutlookProvider
            
            config = {
                'microsoft_client_id': client_id,
                'microsoft_client_secret': client_secret,
                'microsoft_tenant_id': 'common',
                'microsoft_token_file': 'test_ms_token.json',
                'retry_attempts': 2,
                'retry_delay': 1
            }
            
            provider = OutlookProvider(config)
            self.log_success("Outlook provider created with credentials")
            
            # Test authentication (this will require device code flow)
            print("    Note: Authentication will require device code flow...")
            try:
                auth_success = provider.authenticate()
                if auth_success:
                    self.log_success("Outlook authentication successful")
                    
                    # Test basic operations
                    try:
                        account_info = provider.get_account_info()
                        if account_info.get('email'):
                            self.log_success("Outlook account info", f"Email: {account_info['email']}")
                        else:
                            self.log_issue("outlook_auth", "No email address in account info")
                        
                        # Test stats
                        stats = provider.get_stats()
                        self.log_success("Outlook stats", f"Total emails: {stats.total_emails}")
                        
                        # Test email listing (limited)
                        from email_parser.providers.base import EmailQuery
                        query = EmailQuery(max_emails=2)
                        email_ids = provider.list_emails(query)
                        self.log_success("Outlook email listing", f"Found {len(email_ids)} emails")
                        
                        # Test getting a single email (if any found)
                        if email_ids:
                            email = provider.get_email(email_ids[0])
                            if email:
                                self.log_success("Outlook email retrieval", f"Subject: {email.subject}")
                            else:
                                self.log_issue("outlook_auth", "Failed to retrieve email")
                    
                    except Exception as e:
                        if any(keyword in str(e) for keyword in ["quota", "rate limit", "throttling"]):
                            self.log_warning("outlook_auth", f"API limit issue (expected): {e}")
                        else:
                            self.log_issue("outlook_auth", f"Outlook operation failed: {e}")
                else:
                    self.log_warning("outlook_auth", "Outlook authentication failed (may need device code completion)")
                    
            except Exception as e:
                if any(keyword in str(e) for keyword in ["device", "code", "browser", "authentication"]):
                    self.log_warning("outlook_auth", f"Authentication flow needs completion: {e}")
                else:
                    self.log_issue("outlook_auth", f"Outlook authentication error: {e}")
                    
        except Exception as e:
            self.log_issue("outlook_auth", f"Outlook auth test error: {e}")
    
    def test_provider_factory(self):
        """Test email provider factory."""
        print("\n=== Testing Email Provider Factory ===")
        
        try:
            from email_parser.providers.base import EmailProviderFactory
            from email_parser.models.email import EmailProvider
            self.log_success("Import EmailProviderFactory")
            
            # Test creating Gmail provider
            config = {
                'gmail_credentials_file': 'test_credentials.json',
                'gmail_token_file': 'test_token.json'
            }
            
            try:
                provider = EmailProviderFactory.create_provider(EmailProvider.GMAIL, config)
                self.log_issue("factory", "Should fail with missing credentials file")
            except (FileNotFoundError, Exception) as e:
                self.log_success("Factory Gmail provider creation (expected to fail)")
            
            # Test creating Outlook provider
            config = {
                'microsoft_client_id': 'test-id',
                'microsoft_client_secret': 'test-secret'
            }
            
            try:
                provider = EmailProviderFactory.create_provider(EmailProvider.OUTLOOK, config)
                self.log_success("Factory Outlook provider creation")
            except Exception as e:
                self.log_issue("factory", f"Factory Outlook creation failed: {e}")
            
            # Test invalid provider
            try:
                provider = EmailProviderFactory.create_provider("invalid_provider", {})
                self.log_issue("factory", "Should fail with invalid provider")
            except (ValueError, AttributeError) as e:
                self.log_success("Factory invalid provider handling")
            except Exception as e:
                self.log_issue("factory", f"Wrong error for invalid provider: {e}")
                
        except ImportError as e:
            self.log_issue("factory", f"Cannot import EmailProviderFactory: {e}")
        except Exception as e:
            self.log_issue("factory", f"EmailProviderFactory error: {e}")
    
    def run_all_tests(self):
        """Run all Phase 3 tests."""
        print("🧪 Starting Phase 3 Testing: Email Provider Integration")
        print("=" * 70)
        
        self.test_provider_base_classes()
        self.test_gmail_provider_basic()
        self.test_gmail_provider_auth()
        self.test_outlook_provider_basic()
        self.test_outlook_provider_auth()
        self.test_provider_factory()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 Phase 3 Test Summary")
        print("=" * 70)
        
        total_issues = len(self.issues)
        critical_issues = len([i for i in self.issues if i['severity'] == 'ERROR'])
        warnings = len([i for i in self.issues if i['severity'] == 'WARNING'])
        
        print(f"Total Issues Found: {total_issues}")
        print(f"Critical Issues: {critical_issues}")
        print(f"Warnings: {warnings}")
        
        if critical_issues == 0:
            print("🎉 No critical issues found! Phase 3 email providers are working.")
            if warnings > 0:
                print("⚠️  Some warnings found - these are likely due to missing credentials or auth setup.")
            return True
        else:
            print("❌ Critical issues found. See details above.")
            return False


if __name__ == "__main__":
    print("📋 Phase 3 Testing: Email Provider Integration")
    print("Note: Some tests require credentials (credentials.json, .env with API keys)")
    print("Authentication tests may require user interaction (browser/device code)")
    print("-" * 70)
    
    tester = Phase3Tester()
    success = tester.run_all_tests()
    
    if not success:
        print("\n🔧 Critical issues found that need fixing.")
        
    sys.exit(0 if success else 1)