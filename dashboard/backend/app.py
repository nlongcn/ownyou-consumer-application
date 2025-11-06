#!/usr/bin/env python3
"""
Dashboard Flask Application

Main Flask app for IAB Taxonomy Profile Dashboard API.
"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_session import Session
import logging
import os

from .config import get_config
from .api.auth import auth_bp
from .api.profile import profile_bp
from .api.analytics import analytics_bp
from .api.analyze import analyze_bp
from .api.evidence import evidence_bp
from .api.categories import categories_bp
from .api.studio import studio_bp


def create_app(config_name: str = None) -> Flask:
    """
    Create and configure Flask application.

    Args:
        config_name: Configuration name (development, production)

    Returns:
        Configured Flask app
    """
    app = Flask(__name__)

    # Load configuration
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    config = get_config(config_name)
    app.config.from_object(config)

    # Setup logging
    setup_logging(app)

    # Setup CORS
    CORS(app, origins=config.CORS_ORIGINS, supports_credentials=True)

    # Setup sessions
    Session(app)

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(analyze_bp)
    app.register_blueprint(evidence_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(studio_bp)

    # Health check endpoint
    @app.route('/health')
    def health():
        """Health check endpoint."""
        return jsonify({
            "status": "healthy",
            "service": "iab-dashboard-api",
            "version": "1.0.0"
        }), 200

    # Root endpoint
    @app.route('/')
    def index():
        """Root endpoint with API info."""
        return jsonify({
            "service": "IAB Taxonomy Profile Dashboard API",
            "version": "1.0.0",
            "endpoints": {
                "auth": "/api/auth/*",
                "profile": "/api/profile/*",
                "analytics": "/api/analytics/*"
            },
            "docs": "See /Volumes/T7_new/developer_old/ownyou_consumer_application/docs/DASHBOARD_REQUIREMENTS.md"
        }), 200

    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors."""
        return jsonify({
            "error": "Not found",
            "message": "The requested resource was not found"
        }), 404

    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 errors."""
        app.logger.error(f"Internal error: {error}", exc_info=True)
        return jsonify({
            "error": "Internal server error",
            "message": "An unexpected error occurred"
        }), 500

    return app


def setup_logging(app: Flask) -> None:
    """
    Setup application logging.

    Args:
        app: Flask application
    """
    # Create logs directory if it doesn't exist
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)

    # Configure logging
    log_level = logging.DEBUG if app.config['DEBUG'] else logging.INFO

    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(os.path.join(log_dir, 'dashboard.log')),
            logging.StreamHandler()
        ]
    )

    app.logger.setLevel(log_level)
    app.logger.info(f"Dashboard API starting in {app.config.get('ENV', 'unknown')} mode")


def run_server(host: str = None, port: int = None, debug: bool = None):
    """
    Run the Flask development server.

    Args:
        host: Host to bind to (default from config)
        port: Port to bind to (default from config)
        debug: Debug mode (default from config)
    """
    app = create_app()

    # Override config if provided
    if host is None:
        host = app.config.get('HOST', '127.0.0.1')
    if port is None:
        port = app.config.get('PORT', 5001)
    if debug is None:
        debug = app.config.get('DEBUG', False)

    app.logger.info(f"Starting server on {host}:{port}")
    app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':
    run_server()
