#!/usr/bin/env python3
"""
Profile API Routes

Endpoints for accessing user IAB taxonomy profiles.
"""

from flask import Blueprint, request, jsonify
import logging

from .auth import login_required, get_current_user
from ..db.queries import (
    get_user_profile_summary,
    get_all_classifications,
    get_tiered_classifications
)
from ..utils.validators import validate_section, ValidationError

logger = logging.getLogger(__name__)

profile_bp = Blueprint('profile', __name__, url_prefix='/api/profile')


@profile_bp.route('/summary', methods=['GET'])
@login_required
def get_summary():
    """
    Get user profile summary with classification counts.

    Returns:
        200: Profile summary
        {
            "user_id": "user_123",
            "demographics": 5,
            "household": 8,
            "interests": 15,
            "purchase_intent": 7,
            "actual_purchases": 2,
            "total_classifications": 37
        }
    """
    try:
        user_id = get_current_user()
        summary = get_user_profile_summary(user_id)

        return jsonify(summary), 200

    except Exception as e:
        logger.error(f"Error getting profile summary: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve profile summary"
        }), 500


@profile_bp.route('/classifications', methods=['GET'])
@login_required
def get_classifications():
    """
    Get all classifications for current user.

    Query Parameters:
        section (optional): Filter by section (demographics, household, interests, etc.)

    Returns:
        200: List of classifications
        [
            {
                "section": "interests",
                "category": "Cryptocurrency",
                "taxonomy_id": 342,
                "value": "Cryptocurrency",
                "confidence": 0.92,
                "evidence_count": 5,
                "last_validated": "2025-10-01T12:00:00Z",
                "created_at": "2025-09-01T10:00:00Z",
                "updated_at": "2025-10-01T12:00:00Z"
            },
            ...
        ]
    """
    try:
        user_id = get_current_user()

        # Get optional section filter
        section = request.args.get('section')
        if section:
            section = validate_section(section)

        classifications = get_all_classifications(user_id, section)

        return jsonify({
            "user_id": user_id,
            "section": section,
            "count": len(classifications),
            "classifications": classifications
        }), 200

    except ValidationError as e:
        return jsonify({
            "error": "Validation error",
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error getting classifications: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve classifications"
        }), 500


@profile_bp.route('/sections', methods=['GET'])
@login_required
def get_sections():
    """
    Get all profile sections with their classifications.

    Returns:
        200: Sections with classifications
        {
            "demographics": [...],
            "household": [...],
            "interests": [...],
            "purchase_intent": [...],
            "actual_purchases": [...]
        }
    """
    try:
        user_id = get_current_user()

        sections = [
            "demographics",
            "household",
            "interests",
            "purchase_intent",
            "actual_purchases"
        ]

        result = {}
        for section in sections:
            result[section] = get_all_classifications(user_id, section)

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Error getting sections: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve sections"
        }), 500


@profile_bp.route('/timeline', methods=['GET'])
@login_required
def get_timeline():
    """
    Get classification timeline showing when classifications were added.

    Returns:
        200: Timeline data
        {
            "user_id": "user_123",
            "count": 15,
            "events": [
                {
                    "date": "2025-10-01",
                    "time": "12:07:52",
                    "section": "interests",
                    "classification": "Wellness",
                    "taxonomy_id": 252
                }
            ]
        }
    """
    try:
        user_id = get_current_user()

        from ..db.queries import get_connection

        conn = get_connection()
        cursor = conn.cursor()

        # Get timeline events from memories table
        namespace = f"{user_id}/iab_taxonomy_profile"

        cursor.execute("""
            SELECT
                json_extract(value, '$.value') as classification,
                json_extract(value, '$.tier_path') as tier_path,
                json_extract(value, '$.taxonomy_id') as taxonomy_id,
                json_extract(value, '$.confidence') as confidence,
                created_at,
                updated_at
            FROM memories
            WHERE namespace = ? AND key LIKE 'semantic_%'
            ORDER BY created_at DESC
        """, (namespace,))

        events = []
        for row in cursor.fetchall():
            classification, tier_path, taxonomy_id, confidence, created_at, updated_at = row

            # Extract section from tier_path (e.g., "Interest | Technology" -> "interests")
            section = "unknown"
            if tier_path:
                tier_parts = tier_path.split("|")
                if len(tier_parts) > 0:
                    section_name = tier_parts[0].strip().lower()
                    # Map to our section names
                    section_map = {
                        "demographic": "demographics",
                        "household": "household",
                        "interest": "interests",
                        "purchase intent": "purchase_intent",
                        "actual purchase": "actual_purchases"
                    }
                    section = section_map.get(section_name, section_name)

            # Parse datetime
            date_str, time_str = created_at.split(" ") if " " in created_at else (created_at, "")

            events.append({
                "date": date_str,
                "time": time_str,
                "section": section,
                "classification": classification,
                "tier_path": tier_path,
                "taxonomy_id": taxonomy_id,
                "confidence": confidence,
                "created_at": created_at,
                "updated_at": updated_at
            })

        conn.close()

        return jsonify({
            "user_id": user_id,
            "count": len(events),
            "events": events
        }), 200

    except Exception as e:
        logger.error(f"Error getting timeline: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve timeline"
        }), 500


@profile_bp.route('/tiered', methods=['GET'])
@login_required
def get_tiered():
    """
    Get user profile with tiered classification structure (Schema v2.0).

    Query Parameters:
        section (optional): Filter by section (demographics, household, interests, purchase_intent)

    Returns:
        200: Tiered classification structure
        {
            "schema_version": "2.0",
            "demographics": {
                "gender": {
                    "primary": {
                        "taxonomy_id": 21,
                        "value": "Female",
                        "confidence": 0.99,
                        "tier_depth": 2,
                        "granularity_score": 0.99,
                        "classification_type": "primary"
                    },
                    "alternatives": [
                        {
                            "taxonomy_id": 20,
                            "value": "Male",
                            "confidence": 0.75,
                            "confidence_delta": 0.24,
                            "classification_type": "alternative"
                        }
                    ],
                    "selection_method": "highest_confidence"
                }
            },
            "household": {...},
            "interests": [...],
            "purchase_intent": [...]
        }
    """
    try:
        user_id = get_current_user()

        # Get optional section filter
        section = request.args.get('section')
        if section:
            section = validate_section(section)

        tiered_profile = get_tiered_classifications(user_id, section)

        return jsonify(tiered_profile), 200

    except ValidationError as e:
        return jsonify({
            "error": "Validation error",
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error getting tiered classifications: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve tiered classifications"
        }), 500


@profile_bp.route('/delete', methods=['DELETE'])
@login_required
def delete_profile():
    """
    Delete all user profile data.

    This permanently deletes:
    - All semantic memories (classifications)
    - All episodic memories
    - All cost tracking records
    - All classification history
    - All analysis run records

    Returns:
        200: Profile deleted successfully
        {
            "success": true,
            "deleted_records": 793,
            "message": "Profile deleted successfully"
        }
    """
    try:
        user_id = get_current_user()

        from ..db.queries import get_connection

        conn = get_connection()
        cursor = conn.cursor()

        # Begin transaction
        cursor.execute("BEGIN TRANSACTION")

        # Delete from all tables
        namespace = f"{user_id}/iab_taxonomy_profile"

        # Count total records before deletion
        cursor.execute("""
            SELECT
                (SELECT COUNT(*) FROM memories WHERE namespace = ?) +
                (SELECT COUNT(*) FROM cost_tracking WHERE user_id = ?) +
                (SELECT COUNT(*) FROM classification_history WHERE user_id = ?) +
                (SELECT COUNT(*) FROM analysis_runs WHERE user_id = ?)
        """, (namespace, user_id, user_id, user_id))

        total_records = cursor.fetchone()[0]

        # Delete from each table
        cursor.execute("DELETE FROM cost_tracking WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM classification_history WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM analysis_runs WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM memories WHERE namespace = ?", (namespace,))

        # Commit transaction
        cursor.execute("COMMIT")
        conn.close()

        logger.info(f"Deleted profile for user {user_id}: {total_records} records")

        return jsonify({
            "success": True,
            "deleted_records": total_records,
            "message": "Profile deleted successfully"
        }), 200

    except Exception as e:
        logger.error(f"Error deleting profile: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to delete profile"
        }), 500
