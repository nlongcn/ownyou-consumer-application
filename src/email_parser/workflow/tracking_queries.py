#!/usr/bin/env python3
"""
Tracking Queries - Migrated from dashboard/backend/db/queries.py

Contains only the tracking-specific queries needed by WorkflowTracker:
- save_classification_snapshot
- save_cost_record
- save_analysis_run

This module was created to remove the dependency on dashboard/backend/
allowing that directory to be safely deleted.
"""

import sqlite3
import os
from typing import Optional
from datetime import datetime


def get_database_path() -> str:
    """Get database path from environment or use default."""
    default_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "data", "email_parser_memory.db"
    )
    return os.getenv("MEMORY_DATABASE_PATH", default_path)


def get_connection() -> sqlite3.Connection:
    """Get SQLite database connection with row factory."""
    conn = sqlite3.connect(get_database_path())
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_tables_exist(conn: sqlite3.Connection) -> None:
    """Ensure tracking tables exist (creates if missing)."""
    cursor = conn.cursor()

    # Classification history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS classification_history (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            taxonomy_id INTEGER NOT NULL,
            confidence REAL NOT NULL,
            evidence_count INTEGER NOT NULL,
            snapshot_date TEXT NOT NULL
        )
    """)

    # Cost tracking table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cost_tracking (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            run_date TEXT NOT NULL,
            provider TEXT NOT NULL,
            model_name TEXT,
            total_cost REAL NOT NULL,
            input_tokens INTEGER,
            output_tokens INTEGER,
            email_count INTEGER NOT NULL
        )
    """)

    # Analysis runs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_runs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            run_date TEXT NOT NULL,
            emails_processed INTEGER NOT NULL,
            classifications_added INTEGER NOT NULL,
            classifications_updated INTEGER NOT NULL,
            total_cost REAL,
            duration_seconds REAL,
            status TEXT NOT NULL,
            provider TEXT,
            model TEXT,
            started_at TEXT,
            completed_at TEXT
        )
    """)

    conn.commit()


def save_classification_snapshot(
    user_id: str,
    taxonomy_id: int,
    confidence: float,
    evidence_count: int,
    snapshot_date: Optional[str] = None
) -> str:
    """
    Save a snapshot of classification confidence for historical tracking.

    Args:
        user_id: User identifier
        taxonomy_id: IAB taxonomy ID
        confidence: Current confidence score
        evidence_count: Number of evidence items
        snapshot_date: Optional date (defaults to now)

    Returns:
        Snapshot ID
    """
    conn = get_connection()
    _ensure_tables_exist(conn)
    cursor = conn.cursor()

    if snapshot_date is None:
        snapshot_date = datetime.utcnow().isoformat()

    snapshot_id = f"{user_id}_{taxonomy_id}_{snapshot_date}"

    cursor.execute("""
        INSERT OR REPLACE INTO classification_history
        (id, user_id, taxonomy_id, confidence, evidence_count, snapshot_date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (snapshot_id, user_id, taxonomy_id, confidence, evidence_count, snapshot_date))

    conn.commit()
    conn.close()

    return snapshot_id


def save_cost_record(
    user_id: str,
    run_date: str,
    provider: str,
    total_cost: float,
    email_count: int,
    model_name: Optional[str] = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None
) -> str:
    """
    Save a cost tracking record.

    Args:
        user_id: User identifier
        run_date: Date of analysis run
        provider: LLM provider (openai, claude, ollama)
        total_cost: Total cost in USD
        email_count: Number of emails processed
        model_name: Optional model name
        input_tokens: Optional input token count
        output_tokens: Optional output token count

    Returns:
        Cost record ID
    """
    conn = get_connection()
    _ensure_tables_exist(conn)
    cursor = conn.cursor()

    record_id = f"{user_id}_{provider}_{run_date}"

    cursor.execute("""
        INSERT OR REPLACE INTO cost_tracking
        (id, user_id, run_date, provider, model_name, total_cost,
         input_tokens, output_tokens, email_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (record_id, user_id, run_date, provider, model_name, total_cost,
          input_tokens, output_tokens, email_count))

    conn.commit()
    conn.close()

    return record_id


def save_analysis_run(
    user_id: str,
    run_date: str,
    emails_processed: int,
    classifications_added: int,
    classifications_updated: int,
    total_cost: Optional[float] = None,
    duration_seconds: Optional[float] = None,
    status: str = "completed",
    provider: Optional[str] = None,
    model: Optional[str] = None,
    started_at: Optional[str] = None,
    completed_at: Optional[str] = None
) -> str:
    """
    Save an analysis run record.

    Args:
        user_id: User identifier
        run_date: Date of analysis run
        emails_processed: Number of emails processed
        classifications_added: Number of new classifications
        classifications_updated: Number of updated classifications
        total_cost: Optional total cost
        duration_seconds: Optional duration in seconds
        status: Run status (completed, failed, etc.)
        provider: Optional email provider (gmail, outlook, both)
        model: Optional LLM model used
        started_at: Optional start timestamp
        completed_at: Optional completion timestamp

    Returns:
        Run record ID
    """
    conn = get_connection()
    _ensure_tables_exist(conn)
    cursor = conn.cursor()

    run_id = f"{user_id}_{run_date}"

    cursor.execute("""
        INSERT OR REPLACE INTO analysis_runs
        (id, user_id, run_date, emails_processed, classifications_added,
         classifications_updated, total_cost, duration_seconds, status,
         provider, model, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (run_id, user_id, run_date, emails_processed, classifications_added,
          classifications_updated, total_cost, duration_seconds, status,
          provider, model, started_at, completed_at))

    conn.commit()
    conn.close()

    return run_id
