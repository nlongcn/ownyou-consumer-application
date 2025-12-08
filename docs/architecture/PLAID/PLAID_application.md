# Plaid Registration Application Guide

**Status:** BLOCKED - Waiting for Sprint 10 (Privy Wallet Authentication)
**Last Updated:** 2025-12-08
**Unblock Criteria:** Complete Sprint 10 wallet authentication implementation

---

## Overview

This document provides guidance for completing the Plaid developer registration. The application requires documentation of MFA implementation, which depends on Privy wallet authentication (Sprint 10).

---

## Application Status

| Requirement | Status | Blocker |
|-------------|--------|---------|
| Q3: Access Controls | Ready | - |
| Q4: Consumer MFA | **BLOCKED** | Requires Sprint 10 (Privy wallet) |
| Q5: Internal MFA | Ready | Enable MFA on Plaid dashboard |
| Q6: TLS 1.2+ | Ready | - |
| Q7: At-rest encryption | Ready | - |
| Q8: Vulnerability mgmt | Ready | - |
| Q9: Privacy policy | Ready | Draft before submission |
| Q10: Consent | Ready | - |
| Q11: Data deletion | Ready | - |

---

## Pre-Submission Checklist

Before completing the Plaid application after Sprint 10:

- [ ] **Sprint 10 Complete** - Privy wallet authentication implemented
- [ ] **Screenshot Captured** - Wallet connection UI showing phishing-resistant MFA
- [ ] **MFA on Plaid Dashboard** - Enable MFA on your Plaid account
- [ ] **Privacy Policy Published** - Or ready to publish
- [ ] **Dependabot Enabled** - For vulnerability management answer

---

## Recommended Answers (Solo/Small Team)

### Q3: Identity and Access Management - Access Controls
**Question:** What access controls does your organization have in place to limit access to production assets (physical or virtual) and sensitive data?

**Recommended:**
- **"Use of OAuth tokens or TLS certificates for non-human authentication"** - OwnYou uses OAuth tokens for Plaid API authentication

**Note:** The other options (periodic reviews, automated de-provisioning, zero trust, centralized IAM) are enterprise-level controls. Be honest - don't select things you don't have.

**Key architectural point:** OwnYou's self-sovereign architecture means there IS no centralized production system storing consumer financial data. Data goes directly to the user's device.

---

### Q4: Consumer MFA Before Plaid Link (REQUIRES SCREENSHOT)
**Question:** Does your organization provide multi-factor authentication (MFA) for consumers on the mobile and/or web applications before Plaid Link is surfaced?

**Recommended (after Sprint 10):**
- **"Yes - Phishing-resistant multi-factor authentication is performed (e.g., biometrics, passkeys, hardware OTPs, etc.)"**

**Screenshot Required:** Capture the Privy wallet connection flow showing:
1. "Connect Wallet" button or modal
2. Wallet signature request (cryptographic verification)

**Why this qualifies:** OwnYou uses wallet-based self-sovereign authentication via Privy. Users authenticate with their cryptographic wallet, which typically uses biometrics/passkeys on mobile devices. This IS phishing-resistant MFA - it's cryptographic signature verification, not password-based.

---

### Q5: MFA for Critical Systems (Internal)
**Question:** Is multi-factor authentication (MFA) in place for access to critical systems that store or process consumer financial data?

**Recommended:**
- **"Yes - Non-phishing-resistant MFA is performed (e.g., SMS, email, question and answer pairs, etc.)"** - IF you have MFA enabled on your Plaid dashboard, cloud accounts, etc.

**Important context:** In OwnYou's architecture, consumer financial data is stored ONLY on the user's device (IndexedDB/SQLite). There is no centralized system that "stores consumer financial data".

However, Plaid is asking about YOUR access to:
- Plaid Dashboard (where you manage API keys)
- Any cloud services (hosting, if any)
- GitHub/source control

**Action item:** Enable MFA on your Plaid dashboard account before submitting.

---

### Q6: TLS 1.2+ Encryption in Transit
**Question:** Does your organization encrypt data in-transit between clients and servers using TLS 1.2 or better?

**Recommended:**
- **"Yes"**

**Why:** All modern web frameworks use TLS 1.2+ by default. Your PWA communicates over HTTPS. Plaid's APIs enforce TLS 1.2+.

---

### Q7: Encrypt Consumer Data at Rest
**Question:** Does your organization encrypt consumer data you receive from the Plaid API at-rest?

**Recommended:**
- **"Yes - We encrypt ALL consumer data retrieved from the Plaid API at-rest"**

**Why:** OwnYou's architecture stores all data locally on the user's device using:
1. **IndexedDB** (browser) - encrypted via wallet-derived keys
2. **SQLite** (desktop/Tauri) - encrypted via wallet-derived keys

Per v13 architecture section 8.13 (Storage Backends) and the self-sovereign design, all personal data is encrypted with keys derived from the user's wallet. The user controls their own encryption keys.

---

### Q8: Vulnerability Management
**Question:** Do you actively perform vulnerability scans against your employee and contractor machines (e.g., laptops) and production assets (e.g., server instances) to detect and patch vulnerabilities?

**Recommended:**
- **"We patch identified vulnerabilities within a defined SLA"** - IF you run `npm audit` or use dependabot/snyk and actually fix vulnerabilities
- OR **"None of the above"** - If you don't have a formal vulnerability scanning process

**Note:** For a solo operation with self-sovereign architecture, there are no traditional "production assets" - data stays on user devices.

---

### Q9: Privacy Policy
**Question:** Does your organization have a privacy policy for the application where Plaid Link will be deployed?

**Recommended:**
- **"Yes - We have a privacy policy and it will be published when we go live"** (if not yet published)
- OR **"Yes - This policy is displayed to end-users within the application"** (if already published)

**Key points to include in privacy policy:**
- All financial data stored on user's device only (self-sovereign)
- No centralized storage of consumer financial data
- User controls and can delete their data anytime
- Financial data used for personalization, never sold to third parties

---

### Q10: Consent for Data Collection
**Question:** Does your organization obtain consent from consumers for the collection, processing, and storage of their data?

**Recommended:**
- **"Yes"**

**Why:** OwnYou obtains explicit consent before:
1. Connecting Plaid Link (user initiates the flow)
2. Processing transaction data for IAB classification
3. Using financial signals for personalization

The Plaid Link flow itself is user-initiated consent.

---

### Q11: Data Deletion/Retention Policy
**Question:** Does your organization have a defined and enforced data deletion and retention policy that is in compliance with applicable data privacy laws, and is this policy reviewed periodically?

**Recommended:**
- **"Yes"**

**Why:** OwnYou's self-sovereign architecture inherently supports data deletion:
- User can delete their local data anytime
- User can revoke Plaid access token
- No server-side data to delete (it's all on-device)
- GDPR/CCPA compliant by design

---

## Summary Table

| Q# | Topic | Recommended Answer |
|----|-------|-------------------|
| 3 | Access Controls | OAuth tokens/TLS certificates only |
| 4 | Consumer MFA | Yes - Phishing-resistant (wallet auth) + **SCREENSHOT** |
| 5 | Internal MFA | Yes - Non-phishing-resistant (if MFA on Plaid dashboard) |
| 6 | TLS 1.2+ | Yes |
| 7 | At-rest encryption | Yes - ALL data encrypted |
| 8 | Vulnerability mgmt | "Patch within SLA" if using dependabot |
| 9 | Privacy policy | Yes - will publish when we go live |
| 10 | Consent | Yes |
| 11 | Data deletion policy | Yes |

---

## Key Architectural Points for Follow-Up Questions

If Plaid asks follow-up questions, emphasize OwnYou's unique architecture:

> "OwnYou uses a self-sovereign data architecture. Consumer financial data retrieved from Plaid is stored exclusively on the user's device (browser IndexedDB or local SQLite database), encrypted with keys derived from the user's cryptographic wallet. We do not operate centralized servers that store consumer financial data. This means:
>
> 1. No server-side database of consumer transactions
> 2. No centralized access to consumer financial data
> 3. Data can only be decrypted by the user who owns the wallet
> 4. User has full control to delete their data anytime
>
> This is fundamentally different from traditional fintech applications and provides stronger privacy guarantees for consumers."

---

## Related Documents

- **v13 Architecture:** `docs/architecture/OwnYou_architecture_v13.md` (Section 5 - Sync, Section 8.13 - Storage)
- **Sprint 8 Spec:** `docs/sprints/ownyou-sprint8-spec.md` (Financial data integration)
- **Sprint 10 Spec:** (Privy wallet authentication - to be created)
- **ADR-001:** `docs/architecture/ADR-001-authentication.md` (Privy wallet authentication design)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2025-12-08 | Initial guide created, blocked on Sprint 10 |
