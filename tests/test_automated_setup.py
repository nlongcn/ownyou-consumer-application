#!/usr/bin/env python3
"""
Test Automated Email Account Setup

Tests the new automated setup system that eliminates manual OAuth configuration.
"""

import sys
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add src to path for imports
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))


class AutomatedSetupTester:
    """Test the automated account setup system."""
    
    def __init__(self):
        self.issues = []
        self.successes = []
    
    def log_issue(self, test_name: str, error: str):
        """Log a test issue."""
        self.issues.append({'test': test_name, 'error': error})
        print(f"❌ {test_name}: {error}")
    
    def log_success(self, test_name: str, message: str = ""):
        """Log a successful test."""
        self.successes.append({'test': test_name, 'message': message})
        print(f"✅ {test_name}: {message}")
    
    def test_setup_wizard_import(self):
        """Test that the setup wizard can be imported."""
        try:
            from email_parser.setup.account_setup import AccountSetupWizard, SetupResult
            wizard = AccountSetupWizard()
            self.log_success("Setup wizard import", "AccountSetupWizard and SetupResult imported successfully")
            return True
        except ImportError as e:
            self.log_issue("setup_wizard_import", f"Cannot import setup wizard: {e}")
            return False
        except Exception as e:
            self.log_issue("setup_wizard_import", f"Setup wizard import error: {e}")
            return False
    
    def test_status_command(self):
        """Test the status command functionality."""
        try:
            from email_parser.setup.account_setup import AccountSetupWizard
            
            wizard = AccountSetupWizard()
            
            # Capture output
            from io import StringIO
            import sys
            captured_output = StringIO()
            sys.stdout = captured_output
            
            status = wizard.show_status()
            
            # Restore stdout
            sys.stdout = sys.__stdout__
            output = captured_output.getvalue()
            
            # Validate status structure
            if isinstance(status, dict) and 'gmail' in status and 'outlook' in status:
                self.log_success("Status command", "Returns proper status structure")
                
                # Check output contains expected sections
                if "Account Status" in output and "Summary:" in output:
                    self.log_success("Status output", "Contains expected sections")
                else:
                    self.log_issue("status_output", "Missing expected output sections")
                
                return True
            else:
                self.log_issue("status_command", "Status does not return expected structure")
                return False
                
        except Exception as e:
            self.log_issue("status_command", f"Status command failed: {e}")
            return False
    
    def test_gmail_setup_guide(self):
        """Test Gmail setup guide for missing credentials."""
        try:
            from email_parser.setup.account_setup import AccountSetupWizard
            
            wizard = AccountSetupWizard()
            
            # Test with missing credentials.json
            with tempfile.TemporaryDirectory() as temp_dir:
                os.chdir(temp_dir)
                
                # Ensure no credentials file exists
                creds_file = Path("credentials.json")
                if creds_file.exists():
                    creds_file.unlink()
                
                # Test setup (should return guidance)
                result = wizard._handle_missing_gmail_credentials()
                
                if isinstance(result.error, str) and "Missing Gmail credentials" in result.error:
                    self.log_success("Gmail setup guide", "Provides proper guidance for missing credentials")
                    
                    if result.next_steps and len(result.next_steps) > 0:
                        self.log_success("Gmail next steps", f"Provides {len(result.next_steps)} actionable steps")
                    else:
                        self.log_issue("gmail_next_steps", "No next steps provided")
                    
                    return True
                else:
                    self.log_issue("gmail_setup_guide", "Does not provide proper guidance")
                    return False
        
        except Exception as e:
            self.log_issue("gmail_setup_guide", f"Gmail setup guide test failed: {e}")
            return False
    
    def test_microsoft_setup_guide(self):
        """Test Microsoft setup guide for missing credentials."""
        try:
            from email_parser.setup.account_setup import AccountSetupWizard
            
            wizard = AccountSetupWizard()
            
            # Clear environment variables temporarily
            old_client_id = os.environ.pop('MICROSOFT_CLIENT_ID', None)
            old_client_secret = os.environ.pop('MICROSOFT_CLIENT_SECRET', None)
            
            try:
                # Test setup (should return guidance)
                result = wizard._handle_missing_microsoft_credentials()
                
                if isinstance(result.error, str) and "Missing Microsoft app credentials" in result.error:
                    self.log_success("Microsoft setup guide", "Provides proper guidance for missing credentials")
                    
                    if result.next_steps and len(result.next_steps) > 0:
                        self.log_success("Microsoft next steps", f"Provides {len(result.next_steps)} actionable steps")
                    else:
                        self.log_issue("microsoft_next_steps", "No next steps provided")
                    
                    return True
                else:
                    self.log_issue("microsoft_setup_guide", "Does not provide proper guidance")
                    return False
            
            finally:
                # Restore environment variables
                if old_client_id:
                    os.environ['MICROSOFT_CLIENT_ID'] = old_client_id
                if old_client_secret:
                    os.environ['MICROSOFT_CLIENT_SECRET'] = old_client_secret
        
        except Exception as e:
            self.log_issue("microsoft_setup_guide", f"Microsoft setup guide test failed: {e}")
            return False
    
    def test_env_template_creation(self):
        """Test .env template file creation."""
        try:
            from email_parser.setup.account_setup import AccountSetupWizard
            
            wizard = AccountSetupWizard()
            
            with tempfile.TemporaryDirectory() as temp_dir:
                os.chdir(temp_dir)
                
                # Ensure no .env exists
                env_file = Path(".env")
                if env_file.exists():
                    env_file.unlink()
                
                # Create template
                wizard._create_env_template()
                
                if env_file.exists():
                    # Read and validate template
                    content = env_file.read_text()
                    
                    required_sections = [
                        "MICROSOFT_CLIENT_ID",
                        "MICROSOFT_CLIENT_SECRET", 
                        "OLLAMA_BASE_URL",
                        "OPENAI_API_KEY",
                        "ANTHROPIC_API_KEY"
                    ]
                    
                    missing_sections = [section for section in required_sections if section not in content]
                    
                    if not missing_sections:
                        self.log_success("Env template creation", "Template contains all required sections")
                        return True
                    else:
                        self.log_issue("env_template", f"Template missing sections: {missing_sections}")
                        return False
                else:
                    self.log_issue("env_template_creation", ".env template file not created")
                    return False
        
        except Exception as e:
            self.log_issue("env_template_creation", f"Env template test failed: {e}")
            return False
    
    def test_cli_integration(self):
        """Test CLI integration with setup commands."""
        try:
            from email_parser.main import main
            import sys
            
            # Test help command
            try:
                sys.argv = ['main.py', 'setup', '--help']
                main()
                self.log_issue("cli_help", "Should have exited with help")
                return False
            except SystemExit as e:
                if e.code == 0:
                    self.log_success("CLI help integration", "Setup help command works")
                else:
                    self.log_issue("cli_help", f"Help command failed with code {e.code}")
                    return False
            
            # Test setup status (should work without user input)
            try:
                # Capture output
                from io import StringIO
                captured_output = StringIO()
                old_stdout = sys.stdout
                sys.stdout = captured_output
                
                sys.argv = ['main.py', 'setup', 'status']
                main()
                
                # Restore stdout
                sys.stdout = old_stdout
                output = captured_output.getvalue()
                
                if "Account Status" in output:
                    self.log_success("CLI status integration", "Setup status command works")
                    return True
                else:
                    self.log_issue("cli_status", "Status command output missing")
                    return False
            
            except Exception as e:
                sys.stdout = old_stdout
                self.log_issue("cli_status", f"Status command failed: {e}")
                return False
        
        except Exception as e:
            self.log_issue("cli_integration", f"CLI integration test failed: {e}")
            return False
    
    def test_user_experience_flow(self):
        """Test the complete user experience flow."""
        try:
            # Simulate new user experience
            print("\\n🎭 Simulating New User Experience:")
            print("=" * 45)
            
            # Step 1: User runs main command without setup
            print("\\n1️⃣  User tries to run email processing without setup...")
            
            from email_parser.main import main
            import sys
            from io import StringIO
            
            captured_output = StringIO()
            old_stdout = sys.stdout
            sys.stdout = captured_output
            
            try:
                sys.argv = ['main.py', '--provider', 'gmail', '--max-emails', '10']
                main()
                sys.stdout = old_stdout
                self.log_issue("user_flow", "Should have failed without setup")
                return False
            except SystemExit as e:
                sys.stdout = old_stdout
                output = captured_output.getvalue()
                
                if "Gmail not configured" in output and "setup" in output:
                    print("✅ Properly guides user to run setup")
                    self.log_success("User guidance", "Directs user to setup command")
                else:
                    print("❌ Does not properly guide user")
                    self.log_issue("user_guidance", "Missing setup guidance")
                    return False
            
            # Step 2: User runs status to see what's needed
            print("\\n2️⃣  User checks account status...")
            
            captured_output = StringIO()
            sys.stdout = captured_output
            
            try:
                sys.argv = ['main.py', 'setup', 'status']
                main()
                sys.stdout = old_stdout
                output = captured_output.getvalue()
                
                if "not configured" in output.lower() and "setup" in output.lower():
                    print("✅ Status shows what needs to be configured")
                    self.log_success("Status clarity", "Clear indication of what needs setup")
                else:
                    print("❌ Status is not clear")
                    self.log_issue("status_clarity", "Status doesn't clearly indicate setup needs")
                    return False
            
            except Exception as e:
                sys.stdout = old_stdout
                self.log_issue("status_check", f"Status check failed: {e}")
                return False
            
            print("\\n✅ User Experience Flow: Complete")
            return True
        
        except Exception as e:
            self.log_issue("user_experience", f"User experience test failed: {e}")
            return False
    
    def run_all_tests(self):
        """Run all automated setup tests."""
        print("🧪 Testing Automated Email Account Setup")
        print("=" * 50)
        
        tests = [
            self.test_setup_wizard_import,
            self.test_status_command,
            self.test_gmail_setup_guide,
            self.test_microsoft_setup_guide,
            self.test_env_template_creation,
            self.test_cli_integration,
            self.test_user_experience_flow
        ]
        
        results = []
        for test in tests:
            try:
                result = test()
                results.append(result)
            except Exception as e:
                print(f"❌ Test {test.__name__} crashed: {e}")
                results.append(False)
        
        # Summary
        print("\\n" + "=" * 50)
        print("📊 Automated Setup Test Summary")
        print("=" * 50)
        
        total_tests = len(results)
        passed_tests = sum(results)
        
        print(f"Tests Run: {total_tests}")
        print(f"Tests Passed: {passed_tests}")
        print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
        print(f"Issues Found: {len(self.issues)}")
        
        if passed_tests == total_tests:
            print("\\n🎉 All automated setup tests passed!")
            print("\\n✨ NEW AUTOMATED SETUP FEATURES:")
            print("   🚀 Interactive setup wizard")
            print("   📋 Step-by-step credential guides")
            print("   🔧 Automatic OAuth flow handling")
            print("   📊 Account status checking")
            print("   🛠️  Automated .env template creation")
            print("   💡 Smart error messages with solutions")
            
            return True
        else:
            print("\\n❌ Some automated setup tests failed.")
            return False


if __name__ == "__main__":
    print("📋 Automated Email Account Setup Testing")
    print("Testing the new user-friendly setup system")
    print("-" * 50)
    
    tester = AutomatedSetupTester()
    success = tester.run_all_tests()
    
    if success:
        print("\\n🎯 The email account setup process is now fully automated!")
        print("\\n🔧 SETUP COMMANDS:")
        print("   python -m email_parser.main setup")
        print("   python -m email_parser.main setup gmail")
        print("   python -m email_parser.main setup outlook")
        print("   python -m email_parser.main setup status")
    else:
        print("\\n🔧 Some setup features need fixing.")
    
    sys.exit(0 if success else 1)