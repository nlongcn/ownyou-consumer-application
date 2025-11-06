# Architectural Decisions

**Critical architectural decisions that affect ALL code. Violating these causes rework.**

Last Updated: 2025-01-04

---

## Overview

This document details the 6 critical architectural decisions for the OwnYou Consumer Application. These decisions were made after extensive research and brainstorming (see `docs/plans/mission_agents_architecture.md` and `docs/plans/end-to-end-architecture.md`). Every feature implementation must comply with these decisions.

**When to read this:** Before implementing ANY feature or making significant code changes.

---

## Decision 1: LangGraph Store = Single Source of Truth

### The Decision

**All memory operations MUST use LangGraph Store as the single source of truth.** No separate databases, no parallel memory systems, no local caches that drift out of sync.

### Why This Matters

- **Data consistency**: One source of truth prevents contradictory information across systems
- **Simplified architecture**: No complex synchronization logic between databases
- **Shared context**: IAB Agents and Mission Agents read/write the same memory
- **Scalability**: Store designed for distributed access patterns
- **Evolution path**: Can migrate backend (InMemoryStore → PostgreSQL) without changing code

### What This Means for Your Code

```python
# ✅ CORRECT: Use Store for all memory operations
from src.mission_agents.memory.store import MissionStore

store = MissionStore(config)
store.put_iab_classification(user_id, taxonomy_id, classification)
profile = store.get_iab_classification(user_id, taxonomy_id)

# ❌ WRONG: Don't create separate database tables
import sqlite3
conn = sqlite3.connect("my_separate_db.db")  # NO!

# ❌ WRONG: Don't cache in local dictionaries
user_cache = {}  # This will drift out of sync
user_cache[user_id] = classification  # NO!
```

### Store Schema Structure

All Store operations use hierarchical namespaces:

```python
# IAB Classifications
namespace = ("ownyou.iab_classifications", user_id)

# User Preferences
namespace = ("ownyou.user_preferences", user_id)

# Ikigai Profile
namespace = ("ownyou.ikigai_profile", user_id)

# Shopping List
namespace = ("ownyou.shopping_list", user_id)

# Mission Learnings (cross-user patterns)
namespace = ("ownyou.mission_learnings", mission_type)
```

**Complete schema:** See `src/mission_agents/memory/store_schema.md`

### Backward Compatibility

During transition period, the existing IAB workflow writes to BOTH SQLite and Store:

```python
# src/email_parser/workflow/nodes/update_memory.py
def update_memory_node(state: AgentState, store: Optional[MissionStore] = None):
    # Write to existing SQLite (backward compatibility)
    memory_manager.update_classifications(state["all_classifications"])

    # ALSO write to Store (new system)
    if store:
        for classification in state["all_classifications"]:
            store.put_iab_classification(user_id, taxonomy_id, classification)
```

Once Mission Agents are fully integrated, SQLite writes can be removed.

### Integration Points

- **IAB Agents** → Write classifications to Store
- **Mission Agents** → Read classifications from Store, write mission state
- **Dashboard API** → Read from Store for profile display
- **External Systems** → All access via Store wrapper (never direct access)

---

## Decision 2: IAB Classifications Trigger Mission Agents

### The Decision

**Mission Agents are triggered by Store updates, specifically IAB classification changes.** When IAB confidence scores change or new taxonomies are added, Mission Agents evaluate whether to create missions.

### Why This Matters

- **Reactive system**: Missions automatically created when user behavior changes
- **Evidence-based**: Missions backed by classification confidence scores
- **Decoupled agents**: IAB and Mission systems don't know about each other directly
- **Scalability**: Add new mission types without changing IAB system

### How It Works

```
IAB Agent processes emails
    ↓
Writes classifications to Store
    ↓
Store emits change event
    ↓
Mission Orchestrator receives event
    ↓
Routes to appropriate Mission Agent
    ↓
Agent evaluates: Should I create a mission?
    ↓
If yes: Generate MissionCard
```

### Trigger Types

```python
class TriggerType(str, Enum):
    IAB_PROFILE_CHANGE = "iab_profile_change"          # NEW: IAB taxonomy added/updated
    MISSION_PROFILE_CHANGE = "mission_profile_change"  # User preferences changed
    EPISODIC_EVENT = "episodic_event"                  # Purchase made, event scheduled
    USER_REQUEST = "user_request"                      # User explicitly asked
    SCHEDULED_CHECK = "scheduled_check"                # Cron job periodic check
    EXTERNAL_API = "external_api"                      # Price drop alert, etc.
```

### Implementation Pattern

```python
# Mission Agent evaluating IAB trigger
def evaluate_shopping_mission(trigger_event: TriggerEvent, store: MissionStore) -> Optional[MissionCard]:
    """
    Evaluate if IAB classification change should create shopping mission
    """
    if trigger_event.type != TriggerType.IAB_PROFILE_CHANGE:
        return None

    # Check if relevant IAB taxonomy
    taxonomy_id = trigger_event.details["taxonomy_id"]
    if not taxonomy_id.startswith("IAB18"):  # IAB18 = Style & Fashion
        return None

    # Check confidence threshold
    confidence = trigger_event.details["confidence"]
    if confidence < 0.75:
        return None  # Not confident enough

    # Check user preferences
    preferences = store.get_user_preferences(trigger_event.user_id)
    if preferences.get("disable_shopping_missions"):
        return None

    # Create mission
    return MissionCard(
        trigger_type=TriggerType.IAB_PROFILE_CHANGE,
        trigger_details={
            "taxonomy_id": taxonomy_id,
            "confidence": confidence,
            "change_type": "new_classification"
        },
        # ... rest of card data
    )
```

### Mission Card Provenance

Every mission card tracks what triggered it:

```python
card = MissionCard(
    mission_id="mission_shopping_001",
    trigger_type=TriggerType.IAB_PROFILE_CHANGE,
    trigger_details={
        "taxonomy_id": "IAB18-1",  # Fashion
        "confidence": 0.85,
        "change_type": "confidence_increased",
        "previous_confidence": 0.65
    },
    memory_context={
        "iab_classifications": ["IAB18-1", "IAB18-3"],
        "shopping_list": ["trainers", "running shoes"],
        "recent_emails": ["nike_email_001", "adidas_email_002"]
    }
)
```

### Testing Pattern

```python
def test_iab_trigger_creates_shopping_mission():
    """Test IAB classification triggers shopping mission"""
    store = MissionStore(config)

    # Write IAB classification
    store.put_iab_classification("user_123", "IAB18-1", {
        "confidence": 0.85,
        "evidence": ["email_001"]
    })

    # Trigger should fire
    trigger = TriggerEvent(
        type=TriggerType.IAB_PROFILE_CHANGE,
        user_id="user_123",
        details={"taxonomy_id": "IAB18-1", "confidence": 0.85}
    )

    # Mission Agent evaluates
    card = shopping_agent.evaluate(trigger, store)

    assert card is not None
    assert card.trigger_type == TriggerType.IAB_PROFILE_CHANGE
```

---

## Decision 3: Horizontal Layer Development

### The Decision

**Build each horizontal layer COMPLETELY across all features before moving to next layer.** No vertical slicing (building one complete feature end-to-end). No partial implementations.

### Why This Matters

- **Prevents rework**: Define all contracts upfront, implement once
- **Parallel development**: Teams work on different layers simultaneously
- **Clean interfaces**: Each layer has stable API for next layer
- **Testability**: Complete layers can be tested independently
- **Evolution**: Can replace implementation of layer without affecting others

### Phase Structure

```
Phase 1: Foundation & Contracts
├─ ALL data models (all card types)
├─ ALL Store namespaces (all agents)
├─ ALL API contracts (all endpoints)
└─ Complete authentication system

Phase 2: Data Layer
├─ ALL data source connectors (email, calendar, financial, photos, health, social, browsing)
├─ ALL IAB classification for all sources
└─ ALL Store writers

Phase 3: Agent Layer
├─ ALL mission agents (shopping, restaurant, travel, events, bill, health, cooking, content)
├─ ALL triggers (memory, schedule, user, external)
└─ Complete orchestrator

Phase 4: API Layer
├─ ALL REST endpoints (missions, feedback, wallet, notifications, connections, settings)
├─ Mission persistence
└─ Feedback processing

Phase 5: UI Layer
├─ ALL app screens
├─ ALL card components
└─ Complete navigation

Phase 6: SSO Integration
Phase 7: Production Polish
```

### What This Means for Your Code

```python
# ✅ CORRECT: Phase 1 defines ALL card types upfront
class MissionCard(BaseModel):
    card_type: str  # "savings_shopping", "ikigai_travel", "savings_utility", "ikigai_event", ...
    card_data: Dict[str, Any]  # Polymorphic - different per type

CARD_TYPE_SCHEMAS = {
    "savings_shopping": SavingsShoppingCardData,
    "ikigai_travel": IkigaiTravelCardData,
    "savings_utility": SavingsUtilityCardData,
    "ikigai_event": IkigaiEventCardData,
    # ALL types defined NOW (even if agents built later)
}

# ❌ WRONG: Adding card types incrementally in each phase
# Phase 2: Add shopping card
# Phase 3: Add travel card
# Phase 4: Add event card
# This causes API changes and frontend rework!
```

### Integration Example

```python
# Phase 1: Define contract
class ShoppingAgent(BaseAgent):
    """Contract defined before implementation"""
    def evaluate(self, trigger: TriggerEvent, store: MissionStore) -> Optional[MissionCard]:
        ...

# Phase 2: Data layer writes to Store (doesn't know about agents)
store.put_shopping_list(user_id, ["trainers", "laptop"])

# Phase 3: Agent reads from Store (doesn't know about data sources)
shopping_list = store.get_shopping_list(user_id)
```

**See Strategic Roadmap:** `docs/plans/2025-01-04-ownyou-strategic-roadmap.md`

---

## Decision 4: Multi-Source IAB Classification

### The Decision

**The IAB Classification workflow MUST support ANY data source, not just emails.** Calendar events, financial transactions, photos, browsing history - all classified using same workflow.

### Why This Matters

- **Reusability**: Don't rebuild classification logic for each source
- **Consistency**: Same taxonomy mapping across all sources
- **Evidence aggregation**: Confidence scores combine multi-source evidence
- **Scalability**: Add new sources without workflow changes

### Architecture

```
Data Source Connectors (Phase 2)
├─ EmailConnector → emails
├─ CalendarConnector → events
├─ FinancialConnector → transactions
├─ PhotosConnector → images
├─ BrowsingConnector → URLs
└─ ... (all sources)
        ↓
    [Preprocessor] (normalize to common format)
        ↓
    [IAB Classification Workflow] (universal, source-agnostic)
        ↓
    [LangGraph Store] (with source provenance)
```

### Common Data Format

All sources preprocess to `ClassifiableItem`:

```python
class ClassifiableItem(BaseModel):
    """Universal format for IAB classification"""
    item_id: str
    user_id: str
    source_type: Literal["email", "calendar", "financial", "photo", "browsing", "social"]
    content: str  # Text representation
    metadata: Dict[str, Any]  # Source-specific fields
    timestamp: datetime

# Email Example
item = ClassifiableItem(
    item_id="email_001",
    source_type="email",
    content="Subject: Your Spotify Premium subscription\nBody: ...",
    metadata={"sender": "spotify@email.com", "subject": "..."}
)

# Calendar Example
item = ClassifiableItem(
    item_id="cal_event_001",
    source_type="calendar",
    content="Event: Team standup meeting\nLocation: Zoom\nAttendees: ...",
    metadata={"event_type": "meeting", "duration_minutes": 30}
)

# Financial Example
item = ClassifiableItem(
    item_id="txn_001",
    source_type="financial",
    content="Transaction: £45.99 at Tesco, category: Groceries",
    metadata={"amount": 45.99, "merchant": "Tesco", "category": "groceries"}
)
```

### Workflow Integration

```python
# src/data_sources/iab_classifier.py
class UniversalIABClassifier:
    """Classifies ANY data source using IAB taxonomy"""

    def classify_items(
        self,
        items: List[ClassifiableItem],
        store: MissionStore
    ) -> List[Classification]:
        """
        Same workflow for all sources:
        1. Batch items (10-20 per LLM call)
        2. Agent classification
        3. Evidence validation
        4. Store update with source provenance
        """
        # Use existing LangGraph workflow
        graph = create_classification_graph(store=store)

        # Convert items to workflow state
        state = AgentState(
            user_id=items[0].user_id,
            emails=[],  # Generalized beyond emails
            classifiable_items=items  # NEW: Universal items
        )

        # Run workflow (source-agnostic)
        result = graph.invoke(state)

        return result["all_classifications"]
```

### Source-Specific Evidence

Classifications track source provenance:

```python
classification = {
    "taxonomy_id": "IAB18-1",  # Fashion
    "confidence": 0.87,
    "evidence": [
        {"source": "email", "item_id": "email_001", "weight": 0.3},
        {"source": "browsing", "item_id": "url_045", "weight": 0.25},
        {"source": "financial", "item_id": "txn_023", "weight": 0.32}
    ],
    "last_updated": "2025-01-04T10:00:00Z"
}
```

Multi-source evidence increases confidence more than single-source.

---

## Decision 5: Self-Sovereign Authentication

### The Decision

**Authentication MUST be wallet-based (self-sovereign identity), NOT email/password.** Users control their identity via cryptographic wallet, not centralized account system.

### Why This Matters

- **User control**: Users own their identity, not the platform
- **Privacy**: No email addresses, no personal info in auth system
- **Interoperability**: Same wallet across multiple services
- **Decentralized**: No central auth server that can be compromised
- **Future-proof**: Compatible with BBS+ pseudonymous IDs (Phase 6)

### Architecture

```
User Wallet (MetaMask, WalletConnect, etc.)
    ↓
Sign challenge message
    ↓
Backend verifies signature
    ↓
Issue JWT session token
    ↓
Store associates data with wallet address
```

### Implementation Requirements

**Use Skill:** `decentralized-consumer-app-authentication`

This skill provides complete implementation guidance including:
- Wallet provider selection (MetaMask, WalletConnect, Privy)
- Challenge-response authentication flow
- JWT token generation and validation
- Session management
- Multi-wallet support
- Account recovery patterns

### Code Pattern

```python
# Authentication endpoint
@app.post("/api/auth/challenge")
async def request_challenge(wallet_address: str):
    """Generate challenge for wallet to sign"""
    challenge = generate_nonce()
    store_challenge(wallet_address, challenge, expiry=300)  # 5 min
    return {"challenge": challenge}

@app.post("/api/auth/verify")
async def verify_signature(wallet_address: str, signature: str):
    """Verify signature and issue JWT"""
    challenge = get_challenge(wallet_address)

    # Verify cryptographic signature
    if not verify_wallet_signature(wallet_address, challenge, signature):
        raise HTTPException(401, "Invalid signature")

    # Issue JWT
    token = create_jwt({"wallet_address": wallet_address})
    return {"access_token": token}

# Protected endpoint
@app.get("/api/profile/{user_id}")
async def get_profile(user_id: str, token: str = Depends(verify_jwt)):
    """Access control via JWT"""
    if token["wallet_address"] != user_id:
        raise HTTPException(403, "Forbidden")

    return store.get_profile(user_id)
```

### User ID Format

**User IDs = Wallet addresses** (no separate account IDs):

```python
# ✅ CORRECT: Use wallet address as user_id
user_id = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
store.put_user_preferences(user_id, preferences)

# ❌ WRONG: Don't create separate account IDs
user_id = "user_12345"  # NO! This requires mapping table
```

### Privacy Considerations

- **No email**: Never ask for email address in auth flow
- **No personal info**: Only wallet address is identity
- **Pseudonymous**: Wallet address doesn't reveal real identity
- **Multiple wallets**: Users can have separate wallets for different contexts

**Full specification:** See `docs/Brainstorming/BBS+ Pseudonymous ID specification v1 (brainstorm copy).md`

---

## Decision 6: Privacy-First by Design

### The Decision

**No raw personal data sent to external APIs without encryption and explicit user consent.** All LLM calls must use redacted/anonymized data. All external API calls must be user-approved.

### Why This Matters

- **Regulatory compliance**: GDPR, CCPA require explicit consent
- **User trust**: Privacy violations destroy consumer applications
- **Security**: Minimize attack surface for data breaches
- **Decentralization**: Aligns with self-sovereign principles

### Privacy Architecture Layers

```
Layer 1: Local Processing
├─ Email summaries generated locally
├─ Store data encrypted at rest
└─ No raw email content leaves device

Layer 2: Redaction Before External Calls
├─ Remove PII before LLM classification
├─ Replace names/addresses with tokens
└─ Only taxonomies sent to external APIs

Layer 3: Selective Disclosure
├─ BBS+ pseudonyms for advertisers
├─ User chooses which taxonomies to share
└─ No linkage between pseudonyms and real identity

Layer 4: Encryption in Transit
├─ TLS for all API calls
├─ End-to-end encryption for stored data
└─ No plain text in logs
```

### PII Redaction Pattern

```python
# Before sending to external API
def redact_pii(email_content: str) -> str:
    """Remove personally identifiable information"""
    # Replace email addresses
    content = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', content)

    # Replace phone numbers
    content = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE]', content)

    # Replace names (requires NER model)
    content = replace_named_entities(content, entity_type="PERSON", replacement="[NAME]")

    # Replace addresses
    content = replace_named_entities(content, entity_type="ADDRESS", replacement="[ADDRESS]")

    return content

# Usage in IAB classification
def classify_email(email: Email, llm_client: LLMClient) -> List[Classification]:
    # Redact before sending to external LLM
    redacted_content = redact_pii(email.content)

    # Call external API with redacted content only
    response = llm_client.classify(redacted_content)

    return response
```

### Consent Management

```python
class ConsentManager:
    """Track user consent for data sharing"""

    def check_consent(self, user_id: str, data_type: str, purpose: str) -> bool:
        """Verify user has consented to data usage"""
        consent = store.get_user_consent(user_id)

        # Check explicit consent
        if data_type not in consent.get("approved_data_types", []):
            return False

        if purpose not in consent.get("approved_purposes", []):
            return False

        return True

    def request_consent(self, user_id: str, data_type: str, purpose: str):
        """Request new consent from user"""
        # Generate consent request notification
        notification = Notification(
            user_id=user_id,
            type="consent_request",
            title=f"Permission needed: {data_type}",
            message=f"We'd like to use your {data_type} for {purpose}",
            actions=["approve", "deny"]
        )

        # Store and wait for user response
        store.put_notification(user_id, notification)
```

### External API Guidelines

**Before adding ANY external API:**

1. **Check if PII is sent** - Review request payload
2. **Implement redaction** - Remove/replace PII fields
3. **Add consent check** - Verify user approved this API
4. **Document data flow** - What data goes where?
5. **Add privacy test** - Validate no PII leaks

```python
# ✅ CORRECT: Check consent before external API call
def search_products(user_id: str, query: str) -> List[Product]:
    # Verify consent
    if not consent_manager.check_consent(user_id, "shopping_list", "product_search"):
        raise ConsentRequiredError("User hasn't consented to product searches")

    # Redact PII from query
    safe_query = redact_pii(query)

    # Call external API
    return shopping_api.search(safe_query)

# ❌ WRONG: Direct external API call without checks
def search_products(query: str):
    return shopping_api.search(query)  # No consent check, no redaction!
```

### Testing Privacy

```python
def test_no_pii_in_external_calls(mocker):
    """Validate no PII sent to external APIs"""
    # Mock external API
    mock_api = mocker.patch("external_api.call")

    # Process email with PII
    email = Email(
        content="Hi John Smith, your appointment at 123 Main St is confirmed. Call 555-1234."
    )

    classify_email(email, llm_client)

    # Verify redaction
    call_args = mock_api.call_args[0][0]
    assert "[NAME]" in call_args
    assert "[ADDRESS]" in call_args
    assert "[PHONE]" in call_args
    assert "John Smith" not in call_args
    assert "123 Main St" not in call_args
    assert "555-1234" not in call_args
```

---

## Validation Checklist

Before considering ANY feature complete, verify compliance:

### Store Usage ✅
- [ ] All memory operations use MissionStore
- [ ] No separate databases created
- [ ] No local caches that drift
- [ ] Proper namespace used

### IAB Triggers ✅
- [ ] Mission agents triggered by Store updates
- [ ] Trigger type properly set
- [ ] Memory provenance tracked in card
- [ ] Evaluation logic checks confidence thresholds

### Horizontal Layers ✅
- [ ] Feature aligns with current phase
- [ ] Contracts defined before implementation
- [ ] No vertical slicing across layers
- [ ] Clean interfaces for next phase

### Multi-Source Support ✅
- [ ] Works with any data source type
- [ ] Uses `ClassifiableItem` format
- [ ] Source provenance tracked
- [ ] Evidence aggregation working

### Self-Sovereign Auth ✅
- [ ] Wallet-based authentication used
- [ ] No email/password auth
- [ ] User IDs are wallet addresses
- [ ] JWT tokens properly validated

### Privacy-First ✅
- [ ] PII redacted before external calls
- [ ] User consent checked
- [ ] No plain text in logs
- [ ] Privacy tests passing

---

## Related Documentation

- **Strategic Roadmap**: `docs/plans/2025-01-04-ownyou-strategic-roadmap.md`
- **Mission Agents Architecture**: `docs/plans/mission_agents_architecture.md`
- **End-to-End Architecture**: `docs/plans/end-to-end-architecture.md`
- **Integration Plan**: `docs/plans/2025-01-04-ownyou-consumer-app-integration.md`
- **Auth Skill**: `decentralized-consumer-app-authentication` (managed skill)
- **BBS+ Spec**: `docs/Brainstorming/BBS+ Pseudonymous ID specification v1 (brainstorm copy).md`

---

**Remember:** These decisions are architectural constraints, not suggestions. Violations require full system review and likely rework of dependent code.
