#!/usr/bin/env python3
"""
Export all memories from SQLite database to JSON.

Usage:
    python scripts/export_memories.py --db data/email_parser_memory.db --output backup.json
    python scripts/export_memories.py --db data/email_parser_memory.db --output backup.json --user-id specific_user
"""

import argparse
import json
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any


def export_memories(db_path: str, output_file: str, user_id: str = None) -> Dict[str, Any]:
    """
    Export all memories from SQLite database to JSON.

    Args:
        db_path: Path to SQLite database
        output_file: Path to output JSON file
        user_id: Optional user_id to export only specific user's data

    Returns:
        Dictionary containing export metadata and memories
    """
    if not Path(db_path).exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Access columns by name
    cursor = conn.cursor()

    # Get all memories
    if user_id:
        cursor.execute(
            "SELECT namespace, key, value, created_at, updated_at FROM memories WHERE namespace = ?",
            (f"user:{user_id}",)
        )
        namespaces = [f"user:{user_id}"]
    else:
        cursor.execute("SELECT namespace, key, value, created_at, updated_at FROM memories")
        cursor.execute("SELECT DISTINCT namespace FROM memories")
        namespaces = [row[0] for row in cursor.fetchall()]

    # Fetch all rows again
    cursor.execute("SELECT namespace, key, value, created_at, updated_at FROM memories" +
                   (" WHERE namespace = ?" if user_id else ""),
                   (f"user:{user_id}",) if user_id else ())
    rows = cursor.fetchall()

    # Build export data structure
    memories = []
    for row in rows:
        memory_data = {
            "namespace": row["namespace"],
            "key": row["key"],
            "value": json.loads(row["value"]),  # Parse stored JSON
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }
        memories.append(memory_data)

    # Get database stats
    cursor.execute("SELECT COUNT(*) FROM memories")
    total_memories = cursor.fetchone()[0]

    # Build export metadata
    export_data = {
        "export_metadata": {
            "exported_at": datetime.now().isoformat() + "Z",
            "source_db": db_path,
            "total_memories": len(memories),
            "total_db_memories": total_memories,
            "user_id_filter": user_id,
            "namespaces": namespaces,
            "schema_version": "1.0"
        },
        "memories": memories
    }

    # Write to JSON file
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        json.dump(export_data, f, indent=2)

    conn.close()

    print(f"✅ Export complete:")
    print(f"   Source DB: {db_path}")
    print(f"   Output: {output_file}")
    print(f"   Memories exported: {len(memories)}")
    print(f"   Namespaces: {len(namespaces)}")
    if user_id:
        print(f"   User filter: {user_id}")

    return export_data


def main():
    parser = argparse.ArgumentParser(description="Export memories from SQLite database to JSON")
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--output", required=True, help="Path to output JSON file")
    parser.add_argument("--user-id", help="Export only specific user's data")

    args = parser.parse_args()

    try:
        export_memories(args.db, args.output, args.user_id)
    except Exception as e:
        print(f"❌ Export failed: {e}")
        exit(1)


if __name__ == "__main__":
    main()
