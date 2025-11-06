#!/usr/bin/env python3
"""
Load Emails Node

Loads new emails that haven't been processed yet by filtering
against the processed email IDs stored in memory.

This enables incremental daily runs where only new emails are analyzed.
"""

import logging
from typing import List, Dict, Any
from datetime import datetime

from ..state import WorkflowState, add_error, add_warning
from ...memory.manager import MemoryManager

logger = logging.getLogger(__name__)


def load_new_emails_node(
    state: WorkflowState,
    memory_manager: MemoryManager
) -> WorkflowState:
    """
    Load new emails that haven't been processed yet.

    Workflow Steps:
    1. Get list of already-processed email IDs from memory
    2. Filter out processed emails from input emails
    3. Update state with new emails and processed IDs
    4. Handle edge cases (no emails, all processed, etc.)

    Args:
        state: Current workflow state with user_id
        memory_manager: MemoryManager instance for retrieving processed IDs

    Returns:
        Updated state with:
        - emails: List of new (unprocessed) emails
        - processed_email_ids: List of already-processed IDs
        - total_emails: Count of new emails
        - current_email_index: Reset to 0

    Example:
        >>> state = {"user_id": "user_123", "emails": all_emails}
        >>> state = load_new_emails_node(state, memory_manager)
        >>> print(f"Processing {state['total_emails']} new emails")
    """
    try:
        logger.info(f"Loading emails for user: {state['user_id']}")

        # Get force_reprocess flag
        force_reprocess = state.get("force_reprocess", False)

        # Get processed email IDs from memory (unless force reprocess)
        if force_reprocess:
            logger.info("Force reprocess enabled - ignoring already-processed emails")
            processed_ids = []
        else:
            processed_ids = memory_manager.get_processed_email_ids()
            logger.info(f"Found {len(processed_ids)} already-processed emails")

        # Get input emails
        all_emails = state.get("emails", [])
        if not all_emails:
            logger.warning("No emails provided in state")
            state = add_warning(state, "No emails provided for processing")
            state["emails"] = []
            state["processed_email_ids"] = processed_ids
            state["total_emails"] = 0
            state["current_email_index"] = 0
            return state

        # Filter out already-processed emails (unless force reprocess)
        if force_reprocess:
            new_emails = all_emails
            logger.info(f"Processing all {len(all_emails)} emails (force reprocess)")
        else:
            processed_ids_set = set(processed_ids)
            new_emails = [
                email for email in all_emails
                if email.get("id") not in processed_ids_set
            ]

            # Log filtering results
            logger.info(
                f"Filtered {len(all_emails)} total emails → "
                f"{len(new_emails)} new emails to process"
            )

        if len(new_emails) == 0:
            logger.info("All emails already processed - nothing to do")
            state = add_warning(state, "All emails already processed")

        # Update state
        state["emails"] = new_emails
        state["processed_email_ids"] = processed_ids
        state["total_emails"] = len(new_emails)
        state["current_email_index"] = 0
        state["workflow_started_at"] = datetime.utcnow().isoformat() + "Z"

        logger.info(f"Load emails complete: {len(new_emails)} emails ready for processing")
        return state

    except Exception as e:
        logger.error(f"Error loading emails: {e}", exc_info=True)
        state = add_error(state, f"Failed to load emails: {str(e)}")
        state["emails"] = []
        state["total_emails"] = 0
        return state


def load_emails_from_csv(csv_path: str) -> List[Dict[str, Any]]:
    """
    Load emails from CSV file.

    Helper function for loading emails from processed CSV
    (e.g., emails_processed.csv from existing email parser).

    Args:
        csv_path: Path to CSV file with email data

    Returns:
        List of email dictionaries

    Example:
        >>> emails = load_emails_from_csv("emails_processed.csv")
        >>> state = {"user_id": "user_123", "emails": emails}
        >>> state = load_new_emails_node(state, memory_manager)
    """
    import pandas as pd

    try:
        df = pd.read_csv(csv_path)
        logger.info(f"Loaded {len(df)} emails from {csv_path}")

        # Convert DataFrame rows to dictionaries
        emails = []
        for idx, row in df.iterrows():
            # Handle both lowercase and capitalized column names
            email = {
                "id": str(row.get("ID") or row.get("id") or f"email_{idx}"),
                "subject": str(row.get("Subject") or row.get("subject") or ""),
                "summary": str(row.get("Summary") or row.get("summary") or ""),
                "from_addr": str(row.get("From") or row.get("from") or ""),
                "to_addr": str(row.get("To") or row.get("to") or ""),
                "date": str(row.get("Date") or row.get("date") or ""),
                # Include other CSV columns
                **{k: v for k, v in row.items() if k not in ["ID", "id", "Subject", "subject", "Summary", "summary", "From", "from", "To", "to", "Date", "date"]}
            }
            emails.append(email)

        return emails

    except Exception as e:
        logger.error(f"Error loading emails from CSV: {e}", exc_info=True)
        return []


def load_emails_from_provider(
    provider: str,
    user_id: str,
    max_emails: int = 100
) -> List[Dict[str, Any]]:
    """
    Load emails from email provider (Gmail, Outlook).

    Helper function for loading emails directly from provider.
    Uses existing email provider code from main.py.

    Args:
        provider: "gmail" or "outlook"
        user_id: User email address
        max_emails: Maximum number of emails to fetch

    Returns:
        List of email dictionaries

    Example:
        >>> emails = load_emails_from_provider("gmail", "user@gmail.com", max_emails=50)
        >>> state = {"user_id": "user_123", "emails": emails}
        >>> state = load_new_emails_node(state, memory_manager)
    """
    from ...providers.gmail_provider import GmailProvider
    from ...providers.outlook_provider import OutlookProvider

    try:
        # Initialize provider
        if provider.lower() == "gmail":
            email_provider = GmailProvider()
        elif provider.lower() == "outlook":
            email_provider = OutlookProvider()
        else:
            raise ValueError(f"Unknown provider: {provider}")

        # Fetch emails
        raw_emails = email_provider.get_emails(max_count=max_emails)
        logger.info(f"Fetched {len(raw_emails)} emails from {provider}")

        # Convert to standard format
        emails = []
        for raw_email in raw_emails:
            email = {
                "id": raw_email.get("id", ""),
                "subject": raw_email.get("subject", ""),
                "body": raw_email.get("body", ""),
                "from_addr": raw_email.get("from", ""),
                "to_addr": raw_email.get("to", ""),
                "date": raw_email.get("date", ""),
            }
            emails.append(email)

        return emails

    except Exception as e:
        logger.error(f"Error loading emails from provider: {e}", exc_info=True)
        return []