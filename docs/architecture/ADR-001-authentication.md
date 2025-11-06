# ADR-001: Wallet-Based Authentication with Privy

**Status**: Accepted
**Date**: 2025-01-06
**Deciders**: OwnYou Development Team
**Consulted**: decentralized-consumer-app-authentication skill

## Context

OwnYou Consumer Application requires authentication that:

1. **Supports mainstream users** - Non-crypto-native users (email/social login)
2. **Enables frictionless UX** - Frequent mission interactions without wallet popups
3. **Maintains privacy** - No PII leakage, client-side processing
4. **Remains self-sovereign** - Users control keys, can export wallets
5. **Scales affordably** - 100K+ user target without prohibitive costs
6. **Handles sensitive data** - Email, financial, health data requires highest security

### Current Challenges

- **Friction vs Security**: Mainstream users won't tolerate wallet popups for every action
- **Privacy vs Convenience**: Must avoid server-side data processing while maintaining UX
- **Cost vs Scale**: Many embedded wallet providers become expensive at scale
- **Decentralization vs Practicality**: Pure decentralization may sacrifice user experience

## Decision

We will use **Privy** as our authentication and embedded wallet provider with the following architecture:

### Core Components

1. **Privy SDK** - Embedded wallet creation and management
2. **Session Keys** - Time-bound keys for frictionless transactions (24h TTL)
3. **Social Login** - Email, phone, WhatsApp for onboarding
4. **Wallet-Derived Encryption** - Deterministic keys for client-side data encryption
5. **JWT Tokens** - API authentication separate from blockchain identity

### Authentication Flow

```
User Login (First Time)
├─> Social login (email/phone/WhatsApp) via Privy
├─> Privy creates embedded wallet (MPC-based)
├─> User signs challenge to prove ownership
├─> Backend issues JWT token (30-day expiry)
├─> Create session key (24h TTL) for frictionless interactions
└─> Store session key in secure storage

Subsequent Sessions
├─> JWT token from secure storage
├─> If JWT valid → authenticate
├─> If JWT expired → refresh via wallet signature
├─> If session key expired → re-create (user signs once)
└─> All mission interactions use session key (no popups)
```

### Session Key Architecture

```
Mission Feedback Flow (Frictionless)
├─> User clicks "like" on mission card
├─> App signs with session key (no popup)
├─> Backend validates session key signature
├─> Update mission state in Store
└─> Return updated mission to UI

Token Reward Flow (User Signs)
├─> Mission completed, reward earned
├─> App requests token transfer (important action)
├─> User signs with main wallet (Privy popup)
├─> Transaction recorded on-chain
└─> Notification sent to user
```

## Rationale

### Why Privy?

| Criterion | Privy | Web3Auth | Dynamic | LIT Protocol |
|-----------|-------|----------|---------|--------------|
| **Session Keys** | ✅ Native | ⚠️ Via ZeroDev | ✅ Native | ✅ Programmable |
| **Social Login** | ✅ Email/Phone/WhatsApp | ✅ Social OAuth | ✅ Email/Social | ❌ Wallet-only |
| **DX (Speed)** | ✅ Excellent | ⚠️ Moderate | ✅ Good | ⚠️ Complex |
| **Pricing (100K users)** | ✅ $50K/year | ❌ $60K/year | ✅ Custom | ✅ Free |
| **Mobile SDKs** | ✅ iOS/Android/RN | ✅ iOS/Android | ✅ iOS/Android | ⚠️ Limited |
| **Multi-Device** | ✅ Auto-sync | ✅ Auto-sync | ✅ Auto-sync | ❌ Manual |
| **Key Export** | ✅ Supported | ✅ Supported | ✅ Supported | ✅ User-controlled |
| **Privacy** | ✅ Client-side | ✅ Client-side | ✅ Client-side | ✅ E2E encrypted |

**Decision Factors:**

1. **Native Session Keys** - Critical for UX; Privy and Dynamic offer this natively
2. **Developer Experience** - Privy has best documentation and fastest integration
3. **Cost Efficiency** - $50K/year at 100K users vs Web3Auth's $60K/year
4. **Mainstream UX** - Social login without crypto education
5. **Proven Scale** - Battle-tested by major consumer apps (Friend.tech, Blackbird)

### Why Not Alternatives?

**Web3Auth**
- ❌ $60K/year cost at 100K users (20% more expensive)
- ⚠️ Requires ZeroDev integration for session keys (added complexity)
- ✅ More decentralized MPC (but not critical for MVP)

**Dynamic**
- ✅ Strong alternative (hybrid wallet support)
- ⚠️ Better for apps with existing wallet users (not our target)
- ⚠️ More complex setup than Privy

**LIT Protocol**
- ✅ Fully decentralized (best privacy)
- ❌ Wallet-only login (no social login for mainstream users)
- ❌ Complex setup (longer MVP timeline)
- ✅ Future consideration for v2 (programmable encryption)

## Consequences

### Positive

1. **Frictionless UX** - Users never see wallet popups for routine actions
2. **Fast MVP** - Privy's excellent DX means faster implementation (1-2 weeks)
3. **Mainstream Adoption** - Social login removes crypto barrier
4. **Privacy-First** - Wallet signatures enable client-side encryption
5. **Self-Sovereign** - Users can export keys, migrate to self-custody
6. **Affordable Scale** - Linear pricing model won't bankrupt us at scale

### Negative

1. **Vendor Dependency** - Relies on Privy infrastructure (mitigated by key export)
2. **Not Fully Decentralized** - Privy manages MPC nodes (acceptable for MVP)
3. **Cost at Scale** - $50K/year at 100K users (but better than alternatives)
4. **Session Key Risks** - If session key leaked, attacker can sign for 24h (mitigated by TTL)

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Privy Downtime** | High | Key export feature allows migration; backend caching reduces dependency |
| **Session Key Leak** | Medium | 24h TTL limits exposure; rate limiting on backend; monitor for suspicious activity |
| **Privacy Breach** | Critical | Never send raw data to Privy; all sensitive data encrypted client-side |
| **Cost Overrun** | Medium | Monitor usage; plan migration to LIT Protocol if scale exceeds budget |
| **Key Loss** | High | Social recovery via Privy; educate users on backup |

## Implementation

### Phase 1: Core Authentication (Week 1)

1. Privy SDK integration (web + mobile)
2. Social login flow (email, phone)
3. JWT token generation/validation
4. Basic wallet operations (sign, send)

### Phase 2: Session Keys (Week 2)

1. Session key creation on login
2. Backend session key validation
3. Frictionless mission feedback flow
4. Session key expiry and renewal

### Phase 3: Privacy Features (Week 3)

1. Wallet-derived encryption keys
2. Client-side data encryption (WebWorkers)
3. Encrypted Store writes
4. Zero PII to external APIs

### Phase 4: Production Hardening (Week 4)

1. Multi-device support (iCloud/Google backup)
2. Key export UI
3. Account recovery flows
4. Monitoring and alerting

## Alternatives Considered

### Alternative 1: Plain JWT + Traditional Auth

**Pros**: Simple, no blockchain complexity
**Cons**: Not self-sovereign, no token rewards, no decentralization

**Rejected** because self-sovereign identity is core to OwnYou's mission.

### Alternative 2: LIT Protocol (Fully Decentralized)

**Pros**: Most decentralized, programmable encryption, no vendor lock-in
**Cons**: Wallet-only (no social login), complex setup, longer MVP timeline

**Deferred** to v2. Excellent choice for future but too complex for MVP given mainstream user target.

### Alternative 3: Web3Auth

**Pros**: More decentralized MPC, proven at scale
**Cons**: 20% more expensive, requires ZeroDev for session keys

**Rejected** due to higher cost and added complexity.

## Future Considerations

### v2 Enhancements (6-12 months)

1. **LIT Protocol Integration** - Offer "advanced privacy mode" with fully decentralized MPC
2. **Account Abstraction** - EIP-7702 support for enhanced EOA experience
3. **Multi-Chain** - Expand beyond Ethereum to L2s (Arbitrum, Optimism)
4. **Hardware Wallet Support** - Allow power users to connect Ledger/Trezor

### Exit Strategy

If Privy becomes cost-prohibitive or shuts down:

1. **User Key Export** - All users can export private keys
2. **Migration Tool** - Build one-click migration to LIT Protocol
3. **Backend Swap** - Replace Privy SDK with LIT SDK (API-compatible design)
4. **Zero Downtime** - Gradual migration, not forced cutover

## References

- [Privy Documentation](https://docs.privy.io)
- [Session Keys Best Practices](../../.claude/skills/decentralized-consumer-app-authentication/references/session_keys_guide.md)
- [Privacy Patterns](../../.claude/skills/decentralized-consumer-app-authentication/references/privacy_patterns.md)
- [OwnYou Requirements](../requirements/*OwnYou%20Consumer%20App%20Requirements%20(brainstorm%20copy).md)

## Decision Log

- **2025-01-06**: ADR created, Privy selected
- **Next Review**: After 10K users or 6 months, whichever comes first
