#!/usr/bin/env python3
"""
Database Migration Script

Applies dashboard schema extensions to existing SQLite database.
"""

import sqlite3
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def get_database_path() -> str:
    """Get database path from environment or use default."""
    default_path = "data/email_parser_memory.db"
    db_path = os.getenv("MEMORY_DATABASE_PATH", default_path)
    return db_path


def apply_migrations(db_path: Optional[str] = None) -> bool:
    """
    Apply dashboard schema extensions to the database.

    Args:
        db_path: Path to SQLite database file. If None, uses MEMORY_DATABASE_PATH env var.

    Returns:
        True if migrations applied successfully, False otherwise.
    """
    if db_path is None:
        db_path = get_database_path()

    # Ensure database exists
    if not os.path.exists(db_path):
        logger.error(f"Database not found: {db_path}")
        return False

    # Get SQL migrations
    script_dir = Path(__file__).parent
    sql_file = script_dir / "schema_extensions.sql"

    if not sql_file.exists():
        logger.error(f"Migration SQL file not found: {sql_file}")
        return False

    try:
        # Read SQL migration script
        with open(sql_file, 'r') as f:
            sql_script = f.read()

        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        logger.info(f"Applying migrations to: {db_path}")

        # Execute migrations using executescript for better SQL compatibility
        cursor.executescript(sql_script)
        logger.debug("Executed migration script")

        conn.commit()
        conn.close()

        logger.info("✅ Migrations applied successfully")
        return True

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False


def verify_schema(db_path: Optional[str] = None) -> dict:
    """
    Verify that all expected tables and columns exist.

    Args:
        db_path: Path to SQLite database file.

    Returns:
        Dictionary with verification results.
    """
    if db_path is None:
        db_path = get_database_path()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    results = {
        "tables": {},
        "columns": {}
    }

    # Check tables
    expected_tables = ["cost_tracking", "classification_history", "analysis_runs"]
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = [row[0] for row in cursor.fetchall()]

    for table in expected_tables:
        results["tables"][table] = table in existing_tables

    # Check new columns in semantic_memory
    cursor.execute("PRAGMA table_info(semantic_memory)")
    semantic_columns = [row[1] for row in cursor.fetchall()]
    results["columns"]["semantic_memory.llm_reasoning"] = "llm_reasoning" in semantic_columns

    # Check new columns in episodic_memory
    cursor.execute("PRAGMA table_info(episodic_memory)")
    episodic_columns = [row[1] for row in cursor.fetchall()]
    results["columns"]["episodic_memory.email_summary"] = "email_summary" in episodic_columns

    conn.close()
    return results


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    # Apply migrations
    success = apply_migrations()

    if success:
        # Verify schema
        verification = verify_schema()
        print("\nSchema Verification:")
        print("=" * 50)
        print("\nTables:")
        for table, exists in verification["tables"].items():
            status = "✅" if exists else "❌"
            print(f"  {status} {table}")
        print("\nColumns:")
        for column, exists in verification["columns"].items():
            status = "✅" if exists else "❌"
            print(f"  {status} {column}")
        print("=" * 50)
    else:
        print("\n❌ Migration failed. Check logs for details.")
