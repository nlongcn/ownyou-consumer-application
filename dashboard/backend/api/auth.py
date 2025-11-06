#!/usr/bin/env python3
"""
Authentication API Routes

Simple session-based authentication for single-user dashboard.
"""

from flask import Blueprint, request, session, jsonify
from functools import wraps
from typing import Callable, Any
import logging

from ..utils.validators import validate_user_id, ValidationError

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def login_required(f: Callable) -> Callable:
    """
    Decorator to require authentication for routes.

    Usage:
        @auth_bp.route('/protected')
        @login_required
        def protected_route():
            return jsonify({"message": "Success"})
    """
    @wraps(f)
    def decorated_function(*args, **kwargs) -> Any:
        if 'user_id' not in session:
            return jsonify({
                "error": "Authentication required",
                "message": "Please login to access this resource"
            }), 401

        return f(*args, **kwargs)

    return decorated_function


def get_current_user() -> str:
    """
    Get current authenticated user_id from session.

    Returns:
        User ID string

    Raises:
        ValueError: If no user is authenticated
    """
    user_id = session.get('user_id')
    if not user_id:
        raise ValueError("No authenticated user")
    return user_id


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Simple login endpoint.

    For MVP, this just sets the user_id in session.
    In future, would validate credentials.

    Request Body:
        {
            "user_id": "user_123"
        }

    Returns:
        200: Login successful
        400: Invalid request
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                "error": "Invalid request",
                "message": "Request body must be JSON"
            }), 400

        # Validate user_id
        user_id = validate_user_id(data.get('user_id'))

        # Set session
        session['user_id'] = user_id
        session.permanent = True  # Use PERMANENT_SESSION_LIFETIME

        logger.info(f"User logged in: {user_id}")

        return jsonify({
            "success": True,
            "user_id": user_id,
            "message": "Login successful"
        }), 200

    except ValidationError as e:
        return jsonify({
            "error": "Validation error",
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return jsonify({
            "error": "Server error",
            "message": "An unexpected error occurred"
        }), 500


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """
    Logout endpoint - clears session.

    Returns:
        200: Logout successful
    """
    user_id = session.get('user_id')
    session.clear()

    logger.info(f"User logged out: {user_id}")

    return jsonify({
        "success": True,
        "message": "Logout successful"
    }), 200


@auth_bp.route('/status', methods=['GET'])
def status():
    """
    Check authentication status.

    Returns:
        200: Authentication status
    """
    user_id = session.get('user_id')

    if user_id:
        return jsonify({
            "authenticated": True,
            "user_id": user_id
        }), 200
    else:
        return jsonify({
            "authenticated": False
        }), 200


@auth_bp.route('/session', methods=['GET'])
@login_required
def get_session():
    """
    Get current session info.

    Returns:
        200: Session information
    """
    return jsonify({
        "user_id": session.get('user_id'),
        "session_id": request.cookies.get('session')
    }), 200
