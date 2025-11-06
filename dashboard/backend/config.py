#!/usr/bin/env python3
"""
Dashboard Configuration

Centralized configuration for Flask backend.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Flask application configuration."""

    # Flask settings
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-in-production")
    DEBUG = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    HOST = os.getenv("FLASK_HOST", "0.0.0.0")  # Listen on all interfaces (localhost, 127.0.0.1, etc.)
    PORT = int(os.getenv("FLASK_PORT", "5001"))

    # CORS settings - allow both localhost and 127.0.0.1
    default_origins = "http://localhost:3000,http://127.0.0.1:3000"
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", default_origins).split(",")

    # Database settings
    DATABASE_PATH = os.getenv("MEMORY_DATABASE_PATH", "data/email_parser_memory.db")

    # Session settings
    SESSION_TYPE = "filesystem"
    SESSION_COOKIE_HTTPONLY = True  # Secure cookie (browser can't access via JS)
    SESSION_COOKIE_SECURE = False  # HTTP in development
    SESSION_COOKIE_SAMESITE = None  # No SameSite restriction for development
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours

    # API settings
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max upload
    JSON_SORT_KEYS = False


class DevelopmentConfig(Config):
    """Development-specific configuration."""
    DEBUG = True
    SESSION_COOKIE_SECURE = False


class ProductionConfig(Config):
    """Production-specific configuration."""
    DEBUG = False
    SESSION_COOKIE_SECURE = True  # Require HTTPS


# Config selection
config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig
}


def get_config(env: str = None) -> Config:
    """
    Get configuration based on environment.

    Args:
        env: Environment name (development, production). Defaults to FLASK_ENV var.

    Returns:
        Configuration class
    """
    if env is None:
        env = os.getenv("FLASK_ENV", "development")

    return config_by_name.get(env, DevelopmentConfig)
