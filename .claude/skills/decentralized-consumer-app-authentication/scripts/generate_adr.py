#!/usr/bin/env python3
"""
Architecture Decision Record (ADR) Generator

Generates ADRs for authentication provider selection based on requirements.

Usage:
    python generate_adr.py --app-type="ai-agent" --users="mainstream" --providers="privy,dynamic" --output="ADR-001.md"
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

# Provider comparison data
PROVIDERS = {
    "privy": {
        "name": "Privy",
        "key_management": "Shamir Secret Sharing (2-of-2)",
        "session_keys": "Native (built-in)",
        "pricing": "Free 500 MAUs, $299/mo Core tier",
        "strengths": [
            "Best developer experience (30min integration)",
            "Native session keys (no third-party needed)",
            "Multi-device sync (seamless)",
            "100K free transactions/month",
            "Excellent React hooks and UI components"
        ],
        "considerations": [
            "Less decentralized than MPC solutions",
            "Limited key export capabilities",
            "Recovery depends on Privy service"
        ],
        "best_for": ["consumer-apps", "ai-agents", "mainstream-users", "fast-development"]
    },
    "web3auth": {
        "name": "Web3Auth",
        "key_management": "MPC (3-of-5 TSS)",
        "session_keys": "Via plugins (ZeroDev, Biconomy)",
        "pricing": "Free 1K MAWs, then $0.05/MAW",
        "strengths": [
            "True non-custodial (cryptographically guaranteed)",
            "Most mature MPC implementation",
            "Self-hosted option available (CoreKit)",
            "Wide ecosystem support",
            "SOC 2 + ISO 27001 certified"
        ],
        "considerations": [
            "Session keys require third-party integration",
            "Higher pricing at scale ($5K/mo for 100K users)",
            "More complex architecture than alternatives"
        ],
        "best_for": ["decentralization-priority", "enterprise", "self-hosted"]
    },
    "dynamic": {
        "name": "Dynamic",
        "key_management": "Hybrid (Turnkey-powered + external wallets)",
        "session_keys": "Native (built-in)",
        "pricing": "Free 1K operations, Launch tier (operations-based)",
        "strengths": [
            "Best flexibility (embedded + external wallets)",
            "Native session keys and passkeys",
            "100+ chains (EVM + SVM)",
            "Progressive decentralization path",
            "Rich analytics and fraud detection"
        ],
        "considerations": [
            "More expensive than Privy",
            "Operations-based pricing (complexity)",
            "Newer session key features"
        ],
        "best_for": ["hybrid-wallet-support", "multi-chain", "flexibility"]
    },
    "magic": {
        "name": "Magic",
        "key_management": "Delegated custody (AWS KMS)",
        "session_keys": "Limited (not native)",
        "pricing": "Free 1K MAUs, Growth/Enterprise (contact sales)",
        "strengths": [
            "Longest track record (since 2018)",
            "Battle-tested at millions of users",
            "SOC 2 Type II certified",
            "Enterprise-grade reliability",
            "NFT checkout features"
        ],
        "considerations": [
            "No native session keys",
            "Higher enterprise pricing",
            "UI feels dated vs competitors",
            "No key export"
        ],
        "best_for": ["enterprise", "nft-marketplace", "proven-scale"]
    },
    "turnkey": {
        "name": "Turnkey",
        "key_management": "Secure Enclaves (AWS Nitro, GCP Confidential)",
        "session_keys": "Passkey-based signing",
        "pricing": "Free 25 sigs, Pro $99/mo, $0.10/additional tx",
        "strengths": [
            "Maximum security (secure enclave isolation)",
            "Full control over UX (no vendor UI)",
            "Key export capabilities",
            "Cost-effective at scale",
            "Institutional-grade security"
        ],
        "considerations": [
            "Requires building your own UX",
            "No pre-built UI components",
            "Steeper learning curve",
            "More development time"
        ],
        "best_for": ["maximum-security", "custom-ux", "infrastructure-builders"]
    },
    "lit": {
        "name": "LIT Protocol",
        "key_management": "Distributed PKPs (threshold BLS)",
        "session_keys": "Native (via Lit Actions)",
        "pricing": "Free (network gas fees only)",
        "strengths": [
            "Only truly decentralized option",
            "Programmable custody (Lit Actions)",
            "Free to use (no company fees)",
            "No vendor lock-in",
            "Multi-chain (EVM, Cosmos, Bitcoin)"
        ],
        "considerations": [
            "Most complex architecture",
            "Network liveness dependency",
            "Smaller ecosystem",
            "Limited pre-built UI"
        ],
        "best_for": ["full-decentralization", "programmable-keys", "privacy-first"]
    },
    "sequence": {
        "name": "Sequence",
        "key_management": "Multi-sig (configurable)",
        "session_keys": "Native (built-in)",
        "pricing": "Free tier unlimited wallets, custom enterprise",
        "strengths": [
            "Purpose-built for gaming",
            "Gas sponsorship with compression",
            "Transaction batching",
            "Unity SDK (gaming engines)",
            "ERC-4337 pioneer"
        ],
        "considerations": [
            "Gaming-focused (may be overkill for other apps)",
            "Custom enterprise pricing",
            "Less suitable for non-gaming use cases"
        ],
        "best_for": ["gaming", "nft-platforms", "web3-ecosystems"]
    },
    "particle": {
        "name": "Particle Network",
        "key_management": "Smart WaaS",
        "session_keys": "Yes",
        "pricing": "100% free for developers",
        "strengths": [
            "Completely free (no fees)",
            "Chain abstraction (one account, any chain)",
            "Universal Liquidity and Gas",
            "Multi-chain focus",
            "Good for experimentation"
        ],
        "considerations": [
            "Newer platform (less battle-tested)",
            "Business model unclear (sustainability?)",
            "Smaller ecosystem"
        ],
        "best_for": ["chain-abstraction", "multi-chain-dapps", "cost-sensitive"]
    },
    "openfort": {
        "name": "Openfort",
        "key_management": "Passkeys + AA",
        "session_keys": "Yes",
        "pricing": "Free 1K wallets, Pro tier pricing",
        "strengths": [
            "Open-source (MIT License)",
            "Self-hostable",
            "Clear transparent pricing",
            "Passkey-first design",
            "Cost-effective"
        ],
        "considerations": [
            "Smaller team/ecosystem",
            "Less enterprise support",
            "Newer platform"
        ],
        "best_for": ["open-source-priority", "self-hosting", "cost-effective"]
    },
    "coinbase": {
        "name": "Coinbase Smart Wallet",
        "key_management": "Passkeys + cloud backup",
        "session_keys": "Limited",
        "pricing": "Free SDK, gas credits available",
        "strengths": [
            "Massive distribution (Coinbase user base)",
            "Cloud-backed passkeys (easy recovery)",
            "Free SDK and gas credits ($15K via Base)",
            "Base ecosystem integration",
            "Mainstream brand recognition"
        ],
        "considerations": [
            "Requires cloud backup (iCloud/Google)",
            "Limited session key support",
            "Base-chain focused",
            "Less suitable for advanced features"
        ],
        "best_for": ["distribution", "base-ecosystem", "mainstream-adoption"]
    },
}


def generate_adr(app_type, users, providers_list, scale=None, budget=None):
    """Generate ADR based on requirements"""

    # Parse providers
    providers_data = [PROVIDERS.get(p.strip().lower(), {}) for p in providers_list.split(',')]
    primary_provider = providers_data[0] if providers_data else {}

    # Get provider name
    provider_name = primary_provider.get('name', 'Unknown Provider')

    # Generate ADR
    adr = f"""# ADR-001: Authentication Provider Selection

**Status**: Proposed
**Date**: {datetime.now().strftime('%Y-%m-%d')}
**Decision Makers**: Engineering Team
**Consulted**: Security Team, Product Team

---

## Context

### Application Requirements

**Application Type**: {app_type}
**Target Users**: {users}
**Expected Scale**: {scale or 'Not specified'}
**Budget Constraints**: {budget or 'Not specified'}

### Problem Statement

We need to select an authentication and wallet provider for our decentralized consumer application. The solution must:

1. Abstract key management for non-crypto-native users
2. Provide secure, non-custodial wallet infrastructure
3. Support our application's transaction patterns and UX requirements
4. Scale with our user growth while remaining cost-effective
5. Maintain user privacy and security

### Key Decision Criteria

Based on our requirements, we prioritized:

- **User Experience**: {_get_ux_priority(app_type)}
- **Security & Privacy**: Non-custodial, user-controlled keys
- **Development Velocity**: Fast integration, good documentation
- **Cost Efficiency**: Pricing model aligned with our scale
- **Future-Proofing**: Support for emerging standards (ERC-4337, EIP-7702)

---

## Decision

We will use **{provider_name}** as our primary authentication and wallet infrastructure provider.

### Architecture Overview

```
User (Email/Social Login)
  ↓
{provider_name} ({primary_provider.get('key_management', 'N/A')})
  ↓
Embedded Wallet (Non-Custodial)
  ↓
{_get_session_key_arch(primary_provider)}
  ↓
Blockchain Transactions
```

### Key Features

- **Key Management**: {primary_provider.get('key_management', 'N/A')}
- **Session Keys**: {primary_provider.get('session_keys', 'N/A')}
- **Account Abstraction**: ERC-4337 support with gas sponsorship
- **Pricing**: {primary_provider.get('pricing', 'N/A')}

---

## Rationale

### Why {provider_name}?

"""

    # Add strengths
    strengths = primary_provider.get('strengths', [])
    for i, strength in enumerate(strengths, 1):
        adr += f"{i}. **{strength.split(':')[0] if ':' in strength else strength}**\n"
        if ':' in strength:
            adr += f"   {strength.split(':', 1)[1].strip()}\n"

    adr += f"""

### Comparison with Alternatives

We evaluated the following alternatives:

"""

    # Add alternatives comparison
    for alt_provider_data in providers_data[1:]:
        alt_name = alt_provider_data.get('name', 'Unknown')
        adr += f"""
**{alt_name}**
- Strengths: {', '.join(alt_provider_data.get('strengths', [])[:2])}
- Why not chosen: {_get_why_not_chosen(alt_name, provider_name)}

"""

    adr += f"""
### Decision Matrix

| Criterion | Weight | {provider_name} | """ + " | ".join([p.get('name', '') for p in providers_data[1:]]) + """ |
|-----------|--------|""" + "---|" * (len(providers_data)) + """
| Developer Experience | High | ⭐⭐⭐⭐⭐ | """ + " | ".join(["⭐⭐⭐⭐" for _ in providers_data[1:]]) + """ |
| Security | High | ⭐⭐⭐⭐ | """ + " | ".join(["⭐⭐⭐⭐⭐" if p.get('name') == 'Web3Auth' else "⭐⭐⭐⭐" for p in providers_data[1:]]) + """ |
| Cost Efficiency | Medium | ⭐⭐⭐⭐ | """ + " | ".join(["⭐⭐⭐" for _ in providers_data[1:]]) + """ |
| Session Keys | High | ⭐⭐⭐⭐⭐ | """ + " | ".join(["⭐⭐⭐⭐" for _ in providers_data[1:]]) + """ |
| Ecosystem | Medium | ⭐⭐⭐⭐ | """ + " | ".join(["⭐⭐⭐⭐" for _ in providers_data[1:]]) + """ |

---

## Consequences

### Positive

"""

    for strength in strengths[:4]:
        adr += f"- ✅ {strength}\n"

    adr += f"""

### Negative / Trade-offs

"""

    considerations = primary_provider.get('considerations', [])
    for consideration in considerations:
        adr += f"- ⚠️ {consideration}\n"

    adr += f"""

### Risks & Mitigation

**Risk 1: Vendor Lock-in**
- Mitigation: {_get_lockin_mitigation(provider_name)}

**Risk 2: Service Downtime**
- Mitigation: Implement retry logic, fallback mechanisms, and monitoring

**Risk 3: Pricing Changes**
- Mitigation: Monitor usage closely, negotiate enterprise contract if scaling rapidly

**Risk 4: Security Breach**
- Mitigation: {_get_security_mitigation(primary_provider)}

---

## Implementation Plan

### Phase 1: Setup & Integration (Week 1)
1. Sign up for {provider_name} account
2. Install SDK and dependencies
3. Configure authentication flow
4. Implement basic wallet creation

### Phase 2: Core Features (Week 2-3)
1. Implement session key management
2. Set up gas sponsorship (if applicable)
3. Implement multi-device support
4. Add recovery flows

### Phase 3: Testing (Week 4)
1. Unit tests for authentication flows
2. Integration tests with blockchain
3. E2E tests for user journeys
4. Security audit of key management

### Phase 4: Production (Week 5+)
1. Deploy to staging
2. Monitor and optimize
3. Roll out to production gradually
4. Implement monitoring and alerting

---

## Success Metrics

- **User Onboarding Time**: < 60 seconds from signup to wallet creation
- **Session Success Rate**: > 99% of sessions complete without errors
- **Transaction Success Rate**: > 95% of transactions succeed
- **User Satisfaction**: NPS > 40 for wallet experience
- **Cost per User**: < ${_get_target_cost_per_user(scale)}

---

## Future Considerations

### EIP-7702 Migration (Q2 2025)
- Ethereum Pectra upgrade introduces EIP-7702
- Evaluate migration from ERC-4337 to EIP-7702 for gas savings
- {provider_name} roadmap: {_get_eip7702_support(provider_name)}

### Multi-Chain Expansion
- Current: {_get_current_chains(provider_name)}
- Future: Consider expanding to {_get_future_chains(app_type)}

### Progressive Decentralization
- Phase 1: Embedded wallets only (current)
- Phase 2: Offer self-custody export options
- Phase 3: Support external wallet connections (if {provider_name == 'Dynamic'})

---

## References

- [{provider_name} Documentation](https://{_get_docs_url(provider_name)})
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [Session Keys Best Practices](../references/session_keys_guide.md)
- [Security Considerations](../references/security_compliance.md)

---

## Approval

- [ ] Engineering Lead
- [ ] Security Team
- [ ] Product Manager
- [ ] CTO/Technical Co-founder

---

**Generated by**: Claude Code Decentralized Consumer Apps Skill
**Tool Version**: 1.0
**Generated Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

    return adr


def _get_ux_priority(app_type):
    priorities = {
        "ai-agent": "Critical - users will interact frequently, need seamless session keys",
        "gaming": "Critical - gamers need instant transactions without popups",
        "social": "High - mainstream users expect Web2-like UX",
        "defi": "Medium - crypto-native users tolerate more friction",
        "personal-data": "High - privacy-focused users want control + simplicity",
    }
    return priorities.get(app_type, "High - user experience is a priority")


def _get_session_key_arch(provider_data):
    session_keys = provider_data.get('session_keys', '')
    if 'Native' in session_keys:
        return "Session Keys (Native - no popup for 24h)"
    elif 'plugin' in session_keys.lower():
        return "Session Keys (via ZeroDev plugin)"
    else:
        return "Per-transaction signing"


def _get_why_not_chosen(alt_name, chosen_name):
    reasons = {
        ("Web3Auth", "Privy"): "More complex setup, session keys require plugins",
        ("Dynamic", "Privy"): "More expensive, operations-based pricing complexity",
        ("Magic", "Privy"): "No native session keys, older UI",
        ("Privy", "Dynamic"): "Less flexible, no external wallet support",
        ("Privy", "Web3Auth"): "Less decentralized (2-of-2 vs 3-of-5 MPC)",
    }
    return reasons.get((alt_name, chosen_name), f"Different strengths, {chosen_name} better aligns with our requirements")


def _get_lockin_mitigation(provider_name):
    if provider_name in ["Web3Auth", "Turnkey", "Openfort"]:
        return "Provider supports key export - users can migrate to self-custody"
    elif provider_name == "LIT Protocol":
        return "Fully decentralized - no vendor lock-in by design"
    else:
        return "Document migration strategy, maintain abstraction layer in code"


def _get_security_mitigation(provider_data):
    key_mgmt = provider_data.get('key_management', '')
    if 'MPC' in key_mgmt:
        return "MPC threshold prevents single-point compromise, regular security audits"
    elif 'Enclave' in key_mgmt:
        return "Secure enclave isolation, no keys leave hardware, institutional-grade security"
    elif 'PKP' in key_mgmt:
        return "Distributed network (100+ nodes), threshold signatures, open-source audited"
    else:
        return "Monitor provider security updates, implement application-level security best practices"


def _get_target_cost_per_user(scale):
    if scale and '100' in str(scale):
        return "0.05"
    elif scale and '10' in str(scale):
        return "0.10"
    else:
        return "0.25"


def _get_eip7702_support(provider_name):
    roadmaps = {
        "Privy": "On roadmap, monitoring Pectra upgrade",
        "Dynamic": "Active development, early support expected",
        "Web3Auth": "Evaluating, will support via plugins",
        "Alchemy": "Native support planned (already building)",
        "MetaMask": "Pioneering EIP-7702 via Delegation Toolkit",
        "Openfort": "On roadmap, EIP-7702 compatibility planned",
    }
    return roadmaps.get(provider_name, "Monitoring Pectra upgrade, will evaluate post-launch")


def _get_current_chains(provider_name):
    chains = {
        "Privy": "Ethereum, Polygon, Arbitrum, Optimism, Base, Solana",
        "Dynamic": "100+ EVM chains + Solana",
        "Web3Auth": "All major EVM chains, Solana, Cosmos",
        "Particle": "Universal accounts across all chains",
        "Sequence": "Ethereum, Polygon, Arbitrum, Avalanche, BSC",
    }
    return chains.get(provider_name, "Ethereum and major L2s")


def _get_future_chains(app_type):
    if app_type == "gaming":
        return "Immutable X, Ronin, other gaming-focused chains"
    elif app_type == "defi":
        return "Solana, Cosmos, additional EVM L2s"
    else:
        return "Additional EVM L2s based on user demand"


def _get_docs_url(provider_name):
    urls = {
        "Privy": "docs.privy.io",
        "Web3Auth": "web3auth.io/docs",
        "Dynamic": "docs.dynamic.xyz",
        "Magic": "magic.link/docs",
        "Turnkey": "docs.turnkey.com",
        "LIT Protocol": "developer.litprotocol.com",
        "Sequence": "docs.sequence.xyz",
        "Particle Network": "developers.particle.network",
        "Openfort": "openfort.io/docs",
        "Coinbase Smart Wallet": "docs.cdp.coinbase.com/wallet-sdk",
    }
    return urls.get(provider_name, "provider-docs.example.com")


def main():
    parser = argparse.ArgumentParser(description='Generate Architecture Decision Record for auth provider')
    parser.add_argument('--app-type', required=True, help='Application type (ai-agent, gaming, social, etc.)')
    parser.add_argument('--users', required=True, help='Target users (crypto-native, mainstream, etc.)')
    parser.add_argument('--providers', required=True, help='Comma-separated list of providers to compare (primary first)')
    parser.add_argument('--scale', help='Expected user scale')
    parser.add_argument('--budget', help='Budget constraints')
    parser.add_argument('--output', required=True, help='Output filename')

    args = parser.parse_args()

    # Generate ADR
    adr_content = generate_adr(
        app_type=args.app_type,
        users=args.users,
        providers_list=args.providers,
        scale=args.scale,
        budget=args.budget
    )

    # Write to file
    output_path = Path(args.output)
    output_path.write_text(adr_content)

    print(f"✅ ADR generated: {output_path}")
    print(f"📄 Review the ADR and obtain approvals before implementation")


if __name__ == '__main__':
    main()
