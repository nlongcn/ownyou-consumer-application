#!/usr/bin/env python3
"""
Convert IAB Taxonomy Excel to JSON for TypeScript

Extracts the IAB Audience Taxonomy from Excel and outputs JSON files
that can be imported by TypeScript.

Usage:
    python scripts/convert_taxonomy_to_json.py
"""

import json
from pathlib import Path
import sys

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from email_parser.utils.iab_taxonomy_loader import IABTaxonomyLoader


def main():
    """Convert taxonomy to JSON files."""
    print("Loading IAB Taxonomy from Excel...")

    loader = IABTaxonomyLoader()

    print(f"Loaded {len(loader.taxonomy_entries)} taxonomy entries")
    print(f"Loaded {len(loader.purchase_classifications)} purchase classifications")

    # Output directory
    output_dir = Path(__file__).parent.parent / "src" / "browser" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Write taxonomy entries
    taxonomy_file = output_dir / "iab_taxonomy.json"
    with open(taxonomy_file, 'w') as f:
        json.dump(loader.taxonomy_entries, f, indent=2)
    print(f"✅ Wrote {len(loader.taxonomy_entries)} entries to {taxonomy_file}")

    # Write purchase classifications
    purchase_file = output_dir / "iab_purchase_classifications.json"
    with open(purchase_file, 'w') as f:
        json.dump(loader.purchase_classifications, f, indent=2)
    print(f"✅ Wrote {len(loader.purchase_classifications)} purchase classifications to {purchase_file}")

    # Write by-section index
    sections_file = output_dir / "iab_sections.json"
    sections_data = {
        section: [entry['id'] for entry in entries]
        for section, entries in loader.taxonomy_by_section.items()
    }
    with open(sections_file, 'w') as f:
        json.dump(sections_data, f, indent=2)
    print(f"✅ Wrote section index to {sections_file}")

    # Statistics
    print("\nTaxonomy Statistics:")
    for section, entries in loader.taxonomy_by_section.items():
        print(f"  {section}: {len(entries)} entries")

    print("\n✅ Conversion complete!")
    print(f"\nFiles generated:")
    print(f"  - {taxonomy_file}")
    print(f"  - {purchase_file}")
    print(f"  - {sections_file}")


if __name__ == '__main__':
    main()
