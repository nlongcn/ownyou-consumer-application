"""
LangGraph Studio Server Management API

Endpoints for managing the LangGraph Studio server lifecycle:
- Health checks
- Start/stop server
- Status monitoring
"""

import os
import subprocess
import logging
import socket
import requests
import time
import signal
from flask import Blueprint, jsonify
from .auth import login_required

logger = logging.getLogger(__name__)

studio_bp = Blueprint('studio', __name__, url_prefix='/api/studio')

# Global variable to track Studio server process
_studio_process = None
_studio_pid = None

STUDIO_PORT = 2024
STUDIO_API_URL = f"http://127.0.0.1:{STUDIO_PORT}"
STUDIO_HEALTH_ENDPOINT = f"{STUDIO_API_URL}/ok"

# LangSmith project-specific URL (if configured)
LANGSMITH_ORG_ID = os.getenv('LANGSMITH_ORG_ID')
LANGSMITH_PROJECT_ID = os.getenv('LANGSMITH_PROJECT_ID')

if LANGSMITH_ORG_ID and LANGSMITH_PROJECT_ID:
    # Deep-link to specific LangSmith project with Studio baseUrl
    STUDIO_UI_URL = (
        f"https://smith.langchain.com/o/{LANGSMITH_ORG_ID}/"
        f"projects/p/{LANGSMITH_PROJECT_ID}?"
        f"baseUrl={STUDIO_API_URL}&"
        f"timeModel=%7B%22duration%22%3A%227d%22%7D"
    )
else:
    # Fallback to generic Studio URL
    STUDIO_UI_URL = f"https://smith.langchain.com/studio/?baseUrl={STUDIO_API_URL}"


def is_port_in_use(port: int) -> bool:
    """Check if a port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', port))
            return False
        except OSError:
            return True


def check_studio_health() -> dict:
    """
    Check if LangGraph Studio server is running and healthy.

    Returns:
        dict with keys:
            - running (bool): Whether server is responding
            - url (str): Studio UI URL if running
            - api_url (str): Studio API URL
            - error (str|None): Error message if not running
    """
    # First check if port is in use
    if not is_port_in_use(STUDIO_PORT):
        return {
            'running': False,
            'url': None,
            'api_url': STUDIO_API_URL,
            'error': f'Port {STUDIO_PORT} is not in use - Studio server not running'
        }

    # Check if the Studio API endpoint responds
    try:
        response = requests.get(STUDIO_HEALTH_ENDPOINT, timeout=2)
        if response.status_code == 200 and response.json().get('ok'):
            return {
                'running': True,
                'url': STUDIO_UI_URL,
                'api_url': STUDIO_API_URL,
                'error': None
            }
        else:
            return {
                'running': False,
                'url': None,
                'api_url': STUDIO_API_URL,
                'error': f'Studio API returned unexpected response: {response.status_code}'
            }
    except requests.exceptions.RequestException as e:
        return {
            'running': False,
            'url': None,
            'api_url': STUDIO_API_URL,
            'error': f'Port {STUDIO_PORT} in use but Studio API not responding: {str(e)}'
        }


@studio_bp.route('/status', methods=['GET'])
@login_required
def get_studio_status():
    """
    Get current status of LangGraph Studio server.

    Returns:
        200: Studio status
        {
            "running": true/false,
            "url": "https://smith.langchain.com/studio/...",
            "api_url": "http://127.0.0.1:2024",
            "error": null or error message,
            "pid": process ID if tracked
        }
    """
    status = check_studio_health()

    # Add PID if we started the process
    global _studio_pid
    if _studio_pid:
        status['pid'] = _studio_pid

    return jsonify(status), 200


@studio_bp.route('/start', methods=['POST'])
@login_required
def start_studio_server():
    """
    Start LangGraph Studio server if not already running.

    Returns:
        200: Server started successfully or already running
        400: Server start failed (missing langgraph CLI, port blocked, etc.)
        500: Internal error
    """
    global _studio_process, _studio_pid

    try:
        # Check if already running
        health = check_studio_health()
        if health['running']:
            logger.info("Studio server already running")
            return jsonify({
                'success': True,
                'message': 'Studio server is already running',
                'url': health['url'],
                'api_url': health['api_url']
            }), 200

        # Check if langgraph CLI is available
        try:
            subprocess.run(['which', 'langgraph'], check=True, capture_output=True)
        except subprocess.CalledProcessError:
            error_msg = (
                "langgraph CLI not found. Install with: pip install langgraph-cli\n"
                "Or check if it's in your PATH"
            )
            logger.error(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400

        # Check if port is blocked by another process
        if is_port_in_use(STUDIO_PORT):
            error_msg = (
                f"Port {STUDIO_PORT} is in use but Studio API not responding. "
                f"Kill the process using: lsof -ti:{STUDIO_PORT} | xargs kill -9"
            )
            logger.error(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400

        # Get project root directory
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))

        # Prepare log file
        log_dir = os.path.join(project_root, 'logs')
        os.makedirs(log_dir, exist_ok=True)
        log_file_path = os.path.join(log_dir, 'langgraph_studio.log')

        # Start Studio server in background
        logger.info(f"Starting LangGraph Studio server in {project_root}")

        with open(log_file_path, 'w') as log_file:
            _studio_process = subprocess.Popen(
                ['langgraph', 'dev'],
                cwd=project_root,
                stdout=log_file,
                stderr=subprocess.STDOUT,
                start_new_session=True  # Detach from parent process
            )
            _studio_pid = _studio_process.pid

        logger.info(f"Studio server starting with PID {_studio_pid}, logs: {log_file_path}")

        # Wait for server to be ready (max 10 seconds)
        for i in range(20):  # 20 * 0.5s = 10 seconds
            time.sleep(0.5)
            health = check_studio_health()
            if health['running']:
                logger.info(f"Studio server ready after {(i+1)*0.5}s")
                return jsonify({
                    'success': True,
                    'message': 'Studio server started successfully',
                    'url': health['url'],
                    'api_url': health['api_url'],
                    'pid': _studio_pid,
                    'log_file': log_file_path
                }), 200

        # Timeout - server didn't start
        error_msg = (
            f"Studio server did not start within 10 seconds. "
            f"Check logs at: {log_file_path}"
        )
        logger.error(error_msg)

        # Clean up failed process
        if _studio_process:
            _studio_process.terminate()
            _studio_process = None
            _studio_pid = None

        return jsonify({
            'success': False,
            'error': error_msg,
            'log_file': log_file_path
        }), 500

    except Exception as e:
        logger.error(f"Failed to start Studio server: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Internal error starting Studio server: {str(e)}'
        }), 500


@studio_bp.route('/stop', methods=['POST'])
@login_required
def stop_studio_server():
    """
    Stop LangGraph Studio server if it was started by this backend.

    Returns:
        200: Server stopped successfully
        400: Server not running or not managed by this backend
    """
    global _studio_process, _studio_pid

    if not _studio_process and not _studio_pid:
        return jsonify({
            'success': False,
            'message': 'Studio server was not started by this backend - use: pkill -f "langgraph dev"'
        }), 400

    try:
        if _studio_pid:
            try:
                os.kill(_studio_pid, signal.SIGTERM)
                logger.info(f"Sent SIGTERM to Studio server (PID {_studio_pid})")

                # Wait for graceful shutdown (max 5 seconds)
                for _ in range(10):
                    time.sleep(0.5)
                    if not is_port_in_use(STUDIO_PORT):
                        break

                # Force kill if still running
                if is_port_in_use(STUDIO_PORT):
                    os.kill(_studio_pid, signal.SIGKILL)
                    logger.warning(f"Force killed Studio server (PID {_studio_pid})")

            except ProcessLookupError:
                logger.info(f"Studio server process {_studio_pid} already terminated")

        _studio_process = None
        _studio_pid = None

        return jsonify({
            'success': True,
            'message': 'Studio server stopped successfully'
        }), 200

    except Exception as e:
        logger.error(f"Failed to stop Studio server: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Error stopping Studio server: {str(e)}'
        }), 500


# Cleanup on module shutdown
def cleanup_studio_server():
    """Cleanup function to stop Studio server on backend shutdown."""
    global _studio_process, _studio_pid

    if _studio_pid:
        try:
            os.kill(_studio_pid, signal.SIGTERM)
            logger.info(f"Cleaned up Studio server (PID {_studio_pid}) on shutdown")
        except:
            pass

    _studio_process = None
    _studio_pid = None
