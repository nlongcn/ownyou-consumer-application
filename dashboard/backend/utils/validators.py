#!/usr/bin/env python3
"""
Request Validators

Validates and sanitizes API request data.
"""

from typing import Dict, Any, Optional
from datetime import datetime


class ValidationError(Exception):
    """Custom validation error."""
    pass


def validate_user_id(user_id: Optional[str]) -> str:
    """
    Validate user_id parameter.

    Args:
        user_id: User identifier from request

    Returns:
        Validated user_id

    Raises:
        ValidationError: If user_id is invalid
    """
    if not user_id:
        raise ValidationError("user_id is required")

    if not isinstance(user_id, str):
        raise ValidationError("user_id must be a string")

    if len(user_id) > 255:
        raise ValidationError("user_id too long (max 255 characters)")

    # Basic alphanumeric + underscore/dash validation
    if not all(c.isalnum() or c in '_-' for c in user_id):
        raise ValidationError("user_id contains invalid characters")

    return user_id


def validate_section(section: Optional[str]) -> Optional[str]:
    """
    Validate section parameter.

    Args:
        section: Section name from request

    Returns:
        Validated section or None

    Raises:
        ValidationError: If section is invalid
    """
    if section is None:
        return None

    valid_sections = [
        "demographics",
        "household",
        "interests",
        "purchase_intent",
        "actual_purchases"
    ]

    if section not in valid_sections:
        raise ValidationError(f"Invalid section. Must be one of: {', '.join(valid_sections)}")

    return section


def validate_taxonomy_id(taxonomy_id: Any) -> int:
    """
    Validate taxonomy_id parameter.

    Args:
        taxonomy_id: Taxonomy ID from request

    Returns:
        Validated taxonomy_id as integer

    Raises:
        ValidationError: If taxonomy_id is invalid
    """
    try:
        taxonomy_id = int(taxonomy_id)
    except (TypeError, ValueError):
        raise ValidationError("taxonomy_id must be an integer")

    if taxonomy_id < 1 or taxonomy_id > 2000:
        raise ValidationError("taxonomy_id out of valid range (1-2000)")

    return taxonomy_id


def validate_limit(limit: Any, default: int = 10, max_limit: int = 100) -> int:
    """
    Validate limit parameter for pagination.

    Args:
        limit: Limit value from request
        default: Default limit if not provided
        max_limit: Maximum allowed limit

    Returns:
        Validated limit as integer

    Raises:
        ValidationError: If limit is invalid
    """
    if limit is None:
        return default

    try:
        limit = int(limit)
    except (TypeError, ValueError):
        raise ValidationError("limit must be an integer")

    if limit < 1:
        raise ValidationError("limit must be positive")

    if limit > max_limit:
        raise ValidationError(f"limit exceeds maximum ({max_limit})")

    return limit


def validate_date(date_str: Optional[str]) -> Optional[str]:
    """
    Validate date string in ISO format.

    Args:
        date_str: Date string from request

    Returns:
        Validated date string or None

    Raises:
        ValidationError: If date format is invalid
    """
    if date_str is None:
        return None

    try:
        datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return date_str
    except ValueError:
        raise ValidationError("Invalid date format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)")


def sanitize_response(data: Any) -> Any:
    """
    Sanitize response data by removing sensitive information.

    Args:
        data: Response data to sanitize

    Returns:
        Sanitized data
    """
    # For now, just return data as-is
    # In future, could remove PII or sensitive fields
    return data
