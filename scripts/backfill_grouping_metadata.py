#!/usr/bin/env python3
"""
Backfill grouping_value and grouping_tier_key for existing memories.

This script updates all existing semantic memories in the database that are missing
the grouping_value field by looking up the taxonomy entry and adding the pre-computed
grouping metadata.
"""

import sys
import os
import sqlite3
import json

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.email_parser.utils.iab_taxonomy_loader import IABTaxonomyLoader


def backfill_grouping_metadata(db_path: str):
    """Backfill grouping metadata for all existing memories."""

    # Load taxonomy
    print("Loading IAB taxonomy...")
    taxonomy_loader = IABTaxonomyLoader()

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Find all semantic memories without grouping_value
    cursor.execute("""
        SELECT namespace, key, value
        FROM memories
        WHERE key LIKE 'semantic_%'
    """)

    rows = cursor.fetchall()
    print(f"Found {len(rows)} semantic memories to check")

    updated = 0
    skipped = 0

    for namespace, key, value_json in rows:
        value_data = json.loads(value_json)

        # Skip if already has grouping_value
        if value_data.get("grouping_value"):
            skipped += 1
            continue

        # Extract taxonomy_id
        taxonomy_id = value_data.get("taxonomy_id")
        if not taxonomy_id:
            print(f"  WARNING: No taxonomy_id for {key}")
            continue

        # Lookup taxonomy entry
        entry = taxonomy_loader.get_by_id(taxonomy_id)
        if not entry:
            print(f"  WARNING: No taxonomy entry for ID {taxonomy_id}")
            continue

        # Add grouping metadata
        value_data["grouping_tier_key"] = entry.get("grouping_tier_key", "tier_2")
        value_data["grouping_value"] = entry.get("grouping_value", "")

        # Update in database
        updated_json = json.dumps(value_data)
        cursor.execute("""
            UPDATE memories
            SET value = ?
            WHERE namespace = ? AND key = ?
        """, (updated_json, namespace, key))

        updated += 1

        if updated % 50 == 0:
            print(f"  Updated {updated} memories...")

    conn.commit()
    conn.close()

    print(f"\nBackfill complete!")
    print(f"  Updated: {updated}")
    print(f"  Skipped (already had grouping_value): {skipped}")
    print(f"  Total: {len(rows)}")


if __name__ == "__main__":
    db_path = os.getenv("MEMORY_DATABASE_PATH", "data/email_parser_memory.db")
    print(f"Using database: {db_path}\n")

    backfill_grouping_metadata(db_path)
