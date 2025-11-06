Testing Strategy

Guiding Principles
- Test locally without sending user content off-device. Prefer mocks and synthetic data. Validate that no raw email content is transmitted in any test path.

Layers
- Unit
  - Pure functions: parsers, redactors, matchers, formatters.
  - Components: render, state transitions, accessibility roles/labels.
- Integration
  - Provider adapters with OAuth mocks; incremental import; MIME parsing pipeline.
  - Analyses engine in a worker with seeded runs and JSON-mode outputs.
  - Recommendation clients with mock ASIN/Switched/Amadeus.
- E2E
  - Onboarding, OAuth consent stubs, import progress, analysis run, dashboards render, recommendations grid, sharing exports, revoke flows.
- Accessibility
  - Axe assertions for key screens; keyboard-only flows; reduced motion.
- Performance
  - Lighthouse budgets: TTI, LCP, CLS; cold/warm loads; large inbox scenario.
- Security
  - ZAP baseline; CSP/Trusted Types present; dependency audit clean.
- Privacy
  - Outbound Request Inspector asserts no raw content; redaction defaults; pre-share scan gates.
- Load
  - k6 synthetic workloads for external APIs through mock adapters; backoff behavior verified.

Key Invariants
- Deterministic seeds produce stable results (within tolerance) across re-runs.
- Exports include schema_version, generator metadata, coverage/confidence.
- Share artifacts are encrypted and open offline.

