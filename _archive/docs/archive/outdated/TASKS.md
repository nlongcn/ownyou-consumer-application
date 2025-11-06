# Report Quality Improvement Tasks

This task list tracks incremental improvements to Ikigai and Marketing reports. After each step, run smoke tests to ensure no regressions.

1) Make taxonomy path configurable
- Replace absolute path in `marketing_analyzer._load_product_taxonomy` with a relative path and env/CLI override.
- Add graceful handling when file missing.

2) Add deterministic sampling (random_state)
- Add `random_state` (seed) to all DataFrame `sample(...)` calls in analyzers.
- Accept seed from config/env `LLM_SEED` with default 42.

3) Wire marketing JSON export + metadata
- After `analyze_emails`, call `export_insights_to_json(...)` from main pipeline.
- Include `schema_version`, `generator`, and timestamps in export.

4) Add report schema_version and coverage
- Add `schema_version` to Ikigai and Marketing JSON.
- Add `data_coverage` section: `total_emails`, `analyzed_emails`, `sample_size`, `time_range`.

5) Thread seed into analyzers + logs
- Thread seed into analyzers via `llm_config` and include in output metadata.
- Log provider, model, temperature, and seed in reports.

6) Split Newsletter vs Spam category schema
- Update extraction schema in `llm_clients/base.py` to separate `Newsletter` and `Spam`.
- Update authentic Ikigai filters to treat `Newsletter` as potentially personal.

7) Pre-LLM rule-based marketing filter
- Add lightweight heuristics (unsubscribe, CTA verbs, promo keywords, known list domains) before LLM classification.
- Only send ambiguous emails to LLM.

8) Add smoke tests to validate offline
- Create a small pytest module that exercises analyzers with synthetic data and a dummy LLM path (no network). 
- Ensure imports and key functions run without real API keys.

Usage: After each completed step, run: `pytest -q` and a CLI dry-run if applicable.

