#!/usr/bin/env python3
"""
Import memories from JSON backup to SQLite database.

Usage:
    python scripts/import_memories.py --input backup.json --db data/email_parser_memory_new.db
    python scripts/import_memories.py --input backup.json --db data/email_parser_memory.db --merge
"""

import argparse
import json
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, Any


def create_tables(conn: sqlite3.Connection):
    """Create memories table if it doesn't exist."""
    cursor = conn.cursor()

    # Create memories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            namespace TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (namespace, key)
        )
    """)

    # Create indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_namespace
        ON memories(namespace)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_key
        ON memories(key)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_namespace_key
        ON memories(namespace, key)
    """)

    conn.commit()


def import_memories(input_file: str, db_path: str, merge: bool = False) -> Dict[str, Any]:
    """
    Import memories from JSON backup to SQLite database.

    Args:
        input_file: Path to JSON backup file
        db_path: Path to SQLite database (will be created if doesn't exist)
        merge: If True, merge with existing data; if False, fail if DB exists

    Returns:
        Dictionary containing import statistics
    """
    if not Path(input_file).exists():
        raise FileNotFoundError(f"Backup file not found: {input_file}")

    # Check if database exists
    db_exists = Path(db_path).exists()
    if db_exists and not merge:
        raise FileExistsError(
            f"Database already exists: {db_path}. Use --merge to merge with existing data."
        )

    # Load backup data
    with open(input_file, 'r') as f:
        backup_data = json.load(f)

    if "export_metadata" not in backup_data or "memories" not in backup_data:
        raise ValueError("Invalid backup file format")

    memories = backup_data["memories"]
    metadata = backup_data["export_metadata"]

    # Connect to database
    conn = sqlite3.connect(db_path)

    # Create tables if needed
    create_tables(conn)

    cursor = conn.cursor()

    # Import memories
    imported_count = 0
    skipped_count = 0
    updated_count = 0

    for memory in memories:
        namespace = memory["namespace"]
        key = memory["key"]
        value = json.dumps(memory["value"])  # Convert dict back to JSON string
        created_at = memory["created_at"]
        updated_at = memory["updated_at"]

        # Check if memory already exists
        cursor.execute(
            "SELECT updated_at FROM memories WHERE namespace = ? AND key = ?",
            (namespace, key)
        )
        existing = cursor.fetchone()

        if existing:
            if merge:
                # Update existing memory
                cursor.execute(
                    """UPDATE memories
                       SET value = ?, updated_at = ?
                       WHERE namespace = ? AND key = ?""",
                    (value, updated_at, namespace, key)
                )
                updated_count += 1
            else:
                skipped_count += 1
        else:
            # Insert new memory
            cursor.execute(
                """INSERT INTO memories (namespace, key, value, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (namespace, key, value, created_at, updated_at)
            )
            imported_count += 1

    conn.commit()

    # Get final count
    cursor.execute("SELECT COUNT(*) FROM memories")
    total_memories = cursor.fetchone()[0]

    conn.close()

    stats = {
        "imported": imported_count,
        "updated": updated_count,
        "skipped": skipped_count,
        "total_in_db": total_memories,
        "source_file": input_file,
        "target_db": db_path,
        "merge_mode": merge
    }

    print(f"✅ Import complete:")
    print(f"   Source: {input_file}")
    print(f"   Target DB: {db_path}")
    print(f"   Imported: {imported_count}")
    if merge:
        print(f"   Updated: {updated_count}")
        print(f"   Skipped: {skipped_count}")
    print(f"   Total in DB: {total_memories}")

    return stats


def main():
    parser = argparse.ArgumentParser(description="Import memories from JSON backup to SQLite")
    parser.add_argument("--input", required=True, help="Path to JSON backup file")
    parser.add_argument("--db", required=True, help="Path to SQLite database (will be created if doesn't exist)")
    parser.add_argument("--merge", action="store_true", help="Merge with existing database (update existing memories)")

    args = parser.parse_args()

    try:
        import_memories(args.input, args.db, args.merge)
    except Exception as e:
        print(f"❌ Import failed: {e}")
        exit(1)


if __name__ == "__main__":
    main()
