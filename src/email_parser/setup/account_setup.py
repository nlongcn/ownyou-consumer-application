#!/usr/bin/env python3
"""
Automated Email Account Setup

Provides guided setup for Gmail and Outlook/Microsoft accounts with automatic
OAuth flows and credential management.
"""

import json
import os
import webbrowser
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import tempfile
import time
from dataclasses import dataclass

from ..utils.logging import get_logger
from ..utils.config import get_config
from ..providers.base import EmailProviderFactory
from ..models.email import EmailProvider


@dataclass
class SetupResult:
    """Result of account setup process."""
    success: bool
    provider: str
    account_info: Dict[str, Any]
    error: Optional[str] = None
    next_steps: List[str] = None


class AccountSetupWizard:
    """Interactive wizard for setting up email accounts."""
    
    def __init__(self):
        """Initialize the setup wizard."""
        self.logger = get_logger("AccountSetup")
        self.config = get_config()
    
    def run_setup(self, provider_type: str = None) -> SetupResult:
        """Run the complete setup process.
        
        Args:
            provider_type: Optional provider type to setup directly
            
        Returns:
            SetupResult with outcome
        """
        print("🚀 Email Parser - Account Setup Wizard")
        print("=" * 50)
        
        if not provider_type:
            provider_type = self._select_provider()
        
        if provider_type.lower() == 'gmail':
            return self._setup_gmail()
        elif provider_type.lower() in ['outlook', 'hotmail', 'microsoft']:
            return self._setup_microsoft()
        elif provider_type.lower() == 'both':
            return self._setup_both_accounts()
        else:
            return SetupResult(
                success=False,
                provider=provider_type,
                account_info={},
                error=f"Unsupported provider: {provider_type}"
            )
    
    def _select_provider(self) -> str:
        """Interactive provider selection."""
        print("\\n📧 Select your email provider:")
        print("1. Gmail (Google)")
        print("2. Outlook/Hotmail (Microsoft)")
        print("3. Both (setup multiple accounts)")
        
        while True:
            try:
                choice = input("\\nEnter your choice (1-3): ").strip()
                if choice == '1':
                    return 'gmail'
                elif choice == '2':
                    return 'outlook'
                elif choice == '3':
                    return 'both'
                else:
                    print("❌ Invalid choice. Please enter 1, 2, or 3.")
            except KeyboardInterrupt:
                print("\\n\\n👋 Setup cancelled by user.")
                exit(0)
    
    def _setup_both_accounts(self) -> SetupResult:
        """Setup both Gmail and Microsoft accounts."""
        print("\\n🔧 Setting up Multiple Accounts")
        print("=" * 40)
        print("📝 We'll setup Gmail first, then Outlook/Microsoft.")
        
        results = []
        
        # Setup Gmail first
        print("\\n" + "=" * 50)
        print("🎯 STEP 1: Gmail Account Setup")
        print("=" * 50)
        
        gmail_result = self._setup_gmail()
        results.append(gmail_result)
        
        if gmail_result.success:
            print("\\n✅ Gmail setup completed successfully!")
        else:
            print("\\n⚠️  Gmail setup had issues, but continuing with Outlook...")
        
        # Pause before Microsoft setup
        print("\\n" + "-" * 50)
        print("📝 Ready to setup your Microsoft/Outlook account...")
        
        try:
            input("Press Enter to continue with Outlook setup or Ctrl+C to stop here: ")
        except KeyboardInterrupt:
            print("\\n\\n👋 Multi-account setup stopped after Gmail.")
            return gmail_result  # Return Gmail result if user stops
        
        # Setup Microsoft
        print("\\n" + "=" * 50)
        print("🎯 STEP 2: Microsoft/Outlook Account Setup")
        print("=" * 50)
        
        microsoft_result = self._setup_microsoft()
        results.append(microsoft_result)
        
        # Summary of both setups
        print("\\n" + "=" * 60)
        print("📊 MULTI-ACCOUNT SETUP SUMMARY")
        print("=" * 60)
        
        gmail_status = "✅ Success" if gmail_result.success else "❌ Failed"
        microsoft_status = "✅ Success" if microsoft_result.success else "❌ Failed"
        
        print(f"Gmail Account: {gmail_status}")
        if gmail_result.success and gmail_result.account_info.get('email_address'):
            print(f"   📧 Email: {gmail_result.account_info['email_address']}")
        
        print(f"Microsoft Account: {microsoft_status}")
        if microsoft_result.success and microsoft_result.account_info.get('email'):
            print(f"   📧 Email: {microsoft_result.account_info['email']}")
        
        # Determine overall success
        both_successful = gmail_result.success and microsoft_result.success
        at_least_one = gmail_result.success or microsoft_result.success
        
        if both_successful:
            print("\\n🎉 Both accounts setup successfully!")
            next_steps = [
                "Both Gmail and Outlook accounts are ready!",
                "Gmail: python run.py --provider gmail --max-emails 10",
                "Outlook: python run.py --provider outlook --max-emails 10",
                "Check status anytime: python setup_accounts.py status"
            ]
        elif at_least_one:
            working_provider = "Gmail" if gmail_result.success else "Outlook"
            provider_cmd = "gmail" if gmail_result.success else "outlook"
            print(f"\\n⚠️  {working_provider} setup successful, but the other had issues.")
            next_steps = [
                f"{working_provider} account is ready to use!",
                f"Run: python run.py --provider {provider_cmd} --max-emails 10",
                "Fix the other account: python setup_accounts.py <provider>",
                "Check status: python setup_accounts.py status"
            ]
        else:
            print("\\n❌ Both account setups had issues.")
            next_steps = [
                "Both setups encountered problems",
                "Try individual setup: python setup_accounts.py gmail", 
                "Try individual setup: python setup_accounts.py outlook",
                "Check status: python setup_accounts.py status"
            ]
        
        # Return combined result
        return SetupResult(
            success=both_successful,
            provider='both',
            account_info={
                'gmail': gmail_result.account_info if gmail_result.success else {},
                'microsoft': microsoft_result.account_info if microsoft_result.success else {},
                'summary': f"Gmail: {'✅' if gmail_result.success else '❌'}, "
                          f"Outlook: {'✅' if microsoft_result.success else '❌'}"
            },
            error=None if both_successful else "One or more account setups failed",
            next_steps=next_steps
        )
    
    def _setup_gmail(self) -> SetupResult:
        """Setup Gmail account with automated OAuth flow."""
        print("\\n🔧 Setting up Gmail Account")
        print("-" * 30)
        
        try:
            # Check if credentials.json exists
            creds_file = Path("credentials.json")
            if not creds_file.exists():
                print("\\n⚠️  Gmail credentials file not found!")
                return self._handle_missing_gmail_credentials()
            
            print("✅ Found Gmail credentials file")
            
            # Test authentication
            print("\\n🔐 Starting Gmail authentication...")
            print("📝 This will open your web browser for Google OAuth.")
            print("📝 Please follow the prompts to authorize the application.")
            
            input("\\nPress Enter to continue or Ctrl+C to cancel...")
            
            # Create provider and attempt authentication
            config = {
                'gmail_credentials_file': str(creds_file),
                'gmail_token_file': 'token.json',
                'gmail_scopes': ['https://www.googleapis.com/auth/gmail.readonly'],
                'retry_attempts': 3,
                'retry_delay': 2,
            }
            
            provider = EmailProviderFactory.create_provider(EmailProvider.GMAIL, config)
            
            # Attempt authentication
            auth_success = provider.authenticate()
            
            if auth_success:
                # Get account info
                account_info = provider.get_account_info()
                stats = provider.get_stats()
                
                print("\\n✅ Gmail setup successful!")
                print(f"📧 Email: {account_info.get('email_address', 'Unknown')}")
                print(f"📊 Total emails: {stats.total_emails}")
                
                return SetupResult(
                    success=True,
                    provider='gmail',
                    account_info=account_info,
                    next_steps=[
                        "Your Gmail account is ready to use!",
                        f"Run: python -m email_parser.main --provider gmail --max-emails 10",
                        "Check the token.json file has been created for future use"
                    ]
                )
            else:
                return SetupResult(
                    success=False,
                    provider='gmail',
                    account_info={},
                    error="Gmail authentication failed. Please check your credentials and try again."
                )
        
        except Exception as e:
            self.logger.error(f"Gmail setup failed: {str(e)}")
            return SetupResult(
                success=False,
                provider='gmail',
                account_info={},
                error=f"Gmail setup error: {e}"
            )
    
    def _handle_missing_gmail_credentials(self) -> SetupResult:
        """Handle missing Gmail credentials with guided setup."""
        print("\\n📋 Gmail Credentials Setup Required")
        print("=" * 40)
        print("""
To use Gmail, you need to create a Google Cloud project and download credentials:

📝 STEP-BY-STEP GUIDE:

1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" 
   - Click "Enable"

4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop application"
   - Name it "Email Parser"
   - Download the JSON file

5. Save the downloaded file as "credentials.json" in this directory

6. Re-run the setup: python -m email_parser.main setup gmail
""")
        
        # Option to automatically open browser
        try:
            choice = input("\\n🌐 Open Google Cloud Console now? (y/n): ").strip().lower()
            if choice in ['y', 'yes']:
                webbrowser.open('https://console.cloud.google.com/')
                print("✅ Opened Google Cloud Console in your browser")
        except Exception as e:
            print(f"⚠️  Could not open browser: {e}")
        
        return SetupResult(
            success=False,
            provider='gmail',
            account_info={},
            error="Missing Gmail credentials file",
            next_steps=[
                "Follow the guide above to create Gmail credentials",
                "Save credentials.json in the current directory", 
                "Re-run: python -m email_parser.main setup gmail"
            ]
        )
    
    def _setup_microsoft(self) -> SetupResult:
        """Setup Microsoft/Outlook account with automated device code flow."""
        print("\\n🔧 Setting up Microsoft/Outlook Account")
        print("-" * 40)
        
        try:
            # Check for existing credentials in .env
            client_id = os.getenv('MICROSOFT_CLIENT_ID')
            client_secret = os.getenv('MICROSOFT_CLIENT_SECRET')
            
            if not client_id or not client_secret:
                return self._handle_missing_microsoft_credentials()
            
            # Check if credentials are placeholder values
            if (client_id == "your_microsoft_client_id_here" or 
                client_secret == "your_microsoft_client_secret_here"):
                print("❌ Found placeholder Microsoft credentials in .env file")
                print("   Please replace them with real values from Azure app registration")
                return self._handle_missing_microsoft_credentials()
            
            print("✅ Found Microsoft credentials in environment")
            
            # Test authentication with device code flow
            print("\\n🔐 Starting Microsoft authentication...")
            print("📝 This will use device code flow - no browser popup needed!")
            print("📝 You'll get a code to enter at https://microsoft.com/devicelogin")
            
            input("\\nPress Enter to continue or Ctrl+C to cancel...")
            
            # Create provider and attempt authentication
            config = {
                'microsoft_client_id': client_id,
                'microsoft_client_secret': client_secret,
                'microsoft_tenant_id': 'common',
                'microsoft_token_file': 'ms_token.json',
                'retry_attempts': 3,
                'retry_delay': 2,
            }
            
            provider = EmailProviderFactory.create_provider(EmailProvider.OUTLOOK, config)
            
            # Attempt authentication
            print("\\n🔄 Authenticating with Microsoft...")
            auth_success = provider.authenticate()
            
            if auth_success:
                # Get account info
                account_info = provider.get_account_info()
                stats = provider.get_stats()
                
                print("\\n✅ Microsoft/Outlook setup successful!")
                print(f"📧 Email: {account_info.get('email', 'Unknown')}")
                print(f"👤 Name: {account_info.get('display_name', 'Unknown')}")
                print(f"📊 Inbox emails: {stats.total_emails}")
                
                return SetupResult(
                    success=True,
                    provider='outlook',
                    account_info=account_info,
                    next_steps=[
                        "Your Microsoft/Outlook account is ready to use!",
                        f"Run: python -m email_parser.main --provider outlook --max-emails 10",
                        "Check ms_token.json has been created for future use"
                    ]
                )
            else:
                return SetupResult(
                    success=False,
                    provider='outlook',
                    account_info={},
                    error="Microsoft authentication failed. Please check your credentials and try again."
                )
        
        except Exception as e:
            self.logger.error(f"Microsoft setup failed: {str(e)}")
            return SetupResult(
                success=False,
                provider='outlook',
                account_info={},
                error=f"Microsoft setup error: {e}"
            )
    
    def _handle_missing_microsoft_credentials(self) -> SetupResult:
        """Handle missing Microsoft credentials with guided setup."""
        print("\\n📋 Microsoft App Registration Setup Required")
        print("=" * 45)
        print("""
To use Outlook/Hotmail, you need to register an app in Azure:

📝 STEP-BY-STEP GUIDE:

1. Go to: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps
2. Click "New registration"
3. Fill in details:
   - Name: "Email Parser"
   - Supported account types: "Personal Microsoft accounts only"
   - Redirect URI: Leave blank for now

4. After creation, note down:
   - Application (client) ID
   - Generate a client secret in "Certificates & secrets"

5. Add API permissions:
   - Click "API permissions" 
   - Add "Microsoft Graph" > "Delegated permissions"
   - Add: "Mail.Read" and "User.Read"

6. Create/update your .env file with:
   MICROSOFT_CLIENT_ID=your_client_id_here
   MICROSOFT_CLIENT_SECRET=your_client_secret_here

7. Re-run setup: python -m email_parser.main setup outlook
""")
        
        # Option to automatically open browser
        try:
            choice = input("\\n🌐 Open Azure Portal now? (y/n): ").strip().lower()
            if choice in ['y', 'yes']:
                webbrowser.open('https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade')
                print("✅ Opened Azure Portal in your browser")
        except Exception as e:
            print(f"⚠️  Could not open browser: {e}")
        
        # Option to create .env template
        try:
            choice = input("\\n📝 Create .env template file? (y/n): ").strip().lower()
            if choice in ['y', 'yes']:
                self._create_env_template()
        except Exception as e:
            print(f"⚠️  Could not create template: {e}")
        
        return SetupResult(
            success=False,
            provider='outlook',
            account_info={},
            error="Missing Microsoft app credentials",
            next_steps=[
                "Follow the guide above to register a Microsoft app",
                "Update .env file with your credentials",
                "Re-run: python -m email_parser.main setup outlook"
            ]
        )
    
    def _create_env_template(self):
        """Create a .env template file."""
        env_template = """# Email Parser Configuration

# Microsoft/Outlook Credentials (from Azure App Registration)
MICROSOFT_CLIENT_ID=your_client_id_here
MICROSOFT_CLIENT_SECRET=your_client_secret_here
MICROSOFT_TENANT_ID=common

# LLM Provider Settings
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# OpenAI (if using)
# OPENAI_API_KEY=your_openai_key_here
# OPENAI_MODEL=gpt-4

# Claude/Anthropic (if using)  
# ANTHROPIC_API_KEY=your_anthropic_key_here
# ANTHROPIC_MODEL=claude-3-haiku-20240307

# Processing Settings
MAX_EMAILS=100
BATCH_SIZE=50
OUTPUT_FORMAT=csv

# Logging
LOG_LEVEL=INFO
LOG_FILE=email_parser.log
"""
        
        env_path = Path(".env")
        if not env_path.exists():
            with open(env_path, 'w') as f:
                f.write(env_template)
            print(f"✅ Created .env template: {env_path}")
            print("📝 Please edit this file with your actual credentials")
        else:
            print("📝 .env file already exists - not overwriting")
    
    def test_account(self, provider_type: str) -> SetupResult:
        """Test an existing account setup.
        
        Args:
            provider_type: Provider to test
            
        Returns:
            SetupResult with test outcome
        """
        print(f"\\n🧪 Testing {provider_type.title()} Account")
        print("-" * 30)
        
        try:
            if provider_type.lower() == 'gmail':
                provider_enum = EmailProvider.GMAIL
                config = {
                    'gmail_credentials_file': 'credentials.json',
                    'gmail_token_file': 'token.json',
                    'gmail_scopes': ['https://www.googleapis.com/auth/gmail.readonly'],
                }
            elif provider_type.lower() in ['outlook', 'microsoft']:
                provider_enum = EmailProvider.OUTLOOK
                config = {
                    'microsoft_client_id': os.getenv('MICROSOFT_CLIENT_ID'),
                    'microsoft_client_secret': os.getenv('MICROSOFT_CLIENT_SECRET'),
                    'microsoft_tenant_id': 'common',
                    'microsoft_token_file': 'ms_token.json',
                }
            else:
                return SetupResult(
                    success=False,
                    provider=provider_type,
                    account_info={},
                    error=f"Unknown provider: {provider_type}"
                )
            
            # Create provider
            provider = EmailProviderFactory.create_provider(provider_enum, config)
            
            # Test authentication
            if provider.is_authenticated():
                print("✅ Account is authenticated")
                
                # Get account info
                account_info = provider.get_account_info()
                stats = provider.get_stats()
                
                print(f"📧 Account: {account_info.get('email_address') or account_info.get('email')}")
                print(f"📊 Total emails: {stats.total_emails}")
                
                # Test email listing
                from ..providers.base import EmailQuery
                test_query = EmailQuery(max_emails=1)
                email_ids = provider.list_emails(test_query)
                
                if email_ids:
                    print("✅ Email access working")
                    print(f"📬 Can access {len(email_ids)} emails")
                else:
                    print("⚠️  No emails found (may be due to filters)")
                
                return SetupResult(
                    success=True,
                    provider=provider_type,
                    account_info=account_info
                )
            else:
                return SetupResult(
                    success=False,
                    provider=provider_type,
                    account_info={},
                    error=f"{provider_type} account is not authenticated. Run setup first."
                )
        
        except Exception as e:
            self.logger.error(f"{provider_type} account test failed: {str(e)}")
            return SetupResult(
                success=False,
                provider=provider_type,
                account_info={},
                error=f"Account test error: {e}"
            )
    
    def show_status(self) -> Dict[str, Any]:
        """Show status of all configured accounts."""
        print("\\n📊 Email Parser - Account Status")
        print("=" * 35)
        
        status = {
            'gmail': {'configured': False, 'authenticated': False, 'error': None},
            'outlook': {'configured': False, 'authenticated': False, 'error': None}
        }
        
        # Check Gmail
        try:
            if Path('credentials.json').exists() and Path('token.json').exists():
                status['gmail']['configured'] = True
                
                # Test authentication
                config = {
                    'gmail_credentials_file': 'credentials.json',
                    'gmail_token_file': 'token.json',
                    'gmail_scopes': ['https://www.googleapis.com/auth/gmail.readonly'],
                }
                provider = EmailProviderFactory.create_provider(EmailProvider.GMAIL, config)
                
                if provider.is_authenticated():
                    status['gmail']['authenticated'] = True
                    account_info = provider.get_account_info()
                    print(f"✅ Gmail: {account_info.get('email_address', 'Connected')}")
                else:
                    print("⚠️  Gmail: Configured but not authenticated")
            else:
                print("❌ Gmail: Not configured")
                
        except Exception as e:
            status['gmail']['error'] = str(e)
            print(f"❌ Gmail: Error - {e}")
        
        # Check Outlook
        try:
            client_id = os.getenv('MICROSOFT_CLIENT_ID')
            client_secret = os.getenv('MICROSOFT_CLIENT_SECRET')
            
            if client_id and client_secret:
                status['outlook']['configured'] = True
                
                if Path('ms_token.json').exists():
                    # Test authentication
                    config = {
                        'microsoft_client_id': client_id,
                        'microsoft_client_secret': client_secret,
                        'microsoft_tenant_id': 'common',
                        'microsoft_token_file': 'ms_token.json',
                    }
                    provider = EmailProviderFactory.create_provider(EmailProvider.OUTLOOK, config)
                    
                    if provider.is_authenticated():
                        status['outlook']['authenticated'] = True
                        account_info = provider.get_account_info()
                        print(f"✅ Outlook: {account_info.get('email', 'Connected')}")
                    else:
                        print("⚠️  Outlook: Configured but not authenticated")
                else:
                    print("⚠️  Outlook: Configured but never authenticated")
            else:
                print("❌ Outlook: Not configured (missing credentials)")
                
        except Exception as e:
            status['outlook']['error'] = str(e)
            print(f"❌ Outlook: Error - {e}")
        
        # Summary
        configured_count = sum(1 for s in status.values() if s['configured'])
        authenticated_count = sum(1 for s in status.values() if s['authenticated'])
        
        print(f"\\n📈 Summary: {configured_count}/2 configured, {authenticated_count}/2 authenticated")
        
        if authenticated_count == 0:
            print("\\n💡 Run setup to configure accounts:")
            print("   python -m email_parser.main setup")
        
        return status


def main_setup_cli():
    """Main entry point for setup CLI."""
    import sys
    
    if len(sys.argv) < 2:
        wizard = AccountSetupWizard()
        wizard.run_setup()
    else:
        command = sys.argv[1].lower()
        wizard = AccountSetupWizard()
        
        if command == 'gmail':
            result = wizard._setup_gmail()
        elif command in ['outlook', 'microsoft']:
            result = wizard._setup_microsoft()
        elif command == 'status':
            wizard.show_status()
            return
        elif command == 'test':
            if len(sys.argv) > 2:
                result = wizard.test_account(sys.argv[2])
            else:
                print("Usage: python -m email_parser.main setup test <provider>")
                return
        else:
            print(f"Unknown command: {command}")
            print("Available: gmail, outlook, status, test")
            return
        
        # Show result
        if hasattr(result, 'success'):
            if result.success:
                print(f"\\n🎉 {result.provider.title()} setup completed successfully!")
                if result.next_steps:
                    print("\\n📋 Next steps:")
                    for step in result.next_steps:
                        print(f"   • {step}")
            else:
                print(f"\\n❌ {result.provider.title()} setup failed: {result.error}")
                if result.next_steps:
                    print("\\n📋 What to do:")
                    for step in result.next_steps:
                        print(f"   • {step}")


if __name__ == "__main__":
    main_setup_cli()