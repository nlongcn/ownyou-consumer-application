### **Revised User Test Plan (v13 Compliant)**

**Objective:** Validate the OwnYou system against the `v13` architecture, ensuring strict adherence to defined namespaces, trigger modes, and data structures.

---

### **Phase 1: Foundation (Data Ingestion)**
**Reference:** Section 5 (Data Source Sync Architecture)

#### **Test Case 1.1: Platform-Specific Ingestion**
*   **Context:** `v13` defines distinct behaviors for Tauri vs. PWA (Section 5.1).
*   **Action (Tauri Desktop):**
    1.  Launch Desktop App.
    2.  Verify the **Rust sidecar process** initiates the full OrbitDB/IPFS node.
    3.  Connect Gmail (90-day OAuth).
*   **Action (PWA):**
    1.  Open PWA.
    2.  Verify **Service Worker** registration for background sync.
    3.  Connect Gmail (24-hour OAuth).
*   **Verification:**
    *   **Tauri:** `raw_emails` namespace populates in background.
    *   **PWA:** `raw_emails` populates only when tab is active/woken by Service Worker.

#### **Test Case 1.2: OrbitDB & CRDTs**
*   **Context:** Section 5.2.2 defines specific CRDT types per namespace.
*   **Action:**
    1.  Simulate two devices (Browser A & Browser B).
    2.  **Browser A:** Add a tag to a mission (`mission_tags` namespace).
    3.  **Browser B:** Simultaneously add a different tag to the same mission.
*   **Verification:**
    *   **Namespace:** `mission_tags` must use **OR-Set (Observed-Remove Set)** logic.
    *   **Result:** Both tags should persist (Union), not overwrite (Last-Write-Wins).
    *   **Contrast:** Update `user_name` in both. Verify `user_preferences` namespace uses **LWW-Register** (Last-Write-Wins).

---

### **Phase 2: Intelligence Layers**
**Reference:** Section 2 (Ikigai) & Section 3 (Mission Agents)

#### **Test Case 2.1: Ikigai Inference (Parallel)**
*   **Context:** Section 2.1 specifies parallel LLM inference for 4 dimensions.
*   **Action:** Trigger `IkigaiInferenceEngine` (batch mode).
*   **Verification:**
    *   **Output:** Inspect `ikigai_profile` namespace in Store.
    *   **Structure:** Must match `IkigaiProfile` schema (Section 2.3):
        *   `experiences`, `relationships`, `interests`, `giving` objects present.
        *   `dimensionWeights` calculated.
    *   **Cross-System:** Verify "Profession" was written to `iabClassifications` namespace with key `ikigai_derived` (Section 2.9).

#### **Test Case 2.2: IAB Privacy Tiers**
*   **Context:** Section 3.6.5 (Privacy-Tier Enforcement).
*   **Action:**
    1.  Attempt to read `semanticMemory` (private) from a generic UI component without an Agent context.
    2.  Attempt to read `iabClassifications` (sensitive) via the **Shopping Agent**.
*   **Verification:**
    *   **Generic UI:** Should fail or require explicit user consent/decrypt.
    *   **Shopping Agent:** Should SUCCEED (Allowed in `AGENT_PERMISSIONS` table, Section 3.6.2).

---

### **Phase 3: Mission Execution (4-Mode Triggers)**
**Reference:** Section 3.1 & 3.3

#### **Test Case 3.1: Data-Driven Trigger**
*   **Context:** "Data-Driven" mode (Section 3.1).
*   **Action:** Manually inject a new receipt into `financial_transactions` namespace.
*   **Verification:**
    *   **TriggerEngine:** Detects change.
    *   **Coordinator:** Routes to **Shopping Agent**.
    *   **Result:** New Mission Card created with `status: "CREATED"` (Section 3.3 State Machine).

#### **Test Case 3.2: Scheduled Trigger**
*   **Context:** "Scheduled" mode.
*   **Action:** Force-run the `daily_digest` schedule (defined as `"0 8 * * *"` in Section 3.2).
*   **Verification:**
    *   **Result:** A "Daily Briefing" Mission Card appears.

#### **Test Case 3.3: User-Driven Trigger (NLU)**
*   **Context:** "User-Driven" mode.
*   **Action:** Type "Find me a weekend trip to the coast" into the agent chat.
*   **Verification:**
    *   **Intent Router:** Classifies as `travel` intent.
    *   **Agent:** **Travel Agent (L3)** is invoked.
    *   **Tools:** Verify `search_hotels` tool is called (Section 3.6.1).

#### **Test Case 3.4: Event-Driven Trigger**
*   **Context:** "Event-Driven" mode (Section 3.1).
*   **Action:** Simulate a calendar event reminder for "Flight to NYC tomorrow".
*   **Verification:**
    *   **TriggerEngine:** Detects calendar event approaching.
    *   **Coordinator:** Routes to **Travel Agent**.
    *   **Result:** Mission Card created with travel prep suggestions (check-in reminder, weather at destination).

#### **Test Case 3.5: Agent Tool Permissions**
*   **Context:** Section 3.6.2 (AGENT_PERMISSIONS matrix).
*   **Action:**
    1.  Invoke **Restaurant Agent** and attempt to call `search_flights` tool.
    2.  Invoke **Travel Agent** and attempt to call `search_flights` tool.
*   **Verification:**
    *   **Restaurant Agent:** Tool call should be **BLOCKED** (not in allowed tools).
    *   **Travel Agent:** Tool call should **SUCCEED** (in allowed tools per Section 3.6.1).

---

### **Phase 4: Feedback & Learning**
**Reference:** Section 2.8 (Mission Card Ikigai Feedback)

#### **Test Case 4.1: The "Heart" State Machine**
*   **Context:** Section 2.8 specifies the exact state transitions.
*   **Action:**
    1.  Tap Heart once.
    2.  Tap Heart again.
    3.  Tap Heart a third time.
*   **Verification:**
    *   **State 1:** ❤️ Red ("Like").
    *   **State 2:** ❤️ Large Red ("Love").
    *   **State 3:** 🩶 Grey ("Meh").
    *   **Store:** Verify `missionFeedback` namespace updates with `ikigaiSignal: 1`, `2`, then `0`.

#### **Test Case 4.2: Implicit Feedback**
*   **Context:** Section 2.8 (Interaction Model).
*   **Action:** Click "Complete Mission" *without* tapping the heart.
*   **Verification:**
    *   **Store:** Verify `missionFeedback` records `ikigaiSignal: 2` (Love) with `signalSource: "implicit_complete"`.

---

### **Phase 5: Resilience & Observability**
**Reference:** Section 6 (Error Handling) & Section 10 (Observability)

#### **Test Case 5.1: LLM Cost Circuit Breaker**
*   **Context:** Section 6.10 (LLM Cost Management).
*   **Action:**
    1.  Set a low budget threshold (e.g., $0.01).
    2.  Run a high-volume email classification batch.
*   **Verification:**
    *   **Behavior:** System should stop processing *before* hitting the limit or switch to a cheaper model (downgrade).
    *   **Observability:** Check "Cost Dashboard" (or logs) for `BudgetExceeded` event.

#### **Test Case 5.2: Sync Resilience (Offline Queue)**
*   **Context:** Section 5.2.1 (Offline Handling).
*   **Action:**
    1.  Go Offline.
    2.  Create 5 Mission Feedback events.
    3.  Go Online.
*   **Verification:**
    *   **Queue:** `OfflineQueue` should flush mutations in timestamp order.
    *   **Consistency:** All 5 events appear in the remote/peer store.

#### **Test Case 5.3: Agent Execution Tracing**
*   **Context:** Section 10.2 (Agent Execution Tracing).
*   **Action:**
    1.  Trigger any agent (e.g., Shopping Agent via data injection).
    2.  Open Settings → Debug Panel.
*   **Verification:**
    *   **AgentTrace:** Record exists with correct `trace_id`, `agent_type`, `mission_id`.
    *   **Steps:** Each `AgentStep` includes `step_type`, `timestamp`, `duration_ms`.
    *   **Resources:** Summary shows `llm_calls`, `llm_tokens`, `llm_cost_usd`, `tool_calls`.
    *   **Retention:** Traces stored locally in IndexedDB (not sent externally).

#### **Test Case 5.4: Sync Debugging Logs**
*   **Context:** Section 10.3 (Sync Debugging).
*   **Action:**
    1.  Pair two devices.
    2.  Create a sync conflict (edit same mission on both devices offline, then go online).
    3.  Check Debug Panel → Sync Logs.
*   **Verification:**
    *   **SyncLog:** Events `conflict_detected` and `conflict_resolved` are logged.
    *   **Details:** Log includes `device_id`, `peer_device_id`, `resolution_strategy`.

#### **Test Case 5.5: GDPR Data Export**
*   **Context:** Section 10.5 (GDPR Compliance).
*   **Action:** Navigate to Settings → Privacy → Export My Data.
*   **Verification:**
    *   **Format:** Download is a ZIP containing JSON files.
    *   **Contents:** Includes all namespaces: `raw_emails`, `iabClassifications`, `ikigai_profile`, `missionFeedback`, `semanticMemory`, `episodicMemory`.
    *   **Completeness:** Export matches what's in local IndexedDB.

---

### **Phase 6: Memory Architecture**
**Reference:** Section 8 (Memory Architecture)

#### **Test Case 6.1: Semantic Memory Write & Search**
*   **Context:** Section 8.2 & 8.3 (Agent-Driven Memory).
*   **Action:**
    1.  Complete a Travel mission where user expresses "I hate layovers".
    2.  Start a new Travel mission.
*   **Verification:**
    *   **Write:** `semanticMemory` namespace contains entry with `content: "User strongly dislikes layovers"` (or similar agent-written text).
    *   **Search:** New mission's agent retrieves this memory via semantic search.
    *   **Structure:** Memory matches schema (Section 8.4.1): `content`, `context`, `validAt`, `strength`, `confidence`, `privacyTier`.

#### **Test Case 6.2: Episodic Memory & Few-Shot Retrieval**
*   **Context:** Section 8.4.2 (Episodic Memory Structure).
*   **Action:**
    1.  Complete a Shopping mission that results in a return (negative outcome).
    2.  Start a similar Shopping mission.
*   **Verification:**
    *   **Episode Stored:** `episodicMemory` contains record with `situation`, `reasoning`, `action`, `outcome`, `userFeedback`.
    *   **Few-Shot:** New mission retrieves the episode as context (check agent prompt or trace).
    *   **Tags:** Episode has searchable tags like `["shopping", "negative_outcome", "return"]`.

#### **Test Case 6.3: Procedural Rules Injection**
*   **Context:** Section 8.4.3 (Procedural Memory Structure).
*   **Action:**
    1.  Provide negative feedback on 3 "budget" recommendations.
    2.  Trigger Reflection Node (or wait for scheduled reflection).
    3.  Start a new Shopping mission.
*   **Verification:**
    *   **Rule Created:** `proceduralMemory` contains rule like `"Suggest mid-range options before budget options"`.
    *   **Derivation:** Rule has `derivedFrom` linking to the 3 episode IDs.
    *   **Injection:** New mission's agent system prompt includes this rule (check trace).

#### **Test Case 6.4: Entity Extraction & Lookup**
*   **Context:** Section 8.4.4 & 8.4.5 (Relational Memory).
*   **Action:**
    1.  Process emails mentioning "Sarah" multiple times in dining/social contexts.
    2.  Query "Who is Sarah?" via agent chat.
*   **Verification:**
    *   **Entity Stored:** `entities` namespace contains `{ name: "Sarah", type: "person", properties: { relationship: "friend" or similar } }`.
    *   **Relationships:** `relationships` namespace contains `{ fromEntity: "USER", toEntity: "sarah_id", type: "KNOWS" }`.
    *   **Lookup:** Agent retrieves Sarah's entity and associated memories.

#### **Test Case 6.5: Memory Decay & Strength**
*   **Context:** Section 8.4.1 (Strength & Decay).
*   **Action:**
    1.  Create a semantic memory.
    2.  Wait 30 days (or simulate time passage).
    3.  Access the memory in a mission.
    4.  Check memory strength before and after access.
*   **Verification:**
    *   **Decay:** Memory `strength` decreases over time when not accessed.
    *   **Reinforcement:** Accessing memory increases `strength` and updates `lastAccessed`.
    *   **Access Count:** `accessCount` increments on each retrieval.

#### **Test Case 6.6: Reflection Node Operation**
*   **Context:** Section 8.5 (Virtual Context Management).
*   **Action:**
    1.  Generate 100+ semantic memories (high volume).
    2.  Trigger Reflection Node.
*   **Verification:**
    *   **Compression:** Similar/redundant memories are merged.
    *   **Procedural Extraction:** Patterns across episodes become procedural rules.
    *   **Context Fit:** Synthesized context fits within LLM context window limits.

---

### **Phase 7: Privacy & BBS+ Attribution**
**Reference:** Section 7 (Publisher/Advertiser SDK & BBS+ Attribution Protocol)

#### **Test Case 7.1: Pseudonym Generation**
*   **Context:** Section 7.1 (BBS+ Pseudonyms).
*   **Action:**
    1.  User logs into a Publisher site via OwnYou SSO.
    2.  Inspect the pseudonym shared with the Publisher.
*   **Verification:**
    *   **Format:** Pseudonym is a valid BLS12-381 curve point (G1).
    *   **Determinism:** Same user + same Publisher = same pseudonym (across sessions).
    *   **Unlinkability:** Different Publishers receive different pseudonyms (cannot correlate).

#### **Test Case 7.2: Tracking ID Determinism**
*   **Context:** Section 7.1.4 (Tracking ID Generation).
*   **Action:**
    1.  User accepts tracking consent for "Campaign A".
    2.  User sees Campaign A ad on Publisher X → tracking_ID generated.
    3.  User sees Campaign A ad on Publisher Y → tracking_ID generated.
*   **Verification:**
    *   **Same ID:** Both tracking_IDs are identical (deterministic derivation).
    *   **Formula:** `tracking_ID = hash_to_curve_g1(campaign_ID) * nym_secret`.

#### **Test Case 7.3: Cross-Campaign Unlinkability**
*   **Context:** Section 7.1.2 (Privacy Properties).
*   **Action:**
    1.  User accepts tracking for Campaign A and Campaign B.
    2.  Extract tracking_ID for each campaign.
*   **Verification:**
    *   **Different IDs:** tracking_ID_A ≠ tracking_ID_B.
    *   **Math:** Without `nym_secret`, cannot prove both IDs belong to same user.
    *   **Collusion Resistant:** Even if Advertiser A and B share data, they cannot link the user.

#### **Test Case 7.4: Consent Flow (Accept/Decline)**
*   **Context:** Section 7.1 Phase 2 (Tracking Consent).
*   **Action (Accept):**
    1.  Ad appears with tracking request.
    2.  User clicks "Accept" in wallet prompt.
*   **Action (Decline):**
    1.  Ad appears with tracking request.
    2.  User clicks "Decline" in wallet prompt.
*   **Verification:**
    *   **Accept:** tracking_ID is generated and shared; user receives payment per impression.
    *   **Decline:** No tracking_ID generated; ad still displays; no payment.
    *   **Store:** `trackingConsents` namespace records user's decision.

#### **Test Case 7.5: Escrow & Payment Flow**
*   **Context:** Section 7.1 Phase 3 & 5 (Escrow Deposit & Payment).
*   **Action:**
    1.  Advertiser deposits $100 budget for campaign (escrow).
    2.  User sees 5 impressions of the campaign ad ($0.02 each).
*   **Verification:**
    *   **Escrow:** Smart contract holds campaign budget.
    *   **Per-Impression:** User's wallet receives $0.10 (5 × $0.02).
    *   **Balance:** Escrow balance decreases by $0.10.
    *   **Wallet UI:** User's earnings display updates correctly.

#### **Test Case 7.6: Conversion Attribution**
*   **Context:** Section 7.1 Phase 6 (Conversion & Attribution).
*   **Action:**
    1.  User sees campaign ads (tracking enabled).
    2.  User visits advertiser's site and completes purchase.
    3.  User accepts "Claim attribution reward" prompt.
*   **Verification:**
    *   **Same tracking_ID:** Conversion uses same ID as impressions.
    *   **ZKP:** Proof of tracking_ID ownership is valid.
    *   **Bonus:** Conversion bonus released from escrow to user.

#### **Test Case 7.7: Selective Disclosure**
*   **Context:** Section 7.2 (IAB Profile Sharing).
*   **Action:**
    1.  User has IAB profile with 20 categories.
    2.  Publisher requests IAB segments.
    3.  User selects only 5 categories to share.
*   **Verification:**
    *   **Selective:** Only chosen 5 categories sent to Publisher.
    *   **BBS+ Proof:** ZKP proves categories are authentic without revealing others.
    *   **UI:** Consent screen shows clear category selection.

---

### **Phase 8: Consumer UI**
**Reference:** Section 4 (Consumer UI Implementation)

#### **Test Case 8.1: Mission Feed Rendering**
*   **Context:** Section 4.1 (Mission Feed).
*   **Action:** Navigate to Home screen with 10+ missions in various states.
*   **Verification:**
    *   **Cards:** Each mission renders as a card with title, category icon, status badge.
    *   **Sorting:** Cards sorted by `totalScore` (well-being ranking).
    *   **States:** Visual distinction between CREATED, IN_PROGRESS, COMPLETED, DISMISSED.
    *   **Heart:** Each card shows heart icon in correct state (grey/red/large red).

#### **Test Case 8.2: Mission Card Interaction**
*   **Context:** Section 4.1 (Mission Card UX).
*   **Action:**
    1.  Tap on a Mission Card.
    2.  Interact with the mission detail view.
    3.  Complete or dismiss the mission.
*   **Verification:**
    *   **Navigation:** Tap opens detail view with full mission content.
    *   **Actions:** Can complete, dismiss, or engage with mission.
    *   **State Update:** Card in feed reflects new state after action.

#### **Test Case 8.3: Profile Page (Ikigai Wheel)**
*   **Context:** Section 4.2 (Profile).
*   **Action:** Navigate to Profile screen.
*   **Verification:**
    *   **Ikigai Wheel:** Displays 4 dimensions (Experiences, Relationships, Interests, Giving).
    *   **Weights:** Each dimension size reflects `dimensionWeights` from `ikigai_profile`.
    *   **Drill-Down:** Tapping a dimension shows supporting evidence.

#### **Test Case 8.4: Profile Page (IAB Categories)**
*   **Context:** Section 4.2 (Profile).
*   **Action:** Navigate to Profile → IAB Categories section.
*   **Verification:**
    *   **Categories:** Displays top IAB categories with confidence scores.
    *   **Tiers:** Categories grouped by tier (1, 2, 3).
    *   **Edit:** User can toggle categories on/off for sharing.

#### **Test Case 8.5: Settings Page**
*   **Context:** Section 4.3 (Settings).
*   **Action:** Navigate to Settings screen.
*   **Verification:**
    *   **Data Sources:** Shows connected sources (Gmail, Calendar, etc.) with status.
    *   **Privacy:** Contains consent toggles, data export option.
    *   **LLM Settings:** Model selection, budget threshold visible.
    *   **Debug:** Link to Debug Panel (agent traces, sync logs).

#### **Test Case 8.6: Wallet & Earnings Display**
*   **Context:** Section 4.4 (Wallet).
*   **Action:** Navigate to Wallet screen.
*   **Verification:**
    *   **Balance:** Shows current USDC/token balance.
    *   **Earnings History:** Lists per-campaign earnings.
    *   **Withdrawal:** Option to withdraw to external wallet.
    *   **Pseudonym:** Shows current Publisher pseudonym (masked).

#### **Test Case 8.7: Device Pairing Flow**
*   **Context:** Section 5.2.3 (Device Pairing).
*   **Action:**
    1.  On Device A (existing): Go to Settings → Devices → Add Device.
    2.  On Device B (new): Install app, select "Pair with existing device".
    3.  Scan QR code or enter pairing code.
*   **Verification:**
    *   **Key Exchange:** Wallet-derived encryption key shared securely.
    *   **Sync Start:** Device B begins syncing data from OrbitDB.
    *   **Device List:** Both devices appear in Settings → Devices on both.

#### **Test Case 8.8: Responsive Layout**
*   **Context:** Section 4.5 (Responsive Design).
*   **Action:** View app on mobile (375px), tablet (768px), and desktop (1280px).
*   **Verification:**
    *   **Mobile:** Single column, bottom navigation.
    *   **Tablet:** Two-column feed, side navigation.
    *   **Desktop:** Three-column layout with persistent sidebars.

---

### **Phase 9: Security & Encryption**
**Reference:** Section 5.3 (Encryption Policy) & Section 7.1.3 (Attack Surface)

#### **Test Case 9.1: Wallet-Derived Encryption Keys**
*   **Context:** Section 5.3 (Encryption Policy).
*   **Action:**
    1.  Create new account (wallet generation).
    2.  Inspect encryption key derivation.
*   **Verification:**
    *   **Derivation:** Encryption key derived from wallet seed using BIP-32/BIP-39.
    *   **No External Storage:** Key never sent to any server.
    *   **Recovery:** Same seed phrase on new device recovers same encryption key.

#### **Test Case 9.2: Data-at-Rest Encryption**
*   **Context:** Section 5.3 (Encryption Policy).
*   **Action:**
    1.  Store sensitive data (emails, IAB profile).
    2.  Directly inspect IndexedDB/SQLite storage.
*   **Verification:**
    *   **Encrypted:** Raw storage contains ciphertext, not plaintext.
    *   **Namespaces:** All private/sensitive tier namespaces are encrypted.
    *   **Decryption:** Only accessible through authenticated app with wallet.

#### **Test Case 9.3: Sync Encryption (E2E)**
*   **Context:** Section 5.2 (OrbitDB Sync).
*   **Action:**
    1.  Pair two devices.
    2.  Create data on Device A.
    3.  Intercept OrbitDB/IPFS traffic (network inspection).
*   **Verification:**
    *   **E2E:** Synced data is encrypted; IPFS peers see only ciphertext.
    *   **Key:** Only paired devices (with shared key) can decrypt.

#### **Test Case 9.4: nym_secret Protection**
*   **Context:** Section 7.1.3 (Attack Surface Analysis).
*   **Action:** Attempt to extract `nym_secret` from:
    1.  Browser localStorage/IndexedDB.
    2.  Network traffic during SSO.
    3.  Memory dump of running app.
*   **Verification:**
    *   **Storage:** `nym_secret` encrypted at rest with wallet key.
    *   **Network:** Never transmitted (only ZKPs transmitted).
    *   **Memory:** Cleared after use (best-effort for browser environment).

---

### **Summary of v13 Compliance Checks**

| Area | v13 Requirement | Test Case(s) |
|------|-----------------|--------------|
| **Namespaces** | Using `iabClassifications`, `ikigai_profile`, `mission_state`, `semanticMemory`, `episodicMemory`, `proceduralMemory` | 2.1, 6.1-6.6 |
| **Privacy Tiers** | `enforcePrivacyTier` active for namespace access | 2.2 |
| **Sync** | OrbitDB v3 with Helia (not IPFS-JS) | 1.1, 1.2 |
| **CRDTs** | Correct CRDT type per namespace (OR-Set vs LWW) | 1.2 |
| **4-Mode Triggers** | Data-driven, Scheduled, Event-driven, User-driven | 3.1-3.4 |
| **Agent Permissions** | Tool access per AGENT_PERMISSIONS matrix | 3.5 |
| **Feedback** | Heart multi-state (Meh/Like/Love) | 4.1, 4.2 |
| **Memory Architecture** | Semantic, Episodic, Procedural, Relational memory types | 6.1-6.6 |
| **BBS+ Pseudonyms** | Deterministic, unlinkable across Publishers | 7.1-7.3 |
| **Tracking Consent** | User-controlled accept/decline | 7.4 |
| **Escrow Payments** | Per-impression payment from escrow | 7.5, 7.6 |
| **Selective Disclosure** | ZKP for partial IAB profile sharing | 7.7 |
| **Observability** | Agent traces, sync logs, cost dashboard | 5.1, 5.3, 5.4 |
| **GDPR** | Data export capability | 5.5 |
| **Encryption** | Wallet-derived keys, E2E sync, data-at-rest | 9.1-9.4 |

---

### **Test Case Index**

| Phase | Test Cases | Total |
|-------|------------|-------|
| **Phase 1:** Foundation (Data Ingestion) | 1.1, 1.2 | 2 |
| **Phase 2:** Intelligence Layers | 2.1, 2.2 | 2 |
| **Phase 3:** Mission Execution | 3.1, 3.2, 3.3, 3.4, 3.5 | 5 |
| **Phase 4:** Feedback & Learning | 4.1, 4.2 | 2 |
| **Phase 5:** Resilience & Observability | 5.1, 5.2, 5.3, 5.4, 5.5 | 5 |
| **Phase 6:** Memory Architecture | 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 | 6 |
| **Phase 7:** Privacy & BBS+ Attribution | 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7 | 7 |
| **Phase 8:** Consumer UI | 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8 | 8 |
| **Phase 9:** Security & Encryption | 9.1, 9.2, 9.3, 9.4 | 4 |
| **TOTAL** | | **41** |

---

### **Priority Matrix**

| Priority | Phase | Rationale |
|----------|-------|-----------|
| **P0 (Critical)** | Phase 1, 9 | Foundation & Security - system won't work without these |
| **P1 (High)** | Phase 2, 3, 7 | Core functionality - IAB, Missions, BBS+ (revenue model) |
| **P2 (Medium)** | Phase 4, 5, 6 | Learning loop, resilience, memory - enhances UX |
| **P3 (Lower)** | Phase 8 | UI polish - can iterate after core works |

---

### **Automation Recommendations**

| Test Type | Tool | Test Cases |
|-----------|------|------------|
| **Unit Tests** | Vitest | 6.1-6.6 (Memory), 7.2-7.3 (Crypto math) |
| **Integration Tests** | Vitest + MSW | 2.1, 3.1-3.5, 5.1-5.2 |
| **E2E Tests** | Playwright | 4.1-4.2, 8.1-8.8 |
| **Multi-Device Tests** | Playwright + 2 browsers | 1.2, 5.4, 8.7, 9.3 |
| **Security Tests** | Manual + OWASP ZAP | 9.1-9.4, 7.4 |
| **Crypto Tests** | Jest + BLS12-381 lib | 7.1-7.3, 7.6-7.7 |
