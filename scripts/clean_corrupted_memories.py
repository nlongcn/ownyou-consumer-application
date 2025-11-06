#!/usr/bin/env python3
"""
Clean Corrupted Semantic Memories

This script identifies and removes semantic memories with mismatched taxonomy_id/value pairs.
These corrupted entries were created before validation was added to prevent LLM errors.

Usage:
    python scripts/clean_corrupted_memories.py
    python scripts/clean_corrupted_memories.py --dry-run  # Preview without deleting

The script validates each memory by:
1. Loading the taxonomy entry for the stored taxonomy_id
2. Extracting the correct value from the taxonomy entry
3. Comparing with the stored value
4. Deleting if mismatch found
"""

import sys
import os
import sqlite3
import json
import argparse

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.email_parser.utils.iab_taxonomy_loader import IABTaxonomyLoader


def get_taxonomy_value(taxonomy_entry: dict) -> str:
    """
    Extract the actual classification value from a taxonomy entry.

    The value is the deepest non-empty tier (tier_5 > tier_4 > tier_3).
    """
    # Check tiers from deepest to shallowest
    for tier_key in ['tier_5', 'tier_4', 'tier_3']:
        value = taxonomy_entry.get(tier_key, "").strip()
        if value:
            return value

    # Fallback to tier_2 if all deeper tiers are empty
    return taxonomy_entry.get('tier_2', "").strip()


def validate_memory(memory_data: dict, taxonomy_loader: IABTaxonomyLoader) -> tuple[bool, str]:
    """
    Validate that a memory's taxonomy_id matches its value.

    Args:
        memory_data: The semantic memory dict
        taxonomy_loader: IABTaxonomyLoader instance

    Returns:
        (is_valid, reason) - True if valid, False if corrupted
    """
    taxonomy_id = memory_data.get("taxonomy_id")
    stored_value = memory_data.get("value", "").strip()

    if not taxonomy_id:
        return False, "Missing taxonomy_id"

    if not stored_value:
        return False, "Missing value"

    # Lookup taxonomy entry
    taxonomy_entry = taxonomy_loader.taxonomy_by_id.get(taxonomy_id)
    if not taxonomy_entry:
        return False, f"Taxonomy ID {taxonomy_id} not found in taxonomy"

    # Get expected value from taxonomy
    expected_value = get_taxonomy_value(taxonomy_entry)

    # Normalize for comparison
    stored_normalized = stored_value.strip().lower()
    expected_normalized = expected_value.strip().lower()

    if stored_normalized != expected_normalized:
        return False, f"Mismatch: stored='{stored_value}', expected='{expected_value}'"

    return True, "Valid"


def clean_corrupted_memories(db_path: str, dry_run: bool = False):
    """
    Clean corrupted semantic memories from database.

    Args:
        db_path: Path to SQLite database
        dry_run: If True, only report issues without deleting
    """
    print(f"Cleaning corrupted memories from: {db_path}")
    print(f"Mode: {'DRY RUN (no changes will be made)' if dry_run else 'LIVE (will delete corrupted entries)'}\n")

    # Load taxonomy
    print("Loading IAB taxonomy...")
    taxonomy_loader = IABTaxonomyLoader()
    print(f"Loaded {len(taxonomy_loader.taxonomy_by_id)} taxonomy entries\n")

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Find all semantic memories
    cursor.execute("""
        SELECT namespace, key, value
        FROM memories
        WHERE key LIKE 'semantic_%'
    """)

    rows = cursor.fetchall()
    print(f"Found {len(rows)} semantic memories to validate\n")

    # Validate each memory
    corrupted = []
    valid = 0
    errors = 0

    for namespace, key, value_json in rows:
        try:
            memory_data = json.loads(value_json)
            is_valid, reason = validate_memory(memory_data, taxonomy_loader)

            if is_valid:
                valid += 1
            else:
                corrupted.append({
                    "namespace": namespace,
                    "key": key,
                    "taxonomy_id": memory_data.get("taxonomy_id"),
                    "stored_value": memory_data.get("value"),
                    "section": memory_data.get("section"),
                    "reason": reason
                })

        except Exception as e:
            errors += 1
            print(f"  ERROR: Failed to validate {key}: {e}")

    # Report findings
    print("=" * 80)
    print(f"VALIDATION RESULTS:")
    print(f"  Valid memories: {valid}")
    print(f"  Corrupted memories: {len(corrupted)}")
    print(f"  Errors: {errors}")
    print("=" * 80)

    if corrupted:
        print(f"\nCorrupted entries found:")
        print("-" * 80)

        # Group by section for easier reading
        by_section = {}
        for entry in corrupted:
            section = entry["section"]
            if section not in by_section:
                by_section[section] = []
            by_section[section].append(entry)

        for section, entries in sorted(by_section.items()):
            print(f"\n{section.upper()} ({len(entries)} corrupted):")
            for entry in entries:
                print(f"  - ID {entry['taxonomy_id']}: stored='{entry['stored_value']}'")
                print(f"    {entry['reason']}")
                print(f"    key: {entry['key']}")

        # Delete corrupted entries
        if not dry_run:
            print("\n" + "=" * 80)
            print(f"DELETING {len(corrupted)} corrupted memories...")
            print("=" * 80)

            deleted = 0
            for entry in corrupted:
                try:
                    cursor.execute("""
                        DELETE FROM memories
                        WHERE namespace = ? AND key = ?
                    """, (entry["namespace"], entry["key"]))
                    deleted += 1
                except Exception as e:
                    print(f"  ERROR: Failed to delete {entry['key']}: {e}")

            conn.commit()
            print(f"\nDeleted {deleted}/{len(corrupted)} corrupted memories")
        else:
            print("\n" + "=" * 80)
            print(f"DRY RUN: Would delete {len(corrupted)} corrupted memories")
            print("Run without --dry-run to perform actual deletion")
            print("=" * 80)
    else:
        print("\n✓ No corrupted memories found! Database is clean.")

    conn.close()

    print(f"\nCleanup complete!")
    print(f"  Total memories processed: {len(rows)}")
    print(f"  Valid: {valid}")
    print(f"  Corrupted: {len(corrupted)}")
    if not dry_run and corrupted:
        print(f"  Deleted: {len(corrupted)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Clean corrupted semantic memories from database"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview corrupted entries without deleting"
    )
    parser.add_argument(
        "--db",
        default=None,
        help="Path to database (defaults to MEMORY_DATABASE_PATH env var)"
    )

    args = parser.parse_args()

    # Get database path
    db_path = args.db or os.getenv("MEMORY_DATABASE_PATH", "data/email_parser_memory.db")

    if not os.path.exists(db_path):
        print(f"ERROR: Database not found: {db_path}")
        sys.exit(1)

    clean_corrupted_memories(db_path, dry_run=args.dry_run)
