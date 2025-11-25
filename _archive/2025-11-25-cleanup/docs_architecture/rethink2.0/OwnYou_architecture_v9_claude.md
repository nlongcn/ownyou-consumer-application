# OwnYou System Architecture Specification (v9)

> **SUPERSEDED:** This document has been superseded by v10.
> See `/docs/architecture/OwnYou_architecture_v10.md` for the current architecture.
>
> Key changes in v10:
> - Token storage: Tauri Store plugin (simpler)
> - Agent Orchestrator: Moved to Python-side
> - LangGraph: Direct HTTP instead of MCP
> - Financial: Cloudflare Workers pass-through
> - "Advanced Agents" renamed to "Mission Agents"

**Status:** SUPERSEDED - See v10
**Date:** November 2025
**Changes from v8:** Addresses critical implementation gaps with concrete technical decisions

---

## 1. Executive Summary

**Core Value Proposition:** OwnYou enables users to leverage their personal data (Email, Financial, Browsing, Health) for rich, private AI experiences ("Missions") and monetise their anonymized profile via Publisher SSO, without ever sharing raw data with third parties.

**Key Architectural Changes from v8:**
- **OAuth Management:** Explicit solution for token refresh lifecycle
- **Python Sidecar:** Concrete IPC mechanism and lifecycle management
- **Memory System:** Temporal knowledge graph using Graphiti instead of raw SQLite
- **Agent Framework:** Pragmatic LangGraph usage with cost controls
- **Sync Strategy:** Simplified approach using IPFS + OrbitDB instead of Ceramic
- **MCP Integration:** Leverages existing MCP patterns for extensibility
- **Testing Strategy:** Comprehensive testing approach defined

---

## 2. System Architecture Overview

### 2.1 High-Level Containers

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Device (Desktop - Primary Node)          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Tauri Desktop App (Rust + React)              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────┐             │ │
│  │  │ Auth     │  │ Data     │  │ Agent       │             │ │
│  │  │ Manager  │  │ Ingestor │  │ Orchestrator│             │ │
│  │  └────┬─────┘  └────┬─────┘  └──────┬──────┘             │ │
│  │       │             │                │                     │ │
│  │  ┌────▼─────────────▼────────────────▼──────┐             │ │
│  │  │      Mission Memory (Graphiti + SQLite)  │             │ │
│  │  └──────────────────┬───────────────────────┘             │ │
│  │                     │                                      │ │
│  └─────────────────────┼──────────────────────────────────────┘ │
│                        │                                        │
│  ┌─────────────────────▼──────────────────────────────────────┐ │
│  │          Python Sidecar (HTTP Server)                       │ │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐    │ │
│  │  │ IAB Agents   │  │ Email Parser  │  │ Existing    │    │ │
│  │  │ (Classifier) │  │ (OAuth Mgmt)  │  │ Analyzers   │    │ │
│  │  └──────────────┘  └───────────────┘  └─────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │          LangGraph Runtime (Python via MCP)                 │ │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐    │ │
│  │  │ Simple       │  │ Coordinated   │  │ Complex     │    │ │
│  │  │ Missions     │  │ Missions      │  │ Missions    │    │ │
│  │  └──────────────┘  └───────────────┘  └─────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Browser Extension (Chrome/Safari - Sensor)          │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐          │
│  │ History      │  │ OAuth       │  │ Native       │          │
│  │ Capture      │  │ Helper      │  │ Messaging    │          │
│  └──────────────┘  └─────────────┘  └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            PWA / Mobile Web (SvelteKit - View Layer)            │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐          │
│  │ Mission      │  │ Profile     │  │ IndexedDB    │          │
│  │ Cards UI     │  │ Viewer      │  │ Cache        │          │
│  └──────────────┘  └─────────────┘  └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│           Decentralized Sync Layer (IPFS + OrbitDB)             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐          │
│  │ Profile      │  │ Mission     │  │ Conflict     │          │
│  │ Replication  │  │ Cards DB    │  │ Resolution   │          │
│  └──────────────┘  └─────────────┘  └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Identity & Monetization (Solana)                   │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐          │
│  │ BBS+         │  │ Publisher   │  │ Revenue      │          │
│  │ Identity     │  │ SSO         │  │ Payments     │          │
│  └──────────────┘  └─────────────┘  └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Component Architecture

### 3.1 Desktop Application (Tauri)

**Framework:** Tauri 2.0 (Rust backend, React frontend)

#### 3.1.1 Auth Manager (Rust)

**Purpose:** Centralized OAuth token management with automatic refresh

**Implementation:**
```rust
// Core OAuth manager handles all provider tokens
pub struct AuthManager {
    token_store: Arc<Mutex<TokenStore>>,
    refresh_scheduler: RefreshScheduler,
    encryption_key: SecretKey,
}

impl AuthManager {
    // Handles OAuth flow via embedded browser
    pub async fn initiate_oauth(&self, provider: Provider) -> Result<()>
    
    // Returns valid token, refreshing if needed
    pub async fn get_valid_token(&self, provider: Provider) -> Result<AccessToken>
    
    // Background task that refreshes before expiry
    async fn token_refresh_loop(&self)
}
```

**Key Design Decisions:**

1. **Embedded Browser for OAuth:**
   - Use Tauri's `window::WindowBuilder` with WebView for OAuth flows
   - Intercept redirect URLs via custom protocol handler (`ownyou://oauth/callback`)
   - Never expose tokens to Python sidecar directly

2. **Token Storage:**
   - Encrypted SQLite table using OS keychain-derived key
   - Schema:
     ```sql
     CREATE TABLE oauth_tokens (
         provider TEXT PRIMARY KEY,
         access_token TEXT NOT NULL,
         refresh_token TEXT NOT NULL,
         expires_at INTEGER NOT NULL,
         scope TEXT NOT NULL,
         encrypted_at INTEGER NOT NULL
     );
     ```

3. **Refresh Strategy:**
   - Background task checks all tokens every 5 minutes
   - Refreshes any token expiring within 10 minutes
   - On refresh failure: notifies UI, prompts re-auth
   - Logs all refresh events for debugging

4. **Python Sidecar Integration:**
   - Rust provides HTTP endpoint `/auth/token/{provider}` (localhost only)
   - Python requests short-lived tokens (1-hour max)
   - Rust validates Python's identity via shared secret

**Why This Approach:**
- Solves the OAuth refresh problem you encountered with Electron
- Keeps sensitive tokens in memory-safe Rust
- Python sidecar never stores tokens permanently
- OS-level security (keychain integration)

#### 3.1.2 Data Ingestor (Rust)

**Purpose:** Coordinate data collection from all sources

**Architecture:**
```rust
pub struct DataIngestor {
    email_client: EmailClient,      // Delegates to Python sidecar
    plaid_client: PlaidClient,      // Direct Rust implementation
    browser_listener: NativeMessagingHost,
    memory: Arc<MissionMemory>,
}

impl DataIngestor {
    // Email ingestion via Python sidecar
    pub async fn ingest_emails(&self, since: DateTime) -> Result<Vec<RawEmail>>
    
    // Browser history from extension
    pub async fn ingest_browsing(&self, events: Vec<BrowsingEvent>) -> Result<()>
    
    // Financial data via Plaid
    pub async fn ingest_transactions(&self, account_id: String) -> Result<Vec<Transaction>>
}
```

**Email Ingestion Flow:**
1. Rust gets valid OAuth token from AuthManager
2. Rust calls Python sidecar HTTP API: `POST /email/fetch` with token
3. Python uses existing `email_parser` code to fetch/parse
4. Python returns structured `ProcessedEmail[]` JSON
5. Rust writes to Mission Memory

**Browser History Flow:**
1. Extension sends batch via Native Messaging (JSON over stdio)
2. Rust validates extension signature
3. PII redaction in Rust (using regex + NLP if needed)
4. Write to Mission Memory as `BrowsingEvent`

**Financial Data Flow:**
1. User completes Plaid Link in Tauri WebView
2. Rust stores encrypted access token (scoped to transactions only)
3. Periodic polling (configurable, default: daily)
4. Local token encryption (no Chainlink - over-engineered)
5. Rust implementation using `plaid-rust` crate

**Why This Approach:**
- Keeps data pipeline in type-safe Rust
- Delegates complex parsing to Python where it already exists
- No raw tokens exposed to sidecar
- Simple polling model (no complex event streaming)

#### 3.1.3 Agent Orchestrator (Rust)

**Purpose:** Schedule and coordinate all agent execution

**Implementation:**
```rust
pub struct AgentOrchestrator {
    trigger_engine: TriggerEngine,
    iab_agent_client: IABAgentClient,      // HTTP to Python sidecar
    mission_agent_client: MissionAgentClient, // MCP to LangGraph
    cost_tracker: CostTracker,
    memory: Arc<MissionMemory>,
}

pub struct TriggerEngine {
    // Cron-based scheduler
    scheduler: JobScheduler,
    // Memory-based triggers (profile changes)
    memory_watcher: MemoryWatcher,
    // External webhooks (price alerts, etc.)
    webhook_server: WebhookServer,
}

impl AgentOrchestrator {
    // Execute IAB classification on new content
    pub async fn run_iab_classification(&self, content: Vec<Content>) -> Result<()>
    
    // Execute mission agent
    pub async fn run_mission(&self, mission_type: MissionType, context: Context) -> Result<MissionCard>
    
    // Cost enforcement before LLM calls
    async fn check_cost_limit(&self, agent_id: &str) -> Result<bool>
}
```

**Trigger Examples:**

| Trigger Type | Example | Implementation |
|--------------|---------|----------------|
| Memory | New IAB interest detected | `MemoryWatcher` polls Graphiti for profile changes every 30s |
| Schedule | Weekly budget review | Cron: `0 9 * * MON` |
| External | Price drop on tracked item | Webhook from price monitoring service |
| User | Manual "Find me restaurants" | React UI calls Tauri command |

**Cost Management:**
```rust
pub struct CostTracker {
    daily_budget: Money,           // e.g., $5/day
    spent_today: AtomicMoney,
    cost_per_agent: HashMap<AgentId, Money>,
}

impl CostTracker {
    // Returns false if budget exceeded
    pub fn can_run_agent(&self, agent_id: &str, estimated_cost: Money) -> bool
    
    // Log actual cost after execution
    pub fn record_cost(&self, agent_id: &str, actual_cost: Money)
    
    // UI endpoint to show spend
    pub fn get_daily_report(&self) -> CostReport
}
```

**Why This Approach:**
- Explicit cost controls prevent runaway LLM spend
- Centralized scheduling for predictable resource usage
- Clear separation: IAB agents for passive classification, Mission agents for active utility

---

### 3.2 Python Sidecar

**Purpose:** Reuse existing email_parser codebase without rewriting in Rust

#### 3.2.1 Architecture

**Framework:** FastAPI (lightweight HTTP server)

**Entry Point:**
```python
# sidecar/main.py
from fastapi import FastAPI, HTTPException
from fastapi.security import HTTPBearer
import uvicorn
from email_parser.consumer_intelligence_system import ConsumerIntelligenceSystem
from iab_classifier import IABClassifier

app = FastAPI()
security = HTTPBearer()

# Shared secret from Rust (passed as env var)
SIDECAR_SECRET = os.getenv("OWNYOU_SIDECAR_SECRET")

# Initialize systems at startup
@app.on_event("startup")
async def startup():
    app.state.consumer_intel = ConsumerIntelligenceSystem(...)
    app.state.iab_classifier = IABClassifier(...)

@app.post("/email/fetch")
async def fetch_emails(request: EmailFetchRequest, token: str = Depends(security)):
    validate_token(token)  # Validates shared secret
    # Use existing email_parser code
    emails = await app.state.consumer_intel.download_emails(
        provider=request.provider,
        access_token=request.access_token,  # Short-lived from Rust
        max_emails=request.max_emails
    )
    return emails

@app.post("/classify/iab")
async def classify_content(request: ClassifyRequest, token: str = Depends(security)):
    validate_token(token)
    results = await app.state.iab_classifier.classify(request.content)
    return results

@app.get("/health")
async def health():
    return {"status": "healthy"}
```

**Lifecycle Management (Rust):**
```rust
pub struct SidecarManager {
    process: Option<Child>,
    port: u16,
    secret: String,
}

impl SidecarManager {
    pub async fn start(&mut self) -> Result<()> {
        // 1. Generate shared secret
        self.secret = generate_secret();
        
        // 2. Find available port
        self.port = find_free_port()?;
        
        // 3. Spawn Python process
        let executable = if cfg!(windows) {
            "sidecar/sidecar.exe"
        } else {
            "sidecar/sidecar"
        };
        
        self.process = Some(Command::new(executable)
            .env("OWNYOU_SIDECAR_SECRET", &self.secret)
            .env("OWNYOU_SIDECAR_PORT", self.port.to_string())
            .spawn()?);
        
        // 4. Wait for health check
        self.wait_for_ready().await?;
        
        Ok(())
    }
    
    pub async fn stop(&mut self) -> Result<()> {
        if let Some(mut process) = self.process.take() {
            process.kill().await?;
        }
        Ok(())
    }
    
    async fn wait_for_ready(&self) -> Result<()> {
        let client = reqwest::Client::new();
        let url = format!("http://localhost:{}/health", self.port);
        
        for _ in 0..30 {  // 30 second timeout
            if let Ok(resp) = client.get(&url).send().await {
                if resp.status().is_success() {
                    return Ok(());
                }
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        
        Err(anyhow!("Sidecar failed to start"))
    }
}
```

**Crash Recovery:**
```rust
impl SidecarManager {
    // Background task monitors health
    pub async fn health_monitor(&mut self) {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        
        loop {
            interval.tick().await;
            
            if !self.is_healthy().await {
                warn!("Sidecar unhealthy, restarting...");
                let _ = self.stop().await;
                match self.start().await {
                    Ok(_) => info!("Sidecar restarted successfully"),
                    Err(e) => error!("Failed to restart sidecar: {}", e),
                }
            }
        }
    }
}
```

#### 3.2.2 Bundling Strategy

**Tool:** PyInstaller (proven, cross-platform)

**Build Process:**
```bash
# build_sidecar.sh
#!/bin/bash

# Install dependencies in venv
python3 -m venv build_env
source build_env/bin/activate
pip install -r sidecar/requirements.txt
pip install pyinstaller

# Bundle with PyInstaller
pyinstaller \
  --onefile \
  --name sidecar \
  --hidden-import uvicorn \
  --hidden-import fastapi \
  --add-data "sidecar/models:models" \
  --add-data "sidecar/embeddings:embeddings" \
  sidecar/main.py

# Copy to Tauri resources
cp dist/sidecar ../src-tauri/resources/
```

**Tauri Bundle Configuration:**
```toml
# tauri.conf.json
{
  "tauri": {
    "bundle": {
      "resources": [
        "resources/sidecar",
        "resources/sidecar.exe"  // Windows
      ],
      "externalBin": [
        "resources/sidecar"
      ]
    }
  }
}
```

**Bundle Size Estimate:**
- Python interpreter: ~50MB
- Dependencies (FastAPI, email_parser, transformers): ~300MB
- Total: ~350MB (acceptable for desktop app)

**Update Strategy:**
- Sidecar version tracked in SQLite metadata
- On app update: replace sidecar binary
- Backward compatibility: maintain API contract for N-1 versions

#### 3.2.3 Existing Code Integration

**Mapping of Existing `email_parser` Modules:**

| Current Module | Role in Sidecar | Modifications Needed |
|----------------|-----------------|----------------------|
| `consumer_intelligence_system.py` | Main classification engine | Add FastAPI routes |
| `marketing_analyzer.py` | Shopping mission agent | Expose as `/analyze/shopping` endpoint |
| `holistic_ikigai_analyzer.py` | Ikigai profiling | Expose as `/analyze/ikigai` endpoint |
| `providers/` (Gmail, Outlook) | Email fetching | Accept tokens from Rust instead of managing OAuth |
| `llm_clients/` | Keep as-is | Add cost tracking callbacks |
| `memory/` | **Remove** - replace with Mission Memory | Major refactor |

**Migration Example:**
```python
# OLD: email_parser managed its own memory
class ConsumerIntelligenceSystem:
    def __init__(self, llm_client, storage_dir):
        self.memory = MemoryManager(storage_dir)  # OLD

# NEW: Reads/writes to Mission Memory via HTTP
class ConsumerIntelligenceSystem:
    def __init__(self, llm_client, memory_api_url):
        self.memory_client = MissionMemoryClient(memory_api_url)  # NEW
        
    async def classify_email(self, email):
        # Classify with LLM
        iab_categories = await self.llm_client.classify(email)
        
        # Write to Mission Memory via Rust API
        await self.memory_client.update_profile({
            "iab_interests": iab_categories
        })
```

**Why This Approach:**
- Minimal changes to battle-tested email parsing code
- HTTP API is simple, debuggable, language-agnostic
- FastAPI has excellent performance (async I/O)
- Clear separation: Python for ML/parsing, Rust for systems/security

---

### 3.3 LangGraph Runtime (Mission Agents)

**Decision:** Use LangGraph but with pragmatic constraints

#### 3.3.1 Why LangGraph Over Letta

| Criterion | LangGraph | Letta | Decision |
|-----------|-----------|-------|----------|
| **Privacy** | Can run fully local LLMs | Designed for local memory but less flexible | LangGraph |
| **Complexity** | More complex, but well-documented | Simpler but less mature | LangGraph |
| **State Management** | Built-in checkpointing | Memory-centric, may duplicate Mission Memory | LangGraph |
| **LLM Flexibility** | Supports any LLM (local/API) | Primarily OpenAI-focused | LangGraph |
| **Community** | Large, active (LangChain ecosystem) | Smaller, newer | LangGraph |
| **Use Case Fit** | Multi-agent orchestration | Conversational memory | LangGraph |

**Key Reason:** LangGraph's flexibility for multi-level agents (simple→coordinated→complex) and local LLM support aligns better with OwnYou's needs.

#### 3.3.2 Implementation

**Deployment:** Separate Python process, exposed as MCP Server

**Why MCP:**
- You're already familiar with MCP architecture
- Standard protocol for LLM tool calling
- Easier to swap LangGraph for alternatives later
- Can use existing MCP clients in TypeScript/Rust

**Architecture:**
```python
# langgraph_mcp/server.py
from mcp.server import Server, Tool
from langgraph.graph import StateGraph, END
from langchain_anthropic import ChatAnthropic
from langchain_community.llms import Ollama

server = Server("ownyou-missions")

# Local LLM for cheap operations
local_llm = Ollama(model="llama3.1:8b")

# Cloud LLM for complex reasoning
cloud_llm = ChatAnthropic(model="claude-sonnet-4-5", api_key=get_api_key())

@server.tool()
async def run_simple_mission(mission_type: str, context: dict) -> dict:
    """Execute a simple linear mission (e.g., price drop alert)"""
    graph = build_simple_graph(mission_type, local_llm)
    result = await graph.ainvoke(context)
    return result

@server.tool()
async def run_coordinated_mission(mission_type: str, context: dict) -> dict:
    """Execute coordinated mission (e.g., restaurant search)"""
    graph = build_coordinated_graph(mission_type, cloud_llm)
    result = await graph.ainvoke(context)
    return result

@server.tool()
async def run_complex_mission(mission_type: str, context: dict) -> dict:
    """Execute complex hierarchical mission (e.g., trip planning)"""
    graph = build_complex_graph(mission_type, cloud_llm)
    result = await graph.ainvoke(context)
    return result
```

**Rust MCP Client:**
```rust
use mcp_client::Client;

pub struct MissionAgentClient {
    mcp_client: Client,
    cost_tracker: Arc<CostTracker>,
}

impl MissionAgentClient {
    pub async fn run_mission(
        &self,
        level: MissionLevel,
        mission_type: &str,
        context: serde_json::Value,
    ) -> Result<MissionCard> {
        // Check budget
        let estimated_cost = self.estimate_cost(level, mission_type);
        if !self.cost_tracker.can_run_agent(mission_type, estimated_cost) {
            return Err(anyhow!("Daily budget exceeded"));
        }
        
        // Call MCP tool
        let tool_name = match level {
            MissionLevel::Simple => "run_simple_mission",
            MissionLevel::Coordinated => "run_coordinated_mission",
            MissionLevel::Complex => "run_complex_mission",
        };
        
        let result = self.mcp_client.call_tool(tool_name, context).await?;
        
        // Track actual cost (from LLM token usage)
        let actual_cost = parse_cost_from_metadata(&result);
        self.cost_tracker.record_cost(mission_type, actual_cost);
        
        Ok(result)
    }
}
```

#### 3.3.3 Agent Levels Implementation

**Level 1: Simple (Linear Chain)**
```python
def build_simple_graph(mission_type: str, llm):
    graph = StateGraph(State)
    
    # Example: Price Drop Alert
    graph.add_node("check_price", check_current_price)
    graph.add_node("compare_history", compare_with_history)
    graph.add_node("create_card", create_mission_card)
    
    graph.add_edge("check_price", "compare_history")
    graph.add_edge("compare_history", "create_card")
    graph.add_edge("create_card", END)
    
    return graph.compile()
```

**Level 2: Coordinated (Fan-Out/Fan-In)**
```python
def build_coordinated_graph(mission_type: str, llm):
    graph = StateGraph(State)
    
    # Example: Restaurant Search
    graph.add_node("search_google", search_google_maps)
    graph.add_node("search_yelp", search_yelp_api)
    graph.add_node("search_opentable", search_opentable_api)
    graph.add_node("aggregate", aggregate_results)
    graph.add_node("rank", rank_by_preferences)
    graph.add_node("create_card", create_mission_card)
    
    # Fan-out
    graph.set_entry_point("search_google")
    graph.set_entry_point("search_yelp")
    graph.set_entry_point("search_opentable")
    
    # Fan-in
    graph.add_edge("search_google", "aggregate")
    graph.add_edge("search_yelp", "aggregate")
    graph.add_edge("search_opentable", "aggregate")
    graph.add_edge("aggregate", "rank")
    graph.add_edge("rank", "create_card")
    graph.add_edge("create_card", END)
    
    return graph.compile()
```

**Level 3: Complex (Supervisor/Worker)**
```python
def build_complex_graph(mission_type: str, llm):
    graph = StateGraph(State)
    
    # Example: Trip Planning
    graph.add_node("supervisor", supervisor_agent)
    graph.add_node("flight_worker", flight_booking_worker)
    graph.add_node("hotel_worker", hotel_booking_worker)
    graph.add_node("activity_worker", activity_planning_worker)
    graph.add_node("review", supervisor_review)
    
    # Supervisor decides which workers to invoke
    graph.add_conditional_edges(
        "supervisor",
        route_to_workers,
        {
            "flights": "flight_worker",
            "hotels": "hotel_worker",
            "activities": "activity_worker",
            "review": "review",
        }
    )
    
    # Workers report back to supervisor
    graph.add_edge("flight_worker", "supervisor")
    graph.add_edge("hotel_worker", "supervisor")
    graph.add_edge("activity_worker", "supervisor")
    graph.add_edge("review", END)
    
    return graph.compile()
```

#### 3.3.4 Cost Management

**Strategy:**
1. **Use Local LLMs for Level 1:** Llama 3.1 8B can handle simple reasoning
2. **Use Cloud LLMs for Level 2/3:** Claude Sonnet for complex tasks
3. **Caching:** LangGraph's built-in checkpointing reduces redundant calls
4. **Rate Limiting:** Max 50 mission executions/day (configurable)

**Cost Estimates:**

| Mission Level | LLM | Tokens/Run | Cost/Run | Daily Budget (50 runs) |
|---------------|-----|------------|----------|------------------------|
| Simple | Llama 3.1 (local) | ~1K | $0 | $0 |
| Coordinated | Claude Sonnet | ~10K | $0.30 | $15 |
| Complex | Claude Sonnet | ~50K | $1.50 | $75 |

**Budget Enforcement:**
- Default: $10/day (33 coordinated missions OR 6 complex missions)
- User can adjust in settings
- UI shows real-time spend + projected monthly cost

**Why This Approach:**
- LangGraph gives flexibility without vendor lock-in
- MCP makes it swappable if we find better agent frameworks
- Local LLMs for common tasks save costs
- Explicit budgets prevent surprise bills

---

## 4. Mission Memory Architecture

**Key Change from v8:** Use Graphiti (temporal knowledge graph) instead of raw SQLite

### 4.1 Why Graphiti?

| Requirement | Raw SQLite | Graphiti | Decision |
|-------------|------------|----------|----------|
| **Temporal relationships** | Manual foreign keys | Native temporal edges | Graphiti |
| **Semantic search** | Full-text search | Vector embeddings | Graphiti |
| **Graph queries** | Complex JOINs | Cypher-like queries | Graphiti |
| **Evidence chains** | Manual tracking | Edge metadata | Graphiti |
| **Confidence decay** | Manual timestamp logic | Built-in temporal weighting | Graphiti |
| **Maintenance** | Schema migrations | Schema-less | Graphiti |

**Key Insight:** You researched temporal knowledge graphs (Graphiti, Zep) for this exact reason. Mission Memory isn't just a database - it's a living memory system with temporal relationships.

### 4.2 Schema Design

**Graphiti Entities (Nodes):**

```python
# Entity Types
class EntityType(Enum):
    # Profile Entities
    IAB_INTEREST = "iab_interest"           # e.g., "Auto Intenders"
    SHOPPING_PREFERENCE = "shopping_pref"    # e.g., "Prefers sustainable brands"
    IKIGAI_DIMENSION = "ikigai"              # e.g., "What you love: Hiking"
    DEMOGRAPHIC = "demographic"              # e.g., "Household size: 4"
    
    # Event Entities
    EMAIL = "email"
    TRANSACTION = "transaction"
    BROWSING_EVENT = "browsing_event"
    MISSION = "mission"
    MISSION_CARD = "mission_card"

# Example Node
{
    "id": "iab_569",
    "type": "iab_interest",
    "name": "Automotive > Auto Buying and Selling",
    "confidence": 0.87,
    "first_seen": "2025-01-15T10:30:00Z",
    "last_updated": "2025-03-20T14:22:00Z",
    "metadata": {
        "taxonomy_id": 569,
        "evidence_count": 12
    }
}
```

**Graphiti Relationships (Edges):**

```python
# Relationship Types
class RelationType(Enum):
    # Evidence chains
    SUPPORTS = "supports"          # Email -> IAB Interest
    TRIGGERED_BY = "triggered_by"  # Mission -> Profile Change
    RESULTED_IN = "resulted_in"    # Mission -> Mission Card
    
    # Profile relationships
    RELATED_TO = "related_to"      # Shopping Pref -> IAB Interest
    CONTRADICTS = "contradicts"    # Old Interest -> New Interest
    
    # Temporal
    SUPERSEDES = "supersedes"      # New data replaces old

# Example Edge
{
    "from": "email_12345",
    "to": "iab_569",
    "type": "supports",
    "confidence": 0.92,
    "created_at": "2025-03-20T14:22:00Z",
    "metadata": {
        "excerpt": "Looking to buy a Tesla Model Y...",
        "classifier_version": "v2.1"
    }
}
```

### 4.3 Implementation

**Storage Backend:** Graphiti uses SQLite + vector DB (ChromaDB) under the hood

**File Structure:**
```
~/.ownyou/memory/
├── graphiti.db           # SQLite (entities, edges, metadata)
├── vectors/              # ChromaDB (embeddings for semantic search)
│   └── chroma.sqlite3
└── snapshots/            # Daily backups
    └── memory_2025-03-20.tar.gz
```

**Rust Interface:**
```rust
use graphiti_rs::GraphitiClient;

pub struct MissionMemory {
    client: GraphitiClient,
    embedding_model: EmbeddingModel,
}

impl MissionMemory {
    // Add new entity
    pub async fn add_entity(&self, entity: Entity) -> Result<String>
    
    // Link entities with evidence
    pub async fn add_relationship(&self, from: &str, to: &str, rel_type: RelationType, confidence: f32) -> Result<()>
    
    // Semantic search
    pub async fn search_similar(&self, query: &str, top_k: usize) -> Result<Vec<Entity>>
    
    // Temporal queries
    pub async fn get_profile_at_time(&self, timestamp: DateTime) -> Result<Profile>
    
    // Graph traversal
    pub async fn get_evidence_chain(&self, entity_id: &str) -> Result<Vec<Edge>>
}
```

**Python Interface (for agents):**
```python
from graphiti import Graphiti

memory = Graphiti(db_path="~/.ownyou/memory/graphiti.db")

# IAB Agent writes classification results
async def update_iab_profile(email, classifications):
    email_node = await memory.add_entity(
        type="email",
        name=f"Email: {email.subject}",
        metadata={"from": email.sender, "date": email.date}
    )
    
    for category, confidence in classifications:
        interest_node = await memory.upsert_entity(
            type="iab_interest",
            name=category,
            confidence=confidence
        )
        
        await memory.add_relationship(
            from_id=email_node.id,
            to_id=interest_node.id,
            type="supports",
            confidence=confidence,
            metadata={"excerpt": email.body[:200]}
        )
```

### 4.4 Key Features

**1. Confidence Decay:**
```python
# Graphiti plugin: reduce confidence over time
class ConfidenceDecayPlugin:
    async def on_daily_update(self):
        # Reduce confidence by 1% per week for inactive interests
        await self.memory.execute_query("""
            UPDATE entities
            SET confidence = confidence * 0.99
            WHERE type = 'iab_interest'
              AND last_updated < datetime('now', '-7 days')
              AND confidence > 0.1
        """)
```

**2. Evidence Chains:**
```rust
// Get all evidence for a claim
let chain = memory.get_evidence_chain("iab_569").await?;
// Returns: Email -> Classification -> IAB Interest
// UI can show: "We think you're interested in Auto because you received 12 emails about cars"
```

**3. Temporal Profile Snapshots:**
```rust
// "What did my profile look like last month?"
let past_profile = memory.get_profile_at_time(
    DateTime::parse_from_rfc3339("2025-02-20T00:00:00Z")?
).await?;
```

**4. Contradiction Detection:**
```python
# When new evidence contradicts old
if new_interest.category != old_interest.category:
    await memory.add_relationship(
        from_id=new_interest.id,
        to_id=old_interest.id,
        type="contradicts",
        metadata={"reason": "User behavior changed"}
    )
```

**Why This Approach:**
- Aligns with your research on temporal knowledge graphs
- Enables sophisticated "why did you recommend this?" explanations
- Natural fit for confidence scoring and evidence tracking
- Future-proof: can add new entity types without schema migrations
- Vector search for semantic queries ("find all shopping-related interests")

---

## 5. Browser Extension Architecture

### 5.1 Native Messaging Security

**Key Challenge:** Malicious websites must NOT access Native Messaging host

**Chrome Implementation:**
```json
// manifest.json
{
  "manifest_version": 3,
  "name": "OwnYou History Capture",
  "permissions": [
    "tabs",
    "history",
    "nativeMessaging"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [],  // Deliberately empty - no content scripts
  "externally_connectable": {
    "matches": []  // No websites can connect
  }
}
```

**Native Messaging Host Manifest:**
```json
// ~/.config/google-chrome/NativeMessagingHosts/com.ownyou.desktop.json
{
  "name": "com.ownyou.desktop",
  "description": "OwnYou Desktop Native Messaging Host",
  "path": "/Applications/OwnYou.app/Contents/Resources/nm_host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://[EXTENSION_ID]/"
  ]
}
```

**Security Model:**
1. Only the background service worker can access Native Messaging
2. No content scripts = no DOM access = no injection vector
3. Extension validates origin of messages from host
4. Host validates signature of messages from extension

**Message Flow:**
```
User visits website
       ↓
Chrome History API captures visit
       ↓
Background worker batches visits (every 30s)
       ↓
Background worker connects to Native Messaging port
       ↓
Desktop App validates extension signature
       ↓
PII redaction in Desktop App
       ↓
Write to Mission Memory
```

### 5.2 Safari Differences

**Key Differences:**
- Native Messaging not supported in Safari
- Must use `safari-web-extension-handler` (XPC service)
- More restrictive permissions model

**Implementation:**
```swift
// SafariExtensionHandler.swift
import SafariServices

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let message = item.userInfo?["message"] as? [String: Any],
              let action = message["action"] as? String else {
            return
        }
        
        switch action {
        case "saveHistory":
            handleSaveHistory(message, context: context)
        default:
            context.completeRequest(returningItems: [], completionHandler: nil)
        }
    }
    
    private func handleSaveHistory(_ message: [String: Any], context: NSExtensionContext) {
        // Call Tauri app via XPC
        let connection = NSXPCConnection(serviceName: "com.ownyou.desktop.xpc")
        connection.remoteObjectInterface = NSXPCInterface(with: DesktopAppProtocol.self)
        connection.resume()
        
        let proxy = connection.remoteObjectProxyWithErrorHandler { error in
            print("XPC Error: \(error)")
        } as! DesktopAppProtocol
        
        proxy.saveHistory(message["events"] as! [[String: Any]])
        
        context.completeRequest(returningItems: [], completionHandler: nil)
    }
}
```

**Cross-Platform Approach:**
- Build Chrome extension first (simpler, larger market)
- Build Safari extension after MVP (use WebExtension API compatibility layer)
- Share 90% of JavaScript code between browsers

### 5.3 OAuth Helper Feature

**Use Case:** Web-based email providers (Gmail, Outlook) need OAuth tokens refreshed

**Flow:**
1. User clicks "Connect Gmail" in Desktop App
2. Desktop App opens WebView with OAuth URL
3. User completes OAuth in WebView
4. WebView redirects to `ownyou://oauth/callback?code=...`
5. Desktop App intercepts redirect, exchanges code for tokens
6. Desktop App stores encrypted tokens
7. Extension never sees tokens

**Extension's Role:**
- Provides "Quick Connect" button in popup
- Sends `{ action: "initiate_oauth", provider: "gmail" }` to Native Messaging
- Desktop App handles everything else

**Why This Approach:**
- Extension never touches sensitive tokens
- OAuth flow happens in trusted WebView, not content script
- Desktop App maintains token lifecycle
- Solves the refresh problem you encountered

---

## 6. PWA / Mobile Web Architecture

### 6.1 Framework Migration: Next.js → SvelteKit

**Current State:** Prototype in Next.js  
**Target:** SvelteKit

**Why SvelteKit:**
- Lighter bundle size (better for mobile)
- Better offline support (SvelteKit's service worker generation)
- Simpler state management (Svelte stores vs React context)
- Faster page transitions (no hydration overhead)

**Migration Plan:**
1. **Phase 1 (MVP):** Keep Next.js, prove the concept
2. **Phase 2 (Post-MVP):** Rewrite in SvelteKit
3. **Shared Code:** Keep business logic in shared TypeScript modules

### 6.2 Architecture

**Role:** View-only interface for Mission Cards and Profile

**Limitations:**
- No heavy processing (agents run on Desktop only)
- No raw data access (only sees synced Mission Cards)
- No OAuth management (handled by Desktop)

**Data Flow:**
```
Desktop App runs mission
       ↓
Creates Mission Card
       ↓
Writes to OrbitDB (see Section 7)
       ↓
PWA subscribes to OrbitDB updates
       ↓
IndexedDB cache for offline
       ↓
Render card in UI
```

**SvelteKit Implementation:**
```typescript
// routes/+page.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { missionCards } from '$lib/stores/missions';
  import { orbitdb } from '$lib/sync/orbitdb';

  onMount(async () => {
    // Connect to OrbitDB
    await orbitdb.connect();
    
    // Subscribe to updates
    orbitdb.subscribe('mission_cards', (card) => {
      missionCards.update(cards => [...cards, card]);
    });
  });
</script>

{#each $missionCards as card}
  <MissionCard data={card} />
{/each}
```

**Offline Support:**
```typescript
// lib/db/cache.ts
import Dexie from 'dexie';

class CacheDB extends Dexie {
  missionCards!: Dexie.Table<MissionCard, string>;

  constructor() {
    super('OwnYouCache');
    this.version(1).stores({
      missionCards: 'id, state, created_at'
    });
  }
}

export const cache = new CacheDB();

// Service worker syncs when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mission-cards') {
    event.waitUntil(syncMissionCards());
  }
});
```

**Why This Approach:**
- PWA is truly "read-only" - no security concerns about data leakage
- Offline-first with IndexedDB cache
- Fast load times (no server-side rendering needed)
- Progressive: works on any device with browser

---

## 7. Sync Architecture: OrbitDB Instead of Ceramic

**Key Change from v8:** Replace Ceramic with OrbitDB (simpler, more mature)

### 7.1 Why OrbitDB Over Ceramic?

| Criterion | Ceramic | OrbitDB | Decision |
|-----------|---------|---------|----------|
| **Maturity** | Still evolving, API changes | Stable, used in production | OrbitDB |
| **Complexity** | Requires ComposeDB, DID networks | Simple KV/Document store | OrbitDB |
| **Self-Hosted** | Requires node infrastructure | IPFS only | OrbitDB |
| **Conflict Resolution** | CRDT-based, complex | CRDT-based, well-documented | OrbitDB |
| **Query Language** | GraphQL (complex) | Direct access (simple) | OrbitDB |
| **Cost** | Potential hosting costs | Free (P2P) | OrbitDB |

**Key Reason:** OrbitDB is simpler and proven for P2P data sync without infrastructure costs.

### 7.2 Architecture

**Components:**
- **IPFS:** Content-addressed storage and P2P networking
- **OrbitDB:** CRDT-based database on top of IPFS
- **Database Types:**
  - `mission_cards`: Document store
  - `profile`: Key-value store

**Desktop App Implementation:**
```rust
use ipfs_api::IpfsClient;
use orbitdb_rs::OrbitDB;

pub struct SyncManager {
    ipfs: IpfsClient,
    orbitdb: OrbitDB,
    mission_cards_db: DocumentStore,
    profile_db: KeyValueStore,
}

impl SyncManager {
    pub async fn init() -> Result<Self> {
        // Start embedded IPFS node
        let ipfs = IpfsClient::new("http://localhost:5001")?;
        
        // Connect to OrbitDB
        let orbitdb = OrbitDB::create(ipfs.clone()).await?;
        
        // Open databases
        let mission_cards_db = orbitdb.docstore("mission_cards").await?;
        let profile_db = orbitdb.kvstore("profile").await?;
        
        Ok(Self { ipfs, orbitdb, mission_cards_db, profile_db })
    }
    
    pub async fn sync_mission_card(&self, card: MissionCard) -> Result<()> {
        // Encrypt sensitive data
        let encrypted = self.encrypt_card(card)?;
        
        // Write to OrbitDB
        self.mission_cards_db.put(encrypted).await?;
        
        // OrbitDB automatically syncs to peers
        Ok(())
    }
    
    pub async fn sync_profile(&self, profile: Profile) -> Result<()> {
        let encrypted = self.encrypt_profile(profile)?;
        self.profile_db.set("current_profile", encrypted).await?;
        Ok(())
    }
}
```

**PWA Implementation:**
```typescript
// lib/sync/orbitdb.ts
import IPFS from 'ipfs-core';
import OrbitDB from 'orbit-db';

class SyncClient {
  private ipfs: IPFS;
  private orbitdb: OrbitDB;
  private missionCardsDb: any;

  async connect() {
    // Start IPFS node in browser
    this.ipfs = await IPFS.create({
      relay: { enabled: true, hop: { enabled: false } }
    });
    
    // Connect to OrbitDB
    this.orbitdb = await OrbitDB.createInstance(this.ipfs);
    
    // Open database (auto-syncs with desktop)
    this.missionCardsDb = await this.orbitdb.docs('mission_cards', {
      accessController: {
        write: [this.getUserDID()]  // Only user can write
      }
    });
    
    // Load existing data
    await this.missionCardsDb.load();
  }

  subscribe(callback: (card: MissionCard) => void) {
    this.missionCardsDb.events.on('replicated', () => {
      const cards = this.missionCardsDb.get('');
      cards.forEach(callback);
    });
  }
}
```

### 7.3 Encryption

**Strategy:** Encrypt all data before syncing (zero-trust)

**Implementation:**
```rust
use age::secrecy::Secret;
use age::x25519;

pub struct EncryptionManager {
    identity: x25519::Identity,
    recipient: x25519::Recipient,
}

impl EncryptionManager {
    // Encrypt with user's public key
    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        let encrypted = age::encrypt(&self.recipient, data)?;
        Ok(encrypted)
    }
    
    // Decrypt with user's private key (stored in OS keychain)
    pub fn decrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        let decrypted = age::decrypt(&self.identity, data)?;
        Ok(decrypted)
    }
}
```

**Key Management:**
- Private key stored in OS keychain (macOS: Keychain, Windows: Credential Manager, Linux: Secret Service)
- Public key shared with all devices via QR code during setup
- No central key server (true self-sovereign)

### 7.4 Conflict Resolution

**Scenario:** Desktop and Mobile both update profile simultaneously

**OrbitDB CRDT Resolution:**
- OrbitDB uses CRDTs (Conflict-free Replicated Data Types)
- Last-write-wins for simple fields
- For complex fields, merge strategies:

```typescript
// Custom merge function for IAB interests
const mergeInterests = (desktop: Interest[], mobile: Interest[]) => {
  const merged = new Map();
  
  // Take highest confidence for each category
  [...desktop, ...mobile].forEach(interest => {
    const existing = merged.get(interest.category);
    if (!existing || interest.confidence > existing.confidence) {
      merged.set(interest.category, interest);
    }
  });
  
  return Array.from(merged.values());
};
```

**Why This Approach:**
- OrbitDB is simpler than Ceramic for basic sync needs
- P2P means no infrastructure costs
- Encryption ensures privacy even on IPFS
- CRDT-based conflict resolution is automatic

---

## 8. Financial Data Integration

**Key Change from v8:** Remove Chainlink (over-engineered), use local encryption

### 8.1 Plaid Integration

**Flow:**
1. User initiates Plaid Link in Tauri WebView
2. Plaid Link returns `access_token`
3. Desktop App encrypts token with user's key
4. Store encrypted token in Mission Memory
5. Daily polling: decrypt token → fetch transactions → re-encrypt

**Rust Implementation:**
```rust
use plaid::{Client, TokenRequest};

pub struct PlaidClient {
    client: Client,
    encryption: Arc<EncryptionManager>,
    memory: Arc<MissionMemory>,
}

impl PlaidClient {
    pub async fn exchange_public_token(&self, public_token: String) -> Result<()> {
        // Exchange public token for access token
        let response = self.client.exchange_public_token(&public_token).await?;
        
        // Encrypt access token
        let encrypted = self.encryption.encrypt(response.access_token.as_bytes())?;
        
        // Store in Mission Memory
        self.memory.add_entity(Entity {
            type_: EntityType::PlaidToken,
            data: encrypted,
            metadata: json!({ "institution_id": response.item_id }),
        }).await?;
        
        Ok(())
    }
    
    pub async fn fetch_transactions(&self, days: i32) -> Result<Vec<Transaction>> {
        // Get encrypted token
        let token_entity = self.memory.get_entity_by_type(EntityType::PlaidToken).await?;
        
        // Decrypt
        let decrypted = self.encryption.decrypt(&token_entity.data)?;
        let access_token = String::from_utf8(decrypted)?;
        
        // Fetch transactions
        let start_date = Utc::now() - Duration::days(days);
        let end_date = Utc::now();
        
        let transactions = self.client
            .get_transactions(&access_token, start_date, end_date)
            .await?;
        
        Ok(transactions)
    }
}
```

**Scheduled Polling:**
```rust
// In AgentOrchestrator
pub async fn schedule_financial_sync(&self) {
    let mut interval = tokio::time::interval(Duration::from_secs(86400)); // Daily
    
    loop {
        interval.tick().await;
        
        match self.plaid_client.fetch_transactions(1).await {
            Ok(transactions) => {
                for tx in transactions {
                    self.memory.add_entity(Entity {
                        type_: EntityType::Transaction,
                        data: serde_json::to_value(tx)?,
                        ..Default::default()
                    }).await?;
                }
            }
            Err(e) => error!("Failed to fetch transactions: {}", e),
        }
    }
}
```

**Why This Approach:**
- No Chainlink dependency (saves complexity and cost)
- Tokens never leave local device
- OS keychain provides hardware-backed encryption on supported platforms
- Simple polling model (no webhooks needed for MVP)

---

## 9. Identity & Monetization

### 9.1 BBS+ Pseudonyms

**Purpose:** Prove segment membership without revealing identity

**Example:**
> "I am in the 'Auto Intenders' segment" (verified by crypto)  
> WITHOUT revealing: "I am Nicholas, nicholasjgreen@gmail.com"

**Implementation:**
```rust
use bbs::prelude::*;

pub struct IdentityManager {
    keypair: KeyPair,
    did: String,
}

impl IdentityManager {
    pub fn create_pseudonym(&self, segment: &str, confidence: f32) -> Result<Pseudonym> {
        // Create claim
        let claim = json!({
            "segment": segment,
            "confidence": confidence,
            "timestamp": Utc::now().to_rfc3339(),
        });
        
        // Sign with BBS+ (allows selective disclosure)
        let signature = self.keypair.sign(claim.to_string().as_bytes())?;
        
        Ok(Pseudonym {
            did: self.did.clone(),
            claim: claim.to_string(),
            signature: signature.to_vec(),
        })
    }
    
    pub fn verify_pseudonym(&self, pseudonym: &Pseudonym) -> Result<bool> {
        // Verifier can confirm claim without seeing other attributes
        let verified = self.keypair.public_key.verify(
            pseudonym.claim.as_bytes(),
            &Signature::from_bytes(&pseudonym.signature)?
        )?;
        
        Ok(verified)
    }
}
```

### 9.2 Publisher SSO Flow

**Goal:** Login to publisher sites with OwnYou, share verified segments, earn revenue

**Flow:**
```
User clicks "Login with OwnYou" on news site
       ↓
Publisher redirects to ownyou://sso/authorize?site=news.com
       ↓
Desktop App shows consent screen:
  "News.com wants to know you're in these segments:
   - Auto Intenders (95%)
   - Tech Enthusiasts (87%)
   Allow?"
       ↓
User approves
       ↓
Desktop App creates BBS+ pseudonym for each segment
       ↓
Redirect to news.com/callback?pseudonyms=[...]
       ↓
Publisher verifies pseudonyms on-chain
       ↓
Publisher serves targeted ads
       ↓
Ad revenue shared with user's Solana wallet
```

**Revenue Split:**
- 70% to User
- 20% to Publisher
- 10% to OwnYou (platform fee)

**Smart Contract (Solana):**
```rust
// Simplified Anchor program
#[program]
pub mod ownyou_monetization {
    pub fn verify_and_pay(
        ctx: Context<VerifyAndPay>,
        pseudonym: Vec<u8>,
        revenue: u64,
    ) -> Result<()> {
        // Verify BBS+ signature
        require!(verify_bbs_signature(&pseudonym), ErrorCode::InvalidPseudonym);
        
        // Split revenue
        let user_share = revenue * 70 / 100;
        let publisher_share = revenue * 20 / 100;
        let platform_share = revenue * 10 / 100;
        
        // Transfer USDC
        transfer(ctx.accounts.escrow, ctx.accounts.user_wallet, user_share)?;
        transfer(ctx.accounts.escrow, ctx.accounts.publisher_wallet, publisher_share)?;
        transfer(ctx.accounts.escrow, ctx.accounts.platform_wallet, platform_share)?;
        
        Ok(())
    }
}
```

**Why This Approach:**
- True zero-knowledge: publishers only see verified segments, not raw data
- Transparent revenue: all payments on-chain
- User sovereignty: can revoke access anytime

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Scaffold core infrastructure

**Deliverables:**
- [ ] Tauri app with React UI (basic shell)
- [ ] AuthManager implemented (OAuth for Gmail + Outlook)
- [ ] Python sidecar scaffolding (FastAPI server)
- [ ] SQLite + Graphiti setup for Mission Memory
- [ ] Browser extension (Chrome only, basic history capture)
- [ ] Port existing `email_parser` to sidecar API

**Success Criteria:**
- Desktop app can fetch emails via Python sidecar
- Browser extension sends history to desktop app
- Mission Memory can store entities and relationships

### Phase 2: Passive Intelligence (Weeks 5-8)

**Goal:** Build IAB classification system

**Deliverables:**
- [ ] IAB Classifier agent in Python sidecar
- [ ] Confidence scoring and decay logic
- [ ] Evidence chain tracking in Graphiti
- [ ] OrbitDB sync setup (profile only)
- [ ] PWA: "View Profile" interface

**Success Criteria:**
- IAB profile built from email + browsing data
- Confidence scores update automatically
- Profile syncs to mobile PWA
- User can see "why" for each interest (evidence chain)

### Phase 3: Active Missions (Weeks 9-12)

**Goal:** First mission agent (savings)

**Deliverables:**
- [ ] LangGraph MCP server setup
- [ ] Simple mission: "Price Drop Alert"
- [ ] Mission Card schema and UI (Tauri + PWA)
- [ ] Cost tracking and budget enforcement
- [ ] User feedback loop (like/snooze/dismiss)

**Success Criteria:**
- User receives price drop alerts for tracked items
- Mission Cards display in both desktop and mobile
- Daily budget limits prevent runaway costs
- User actions update Mission Memory

### Phase 4: Financial Integration (Weeks 13-16)

**Goal:** Connect financial data

**Deliverables:**
- [ ] Plaid integration (token management in Rust)
- [ ] Transaction ingestion and storage
- [ ] Coordinated mission: "Budget Review Agent"
- [ ] Financial insights in UI

**Success Criteria:**
- User connects bank account securely
- Transactions stored encrypted in Mission Memory
- Budget review mission runs weekly
- UI shows spending insights

### Phase 5: Advanced Agents (Weeks 17-20)

**Goal:** Complex multi-step missions

**Deliverables:**
- [ ] Coordinated mission: "Restaurant Finder"
- [ ] Complex mission: "Travel Planner"
- [ ] Hierarchical agent patterns in LangGraph
- [ ] Multi-modal inputs (photos, voice)

**Success Criteria:**
- Restaurant mission searches 3 APIs and ranks results
- Travel mission books flights + hotels + activities
- User can provide voice/photo input for missions

### Phase 6: Monetization (Weeks 21+)

**Goal:** Publisher SSO and revenue

**Deliverables:**
- [ ] BBS+ identity implementation
- [ ] Solana wallet integration (Web3Auth)
- [ ] Publisher SSO SDK
- [ ] Smart contract for revenue distribution
- [ ] Pilot with 1-2 publishers

**Success Criteria:**
- User can login to publisher sites with OwnYou
- Verified segments shared (not raw data)
- Revenue flows to user's wallet
- Pilot publishers report ad performance uplift

---

## 11. Testing Strategy

### 11.1 Unit Tests

**Rust (Desktop App):**
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_oauth_token_refresh() {
        let auth_manager = AuthManager::new_test();
        let token = auth_manager.get_valid_token(Provider::Gmail).await.unwrap();
        assert!(!token.is_expired());
    }
    
    #[tokio::test]
    async fn test_sidecar_health_check() {
        let sidecar = SidecarManager::new_test().await;
        assert!(sidecar.is_healthy().await);
    }
}
```

**Python (Sidecar):**
```python
import pytest
from fastapi.testclient import TestClient
from sidecar.main import app

client = TestClient(app)

def test_classify_iab():
    response = client.post("/classify/iab", json={
        "content": "Looking to buy a Tesla Model Y",
        "type": "email"
    })
    assert response.status_code == 200
    assert any(c["category"].startswith("Automotive") for c in response.json())
```

### 11.2 Integration Tests

**Tauri ↔ Python Sidecar:**
```rust
#[tokio::test]
async fn test_email_ingestion_flow() {
    // Start sidecar
    let sidecar = SidecarManager::new().await?;
    
    // Mock OAuth token
    let auth = AuthManager::new_test();
    auth.store_token(Provider::Gmail, mock_token()).await?;
    
    // Fetch emails
    let emails = DataIngestor::new(sidecar, auth)
        .ingest_emails(DateTime::now() - Duration::days(7))
        .await?;
    
    assert!(!emails.is_empty());
}
```

### 11.3 End-to-End Tests

**Playwright (PWA):**
```typescript
import { test, expect } from '@playwright/test';

test('mission card lifecycle', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Wait for sync
  await page.waitForSelector('.mission-card');
  
  // Find price drop card
  const card = page.locator('.mission-card').filter({ hasText: 'Price Drop' });
  await expect(card).toBeVisible();
  
  // Click "View Details"
  await card.click();
  await expect(page.locator('.card-details')).toBeVisible();
  
  // Like the card
  await page.click('.btn-like');
  await expect(card).toHaveClass(/liked/);
});
```

### 11.4 Performance Tests

**LLM Cost Simulation:**
```python
import pytest
from unittest.mock import patch

@pytest.mark.benchmark
def test_simple_mission_cost():
    with patch('langchain.llms.openai.OpenAI') as mock_llm:
        mock_llm.return_value.invoke.return_value = "Result"
        mock_llm.return_value.get_num_tokens.return_value = 1000
        
        result = run_simple_mission("price_drop", {...})
        
        # Assert cost under threshold
        assert result.cost < 0.01  # $0.01 per simple mission
```

### 11.5 Security Tests

**Token Storage:**
```rust
#[test]
fn test_token_encryption() {
    let manager = EncryptionManager::new_test();
    let token = "sensitive_access_token";
    
    let encrypted = manager.encrypt(token.as_bytes()).unwrap();
    assert_ne!(encrypted, token.as_bytes());
    
    let decrypted = manager.decrypt(&encrypted).unwrap();
    assert_eq!(decrypted, token.as_bytes());
}
```

**Sidecar Authorization:**
```python
def test_unauthorized_access():
    response = client.post("/classify/iab", 
        json={"content": "test"},
        headers={"Authorization": "Bearer wrong_secret"}
    )
    assert response.status_code == 401
```

---

## 12. Monitoring & Observability

### 12.1 Logging

**Structured Logging (Rust):**
```rust
use tracing::{info, warn, error, instrument};

#[instrument]
pub async fn run_mission(&self, mission_type: &str) -> Result<MissionCard> {
    info!(mission_type = %mission_type, "Starting mission");
    
    match self.execute(mission_type).await {
        Ok(card) => {
            info!(mission_id = %card.id, "Mission completed");
            Ok(card)
        }
        Err(e) => {
            error!(mission_type = %mission_type, error = %e, "Mission failed");
            Err(e)
        }
    }
}
```

**Log Storage:**
```
~/.ownyou/logs/
├── desktop-app.log      # Tauri app logs
├── sidecar.log          # Python sidecar logs
├── langgraph.log        # Agent execution logs
└── sync.log             # OrbitDB sync logs
```

### 12.2 Telemetry (Privacy-Preserving)

**What to Track:**
- Mission execution counts (by type)
- Average execution time
- Cost per mission type
- Error rates
- Sync latency

**What NOT to Track:**
- User data content
- Email addresses
- Browsing URLs
- Financial details

**Implementation:**
```rust
pub struct Telemetry {
    local_db: SqlitePool,  // Local only, never sent
}

impl Telemetry {
    pub fn record_mission(&self, mission_type: &str, duration_ms: u64, cost: Money) {
        // Store locally for user's own analytics
        self.local_db.execute(
            "INSERT INTO mission_stats (type, duration_ms, cost, timestamp) VALUES (?, ?, ?, ?)",
            params![mission_type, duration_ms, cost.to_f64(), Utc::now()]
        );
    }
    
    pub fn get_user_analytics(&self) -> Analytics {
        // User can see their own stats
        self.local_db.query("SELECT * FROM mission_stats")
    }
}
```

### 12.3 Cost Dashboard (UI)

**React Component:**
```tsx
export function CostDashboard() {
  const { data } = useCostStats();
  
  return (
    <div className="cost-dashboard">
      <h2>AI Usage</h2>
      <div className="stat">
        <span>Today:</span>
        <span>${data.today_spend.toFixed(2)} / ${data.daily_budget.toFixed(2)}</span>
      </div>
      <div className="stat">
        <span>Projected Monthly:</span>
        <span>${(data.today_spend * 30).toFixed(2)}</span>
      </div>
      <button onClick={adjustBudget}>Adjust Budget</button>
    </div>
  );
}
```

---

## 13. Open Questions & Future Work

### 13.1 Local LLM Inference

**Question:** Should OwnYou run local LLMs for privacy-sensitive operations?

**Pros:**
- Ultimate privacy (no API calls)
- No ongoing costs
- Offline capability

**Cons:**
- Requires GPU (limits user base)
- Larger app bundle (~4GB with model)
- Slower than cloud APIs
- Model management complexity

**Recommendation:** Start with cloud LLMs, add local inference as optional feature in Phase 7+

### 13.2 Multi-Device Agent Execution

**Question:** Should missions run on mobile or only desktop?

**Current Design:** Desktop-only  
**Alternative:** Lightweight agents on mobile for simple tasks

**Recommendation:** Keep desktop-only for MVP, revisit after Phase 4

### 13.3 Health Data Integration

**Roadmap mentions health data but not specified**

**Potential Sources:**
- Apple Health (HealthKit)
- Google Fit
- Wearables (Fitbit, Oura)

**Privacy Concerns:**
- Most sensitive data category
- Requires careful HIPAA consideration (if US users)

**Recommendation:** Phase 8+ (after financial is proven)

### 13.4 Voice Interface

**User Request Pattern:** "Hey OwnYou, find me restaurants nearby"

**Implementation:**
- Use browser Web Speech API for speech-to-text
- Tauri app processes intent
- Mission agent executes
- Text-to-speech response

**Recommendation:** Phase 6+ (after core missions proven)

---

## 14. Risk Assessment & Mitigation

### 14.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Python sidecar crashes frequently | Medium | High | Health monitoring + auto-restart |
| LLM costs spiral out of control | Medium | High | Strict budget enforcement + alerts |
| OrbitDB sync conflicts corrupt data | Low | High | Conflict resolution + daily backups |
| OAuth tokens expire unexpectedly | Medium | Medium | Proactive refresh + user notifications |
| Mission Memory grows unbounded | High | Medium | Archival strategy + compression |
| Browser extension rejected by stores | Low | High | Careful permissions audit pre-submission |

### 14.2 Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Users don't trust local processing | Medium | High | Transparency (show what data is stored) |
| Mission Cards not useful enough | Medium | High | Extensive user testing in Phase 3 |
| Monetization too complex for users | High | Medium | Gradual rollout, clear UI |
| Publishers don't adopt SSO | High | High | Pilot with friendly publishers first |

### 14.3 Regulatory Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GDPR compliance for EU users | Medium | High | Data deletion + export features |
| Financial regulations (Plaid use) | Low | High | Legal review before Phase 4 |
| Advertising regulations (FTC) | Medium | Medium | Clear disclosures in SSO flow |

---

## 15. Success Metrics

### 15.1 Technical Metrics (MVP)

- **Reliability:** 99% uptime for desktop app
- **Performance:** Mission execution <30s for 90% of simple missions
- **Cost:** <$10/user/month average LLM spend
- **Sync:** Profile sync latency <5s between devices
- **Data Quality:** IAB classification accuracy >80%

### 15.2 Product Metrics (Post-MVP)

- **Engagement:** User opens app 3x/week
- **Mission Utility:** 60% of mission cards get user interaction (like/click)
- **Retention:** 40% DAU/MAU ratio
- **Monetization:** 20% of users enable Publisher SSO
- **Revenue:** $5/month average per monetizing user

### 15.3 User Feedback Metrics

- **NPS Score:** Target >40 (promoters - detractors)
- **Privacy Confidence:** "I trust OwnYou with my data" >80% agree
- **Utility Score:** "OwnYou saves me time/money" >70% agree

---

## Appendix A: Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Desktop App | Tauri 2.0 (Rust + React) | Performance, security, cross-platform |
| Python Sidecar | FastAPI + PyInstaller | Reuse existing code, simple HTTP API |
| Mission Memory | Graphiti + SQLite | Temporal knowledge graphs, evidence tracking |
| Agent Framework | LangGraph (via MCP) | Flexible multi-level agents, local LLM support |
| Browser Extension | Manifest V3 (Chrome) | Native Messaging security, Chrome dominance |
| PWA | SvelteKit | Light bundles, offline-first |
| Sync Layer | OrbitDB + IPFS | P2P, no infrastructure costs, mature |
| Identity | BBS+ on Solana | Zero-knowledge proofs, fast finality |
| Financial | Plaid SDK | Industry standard, reliable |

---

## Appendix B: File Structure

```
ownyou/
├── desktop-app/                   # Tauri app
│   ├── src-tauri/                 # Rust backend
│   │   ├── src/
│   │   │   ├── auth/              # OAuth management
│   │   │   ├── data/              # Data ingestion
│   │   │   ├── agents/            # Agent orchestration
│   │   │   ├── memory/            # Graphiti interface
│   │   │   ├── sync/              # OrbitDB sync
│   │   │   └── main.rs
│   │   ├── resources/             # Bundled binaries
│   │   │   └── sidecar            # Python sidecar executable
│   │   └── Cargo.toml
│   └── src/                       # React frontend
│       ├── components/
│       ├── pages/
│       └── main.tsx
├── python-sidecar/                # FastAPI server
│   ├── sidecar/
│   │   ├── main.py                # FastAPI app
│   │   ├── iab_classifier.py     # IAB agent
│   │   └── routes/
│   ├── email_parser/              # Existing code (migrated)
│   │   ├── consumer_intelligence_system.py
│   │   ├── providers/
│   │   ├── llm_clients/
│   │   └── analysis/
│   ├── requirements.txt
│   └── build_sidecar.sh           # PyInstaller build
├── langgraph-runtime/             # Mission agents
│   ├── server.py                  # MCP server
│   ├── missions/
│   │   ├── simple/                # Level 1 agents
│   │   ├── coordinated/           # Level 2 agents
│   │   └── complex/               # Level 3 agents
│   └── requirements.txt
├── browser-extension/             # Chrome extension
│   ├── manifest.json
│   ├── background.js              # Service worker
│   └── native-messaging-host/     # Desktop app connector
├── pwa/                           # SvelteKit PWA
│   ├── src/
│   │   ├── routes/
│   │   ├── lib/
│   │   │   ├── stores/
│   │   │   └── sync/              # OrbitDB client
│   │   └── app.html
│   └── svelte.config.js
├── smart-contracts/               # Solana programs
│   ├── programs/
│   │   └── ownyou-monetization/
│   └── Anchor.toml
└── docs/
    ├── architecture_v9.md         # This document
    ├── api/                       # API specs
    └── guides/                    # Developer guides
```

---

## Appendix C: Migration from v8

**Key Changes:**

1. **OAuth Management:** Added explicit AuthManager in Rust (v8 was vague)
2. **Python Sidecar IPC:** FastAPI HTTP server (v8 didn't specify)
3. **Memory System:** Graphiti instead of raw SQLite (v8 missed temporal aspect)
4. **Agent Framework:** Kept LangGraph but added justification and cost controls
5. **Sync Layer:** OrbitDB instead of Ceramic (simpler, more mature)
6. **Financial Integration:** Removed Chainlink (over-engineered), use local encryption
7. **MCP Integration:** LangGraph via MCP (v8 didn't mention MCP)
8. **Testing:** Added comprehensive testing strategy (missing in v8)
9. **Cost Management:** Explicit budget enforcement (v8 mentioned but didn't specify)
10. **Offline-First:** Proper conflict resolution (v8 mentioned but didn't detail)

**Backward Compatibility:**

- Existing `email_parser` code migrates to sidecar with minimal changes
- Mission Memory schema compatible with v8's conceptual model
- UI components from v8 prototype can be reused

---

## Appendix D: Glossary

**IAB:** Interactive Advertising Bureau - industry taxonomy for advertising categories

**Mission:** User-facing task/goal executed by AI agents (e.g., "Find me cheap flights")

**Mission Card:** UI artifact displaying mission results (similar to Google Now cards)

**Graphiti:** Temporal knowledge graph database for evolving relationships

**OrbitDB:** Distributed database on IPFS using CRDTs for sync

**BBS+:** Cryptographic signature scheme enabling zero-knowledge proofs

**MCP:** Model Context Protocol - standard for LLM tool integration

**Sidecar:** Separate process bundled with main app for specific functionality

**CRDT:** Conflict-free Replicated Data Type - enables sync without conflicts

**DID:** Decentralized Identifier - self-sovereign identity standard

---

**End of Document**

---

**Next Steps:**

1. Review with development team
2. Validate cost estimates with actual LLM pricing
3. Prototype critical paths (OAuth, sidecar IPC) before full build
4. Set up CI/CD for Tauri + Python bundling
5. Begin Phase 1 development

**Questions for Review:**

1. Is the Python sidecar approach acceptable given bundle size (~350MB)?
2. Should we start with Ceramic despite OrbitDB recommendation?
3. Are the cost controls sufficient to prevent budget overruns?
4. Should health data be in Phase 1 or deferred?
5. Is the roadmap timeline realistic (20 weeks to monetization)?