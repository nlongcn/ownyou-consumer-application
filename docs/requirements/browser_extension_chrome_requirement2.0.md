**Title: External LLM Processing Path (Augmenting Browsing Classification)**

**1. **Goals & Principles

**- Goal: Enable hosted LLMs (OpenAI/Anthropic/Gemini) for browsing-session classification, consistent with how emails are already processed.**

**- Principles:**

**    **- Same Analyzer client and model-selection logic as email pipeline (no divergent code paths).

**    **- Minimize data by sending only compact, redacted “session cards” (no raw emails, no unredacted URLs).

**    **- Clear controls, visibility, and audit: explicit opt-in, per-provider toggles, outbound logs, and cost tracking.

**2. **Execution Modes

**- Local Mode (default): Inference runs locally (e.g., Ollama). Zero egress. Retain for fully offline/regulatory environments.**

**- Cloud Mode (opt-in): Hosted LLMs are allowed for browsing classification. Enabled with provider-specific keys and explicit “Cloud Mode = ON”.**

**3. **Data Minimization (Cloud Mode)

**- Payload shape (per request):**

**    **- Session cards only — each card includes:

**    **- Time window: start, end (ISO timestamps or epoch ms)

**    **- Domains: list of eTLD+1 (e.g., “amazon.com”)

**    **- Redacted URLs: only protocol + hostname + path; query/fragment removed

**    **- Titles: page titles (if available)

**    **- Dwell hints: optional aggregated estimates (small integers; not raw timings)

**- Count limits (to keep prompts small):**

**    **- Max 20 recent session cards

**    **- Max 5 redacted URLs per card

**    **- Max 5 titles per card

**- Exclusions by policy:**

**    **- Never send raw email content or bodies

**    **- Never send query parameters or fragments

**    **- Never send referrers or tab IDs

**    **- Optional: hash full URLs locally if you still want de-dup across sessions without revealing full paths

**4. **Cloud Provider Selection & Control

**- Providers supported: OpenAI, Anthropic, Google**

**- Config (env):**

**    **- LLM_PROVIDER=openai|claude|google

**    **- OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY (mutually exclusive in practice)

**    **- BROWSING_CLOUD_MODE=true (explicit opt-in)

**- UI:**

**    **- Main run’s model dropdown applies to browsing classification as well (no divergent model selection)

**    **- Visual indicator that Cloud Mode is ON (banner/toast)

**    **- “Show what’s sent” panel (renders an example session card payload)

**- Dev safeguards:**

**    **- If BROWSING_CLOUD_MODE=false but a cloud key is present → warn and disable cloud path

**    **- If cloud path is on, log each request: timestamp, provider, model name, session card count (no content)

**5. **Prompt Schema (Cloud Mode)

**- Interests classification prompt:**

**    **- Instructions: map session cards to IAB “interests” leaves; return up to N (e.g., 3) categories with confidences

**    **- Response schema (JSON):

**    **- classifications: [

**      **{ taxonomy_id: int, value: string, confidence: number|“high|medium|low”, session_ids: [string] }

**    **]

**- Purchase intent prompt:**

**    **- Instructions: map to IAB “purchase intent” product categories; return purchase_intent_flag for each (PIPR_HIGH/MEDIUM/LOW or ACTUAL_PURCHASE)

**    **- Response schema:

**    **- classifications: [

**      **{ taxonomy_id: int, value: string, confidence: number|“high|medium|low”, purchase_intent_flag: string, session_ids: [string] }

**    **]

**- Size controls:**

**    **- Token budget aligned with Analyzer’s max-token computation

**    **- Truncation policy: drop least-recent sessions first if token limit approaches

**6. **Validation, Reconciliation, & Fusion

**- Validation (unchanged):**

**    **- Validate taxonomy_id/value pair against the taxonomy (accept asterisk placeholders)

**    **- Parse string confidences → numeric (high=0.9, medium=0.6, low=0.3)

**- Reconciliation (existing semantic memory):**

**    **- Evidence strength scales with confidence and recency

**    **- Decay/hysteresis continue to stabilize convictions

**- Fusion with email signals (unchanged):**

**    **- Interests: browsing-derived evidence augments repeated-interest convictions

**    **- Purchase intent: browsing nudges PIPR/PIPF/PIFI inputs; email receipts remain authoritative

**7. **Privacy & Compliance Controls (Cloud Mode)

**- Redaction enforced by construction (no queries/fragments)**

**- Optional hashing for full URLs prior to LLM call, if you want to de-identify paths further**

**- Per-provider allowlist: restrict cloud calls to configured provider; disallow test/exotic endpoints**

**- Audit & traceability:**

**    **- Log (locally) each outbound LLM request metadata: provider, model, session_card_count, token estimates, and a redacted preview (e.g., domains + truncated paths)

**    **- Cost tracker integrated with Analyzer usage (existing email flow)

**- Network egress visibility:**

**    **- UI “Outbound Calls” panel: last N calls with provider, model, and counts

**8. **Error Handling & Diagnostics

**- If Cloud Mode is enabled but keys or SDKs are missing:**

**    **- Return diagnostics: llm_available=false with a specific reason (“SDK not installed” vs. “API key missing”)

**- If LLM returns malformed schema:**

**    **- Reject invalid items; return diagnostics: reason “schema_error”

**- If requests exceed token budgets:**

**    **- Truncate session cards or titles; log truncation; retry once

**- If provider throttling:**

**    **- Exponential backoff with jitter; user-facing “try again later” if persistent

**9. **Operational Considerations

**- Rate limits:**

**    **- Batching: process up to N session cards per call (cap total size)

**    **- Pause/resume in Options prevents runaway ingestion

**- Reliability:**

**    **- Queue/retry extension flush; if backend is down, local queue persists

**- Performance:**

**    **- Keep session cards compact to reduce costs and latency

**    **- Model choice: use fast/cheap models (e.g., GPT‑4o‑mini, Claude Haiku, Gemini Flash) for browsing classification

**10. **Configuration Matrix (Examples)

**- Strict Local**

**    **- BROWSING_CLOUD_MODE=false

**    **- LLM_PROVIDER=ollama; OLLAMA_BASE_URL=http://127.0.0.1:11434

**    **- No cloud keys present

**- Mixed (Emails cloud, Browsing cloud)**

**    **- BROWSING_CLOUD_MODE=true

**    **- LLM_PROVIDER=openai (or claude/google)

**    **- Keys present; Analyzer reuses same provider for browsing classification

**- Mixed (Emails cloud, Browsing local)**

**    **- BROWSING_CLOUD_MODE=false

**    **- LLM_PROVIDER=ollama for browsing; email pipeline remains as configured

**11. **Acceptance Criteria (Cloud Path)

**- With BROWSING_CLOUD_MODE=true and valid keys:**

**    **- Step 4 / Auto-run includes browsing classification via cloud LLM (counts > 0 for synthetic test sessions)

**    **- Outbound logs show provider, model, and session card counts; cost tracker updated

**    **- All payloads remain redacted per policy (no query strings; no raw emails)

**- With BROWSING_CLOUD_MODE=false:**

**    **- No outbound calls to cloud; classification uses Local Mode or returns diagnostics if local runtime is unavailable

**    **- UI clearly indicates Cloud Mode OFF

**12. **Security Checklist

**- TLS enforced by providers; no plaintext tokens in logs**

**- Keys loaded from .env or OS keychain; never hardcoded**

**- Optional outbound firewall: if LOCAL_ONLY=true, block egress to provider hosts at the network layer even if keys are present**

**- Audit: maintain local JSONL of outbound call metadata (no payload content beyond redacted preview)**

**This add-on preserves the original promise (local-only by default) but acknowledges that you already run email classification with hosted LLMs. With Cloud Mode ON,**

**browsing classification follows the same provider/model selection and token management, while still enforcing redaction and transparency.**


**Development Paths, Trade‑offs, and Recommendations**

**Development Paths**

**- Local‑Only Inference**

**    **- Summary: Run browsing classification on a local runtime (e.g., Ollama).

**    **- Pros: Strongest privacy posture; no egress; predictable cost.

**    **- Cons: Lower accuracy vs. frontier models; higher CPU/GPU requirements; slower dev velocity.

**- Cloud‑First Inference (Opt‑In)**

**    **- Summary: Use hosted LLMs (OpenAI/Anthropic/Google) with redacted session cards.

**    **- Pros: Best accuracy and latency; minimal local footprint; model breadth.

**    **- Cons: Ongoing cost; dependency on providers; requires strict redaction and audit controls.

**- Hybrid (Recommended)**

**    **- Summary: Default to cloud (mirrors email pipeline) with strict redaction; automatic fallback to local when keys/SDKs absent; optional heuristic pre‑filter.

**    **- Pros: Balances accuracy/latency with resilience; uniform Analyzer logic; graceful degradation.

**    **- Cons: More moving parts; needs clear UX and ops controls.

**- Heuristic‑First Fallback**

**    **- Summary: Domain/path rules to flag product/cart/checkout without LLM.

**    **- Pros: Zero cost; works offline; robust baseline.

**    **- Cons: Lower recall/precision; brittle across sites; limited coverage.

**Key Design Trade‑offs**

**- Accuracy vs. Privacy: Cloud frontier models outperform local small models; redaction + audit makes cloud acceptable for browsing session cards (no queries/fragments).**

**- Latency vs. Cost: Cloud “flash/mini/haiku” tiers keep latency/cost low; local models add predictable latency but zero egress.**

**- Simplicity vs. Flexibility: Single Analyzer flow reused for email + browsing reduces divergence; adds config surface (provider, model, mode).**

**- Observability vs. Minimalism: Outbound logs (provider, model, counts) improve trust; must not log payloads or sensitive details.**

**Recommendations**

**- Mode & Provider**

**    **- Adopt Hybrid: Enable cloud for browsing classification (consistent with email), with Local fallback when keys/SDKs are absent.

**    **- Start with fast/cheap models for browsing: Google “gemini‑2.0/2.5‑flash”, OpenAI “gpt‑4o‑mini”, Anthropic “Claude Haiku”. Keep UI consistent with email model

**selection.**

**- Data Minimization**

**    **- Enforce session cards with redacted paths (no queries/fragments), masked IDs, coarse dwell buckets. Add optional URL hashing if desired.

**- UX & Controls**

**    **- Explicit Cloud Mode toggle; “What’s sent?” preview; diagnostics on “0 updated” (no events vs. LLM unavailable vs. no classifications).

**    **- Browser Extension status card (Installed/Not detected; Recheck).

**- Ops & Safety**

**    **- Cost caps: per‑run/per‑day token budgets; rate limits (backoff on 429).

**    **- Outbound audit: provider, model, card counts, token estimates (no payload content).

**    **- Feature flags: BROWSING_CLOUD_MODE; LOCAL_ONLY hard‑block; provider allowlist.

**- Rollout**

**    **- Phase 1: Cloud‑first classification with strict redaction + Step 4 (manual) + diagnostics.

**    **- Phase 2: Auto‑run after email classification + Local fallback + heuristic pre‑filter.

**    **- Phase 3: Weight tuning + offline evaluation suite; per‑device mapping; retention/purge UI.

**Risks & Mitigations**

**- “No updates” confusion → Always return reason + link to logs.**

**- Provider changes/API drift → Centralize provider calls in Analyzer; cache model metadata; add smoke tests.**

**- Cost blowups → Cap token usage; default to “flash/mini” variants; truncate session cards deterministically.**
