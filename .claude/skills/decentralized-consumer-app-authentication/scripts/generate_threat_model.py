#!/usr/bin/env python3
"""
Threat Model Generator for Authentication Systems

Generates STRIDE-based threat models for decentralized consumer apps.

Usage:
    python generate_threat_model.py --provider="privy" --data-sensitivity="high" --output="THREAT-MODEL.md"
"""

import argparse
from datetime import datetime
from pathlib import Path

THREAT_CATEGORIES = {
    "spoofing": {
        "name": "Spoofing Identity",
        "description": "Attacker pretends to be someone else"
    },
    "tampering": {
        "name": "Tampering with Data",
        "description": "Attacker modifies data in transit or at rest"
    },
    "repudiation": {
        "name": "Repudiation",
        "description": "User denies performing an action"
    },
    "info_disclosure": {
        "name": "Information Disclosure",
        "description": "Attacker accesses confidential data"
    },
    "dos": {
        "name": "Denial of Service",
        "description": "Attacker makes system unavailable"
    },
    "elevation": {
        "name": "Elevation of Privilege",
        "description": "Attacker gains unauthorized permissions"
    }
}

PROVIDER_THREATS = {
    "privy": {
        "key_custody": "Shamir Secret Sharing (2-of-2) - device share + Privy KMS share",
        "specific_threats": [
            ("Device share stolen via XSS", "High", "Use secure storage, implement CSP"),
            ("Privy KMS breach", "Medium", "SOC 2 certified, encrypted at rest"),
            ("Session key leaked", "Medium", "Time-bound sessions, HTTPS only"),
        ],
        "recovery_risks": [
            ("Email account compromise → full recovery", "High", "Require MFA, email verification"),
        ]
    },
    "web3auth": {
        "key_custody": "MPC (3-of-5 TSS) - requires 3 of 5 shares to sign",
        "specific_threats": [
            ("Collusion of 3+ Web3Auth nodes", "Low", "Distributed across cloud providers, regular audits"),
            ("Device share stolen", "Medium", "Secure device storage, encrypted"),
            ("OAuth token theft → account takeover", "High", "Short-lived tokens, PKCE flow"),
        ],
        "recovery_risks": [
            ("Social engineering for recovery", "Medium", "Multi-factor recovery, security questions"),
        ]
    },
    "dynamic": {
        "key_custody": "Turnkey secure enclaves + optional external wallets",
        "specific_threats": [
            ("Passkey stolen via device compromise", "Medium", "Device-bound credentials, biometric"),
            ("Turnkey infrastructure breach", "Low", "Secure enclave isolation, no key export from enclave"),
            ("External wallet phishing", "High", "Clear wallet verification UI, address confirmation"),
        ],
        "recovery_risks": [
            ("Cloud passkey backup compromise", "Medium", "Encrypted backups, require biometric"),
        ]
    },
    "lit": {
        "key_custody": "Distributed PKPs - threshold BLS signatures across 100+ nodes",
        "specific_threats": [
            ("Network partition (>2/3 nodes offline)", "Low", "Geographic distribution, node diversity"),
            ("Lit Actions exploit", "Medium", "Sandboxed execution, code audits"),
            ("Auth method compromise", "High", "Require multiple auth methods for high-value actions"),
        ],
        "recovery_risks": [
            ("All auth methods lost", "High", "Add guardian recovery, multiple auth methods"),
        ]
    },
}


def generate_threat_model(provider, data_sensitivity, app_type=None):
    """Generate STRIDE threat model"""

    provider_data = PROVIDER_THREATS.get(provider.lower(), {
        "key_custody": "Provider-specific key management",
        "specific_threats": [],
        "recovery_risks": []
    })

    threat_model = f"""# Threat Model: {provider.title()} Authentication

**Application**: Decentralized Consumer App
**Provider**: {provider.title()}
**Data Sensitivity**: {data_sensitivity.title()}
**Date**: {datetime.now().strftime('%Y-%m-%d')}
**Methodology**: STRIDE

---

## Executive Summary

This threat model identifies security risks in our authentication system using {provider.title()} as the wallet infrastructure provider. We analyze threats across the STRIDE categories and provide mitigation strategies.

**Risk Level**: {_get_overall_risk(data_sensitivity)}

**Key Management Model**: {provider_data['key_custody']}

---

## Assets

### Critical Assets

1. **User Private Keys**
   - Description: Cryptographic keys controlling user wallets
   - Sensitivity: Critical
   - Impact if compromised: Total loss of user funds and identity

2. **Session Keys**
   - Description: Temporary keys for transaction signing
   - Sensitivity: High
   - Impact if compromised: Unauthorized transactions within session scope

3. **User Data**
   - Description: Personal information, transaction history, preferences
   - Sensitivity: {data_sensitivity.title()}
   - Impact if compromised: {_get_data_breach_impact(data_sensitivity)}

4. **Authentication Credentials**
   - Description: Email, OAuth tokens, passkeys
   - Sensitivity: High
   - Impact if compromised: Account takeover, identity theft

---

## Threat Analysis (STRIDE)

### S - Spoofing Identity

#### Threat: Phishing Attack
- **Description**: Attacker creates fake login page mimicking our app
- **Likelihood**: High (common attack vector)
- **Impact**: High (account takeover)
- **Mitigation**:
  - Use provider's hosted authentication flow (not custom)
  - Implement clear visual indicators (verified domain, brand elements)
  - Educate users about official domains
  - Use HTTPS with HSTS enabled
  - Implement Content Security Policy (CSP)

#### Threat: OAuth Token Interception
- **Description**: Attacker intercepts OAuth callback and steals access token
- **Likelihood**: Medium (requires MITM position)
- **Impact**: High (session hijacking)
- **Mitigation**:
  - Use PKCE flow for OAuth
  - Validate state parameter
  - Short-lived access tokens (< 15 minutes)
  - Secure token storage (HTTP-only cookies or secure storage)

#### Threat: Session Hijacking
- **Description**: Attacker steals active session to impersonate user
- **Likelihood**: Medium
- **Impact**: High (unauthorized actions)
- **Mitigation**:
  - Rotate session tokens after authentication
  - Implement session timeout (24 hours max)
  - Bind sessions to device fingerprint
  - Require re-authentication for sensitive actions

---

### T - Tampering with Data

#### Threat: Transaction Manipulation
- **Description**: Attacker modifies transaction data before signing
- **Likelihood**: Medium (requires code injection)
- **Impact**: High (financial loss)
- **Mitigation**:
  - Show clear transaction details before signing
  - Implement transaction preview with amount, recipient, gas
  - Use checksum addresses (EIP-55)
  - Validate transaction data on backend before broadcasting

#### Threat: Frontend Code Injection (XSS)
- **Description**: Attacker injects malicious JavaScript to steal keys
- **Likelihood**: Medium (common web vulnerability)
- **Impact**: Critical (complete key compromise)
- **Mitigation**:
  - Implement strict Content Security Policy
  - Use DOMPurify for user-generated content
  - Never store keys in localStorage (use secure storage)
  - Regular security audits and penetration testing
  - Implement Subresource Integrity (SRI) for CDN assets

---

### R - Repudiation

#### Threat: User Denies Making Transaction
- **Description**: User claims they didn't authorize a transaction
- **Likelihood**: Low
- **Impact**: Medium (dispute resolution burden)
- **Mitigation**:
  - Log all authentication and transaction events
  - Cryptographic signatures prove user authorization
  - Implement transaction history with timestamps
  - Clear audit trail for session key creation
  - Email/push notifications for sensitive actions

---

### I - Information Disclosure

#### Threat: Private Key Leakage
- **Description**: User's private key exposed through logs, error messages, or storage
- **Likelihood**: Low (if using provider correctly)
- **Impact**: Critical (total account compromise)
- **Mitigation**:
  - Never log private keys or seed phrases
  - Keys managed by provider ({provider_data['key_custody']})
  - Use secure storage APIs (Keychain, Android Keystore)
  - Implement key rotation where possible

#### Threat: User Data Exposure
- **Description**: Sensitive user data leaked through API or database
- **Likelihood**: Medium
- **Impact**: {_get_data_breach_impact(data_sensitivity)}
- **Mitigation**:
  - Encrypt data at rest (AES-256)
  - Encrypt data in transit (TLS 1.3)
  - Implement least-privilege access control
  - Regular security audits
  - PII redaction before external API calls

#### Threat: Blockchain Metadata Leakage
- **Description**: Transaction history reveals user behavior
- **Likelihood**: High (public blockchain)
- **Impact**: Medium (privacy loss)
- **Mitigation**:
  - Educate users about blockchain transparency
  - Consider privacy-preserving techniques (new address per transaction)
  - Use L2 solutions with better privacy
  - Implement optional privacy features (Aztec, zkSync)

---

### D - Denial of Service

#### Threat: Provider Outage
- **Description**: {provider.title()} service becomes unavailable
- **Likelihood**: Low (providers have SLAs)
- **Impact**: High (users can't access wallets)
- **Mitigation**:
  - Monitor provider status page
  - Implement retry logic with exponential backoff
  - Cache user data locally when possible
  - {_get_provider_dos_mitigation(provider)}

#### Threat: Rate Limiting Exhaustion
- **Description**: Attacker exhausts API rate limits
- **Likelihood**: Medium
- **Impact**: Medium (temporary service degradation)
- **Mitigation**:
  - Implement client-side rate limiting
  - Use caching to reduce API calls
  - Monitor usage patterns
  - Implement CAPTCHA for suspicious activity

---

### E - Elevation of Privilege

#### Threat: Session Key Privilege Escalation
- **Description**: Session key used beyond intended permissions
- **Likelihood**: Medium
- **Impact**: High (unauthorized high-value transactions)
- **Mitigation**:
  - Implement granular session key permissions
  - Set spending limits on session keys
  - Whitelist allowed contracts
  - Time-bound sessions (24 hours max)
  - Require main signature for high-value transactions

#### Threat: Admin Access Compromise
- **Description**: Attacker gains admin access to backend systems
- **Likelihood**: Low
- **Impact**: Critical (full system compromise)
- **Mitigation**:
  - Implement multi-factor authentication for admins
  - Use role-based access control (RBAC)
  - Audit all admin actions
  - Rotate admin credentials regularly
  - Use hardware security keys for admin access

---

## Provider-Specific Threats

{_format_provider_threats(provider_data)}

---

## Data Flow Diagram

```
User Device
  ↓ (HTTPS + PKCE)
Authentication Provider ({provider.title()})
  ↓ (OAuth Token + Wallet Address)
Your Backend API
  ↓ (Signed Transactions)
Blockchain Network
```

### Trust Boundaries

1. **User Device ↔ Authentication Provider**: User trusts provider with key shares
2. **Authentication Provider ↔ Blockchain**: Provider signs transactions on user's behalf
3. **Your App ↔ User**: User trusts your app's transaction construction

---

## Attack Scenarios

### Scenario 1: Phishing + Session Key Theft

**Attack Path**:
1. User receives phishing email mimicking your app
2. User enters credentials on fake site
3. Attacker obtains session key from compromised device
4. Attacker drains funds within session limits

**Likelihood**: Medium
**Impact**: High

**Mitigation**:
- Multi-layered: Domain verification + session limits + transaction notifications

### Scenario 2: Supply Chain Attack

**Attack Path**:
1. Malicious dependency injected into frontend bundle
2. Code steals session keys on user device
3. Keys exfiltrated to attacker
4. Attacker uses keys to drain wallets

**Likelihood**: Low
**Impact**: Critical

**Mitigation**:
- Use Subresource Integrity (SRI) for all dependencies
- Regular dependency audits (npm audit, Snyk)
- Pin dependency versions
- Use lockfiles (package-lock.json)
- Implement CSP to block unauthorized requests

### Scenario 3: {provider.title()} Infrastructure Breach

**Attack Path**:
1. Attacker compromises {provider.title()} infrastructure
2. Access to encrypted key shares
3. Attempts to decrypt user keys
4. Uses keys to steal funds

**Likelihood**: Low ({_get_provider_breach_likelihood(provider)})
**Impact**: Critical

**Mitigation**:
- Provider security: {_get_provider_security(provider)}
- Your mitigation: Implement transaction amount limits, email notifications

---

## Compliance Considerations

### GDPR (if serving EU users)

- **Right to Erasure**: How do we handle user data deletion when blockchain is immutable?
  - Mitigation: Delete off-chain data, on-chain data is pseudonymous

- **Data Protection**: How is user PII protected?
  - Mitigation: Encrypt PII, minimize collection, process client-side when possible

### SOC 2 (if handling sensitive data)

- **Access Controls**: Who has access to production systems?
- **Logging**: Are all security events logged?
- **Incident Response**: Do we have an IR plan?

---

## Security Checklist

Before production deployment:

- [ ] Penetration testing completed
- [ ] Security audit of authentication flow
- [ ] Rate limiting implemented
- [ ] Logging and monitoring in place
- [ ] Incident response plan documented
- [ ] User education materials created (phishing awareness)
- [ ] Session key permissions configured (time, spending limits)
- [ ] Transaction notifications implemented
- [ ] Backup and recovery procedures tested
- [ ] CSP and security headers configured
- [ ] Dependency audit completed (no critical vulnerabilities)
- [ ] Secrets management reviewed (no keys in code)

---

## Monitoring & Detection

### Key Metrics to Monitor

1. **Failed Authentication Attempts**: > 10 per user per hour → potential brute force
2. **Session Key Creation Rate**: > 5 per user per day → potential abuse
3. **Transaction Velocity**: Unusual spike → potential compromise
4. **Geographic Anomalies**: Login from new location → potential account takeover
5. **Provider API Errors**: Spike in errors → potential outage or attack

### Alerting Thresholds

- Critical: Any suspected key compromise → immediate alert
- High: Unusual transaction patterns → alert within 5 minutes
- Medium: Failed auth attempts → alert within 30 minutes

---

## Incident Response

### If User Reports Compromise

1. **Immediately**: Revoke all active sessions
2. **Within 5 min**: Disable user's wallet transactions
3. **Within 15 min**: Investigate compromise vector
4. **Within 1 hour**: Communicate with user, provide recovery options
5. **Within 24 hours**: Implement additional mitigations if systemic issue

### If Provider Breach Detected

1. **Immediately**: Notify all users via email
2. **Within 1 hour**: Assess blast radius
3. **Within 4 hours**: Implement emergency mitigations
4. **Within 24 hours**: Plan migration if necessary

---

## Risk Summary

| Threat | Likelihood | Impact | Risk Level | Mitigation Status |
|--------|------------|---------|------------|-------------------|
| Phishing | High | High | High | ⚠️ Partial |
| Session Key Theft | Medium | High | Medium | ✅ Mitigated |
| XSS Attack | Medium | Critical | High | ✅ Mitigated |
| Provider Breach | Low | Critical | Medium | ✅ Mitigated |
| Supply Chain Attack | Low | Critical | Medium | ⚠️ Partial |
| Transaction Manipulation | Medium | High | Medium | ✅ Mitigated |

---

## Recommendations

### Immediate (Before Launch)

1. Implement Content Security Policy
2. Set up transaction notifications
3. Configure session key limits (24h, $100/day)
4. Enable rate limiting on authentication endpoints

### Short-term (Within 3 months)

1. Conduct professional penetration test
2. Implement advanced monitoring and alerting
3. User education campaign on phishing
4. Regular dependency audits

### Long-term (6+ months)

1. Consider progressive decentralization (self-custody options)
2. Implement account recovery guardians
3. Explore privacy-preserving techniques
4. Regular security audits (quarterly)

---

**Document Version**: 1.0
**Next Review Date**: {_next_review_date()}
**Owner**: Security Team
"""

    return threat_model


def _get_overall_risk(data_sensitivity):
    risk_map = {
        "low": "Medium - Standard authentication risks",
        "medium": "Medium-High - Moderate data sensitivity requires careful security",
        "high": "High - Sensitive data requires rigorous security measures"
    }
    return risk_map.get(data_sensitivity.lower(), "Medium")


def _get_data_breach_impact(data_sensitivity):
    impact_map = {
        "low": "Minimal impact, user inconvenience",
        "medium": "Moderate impact, privacy concerns, potential regulatory issues",
        "high": "Severe impact, financial loss, regulatory penalties, reputational damage"
    }
    return impact_map.get(data_sensitivity.lower(), "Privacy concerns")


def _format_provider_threats(provider_data):
    output = ""
    if provider_data.get('specific_threats'):
        output += "### Key Management Threats\n\n"
        for threat, likelihood, mitigation in provider_data['specific_threats']:
            output += f"**Threat**: {threat}\n"
            output += f"- Likelihood: {likelihood}\n"
            output += f"- Mitigation: {mitigation}\n\n"

    if provider_data.get('recovery_risks'):
        output += "### Recovery Risks\n\n"
        for risk, likelihood, mitigation in provider_data['recovery_risks']:
            output += f"**Risk**: {risk}\n"
            output += f"- Likelihood: {likelihood}\n"
            output += f"- Mitigation: {mitigation}\n\n"

    return output


def _get_provider_dos_mitigation(provider):
    mitigations = {
        "privy": "Document key export process for disaster recovery",
        "web3auth": "Self-hosted option available (CoreKit) for critical apps",
        "dynamic": "Turnkey infrastructure SLA, monitor status page",
        "lit": "Decentralized network (no single point of failure)",
        "turnkey": "Institutional-grade SLA, can export keys",
    }
    return mitigations.get(provider.lower(), "Monitor provider status, implement fallbacks")


def _get_provider_breach_likelihood(provider):
    likelihood_map = {
        "privy": "SOC 2 certified, but centralized infrastructure",
        "web3auth": "MPC threshold makes breach difficult",
        "dynamic": "Built on Turnkey (secure enclaves)",
        "lit": "Decentralized - no single breach point",
        "magic": "Battle-tested at scale, SOC 2 certified",
    }
    return likelihood_map.get(provider.lower(), "varies by provider security practices")


def _get_provider_security(provider):
    security_map = {
        "privy": "SOC 2 Type II, encryption at rest, 2-of-2 key shares",
        "web3auth": "3-of-5 MPC threshold, regular audits, SOC 2 + ISO 27001",
        "dynamic": "Turnkey secure enclaves (AWS Nitro), no key export from hardware",
        "lit": "100+ distributed nodes, threshold signatures, open-source audited",
        "magic": "AWS KMS, Fortanix HSM, SOC 2 Type II, battle-tested",
        "turnkey": "Secure enclave isolation, institutional-grade, key export capabilities",
    }
    return security_map.get(provider.lower(), "Provider security documentation should be reviewed")


def _next_review_date():
    from datetime import timedelta
    review_date = datetime.now() + timedelta(days=90)
    return review_date.strftime('%Y-%m-%d')


def main():
    parser = argparse.ArgumentParser(description='Generate STRIDE threat model for authentication')
    parser.add_argument('--provider', required=True, help='Provider name (privy, web3auth, dynamic, lit, etc.)')
    parser.add_argument('--data-sensitivity', required=True, choices=['low', 'medium', 'high'],
                        help='Data sensitivity level')
    parser.add_argument('--app-type', help='Application type (optional)')
    parser.add_argument('--output', required=True, help='Output filename')

    args = parser.parse_args()

    # Generate threat model
    threat_model_content = generate_threat_model(
        provider=args.provider,
        data_sensitivity=args.data_sensitivity,
        app_type=args.app_type
    )

    # Write to file
    output_path = Path(args.output)
    output_path.write_text(threat_model_content)

    print(f"✅ Threat model generated: {output_path}")
    print(f"🔒 Review security measures and implement recommendations")


if __name__ == '__main__':
    main()
