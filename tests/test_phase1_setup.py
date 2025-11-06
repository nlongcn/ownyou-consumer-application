#!/usr/bin/env python3
"""
Phase 1 Testing: Project Setup and Basic Structure

Tests:
1. Basic imports and module structure
2. Requirements installation
3. Project structure validation
4. Environment configuration loading
"""

import sys
import os
import subprocess
from pathlib import Path
import importlib.util

# Add src to path for imports
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))

class Phase1Tester:
    """Test Phase 1: Project Setup"""
    
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
    
    def log_fix(self, issue_index: int, fix_description: str):
        """Log a fix for an issue."""
        if 0 <= issue_index < len(self.issues):
            self.issues[issue_index]['fixed'] = True
            self.fixes.append(fix_description)
            print(f"🔧 FIXED: {fix_description}")
    
    def test_project_structure(self):
        """Test that all expected directories and files exist."""
        print("\n=== Testing Project Structure ===")
        
        expected_dirs = [
            "src",
            "src/email_parser",
            "src/email_parser/providers",
            "src/email_parser/llm_clients", 
            "src/email_parser/models",
            "src/email_parser/utils",
            "tests",
            "tests/unit",
            "tests/integration",
        ]
        
        expected_files = [
            "requirements.txt",
            ".env.example",
            ".gitignore",
            "README.md",
            "src/email_parser/__init__.py",
            "src/email_parser/providers/__init__.py",
            "src/email_parser/llm_clients/__init__.py",
            "src/email_parser/models/__init__.py",
            "src/email_parser/utils/__init__.py",
        ]
        
        # Test directories
        for dir_path in expected_dirs:
            full_path = self.project_root / dir_path
            if not full_path.exists():
                self.log_issue("project_structure", f"Missing directory: {dir_path}")
            else:
                self.log_success(f"Directory exists: {dir_path}")
        
        # Test files
        for file_path in expected_files:
            full_path = self.project_root / file_path
            if not full_path.exists():
                self.log_issue("project_structure", f"Missing file: {file_path}")
            else:
                self.log_success(f"File exists: {file_path}")
    
    def test_basic_imports(self):
        """Test that basic imports work."""
        print("\n=== Testing Basic Imports ===")
        
        # Test importing main package
        try:
            import email_parser
            self.log_success("Import email_parser", f"Version: {getattr(email_parser, '__version__', 'N/A')}")
        except ImportError as e:
            self.log_issue("basic_imports", f"Cannot import email_parser: {e}")
        except Exception as e:
            self.log_issue("basic_imports", f"Error importing email_parser: {e}")
        
        # Test importing submodules
        submodules = [
            'email_parser.utils',
            'email_parser.models', 
            'email_parser.llm_clients',
            'email_parser.providers'
        ]
        
        for module in submodules:
            try:
                imported_module = importlib.import_module(module)
                self.log_success(f"Import {module}")
            except ImportError as e:
                self.log_issue("basic_imports", f"Cannot import {module}: {e}")
            except Exception as e:
                self.log_issue("basic_imports", f"Error importing {module}: {e}")
    
    def test_dependencies(self):
        """Test that required dependencies are available."""
        print("\n=== Testing Dependencies ===")
        
        # Read requirements.txt
        req_file = self.project_root / "requirements.txt"
        if not req_file.exists():
            self.log_issue("dependencies", "requirements.txt not found")
            return
        
        with open(req_file, 'r') as f:
            requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        
        # Test key dependencies
        key_deps = [
            'pandas',
            'pydantic', 
            'python-dotenv',
            'click',
            'tqdm',
            'structlog',
            'rich',
            'google-auth',
            'google-auth-oauthlib',
            'google-api-python-client',
            'msal',
            'requests',
            'beautifulsoup4',
            'openai',
            'anthropic',
            'instructor'
        ]
        
        for dep in key_deps:
            try:
                # Try to import the module
                module_name = dep.replace('-', '_')  # Convert package name to module name
                
                # Special cases for module names that differ from package names
                if dep == 'beautifulsoup4':
                    module_name = 'bs4'
                elif dep == 'google-auth':
                    module_name = 'google.auth'
                elif dep == 'google-auth-oauthlib':
                    module_name = 'google_auth_oauthlib'
                elif dep == 'google-api-python-client':
                    module_name = 'googleapiclient'
                elif dep == 'python-dotenv':
                    module_name = 'dotenv'
                
                importlib.import_module(module_name)
                self.log_success(f"Dependency available: {dep}")
                
            except ImportError:
                self.log_issue("dependencies", f"Missing dependency: {dep}", "WARNING")
            except Exception as e:
                self.log_issue("dependencies", f"Error checking {dep}: {e}", "WARNING")
    
    def test_environment_config(self):
        """Test environment configuration."""
        print("\n=== Testing Environment Configuration ===")
        
        # Check .env.example exists
        env_example = self.project_root / ".env.example"
        if not env_example.exists():
            self.log_issue("env_config", ".env.example file missing")
            return
        
        # Check .env.example has required variables
        with open(env_example, 'r') as f:
            content = f.read()
        
        required_vars = [
            'LLM_PROVIDER',
            'OLLAMA_BASE_URL',
            'OPENAI_API_KEY',
            'ANTHROPIC_API_KEY',
            'GMAIL_CREDENTIALS_FILE',
            'MICROSOFT_CLIENT_ID'
        ]
        
        for var in required_vars:
            if var not in content:
                self.log_issue("env_config", f"Missing environment variable in .env.example: {var}")
            else:
                self.log_success(f"Environment variable defined: {var}")
    
    def run_all_tests(self):
        """Run all Phase 1 tests."""
        print("🧪 Starting Phase 1 Testing: Project Setup")
        print("=" * 50)
        
        self.test_project_structure()
        self.test_basic_imports()
        self.test_dependencies()
        self.test_environment_config()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 Phase 1 Test Summary")
        print("=" * 50)
        
        total_issues = len(self.issues)
        critical_issues = len([i for i in self.issues if i['severity'] == 'ERROR'])
        warnings = len([i for i in self.issues if i['severity'] == 'WARNING'])
        
        print(f"Total Issues Found: {total_issues}")
        print(f"Critical Issues: {critical_issues}")
        print(f"Warnings: {warnings}")
        
        if total_issues == 0:
            print("🎉 All tests passed! Phase 1 is working correctly.")
            return True
        else:
            print("❌ Issues found. See details above.")
            return False


if __name__ == "__main__":
    tester = Phase1Tester()
    success = tester.run_all_tests()
    
    if not success:
        print("\n🔧 Attempting to fix issues...")
        # We'll add auto-fixing logic here after seeing what issues come up
        
    sys.exit(0 if success else 1)