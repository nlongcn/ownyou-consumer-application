Security, Privacy, and Threat Model

Principles
- Privacy-first: No server-side storage or processing of user content.
- Least privilege: Minimal scopes; only necessary message ranges; local encryption.
- Transparency: Clear documentation of data flows; developer-managed API keys for proof-of-concept.

Threat Model (selected)
- XSS/XSLeaks: Strict CSP, Trusted Types, sanitize all rendered HTML, sandboxed iframes for untrusted HTML.
- Token theft: Encrypted IndexedDB; session lock; biometric unlock (optional); revoke tokens UI.
- API key exposure: Developer-managed keys embedded in client for proof-of-concept; production would require secure key management.
- Supply chain: Subresource Integrity for model assets; dependency scanning.
- Content exfiltration: Block external network when analyzing emails unless explicitly enabled; safe-list external domains.
- Broken access: Share artifacts are encrypted; no public indexing; pre-share scans.

Controls
- Encryption: AES-GCM with keys from passphrase (PBKDF2/Argon2). Key hierarchy KEK→DEKs.
- Redaction: Default ON for names/emails/domains/order IDs in views and shares.
- Telemetry: Disabled by default; if enabled, anonymous performance only; no content/metadata.
- Data retention: User-configurable; “wipe all data” option.

Compliance Readiness
- GDPR/CCPA user rights: Export data, delete data, consent logs (local), no server processing.

