"""
Pydantic models for email data structures.

Defines the data models used throughout the email parser system.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator, EmailStr
from enum import Enum
import re


class EmailCategory(str, Enum):
    """Email categories for classification."""
    PURCHASE = "Purchase"
    INFORMATION = "Information/News/Blog"
    PERSONAL = "Personal Communication"
    INVOICE = "Invoice"
    SHIPMENT = "Shipment Related"
    INSURANCE = "Insurance"
    BANK_RELATED = "Bank Related"
    CAR = "Car"
    HOUSE_RELATED = "House Related"
    PROMOTIONAL = "Promotional"
    NEWSLETTER = "Newsletter"
    NOTIFICATION = "Notification"
    OTHER = "Other"
    ERROR = "Error in processing"
    EMPTY = "Empty email summary"


class EmailProvider(str, Enum):
    """Supported email providers."""
    GMAIL = "gmail"
    OUTLOOK = "outlook"
    HOTMAIL = "hotmail"


class ProcessingStatus(str, Enum):
    """Processing status for emails."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class RawEmail(BaseModel):
    """Raw email data from provider."""
    id: str = Field(..., description="Unique email ID from provider")
    provider: EmailProvider = Field(..., description="Email provider")
    date: Optional[datetime] = Field(None, description="Email date")
    from_email: Optional[str] = Field(None, alias="from", description="Sender email address")
    to_email: Optional[List[str]] = Field(None, alias="to", description="Recipient email addresses")
    subject: Optional[str] = Field(None, description="Email subject")
    body_plain: Optional[str] = Field(None, description="Plain text email body")
    body_html: Optional[str] = Field(None, description="HTML email body")
    headers: Dict[str, str] = Field(default_factory=dict, description="Email headers")
    attachments: List[str] = Field(default_factory=list, description="Attachment filenames")
    
    class Config:
        populate_by_name = True
        str_strip_whitespace = True
    
    @validator('from_email')
    def validate_from_email(cls, v):
        """Validate from email address format."""
        if v and not re.match(r'^.+@.+\..+$', v.strip('<>"')):
            # Extract email from format like '"Name" <email@domain.com>'
            email_match = re.search(r'<([^>]+)>', v)
            if email_match:
                return email_match.group(1)
            # Try to find email pattern in the string
            email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', v)
            if email_match:
                return email_match.group(0)
        return v
    
    @validator('subject')
    def clean_subject(cls, v):
        """Clean email subject."""
        if v:
            # Remove excessive whitespace and newlines
            return ' '.join(v.split())
        return v


class EmailSummary(BaseModel):
    """Processed email summary."""
    email_id: str = Field(..., description="Reference to original email ID")
    summary: str = Field(..., description="AI-generated email summary")
    word_count: int = Field(..., description="Word count of original email")
    language: Optional[str] = Field(None, description="Detected language")
    confidence: float = Field(ge=0.0, le=1.0, description="Summary generation confidence")
    processing_time: float = Field(ge=0.0, description="Processing time in seconds")
    
    @validator('summary')
    def clean_summary(cls, v):
        """Clean and validate summary."""
        if v:
            # Remove newlines and excessive whitespace for CSV compatibility
            cleaned = ' '.join(v.strip().split())
            # Ensure summary is not too long
            if len(cleaned) > 1000:
                cleaned = cleaned[:997] + "..."
            return cleaned
        return v


class ProductExtraction(BaseModel):
    """Extracted product information."""
    name: str = Field(..., description="Product name")
    category: Optional[str] = Field(None, description="Product category")
    brand: Optional[str] = Field(None, description="Product brand")
    model: Optional[str] = Field(None, description="Product model")
    price: Optional[str] = Field(None, description="Product price if mentioned")
    confidence: float = Field(ge=0.0, le=1.0, description="Extraction confidence")


class EmailClassification(BaseModel):
    """Email classification results."""
    email_id: str = Field(..., description="Reference to original email ID")
    category: EmailCategory = Field(..., description="Email category")
    category_confidence: float = Field(ge=0.0, le=1.0, description="Category confidence")
    products: List[ProductExtraction] = Field(default_factory=list, description="Extracted products")
    products_confidence: float = Field(ge=0.0, le=1.0, description="Overall products extraction confidence")
    keywords: List[str] = Field(default_factory=list, description="Key keywords/phrases")
    key_topics: Optional[str] = Field(None, description="Key topics extracted from email content")
    sentiment: Optional[str] = Field(None, description="Email sentiment if analyzed")
    processing_time: float = Field(ge=0.0, description="Processing time in seconds")


class ProcessedEmail(BaseModel):
    """Complete processed email with all analysis."""
    # Original data
    id: str = Field(..., description="Unique email ID")
    provider: EmailProvider = Field(..., description="Email provider")
    date: Optional[datetime] = Field(None, description="Email date")
    from_email: Optional[str] = Field(None, description="Sender email")
    subject: Optional[str] = Field(None, description="Email subject")
    
    # Processed data
    summary: Optional[EmailSummary] = Field(None, description="Email summary")
    classification: Optional[EmailClassification] = Field(None, description="Email classification")
    
    # Processing metadata
    status: ProcessingStatus = Field(default=ProcessingStatus.PENDING, description="Processing status")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Record creation time")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update time")
    error_message: Optional[str] = Field(None, description="Error message if processing failed")
    
    class Config:
        str_strip_whitespace = True
    
    def to_csv_row(self, include_confidence: bool = True) -> Dict[str, Any]:
        """Convert to CSV row format."""
        row = {
            'ID': self.id,
            'Date': self.date.isoformat() if self.date else '',
            'From': self.from_email or '',
            'Subject': self.subject or '',
            'Summary': self.summary.summary if self.summary else '',
            'Category': self.classification.category.value if self.classification else '',
            'Products': '; '.join([p.name for p in self.classification.products]) if self.classification else '',
            'Key_Topics': self.classification.key_topics if self.classification and self.classification.key_topics else '',
            'Status': self.status.value,
        }
        
        if include_confidence and self.classification:
            row.update({
                'Category_Confidence': self.classification.category_confidence,
                'Products_Confidence': self.classification.products_confidence,
                'Summary_Confidence': self.summary.confidence if self.summary else 0.0,
            })
        
        return row


class EmailBatch(BaseModel):
    """Batch of emails for processing."""
    emails: List[RawEmail] = Field(..., description="List of emails in batch")
    batch_id: str = Field(..., description="Unique batch identifier")
    provider: EmailProvider = Field(..., description="Email provider")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Batch creation time")
    total_count: int = Field(..., description="Total number of emails")
    processed_count: int = Field(default=0, description="Number of processed emails")
    failed_count: int = Field(default=0, description="Number of failed emails")
    
    @validator('total_count')
    def validate_total_count(cls, v, values):
        """Validate total count matches email list length."""
        if 'emails' in values and len(values['emails']) != v:
            raise ValueError("total_count must match length of emails list")
        return v


class ProcessingResult(BaseModel):
    """Result of email processing operation."""
    success: bool = Field(..., description="Whether processing succeeded")
    processed_emails: List[ProcessedEmail] = Field(default_factory=list, description="Successfully processed emails")
    failed_emails: List[str] = Field(default_factory=list, description="Failed email IDs")
    total_processed: int = Field(default=0, description="Total emails processed")
    total_failed: int = Field(default=0, description="Total emails failed")
    processing_time: float = Field(ge=0.0, description="Total processing time in seconds")
    error_summary: Dict[str, int] = Field(default_factory=dict, description="Summary of errors by type")
    
    @validator('total_processed')
    def validate_total_processed(cls, v, values):
        """Validate total processed matches processed emails count."""
        if 'processed_emails' in values:
            return len(values['processed_emails'])
        return v
    
    @validator('total_failed')
    def validate_total_failed(cls, v, values):
        """Validate total failed matches failed emails count."""
        if 'failed_emails' in values:
            return len(values['failed_emails'])
        return v


# Utility functions for working with email models

def create_raw_email_from_dict(data: Dict[str, Any], provider: EmailProvider) -> RawEmail:
    """Create RawEmail from dictionary data."""
    # Map common field variations
    field_mappings = {
        'from': ['from_email', 'sender', 'from_address'],
        'to': ['to_email', 'recipient', 'to_address'],
        'body': ['body_plain', 'content', 'text'],
        'html': ['body_html', 'html_content'],
    }
    
    # Normalize field names
    normalized_data = {}
    for key, value in data.items():
        normalized_key = key.lower().replace('-', '_')
        normalized_data[normalized_key] = value
    
    # Apply field mappings
    for target_field, source_fields in field_mappings.items():
        if target_field not in normalized_data:
            for source_field in source_fields:
                if source_field in normalized_data:
                    normalized_data[target_field] = normalized_data[source_field]
                    break
    
    # Ensure required fields
    if 'id' not in normalized_data:
        normalized_data['id'] = str(hash(str(normalized_data)))
    
    normalized_data['provider'] = provider
    
    return RawEmail(**normalized_data)


def merge_email_data(raw_email: RawEmail, summary: Optional[EmailSummary], 
                     classification: Optional[EmailClassification]) -> ProcessedEmail:
    """Merge raw email with processed data."""
    status = ProcessingStatus.COMPLETED
    error_message = None
    
    # Determine status based on processing results
    if not summary and not classification:
        status = ProcessingStatus.FAILED
        error_message = "Both summary and classification failed"
    elif not summary:
        status = ProcessingStatus.FAILED
        error_message = "Summary generation failed"
    elif not classification:
        status = ProcessingStatus.FAILED
        error_message = "Classification failed"
    
    return ProcessedEmail(
        id=raw_email.id,
        provider=raw_email.provider,
        date=raw_email.date,
        from_email=raw_email.from_email,
        subject=raw_email.subject,
        summary=summary,
        classification=classification,
        status=status,
        error_message=error_message
    )