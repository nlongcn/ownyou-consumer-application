#!/usr/bin/env python3
"""
Categories API Endpoints

Provides endpoints for browsing IAB Taxonomy categories and
checking which categories are active in user profiles.
"""

from flask import Blueprint, jsonify, request
from typing import Dict, Any, List
import logging
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))

from src.email_parser.utils.iab_taxonomy_loader import IABTaxonomyLoader
from .auth import login_required, get_current_user
from ..db import queries

logger = logging.getLogger(__name__)

categories_bp = Blueprint('categories', __name__, url_prefix='/api/categories')

# Global taxonomy loader instance (loaded once on startup)
_taxonomy_loader = None


def get_taxonomy_loader() -> IABTaxonomyLoader:
    """Get or initialize taxonomy loader singleton."""
    global _taxonomy_loader
    if _taxonomy_loader is None:
        logger.info("Initializing IAB Taxonomy Loader")
        _taxonomy_loader = IABTaxonomyLoader()
    return _taxonomy_loader


@categories_bp.route('/', methods=['GET'])
@login_required
def get_all_categories():
    """
    Get all IAB taxonomy categories with optional filtering.

    Query Parameters:
        section: Filter by section (demographics, interests, household_data, etc.)
        tier: Filter by tier level (1-5)
        search: Search term for category names
        active_only: Only return categories active in user's profile (true/false)
        limit: Maximum number of results (default: 1000)

    Returns:
        JSON response with categories list and metadata
    """
    try:
        user_id = get_current_user()

        # Get query parameters
        section = request.args.get('section')
        tier = request.args.get('tier')
        search = request.args.get('search')
        active_only = request.args.get('active_only', 'false').lower() == 'true'
        limit = int(request.args.get('limit', 1000))

        # Load taxonomy
        loader = get_taxonomy_loader()

        # Get user's active taxonomy IDs
        active_taxonomy_ids = set()
        if active_only or section:  # Always load if filtering
            user_memories = queries.get_all_profile_memories(user_id)
            active_taxonomy_ids = {
                mem.get('taxonomy_id')
                for mem in user_memories
                if mem.get('taxonomy_id')
            }

        # Get categories based on section filter
        if section:
            categories = loader.get_by_section(section)
        else:
            categories = loader.taxonomy_entries

        # Apply active_only filter
        if active_only:
            categories = [
                cat for cat in categories
                if cat['id'] in active_taxonomy_ids
            ]

        # Apply search filter
        if search:
            search_lower = search.lower()
            categories = [
                cat for cat in categories
                if search_lower in cat['name'].lower() or
                   search_lower in cat.get('tier_1', '').lower() or
                   search_lower in cat.get('tier_2', '').lower()
            ]

        # Apply tier filter
        if tier:
            tier_num = int(tier)
            categories = [
                cat for cat in categories
                if _get_tier_level(cat) == tier_num
            ]

        # Format categories with active status
        formatted_categories = []
        for cat in categories[:limit]:
            is_active = cat['id'] in active_taxonomy_ids
            formatted_cat = {
                'taxonomy_id': cat['id'],
                'parent_id': cat['parent_id'],
                'name': cat['name'],
                'tier_1': cat['tier_1'],
                'tier_2': cat['tier_2'],
                'tier_3': cat['tier_3'],
                'tier_4': cat['tier_4'],
                'tier_5': cat['tier_5'],
                'tier_level': _get_tier_level(cat),
                'category_path': _build_category_path(cat),
                'is_active': is_active,
                'section': _determine_section(cat['excel_row'])
            }
            formatted_categories.append(formatted_cat)

        return jsonify({
            'categories': formatted_categories,
            'total_count': len(categories),
            'returned_count': len(formatted_categories),
            'active_count': len(active_taxonomy_ids) if active_taxonomy_ids else None,
            'filters': {
                'section': section,
                'tier': tier,
                'search': search,
                'active_only': active_only
            }
        }), 200

    except Exception as e:
        logger.error(f"Error retrieving categories: {e}", exc_info=True)
        return jsonify({
            'error': 'Failed to retrieve categories',
            'message': str(e)
        }), 500


@categories_bp.route('/<int:taxonomy_id>', methods=['GET'])
@login_required
def get_category_details(taxonomy_id: int):
    """
    Get detailed information about a specific taxonomy category.

    Args:
        taxonomy_id: IAB Taxonomy ID

    Returns:
        JSON response with category details including:
        - Category information
        - Parent category
        - Child categories
        - Whether it's active in user's profile
        - User's confidence score if active
    """
    try:
        user_id = get_current_user()

        # Load taxonomy
        loader = get_taxonomy_loader()
        category = loader.get_by_id(taxonomy_id)

        if not category:
            return jsonify({
                'error': 'Category not found',
                'taxonomy_id': taxonomy_id
            }), 404

        # Get user's active classifications
        user_memories = queries.get_all_profile_memories(user_id)
        user_classification = None

        for mem in user_memories:
            if mem.get('taxonomy_id') == taxonomy_id:
                user_classification = {
                    'confidence': mem.get('confidence'),
                    'evidence_count': mem.get('evidence_count'),
                    'last_validated': mem.get('last_validated'),
                    'reasoning': mem.get('reasoning', '')
                }
                break

        # Get parent category
        parent = None
        if category['parent_id']:
            parent_cat = loader.get_by_id(category['parent_id'])
            if parent_cat:
                parent = {
                    'taxonomy_id': parent_cat['id'],
                    'name': parent_cat['name'],
                    'category_path': _build_category_path(parent_cat)
                }

        # Get children categories
        children = []
        for child_cat in loader.get_children(taxonomy_id):
            children.append({
                'taxonomy_id': child_cat['id'],
                'name': child_cat['name'],
                'category_path': _build_category_path(child_cat)
            })

        return jsonify({
            'category': {
                'taxonomy_id': category['id'],
                'parent_id': category['parent_id'],
                'name': category['name'],
                'tier_1': category['tier_1'],
                'tier_2': category['tier_2'],
                'tier_3': category['tier_3'],
                'tier_4': category['tier_4'],
                'tier_5': category['tier_5'],
                'tier_level': _get_tier_level(category),
                'category_path': _build_category_path(category),
                'section': _determine_section(category['excel_row']),
                'excel_row': category['excel_row']
            },
            'parent': parent,
            'children': children,
            'user_classification': user_classification,
            'is_active': user_classification is not None
        }), 200

    except Exception as e:
        logger.error(f"Error retrieving category {taxonomy_id}: {e}", exc_info=True)
        return jsonify({
            'error': 'Failed to retrieve category',
            'message': str(e)
        }), 500


@categories_bp.route('/sections', methods=['GET'])
@login_required
def get_sections():
    """
    Get summary of all taxonomy sections with category counts.

    Returns:
        JSON response with section summaries including:
        - Section name
        - Total categories in section
        - User's active categories in section
        - Section row range
    """
    try:
        user_id = get_current_user()

        # Load taxonomy
        loader = get_taxonomy_loader()

        # Get user's active classifications by section
        user_memories = queries.get_all_profile_memories(user_id)
        active_by_section = {}

        for mem in user_memories:
            tax_id = mem.get('taxonomy_id')
            if tax_id:
                cat = loader.get_by_id(tax_id)
                if cat:
                    section = _determine_section(cat['excel_row'])
                    active_by_section[section] = active_by_section.get(section, 0) + 1

        # Build section summaries
        sections = []
        for section_name, categories in loader.taxonomy_by_section.items():
            sections.append({
                'section': section_name,
                'display_name': _format_section_name(section_name),
                'total_categories': len(categories),
                'active_categories': active_by_section.get(section_name, 0),
                'row_range': _get_section_row_range(section_name)
            })

        return jsonify({
            'sections': sections,
            'total_sections': len(sections)
        }), 200

    except Exception as e:
        logger.error(f"Error retrieving sections: {e}", exc_info=True)
        return jsonify({
            'error': 'Failed to retrieve sections',
            'message': str(e)
        }), 500


# Helper functions

def _get_tier_level(category: Dict[str, Any]) -> int:
    """Determine the tier level of a category (1-5)."""
    if category['tier_5']:
        return 5
    elif category['tier_4']:
        return 4
    elif category['tier_3']:
        return 3
    elif category['tier_2']:
        return 2
    elif category['tier_1']:
        return 1
    return 0


def _build_category_path(category: Dict[str, Any]) -> str:
    """Build full category path from tiers."""
    tiers = [
        category.get('tier_1', ''),
        category.get('tier_2', ''),
        category.get('tier_3', ''),
        category.get('tier_4', ''),
        category.get('tier_5', '')
    ]
    return ' > '.join([t for t in tiers if t])


def _determine_section(excel_row: int) -> str:
    """Determine section based on Excel row number."""
    if 11 <= excel_row <= 62:
        return 'demographics'
    elif 64 <= excel_row <= 168:
        return 'household_data'
    elif 169 <= excel_row <= 172:
        return 'personal_attributes'
    elif 175 <= excel_row <= 207:
        return 'personal_finance'
    elif 209 <= excel_row <= 704:
        return 'interests'
    elif 707 <= excel_row <= 1568:
        return 'purchase_intent'
    return 'unknown'


def _format_section_name(section: str) -> str:
    """Format section name for display."""
    return section.replace('_', ' ').title()


def _get_section_row_range(section: str) -> Dict[str, int]:
    """Get Excel row range for a section."""
    ranges = {
        'demographics': {'start': 11, 'end': 62},
        'household_data': {'start': 64, 'end': 168},
        'personal_attributes': {'start': 169, 'end': 172},
        'personal_finance': {'start': 175, 'end': 207},
        'interests': {'start': 209, 'end': 704},
        'purchase_intent': {'start': 707, 'end': 1568}
    }
    return ranges.get(section, {'start': 0, 'end': 0})
