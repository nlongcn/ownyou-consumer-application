"""
Data models for the email parser system.

Provides Pydantic models for email data structures and validation.
"""

from .email import (
    EmailCategory,
    EmailProvider,
    ProcessingStatus,
    RawEmail,
    EmailSummary,
    ProductExtraction,
    EmailClassification,
    ProcessedEmail,
    EmailBatch,
    ProcessingResult,
    create_raw_email_from_dict,
    merge_email_data,
)

__all__ = [
    'EmailCategory',
    'EmailProvider', 
    'ProcessingStatus',
    'RawEmail',
    'EmailSummary',
    'ProductExtraction',
    'EmailClassification',
    'ProcessedEmail',
    'EmailBatch',
    'ProcessingResult',
    'create_raw_email_from_dict',
    'merge_email_data',
]