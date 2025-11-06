---
name: decentralized-consumer-app-authentication
description: Design self-sovereign, privacy-first authentication and architecture for decentralized consumer applications targeting non-crypto-native users. Use when the user requests authentication design, provider selection, or consumer app authentication architectural decisions for Web3 consumer apps (personal data tools, AI agents, gaming, social). Produces ADRs, threat models, implementation plans, and cost analyses.
---
# Decentralized Consumer App Authentication Architecture

## Purpose

Guide the design of self-sovereign, privacy-first authentication and architecture for decentralized consumer applications. Focuses on abstracting key management for non-crypto-native users while maintaining security and user control.

## When to Use This Skill

Use this skill when the user:

- Asks "How should I implement authentication for [app]?"
- Requests provider comparisons or recommendations
- Needs architecture decisions for Web3 consumer apps
- Wants security/privacy analysis for decentralized systems
- Describes building: personal data tools, AI agents, gaming apps, social apps, DeFi for consumers

**Example triggers:**

- "I need embedded wallet authentication for my app"
- "Which provider should I use: Privy vs Web3Auth vs Dynamic?"
- "Design authentication architecture for consumer application"
- "How do I implement session keys for gasless transactions?"

## Decision Workflow

Follow this workflow to design authentication architecture:

### Step 1: Requirements Gathering

Ask the user these specific questions (if not already provided):

1. **Application Type**

   - What kind of app? (personal data analysis, AI agent, gaming, social, DeFi, marketplace, etc.)
2. **Target Users**

   - Who are your users? (crypto-native vs mainstream consumers)
   - Do they already have wallets? (yes/no/mixed)
3. **Transaction Frequency**

   - How often do users sign transactions? (rarely, occasionally, frequently, constant)
   - **Critical question**: Do you need session keys? (if frequent → session keys are mandatory)
4. **Scale & Budget**

   - Expected user scale? (hundreds, thousands, 10K+, 100K+, millions)
   - Budget constraints? (bootstrap, funded startup, enterprise)
5. **Decentralization Philosophy**

   - Must be fully decentralized? (no company dependencies)
   - Practical non-custodial? (hybrid infrastructure OK)
   - Don't care about decentralization? (prioritize UX over decentralization)
6. **Platform Requirements**

   - Web only, mobile only, or both?
   - Which mobile platforms? (iOS, Android, React Native)
   - Game engine? (Unity, Unreal)
7. **Advanced Features**

   - Multi-device experience required? (seamless sync vs manual export)
   - Account abstraction needed? (gas sponsorship, batch transactions)
   - Multi-chain support? (single chain, EVM L2s, or cross-chain)
8. **Compliance & Security**

   - Regulatory requirements? (SOC2, GDPR, data residency)
   - Data sensitivity? (low, medium, high - e.g., financial/health data)
   - Key export required? (users must be able to export keys)

**Important**: Don't ask all questions upfront. Infer from context where possible, and ask only the most relevant questions based on app type.

### Step 2: Provider Selection

Based on requirements, use this **fast decision tree**:

#### Quick Filters (Eliminate Mismatches Fast)

1. **If user needs frequent transactions without popups → MUST have native session keys**

   - ✅ Privy, Dynamic, LIT Protocol, Sequence, ZeroDev+Privy
   - ❌ Magic, plain Web3Auth (without ZeroDev)
2. **If user demands 100% decentralized (no company dependencies)**

   - ✅ LIT Protocol ONLY
   - ❌ All others have infrastructure dependencies
3. **If gaming application**

   - ✅ Sequence, Particle Network, Openfort
   - Consider: Dynamic, Privy with ZeroDev
4. **If enterprise/compliance requirements (SOC2, etc.)**

   - ✅ Magic, Web3Auth, Turnkey, Circle
   - ❌ Newer providers may lack certifications
5. **If budget-constrained at scale (100K+ users)**

   - ✅ Turnkey ($0.10/tx), LIT Protocol (free), Particle Network (free)
   - ❌ Web3Auth ($0.05/MAW = $5K/mo for 100K users)
6. **If need external wallet support (MetaMask, Coinbase Wallet)**

   - ✅ Dynamic (hybrid), MetaMask Delegation Toolkit
   - ⚠️ Privy, Magic, Web3Auth (embedded only)

#### Decision Matrix by App Type

After filtering, use these recommendations:

**Personal Data Analysis Tool** (email parser, life tracking)

- Primary: **Privy** (best DX, session keys, multi-device)
- Alternative: **Web3Auth** (more decentralized MPC)
- Advanced: **LIT Protocol** (programmable data encryption)

**Consumer AI Agent** (shopping assistant, savings advisor)

- Primary: **Dynamic** (embedded + external, flexibility)
- Alternative: **Privy** (simpler if embedded-only OK)
- Gaming-focused: **Sequence** (if agent interacts with games/NFTs)

**Web3 Gaming / Metaverse**

- Primary: **Sequence** (gaming-native, session keys, gas sponsorship)
- Alternative: **Particle Network** (chain abstraction)
- High-volume: **Openfort** (open-source, cost-effective)

**Social / Content Platform**

- Primary: **Privy** (WhatsApp/social login, easy onboarding)
- With existing users: **Dynamic** (support external wallets)
- Web3-native: **Coinbase Smart Wallet** (massive distribution)

**Financial / High-Sensitivity**

- Primary: **Turnkey** (secure enclaves, full control)
- Alternative: **LIT Protocol** (decentralized, programmable)
- Enterprise: **Circle** (regulatory-ready)

**Multi-Chain DApp**

- Primary: **Particle Network** (chain abstraction)
- Alternative: **Dynamic** (50+ chains)
- Gaming: **Sequence** (multi-chain gaming focus)

**Marketplace / Checkout**

- Primary: **Magic** (NFT checkout features, battle-tested)
- Alternative: **Circle** (USDC integration)
- With wallets: **Dynamic** (hybrid support)

### Step 3: Deep Analysis

Once you've narrowed to 1-3 providers, perform deep analysis:

#### Read Detailed References

Use grep to find relevant sections efficiently:

```bash
# Compare specific providers
grep -A 20 "^### Privy$" references/provider_detailed_comparison.md
grep -A 20 "^### Dynamic$" references/provider_detailed_comparison.md

# Find session key implementations
grep -A 10 "session key" references/session_keys_guide.md

# Check pricing for user's scale
grep -A 5 "10K users\|100K users" references/pricing_tco_analysis.md

# Account abstraction considerations
grep -A 10 "EIP-7702\|ERC-4337" references/aa_standards_roadmap.md

# Security compliance
grep -B 2 -A 5 "SOC2\|GDPR" references/security_compliance.md
```

#### Key Comparison Dimensions

For finalists, compare across:

- **Key Management**: MPC, secure enclave, delegated, PKP
- **Session Keys**: Native, via plugin, none
- **Account Abstraction**: ERC-4337 support, EIP-7702 roadmap
- **Pricing**: $ per MAW/tx at user's scale
- **Mobile SDKs**: iOS, Android, React Native quality
- **Recovery**: Social, email, passkey, guardian options
- **Multi-device**: Auto-sync vs manual export
- **Key Export**: Can users extract keys? (lock-in risk)
- **Compliance**: SOC2, ISO, data residency
- **Decentralization Level**: Full, hybrid, centralized

### Step 4: Generate Deliverables

Produce concrete outputs for the user:

#### 4.1 Architecture Decision Record (ADR)

Run the ADR generator:

```bash
python scripts/generate_adr.py \
  --app-type="[type]" \
  --users="[crypto-native|mainstream]" \
  --providers="[selected,providers]" \
  --output="ADR-001-authentication.md"
```

The ADR should include:

- Context (app requirements, constraints)
- Decision (recommended provider)
- Rationale (why this provider, trade-offs considered)
- Consequences (implications, risks, migration path)
- Alternatives considered (why others rejected)

#### 4.2 Threat Model

Run the threat model generator:

```bash
python scripts/generate_threat_model.py \
  --provider="[selected]" \
  --data-sensitivity="[low|medium|high]" \
  --output="THREAT-MODEL-authentication.md"
```

The threat model should cover:

- Authentication attack vectors (phishing, replay, MITM)
- Key custody risks (device loss, compromise, recovery attacks)
- Privacy considerations (PII exposure, metadata leakage)
- Infrastructure dependencies (provider downtime, breach)
- Mitigation strategies (specific to provider)

#### 4.3 Implementation Plan

Run the implementation planner:

```bash
python scripts/generate_implementation_plan.py \
  --provider="[selected]" \
  --platform="[web|ios|android|all]" \
  --output="IMPLEMENTATION-PLAN.md"
```

The plan should include:

- Setup steps (API keys, SDK installation, configuration)
- Core integration (login flow, wallet creation, signing)
- Session key setup (if applicable)
- Account abstraction setup (if applicable)
- Multi-device support (if required)
- Testing checklist (unit tests, integration tests, E2E)
- Production readiness (monitoring, error handling, recovery flows)

#### 4.4 Cost Analysis

Run the TCO calculator:

```bash
python scripts/calculate_tco.py \
  --providers="[provider1,provider2,provider3]" \
  --users="[expected_scale]" \
  --output="COST-ANALYSIS.md"
```

Show:

- Cost at current scale
- Cost at 10x scale
- Cost at 100x scale
- Break-even analysis (if switching providers makes sense)

#### 4.5 Integration Code Skeleton

Generate starter code from templates:

```bash
# Copy relevant integration template
cp assets/integrations/[provider]-starter.ts user-project/
```

Provide working code examples (not pseudocode) for:

- SDK initialization
- Login flow (email/social)
- Creating embedded wallet
- Signing transactions
- Session key creation (if applicable)
- Multi-device export/import (if applicable)

### Step 5: Architecture Patterns

Recommend specific patterns for the use case:

#### Pattern 1: Progressive Decentralization

For mainstream adoption → gradual Web3 onboarding:

```
Day 1:  Email login → embedded wallet (fully abstracted)
Week 1: Show "You have a wallet" education
Month 1: Offer export to self-custody (MetaMask, hardware wallet)
```

**Best with**: Privy, Dynamic, Web3Auth

#### Pattern 2: Session Keys for Frictionless UX

For apps with frequent transactions:

```
User signs once → creates time-bound session key (24h)
App can sign multiple transactions without popup
Session key expires → user signs again
```

**Best with**: Privy (native), Dynamic (native), ZeroDev+any provider

#### Pattern 3: Programmable Custody

For advanced use cases (conditions, multi-sig, guardians):

```
PKP controlled by multiple auth methods
Lit Actions define spending rules
User can add/remove guardians
Recovery via social recovery
```

**Best with**: LIT Protocol

#### Pattern 4: Passkey-First

For mobile apps, seamless UX:

```
User registers with biometric (Touch ID / Face ID)
Keys backed up to iCloud/Google Drive
Future logins = biometric prompt (no password)
```

**Best with**: Turnkey, Coinbase Smart Wallet, Circle, Openfort

#### Pattern 5: Hybrid Wallet Support

For flexibility (start embedded, offer external):

```
Default: Embedded wallet (Privy/Magic)
Optional: "Connect MetaMask" button
Backend: Unified session regardless of wallet type
```

**Best with**: Dynamic (best hybrid), MetaMask Delegation Toolkit

#### Pattern 6: Derived Keys for Encryption

For privacy-first apps (local data encryption):

```
User's wallet signature → derive encryption key
Encrypt sensitive data client-side with derived key
Store encrypted data locally (IndexedDB) or decentralized (IPFS)
Decrypt with same signature (deterministic)
```

**Works with**: Any provider + custom crypto (see `references/privacy_patterns.md`)

## Advanced Considerations

### Account Abstraction Roadmap

Important context for 2025:

- **ERC-4337**: Mature, live on all major chains, 25M+ accounts
- **EIP-7702**: Launched May 7, 2025 (Pectra), enhances EOAs
- **ERC-7715**: Draft standard for permission delegation

**Key decision**: ERC-4337 vs EIP-7702?

- Use **ERC-4337** if: Need it NOW, multi-chain, rich features
- Consider **EIP-7702** if: Ethereum-focused, existing EOAs, lower gas

**Most providers support ERC-4337 today.** Ask about their EIP-7702 roadmap.

Read full analysis: `references/aa_standards_roadmap.md`

### Session Keys Implementation

Three approaches:

1. **Native Provider Session Keys** (easiest)

   - Privy, Dynamic, Sequence have built-in support
   - No third-party integration needed
2. **ZeroDev/Kernel Plugin** (most flexible)

   - Works with Privy, Web3Auth, Magic, any signer
   - Granular permissions, onchain validation
   - ERC-7715 compliant
3. **Custom Implementation** (full control)

   - Create ephemeral key pair
   - User signs delegation message
   - Backend validates signature
   - Risky if not done correctly

**Recommendation**: Use native provider features when available. If not, use ZeroDev.

Read implementation guide: `references/session_keys_guide.md`

### Decentralized Storage Integration

For privacy-first apps storing user data:

**Options**:

- **IPFS**: Content-addressed, peer-to-peer (integrate with Pinata, Infura)
- **Arweave**: Permanent storage (pay once, store forever)
- **Ceramic Network**: Mutable data, DID-authenticated
- **LIT Protocol**: Encrypted data with programmable access control

**Pattern**: Encrypt locally with wallet-derived key → store encrypted on IPFS/Arweave

Read full guide: `references/decentralized_storage.md`

### Offline-First Sync

For local-first apps (email parser use case):

**Pattern**:

1. Process data locally in browser (WebWorkers)
2. Store encrypted in IndexedDB
3. Sync checkpoints to decentralized storage
4. Conflict resolution on multi-device
5. Zero server-side processing (privacy)

**Key tech**: IndexedDB, WebWorkers, CRDT (for sync), AES-GCM (encryption)

Read strategies: `references/offline_sync_strategies.md`

### Privacy by Design

Critical patterns for consumer apps:

1. **PII Redaction**: Remove sensitive data before any external API calls
2. **Client-Side Processing**: All data analysis in browser (WebWorkers)
3. **Zero-Knowledge Proofs**: Share insights without revealing data
4. **Deterministic Encryption**: Wallet signature → encryption key
5. **Minimal Data Collection**: Only collect what's absolutely necessary

Read full patterns: `references/privacy_patterns.md`

## Output Format

When completing this workflow, provide the user with:

### 1. Executive Summary

```
Based on your requirements ([app type] for [user type] with [key needs]),
I recommend [PROVIDER] because [key reasons].

Key trade-offs:
- ✅ Strengths: [list 3-4]
- ⚠️ Considerations: [list 2-3]
- 💰 Cost: $[amount] at [scale]
```

### 2. Deliverables

Present all generated files:

- `ADR-001-authentication.md` - Architecture decision record
- `THREAT-MODEL-authentication.md` - Security analysis
- `IMPLEMENTATION-PLAN.md` - Step-by-step integration guide
- `COST-ANALYSIS.md` - Pricing comparison
- `integration-starter.ts` - Working code skeleton

### 3. Next Steps

Clear action items:

1. Review ADR and threat model
2. Sign up for [provider] account (link to dashboard)
3. Follow implementation plan steps 1-5
4. Set up development environment and test
5. Consider [specific advanced feature] for production

## Common Pitfalls to Avoid

When designing authentication, watch out for:

❌ **Choosing a provider without considering session keys** → Users will hate signing every action
❌ **Ignoring mobile SDK quality** → Poor mobile UX kills adoption
❌ **Not planning for multi-device** → Users expect seamless device switching
❌ **Overlooking key export** → Vendor lock-in risk, user trust issues
❌ **Underestimating scale costs** → $0.05/MAW seems cheap until you hit 100K users ($5K/mo)
❌ **Forgetting about recovery flows** → Users WILL lose devices
❌ **Skipping threat modeling** → Security issues discovered in production
❌ **Not testing EIP-7702 compatibility** → Future-proofing for Ethereum Pectra upgrade

## References Quick Guide

Use these resources efficiently:

- `provider_comparison_matrix.md` - Quick-scan table (all 13 providers)
- `provider_detailed_comparison.md` - In-depth analysis (Web3Auth, Privy, Magic, Dynamic, Turnkey, LIT, Circle, Alchemy, MetaMask, Particle, Sequence, Openfort, Coinbase)
- `aa_standards_roadmap.md` - ERC-4337 vs EIP-7702 vs ERC-7715 analysis
- `session_keys_guide.md` - Implementation approaches (native, ZeroDev, custom)
- `pricing_tco_analysis.md` - Cost comparison at different scales
- `security_compliance.md` - SOC2, key export, data residency matrix
- `decentralized_storage.md` - IPFS, Arweave, Ceramic integration
- `privacy_patterns.md` - PII redaction, client-side encryption, ZK proofs
- `offline_sync_strategies.md` - Local-first, conflict resolution, CRDT

**Search pattern**: Use `grep` to find relevant sections quickly rather than reading entire files.

## Example Sessions

### Example 1: Personal AI Agent

**User**: "I'm building a personal AI agent that helps users with shopping. Non-crypto users. The agent needs to make API calls and transactions on their behalf."

**Your response**:

1. Identify requirements: Consumer app, non-crypto users, frequent transactions → **session keys mandatory**
2. Narrow to: Privy, Dynamic, Sequence
3. Grep comparison: `grep -A 20 "^### Privy$" references/provider_detailed_comparison.md`
4. Run: `python scripts/generate_adr.py --app-type="ai-agent" --users="mainstream" --providers="privy,dynamic"`
5. Run: `python scripts/generate_threat_model.py --provider="privy" --data-sensitivity="medium"`
6. Run: `python scripts/calculate_tco.py --providers="privy,dynamic" --users="10000"`
7. Present: ADR recommending **Privy** (best DX, native session keys, reasonable pricing), with implementation plan and code skeleton

### Example 2: Web3 Game

**User**: "Building a trading card game with NFTs. Lots of transactions. Users shouldn't see wallet popups."

**Your response**:

1. Identify: Gaming, frequent transactions → **gaming-focused provider + session keys**
2. Narrow to: Sequence, Openfort, Particle Network
3. Read: `references/session_keys_guide.md` for gaming patterns
4. Run generators with `--app-type="gaming"`
5. Recommend: **Sequence** (gaming-native, gas sponsorship, batch transactions)
6. Provide: Unity SDK integration example, session key setup, gas policy configuration

### Example 3: Financial Tracking App

**User**: "Personal finance tracker analyzing bank transactions. Very sensitive data. Users want maximum security."

**Your response**:

1. Identify: High-sensitivity, mainstream users, privacy-critical
2. Consider: Turnkey (secure enclaves) or LIT Protocol (decentralized)
3. Read: `references/privacy_patterns.md` for encryption strategies
4. Recommend: **Turnkey** + client-side encryption + no data transmission
5. Threat model: Emphasize local processing, encrypted storage, no PII in API calls
6. Implementation: WebWorker processing, IndexedDB encrypted storage, wallet-derived keys

## Success Criteria

You've completed this skill successfully when:

✅ Produced a clear provider recommendation with reasoning
✅ Generated ADR documenting the decision and trade-offs
✅ Created threat model addressing authentication and privacy risks
✅ Provided implementation plan with concrete steps
✅ Included working code examples (not pseudocode)
✅ Calculated cost estimates at user's expected scale
✅ Identified potential future issues (EIP-7702, scale limits, etc.)
✅ User can immediately start implementing based on your guidance
