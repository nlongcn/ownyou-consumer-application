#!/usr/bin/env python3
"""
Analytics API Routes

Endpoints for cost tracking, analysis runs, and confidence evolution.
"""

from flask import Blueprint, request, jsonify
import logging

from .auth import login_required, get_current_user
from ..db.queries import (
    get_cost_summary,
    get_total_cost,
    get_analysis_runs,
    get_classification_history
)
from ..utils.validators import (
    validate_taxonomy_id,
    validate_limit,
    ValidationError
)

logger = logging.getLogger(__name__)

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')


@analytics_bp.route('/costs', methods=['GET'])
@login_required
def get_costs():
    """
    Get cost tracking summary.

    Query Parameters:
        limit (optional): Number of recent records (default 10, max 100)

    Returns:
        200: Cost records
        [
            {
                "id": "user_123_openai_2025-10-01",
                "user_id": "user_123",
                "run_date": "2025-10-01",
                "provider": "openai",
                "model_name": "gpt-4o-mini",
                "total_cost": 0.0245,
                "input_tokens": 1500,
                "output_tokens": 800,
                "email_count": 200,
                "created_at": "2025-10-01T12:00:00Z"
            },
            ...
        ]
    """
    try:
        user_id = get_current_user()
        limit = validate_limit(request.args.get('limit'), default=10, max_limit=100)

        costs = get_cost_summary(user_id, limit)

        return jsonify({
            "user_id": user_id,
            "count": len(costs),
            "costs": costs
        }), 200

    except ValidationError as e:
        return jsonify({
            "error": "Validation error",
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error getting costs: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve costs"
        }), 500


@analytics_bp.route('/costs/total', methods=['GET'])
@login_required
def get_total_costs():
    """
    Get total cost summary across all runs.

    Returns:
        200: Total cost breakdown
        {
            "total_cost": 0.125,
            "total_emails": 1000,
            "total_runs": 5,
            "avg_cost_per_run": 0.025,
            "by_provider": [
                {
                    "provider": "openai",
                    "provider_cost": 0.100,
                    "provider_emails": 800
                },
                {
                    "provider": "claude",
                    "provider_cost": 0.025,
                    "provider_emails": 200
                }
            ]
        }
    """
    try:
        user_id = get_current_user()
        totals = get_total_cost(user_id)

        return jsonify(totals), 200

    except Exception as e:
        logger.error(f"Error getting total costs: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve total costs"
        }), 500


@analytics_bp.route('/runs', methods=['GET'])
@login_required
def get_runs():
    """
    Get analysis run history.

    Query Parameters:
        limit (optional): Number of recent records (default 10, max 100)

    Returns:
        200: Analysis run records
        [
            {
                "id": "user_123_2025-10-01",
                "user_id": "user_123",
                "run_date": "2025-10-01",
                "emails_processed": 200,
                "classifications_added": 12,
                "classifications_updated": 5,
                "total_cost": 0.0245,
                "duration_seconds": 120.5,
                "status": "completed",
                "created_at": "2025-10-01T12:00:00Z"
            },
            ...
        ]
    """
    try:
        user_id = get_current_user()
        limit = validate_limit(request.args.get('limit'), default=10, max_limit=100)

        runs = get_analysis_runs(user_id, limit)

        return jsonify({
            "user_id": user_id,
            "count": len(runs),
            "runs": runs
        }), 200

    except ValidationError as e:
        return jsonify({
            "error": "Validation error",
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error getting runs: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve analysis runs"
        }), 500


@analytics_bp.route('/confidence/history', methods=['GET'])
@login_required
def get_confidence_history():
    """
    Get confidence evolution history.

    Query Parameters:
        taxonomy_id (optional): Filter by specific taxonomy ID

    Returns:
        200: Confidence history snapshots
        [
            {
                "id": "user_123_342_2025-09-01T12:00:00Z",
                "user_id": "user_123",
                "taxonomy_id": 342,
                "confidence": 0.75,
                "evidence_count": 3,
                "snapshot_date": "2025-09-01T12:00:00Z",
                "created_at": "2025-09-01T12:00:00Z"
            },
            {
                "id": "user_123_342_2025-10-01T12:00:00Z",
                "user_id": "user_123",
                "taxonomy_id": 342,
                "confidence": 0.92,
                "evidence_count": 5,
                "snapshot_date": "2025-10-01T12:00:00Z",
                "created_at": "2025-10-01T12:00:00Z"
            },
            ...
        ]
    """
    try:
        user_id = get_current_user()

        # Optional taxonomy_id filter
        taxonomy_id = request.args.get('taxonomy_id')
        if taxonomy_id:
            taxonomy_id = validate_taxonomy_id(taxonomy_id)

        history = get_classification_history(user_id, taxonomy_id)

        return jsonify({
            "user_id": user_id,
            "taxonomy_id": taxonomy_id,
            "count": len(history),
            "history": history
        }), 200

    except ValidationError as e:
        return jsonify({
            "error": "Validation error",
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error getting confidence history: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "Failed to retrieve confidence history"
        }), 500
