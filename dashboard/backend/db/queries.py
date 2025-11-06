#!/usr/bin/env python3
"""
Database Query Layer

Provides user-scoped database queries for dashboard API.
All queries enforce strict data isolation by user_id.
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime


def get_database_path() -> str:
    """Get database path from environment or use default."""
    default_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "data", "email_parser_memory.db"
    )
    return os.getenv("MEMORY_DATABASE_PATH", default_path)


def get_connection() -> sqlite3.Connection:
    """Get SQLite database connection with row factory."""
    conn = sqlite3.connect(get_database_path())
    conn.row_factory = sqlite3.Row
    return conn


# ============================================================================
# USER PROFILE QUERIES
# ============================================================================

def get_user_profile_summary(user_id: str) -> Dict[str, Any]:
    """
    Get summary statistics for a user's IAB profile.

    Args:
        user_id: User identifier

    Returns:
        Dictionary with profile summary statistics
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Count classifications by category
        # LangMem uses namespace format: "user_id/collection_name"
        # We query the iab_taxonomy_profile collection and filter by semantic memory keys
        cursor.execute("""
            SELECT
                COUNT(CASE WHEN key LIKE 'semantic_demographics_%' THEN 1 END) as demographics_count,
                COUNT(CASE WHEN key LIKE 'semantic_household_%' THEN 1 END) as household_count,
                COUNT(CASE WHEN key LIKE 'semantic_interests_%' THEN 1 END) as interests_count,
                COUNT(CASE WHEN key LIKE 'semantic_purchase_intent_%' THEN 1 END) as purchase_intent_count,
                COUNT(CASE WHEN key LIKE 'semantic_actual_purchases_%' THEN 1 END) as actual_purchases_count,
                COUNT(CASE WHEN key LIKE 'semantic_%' THEN 1 END) as total_count
            FROM memories
            WHERE namespace = ? || '/iab_taxonomy_profile'
        """, (user_id,))

        row = cursor.fetchone()

        summary = {
            "user_id": user_id,
            "demographics": row["demographics_count"] if row else 0,
            "household": row["household_count"] if row else 0,
            "interests": row["interests_count"] if row else 0,
            "purchase_intent": row["purchase_intent_count"] if row else 0,
            "actual_purchases": row["actual_purchases_count"] if row else 0,
            "total_classifications": row["total_count"] if row else 0
        }

        conn.close()
        return summary
    except (sqlite3.OperationalError, sqlite3.DatabaseError) as e:
        # Database doesn't exist or table missing - return empty profile
        import logging
        logging.error(f"Database error for user {user_id}: {e}")
        return {
            "user_id": user_id,
            "demographics": 0,
            "household": 0,
            "interests": 0,
            "purchase_intent": 0,
            "actual_purchases": 0,
            "total_classifications": 0
        }


def get_all_classifications(user_id: str, section: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all classifications for a user, optionally filtered by section.

    Args:
        user_id: User identifier
        section: Optional section filter (demographics, household, interests, etc.)

    Returns:
        List of classification dictionaries
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        namespace = f"{user_id}/iab_taxonomy_profile"

        if section:
            # Filter by section prefix (semantic memories only)
            cursor.execute("""
                SELECT key, value, created_at, updated_at
                FROM memories
                WHERE namespace = ? AND key LIKE ?
                ORDER BY key
            """, (namespace, f"semantic_{section}_%"))
        else:
            # Get all semantic classifications (not episodic)
            cursor.execute("""
                SELECT key, value, created_at, updated_at
                FROM memories
                WHERE namespace = ? AND key LIKE 'semantic_%'
                ORDER BY key
            """, (namespace,))

        rows = cursor.fetchall()
        classifications = []

        for row in rows:
            # Parse the stored JSON value
            value_data = json.loads(row["value"])

            # Extract section and category from key
            # Key format: "semantic_section_taxonomyid_name"
            # Example: "semantic_interests_342_cryptocurrency"
            key = row["key"]
            parts = key.split("_", 2)  # Split into ["semantic", "section", "rest"]

            if len(parts) >= 2:
                section_name = parts[1]  # "interests", "demographics", etc.
            else:
                section_name = "unknown"

            # Get category name from value_data
            category = value_data.get("value", value_data.get("tier_2", ""))

            classifications.append({
                "section": section_name,
                "category": category,
                "taxonomy_id": value_data.get("taxonomy_id"),
                "value": value_data.get("value", category),
                "confidence": value_data.get("confidence"),
                "evidence_count": value_data.get("evidence_count"),
                "last_validated": value_data.get("last_validated"),
                "tier_path": value_data.get("category_path", ""),
                "purchase_intent_flag": value_data.get("purchase_intent_flag"),
                # Add tier fields for tiered classification support
                "tier_1": value_data.get("tier_1", ""),
                "tier_2": value_data.get("tier_2", ""),
                "tier_3": value_data.get("tier_3", ""),
                "tier_4": value_data.get("tier_4", ""),
                "tier_5": value_data.get("tier_5", ""),
                # Add grouping metadata for proper tiered classification
                "grouping_tier_key": value_data.get("grouping_tier_key", ""),
                "grouping_value": value_data.get("grouping_value", ""),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })

        conn.close()
        return classifications
    except (sqlite3.OperationalError, sqlite3.DatabaseError) as e:
        # Database doesn't exist or table missing - return empty list
        return []


def get_tiered_classifications(user_id: str, section: Optional[str] = None) -> Dict[str, Any]:
    """
    Get tiered classification structure for user with primary/alternative classifications.

    Args:
        user_id: User identifier
        section: Optional section filter (demographics, household, interests, purchase_intent)

    Returns:
        Dictionary with tiered classification structure:
        {
            "schema_version": "2.0",
            "demographics": {
                "gender": {
                    "primary": {...},
                    "alternatives": [...],
                    "selection_method": "highest_confidence"
                },
                ...
            },
            "household": {...},
            "interests": [{...}, ...],
            "purchase_intent": [{...}, ...]
        }
    """
    import sys
    import os
    # Add project root to path to import tier selector
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)

    from src.email_parser.utils.profile_tier_formatter import (
        format_tiered_demographics,
        format_tiered_household,
        format_tiered_interests,
        format_tiered_purchase_intent
    )

    # Get all classifications for user
    all_classifications = get_all_classifications(user_id)

    # Group by section
    memories_by_section = {
        "demographics": [],
        "household": [],
        "interests": [],
        "purchase_intent": []
    }

    for classification in all_classifications:
        section_name = classification.get("section", "unknown")
        if section_name in memories_by_section:
            memories_by_section[section_name].append(classification)

    # If section filter specified, return only that section
    if section:
        if section not in memories_by_section:
            return {"error": f"Invalid section: {section}"}

        # Format the specific section
        if section == "demographics":
            return format_tiered_demographics(memories_by_section["demographics"])
        elif section == "household":
            return format_tiered_household(memories_by_section["household"])
        elif section == "interests":
            return format_tiered_interests(memories_by_section["interests"])
        elif section == "purchase_intent":
            return format_tiered_purchase_intent(memories_by_section["purchase_intent"])

    # Return full tiered structure
    result = {
        "schema_version": "2.0",
        "demographics": format_tiered_demographics(memories_by_section["demographics"]),
        "household": format_tiered_household(memories_by_section["household"]),
        "interests": format_tiered_interests(memories_by_section["interests"]),
        "purchase_intent": format_tiered_purchase_intent(memories_by_section["purchase_intent"])
    }

    return result


# ============================================================================
# CONFIDENCE TRACKING QUERIES
# ============================================================================

def get_classification_history(user_id: str, taxonomy_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Get confidence evolution history for classifications.

    Args:
        user_id: User identifier
        taxonomy_id: Optional taxonomy ID to filter specific classification

    Returns:
        List of history snapshots
    """
    conn = get_connection()
    cursor = conn.cursor()

    if taxonomy_id:
        cursor.execute("""
            SELECT *
            FROM classification_history
            WHERE user_id = ? AND taxonomy_id = ?
            ORDER BY snapshot_date ASC
        """, (user_id, taxonomy_id))
    else:
        cursor.execute("""
            SELECT *
            FROM classification_history
            WHERE user_id = ?
            ORDER BY snapshot_date ASC, taxonomy_id ASC
        """, (user_id,))

    rows = cursor.fetchall()
    history = [dict(row) for row in rows]

    conn.close()
    return history


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


# ============================================================================
# COST TRACKING QUERIES
# ============================================================================

def get_cost_summary(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Get recent cost tracking records for a user.

    Args:
        user_id: User identifier
        limit: Maximum number of records to return

    Returns:
        List of cost tracking records
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM cost_tracking
        WHERE user_id = ?
        ORDER BY run_date DESC
        LIMIT ?
    """, (user_id, limit))

    rows = cursor.fetchall()
    costs = [dict(row) for row in rows]

    conn.close()
    return costs


def get_total_cost(user_id: str) -> Dict[str, Any]:
    """
    Get total LLM costs for a user across all runs.

    Args:
        user_id: User identifier

    Returns:
        Dictionary with total cost breakdown
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            SUM(total_cost) as total_cost,
            COUNT(*) as total_runs,
            AVG(total_cost) as avg_cost_per_run
        FROM cost_tracking
        WHERE user_id = ?
    """, (user_id,))

    row = cursor.fetchone()

    # Get unique email count from episodic memories (actual emails in user's profile)
    # Episodic memories store individual email observations
    namespace = f"{user_id}/iab_taxonomy_profile"
    cursor.execute("""
        SELECT COUNT(DISTINCT key) as email_count
        FROM memories
        WHERE namespace = ? AND key LIKE 'episodic_%'
    """, (namespace,))

    email_row = cursor.fetchone()
    total_emails = email_row["email_count"] if email_row else 0

    # Cost by provider
    cursor.execute("""
        SELECT
            provider,
            SUM(total_cost) as provider_cost,
            SUM(email_count) as provider_emails
        FROM cost_tracking
        WHERE user_id = ?
        GROUP BY provider
    """, (user_id,))

    provider_rows = cursor.fetchall()
    by_provider = [dict(row) for row in provider_rows]

    conn.close()

    return {
        "total_cost": row["total_cost"] or 0.0,
        "total_emails": total_emails,
        "total_runs": row["total_runs"] or 0,
        "avg_cost_per_run": row["avg_cost_per_run"] or 0.0,
        "by_provider": by_provider
    }


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


# ============================================================================
# ANALYSIS RUN QUERIES
# ============================================================================

def get_analysis_runs(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Get recent analysis runs for a user.

    Args:
        user_id: User identifier
        limit: Maximum number of records to return

    Returns:
        List of analysis run records
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT *
        FROM analysis_runs
        WHERE user_id = ?
        ORDER BY run_date DESC
        LIMIT ?
    """, (user_id, limit))

    rows = cursor.fetchall()
    runs = [dict(row) for row in rows]

    conn.close()
    return runs


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


# ============================================================================
# EVIDENCE & EPISODIC MEMORY QUERIES
# ============================================================================

def get_all_profile_memories(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all semantic memories (IAB classifications) for a user.

    Args:
        user_id: User identifier

    Returns:
        List of semantic memory dictionaries with all fields
    """
    conn = get_connection()
    cursor = conn.cursor()

    namespace = f"{user_id}/iab_taxonomy_profile"

    cursor.execute("""
        SELECT value
        FROM memories
        WHERE namespace = ?
        AND key LIKE 'semantic_%'
    """, (namespace,))

    memories = []
    for row in cursor.fetchall():
        memory = json.loads(row['value'])
        memories.append(memory)

    conn.close()
    return memories


def get_memory_by_key(user_id: str, key: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific memory by its key.

    Args:
        user_id: User identifier
        key: Memory key (e.g., "episodic_email_abc123")

    Returns:
        Memory dictionary or None if not found
    """
    conn = get_connection()
    cursor = conn.cursor()

    namespace = f"{user_id}/iab_taxonomy_profile"

    cursor.execute("""
        SELECT value
        FROM memories
        WHERE namespace = ?
        AND key = ?
    """, (namespace, key))

    row = cursor.fetchone()
    conn.close()

    if row:
        return json.loads(row['value'])
    return None
