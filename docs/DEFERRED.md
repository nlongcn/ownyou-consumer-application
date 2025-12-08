# Deferred Items

Technical debt and deferred work items tracked for future sprints.

---

## Sprint 5 Deferrals

### DEF-001: Amazon PA-API Circuit Breaker Configuration

**Priority:** P2
**Target Sprint:** L2 Shopping Agent implementation
**Source:** Sprint 5 Code Review (BUG-008)

**Description:**
The Amazon Product Advertising API (PA-API) is specified in v13 Section 3.6.1 as an external API for the Shopping Agent, but circuit breaker configuration is not yet added to `@ownyou/resilience`.

**v13 Reference:**
```
external_apis: [
  { name: "Amazon PA-API", rate_limit: "1/second", requires_user_consent: false },
]
```

**Current State:**
- Shopping Agent is L1 only (basic functionality)
- No actual Amazon PA-API calls are made yet
- Integration test uses `amazon` as example but relies on passthrough behavior

**When to Address:**
Add to `API_CONFIGS` in `packages/resilience/src/circuit-breaker/config.ts` when implementing:
- L2 Shopping Agent with `search_products` tool
- `compare_prices`, `track_price`, `find_deals` tools

**Suggested Configuration:**
```typescript
amazon: {
  name: 'amazon',
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenRequests: 2,
  critical: false,
  retries: 2,
  timeoutMs: 5000,  // v13: 1/second rate limit
}
```

---

### DEF-002: Email Partial Data minCoverage Deviation from v13

**Priority:** P3
**Target Sprint:** Post-MVP (production tuning)
**Source:** Sprint 5 Code Review (BUG-013)

**Description:**
The email partial data policy uses `minCoverage: 0.5` (50%) but v13 specifies `min_success_rate: 0.8` (80%) for email sync operations.

**v13 Reference (Section 6.11.4):**
```yaml
data_sources:
  email_sync:
    min_success_rate: 0.8
    partial_success: true
    stale_threshold_hours: 24
```

**Current Implementation:**
```typescript
// packages/resilience/src/partial-data/policies.ts
email: {
  minCoverage: 0.5,  // v13: 0.8 for email_sync, using 0.5 for MVP
  showWarning: true,
  proceedWithPartial: true,
  confidencePenalty: 0.2,
  staleThresholdHours: 24,
}
```

**Rationale for Deviation:**
- MVP phase may have incomplete email access
- Lower threshold allows testing with partial data
- Higher threshold (80%) may be too strict during early user onboarding

**When to Address:**
Increase to v13-compliant `0.8` when:
- Email sync is fully implemented and stable
- User onboarding flow ensures complete email access
- Production metrics show email sync reliability > 90%

**Migration Path:**
1. Monitor email sync success rates in production
2. When success rate consistently > 90%, update to `minCoverage: 0.8`
3. Adjust `confidencePenalty` if needed based on classification accuracy

---

## Sprint 8 Deferrals

### DEF-003: Real API Client Implementations (Plaid, Calendar)

**Priority:** P0
**Target Sprint:** Sprint 9+
**Source:** Sprint 8 Code Review

**Description:**
Sprint 8 implements mock-only clients for financial (Plaid) and calendar (Google/Microsoft) data sources. Real API client implementations are deferred to Sprint 9+ when actual API integration is needed.

**Current State:**
- `@ownyou/data-financial`: Mock Plaid client in `packages/data-financial/src/plaid/mock.ts`
- `@ownyou/data-calendar`: Mock calendar clients in `packages/data-calendar/src/providers/mock.ts`
- Full pipeline architecture ready for real clients
- PII sanitization pattern available in `packages/ikigai/src/engine/data-sanitizer.ts`

**When to Address:**
Implement real API clients when:
- Plaid developer account and credentials are available
- Google Calendar OAuth app registration is complete
- Microsoft Graph API app registration is complete
- Production environment requires real data sources

**Implementation Notes:**
1. Create `packages/data-financial/src/plaid/client.ts` implementing `PlaidClient` interface
2. Create `packages/data-calendar/src/providers/google.ts` implementing `CalendarProvider` interface
3. Create `packages/data-calendar/src/providers/microsoft.ts` implementing `CalendarProvider` interface
4. Integrate PII sanitization before storing raw API responses
5. Add appropriate circuit breaker configs to `@ownyou/resilience`

---

## Document History

| Date | Sprint | Items Added |
|------|--------|-------------|
| 2025-12-05 | Sprint 5 | DEF-001: Amazon PA-API config |
| 2025-12-05 | Sprint 5 | DEF-002: Email minCoverage deviation |
| 2025-12-08 | Sprint 8 | DEF-003: Real API client implementations (Plaid, Calendar) |
