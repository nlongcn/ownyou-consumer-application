**### User Stories**

**- As a user, I opt in to share my browsing history to improve my user profile and purchase intent assessments**

**- As a user, I can see what was captured, delete it, or re-run analysis locally.**

**- As a user, I can export/import my browsing signals without sending data to any server.**

**Journey Overview**

**- Install: User installs “Profile Booster” Chrome extension.**

**- Pre-permission screen: Explain benefit, scope (shopping domains only), and local-only processing.**

**- Permission grant: Extension requests “Read your browsing history” and optional “Host permissions” to POST to localhost.**

**- Initial backfill (optional): Offer 30/60/90-day backfill; explain impact and time.**

**- Ongoing collection: Background worker watches visits, estimates dwell, tags product/cart/checkout patterns.**

**- Local ingestion: Extension batches events and POSTs to **http://127.0.0.1:5001/ingest/browsing**. If host not running, queues locally.**

**- Insights: App shows increased purchase intent confidence and recent signals per merchant/category.**

**- Control: Pause/resume; purge data; adjust weights; export NDJSON.**

**Permissions & UX**

**- Manifest V3 with “history”, “storage”, “alarms”, “tabs”. Host permissions: **"http://127.0.0.1:5001/*"**.**

**- UX copy: “The extension reads history only for domains you select. Data stays on your device.”**

**- Incognito: Off by default. If enabled, respect Chrome’s separate incognito storage.**

**Data Collected (Chrome)**

**- Event fields: **url**, **title**, **visit_time**, **transition**, **dwell_ms**, **tab_id**, **referrer**, **domain**.**

**- Derived: **merchant**, **category**, **is_product**, **is_cart**, **is_checkout**, **is_order_confirmation**, **session_id**.**

**- Redaction: Strip query params unless needed for product ID on allowlisted sites; hash full URL; store domain + path patterns.**

**Processing & Scoring**

**- Sessionization: 30-min inactivity window; per-domain sequences.**

**- Features: recency (last prod/checkout), frequency (visits/week), depth (pages/session), cart/checkout flags, dwell quantiles.**

**- Fusion: Feed features into PIPR/PIPF/PIPV/PIFI calculations with tunable weights (env-driven), e.g., **BROWSING_WEIGHT_PIPR=0.4**.**

**- Guardrails: Cap influence if email receipts contradict browsing (e.g., abandoned carts).**

**Extension Implementation**

**- Background (service worker): **chrome.history.onVisited**, **history.search** for backfill, **tabs.onUpdated** for dwell estimation, **alarms** for batch flush.**

**- Options page: allowlist management, retention (30/60/90d), backfill, export, purge, pause/resume.**

**- Transport: POST NDJSON batches to localhost; fallback to “Download JSONL” for manual import.**

**Manifest example:**

**- "permissions": ["history", "storage", "tabs", "alarms"]**

**- "host_permissions": ["http://127.0.0.1:5001/*"]**

**Host App Requirements**

**- Endpoint: **POST /ingest/browsing** (NDJSON; validate schema).**

**- CLI: **email-parser ingest-browsing <file.jsonl>**.**

**- Storage: Local SQLite/JSONL with retention policy; encrypted if configured.**

**- UI: Surfaced signals per merchant with ability to purge and reweight.**

**Edge Cases**

**- Permission revoked → stop collection, show toast in options, retry prompt.**

**- No localhost ingest → queue and retry; offer manual export.**

**- Large backfills → chunked search by week; progress UI.**

**- Enterprise policies → detect and degrade gracefully.**

**MVP Acceptance Criteria**

**- User installs extension, opts in, selects allowlist, completes optional 30-day backfill.**

**- Events collected and ingested locally (auto or manual).**

**- Purchase intent improves on test profiles (higher PIFI on confirmed carts; more accurate PIPR decay).**

**- Pause/resume, purge, and export all work; no data leaves device.**

**Incremental Roadmap**

**- v0: Manual export/import (no localhost POST).**

**- v1: Localhost ingestion + options UI + 30/60/90-day backfill.**

**- v1.1: Merchant heuristics and product/cart/checkout classifier improvements.**

**- v1.2: Weight tuning with offline evaluation suite and A/B reports.**
