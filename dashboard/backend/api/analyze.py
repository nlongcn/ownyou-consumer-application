#!/usr/bin/env python3
"""
Analysis Runner API

Endpoints for triggering and monitoring email analysis runs.
"""

from flask import Blueprint, request, jsonify
import subprocess
import os
import logging
import json
from datetime import datetime
from .auth import login_required, get_current_user
from ..db.queries import save_analysis_run, get_total_cost
from .studio import check_studio_health, STUDIO_UI_URL

analyze_bp = Blueprint('analyze', __name__, url_prefix='/api/analyze')
logger = logging.getLogger(__name__)

# Store for tracking running jobs (in production, use Redis or database)
running_jobs = {}

# Cache for available models (refreshed on demand)
models_cache = {
    'timestamp': None,
    'models': None
}


@analyze_bp.route('/models', methods=['GET'])
@login_required
def get_available_models():
    """
    Get available LLM models from OpenAI, Claude, and Google.

    Query params:
        refresh: Force refresh from APIs (default: false)

    Returns:
        {
            "openai": ["gpt-4o", "gpt-4o-mini", ...],
            "claude": ["claude-3-5-sonnet-20241022", ...],
            "google": ["gemini-2.0-flash-exp", ...],
            "last_email_model": "google:gemini-2.0-flash-exp",
            "last_taxonomy_model": "openai:gpt-4o-mini"
        }
    """
    try:
        force_refresh = request.args.get('refresh', 'false').lower() == 'true'

        # Check cache (valid for 5 minutes for fresher model availability)
        if not force_refresh and models_cache['models'] and models_cache['timestamp']:
            age = (datetime.utcnow() - models_cache['timestamp']).total_seconds()
            if age < 300:  # 5 minutes (reduced from 1 hour for fresher model lists)
                logger.info("Returning cached models")
                return jsonify(models_cache['models']), 200

        logger.info("Fetching fresh model list from providers")

        models = {
            'openai': [],
            'claude': [],
            'google': [],
            'ollama': [],
            'last_email_model': None,
            'last_taxonomy_model': None
        }

        # OpenAI models - fetch from API with context windows
        try:
            import openai
            import os
            from src.email_parser.llm_clients.model_registry import get_context_window_openai

            api_key = os.getenv('OPENAI_API_KEY')
            if api_key:
                client = openai.OpenAI(api_key=api_key)
                response = client.models.list()
                # Filter for GPT models only
                gpt_model_names = sorted([
                    m.id for m in response.data
                    if 'gpt' in m.id.lower() and 'instruct' not in m.id.lower()
                ])

                # Fetch context window for each model
                gpt_models_with_context = []
                for model_name in gpt_model_names:
                    context_window = get_context_window_openai(client, model_name)
                    gpt_models_with_context.append({
                        'name': model_name,
                        'context_window': context_window
                    })

                models['openai'] = gpt_models_with_context
                logger.info(f"Found {len(gpt_models_with_context)} OpenAI models with context windows")
        except Exception as e:
            logger.warning(f"Failed to fetch OpenAI models: {e}")
            # Fallback to known models with context windows
            from src.email_parser.llm_clients.model_registry import get_context_window_openai
            fallback_models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
            models['openai'] = [
                {'name': name, 'context_window': get_context_window_openai(None, name)}
                for name in fallback_models
            ]

        # Claude models - fetch from API
        try:
            import anthropic
            from src.email_parser.llm_clients.model_registry import get_context_window_claude

            api_key = os.getenv('ANTHROPIC_API_KEY')
            if api_key:
                client = anthropic.Anthropic(api_key=api_key)

                # Fetch models directly from Anthropic API
                logger.info("Fetching Claude models from API using client.models.list()")
                api_models = client.models.list(limit=100)

                claude_models_with_context = []
                for model in api_models.data:
                    try:
                        context_window = get_context_window_claude(client, model.id)
                        claude_models_with_context.append({
                            'name': model.id,
                            'context_window': context_window
                        })
                        logger.debug(f"Added Claude model: {model.id} (context: {context_window})")
                    except Exception as model_error:
                        logger.debug(f"Skipping Claude model {model.id}: {model_error}")
                        continue

                models['claude'] = claude_models_with_context
                logger.info(f"Found {len(claude_models_with_context)} Claude models from API")
        except Exception as e:
            logger.warning(f"Failed to fetch Claude models from API: {e}")
            models['claude'] = []

        # Google Gemini models - fetch from Google AI API with context windows
        try:
            from google import genai
            from src.email_parser.llm_clients.model_registry import get_context_window_google

            api_key = os.getenv('GOOGLE_API_KEY')
            if api_key:
                client = genai.Client(api_key=api_key)
                # List available models from API with context windows
                gemini_models_with_context = []
                for model in client.models.list():
                    if 'generateContent' in model.supported_generation_methods:
                        # Extract model name (e.g., "models/gemini-2.5-pro" -> "gemini-2.5-pro")
                        model_name = model.name.replace('models/', '')
                        if 'gemini' in model_name.lower():
                            # Get context window (Google API exposes this!)
                            context_window = get_context_window_google(client, model.name)
                            gemini_models_with_context.append({
                                'name': model_name,
                                'context_window': context_window
                            })

                models['google'] = sorted(gemini_models_with_context, key=lambda x: x['name'], reverse=True)
                logger.info(f"Found {len(gemini_models_with_context)} Google Gemini models with context windows from API")
            else:
                # No API key - use fallback
                raise ValueError("No GOOGLE_API_KEY found")
        except Exception as e:
            logger.warning(f"Failed to fetch Google models from API: {e}")
            # Fallback to latest known models with context windows
            from src.email_parser.llm_clients.model_registry import get_context_window_google
            fallback_models = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
            models['google'] = [
                {'name': name, 'context_window': get_context_window_google(None, name)}
                for name in fallback_models
            ]
            logger.info(f"Using fallback list of {len(models['google'])} Google models")

        # Ollama models - fetch from local Ollama instance
        try:
            import requests
            ollama_url = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
            response = requests.get(f'{ollama_url}/api/tags', timeout=2)
            if response.ok:
                data = response.json()
                ollama_models = [model['name'] for model in data.get('models', [])]
                models['ollama'] = sorted(ollama_models)
                logger.info(f"Found {len(ollama_models)} Ollama models")
        except Exception as e:
            logger.warning(f"Failed to fetch Ollama models: {e}")
            models['ollama'] = []

        # Get last used models and max_emails from user preferences
        # Try loading from user preferences file first
        user_id = get_current_user()
        user_prefs_file = f'data/user_prefs_{user_id}.json'
        try:
            import json
            if os.path.exists(user_prefs_file):
                with open(user_prefs_file, 'r') as f:
                    prefs = json.load(f)
                    models['last_email_model'] = prefs.get('last_email_model', 'google:gemini-2.0-flash-exp')
                    models['last_taxonomy_model'] = prefs.get('last_taxonomy_model', 'openai:gpt-4o-mini')
                    models['last_max_emails'] = prefs.get('last_max_emails', 20)
            else:
                models['last_email_model'] = 'google:gemini-2.0-flash-exp'
                models['last_taxonomy_model'] = 'openai:gpt-4o-mini'
                models['last_max_emails'] = 20
        except Exception as e:
            logger.warning(f"Failed to load user preferences: {e}")
            models['last_email_model'] = 'google:gemini-2.0-flash-exp'
            models['last_taxonomy_model'] = 'openai:gpt-4o-mini'
            models['last_max_emails'] = 20

        # Extract just model names for frontend compatibility
        # Frontend expects: ["gpt-4o", "gpt-4o-mini", ...]
        # But we fetched: [{"name": "gpt-4o", "context_window": 128000}, ...]
        for provider in ['openai', 'claude', 'google']:
            if isinstance(models[provider], list) and len(models[provider]) > 0:
                if isinstance(models[provider][0], dict) and 'name' in models[provider][0]:
                    models[provider] = [m['name'] for m in models[provider]]

        # Cache the results
        models_cache['models'] = models
        models_cache['timestamp'] = datetime.utcnow()

        return jsonify(models), 200

    except Exception as e:
        logger.error(f"Failed to get models: {e}")
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/auth-status', methods=['GET'])
@login_required
def check_auth_status():
    """
    Check authentication status for email providers.

    Returns:
        {
            "gmail": true/false,
            "outlook": true/false
        }
    """
    try:
        import os

        # Get project root (3 levels up from this file)
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))

        # Check if token files exist in project root
        gmail_auth = os.path.exists(os.path.join(project_root, 'token.json'))
        outlook_auth = os.path.exists(os.path.join(project_root, 'ms_token.json'))

        return jsonify({
            'gmail': gmail_auth,
            'outlook': outlook_auth
        }), 200

    except Exception as e:
        logger.error(f"Failed to check auth status: {e}")
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/download', methods=['POST'])
@login_required
def download_emails():
    """
    Step 1: Download emails from provider(s) to CSV (raw emails).

    Request body:
        {
            "provider": "gmail" | "outlook" | "both",
            "max_emails": 20
        }

    Returns:
        {
            "job_id": "user_123_step1_2025-10-02T12:00:00",
            "status": "started",
            "message": "Step 1 started",
            "output_file": "data/raw_user_123_20251002_120000.csv"
        }
    """
    try:
        user_id = get_current_user()
        data = request.get_json()

        provider = data.get('provider', 'both')
        max_emails = data.get('max_emails', 20)

        # Validate provider
        if provider not in ['gmail', 'outlook', 'both']:
            return jsonify({
                'error': 'Invalid provider',
                'valid_providers': ['gmail', 'outlook', 'both']
            }), 400

        # Create job ID
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        job_id = f"{user_id}_step1_{datetime.utcnow().isoformat()}"

        # Generate output file path
        raw_csv = f'data/raw_{user_id}_{timestamp}.csv'

        # Get project root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

        # Build command: --pull-only mode
        cmd = [
            'python', '-m', 'src.email_parser.main',
            '--provider',
        ]

        # Add provider(s)
        if provider == 'both':
            cmd.extend(['gmail', 'outlook'])
        else:
            cmd.append(provider)

        cmd.extend([
            '--max-emails', str(max_emails),
            '--output', raw_csv,
            '--pull-only'  # Download raw emails without LLM processing
        ])

        # Build environment
        env = os.environ.copy()
        if 'PYTHONPATH' in env:
            env['PYTHONPATH'] = f"{project_root}:{env['PYTHONPATH']}"
        else:
            env['PYTHONPATH'] = project_root

        # Create provider-specific directories (multi-provider mode prepends provider name)
        # E.g., data/raw_user.csv becomes gmail_data/raw_user.csv
        if provider == 'both':
            for p in ['gmail', 'outlook']:
                provider_dir = os.path.join(project_root, f"{p}_{os.path.dirname(raw_csv)}")
                os.makedirs(provider_dir, exist_ok=True)
                logger.info(f"Created directory: {provider_dir}")
        else:
            provider_dir = os.path.join(project_root, f"{provider}_{os.path.dirname(raw_csv)}")
            os.makedirs(provider_dir, exist_ok=True)
            logger.info(f"Created directory: {provider_dir}")

        # Start subprocess
        log_file = f"/tmp/analysis_{job_id}.log"

        with open(log_file, 'w') as f:
            process = subprocess.Popen(
                cmd,
                stdout=f,
                stderr=subprocess.STDOUT,
                cwd=project_root,
                env=env
            )

        # Store job info
        running_jobs[job_id] = {
            'user_id': user_id,
            'step': 'download',
            'provider': provider,
            'max_emails': max_emails,
            'status': 'running',
            'pid': process.pid,
            'log_file': log_file,
            'raw_csv': raw_csv,
            'started_at': datetime.utcnow().isoformat(),
            'run_tracked': False
        }

        logger.info(f"Started Step 1 (download) job {job_id} for user {user_id}")

        if provider == 'both':
            message = f'Step 1 started: downloading {max_emails} emails from Gmail and Outlook'
        else:
            message = f'Step 1 started: downloading {max_emails} emails from {provider}'

        return jsonify({
            'job_id': job_id,
            'status': 'started',
            'message': message,
            'output_file': raw_csv
        }), 200

    except Exception as e:
        logger.error(f"Failed to start Step 1 (download): {e}")
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/summarize', methods=['POST'])
@login_required
def summarize_emails():
    """
    Step 2: Summarize emails from raw CSV using EMAIL_MODEL.

    Request body:
        {
            "input_csv": "data/raw_user_123_20251002_120000.csv",
            "email_model": "google:gemini-2.0-flash-exp"  (optional)
        }

    Returns:
        {
            "job_id": "user_123_step2_2025-10-02T12:05:00",
            "status": "started",
            "message": "Step 2 started",
            "output_file": "data/summaries_user_123_20251002_120500.csv"
        }
    """
    try:
        user_id = get_current_user()
        data = request.get_json()

        input_csv = data.get('input_csv')
        email_model = data.get('email_model')

        # Validate input
        if not input_csv:
            return jsonify({'error': 'input_csv is required'}), 400

        # Check if input file exists
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
        input_csv_path = os.path.join(project_root, input_csv)
        if not os.path.exists(input_csv_path):
            return jsonify({'error': f'Input CSV not found: {input_csv}'}), 404

        # Create job ID
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        job_id = f"{user_id}_step2_{datetime.utcnow().isoformat()}"

        # Generate output file path
        summaries_csv = f'data/summaries_{user_id}_{timestamp}.csv'

        # Build command: --summarize-only mode
        cmd = [
            'python', '-m', 'src.email_parser.main',
            '--summarize-only',
            '--input-csv', input_csv,
            '--output', summaries_csv
        ]

        # Add email model if provided
        if email_model:
            cmd.extend(['--email-model', email_model])

        # Build environment
        env = os.environ.copy()
        if 'PYTHONPATH' in env:
            env['PYTHONPATH'] = f"{project_root}:{env['PYTHONPATH']}"
        else:
            env['PYTHONPATH'] = project_root

        # Start subprocess
        log_file = f"/tmp/analysis_{job_id}.log"

        with open(log_file, 'w') as f:
            process = subprocess.Popen(
                cmd,
                stdout=f,
                stderr=subprocess.STDOUT,
                cwd=project_root,
                env=env
            )

        # Store job info
        running_jobs[job_id] = {
            'user_id': user_id,
            'step': 'summarize',
            'email_model': email_model,
            'status': 'running',
            'pid': process.pid,
            'log_file': log_file,
            'input_csv': input_csv,
            'summaries_csv': summaries_csv,
            'started_at': datetime.utcnow().isoformat(),
            'run_tracked': False
        }

        logger.info(f"Started Step 2 (summarize) job {job_id} for user {user_id}")

        model_msg = f" using {email_model}" if email_model else ""
        message = f'Step 2 started: summarizing emails{model_msg}'

        return jsonify({
            'job_id': job_id,
            'status': 'started',
            'message': message,
            'output_file': summaries_csv
        }), 200

    except Exception as e:
        logger.error(f"Failed to start Step 2 (summarize): {e}")
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/classify', methods=['POST'])
@login_required
def classify_emails():
    """
    Step 3: Classify emails using IAB taxonomy and TAXONOMY_MODEL.

    Request body:
        {
            "input_csv": "data/summaries_user_123_20251002_120500.csv",
            "taxonomy_model": "openai:gpt-4o-mini",  (optional)
            "force_reprocess": false,  (optional)
            "enable_studio": false  (optional)
        }

    Returns:
        {
            "job_id": "user_123_step3_2025-10-02T12:10:00",
            "status": "started",
            "message": "Step 3 started",
            "output_file": "data/profile_user_123_20251002_121000.json",
            "studio_enabled": false,
            "studio_url": STUDIO_UI_URL
        }
    """
    try:
        user_id = get_current_user()
        data = request.get_json()

        input_csv = data.get('input_csv')
        taxonomy_model = data.get('taxonomy_model')
        force_reprocess = data.get('force_reprocess', False)
        enable_studio = data.get('enable_studio', False)

        # Validate input
        if not input_csv:
            return jsonify({'error': 'input_csv is required'}), 400

        # Check if input file exists
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
        input_csv_path = os.path.join(project_root, input_csv)
        if not os.path.exists(input_csv_path):
            return jsonify({'error': f'Input CSV not found: {input_csv}'}), 404

        # Create job ID
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        job_id = f"{user_id}_step3_{datetime.utcnow().isoformat()}"

        # Generate output file path
        profile_json = f'data/profile_{user_id}_{timestamp}.json'

        # Build command: --iab-csv mode
        cmd = [
            'python', '-m', 'src.email_parser.main',
            '--iab-csv', input_csv,
            '--iab-output', profile_json,
            '--user-id', user_id
        ]

        # Add taxonomy model if provided
        if taxonomy_model:
            cmd.extend(['--taxonomy-model', taxonomy_model])

        # Add force-reprocess flag if requested
        if force_reprocess:
            cmd.append('--force-reprocess')

        # Build environment
        env = os.environ.copy()
        if 'PYTHONPATH' in env:
            env['PYTHONPATH'] = f"{project_root}:{env['PYTHONPATH']}"
        else:
            env['PYTHONPATH'] = project_root

        # Enable Studio visualization if requested
        if enable_studio:
            # Check if Studio server is running
            studio_health = check_studio_health()
            if not studio_health['running']:
                logger.warning(f"Studio requested but server not running: {studio_health['error']}")
                return jsonify({
                    'error': 'LangGraph Studio server is not running',
                    'details': studio_health['error'],
                    'help': 'Start Studio server first using the Studio control panel, or manually run: langgraph dev'
                }), 400

            env['LANGGRAPH_STUDIO_DEBUG'] = 'true'
            logger.info("Studio debug mode enabled for Step 3 (classify)")

        # Start subprocess
        log_file = f"/tmp/analysis_{job_id}.log"

        with open(log_file, 'w') as f:
            process = subprocess.Popen(
                cmd,
                stdout=f,
                stderr=subprocess.STDOUT,
                cwd=project_root,
                env=env
            )

        # Store job info
        running_jobs[job_id] = {
            'user_id': user_id,
            'step': 'classify',
            'taxonomy_model': taxonomy_model,
            'force_reprocess': force_reprocess,
            'enable_studio': enable_studio,
            'status': 'running',
            'pid': process.pid,
            'log_file': log_file,
            'input_csv': input_csv,
            'profile_json': profile_json,
            'started_at': datetime.utcnow().isoformat(),
            'run_tracked': False
        }

        logger.info(f"Started Step 3 (classify) job {job_id} for user {user_id}")

        model_msg = f" using {taxonomy_model}" if taxonomy_model else ""
        message = f'Step 3 started: classifying emails{model_msg}'

        # Build response
        response = {
            'job_id': job_id,
            'status': 'started',
            'message': message,
            'output_file': profile_json
        }

        # Add Studio info if enabled
        if enable_studio:
            response['studio_enabled'] = True
            response['studio_url'] = STUDIO_UI_URL
            logger.info(f"Studio visualization enabled - view at: {response['studio_url']}")

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Failed to start Step 3 (classify): {e}")
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/start', methods=['POST'])
@login_required
def start_analysis():
    """
    Start full email analysis pipeline for current user (all 3 steps).

    Request body:
        {
            "provider": "gmail",
            "max_emails": 20,
            "enable_studio": false
        }

    Returns:
        {
            "job_id": "user_123_2025-10-02T12:00:00",
            "status": "started",
            "message": "Analysis started",
            "studio_enabled": false,
            "studio_url": STUDIO_UI_URL
        }
    """
    try:
        user_id = get_current_user()
        data = request.get_json()

        provider = data.get('provider', 'both')
        max_emails = data.get('max_emails', 20)
        email_model = data.get('email_model')  # Optional: for email summarization
        taxonomy_model = data.get('taxonomy_model')  # Optional: for IAB classification
        skip_summarization = data.get('skip_summarization', False)  # Default: False (summarization enabled)
        enable_studio = data.get('enable_studio', False)  # Optional: enable Studio visualization

        # Validate provider
        if provider not in ['gmail', 'outlook', 'both']:
            return jsonify({
                'error': 'Invalid provider',
                'valid_providers': ['gmail', 'outlook', 'both']
            }), 400

        # Create job ID
        job_id = f"{user_id}_{datetime.utcnow().isoformat()}"

        # Build command to run email parser
        # Get project root (2 levels up from dashboard/backend/api)
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

        # Generate file paths for this analysis run
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        summary_csv = f'data/analysis_{user_id}_{timestamp}.csv'
        profile_json = f'data/profile_{user_id}_{timestamp}.json'

        # Branch based on skip_summarization flag
        if skip_summarization:
            # ADVANCED MODE: Skip summarization (raw emails → IAB classification directly)
            logger.info(f"Using advanced mode: raw emails → taxonomy classification (skip_summarization=True)")

            cmd = [
                'python', '-m', 'src.email_parser.main',
                '--provider',
            ]

            # Add provider(s) - "both" means gmail and outlook
            if provider == 'both':
                cmd.extend(['gmail', 'outlook'])
            else:
                cmd.append(provider)

            # Add remaining arguments
            cmd.extend([
                '--max-emails', str(max_emails),
                '--iab-profile',
                '--user-id', user_id,
                '--output', summary_csv,
                '--iab-output', profile_json
            ])

        else:
            # DEFAULT MODE: Two-step processing (download+summarize → classify)
            logger.info(f"Using default mode: email summarization → taxonomy classification (skip_summarization=False)")

            # STEP 1: Download and summarize emails with EMAIL_MODEL → CSV with summaries
            step1_cmd = [
                'python', '-m', 'src.email_parser.main',
                '--provider',
            ]

            # Add provider(s)
            if provider == 'both':
                step1_cmd.extend(['gmail', 'outlook'])
            else:
                step1_cmd.append(provider)

            step1_cmd.extend([
                '--max-emails', str(max_emails),
                '--output', summary_csv
            ])

            # STEP 2: Process summaries with TAXONOMY_MODEL → IAB profile
            step2_cmd = [
                'python', '-m', 'src.email_parser.main',
                '--iab-csv', summary_csv,
                '--iab-output', profile_json,
                '--user-id', user_id
            ]

            # Combine into sequential bash command using &&
            # This ensures step2 only runs if step1 succeeds
            cmd = [
                'bash', '-c',
                f"{' '.join(step1_cmd)} && {' '.join(step2_cmd)}"
            ]

        # Build environment with model selection
        env = os.environ.copy()

        # Add project root to PYTHONPATH so src module can be imported
        if 'PYTHONPATH' in env:
            env['PYTHONPATH'] = f"{project_root}:{env['PYTHONPATH']}"
        else:
            env['PYTHONPATH'] = project_root

        # Helper function to set model in environment
        def set_model_env(model_spec, env_var_prefix):
            if not model_spec or ':' not in model_spec:
                return
            provider_name, model_name = model_spec.split(':', 1)
            # Don't override LLM_PROVIDER - it may be different for EMAIL_MODEL vs TAXONOMY_MODEL
            # The workflow will use the provider from the model spec
            if provider_name == 'openai':
                env['OPENAI_MODEL'] = model_name
            elif provider_name == 'claude':
                env['ANTHROPIC_MODEL'] = model_name
            elif provider_name == 'google':
                env['GOOGLE_MODEL'] = model_name
            elif provider_name == 'ollama':
                env['OLLAMA_MODEL'] = model_name
            # Store the full spec (provider:model) in the env var
            env[env_var_prefix] = model_spec
            logger.info(f"Setting {env_var_prefix}: {model_spec} (provider={provider_name}, model={model_name})")

        # Set email model (for summarization)
        if email_model:
            set_model_env(email_model, 'EMAIL_MODEL')

        # Set taxonomy model (for IAB classification)
        if taxonomy_model:
            set_model_env(taxonomy_model, 'TAXONOMY_MODEL')
        elif email_model:
            # Fallback: if no taxonomy model specified, use email model
            env['TAXONOMY_MODEL'] = email_model
            logger.info(f"TAXONOMY_MODEL not specified, using EMAIL_MODEL: {email_model}")

        # Enable Studio visualization if requested
        if enable_studio:
            # Check if Studio server is running
            studio_health = check_studio_health()
            if not studio_health['running']:
                logger.warning(f"Studio requested but server not running: {studio_health['error']}")
                return jsonify({
                    'error': 'LangGraph Studio server is not running',
                    'details': studio_health['error'],
                    'help': 'Start Studio server first using the Studio control panel, or manually run: langgraph dev'
                }), 400

            env['LANGGRAPH_STUDIO_DEBUG'] = 'true'
            logger.info("Studio debug mode enabled for this analysis run")

        # Start subprocess in background
        # In production, use Celery or background job queue
        log_file = f"/tmp/analysis_{job_id}.log"

        with open(log_file, 'w') as f:
            process = subprocess.Popen(
                cmd,
                stdout=f,
                stderr=subprocess.STDOUT,
                cwd=project_root,  # Run from project root where src/ is located
                env=env
            )

        # Store job info
        running_jobs[job_id] = {
            'user_id': user_id,
            'provider': provider,
            'max_emails': max_emails,
            'email_model': email_model,
            'taxonomy_model': taxonomy_model,
            'skip_summarization': skip_summarization,
            'enable_studio': enable_studio,
            'status': 'running',
            'pid': process.pid,
            'log_file': log_file,
            'summary_csv': summary_csv,
            'profile_json': profile_json,
            'started_at': datetime.utcnow().isoformat(),
            'run_tracked': False  # Track if we've saved to analysis_runs table
        }

        # Save last used models and max_emails for this user (in-memory for now)
        # In production, store in database
        import json
        user_prefs_file = f'data/user_prefs_{user_id}.json'
        try:
            # Load existing preferences
            prefs = {}
            if os.path.exists(user_prefs_file):
                with open(user_prefs_file, 'r') as f:
                    prefs = json.load(f)

            # Update preferences
            if email_model:
                prefs['last_email_model'] = email_model
            if taxonomy_model:
                prefs['last_taxonomy_model'] = taxonomy_model
            prefs['last_max_emails'] = max_emails

            # Save back
            with open(user_prefs_file, 'w') as f:
                json.dump(prefs, f)
        except Exception as e:
            logger.warning(f"Failed to save user preferences: {e}")

        logger.info(f"Started analysis job {job_id} for user {user_id}")

        # Create appropriate message based on provider
        if provider == 'both':
            message = f'Analysis started: processing {max_emails} emails from Gmail and Outlook'
        else:
            message = f'Analysis started: processing {max_emails} emails from {provider}'

        # Build response
        response = {
            'job_id': job_id,
            'status': 'started',
            'message': message
        }

        # Add Studio info if enabled
        if enable_studio:
            response['studio_enabled'] = True
            response['studio_url'] = STUDIO_UI_URL
            logger.info(f"Studio visualization enabled - view at: {response['studio_url']}")

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Failed to start analysis: {e}")
        return jsonify({'error': str(e)}), 500


def _merge_provider_csvs(job):
    """
    Merge provider-specific CSV files into a single combined file.

    When provider='both', the CLI creates two separate CSVs:
    - gmail_data/raw_user_timestamp.csv
    - outlook_data/raw_user_timestamp.csv

    This function merges them into:
    - data/raw_user_timestamp.csv

    Args:
        job: Job dictionary with metadata
    """
    try:
        if job.get('step') != 'download' or job.get('provider') != 'both':
            return  # Only merge for Step 1 with both providers

        raw_csv = job.get('raw_csv')
        if not raw_csv:
            return

        import csv
        import os

        # Get project root
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

        # Build provider-specific paths
        gmail_csv = os.path.join(project_root, f"gmail_{raw_csv}")
        outlook_csv = os.path.join(project_root, f"outlook_{raw_csv}")
        combined_csv = os.path.join(project_root, raw_csv)

        # Check if provider CSVs exist
        if not os.path.exists(gmail_csv) and not os.path.exists(outlook_csv):
            logger.warning(f"No provider CSVs found to merge: {gmail_csv}, {outlook_csv}")
            return

        # Create output directory if it doesn't exist
        os.makedirs(os.path.dirname(combined_csv), exist_ok=True)

        # Merge CSVs
        with open(combined_csv, 'w', newline='', encoding='utf-8') as outfile:
            writer = None
            rows_written = 0

            for provider_csv in [gmail_csv, outlook_csv]:
                if not os.path.exists(provider_csv):
                    continue

                with open(provider_csv, 'r', encoding='utf-8') as infile:
                    reader = csv.DictReader(infile)

                    if writer is None:
                        # Initialize writer with fieldnames from first file
                        writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
                        writer.writeheader()

                    for row in reader:
                        writer.writerow(row)
                        rows_written += 1

        logger.info(f"Merged {rows_written} emails from provider CSVs into {raw_csv}")

    except Exception as e:
        logger.error(f"Failed to merge provider CSVs: {e}")


def _track_completed_job(job_id, job):
    """
    Track a completed job by saving analysis run record to database.

    Args:
        job_id: Job identifier
        job: Job dictionary with metadata
    """
    try:
        user_id = job['user_id']
        started_at = datetime.fromisoformat(job['started_at'])
        completed_at = datetime.utcnow()
        duration_seconds = (completed_at - started_at).total_seconds()

        # Extract metrics from output files
        emails_processed = 0
        classifications_added = 0

        # Determine which CSV file to count based on job step
        step = job.get('step', 'unknown')
        csv_file = None

        if step == 'download':
            # Step 1: Raw emails CSV
            csv_file = job.get('raw_csv')
        elif step == 'summarize':
            # Step 2: Summaries CSV (note: plural 'summaries_csv')
            csv_file = job.get('summaries_csv')
        elif step == 'classify':
            # Step 3: Input CSV (already summarized)
            csv_file = job.get('input_csv')

        # Count emails from CSV if available
        if csv_file and os.path.exists(csv_file):
            try:
                import csv
                with open(csv_file, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    emails_processed = sum(1 for _ in reader)
            except Exception as e:
                logger.warning(f"Failed to count emails from CSV ({csv_file}): {e}")

        # Count classifications from profile JSON if available (Step 3 only)
        profile_json = job.get('profile_json')
        if profile_json and os.path.exists(profile_json):
            try:
                with open(profile_json, 'r', encoding='utf-8') as f:
                    profile_data = json.load(f)

                    # Count classifications across all sections
                    for section in ['demographics', 'household', 'interests', 'purchase_intent']:
                        if section in profile_data:
                            section_data = profile_data[section]

                            # Handle different section formats
                            if isinstance(section_data, dict):
                                # Demographics/household: dict of categories
                                classifications_added += len(section_data)
                            elif isinstance(section_data, list):
                                # Interests/purchase_intent: list of items
                                classifications_added += len(section_data)
            except Exception as e:
                logger.warning(f"Failed to count classifications from JSON ({profile_json}): {e}")

        # Get total cost from cost_tracking table
        # This links to the cost record that was saved during processing
        total_cost = None
        try:
            cost_summary = get_total_cost(user_id)
            # Use the most recent cost (this is an approximation)
            # In a production system, we'd link jobs to cost records via run_id
            total_cost = cost_summary.get('avg_cost_per_run')
        except Exception as e:
            logger.warning(f"Failed to get cost for job: {e}")

        # Extract model info from job
        # Model format: "provider:model_name" or None
        model_display = None
        if job.get('taxonomy_model'):
            model_display = job['taxonomy_model']  # e.g., "openai:gpt-4o-mini"
        elif job.get('email_model'):
            model_display = job['email_model']

        # Save analysis run record
        run_id = save_analysis_run(
            user_id=user_id,
            run_date=started_at.isoformat(),
            emails_processed=emails_processed,
            classifications_added=classifications_added,
            classifications_updated=0,  # We don't track updates separately yet
            total_cost=total_cost,
            duration_seconds=duration_seconds,
            status='completed',
            provider=job.get('provider', 'unknown'),
            model=model_display,
            started_at=started_at.isoformat(),
            completed_at=completed_at.isoformat()
        )

        logger.info(f"Saved analysis run record: {run_id} (user={user_id}, emails={emails_processed}, classifications={classifications_added})")

        # Mark as tracked
        job['run_tracked'] = True
        job['completed_at'] = completed_at.isoformat()

    except Exception as e:
        logger.error(f"Failed to track completed job {job_id}: {e}")


@analyze_bp.route('/status/<job_id>', methods=['GET'])
@login_required
def get_job_status(job_id):
    """
    Get status of a running job.

    Returns:
        {
            "job_id": "...",
            "status": "running|completed|failed",
            "started_at": "...",
            "log_preview": "..."
        }
    """
    try:
        user_id = get_current_user()

        if job_id not in running_jobs:
            return jsonify({'error': 'Job not found'}), 404

        job = running_jobs[job_id]

        # Security: Ensure user can only see their own jobs
        if job['user_id'] != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Check if process is still running
        try:
            import psutil
            process = psutil.Process(job['pid'])
            # Check both is_running() and process status
            # Process might exist but be zombie/terminated
            if process.is_running() and process.status() != psutil.STATUS_ZOMBIE:
                status = 'running'
            else:
                status = 'completed'

                # Merge provider CSVs if needed (Step 1 with provider='both')
                if not job.get('csvs_merged', False):
                    _merge_provider_csvs(job)
                    job['csvs_merged'] = True

                # Track completed job (save to analysis_runs table)
                if not job.get('run_tracked', False):
                    _track_completed_job(job_id, job)

        except (psutil.NoSuchProcess, psutil.AccessDenied, ImportError):
            status = 'completed'

            # Merge provider CSVs if needed (Step 1 with provider='both')
            if not job.get('csvs_merged', False):
                _merge_provider_csvs(job)
                job['csvs_merged'] = True

            # Track completed job (save to analysis_runs table)
            if not job.get('run_tracked', False):
                _track_completed_job(job_id, job)

        # Get log preview (last 20 lines)
        log_preview = ""
        try:
            if os.path.exists(job['log_file']):
                with open(job['log_file'], 'r') as f:
                    lines = f.readlines()
                    log_preview = ''.join(lines[-20:])
        except Exception as e:
            logger.error(f"Failed to read log file: {e}")

        # Build response based on job type
        response = {
            'job_id': job_id,
            'status': status,
            'started_at': job['started_at'],
            'log_preview': log_preview
        }

        # Add step-specific metadata
        if 'step' in job:
            response['step'] = job['step']

        # Add common fields based on what's available
        if 'provider' in job:
            response['provider'] = job['provider']
        if 'max_emails' in job:
            response['max_emails'] = job['max_emails']
        if 'email_model' in job:
            response['email_model'] = job['email_model']
        if 'taxonomy_model' in job:
            response['taxonomy_model'] = job['taxonomy_model']

        # Add output file info if available
        if 'raw_csv' in job:
            response['output_file'] = job['raw_csv']
        elif 'summaries_csv' in job:
            response['output_file'] = job['summaries_csv']
        elif 'profile_json' in job:
            response['output_file'] = job['profile_json']

        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/logs/<job_id>', methods=['GET'])
@login_required
def get_full_logs(job_id):
    """
    Get full logs for a job.

    Returns:
        {
            "logs": "full log content"
        }
    """
    try:
        user_id = get_current_user()

        if job_id not in running_jobs:
            return jsonify({'error': 'Job not found'}), 404

        job = running_jobs[job_id]

        # Security: Ensure user can only see their own jobs
        if job['user_id'] != user_id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Read full log file
        full_logs = ""
        try:
            if os.path.exists(job['log_file']):
                with open(job['log_file'], 'r') as f:
                    full_logs = f.read()
        except Exception as e:
            logger.error(f"Failed to read log file: {e}")
            return jsonify({'error': 'Failed to read logs'}), 500

        return jsonify({
            'logs': full_logs
        }), 200

    except Exception as e:
        logger.error(f"Failed to get full logs: {e}")
        return jsonify({'error': str(e)}), 500


@analyze_bp.route('/jobs', methods=['GET'])
@login_required
def list_jobs():
    """
    List all jobs for current user.

    Returns:
        {
            "jobs": [
                {
                    "job_id": "...",
                    "status": "...",
                    "started_at": "..."
                }
            ]
        }
    """
    try:
        user_id = get_current_user()

        # Filter jobs for current user
        user_jobs = []
        for job_id, job in running_jobs.items():
            if job['user_id'] == user_id:
                job_info = {
                    'job_id': job_id,
                    'status': job['status'],
                    'started_at': job['started_at']
                }

                # Add step info if available
                if 'step' in job:
                    job_info['step'] = job['step']

                # Add provider/max_emails if available (Step 1 / full pipeline)
                if 'provider' in job:
                    job_info['provider'] = job['provider']
                if 'max_emails' in job:
                    job_info['max_emails'] = job['max_emails']

                # Add model info if available
                if 'email_model' in job:
                    job_info['email_model'] = job['email_model']
                if 'taxonomy_model' in job:
                    job_info['taxonomy_model'] = job['taxonomy_model']

                user_jobs.append(job_info)

        return jsonify({
            'jobs': user_jobs,
            'count': len(user_jobs)
        }), 200

    except Exception as e:
        logger.error(f"Failed to list jobs: {e}")
        return jsonify({'error': str(e)}), 500
