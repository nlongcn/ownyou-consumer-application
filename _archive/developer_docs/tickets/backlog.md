Backlog (High-Level Tickets)

Foundations
- Auth: Implement OAuth PKCE for Gmail (readonly) with local token storage.
- Auth: Implement OAuth PKCE for Outlook/Graph (Mail.Read) with local storage and delta queries.
- Storage: Encrypted IndexedDB keyring; lock screen; passphrase flow.
- Parser: MIME/HTML parser in WebWorker with redaction utilities.

Analyses
- Engine: Port Ikigai analysis to worker with seeded runs and JSON-mode outputs.
- Engine: Port Marketing analysis with category taxonomy and newsletter vs ads.
- Coverage: Compute coverage/confidence metrics; embed generator metadata.

Recommendations
- Client: ASIN search + lookup; product card model and images.
- Client: Switched offers; mapping from receipts to merchant/category.
- Client: Amadeus inspiration; themes/date windows; cards UI.
- Matching: Category/trait to rec mapping; dedupe; rationale generation.

Sharing
- Export: Encrypted self-contained HTML; offline viewer.
- Export: Encrypted URL encoder/decoder; size budget handling.
- Cloud: Drive/OneDrive save and share; revoke management.

UX & A11y
- Screens: Home, Import Wizard, Analysis Overview, Ikigai, Marketing, Recommendations, Share, Settings.
- A11y: Keyboard flows, reduced motion, color contrast; charts accessibility.

Testing & CI
- Unit/Integration/E2E test suites; privacy inspector; Lighthouse; ZAP; k6 mocks.
- CI: Conditional frontend jobs; always run Python tests.

