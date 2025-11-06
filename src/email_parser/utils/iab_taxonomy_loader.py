#!/usr/bin/env python3
"""
IAB Taxonomy Loader - Parse and Index IAB Audience Taxonomy 1.1

Loads the IAB Tech Lab Audience Taxonomy from Excel file and provides
fast lookup tables for taxonomy classification.

Reference: docs/IAB_TAXONOMY_PROFILE_REQUIREMENTS.md
"""

import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import logging

from .singleton import Singleton

# Configure logging
logger = logging.getLogger(__name__)


class IABTaxonomyLoader(metaclass=Singleton):
    """Load and index IAB Audience Taxonomy 1.1 from Excel file."""

    # Row range mappings from requirements document
    ROW_RANGES = {
        "demographics": {
            "age_range": (11, 24),
            "education_occupation": (27, 57),
            "gender": (59, 62),
        },
        "household_data": (64, 168),
        "personal_attributes": (169, 172),
        "personal_finance": (175, 207),
        "interests": (209, 704),
        "purchase_intent": (707, 1568),
    }

    def __init__(self, taxonomy_file_path: Optional[str] = None):
        """
        Initialize taxonomy loader.

        Args:
            taxonomy_file_path: Path to IABTL-Audience-Taxonomy-1.1-Final.xlsx
                               If None, uses default location.
        """
        if taxonomy_file_path is None:
            # Default to project root
            project_root = Path(__file__).parent.parent.parent.parent
            taxonomy_file_path = project_root / "IABTL-Audience-Taxonomy-1.1-Final.xlsx"

        self.taxonomy_file_path = Path(taxonomy_file_path)

        if not self.taxonomy_file_path.exists():
            raise FileNotFoundError(
                f"IAB Taxonomy file not found: {self.taxonomy_file_path}"
            )

        # Storage for parsed data
        self.taxonomy_entries: List[Dict[str, Any]] = []
        self.taxonomy_by_id: Dict[int, Dict[str, Any]] = {}
        self.taxonomy_by_section: Dict[str, List[Dict[str, Any]]] = {}
        self.purchase_classifications: Dict[str, str] = {}
        self.parent_child_map: Dict[int, List[int]] = {}

        # Load data
        self._load_taxonomy()
        self._load_purchase_classifications()
        self._build_indexes()
        self._compute_grouping_metadata()

        logger.info(
            f"Loaded {len(self.taxonomy_entries)} taxonomy entries and "
            f"{len(self.purchase_classifications)} purchase classifications"
        )

    def _load_taxonomy(self) -> None:
        """Load main taxonomy sheet from Excel file."""
        logger.info(f"Loading taxonomy from {self.taxonomy_file_path}")

        # Load 'Consolidated' sheet
        # Column 0 is empty, actual data starts at column 1
        # Row 9 (0-indexed) has headers, data starts at row 10
        df = pd.read_excel(
            self.taxonomy_file_path,
            sheet_name='Consolidated',
            header=None,  # No header, we'll use column indices
        )

        # Column mapping (actual columns, 0-indexed):
        # Column 0: Empty (NaN)
        # Column 1: Unique ID
        # Column 2: Parent ID
        # Column 3: Condensed Name
        # Column 4: Tier 1
        # Column 5: Tier 2
        # Column 6: Tier 3
        # Column 7: Tier 4
        # Column 8: Tier 5

        for idx, row in df.iterrows():
            # Skip header rows (0-9)
            if idx < 10:
                continue

            # Skip rows where ID column is empty
            if pd.isna(row[1]):
                continue

            entry = {
                "id": int(row[1]) if not pd.isna(row[1]) else None,
                "parent_id": int(row[2]) if not pd.isna(row[2]) else None,
                "name": str(row[3]) if not pd.isna(row[3]) else "",
                "tier_1": str(row[4]) if not pd.isna(row[4]) else "",
                "tier_2": str(row[5]) if not pd.isna(row[5]) else "",
                "tier_3": str(row[6]) if not pd.isna(row[6]) else "",
                "tier_4": str(row[7]) if not pd.isna(row[7]) else "",
                "tier_5": str(row[8]) if not pd.isna(row[8]) else "",
                "excel_row": idx + 1,  # Actual Excel row (1-indexed)
            }

            self.taxonomy_entries.append(entry)

        logger.info(f"Loaded {len(self.taxonomy_entries)} taxonomy entries")

    def _load_purchase_classifications(self) -> None:
        """Load Purchase Intent Classification codes from second sheet."""
        logger.info("Loading purchase intent classifications")

        # Load 'Purchase Intent Classification' sheet
        df = pd.read_excel(
            self.taxonomy_file_path,
            sheet_name='Purchase Intent Classification ',  # Note the space
            header=None
        )

        # Columns: A=Code, B=Description
        # Start from row 2 (0-indexed row 1) after header
        for idx, row in df.iterrows():
            if idx < 2:  # Skip header rows
                continue

            code = row[0]
            description = row[1]

            # Skip empty rows or section headers
            if pd.isna(code) or not isinstance(code, str):
                continue

            if code.startswith('PIP'):  # PIPR, PIPF, PIPV, PIFI codes
                self.purchase_classifications[code] = str(description)

        logger.info(
            f"Loaded {len(self.purchase_classifications)} "
            "purchase intent classification codes"
        )

    def _build_indexes(self) -> None:
        """Build fast lookup indexes for taxonomy data."""
        logger.info("Building taxonomy indexes")

        # Index by taxonomy ID
        for entry in self.taxonomy_entries:
            if entry['id'] is not None:
                self.taxonomy_by_id[entry['id']] = entry

        # Build parent-child relationship map
        for entry in self.taxonomy_entries:
            if entry['parent_id'] is not None:
                parent_id = entry['parent_id']
                if parent_id not in self.parent_child_map:
                    self.parent_child_map[parent_id] = []
                self.parent_child_map[parent_id].append(entry['id'])

        # Index by section (using row ranges from requirements)
        self.taxonomy_by_section = {
            "demographics": self._get_entries_in_range(11, 62),
            "household_data": self._get_entries_in_range(64, 168),
            "personal_attributes": self._get_entries_in_range(169, 172),
            "personal_finance": self._get_entries_in_range(175, 207),
            "interests": self._get_entries_in_range(209, 704),
            "purchase_intent": self._get_entries_in_range(707, 1568),
        }

        logger.info("Taxonomy indexes built successfully")

    def _compute_grouping_metadata(self) -> None:
        """
        Compute grouping metadata for each taxonomy entry.

        Determines which tier should be used for grouping based on parent structure:
        - If parent has no tier_3: use tier_2 as grouping key
        - If parent has tier_3: use tier_3 as grouping key

        This allows proper handling of cases like:
        - Gender (ID 48): Demographic | Gender (no tier_3) → group by tier_2="Gender"
        - Female (ID 49): Demographic | Gender | Female → grouped by tier_2="Gender"
        - Education (ID 12): Demographic | Education & Occupation | Education (Highest Level) → group by tier_3
        - College (ID 20): grouped by tier_3="Education (Highest Level)"
        """
        logger.info("Computing grouping metadata for taxonomy entries")

        for entry in self.taxonomy_entries:
            parent_id = entry.get('parent_id')

            # Handle root-level entries (no parent or self-referential)
            if not parent_id or parent_id == entry['id']:
                # Root entry - determine grouping based on its own structure
                if entry.get('tier_3'):
                    entry['grouping_tier_key'] = 'tier_3'
                    entry['grouping_value'] = entry['tier_3']
                else:
                    entry['grouping_tier_key'] = 'tier_2'
                    entry['grouping_value'] = entry['tier_2']
                entry['is_grouping_root'] = True
                logger.debug(
                    f"Root entry {entry['id']} ({entry['name']}): "
                    f"grouping_key={entry['grouping_tier_key']}, "
                    f"grouping_value={entry['grouping_value']}"
                )
                continue

            # Look up parent to determine grouping
            parent = self.taxonomy_by_id.get(parent_id)

            if not parent:
                logger.warning(
                    f"Parent ID {parent_id} not found for entry {entry['id']} ({entry['name']})"
                )
                # Fallback: use tier_2
                entry['grouping_tier_key'] = 'tier_2'
                entry['grouping_value'] = entry['tier_2']
                entry['is_grouping_root'] = False
                continue

            # Determine grouping based on parent's tier_3
            if parent.get('tier_3'):
                # Parent has tier_3, so use tier_3 for grouping
                entry['grouping_tier_key'] = 'tier_3'
                entry['grouping_value'] = entry['tier_3'] if entry['tier_3'] else parent['tier_3']
            else:
                # Parent has no tier_3, so use tier_2 for grouping
                entry['grouping_tier_key'] = 'tier_2'
                entry['grouping_value'] = entry['tier_2'] if entry['tier_2'] else parent['tier_2']

            entry['is_grouping_root'] = False

            # Debug log for key demographics entries
            if entry['id'] in [20, 42, 49, 50]:  # College, Employed, Female, Male
                logger.debug(
                    f"Entry {entry['id']} ({entry['name']}): "
                    f"parent={parent_id} ({parent.get('name')}), "
                    f"parent_tier3='{parent.get('tier_3')}', "
                    f"grouping_key={entry['grouping_tier_key']}, "
                    f"grouping_value={entry['grouping_value']}"
                )

        logger.info("Grouping metadata computed successfully")

    def _get_entries_in_range(
        self, start_row: int, end_row: int
    ) -> List[Dict[str, Any]]:
        """
        Get taxonomy entries within Excel row range.

        Args:
            start_row: Starting Excel row number (1-indexed)
            end_row: Ending Excel row number (1-indexed, inclusive)

        Returns:
            List of taxonomy entries in range
        """
        return [
            entry for entry in self.taxonomy_entries
            if entry['excel_row'] >= start_row and entry['excel_row'] <= end_row
        ]

    # Public API methods

    def get_by_id(self, taxonomy_id: int) -> Optional[Dict[str, Any]]:
        """
        Get taxonomy entry by ID.

        Args:
            taxonomy_id: IAB Taxonomy unique ID

        Returns:
            Taxonomy entry dict or None if not found
        """
        return self.taxonomy_by_id.get(taxonomy_id)

    def get_by_section(self, section: str) -> List[Dict[str, Any]]:
        """
        Get all taxonomy entries for a section.

        Args:
            section: Section name (demographics, household_data, interests, etc.)

        Returns:
            List of taxonomy entries in section
        """
        return self.taxonomy_by_section.get(section, [])

    def get_children(self, parent_id: int) -> List[Dict[str, Any]]:
        """
        Get all child entries for a parent taxonomy ID.

        Args:
            parent_id: Parent taxonomy ID

        Returns:
            List of child taxonomy entries
        """
        child_ids = self.parent_child_map.get(parent_id, [])
        return [self.taxonomy_by_id[child_id] for child_id in child_ids]

    def get_purchase_classification(self, code: str) -> Optional[str]:
        """
        Get description for purchase intent classification code.

        Args:
            code: Classification code (PIPR1, PIPF2, PIPV3, PIFI1, etc.)

        Returns:
            Description string or None if code not found
        """
        return self.purchase_classifications.get(code)

    def get_all_purchase_classifications(self) -> Dict[str, str]:
        """
        Get all purchase intent classification codes and descriptions.

        Returns:
            Dict mapping code to description
        """
        return self.purchase_classifications.copy()

    def search_by_name(self, search_term: str) -> List[Dict[str, Any]]:
        """
        Search taxonomy entries by name (case-insensitive).

        Args:
            search_term: Term to search for in taxonomy names

        Returns:
            List of matching taxonomy entries
        """
        search_lower = search_term.lower()
        return [
            entry for entry in self.taxonomy_entries
            if search_lower in entry['name'].lower()
        ]


# Global instance of the taxonomy loader
iab_taxonomy_loader = IABTaxonomyLoader()