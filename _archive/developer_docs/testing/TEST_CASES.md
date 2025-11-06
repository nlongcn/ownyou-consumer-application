Canonical Test Cases

Onboarding & Accounts
- Connect Gmail with PKCE; scopes shown; token stored locally; revoke works.
- Connect Outlook with PKCE; delta queries supported; resume after pause.

Import
- Range presets 30/90/365; label/folder filters; dedupe by message-id; error handling and resume.
- Large inbox chunking; progress accuracy; no raw content leaves device.

Analyses
- Ikigai: seeded run; JSON schema valid; coverage/confidence populated; redaction applied.
- Marketing: newsletter vs ads classification; category sunburst data; deterministic sampling with seed.

Recommendations
- ASIN: product cards with images; rationale includes mapped category/traits; broken images fallback.
- Switched: offers show savings; inputs never contain PII; safety checks.
- Amadeus: inspiration cards with images; budgets respected.

Sharing
- Encrypted file export opens offline; includes redacted view only.
- Encrypted URL payload within size limit; decode succeeds; no server involved.
- Drive/OneDrive save; shared link renders public-safe view.

Accessibility & Performance
- Keyboard navigation across all primary screens; axe violations = 0 (critical/serious).
- Lighthouse budgets pass on mid-tier mobile; charts update within 200ms.

Security & Privacy
- CSP/Trusted Types enforced; ZAP baseline with no high-severity issues.
- Request Inspector shows no raw content in network calls.

