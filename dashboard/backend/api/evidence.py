"""
Evidence API

Provides endpoints for viewing LLM reasoning and evidence for IAB taxonomy classifications.
"""

import logging
import os
import glob
import csv
from flask import Blueprint, jsonify, request
from .auth import login_required, get_current_user
from ..db import queries

logger = logging.getLogger(__name__)

evidence_bp = Blueprint('evidence', __name__, url_prefix='/api/evidence')


def load_summaries_from_csv(user_id: str) -> dict:
    """
    Load email summaries from the latest summaries CSV file for a user.

    Returns:
        Dictionary mapping email_id -> summary text
    """
    try:
        # Find all summaries CSV files for this user
        pattern = f"data/summaries_{user_id.lower()}_*.csv"
        csv_files = glob.glob(pattern)

        if not csv_files:
            logger.warning(f"No summaries CSV files found for user {user_id}")
            return {}

        # Get the most recent file
        latest_file = max(csv_files, key=os.path.getmtime)
        logger.info(f"Loading summaries from {latest_file}")

        # Read summaries into dictionary
        summaries = {}
        with open(latest_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                email_id = row.get('ID')
                summary = row.get('Summary', '')
                if email_id and summary:
                    summaries[email_id] = summary

        logger.info(f"Loaded {len(summaries)} summaries from CSV")
        return summaries

    except Exception as e:
        logger.error(f"Failed to load summaries from CSV: {e}")
        return {}


@evidence_bp.route('/', methods=['GET'])
@login_required
def get_all_evidence():
    """
    Get all classifications with evidence for current user.

    Query Parameters:
        section: Filter by section (interests, demographics, household, purchase_intent, actual_purchases)
        sort: Sort by confidence_desc, confidence_asc, recent, oldest
        limit: Max results (default: 100)

    Returns:
        {
            "count": 42,
            "evidence": [
                {
                    "taxonomy_id": 342,
                    "category_path": "Interest | Cryptocurrency",
                    "value": "Cryptocurrency",
                    "confidence": 0.85,
                    "evidence_count": 1,
                    "reasoning": "LLM explanation...",
                    "supporting_evidence": ["email_id_1"],
                    "contradicting_evidence": [],
                    "first_observed": "2025-01-15T10:00:00Z",
                    "last_updated": "2025-01-15T10:00:00Z",
                    "section": "interests"
                }
            ]
        }
    """
    try:
        user_id = get_current_user()
        section = request.args.get('section')
        sort = request.args.get('sort', 'confidence_desc')
        limit = int(request.args.get('limit', 100))

        # Get all semantic memories for user
        all_memories = queries.get_all_profile_memories(user_id)

        # Filter by section if specified
        if section:
            all_memories = [m for m in all_memories if m.get('section') == section]

        # Sort
        if sort == 'confidence_desc':
            all_memories.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        elif sort == 'confidence_asc':
            all_memories.sort(key=lambda x: x.get('confidence', 0))
        elif sort == 'recent':
            all_memories.sort(key=lambda x: x.get('last_updated', ''), reverse=True)
        elif sort == 'oldest':
            all_memories.sort(key=lambda x: x.get('first_observed', ''))

        # Apply limit
        all_memories = all_memories[:limit]

        # Extract evidence fields
        evidence_list = []
        for memory in all_memories:
            evidence_list.append({
                'taxonomy_id': memory.get('taxonomy_id'),
                'category_path': memory.get('category_path', ''),
                'value': memory.get('value', ''),
                'confidence': memory.get('confidence', 0),
                'evidence_count': memory.get('evidence_count', 0),
                'reasoning': memory.get('reasoning', ''),
                'supporting_evidence': memory.get('supporting_evidence', []),
                'contradicting_evidence': memory.get('contradicting_evidence', []),
                'first_observed': memory.get('first_observed', ''),
                'last_updated': memory.get('last_updated', ''),
                'section': memory.get('section', '')
            })

        return jsonify({
            'count': len(evidence_list),
            'evidence': evidence_list
        }), 200

    except Exception as e:
        logger.error(f"Failed to get evidence: {e}")
        return jsonify({'error': str(e)}), 500


@evidence_bp.route('/<int:taxonomy_id>', methods=['GET'])
@login_required
def get_evidence_by_id(taxonomy_id):
    """
    Get detailed evidence for specific taxonomy classification.

    Args:
        taxonomy_id: IAB taxonomy ID

    Returns:
        {
            "taxonomy_id": 342,
            "category_path": "Interest | Cryptocurrency",
            "value": "Cryptocurrency",
            "confidence": 0.85,
            "evidence_count": 1,
            "reasoning": "Full LLM explanation...",
            "supporting_evidence": ["email_id_1", "email_id_2"],
            "contradicting_evidence": [],
            "first_observed": "2025-01-15T10:00:00Z",
            "last_updated": "2025-01-20T15:30:00Z",
            "last_validated": "2025-01-20T15:30:00Z",
            "days_since_validation": 0,
            "section": "interests",
            "tier_1": "Interest",
            "tier_2": "Cryptocurrency",
            "tier_3": "",
            "tier_4": "",
            "tier_5": "",
            "source_emails": [
                {
                    "email_id": "199a488c4feb6151",
                    "subject": "Crypto News Today",
                    "date": "2025-01-15T10:00:00Z",
                    "summary": "Newsletter about cryptocurrency trends"
                }
            ]
        }
    """
    try:
        user_id = get_current_user()

        # Get classification memory
        memories = queries.get_all_profile_memories(user_id)
        classification = None

        for memory in memories:
            if memory.get('taxonomy_id') == taxonomy_id:
                classification = memory
                break

        if not classification:
            return jsonify({'error': 'Classification not found'}), 404

        # Get source email details
        source_emails = []
        email_ids = classification.get('source_ids', [])

        # Load summaries from CSV as fallback
        csv_summaries = load_summaries_from_csv(user_id)

        # Fetch episodic memories for these email IDs
        for email_id in email_ids:
            episodic_key = f"episodic_email_{email_id}"
            episodic_memory = queries.get_memory_by_key(user_id, episodic_key)

            if episodic_memory:
                # Get summary from episodic memory, fallback to CSV if null
                summary = episodic_memory.get('email_summary') or csv_summaries.get(email_id, '')

                source_emails.append({
                    'email_id': episodic_memory.get('email_id', email_id),
                    'subject': episodic_memory.get('email_subject', ''),
                    'date': episodic_memory.get('email_date', ''),
                    'summary': summary
                })

        # Build response
        response = {
            'taxonomy_id': classification.get('taxonomy_id'),
            'category_path': classification.get('category_path', ''),
            'value': classification.get('value', ''),
            'confidence': classification.get('confidence', 0),
            'evidence_count': classification.get('evidence_count', 0),
            'reasoning': classification.get('reasoning', ''),
            'supporting_evidence': classification.get('supporting_evidence', []),
            'contradicting_evidence': classification.get('contradicting_evidence', []),
            'first_observed': classification.get('first_observed', ''),
            'last_updated': classification.get('last_updated', ''),
            'last_validated': classification.get('last_validated', ''),
            'days_since_validation': classification.get('days_since_validation', 0),
            'section': classification.get('section', ''),
            'tier_1': classification.get('tier_1', ''),
            'tier_2': classification.get('tier_2', ''),
            'tier_3': classification.get('tier_3', ''),
            'tier_4': classification.get('tier_4', ''),
            'tier_5': classification.get('tier_5', ''),
            'source_emails': source_emails
        }

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Failed to get evidence for taxonomy {taxonomy_id}: {e}")
        return jsonify({'error': str(e)}), 500
