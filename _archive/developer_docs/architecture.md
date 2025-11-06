Architecture (Local-First, Self-Sovereign)

App Type
- React/Next.js PWA (static hosting). Service Worker for offline. WebWorkers for parsing and analyses. Optional WebGPU/WebAssembly for tokenization and lightweight LLMs.

Security & Storage
- Local encryption: IndexedDB at-rest via WebCrypto AES-GCM; keys derived from a user passphrase (PBKDF2/Argon2). Session unlock; auto-lock on idle.
- API keys: LLM and 3rd-party API keys managed by developer; embedded in application for proof-of-concept.

Providers (OAuth PKCE SPA)
- Gmail API with `gmail.readonly`; Microsoft Graph with `Mail.Read`. Tokens stored locally. Refresh handled client-side. Scope explainers prior to consent.

Analyses
- Primary mode: Rule-based + in-browser models (Transformers.js/WebLLM) for JSON outputs. Deterministic seed per run. Redaction before any outbound calls.
- Remote LLM mode: Developer-managed API keys for external LLM services; never send raw emails, only redacted snippets.

External APIs (Direct from Browser)
- ASIN Data API: category/keyword search; product lookup; return images, titles, price.
- Switched (Bills): provide merchant/category + inferred current price/plan; receive alternative plans/savings.
- Amadeus: travel inspiration/search based on inferred destinations/themes/windows.
All calls use derived, non-PII inputs; rate-limit and cache in-memory.

Data Flow
1) OAuth connect → import cursors persisted locally.
2) Incremental fetch by range → MIME/HTML parse in worker → structured entities.
3) Analyses in worker (seeded) → insights JSON + coverage/confidence.
4) Recommendations via APIs using derived categories/themes.
5) Share packaging to encrypted file/URL or user cloud drive.

Modules
- Providers: Gmail, Outlook connectors and parsers.
- Parser: MIME, HTML cleaning, entity extraction, redaction.
- Analyses: Ikigai, Marketing engines with seed and JSON outputs.
- Recs: ASIN/Switched/Amadeus clients and matchers.
- Storage: Encrypted stores; key management; retention.
- Share: Packaging, encryption, previews, Drive/OneDrive connectors.
- UI: IA, dashboards, charts, accessibility utilities.

Performance
- Chunked import and parsing; worker batching; lazy-load model assets; image lazy loading; memory caps with backpressure.

Observability (Local)
- Local event log for troubleshooting; optional anonymous telemetry disabled by default.

