"""
Configuration management for the email parser system.

Handles loading and validation of environment variables and configuration settings.
"""

import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from dotenv import load_dotenv

logger = logging.getLogger(__name__)


@dataclass
class LLMConfig:
    """Configuration for LLM providers."""
    provider: str = field(default="")

    # Stage-specific model configurations (format: provider:model)
    email_model: str = field(default="")        # Model for email summarization (fast/cheap)
    taxonomy_model: str = field(default="")     # Model for IAB taxonomy classification (accurate)
    marketing_model: str = field(default="")    # Model for marketing analysis
    ikigai_model: str = field(default="")       # Model for ikigai analysis
    
    # Ollama settings
    ollama_base_url: str = field(default="")
    ollama_model: str = field(default="")
    ollama_timeout: int = field(default=60)
    
    # OpenAI settings
    openai_api_key: Optional[str] = None
    openai_model: str = field(default="")
    openai_max_tokens: int = field(default=0)  # DEPRECATED: Clients query per-model limits from model_registry.py
    openai_temperature: float = field(default=0.7)

    # Anthropic settings
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = field(default="")
    anthropic_max_tokens: int = field(default=0)  # DEPRECATED: Clients query per-model limits from model_registry.py

    # Google settings
    google_api_key: Optional[str] = None
    google_model: str = field(default="")
    google_max_tokens: int = field(default=0)  # DEPRECATED: Clients query per-model limits from model_registry.py
    google_temperature: float = field(default=0.7)


@dataclass
class EmailProviderConfig:
    """Configuration for email providers."""
    # Gmail settings
    gmail_credentials_file: str = "credentials.json"
    gmail_token_file: str = "token.json"
    gmail_scopes: List[str] = field(default_factory=lambda: ["https://www.googleapis.com/auth/gmail.readonly"])
    
    # Microsoft Graph settings
    microsoft_client_id: Optional[str] = None
    microsoft_client_secret: Optional[str] = None
    microsoft_tenant_id: str = "common"
    microsoft_token_file: str = "ms_token.json"
    microsoft_scopes: List[str] = field(default_factory=lambda: ["https://graph.microsoft.com/Mail.Read"])


@dataclass
class ProcessingConfig:
    """Configuration for email processing."""
    max_emails: int = 200
    batch_size: int = 50
    retry_attempts: int = 3
    retry_delay: int = 2
    output_format: str = "csv"
    output_clean_summaries: bool = True
    output_include_confidence: bool = True


@dataclass
class LoggingConfig:
    """Configuration for logging."""
    level: str = "INFO"
    file: str = "email_parser.log"
    format: str = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    max_size: str = "10MB"
    backup_count: int = 5


@dataclass
class SecurityConfig:
    """Configuration for security settings."""
    encrypt_tokens: bool = False
    encryption_key: Optional[str] = None


@dataclass
class AppConfig:
    """Main application configuration."""
    llm: LLMConfig = field(default_factory=LLMConfig)
    email_providers: EmailProviderConfig = field(default_factory=EmailProviderConfig)
    processing: ProcessingConfig = field(default_factory=ProcessingConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    security: SecurityConfig = field(default_factory=SecurityConfig)


class ConfigManager:
    """Manages application configuration."""
    
    def __init__(self, env_file: Optional[str] = None):
        """Initialize configuration manager.
        
        Args:
            env_file: Optional path to .env file. If None, searches for .env in current directory.
        """
        self._load_environment(env_file)
        self._config = self._build_config()
    
    def _load_environment(self, env_file: Optional[str]) -> None:
        """Load environment variables from .env file."""
        if env_file:
            env_path = Path(env_file)
        else:
            env_path = Path(".env")
        
        if env_path.exists():
            load_dotenv(env_path)
            logger.info(f"Loaded environment from {env_path}")
        else:
            logger.warning(f"Environment file not found: {env_path}")
    
    def _get_env_list(self, key: str, default: List[str]) -> List[str]:
        """Get a list from environment variable (comma-separated)."""
        value = os.getenv(key)
        if value:
            return [item.strip() for item in value.split(",")]
        return default
    
    def _get_env_bool(self, key: str, default: bool) -> bool:
        """Get a boolean from environment variable."""
        value = os.getenv(key, "").lower()
        if value in ("true", "1", "yes", "on"):
            return True
        elif value in ("false", "0", "no", "off"):
            return False
        return default
    
    def _get_env_int(self, key: str, default: int) -> int:
        """Get an integer from environment variable."""
        try:
            return int(os.getenv(key, str(default)))
        except ValueError:
            logger.warning(f"Invalid integer value for {key}, using default: {default}")
            return default
    
    def parse_model_config(self, model_spec: str) -> tuple[str, str]:
        """Parse a model specification in format 'provider:model'.
        
        Args:
            model_spec: Model specification like 'openai:gpt-5' or 'claude:claude-sonnet-4'
            
        Returns:
            Tuple of (provider, model_name)
            
        Raises:
            ValueError: If model_spec format is invalid
        """
        if not model_spec:
            raise ValueError("Model specification cannot be empty")
        
        if ":" not in model_spec:
            raise ValueError(f"Invalid model format '{model_spec}'. Expected 'provider:model'")
        
        parts = model_spec.split(":", 1)
        if len(parts) != 2 or not parts[0] or not parts[1]:
            raise ValueError(f"Invalid model format '{model_spec}'. Expected 'provider:model'")
        
        provider, model = parts
        provider = provider.strip().lower()
        model = model.strip()
        
        # Validate provider
        valid_providers = ["openai", "claude", "ollama", "google"]
        if provider not in valid_providers:
            raise ValueError(f"Invalid provider '{provider}'. Must be one of: {valid_providers}")
        
        return provider, model
    
    def _build_config(self) -> AppConfig:
        """Build configuration from environment variables."""
        # Get required environment variables - no hardcoded defaults
        provider = os.getenv("LLM_PROVIDER")
        if not provider:
            raise ValueError("LLM_PROVIDER environment variable is required")
        
        llm_config = LLMConfig(
            provider=provider,
            email_model=os.getenv("EMAIL_MODEL", ""),
            taxonomy_model=os.getenv("TAXONOMY_MODEL", ""),
            marketing_model=os.getenv("MARKETING_MODEL", ""),
            ikigai_model=os.getenv("IKIGAI_MODEL", ""),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            ollama_model=os.getenv("OLLAMA_MODEL", ""),
            ollama_timeout=self._get_env_int("OLLAMA_TIMEOUT", 60),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_model=os.getenv("OPENAI_MODEL", ""),
            openai_max_tokens=self._get_env_int("OPENAI_MAX_TOKENS", 0),  # DEPRECATED (unused)
            openai_temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.7")),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            anthropic_model=os.getenv("ANTHROPIC_MODEL", ""),
            anthropic_max_tokens=self._get_env_int("ANTHROPIC_MAX_TOKENS", 0),  # DEPRECATED (unused)
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            google_model=os.getenv("GOOGLE_MODEL", ""),
            google_max_tokens=self._get_env_int("GOOGLE_MAX_TOKENS", 0),  # DEPRECATED (unused)
            google_temperature=float(os.getenv("GOOGLE_TEMPERATURE", "0.7")),
        )
        
        email_config = EmailProviderConfig(
            gmail_credentials_file=os.getenv("GMAIL_CREDENTIALS_FILE", "credentials.json"),
            gmail_token_file=os.getenv("GMAIL_TOKEN_FILE", "token.json"),
            gmail_scopes=self._get_env_list("GMAIL_SCOPES", ["https://www.googleapis.com/auth/gmail.readonly"]),
            microsoft_client_id=os.getenv("MICROSOFT_CLIENT_ID"),
            microsoft_client_secret=os.getenv("MICROSOFT_CLIENT_SECRET"),
            microsoft_tenant_id=os.getenv("MICROSOFT_TENANT_ID", "common"),
            microsoft_token_file=os.getenv("MICROSOFT_TOKEN_FILE", "ms_token.json"),
            microsoft_scopes=self._get_env_list("MICROSOFT_SCOPES", ["https://graph.microsoft.com/Mail.Read"]),
        )
        
        processing_config = ProcessingConfig(
            max_emails=self._get_env_int("MAX_EMAILS", 200),
            batch_size=self._get_env_int("BATCH_SIZE", 50),
            retry_attempts=self._get_env_int("RETRY_ATTEMPTS", 3),
            retry_delay=self._get_env_int("RETRY_DELAY", 2),
            output_format=os.getenv("OUTPUT_FORMAT", "csv"),
            output_clean_summaries=self._get_env_bool("OUTPUT_CLEAN_SUMMARIES", True),
            output_include_confidence=self._get_env_bool("OUTPUT_INCLUDE_CONFIDENCE", True),
        )
        
        logging_config = LoggingConfig(
            level=os.getenv("LOG_LEVEL", "INFO"),
            file=os.getenv("LOG_FILE", "email_parser.log"),
            format=os.getenv("LOG_FORMAT", "%(asctime)s [%(levelname)s] %(name)s: %(message)s"),
            max_size=os.getenv("LOG_MAX_SIZE", "10MB"),
            backup_count=self._get_env_int("LOG_BACKUP_COUNT", 5),
        )
        
        security_config = SecurityConfig(
            encrypt_tokens=self._get_env_bool("ENCRYPT_TOKENS", False),
            encryption_key=os.getenv("ENCRYPTION_KEY"),
        )
        
        return AppConfig(
            llm=llm_config,
            email_providers=email_config,
            processing=processing_config,
            logging=logging_config,
            security=security_config,
        )
    
    @property
    def config(self) -> AppConfig:
        """Get the current configuration."""
        return self._config
    
    def validate(self) -> List[str]:
        """Validate the configuration and return list of errors."""
        errors = []
        
        # Validate LLM configuration
        if self._config.llm.provider == "openai":
            if not self._config.llm.openai_api_key:
                errors.append("OpenAI API key is required when using OpenAI provider")
        elif self._config.llm.provider == "claude":
            if not self._config.llm.anthropic_api_key:
                errors.append("Anthropic API key is required when using Claude provider")
        elif self._config.llm.provider not in ["ollama", "openai", "claude"]:
            errors.append(f"Invalid LLM provider: {self._config.llm.provider}")
        
        # Validate email provider configuration
        gmail_creds_path = Path(self._config.email_providers.gmail_credentials_file)
        if not gmail_creds_path.exists():
            errors.append(f"Gmail credentials file not found: {gmail_creds_path}")
        
        # Validate Microsoft configuration if credentials are provided
        if (self._config.email_providers.microsoft_client_id or 
            self._config.email_providers.microsoft_client_secret):
            if not self._config.email_providers.microsoft_client_id:
                errors.append("Microsoft client ID is required")
            if not self._config.email_providers.microsoft_client_secret:
                errors.append("Microsoft client secret is required")
        
        # Validate processing configuration
        if self._config.processing.max_emails <= 0:
            errors.append("max_emails must be greater than 0")
        if self._config.processing.batch_size <= 0:
            errors.append("batch_size must be greater than 0")
        if self._config.processing.retry_attempts < 0:
            errors.append("retry_attempts must be non-negative")
        
        return errors
    
    def get_summary(self) -> Dict[str, Any]:
        """Get a summary of the current configuration (without sensitive data)."""
        return {
            "llm_provider": self._config.llm.provider,
            "llm_model": getattr(self._config.llm, f"{self._config.llm.provider}_model", "unknown"),
            "max_emails": self._config.processing.max_emails,
            "batch_size": self._config.processing.batch_size,
            "output_format": self._config.processing.output_format,
            "log_level": self._config.logging.level,
            "has_gmail_credentials": Path(self._config.email_providers.gmail_credentials_file).exists(),
            "has_microsoft_credentials": bool(self._config.email_providers.microsoft_client_id),
        }


# Global configuration instance
config_manager: Optional[ConfigManager] = None


def get_config(env_file: Optional[str] = None) -> AppConfig:
    """Get the global configuration instance."""
    global config_manager
    if config_manager is None:
        config_manager = ConfigManager(env_file)
    return config_manager.config


def get_config_manager(env_file: Optional[str] = None) -> ConfigManager:
    """Get the global configuration manager instance."""
    global config_manager
    if config_manager is None:
        config_manager = ConfigManager(env_file)
    return config_manager