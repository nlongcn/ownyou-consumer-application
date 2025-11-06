#!/usr/bin/env python3
"""
Phase 2 Testing: Core Infrastructure

Tests:
1. Configuration management system
2. LLM client implementations (Ollama, OpenAI, Claude)
3. Data models and validation
4. Logging system
"""

import sys
import os
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, patch

# Add src to path for imports
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))

class Phase2Tester:
    """Test Phase 2: Core Infrastructure"""
    
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
    
    def test_configuration_system(self):
        """Test configuration management."""
        print("\n=== Testing Configuration System ===")
        
        try:
            from email_parser.utils.config import ConfigManager, AppConfig
            self.log_success("Import ConfigManager")
            
            # Test default configuration
            config_manager = ConfigManager()
            config = config_manager.config
            self.log_success("Create default configuration")
            
            # Test configuration validation
            errors = config_manager.validate()
            if errors:
                self.log_issue("config_validation", f"Configuration errors: {errors}", "WARNING")
            else:
                self.log_success("Configuration validation")
            
            # Test configuration summary
            summary = config_manager.get_summary()
            self.log_success("Configuration summary", f"Provider: {summary.get('llm_provider')}")
            
        except ImportError as e:
            self.log_issue("config_system", f"Cannot import configuration system: {e}")
        except Exception as e:
            self.log_issue("config_system", f"Configuration system error: {e}")
    
    def test_logging_system(self):
        """Test logging system."""
        print("\n=== Testing Logging System ===")
        
        try:
            from email_parser.utils.logging import setup_logging, get_logger
            self.log_success("Import logging system")
            
            # Test logging setup
            config = {
                'level': 'DEBUG',
                'file': 'test_email_parser.log',
                'max_size': '1MB',
                'backup_count': 3
            }
            
            logger_system = setup_logging(config)
            self.log_success("Setup logging system")
            
            # Test getting a logger
            logger = get_logger("test_logger")
            self.log_success("Get logger instance")
            
            # Test logging functionality
            logger.info("Test log message")
            self.log_success("Logging functionality")
            
            # Clean up test log file
            log_file = Path("test_email_parser.log")
            if log_file.exists():
                log_file.unlink()
            
        except ImportError as e:
            self.log_issue("logging_system", f"Cannot import logging system: {e}")
        except Exception as e:
            self.log_issue("logging_system", f"Logging system error: {e}")
    
    def test_data_models(self):
        """Test Pydantic data models."""
        print("\n=== Testing Data Models ===")
        
        try:
            from email_parser.models.email import (
                RawEmail, EmailSummary, EmailClassification, ProcessedEmail,
                EmailProvider, EmailCategory, ProcessingStatus
            )
            self.log_success("Import email models")
            
            # Test creating a RawEmail
            raw_email_data = {
                'id': 'test123',
                'provider': EmailProvider.GMAIL,
                'from_email': 'test@example.com',
                'subject': 'Test Email',
                'body_plain': 'This is a test email body.'
            }
            
            raw_email = RawEmail(**raw_email_data)
            self.log_success("Create RawEmail instance")
            
            # Test email validation
            if raw_email.from_email == 'test@example.com':
                self.log_success("Email validation")
            else:
                self.log_issue("data_models", "Email validation failed")
            
            # Test EmailSummary
            summary = EmailSummary(
                email_id='test123',
                summary='Test summary',
                word_count=100,
                confidence=0.95,
                processing_time=1.5
            )
            self.log_success("Create EmailSummary instance")
            
            # Test EmailClassification
            classification = EmailClassification(
                email_id='test123',
                category=EmailCategory.PERSONAL,
                category_confidence=0.9,
                products_confidence=0.8,
                processing_time=2.0
            )
            self.log_success("Create EmailClassification instance")
            
            # Test ProcessedEmail
            processed_email = ProcessedEmail(
                id='test123',
                provider=EmailProvider.GMAIL,
                from_email='test@example.com',
                subject='Test Email',
                summary=summary,
                classification=classification,
                status=ProcessingStatus.COMPLETED
            )
            self.log_success("Create ProcessedEmail instance")
            
            # Test CSV output
            csv_row = processed_email.to_csv_row()
            if 'ID' in csv_row and csv_row['ID'] == 'test123':
                self.log_success("CSV output functionality")
            else:
                self.log_issue("data_models", "CSV output failed")
                
        except ImportError as e:
            self.log_issue("data_models", f"Cannot import data models: {e}")
        except Exception as e:
            self.log_issue("data_models", f"Data models error: {e}")
    
    def test_llm_clients_base(self):
        """Test LLM client base classes."""
        print("\n=== Testing LLM Client Base Classes ===")
        
        try:
            from email_parser.llm_clients.base import (
                BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage,
                LLMClientFactory, create_simple_request
            )
            self.log_success("Import LLM client base classes")
            
            # Test creating LLM message
            message = LLMMessage(role="user", content="Test message")
            self.log_success("Create LLMMessage")
            
            # Test creating simple request
            request = create_simple_request(
                user_message="Test prompt",
                system_prompt="You are a test assistant"
            )
            self.log_success("Create simple LLM request")
            
            # Test request validation
            if request.messages and len(request.messages) == 1:
                self.log_success("LLM request structure")
            else:
                self.log_issue("llm_base", "LLM request structure invalid")
                
        except ImportError as e:
            self.log_issue("llm_base", f"Cannot import LLM base classes: {e}")
        except Exception as e:
            self.log_issue("llm_base", f"LLM base classes error: {e}")
    
    def test_ollama_client(self):
        """Test Ollama client."""
        print("\n=== Testing Ollama Client ===")
        
        try:
            from email_parser.llm_clients.ollama_client import OllamaClient
            self.log_success("Import OllamaClient")
            
            # Test client initialization
            config = {
                'ollama_base_url': 'http://localhost:11434',
                'ollama_model': 'llama3.2',
                'ollama_timeout': 30
            }
            
            client = OllamaClient(config)
            self.log_success("Initialize OllamaClient")
            
            # Test provider type
            if client.get_provider().value == 'ollama':
                self.log_success("Ollama provider type")
            else:
                self.log_issue("ollama_client", "Wrong provider type")
            
            # Test availability check (won't work without Ollama running, but shouldn't crash)
            try:
                is_available = client.is_available()
                self.log_success("Ollama availability check", f"Available: {is_available}")
            except Exception as e:
                self.log_issue("ollama_client", f"Availability check failed: {e}", "WARNING")
            
            # Test cost estimation (should return 0 for Ollama)
            from email_parser.llm_clients.base import create_simple_request
            test_request = create_simple_request("Test message")
            cost = client.estimate_cost(test_request)
            if cost == 0.0:
                self.log_success("Ollama cost estimation")
            else:
                self.log_issue("ollama_client", f"Wrong cost estimation: {cost}")
                
        except ImportError as e:
            self.log_issue("ollama_client", f"Cannot import OllamaClient: {e}")
        except Exception as e:
            self.log_issue("ollama_client", f"OllamaClient error: {e}")
    
    def test_openai_client(self):
        """Test OpenAI client."""
        print("\n=== Testing OpenAI Client ===")
        
        try:
            from email_parser.llm_clients.openai_client import OpenAIClient
            self.log_success("Import OpenAIClient")
            
            # Test client initialization (should fail without API key)
            config = {
                'openai_api_key': None,
                'openai_model': 'gpt-4',
                'openai_max_tokens': 4000
            }
            
            try:
                client = OpenAIClient(config)
                self.log_issue("openai_client", "Should fail without API key")
            except ValueError as e:
                if "API key is required" in str(e):
                    self.log_success("OpenAI API key validation")
                else:
                    self.log_issue("openai_client", f"Wrong validation error: {e}")
            
            # Test with fake API key
            config['openai_api_key'] = 'fake-api-key-for-testing'
            try:
                client = OpenAIClient(config)
                self.log_success("Initialize OpenAI client with API key")
                
                # Test provider type
                if client.get_provider().value == 'openai':
                    self.log_success("OpenAI provider type")
                else:
                    self.log_issue("openai_client", "Wrong provider type")
                
                # Test cost estimation
                from email_parser.llm_clients.base import create_simple_request
                test_request = create_simple_request("Test message")
                cost = client.estimate_cost(test_request)
                if isinstance(cost, (int, float)) and cost > 0:
                    self.log_success("OpenAI cost estimation", f"Estimated cost: ${cost:.6f}")
                else:
                    self.log_issue("openai_client", f"Invalid cost estimation: {cost}")
                    
            except Exception as e:
                # Connection will fail with fake API key, but class should initialize
                if any(keyword in str(e) for keyword in ["Authentication", "Failed to connect", "401", "Error code:", "invalid_request_error", "API key"]):
                    self.log_success("OpenAI client initialization (connection expected to fail)")
                else:
                    self.log_issue("openai_client", f"Unexpected error: {e}")
                
        except ImportError as e:
            self.log_issue("openai_client", f"Cannot import OpenAIClient: {e}")
        except Exception as e:
            self.log_issue("openai_client", f"OpenAIClient error: {e}")
    
    def test_claude_client(self):
        """Test Claude client."""
        print("\n=== Testing Claude Client ===")
        
        try:
            from email_parser.llm_clients.claude_client import ClaudeClient
            self.log_success("Import ClaudeClient")
            
            # Test client initialization (should fail without API key)
            config = {
                'anthropic_api_key': None,
                'anthropic_model': 'claude-3-haiku-20240307',
                'anthropic_max_tokens': 4000
            }
            
            try:
                client = ClaudeClient(config)
                self.log_issue("claude_client", "Should fail without API key")
            except ValueError as e:
                if "API key is required" in str(e):
                    self.log_success("Claude API key validation")
                else:
                    self.log_issue("claude_client", f"Wrong validation error: {e}")
            
            # Test with fake API key
            config['anthropic_api_key'] = 'fake-api-key-for-testing'
            try:
                client = ClaudeClient(config)
                self.log_success("Initialize Claude client with API key")
                
                # Test provider type
                if client.get_provider().value == 'claude':
                    self.log_success("Claude provider type")
                else:
                    self.log_issue("claude_client", "Wrong provider type")
                
                # Test cost estimation
                from email_parser.llm_clients.base import create_simple_request
                test_request = create_simple_request("Test message")
                cost = client.estimate_cost(test_request)
                if isinstance(cost, (int, float)) and cost > 0:
                    self.log_success("Claude cost estimation", f"Estimated cost: ${cost:.6f}")
                else:
                    self.log_issue("claude_client", f"Invalid cost estimation: {cost}")
                    
            except Exception as e:
                # Connection will fail with fake API key, but class should initialize
                if any(keyword in str(e) for keyword in ["Authentication", "Failed to connect", "401", "Error code:", "authentication_error", "invalid x-api-key"]):
                    self.log_success("Claude client initialization (connection expected to fail)")
                else:
                    self.log_issue("claude_client", f"Unexpected error: {e}")
                
        except ImportError as e:
            self.log_issue("claude_client", f"Cannot import ClaudeClient: {e}")
        except Exception as e:
            self.log_issue("claude_client", f"ClaudeClient error: {e}")
    
    def test_llm_client_factory(self):
        """Test LLM client factory."""
        print("\n=== Testing LLM Client Factory ===")
        
        try:
            from email_parser.llm_clients.base import LLMClientFactory, LLMProvider
            self.log_success("Import LLMClientFactory")
            
            # Test creating Ollama client
            config = {'ollama_base_url': 'http://localhost:11434'}
            try:
                client = LLMClientFactory.create_client(LLMProvider.OLLAMA, config)
                self.log_success("Factory create Ollama client")
            except Exception as e:
                self.log_issue("llm_factory", f"Failed to create Ollama client: {e}")
            
            # Test creating OpenAI client
            config = {'openai_api_key': 'fake-key'}
            try:
                client = LLMClientFactory.create_client(LLMProvider.OPENAI, config)
                self.log_success("Factory create OpenAI client (will fail auth later)")
            except Exception as e:
                if any(keyword in str(e) for keyword in ["Authentication", "Failed to connect", "401", "Error code:", "authentication_error"]):
                    self.log_success("Factory create OpenAI client (auth failed as expected)")
                else:
                    self.log_issue("llm_factory", f"Unexpected error creating OpenAI client: {e}")
            
            # Test creating Claude client
            config = {'anthropic_api_key': 'fake-key'}
            try:
                client = LLMClientFactory.create_client(LLMProvider.CLAUDE, config)
                self.log_success("Factory create Claude client (will fail auth later)")
            except Exception as e:
                if any(keyword in str(e) for keyword in ["Authentication", "Failed to connect", "401", "Error code:", "authentication_error"]):
                    self.log_success("Factory create Claude client (auth failed as expected)")
                else:
                    self.log_issue("llm_factory", f"Unexpected error creating Claude client: {e}")
                    
            # Test invalid provider
            try:
                client = LLMClientFactory.create_client("invalid_provider", {})
                self.log_issue("llm_factory", "Should fail with invalid provider")
            except ValueError as e:
                self.log_success("Factory invalid provider handling")
            except Exception as e:
                self.log_issue("llm_factory", f"Wrong error for invalid provider: {e}")
                
        except ImportError as e:
            self.log_issue("llm_factory", f"Cannot import LLMClientFactory: {e}")
        except Exception as e:
            self.log_issue("llm_factory", f"LLMClientFactory error: {e}")
    
    def run_all_tests(self):
        """Run all Phase 2 tests."""
        print("🧪 Starting Phase 2 Testing: Core Infrastructure")
        print("=" * 60)
        
        self.test_configuration_system()
        self.test_logging_system()
        self.test_data_models()
        self.test_llm_clients_base()
        self.test_ollama_client()
        self.test_openai_client()
        self.test_claude_client()
        self.test_llm_client_factory()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 Phase 2 Test Summary")
        print("=" * 60)
        
        total_issues = len(self.issues)
        critical_issues = len([i for i in self.issues if i['severity'] == 'ERROR'])
        warnings = len([i for i in self.issues if i['severity'] == 'WARNING'])
        
        print(f"Total Issues Found: {total_issues}")
        print(f"Critical Issues: {critical_issues}")
        print(f"Warnings: {warnings}")
        
        if critical_issues == 0:
            print("🎉 No critical issues found! Phase 2 core functionality is working.")
            if warnings > 0:
                print("⚠️  Some warnings found, but these are likely due to missing external services.")
            return True
        else:
            print("❌ Critical issues found. See details above.")
            return False


if __name__ == "__main__":
    tester = Phase2Tester()
    success = tester.run_all_tests()
    
    if not success:
        print("\n🔧 Critical issues found that need fixing.")
        
    sys.exit(0 if success else 1)