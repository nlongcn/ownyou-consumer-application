Product Requirements (Local-First Frontend)

Purpose
- Let users securely import Gmail/Outlook emails, run Ikigai and Marketing analyses completely on-device, and view/share engaging, privacy-safe insights with product/service recommendations using ASIN Data API, Switched, and Amadeus.

Goals
- Self-serve import with OAuth (Gmail + Outlook) and transparent progress.
- Insight clarity with explainable metrics, provenance, and deterministic seeds.
- Visual, shoppable recommendations aligned to Ikigai/Marketing profiles.
- Shareability without central storage: encrypted file/URL or Drive/OneDrive.
- Trust-by-design: redaction defaults, data minimization, developer-managed API keys.

Non-Goals
- No server-side content processing/storage; no central user accounts.
- Not a full email client; not a financial advisor.

Key User Stories
- Connect Gmail/Outlook via OAuth; choose a time range; import with progress.
- Run Ikigai and Marketing analyses locally; see model, version, seed, coverage.
- See recommendations with images, reasons, and fit badges; save/hide items.
- Share redacted results via encrypted file/URL or cloud drive; revoke access by deleting the artifact.
- Re-run analyses with different ranges and compare results.

Scope (MVP)
- Providers: Gmail + Outlook day one.
- Import: Last 90 days (customizable), label/folder filters, resumable.
- Analyses: Ikigai + Marketing with seeded runs; JSON-mode outputs; redaction.
- Visualizations: Venn/themes, sunburst/heatmap, timelines, tooltips, filters.
- Recommendations: ASIN/Switched/Amadeus using derived categories/themes.
- Sharing: Encrypted file and encrypted URL; Drive/OneDrive save.
- Settings: API usage monitor, redaction defaults, retention, export/delete all.

Acceptance Criteria (MVP)
- Dual provider import completes for 90 days without server involvement.
- No outbound requests contain raw email content; network inspector verifies.
- Analyses run locally with deterministic seeds; exports include schema_version, generator, coverage, seed, redaction flags.
- Recommendations return ≥20 items with images and rationales.
- Share exports open offline; encrypted URL works ≤100KB payload; Drive/OneDrive save produces viewable link.
- Accessibility meets WCAG 2.2 AA; performance meets stated budgets.

KPIs
- Import completion rate; analysis run rate; time-to-insight; share creation rate; recommendation CTR/save rate; privacy toggle usage; error rate by provider.

