# Threat Model: OwnYou Authentication System

**System**: Wallet-Based Authentication with Privy
**Data Sensitivity**: HIGH (email, financial, health data)
**Date**: 2025-01-06
**Review Frequency**: Quarterly or after security incident

## System Overview

```
┌─────────────┐
│   User      │
│  (Browser/  │
│   Mobile)   │
└──────┬──────┘
       │
       │ 1. Social Login (Email/Phone/WhatsApp)
       ↓
┌─────────────────────────────────┐
│      Privy SDK (Client)         │
│  - Embedded Wallet Creation     │
│  - MPC Key Management           │
│  - Session Key Generation       │
└──────┬──────────────────────────┘
       │
       │ 2. Sign Challenge
       ↓
┌─────────────────────────────────┐
│   OwnYou Backend (API)          │
│  - JWT Token Generation         │
│  - Session Key Validation       │
│  - Mission State Management     │
└──────┬──────────────────────────┘
       │
       │ 3. Store Encrypted Data
       ↓
┌─────────────────────────────────┐
│    LangGraph Store              │
│  - Encrypted User Data          │
│  - IAB Classifications          │
│  - Mission Cards                │
└─────────────────────────────────┘
```

## Assets

### Critical Assets (Require Maximum Protection)

| Asset | Sensitivity | Impact if Compromised |
|-------|-------------|----------------------|
| **Private Keys (MPC Shares)** | CRITICAL | Total account takeover, theft of tokens |
| **Session Keys** | HIGH | Unauthorized actions for 24h, mission manipulation |
| **User Email/Financial Data** | CRITICAL | Identity theft, financial fraud, privacy breach |
| **JWT Tokens** | HIGH | Account takeover, unauthorized API access |
| **IAB Classifications** | MEDIUM | Privacy violation, profiling exposure |
| **Mission Feedback** | LOW | Preference manipulation, minor privacy concern |

### Trust Boundaries

1. **User Device** → **Privy SDK** (Trusts Privy SDK integrity)
2. **Privy SDK** → **Privy Backend** (Trusts Privy MPC infrastructure)
3. **Privy Backend** → **OwnYou Backend** (Signature verification required)
4. **OwnYou Backend** → **LangGraph Store** (Encrypted data only)
5. **User Browser** → **External APIs** (NO TRUST - never send PII)

## Threat Categories

### 1. Authentication Threats

#### 1.1 Phishing Attacks

**Attack**: Attacker creates fake OwnYou login page to steal credentials

**Likelihood**: HIGH (common attack)
**Impact**: CRITICAL (account takeover)

**Attack Vectors**:
- Fake website with similar domain (ownyou-app.com vs ownyou.app)
- Email phishing with fake login links
- Social engineering via fake customer support

**Mitigations**:
✅ **Domain verification**: Display verified domain in Privy login UI
✅ **HTTPS only**: Enforce TLS for all connections
✅ **Email warnings**: "We will never ask for your private keys"
✅ **Privy UI branding**: Privy's UI makes it clear you're authenticating with them
⚠️ **User education**: In-app warnings about phishing attempts

**Residual Risk**: MEDIUM (user education required)

#### 1.2 Session Hijacking

**Attack**: Attacker steals JWT token or session key to impersonate user

**Likelihood**: MEDIUM
**Impact**: HIGH (unauthorized API access)

**Attack Vectors**:
- XSS attack steals JWT from localStorage
- MITM attack intercepts JWT over insecure network
- Compromised device exposes secure storage

**Mitigations**:
✅ **HttpOnly cookies**: Store JWT in HttpOnly cookie (not localStorage)
✅ **SameSite=Strict**: Prevent CSRF attacks
✅ **HTTPS only**: Encrypt all traffic
✅ **Short TTL**: JWT expires after 30 days, session keys after 24h
✅ **CSP headers**: Prevent XSS attacks
✅ **Rate limiting**: Detect suspicious activity patterns
⚠️ **Device compromise**: Cannot fully mitigate if device is rooted/jailbroken

**Residual Risk**: LOW (with proper implementation)

#### 1.3 Replay Attacks

**Attack**: Attacker captures signed message and replays it later

**Likelihood**: LOW (difficult with proper nonce handling)
**Impact**: MEDIUM (duplicate actions)

**Attack Vectors**:
- Capture challenge-response and replay to different server
- Capture transaction signature and replay on different chain

**Mitigations**:
✅ **Nonces**: Challenge includes timestamp and random nonce
✅ **Expiry**: Challenges expire after 5 minutes
✅ **Backend validation**: Check nonce hasn't been used
✅ **Chain ID**: Signatures include chain ID to prevent cross-chain replay
✅ **Sequence numbers**: Mission updates use monotonic sequence numbers

**Residual Risk**: VERY LOW

#### 1.4 Social Login Compromise

**Attack**: Attacker compromises user's email/phone to gain access

**Likelihood**: MEDIUM (email compromise is common)
**Impact**: CRITICAL (full account takeover)

**Attack Vectors**:
- Email account hacked (weak password, phishing)
- Phone number ported (SIM swap attack)
- WhatsApp account compromised

**Mitigations**:
✅ **2FA encouraged**: Prompt users to enable 2FA on email/phone
✅ **Device binding**: Detect and alert on new device logins
✅ **Recovery delay**: 48h delay for account recovery (prevents fast takeover)
⚠️ **User responsibility**: Cannot control email provider security
⚠️ **Guardian recovery**: Future feature - social recovery as alternative

**Residual Risk**: MEDIUM (limited control over email provider)

### 2. Key Management Threats

#### 2.1 MPC Share Compromise

**Attack**: Attacker gains access to MPC key shares from Privy infrastructure

**Likelihood**: VERY LOW (requires Privy breach)
**Impact**: CRITICAL (mass account compromise)

**Attack Vectors**:
- Breach of Privy's MPC infrastructure
- Insider threat at Privy
- Supply chain attack on Privy dependencies

**Mitigations**:
✅ **Privy's security**: SOC2 Type II certified (if available)
✅ **Key export**: Users can export keys and migrate if Privy compromised
✅ **Monitoring**: Privy monitors for unusual activity
⚠️ **Trust Privy**: Inherent trust in Privy's security
⚠️ **Diversification**: Future - offer LIT Protocol as alternative

**Residual Risk**: LOW (Privy is incentivized to maintain security)

#### 2.2 Session Key Leak

**Attack**: Attacker obtains user's session key from device storage

**Likelihood**: MEDIUM (device compromise)
**Impact**: MEDIUM (limited time window)

**Attack Vectors**:
- Malware on user device reads secure storage
- Developer tools expose session key during debugging
- Physical device theft with unlocked screen

**Mitigations**:
✅ **Short TTL**: Session key expires after 24h (limits exposure window)
✅ **Secure storage**: iOS Keychain / Android Keystore
✅ **Rate limiting**: Detect and block suspicious usage patterns
✅ **Scope limits**: Session keys only for non-financial actions
⚠️ **Device security**: Cannot control device-level security

**Residual Risk**: LOW (limited impact due to short TTL and scope)

#### 2.3 Key Export Abuse

**Attack**: Attacker tricks user into exporting and sharing private key

**Likelihood**: LOW (requires user cooperation)
**Impact**: CRITICAL (permanent account compromise)

**Attack Vectors**:
- Social engineering: "Export your key for support"
- Fake key export UI in malicious app

**Mitigations**:
✅ **Warning UI**: "NEVER share your private key with anyone, including support"
✅ **Confirm export**: Require explicit confirmation with warning
✅ **Audit log**: Log all key export events
⚠️ **User education**: Ultimately relies on user awareness

**Residual Risk**: LOW (with proper warnings)

### 3. Privacy Threats

#### 3.1 PII Leakage to External APIs

**Attack**: User's sensitive data (email, transactions) sent to external APIs

**Likelihood**: HIGH (without proper safeguards)
**Impact**: CRITICAL (privacy breach, GDPR violation)

**Attack Vectors**:
- Direct API calls with user data in payload
- Logs containing PII sent to monitoring services
- Error messages exposing sensitive data
- Third-party analytics tracking user behavior

**Mitigations**:
✅ **Client-side processing**: All data analysis in browser (WebWorkers)
✅ **PII redaction**: Automatic PII removal before any API call
✅ **Encrypted Store**: All sensitive data encrypted before storage
✅ **No analytics PII**: Analytics events never include personal data
✅ **Audit all external calls**: Systematic review of API integrations
✅ **Test suite**: Automated tests to catch PII leaks

**Residual Risk**: LOW (with rigorous enforcement)

#### 3.2 Metadata Leakage

**Attack**: Inference of sensitive information from metadata

**Likelihood**: MEDIUM
**Impact**: MEDIUM (privacy violation)

**Attack Vectors**:
- API request patterns reveal user behavior (shopping times, locations)
- Mission creation timestamps reveal user routines
- Blockchain transaction metadata (timing, amounts)

**Mitigations**:
✅ **Request batching**: Batch multiple missions to reduce timing signals
✅ **Random delays**: Add jitter to reduce timing correlation
⚠️ **Blockchain transparency**: Public blockchain transactions visible
⚠️ **Traffic analysis**: Difficult to prevent completely

**Residual Risk**: MEDIUM (inherent in blockchain architecture)

#### 3.3 IAB Classification Exposure

**Attack**: Attacker gains access to user's IAB classification profile

**Likelihood**: LOW (requires backend breach)
**Impact**: HIGH (sensitive profiling data exposed)

**Attack Vectors**:
- Backend database breach
- Insider threat (employee access)
- Store data exfiltration

**Mitigations**:
✅ **Encryption at rest**: Store encrypts all IAB data
✅ **Access controls**: Strict IAB ACLs on Store namespaces
✅ **Audit logging**: All Store access logged
✅ **Anonymization**: IAB shared for ads via BBS+ pseudonyms (future)
⚠️ **Backend security**: Requires strong backend security practices

**Residual Risk**: LOW (with proper backend security)

### 4. Infrastructure Threats

#### 4.1 Privy Downtime

**Attack**: Privy infrastructure goes down, users cannot authenticate

**Likelihood**: LOW (Privy has high availability)
**Impact**: HIGH (app unavailable)

**Attack Vectors**:
- DDoS attack on Privy
- Privy infrastructure failure
- Privy bankruptcy/shutdown

**Mitigations**:
✅ **Key export**: Users can export keys before shutdown
✅ **Local session caching**: Continue working with valid session
✅ **Graceful degradation**: Read-only mode if Privy unavailable
⚠️ **Migration plan**: Pre-defined migration to LIT Protocol

**Residual Risk**: LOW (Privy has strong SLAs)

#### 4.2 Backend Compromise

**Attack**: Attacker gains access to OwnYou backend

**Likelihood**: MEDIUM (depends on our security practices)
**Impact**: CRITICAL (all user data at risk)

**Attack Vectors**:
- SQL injection (if using SQL)
- API vulnerabilities (missing auth checks)
- Dependency vulnerabilities
- Compromised credentials (leaked API keys)

**Mitigations**:
✅ **Store ACLs**: Backend cannot access data without user consent
✅ **Encrypted data**: Data encrypted client-side before storage
✅ **Security audit**: Regular penetration testing
✅ **Dependency scanning**: Automated vulnerability checks
✅ **Principle of least privilege**: Minimal permissions
✅ **Secrets management**: No hardcoded credentials

**Residual Risk**: MEDIUM (constant vigilance required)

#### 4.3 Supply Chain Attack

**Attack**: Compromised dependency injects malicious code

**Likelihood**: LOW (but increasing trend)
**Impact**: CRITICAL (arbitrary code execution)

**Attack Vectors**:
- Compromised npm package
- Malicious SDK update
- Build tool compromise

**Mitigations**:
✅ **Dependency pinning**: Lock exact versions
✅ **Integrity checks**: Verify package hashes (npm audit)
✅ **Regular updates**: Keep dependencies patched
✅ **Minimal dependencies**: Reduce attack surface
⚠️ **Cannot eliminate**: Inherent risk in modern development

**Residual Risk**: LOW (with good hygiene)

### 5. User-Centric Threats

#### 5.1 Device Loss

**Attack**: User loses device with wallet access

**Likelihood**: HIGH (common occurrence)
**Impact**: HIGH (loss of access)

**Attack Vectors**:
- Phone lost or stolen
- Computer stolen
- Device destroyed (water damage, etc.)

**Mitigations**:
✅ **Cloud backup**: Privy auto-backs up to iCloud/Google
✅ **Key export**: Users can export and store keys separately
✅ **Social recovery**: Future feature - guardian-based recovery
✅ **Multi-device**: Access from multiple devices

**Residual Risk**: LOW (multiple recovery options)

#### 5.2 User Mistake

**Attack**: User accidentally approves malicious transaction

**Likelihood**: MEDIUM (user error is common)
**Impact**: HIGH (financial loss)

**Attack Vectors**:
- Clicking "Approve" without reading transaction details
- Malicious dApp tricks user into approving token spend
- Phishing site tricks user into signing message

**Mitigations**:
✅ **Clear UI**: Transaction details prominently displayed
✅ **Session key scope**: Session keys cannot approve token transfers
✅ **Spending limits**: Future - set max amounts for session keys
⚠️ **User education**: Ultimately user's responsibility

**Residual Risk**: MEDIUM (user error difficult to prevent)

## Security Controls Matrix

| Control | Implemented | Priority | Phase |
|---------|-------------|----------|-------|
| HTTPS Enforcement | ✅ | CRITICAL | 1 |
| HttpOnly Cookies | ✅ | CRITICAL | 1 |
| CSP Headers | ✅ | HIGH | 1 |
| Rate Limiting | ✅ | HIGH | 1 |
| PII Redaction | ✅ | CRITICAL | 1 |
| Client-Side Encryption | ✅ | CRITICAL | 1 |
| Session Key TTL | ✅ | HIGH | 2 |
| Device Binding | ⏳ | MEDIUM | 2 |
| Audit Logging | ⏳ | HIGH | 2 |
| 2FA Encouragement | ⏳ | MEDIUM | 3 |
| Social Recovery | ⏳ | MEDIUM | 4 |
| Spending Limits | ⏳ | LOW | 4 |

## Incident Response Plan

### Severity Levels

**P0 (Critical)**: Mass compromise, data breach, system down
**P1 (High)**: Individual account compromise, security vulnerability
**P2 (Medium)**: Suspicious activity, potential threat
**P3 (Low)**: Security improvement needed

### Response Procedures

#### P0: Mass Compromise

1. **Immediate** (0-15 min)
   - Shut down affected systems
   - Notify executive team
   - Enable incident response mode

2. **Short-term** (15 min - 4 hours)
   - Assess scope of breach
   - Notify affected users
   - Provide key export instructions
   - Implement mitigation (rotate secrets, patch vulnerability)

3. **Medium-term** (4-24 hours)
   - Full post-mortem
   - User migration plan
   - Regulatory notifications (GDPR)

4. **Long-term** (1-7 days)
   - Security audit
   - Architecture improvements
   - User compensation plan

#### P1: Individual Account Compromise

1. **Immediate** (0-1 hour)
   - Freeze affected account
   - Notify user via verified channel
   - Revoke all sessions

2. **Short-term** (1-24 hours)
   - Investigate attack vector
   - Provide recovery instructions
   - Monitor for related attempts

3. **Follow-up** (1-7 days)
   - Root cause analysis
   - Implement preventive measures
   - Update security documentation

## Testing & Validation

### Security Tests

✅ **Penetration Testing**: Quarterly external pen test
✅ **Dependency Scanning**: Automated daily scans (npm audit, Snyk)
✅ **PII Leak Detection**: Automated test suite for PII exposure
✅ **Session Expiry**: Verify JWT/session key expiry enforcement
✅ **XSS Prevention**: Automated XSS scanning (OWASP ZAP)
✅ **CSRF Protection**: Test SameSite cookie enforcement

### Security Checklist (Pre-Production)

- [ ] All API endpoints require authentication
- [ ] All external API calls redact PII
- [ ] All data encrypted before Store writes
- [ ] HTTPS enforced (no HTTP fallback)
- [ ] CSP headers configured
- [ ] Rate limiting on auth endpoints
- [ ] Session TTLs enforced
- [ ] Nonce validation implemented
- [ ] Audit logging enabled
- [ ] Error messages don't expose sensitive data
- [ ] Secrets in environment variables (not code)
- [ ] Key export UI includes warnings

## Review Schedule

- **Quarterly**: Threat model review
- **After Incident**: Immediate review and update
- **Before Major Release**: Architecture security review
- **Annually**: Full security audit + penetration test

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Privy Security Whitepaper](https://docs.privy.io/security)
- [ADR-001: Authentication Decision](ADR-001-authentication.md)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
