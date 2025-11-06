"""
Enhanced logging system with structured logging.

Provides structured logging with rich formatting and proper log management.
"""

import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Dict, Any, Optional
import structlog
from rich.console import Console
from rich.logging import RichHandler
from rich.traceback import install as install_rich_traceback
from datetime import datetime
import json


class EmailParserLogger:
    """Enhanced logger for the email parser system."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize the logging system.
        
        Args:
            config: Logging configuration dictionary
        """
        self.config = config
        self.console = Console()
        self._setup_logging()
        self._setup_structlog()
        
        # Install rich traceback handler for better error display
        install_rich_traceback(show_locals=True, max_frames=10)
    
    def _setup_logging(self):
        """Set up the standard logging configuration."""
        # Parse log level
        level_str = self.config.get('level', 'INFO').upper()
        level = getattr(logging, level_str, logging.INFO)
        
        # Create root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(level)
        
        # Clear any existing handlers
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
        
        # Create formatters
        detailed_formatter = logging.Formatter(
            fmt=self.config.get('format', '%(asctime)s [%(levelname)s] %(name)s: %(message)s'),
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        simple_formatter = logging.Formatter('%(levelname)s: %(message)s')
        
        # Console handler with rich formatting
        console_handler = RichHandler(
            console=self.console,
            show_path=True,
            show_time=True,
            rich_tracebacks=True,
            tracebacks_show_locals=True
        )
        console_handler.setLevel(level)
        console_handler.setFormatter(simple_formatter)
        root_logger.addHandler(console_handler)
        
        # File handler with rotation
        log_file = Path(self.config.get('file', 'email_parser.log'))
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Parse max size (e.g., "10MB" -> 10 * 1024 * 1024)
        max_size_str = self.config.get('max_size', '10MB').upper()
        if max_size_str.endswith('MB'):
            max_bytes = int(max_size_str[:-2]) * 1024 * 1024
        elif max_size_str.endswith('KB'):
            max_bytes = int(max_size_str[:-2]) * 1024
        else:
            max_bytes = int(max_size_str)
        
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=self.config.get('backup_count', 5),
            encoding='utf-8'
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(detailed_formatter)
        root_logger.addHandler(file_handler)
        
        # Suppress some noisy loggers
        logging.getLogger('urllib3').setLevel(logging.WARNING)
        logging.getLogger('requests').setLevel(logging.WARNING)
        logging.getLogger('google').setLevel(logging.WARNING)
        logging.getLogger('googleapiclient').setLevel(logging.WARNING)
    
    def _setup_structlog(self):
        """Set up structured logging with structlog."""
        timestamper = structlog.processors.TimeStamper(fmt="ISO")
        
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                timestamper,
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )
    
    def get_logger(self, name: str) -> structlog.BoundLogger:
        """Get a structured logger instance.
        
        Args:
            name: Logger name
            
        Returns:
            Configured structlog logger
        """
        return structlog.get_logger(name)


class EmailProcessingLogger:
    """Specialized logger for email processing operations."""
    
    def __init__(self, logger: structlog.BoundLogger):
        """Initialize with a structured logger."""
        self.logger = logger
        self.start_time = datetime.utcnow()
        self.stats = {
            'total_emails': 0,
            'processed_emails': 0,
            'failed_emails': 0,
            'processing_times': [],
            'errors': {}
        }
    
    def log_batch_start(self, batch_id: str, email_count: int, provider: str):
        """Log the start of a batch processing."""
        self.logger.info(
            "Starting email batch processing",
            batch_id=batch_id,
            email_count=email_count,
            provider=provider,
            timestamp=datetime.utcnow().isoformat()
        )
        self.stats['total_emails'] = email_count
    
    def log_email_start(self, email_id: str, subject: str):
        """Log the start of individual email processing."""
        self.logger.debug(
            "Processing email",
            email_id=email_id,
            subject=subject[:100] if subject else None,
            timestamp=datetime.utcnow().isoformat()
        )
    
    def log_email_success(self, email_id: str, processing_time: float, 
                         category: str, products_count: int):
        """Log successful email processing."""
        self.logger.debug(
            "Email processed successfully",
            email_id=email_id,
            processing_time_seconds=processing_time,
            category=category,
            products_count=products_count
        )
        self.stats['processed_emails'] += 1
        self.stats['processing_times'].append(processing_time)
    
    def log_email_error(self, email_id: str, error: str, error_type: str = "unknown"):
        """Log email processing error."""
        self.logger.error(
            "Email processing failed",
            email_id=email_id,
            error=error,
            error_type=error_type
        )
        self.stats['failed_emails'] += 1
        self.stats['errors'][error_type] = self.stats['errors'].get(error_type, 0) + 1
    
    def log_llm_request(self, provider: str, model: str, request_size: int):
        """Log LLM request."""
        self.logger.debug(
            "LLM request sent",
            provider=provider,
            model=model,
            request_size_chars=request_size
        )
    
    def log_llm_response(self, provider: str, model: str, response_size: int, 
                        processing_time: float, success: bool):
        """Log LLM response."""
        self.logger.debug(
            "LLM response received",
            provider=provider,
            model=model,
            response_size_chars=response_size,
            processing_time_seconds=processing_time,
            success=success
        )
    
    def log_batch_complete(self, batch_id: str):
        """Log batch processing completion."""
        total_time = (datetime.utcnow() - self.start_time).total_seconds()
        avg_time = (
            sum(self.stats['processing_times']) / len(self.stats['processing_times'])
            if self.stats['processing_times'] else 0
        )
        
        success_rate = (
            self.stats['processed_emails'] / self.stats['total_emails'] * 100
            if self.stats['total_emails'] > 0 else 0
        )
        
        self.logger.info(
            "Batch processing completed",
            batch_id=batch_id,
            total_emails=self.stats['total_emails'],
            processed_emails=self.stats['processed_emails'],
            failed_emails=self.stats['failed_emails'],
            success_rate_percent=round(success_rate, 2),
            total_time_seconds=total_time,
            average_processing_time_seconds=round(avg_time, 3),
            errors_by_type=self.stats['errors']
        )
    
    def log_summary(self) -> Dict[str, Any]:
        """Generate and log processing summary."""
        summary = {
            'total_emails': self.stats['total_emails'],
            'processed_emails': self.stats['processed_emails'],
            'failed_emails': self.stats['failed_emails'],
            'success_rate': (
                self.stats['processed_emails'] / self.stats['total_emails']
                if self.stats['total_emails'] > 0 else 0
            ),
            'total_time': (datetime.utcnow() - self.start_time).total_seconds(),
            'average_processing_time': (
                sum(self.stats['processing_times']) / len(self.stats['processing_times'])
                if self.stats['processing_times'] else 0
            ),
            'errors': self.stats['errors']
        }
        
        self.logger.info("Processing summary", **summary)
        return summary


class PerformanceLogger:
    """Logger for performance metrics."""
    
    def __init__(self, logger: structlog.BoundLogger):
        """Initialize with a structured logger."""
        self.logger = logger
        self.metrics = {}
    
    def start_timer(self, operation: str) -> str:
        """Start timing an operation."""
        timer_id = f"{operation}_{datetime.utcnow().timestamp()}"
        self.metrics[timer_id] = {
            'operation': operation,
            'start_time': datetime.utcnow(),
            'end_time': None,
            'duration': None
        }
        return timer_id
    
    def end_timer(self, timer_id: str, additional_data: Optional[Dict[str, Any]] = None):
        """End timing an operation."""
        if timer_id in self.metrics:
            metric = self.metrics[timer_id]
            metric['end_time'] = datetime.utcnow()
            metric['duration'] = (metric['end_time'] - metric['start_time']).total_seconds()
            
            log_data = {
                'operation': metric['operation'],
                'duration_seconds': metric['duration']
            }
            
            if additional_data:
                log_data.update(additional_data)
            
            self.logger.debug("Operation completed", **log_data)
            
            # Clean up completed metric
            del self.metrics[timer_id]
    
    def log_memory_usage(self, operation: str, memory_mb: float):
        """Log memory usage."""
        self.logger.debug(
            "Memory usage",
            operation=operation,
            memory_usage_mb=memory_mb
        )
    
    def log_api_call(self, provider: str, endpoint: str, status_code: int, 
                    response_time: float, request_size: int = 0, response_size: int = 0):
        """Log API call metrics."""
        self.logger.debug(
            "API call",
            provider=provider,
            endpoint=endpoint,
            status_code=status_code,
            response_time_seconds=response_time,
            request_size_bytes=request_size,
            response_size_bytes=response_size,
            success=200 <= status_code < 300
        )


# Global logger instance
_global_logger: Optional[EmailParserLogger] = None


def setup_logging(config: Dict[str, Any]) -> EmailParserLogger:
    """Set up the global logging system."""
    global _global_logger
    _global_logger = EmailParserLogger(config)
    return _global_logger


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a logger instance."""
    if _global_logger is None:
        # Default configuration if not set up
        setup_logging({
            'level': 'INFO',
            'file': 'email_parser.log',
            'max_size': '10MB',
            'backup_count': 5
        })
    
    return _global_logger.get_logger(name)


def get_processing_logger(name: str) -> EmailProcessingLogger:
    """Get an email processing logger."""
    base_logger = get_logger(name)
    return EmailProcessingLogger(base_logger)


def get_performance_logger(name: str) -> PerformanceLogger:
    """Get a performance logger."""
    base_logger = get_logger(name)
    return PerformanceLogger(base_logger)


# Context manager for operation timing
class TimedOperation:
    """Context manager for timing operations."""
    
    def __init__(self, logger: PerformanceLogger, operation: str, 
                 additional_data: Optional[Dict[str, Any]] = None):
        """Initialize timed operation.
        
        Args:
            logger: Performance logger instance
            operation: Operation name
            additional_data: Additional data to log
        """
        self.logger = logger
        self.operation = operation
        self.additional_data = additional_data or {}
        self.timer_id = None
    
    def __enter__(self):
        """Start the timer."""
        self.timer_id = self.logger.start_timer(self.operation)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """End the timer."""
        if exc_type:
            self.additional_data['error'] = str(exc_val)
            self.additional_data['success'] = False
        else:
            self.additional_data['success'] = True
        
        if self.timer_id:
            self.logger.end_timer(self.timer_id, self.additional_data)