Testing Framework Overview

Purpose
- Provide end-to-end validation for a local-first frontend without server dependencies. Cover unit, integration, E2E, accessibility, performance, security, privacy, and contract tests.

Tooling (recommended)
- Unit: Vitest or Jest + Testing Library.
- E2E: Playwright (headless/browser UI, service worker friendly).
- Accessibility: axe-core/Playwright and manual screen reader checks.
- Performance: Lighthouse CI.
- Security: ZAP baseline scan; dependency audit.
- Privacy: Custom outbound-request inspector tests (no raw content).
- Load: k6 for API rate-limit shaping (ASIN/Switched/Amadeus) via mock adapters.

Structure
- TESTING_STRATEGY.md — What to test and how, per layer.
- TEST_CASES.md — Canonical cases with expected results.
- tools/ — Config stubs for Playwright, Lighthouse, ZAP, k6, and axe rules.

Running (once app exists)
- Unit: `pnpm test` or `npm run test`.
- E2E: `npx playwright test` against local app (`BASE_URL`).
- a11y: `npx playwright test -g "a11y"`.
- Perf: `npx lhci autorun`.
- Security: `zap-baseline.py -t $BASE_URL -c tools/zap-baseline.yaml`.
- Load: `k6 run tools/k6-load.js` with mocks.

CI
- See .github/workflows/ci.yml for a conditional pipeline that runs when frontend package files exist; Python pytest still runs.

