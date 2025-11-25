# OwnYou Architecture Rethink - Desktop + Decentralized Sync

**Date:** 2025-01-17
**Status:** 🔬 Research Phase
**Decision Driver:** Daily re-authentication is a UX death nail for browser-only PWA

---

## 🎯 Executive Summary

After validating that Microsoft enforces 24-hour token lifetimes for browser-based PWAs (SPA platform), we are pivoting to a **desktop + decentralized sync** architecture that:

1. ✅ **Solves token lifetime problem** - Desktop app uses MSAL public client for 90-day tokens
2. ✅ **Maintains self-sovereign principles** - No centralized backend, user-controlled storage, including a decentralized storage option
3. ✅ **Enables mobile strategy** - PWA consumes mission cards synced via Ceramic/Filecoin, with a roadmap to native applications
4. ✅ **Supports full OwnYou vision** - AI agents creating missions based on a rich user profile developed through interactions, emails, browser history, financial data, photos and multiple other data sources

---

## 📐 Core Requirements & Constraints

### Self-Sovereign Architecture (Non-Negotiable)

**MUST:**

- ✅ User owns and processes their own data (no OwnYou backend storing or processing unencrypted user data)
- ✅ protocol bases without centralized infrastructure
- ✅ User-controlled encryption keys (wallet-derived)
- ✅ censorship-resistant storage
- ✅ open-sources consumer application, OwnYou controlled protocol development for SSO, ad-tech SDKs and blockchain functionality
- ✅ easy to use for non-technical users. Any and all web3 functionality needs to be abstracted away (including wallets, signing etc)

**MUST NOT:**

- ❌ Store user personal data on OwnYou servers
- ❌ Rely on Microsoft OneDrive or other centralized cloud
- ❌ Require home WiFi or specific network location
- ❌ Use email/password authentication (wallet-based only)
- ❌ Send unencrypted personal data to external APIs

### OAuth Token Requirements

**Problem:** Microsoft SPA platform enforces 24-hour refresh tokens, requiring daily re-authentication

**Solution:** Desktop app uses MSAL public client flow for 90-day refresh tokens

**Constraints:**

- Cannot achieve 90-day tokens in browser-only PWA
- Desktop installation required for better UX
- Must remain self-sovereign (no token proxy servers)

### Data Sources (8 Total)

1. **Email** - Microsoft/Gmail via OAuth (90-day tokens)
2. **Browser History** - Chrome Extension with redaction
3. **Bank Transactions** - Plaid/TrueLayer OAuth (future)
4. **Photos** - File system access
5. **Calendar** - OAuth
6. **Location History** - OAuth (Google Timeline, Apple Maps)
7. **Health Data** - Apple Health exports, wearable APIs
8. **Social Media** - Twitter/LinkedIn OAuth (future)

### Mission Agent Requirements

- **LangGraph or Letta based** - ReAct agents with persistent threads
- **Local execution** - Processing happens on user's device or using third-party inference (for the MVP)
- **Store integration** - Single source of truth (SQLite)
- **Mission types** - Savings, Ikigai, Health
- **Trigger system** - Memory changes, schedules, user input, external events, user location changes

### Cross-Device Sync Requirements

- **Real-time mission cards** - Mobile sees new missions within 1-2 seconds
- **Heavy data on-demand** - Email archives, photos fetched when needed
- **Offline support** - Cached missions work without network
- **Conflict resolution** - Handle simultaneous updates
- **No network location dependency** - Works anywhere, not just home WiFi

---

## 🏗️ Proposed Architecture

### Three-Tier System

```
1. Desktop App (Tauri)
   ├── MSAL OAuth (90-day tokens)
   ├── LangGraph Agents (mission generation)
   ├── Data source connectors (email, banking, photos)
   ├── Ceramic client (sync mission cards)
   ├── Filecoin client (archive heavy data)
   └── Wallet integration (MetaMask/WalletConnect)

2. Browser PWA (Next.js)
   ├── Mission card UI (consume missions)
   ├── Ceramic client (read real-time updates)
   ├── IPFS gateway (fetch heavy data on-demand)
   ├── WalletConnect (same identity as desktop)
   └── IndexedDB (offline cache)

3. Chrome Extension
   ├── Browser history capture
   ├── Session cards (redacted URLs)
   ├── Purchase intent detection
   └── Native messaging to desktop app
```

### Data Storage Tiers

**Tier 1: Real-Time (Ceramic Network)**

- Mission cards (active/completed)
- User profile (IAB classifications)
- BBS+ Pseudonyms
- Small data (<1MB per user)
- ~1-2 second sync latency

**Tier 2: Heavy Archives (Filecoin + IPFS)**

- Raw email archives (MBOXs)
- Browser history archives
- Photo libraries
- Bank transaction archives
- On-demand retrieval via IPFS gateway

---

## 🔬 Research Areas

Each area has a dedicated research document with detailed exploration plans:

### 1. [Ceramic Network Integration](./ceramic-network-research.md)

**Priority:** HIGH
**Timeline:** 1-2 days
**Questions:**

- Can we achieve <2 second mission card sync?
- What are real-world costs for 10,000 users?
- How does ComposeDB schema design work?
- What are conflict resolution strategies?

### 2. [Filecoin Storage Strategy](./filecoin-storage-research.md)

**Priority:** MEDIUM
**Timeline:** 1-2 days
**Questions:**

- Web3.Storage vs Lighthouse.storage vs NFT.Storage?
- What are storage deal parameters?
- IPFS gateway performance benchmarks?
- Cost optimization strategies?

### 3. [Wallet Integration Patterns](./wallet-integration-research.md)

**Priority:** HIGH
**Timeline:** 2-3 days
**Questions:**

- MetaMask vs WalletConnect vs Privy?
- Key derivation standards (EIP-2333)?
- Session management (avoid constant prompts)?
- Mobile wallet support?

### 4. [Desktop App Architecture](./desktop-app-architecture.md)

**Priority:** HIGH
**Timeline:** 1 week
**Questions:**

- Tauri project structure?
- MSAL Rust integration?
- LangGraph agent runtime?
- Chrome Extension native messaging?

### 5. [Mobile Strategy](./mobile-strategy.md)

**Priority:** MEDIUM
**Timeline:** 1 week
**Questions:**

- PWA vs Native app trade-offs?
- Offline-first architecture?
- Sync conflict resolution?
- Mobile browser history capture?

### 6. [Offline-First Architecture](./offline-first-architecture.md)

**Priority:** MEDIUM
**Timeline:** 2-3 days
**Questions:**

- IndexedDB cache invalidation?
- CRDTs for conflict resolution?
- Background sync API?
- Service worker strategies?

---

## 📊 Decision Matrix

| Architecture Option                  | Token Lifetime | Installation | Mobile Support | Cost             | Self-Sovereign | Status                    |
| ------------------------------------ | -------------- | ------------ | -------------- | ---------------- | -------------- | ------------------------- |
| **Browser-only PWA**           | 24 hours       | Zero         | ✅ Full        | Free             | ⚠️ Limited   | ❌ Rejected (UX)          |
| **Desktop + OneDrive**         | 90 days        | Medium       | ✅ Full        | $5/user/mo       | ❌ No          | ❌ Rejected (centralized) |
| **Desktop + Ceramic/Filecoin** | 90 days        | Medium       | ✅ Full        | $0.01/user/mo    | ✅ Yes         | ✅**SELECTED**      |
| **Native Mobile App**          | 90 days        | High         | ✅ Full        | Development cost | ✅ Yes         | 🔮 Future (Phase 2)       |

---

## 🎯 Implementation Roadmap

### Phase 1: Research & Validation (Weeks 1-2)

- [ ] Ceramic Network deep dive
- [ ] Filecoin storage benchmarks
- [ ] Wallet integration patterns
- [ ] Cost projections
- [ ] Latency testing
- [ ] Decision: Go/No-Go on decentralized architecture

### Phase 2: Desktop App MVP (Weeks 3-5)

- [ ] Tauri project scaffold
- [ ] MSAL OAuth integration (90-day tokens)
- [ ] Wallet integration (MetaMask)
- [ ] Ceramic client (write mission cards)
- [ ] LangGraph agent runtime
- [ ] Chrome Extension bridge

### Phase 3: Mobile PWA Integration (Week 6)

- [ ] WalletConnect integration
- [ ] Ceramic client (read mission cards)
- [ ] IPFS gateway (fetch heavy data)
- [ ] Offline cache (IndexedDB)
- [ ] Mission card UI

### Phase 4: Testing & Refinement (Week 7-8)

- [ ] Cross-device testing
- [ ] Latency optimization
- [ ] Conflict resolution
- [ ] User testing
- [ ] Documentation

---

## 💰 Cost Projections

### Infrastructure (Decentralized)

- **Ceramic:** $0.005/user/month (mission cards)
- **Filecoin:** $0.007/user/month (5-10GB archives)
- **IPFS Gateway:** Free (public gateways) or $10/month (dedicated)
- **Total:** ~$0.012/user/month (~$12 for 1,000 users)

### Compare to Centralized Backend

- **AWS RDS:** $50-100/month (PostgreSQL)
- **AWS S3:** $20-50/month (file storage)
- **AWS EC2:** $50-100/month (API server)
- **Total:** $120-250/month for 1,000 users

**Savings:** 95% cost reduction with decentralized architecture

---

## 🚀 Success Metrics

### Technical

- [ ] Mission card sync latency <2 seconds (desktop → mobile)
- [ ] Heavy data retrieval <5 seconds (IPFS gateway)
- [ ] Desktop app installer <10MB
- [ ] Desktop app memory usage <100MB
- [ ] 99.9% uptime (decentralized network)

### User Experience

- [ ] One-time desktop installation <5 minutes
- [ ] Re-authentication every 90 days (not daily)
- [ ] Mobile PWA works offline with cached missions
- [ ] Cross-device sync feels "instant" (<2s)

### Cost

- [ ] <$0.02/user/month infrastructure cost
- [ ] Zero backend server maintenance
- [ ] Scale to 100,000 users without code changes

---

## 📚 Related Documentation

**Requirements:**

- [OwnYou Consumer App Requirements](../../requirements/*OwnYou%20Consumer%20App%20Requirements%20(brainstorm%20copy).md)
- [Browser Extension Requirements v2.0](../../requirements/browser_extension_chrome_requirement2.0.md)

**Previous Architecture Attempts:**

- [PKCE Implementation Summary](../../requirements/PKCEImplementationSummary.md) - Browser-only attempt
- [Hybrid Auth Implementation](../../requirements/HYBRID_AUTH_IMPLEMENTATION.md) - Python agent attempt (rejected)
- [OAuth Test Results](../../requirements/OAUTH_TEST_RESULTS.md) - 24-hour token limitation confirmed

**Strategic Planning:**

- [Strategic Roadmap (7 Phases)](../../plans/2025-01-04-ownyou-strategic-roadmap.md)
- [Mission Agents Architecture](../../plans/mission_agents_architecture.md)

---

## 🤔 Open Questions

1. **Ceramic Network Maturity** - Is Ceramic production-ready for 10,000+ users?
2. **Wallet UX** - Will non-crypto users accept MetaMask installation?
3. **IPFS Gateway Reliability** - Should we run our own gateway or use public?
4. **Mobile Browser History** - Can we capture without native app?
5. **Desktop Installer Distribution** - Code signing certificates? Auto-update mechanism?

---

## 📝 Next Steps

1. **Review this architecture** - Does it align with OwnYou vision?
2. **Prioritize research areas** - Which questions must be answered first?
3. **Create research spikes** - 1-2 day explorations for each area
4. **Decision point** - Go/No-Go after research phase complete

**Status:** Awaiting approval to proceed with research phase.

---

**Last Updated:** 2025-01-17
**Document Owner:** Architecture Team
**Review Cycle:** Weekly during research phase
