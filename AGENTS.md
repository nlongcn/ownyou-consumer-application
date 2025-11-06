# Repository Guidelines

## Project Structure & Module Organization
- `src/email_parser/`: core package (CLI in `main.py`; setup flow in `setup/account_setup.py`).
  - `llm_clients/` (OpenAI/Anthropic/Google/Ollama adapters), `workflow/` (state, executor, prompts), `models/` (Pydantic models).
- `tests/` and `tests/integration/`: pytest suites and fixtures (`tests/conftest.py`).
- `developer_docs/`: design, testing tools, rollout and troubleshooting notes.
- `data/`, `logs/`: local artifacts; do not commit sensitive or bulky files.

## Build, Test, and Development Commands
- Create env: `python -m venv .venv && source .venv/bin/activate` (Windows: `\.venv\\Scripts\\activate`).
- Install (dev): `pip install -e .[dev]`.
- Run CLI: `email-parser --help` and `email-parser-setup` (from console scripts), or `python -m email_parser.main`.
- Test quick: `pytest -q`.
- Coverage: `pytest --cov=email_parser --cov-report=term-missing`.
- Format/Lint/Types: `black src tests`, `flake8 src tests`, `mypy src`.

## Coding Style & Naming Conventions
- Python 3.8+; 4-space indent; format with Black; keep lines concise.
- Type hints required; mypy-clean. Prefer Pydantic models in `models/` for data.
- Naming: modules/files `snake_case`; classes `PascalCase`; functions/vars `snake_case`; constants `UPPER_SNAKE_CASE`.
- Logging: use `structlog`; avoid printing. Write only non-sensitive info to `logs/`.

## Testing Guidelines
- Framework: pytest (+ pytest-cov). Place unit tests in `tests/test_*.py`, integration in `tests/integration/`.
- Use `tests/conftest.py` fixtures; avoid network and real credentials. Mock LLM/email providers.
- Keep tests deterministic and fast; assert on structured outputs and state transitions in `workflow/`.

## Commit & Pull Request Guidelines
- Commit style: imperative mood; concise scope prefix when useful (e.g., `fix(workflow): handle empty thread`).
- Reference issues (e.g., `Closes #123`); group related changes per commit.
- PRs must include: clear description, motivation, test coverage/steps, and any relevant logs/screenshots. Ensure `pytest`, `black`, `flake8`, `mypy` all pass.

## Security & Configuration Tips
- Store secrets in `.env`; never commit tokens or profiles (e.g., `ms_token.json`, OAuth files, PII in `data/`).
- Validate local setup with `email-parser-setup`. Review `developer_docs/security_privacy.md` before handling real data.

