"""
Enhanced logging manager with structured log storage for review.

Provides comprehensive logging with file storage, rotation, and categorization.
"""

import os
import logging
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from logging.handlers import RotatingFileHandler
import traceback

class EmailParserLogger:
    """Enhanced logger with structured storage and categorization."""
    
    def __init__(self, name: str, log_dir: str = "logs"):
        self.name = name
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        
        # Create session ID for this run
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Setup main logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        
        # Clear any existing handlers
        self.logger.handlers.clear()
        
        # Setup handlers
        self._setup_console_handler()
        self._setup_file_handlers()
        self._setup_structured_handler()
        
    def _setup_console_handler(self):
        """Setup console handler for immediate feedback."""
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
            datefmt='%H:%M:%S'
        )
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)
        
    def _setup_file_handlers(self):
        """Setup rotating file handlers for different log levels."""
        # Main log file with rotation
        main_log_file = self.log_dir / f"email_parser_{self.session_id}.log"
        main_handler = RotatingFileHandler(
            main_log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        main_handler.setLevel(logging.DEBUG)
        main_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] %(name)s:%(lineno)d: %(message)s'
        )
        main_handler.setFormatter(main_formatter)
        self.logger.addHandler(main_handler)
        
        # Error log file
        error_log_file = self.log_dir / f"errors_{self.session_id}.log"
        error_handler = RotatingFileHandler(
            error_log_file,
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(main_formatter)
        self.logger.addHandler(error_handler)
        
    def _setup_structured_handler(self):
        """Setup structured JSON logging for analysis."""
        self.structured_log_file = self.log_dir / f"structured_{self.session_id}.jsonl"
        
    def log_structured(self, event_type: str, data: Dict[str, Any], level: str = "INFO"):
        """Log structured data as JSON for analysis."""
        structured_entry = {
            "timestamp": datetime.now().isoformat(),
            "session_id": self.session_id,
            "event_type": event_type,
            "level": level,
            "data": data
        }
        
        with open(self.structured_log_file, 'a') as f:
            f.write(json.dumps(structured_entry) + '\n')
            
    def log_email_processing_start(self, provider: str, max_emails: int):
        """Log the start of email processing."""
        self.logger.info(f"Starting email processing - Provider: {provider}, Max emails: {max_emails}")
        self.log_structured("email_processing_start", {
            "provider": provider,
            "max_emails": max_emails
        })
        
    def log_email_processing_complete(self, provider: str, emails_processed: int, duration_seconds: float):
        """Log email processing completion."""
        self.logger.info(f"Email processing complete - Provider: {provider}, Processed: {emails_processed}, Duration: {duration_seconds:.2f}s")
        self.log_structured("email_processing_complete", {
            "provider": provider,
            "emails_processed": emails_processed,
            "duration_seconds": duration_seconds,
            "emails_per_second": emails_processed / duration_seconds if duration_seconds > 0 else 0
        })
        
    def log_llm_request(self, provider: str, model: str, prompt_tokens: int, completion_tokens: int, duration_seconds: float):
        """Log LLM API request details."""
        self.logger.debug(f"LLM Request - Provider: {provider}, Model: {model}, Prompt tokens: {prompt_tokens}, Completion tokens: {completion_tokens}, Duration: {duration_seconds:.2f}s")
        self.log_structured("llm_request", {
            "provider": provider,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "duration_seconds": duration_seconds,
            "tokens_per_second": (prompt_tokens + completion_tokens) / duration_seconds if duration_seconds > 0 else 0
        })
        
    def log_error_with_context(self, error: Exception, context: Dict[str, Any]):
        """Log error with full context and traceback."""
        error_details = {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "traceback": traceback.format_exc(),
            "context": context
        }
        
        self.logger.error(f"Error: {type(error).__name__}: {str(error)}")
        self.logger.debug(f"Full traceback:\n{traceback.format_exc()}")
        self.log_structured("error", error_details, "ERROR")
        
    def log_analysis_phase(self, phase_name: str, phase_data: Dict[str, Any]):
        """Log analysis phase details."""
        self.logger.info(f"Analysis Phase: {phase_name}")
        self.log_structured("analysis_phase", {
            "phase_name": phase_name,
            **phase_data
        })
        
    def log_model_selection(self, instruction: str, selected_provider: str, selected_model: str, reasoning: str):
        """Log model selection decisions."""
        self.logger.info(f"Model Selection - Provider: {selected_provider}, Model: {selected_model}")
        self.log_structured("model_selection", {
            "instruction": instruction,
            "selected_provider": selected_provider,
            "selected_model": selected_model,
            "reasoning": reasoning
        })
        
    def get_session_logs_dir(self) -> Path:
        """Get the directory containing logs for this session."""
        return self.log_dir
        
    def get_structured_log_file(self) -> Path:
        """Get the path to the structured log file."""
        return self.structured_log_file

# Global logger instance
_email_parser_logger: Optional[EmailParserLogger] = None

def get_logger(name: str = "email_parser") -> EmailParserLogger:
    """Get the global logger instance."""
    global _email_parser_logger
    if _email_parser_logger is None:
        _email_parser_logger = EmailParserLogger(name)
    return _email_parser_logger

def init_logging(log_dir: str = "logs") -> EmailParserLogger:
    """Initialize logging system."""
    global _email_parser_logger
    _email_parser_logger = EmailParserLogger("email_parser", log_dir)
    return _email_parser_logger