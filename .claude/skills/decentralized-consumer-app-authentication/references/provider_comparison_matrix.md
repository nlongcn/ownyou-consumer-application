# Provider Comparison Matrix (2025)

**Quick-scan table for all 13 embedded wallet providers. Use this for fast filtering, then read detailed comparisons.**

## Grep-Optimized Format

Search efficiently:
```bash
# Find providers with native session keys
grep "Session Keys: Native" provider_comparison_matrix.md

# Find free-tier providers
grep "Free Tier: " provider_comparison_matrix.md | grep "Yes"

# Find providers supporting specific features
grep -E "Passkeys|MPC|ERC-4337" provider_comparison_matrix.md
```

---

## Tier 1: Mature Embedded Wallet Providers

### Privy
- **Key Management**: Shamir Secret Sharing (2-of-2)
- **Session Keys**: Native (built-in)
- **Account Abstraction**: ERC-4337 (native), EIP-7702 (roadmap)
- **Pricing**: Free up to 500 MAUs, Core $299/mo (2.5K MAUs), 100K free tx/mo
- **Mobile SDKs**: iOS, Android, React Native (excellent)
- **Recovery**: Email, cloud backup, multi-device sync
- **Multi-device**: Auto-sync (seamless)
- **Key Export**: Limited
- **Compliance**: SOC 2 Type II
- **Best For**: Consumer apps, fast time-to-market, mainstream users
- **Free Tier**: Yes (500 MAUs)
- **Passkeys**: No
- **Multi-chain**: Yes (EVM + Solana)

### Web3Auth
- **Key Management**: MPC (3-of-5 TSS)
- **Session Keys**: Via plugins (ZeroDev, Biconomy)
- **Account Abstraction**: ERC-4337 (via plugins)
- **Pricing**: Free 1K MAWs, then $0.05/MAW
- **Mobile SDKs**: iOS, Android, React Native, Flutter (extensive)
- **Recovery**: Social recovery, multi-factor
- **Multi-device**: Device share backup
- **Key Export**: Yes (users can export)
- **Compliance**: SOC 2, ISO 27001
- **Best For**: True non-custodial, wide ecosystem, self-hosted option
- **Free Tier**: Yes (1K MAWs)
- **Passkeys**: Via custom auth
- **Multi-chain**: Yes (extensive)

### Magic
- **Key Management**: Delegated custody (AWS KMS)
- **Session Keys**: Limited (not native)
- **Account Abstraction**: ERC-4337 (via integrations)
- **Pricing**: Free 1K MAUs, Growth/Enterprise (contact sales)
- **Mobile SDKs**: iOS, Android, React Native (good)
- **Recovery**: Email-based (automatic)
- **Multi-device**: Device-specific keys
- **Key Export**: No
- **Compliance**: SOC 2 Type II
- **Best For**: Enterprise reliability, NFT checkout, proven scale
- **Free Tier**: Yes (1K MAUs)
- **Passkeys**: WebAuthn support
- **Multi-chain**: Yes (extensive)

### Dynamic
- **Key Management**: Hybrid (Turnkey-powered + external wallets)
- **Session Keys**: Native (built-in)
- **Account Abstraction**: ERC-4337 (native), EIP-7702 (roadmap)
- **Pricing**: Free 1K ops, Launch tier (operations-based)
- **Mobile SDKs**: iOS, Android, React Native (excellent)
- **Recovery**: Email, passkey, multi-device
- **Multi-device**: Passkey sync
- **Key Export**: Yes
- **Compliance**: Building (backed by Turnkey infrastructure)
- **Best For**: Flexibility (embedded + external), multi-wallet support
- **Free Tier**: Yes (1K operations)
- **Passkeys**: Yes (native)
- **Multi-chain**: Yes (100+ chains EVM/SVM)

### Turnkey
- **Key Management**: Secure Enclaves (AWS Nitro, GCP Confidential)
- **Session Keys**: Passkey-based signing
- **Account Abstraction**: ERC-4337 (full support)
- **Pricing**: Free 25 sigs, Pro from $99/mo, $0.10/additional tx
- **Mobile SDKs**: iOS, Android, React Native (good)
- **Recovery**: Fully customizable policies
- **Multi-device**: Manual key management
- **Key Export**: Yes (full export capabilities)
- **Compliance**: Institutional-grade security
- **Best For**: Maximum security, full control over UX, infrastructure builders
- **Free Tier**: Yes (25 signatures)
- **Passkeys**: Yes (core feature)
- **Multi-chain**: Yes

### LIT Protocol
- **Key Management**: Distributed PKPs (threshold BLS)
- **Session Keys**: Native (via Lit Actions)
- **Account Abstraction**: PKP as AA signer
- **Pricing**: Free (pay network gas fees only)
- **Mobile SDKs**: React Native (community)
- **Recovery**: Programmable (multi-auth, guardians)
- **Multi-device**: Multi-auth method support
- **Key Export**: Transferable PKP NFT
- **Compliance**: Decentralized (no central entity)
- **Best For**: True decentralization, programmable custody, privacy-first
- **Free Tier**: Yes (free protocol)
- **Passkeys**: Yes (as auth method)
- **Multi-chain**: Yes (EVM, Cosmos, Bitcoin)

---

## Tier 2: Specialized & Emerging Providers

### Circle Programmable Wallets
- **Key Management**: MPC or Passkeys (user/developer controlled)
- **Session Keys**: Yes (modular wallets feature)
- **Account Abstraction**: ERC-4337 + ERC-6900 (modular)
- **Pricing**: $0.05/MAW (USDC rebates available)
- **Mobile SDKs**: iOS, Android (good)
- **Recovery**: Configurable
- **Multi-device**: Depends on config
- **Key Export**: Depends on config
- **Compliance**: Enterprise-grade (Circle infrastructure)
- **Best For**: USDC integration, enterprise, modular wallets
- **Free Tier**: No (pay-as-you-grow)
- **Passkeys**: Yes (native)
- **Multi-chain**: Polygon, Arbitrum, expanding

### Alchemy Embedded Accounts
- **Key Management**: Bundled with Alchemy Account Kit
- **Session Keys**: Yes (session key plugin)
- **Account Abstraction**: ERC-4337 (native), EIP-7702 support
- **Pricing**: Bundled with Alchemy plans (per-request basis)
- **Mobile SDKs**: iOS, Android, React Native
- **Recovery**: Configurable via Alchemy
- **Multi-device**: Depends on setup
- **Key Export**: Depends on config
- **Compliance**: Alchemy infrastructure
- **Best For**: Existing Alchemy users, bundled with infra
- **Free Tier**: Yes (included in Alchemy free tier)
- **Passkeys**: Yes
- **Multi-chain**: Yes (extensive via Alchemy)

### MetaMask Embedded Wallets
- **Key Management**: Delegation Toolkit (ERC-7715)
- **Session Keys**: Via delegation (ERC-7715)
- **Account Abstraction**: ERC-4337, EIP-7702 (pioneering)
- **Pricing**: Free SDK
- **Mobile SDKs**: iOS, Android, React Native (MetaMask Mobile)
- **Recovery**: MetaMask recovery flows
- **Multi-device**: MetaMask sync
- **Key Export**: Full MetaMask features
- **Compliance**: MetaMask/Consensys infrastructure
- **Best For**: MetaMask ecosystem, ERC-7715 delegation, dapp standardization
- **Free Tier**: Yes (free SDK)
- **Passkeys**: Via delegation framework
- **Multi-chain**: Yes (extensive)

### Particle Network
- **Key Management**: Smart WaaS (Wallet Abstraction)
- **Session Keys**: Yes
- **Account Abstraction**: ERC-4337 (Universal Accounts)
- **Pricing**: 100% free for developers
- **Mobile SDKs**: iOS, Android, React Native, Unity
- **Recovery**: Social login recovery
- **Multi-device**: Yes
- **Key Export**: Yes
- **Compliance**: TBD
- **Best For**: Chain abstraction, one account across all chains
- **Free Tier**: Yes (completely free)
- **Passkeys**: Yes
- **Multi-chain**: Yes (Universal Liquidity, Universal Gas)

### Sequence
- **Key Management**: Multi-sig (configurable)
- **Session Keys**: Yes (native)
- **Account Abstraction**: ERC-4337 (pioneer)
- **Pricing**: Free tier unlimited wallets, custom enterprise
- **Mobile SDKs**: iOS, Android, React Native, Unity (gaming-focused)
- **Recovery**: Social recovery, guardians
- **Multi-device**: Yes
- **Key Export**: Yes
- **Compliance**: TBD
- **Best For**: Gaming, NFT platforms, web3 ecosystems
- **Free Tier**: Yes (unlimited wallets)
- **Passkeys**: Yes
- **Multi-chain**: Yes

### Openfort
- **Key Management**: Passkeys + AA
- **Session Keys**: Yes
- **Account Abstraction**: ERC-4337, EIP-7702 support
- **Pricing**: Free 1K wallets, Pro tier pricing
- **Mobile SDKs**: iOS, Android, Unity
- **Recovery**: Passkey-based
- **Multi-device**: Cloud-synced passkeys
- **Key Export**: Yes
- **Compliance**: Open-source (MIT License)
- **Best For**: Open-source, self-hostable, cost-effective
- **Free Tier**: Yes (1K wallets)
- **Passkeys**: Yes (core feature)
- **Multi-chain**: EVM + SVM

### Coinbase Smart Wallet
- **Key Management**: Passkeys + cloud backup (iCloud/Google)
- **Session Keys**: Limited
- **Account Abstraction**: ERC-4337 (native)
- **Pricing**: Free SDK, gas credits available ($15K via Base)
- **Mobile SDKs**: iOS, Android (Coinbase Wallet integration)
- **Recovery**: Cloud-backed passkeys (iCloud, Google Drive)
- **Multi-device**: Cloud sync (requires cloud backup)
- **Key Export**: Limited (passkey-based)
- **Compliance**: Coinbase infrastructure
- **Best For**: Massive distribution, Base ecosystem, cloud-first
- **Free Tier**: Yes (free SDK + gas credits)
- **Passkeys**: Yes (mandatory for Smart Wallet)
- **Multi-chain**: Base, Ethereum, other EVM chains

---

## Quick Comparison by Feature

### Native Session Keys
- **Yes**: Privy, Dynamic, LIT Protocol, Sequence, Circle, Alchemy, MetaMask (via delegation), Particle, Openfort
- **Via Plugin**: Web3Auth (ZeroDev, Biconomy)
- **Limited/No**: Magic, Turnkey (passkey signing instead), Coinbase Smart Wallet

### True Decentralization (No Company Dependency)
- **Yes**: LIT Protocol ONLY
- **Hybrid**: Web3Auth (can self-host), Openfort (open-source)
- **No**: All others

### Best Pricing at Scale (100K users)
1. **Free**: LIT Protocol, Particle Network
2. **Low Cost**: Turnkey ($10K/mo for 100K wallets), Openfort
3. **Medium**: Privy, Dynamic, Sequence (custom)
4. **High**: Web3Auth ($5K+/mo), Circle, Magic

### Enterprise/Compliance Ready (SOC 2)
- **Yes**: Web3Auth, Magic, Privy, Turnkey, Circle
- **Building**: Dynamic, Alchemy
- **TBD**: Particle, Sequence, Openfort, MetaMask (Consensys compliant)
- **N/A**: LIT Protocol (decentralized)

### Gaming-Optimized
1. **Sequence** (purpose-built for gaming)
2. **Particle Network** (chain abstraction for games)
3. **Openfort** (Unity SDK, cost-effective)
4. **Dynamic** (flexible, good for web3 games)

### Mobile SDK Quality
- **Excellent**: Privy, Dynamic, Web3Auth
- **Good**: Magic, Sequence, Circle, Particle, Openfort
- **Adequate**: Turnkey, Alchemy
- **Community/Beta**: LIT Protocol, MetaMask Embedded

### Passkey Support
- **Native**: Turnkey, Coinbase Smart Wallet, Circle, Dynamic, Openfort, Particle, Sequence
- **Supported**: Web3Auth, Magic, Alchemy, LIT Protocol, MetaMask
- **No**: Privy (focuses on email/social)

### Multi-Chain Support
- **Best**: Particle Network (universal accounts), Dynamic (100+ chains)
- **Extensive**: Web3Auth, Magic, Sequence, Alchemy
- **Good**: Privy (EVM + Solana), LIT Protocol (EVM + Cosmos + Bitcoin)
- **Focused**: Circle (select chains), Coinbase (Base + EVM)

---

## Decision Shortcuts

**"I need the fastest integration"** → **Privy** (best DX, 30min integration)

**"I need session keys NOW"** → **Privy** or **Dynamic** (native support)

**"I need true decentralization"** → **LIT Protocol** (only option)

**"I'm building a game"** → **Sequence** (gaming-native)

**"I need enterprise compliance"** → **Web3Auth** or **Magic** (SOC 2 certified)

**"I'm cost-sensitive at scale"** → **Turnkey** or **LIT Protocol** (cheapest)

**"I need chain abstraction"** → **Particle Network** (one account, any chain)

**"I want open-source"** → **Openfort** (MIT license, self-hostable)

**"I need massive distribution"** → **Coinbase Smart Wallet** (Coinbase user base)

**"I need both embedded + external wallets"** → **Dynamic** (best hybrid)

**"I need USDC integration"** → **Circle** (built for stablecoins)

**"I'm already using Alchemy"** → **Alchemy Embedded Accounts** (bundled)

**"I want MetaMask ecosystem"** → **MetaMask Embedded Wallets** (ERC-7715 delegation)

---

## Updated 2025 Pricing Summary

| Provider | Free Tier | Paid Tier | Cost at 10K Users | Cost at 100K Users |
|----------|-----------|-----------|-------------------|---------------------|
| **Privy** | 500 MAUs | $299/mo (2.5K) | ~$1,200/mo | ~$10K+/mo |
| **Web3Auth** | 1K MAWs | $0.05/MAW | $500/mo | $5,000/mo |
| **Magic** | 1K MAUs | Contact sales | Contact | Contact (higher) |
| **Dynamic** | 1K ops | Operations-based | ~$600/mo | ~$5K+/mo |
| **Turnkey** | 25 sigs | $99/mo + $0.10/tx | ~$1K/mo | ~$10K/mo |
| **LIT Protocol** | Unlimited | Network fees only | ~$10/mo | ~$100/mo |
| **Circle** | None | $0.05/MAW | $500/mo | $5,000/mo |
| **Alchemy** | Included | Bundled with Alchemy | Varies | Varies |
| **MetaMask** | Unlimited | Free SDK | Free | Free |
| **Particle** | Unlimited | Free for devs | Free | Free |
| **Sequence** | Unlimited | Custom enterprise | Custom | Custom |
| **Openfort** | 1K wallets | Pro pricing | ~$200/mo | ~$2K/mo |
| **Coinbase** | Unlimited | Free SDK | Free | Free |

**Note**: Estimates vary based on transaction volume. Confirm with providers for specific use cases.

---

## Last Updated
2025-10-24 (all pricing and features verified as of this date)
