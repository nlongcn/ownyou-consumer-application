# Hybrid Agent Architecture Recommendation

**Date:** 2025-11-19
**Status:** Proposed
**Context:** Architectural decision for OwnYou Consumer Application (v9)

---

## Executive Summary

This document recommends a **Hybrid Agent Architecture** for the OwnYou Consumer Application.

We propose splitting the AI workload into two distinct runtimes based on task characteristics:
1.  **Browser Runtime (TypeScript/WebLLM):** Hosts the **IAB Classifier**. Optimized for high-volume, stateless data processing, user privacy, and zero-latency UI feedback.
2.  **Sidecar Runtime (Python/Tauri):** Hosts **Mission Agents**. Optimized for long-running, stateful, complex reasoning tasks that require system stability and file system access.

This approach leverages the strengths of each environment—speed and privacy in the browser, power and persistence in the sidecar—avoiding the pitfalls of a "one size fits all" monolith.

---

## 1. The Core Conflict: "Pipe" vs. "Daemon"

Our analysis of the codebase reveals two fundamentally different types of AI workloads:

### Workload A: The IAB Classifier (The "Pipe")
*   **Nature:** Linear Data Processing Pipeline.
*   **Input:** 1,000+ raw emails.
*   **Process:** `Load` → `Analyze` → `Tag` → `Save`.
*   **State:** Ephemeral. Once an email is tagged, the state is discarded.
*   **Volume:** High (thousands of items).
*   **User Expectation:** "Finish this batch quickly so I can see my data."

### Workload B: Mission Agents (The "Daemon")
*   **Nature:** Long-Running Stateful Processes.
*   **Input:** A high-level goal (e.g., "Plan a trip to Paris").
*   **Process:** `Plan` → `Wait for User` → `Execute Step 1` → `Sleep` → `Execute Step 2`.
*   **State:** Critical & Persistent. Must remember context for days/weeks.
*   **Volume:** Low (1-5 active missions).
*   **User Expectation:** "Don't lose my progress while I think about this."

---

## 2. Recommendation: The Hybrid Split

### Component 1: IAB Classifier → Browser Runtime
**Technology:** TypeScript + WebLLM (WebGPU)
**Location:** User's Browser Tab (PWA)

**Why Browser?**
1.  **Data Locality:** Emails are fetched in the browser (via Gmail API). Processing them *in situ* avoids sending megabytes of sensitive text to a separate process.
2.  **Performance:** WebLLM (Llama-3-8B via WebGPU) provides near-native inference speeds without the overhead of IPC (Inter-Process Communication) serialization.
3.  **Privacy:** Data never leaves the browser sandbox. This is a powerful selling point for "Self-Sovereign Identity."
4.  **UI Responsiveness:** The frontend can show real-time progress bars ("Processed 50/100 emails") without polling a backend.

**Why NOT Sidecar?**
*   **Sending 1,000 emails back and forth** between the Browser and Python Sidecar introduces unnecessary latency and complexity.
*   It forces the user to install the heavy Python bundle just to see their basic profile, raising the barrier to entry.

### Component 2: Mission Agents → Python Sidecar
**Technology:** Python + LangGraph + SQLite/PostgreSQL
**Location:** Local System Process (Managed by Tauri)

**Why Sidecar?**
1.  **State Stability:** Mission Agents are "daemons." They need to run reliably even if the user closes the browser UI. A Python background process persists independently of the rendering thread.
2.  **Complexity Management:** The Python ecosystem (LangGraph, LangChain, Pydantic) is vastly more mature for complex agent orchestration than TypeScript. Porting the `MissionController` logic to TS would be a massive, risky engineering effort.
3.  **System Access:** Level 3 Agents need to write files (itineraries, PDFs), manage local databases, and potentially interact with other system tools. Browsers are sandboxed from this; Python is not.

**Why NOT Browser?**
*   **Memory Limits:** Browsers aggressively throttle or kill background tabs. A complex agent thinking for 5 minutes in a background tab would likely be terminated, corrupting its state.
*   **Storage Limitations:** IndexedDB is good, but a full SQL database (SQLite) is superior for complex relational queries required by long-term agent memory.

---

## 3. The Unified Pipeline Architecture

How do these two worlds connect? Through a shared **Data Layer**.

```mermaid
graph TD
    subgraph "Browser Runtime (Frontend)"
        UI[User Interface]
        Gmail[Gmail API]
        IAB[IAB Classifier (WebLLM)]
        Store_FE[IndexedDB Store]
    end

    subgraph "Sidecar Runtime (Backend)"
        Mission[Mission Agents (Python)]
        Planner[LangGraph Planner]
        Store_BE[SQLite Database]
    end

    %% Data Flow
    Gmail -->|Raw Emails| IAB
    IAB -->|Classified Tags| Store_FE
    
    %% Synchronization
    Store_FE <-->|Sync/IPC| Store_BE
    
    %% Agent Action
    Store_BE -->|Context (Tags)| Planner
    Planner -->|Mission Plan| Mission
    Mission -->|Results| Store_BE
    Store_BE -->|Updates| UI
```

### The Workflow
1.  **Ingestion (Browser):** User logs in. Browser fetches emails.
2.  **Classification (Browser):** `IAB Classifier` runs locally in the tab. It tags emails as "Travel", "Shopping", etc., and saves them to `IndexedDB`.
3.  **Sync (Bridge):** The application syncs the high-level profile data (not necessarily raw emails) to the `SQLite` database accessible by the Sidecar.
4.  **Activation (Sidecar):** The `Mission Agent` wakes up. It sees a new "Travel" tag in the database.
5.  **Execution (Sidecar):** The Agent plans a trip using the Python logic. It saves the itinerary to `SQLite`.
6.  **Presentation (Browser):** The UI reads the new itinerary from the database/sync and displays it to the user.

---

## 4. Strategic Benefits

| Feature | Hybrid Architecture | Monolith (All Python) | Monolith (All Browser) |
| :--- | :--- | :--- | :--- |
| **Initial Download** | **Medium** (PWA loads fast, Sidecar optional) | **Huge** (Must download Python + Models first) | **Small** (Instant load) |
| **Privacy** | **Maximum** (Data compartmentalized) | High | High |
| **Agent Complexity** | **Unlimited** (Python ecosystem) | Unlimited | **Limited** (Browser constraints) |
| **Stability** | **High** (Agents survive UI close) | High | **Low** (Tab kills = Agent death) |
| **Dev Velocity** | **Fast** (Use best tool for job) | Slow (UI in Python is hard) | Slow (Rebuilding complex agents in TS) |

## 5. Recommendation for Team Discussion

**"We should adopt the Hybrid Architecture because it aligns our technology choices with the physics of the workload."**

*   **For the IAB Classifier:** We need **throughput and privacy**. The Browser (WebLLM) delivers this best.
*   **For Mission Agents:** We need **stability and reasoning depth**. The Python Sidecar delivers this best.

**Next Steps:**
1.  **Freeze** the TypeScript migration of the IAB Classifier (it is complete and correct).
2.  **Approve** the Python Sidecar design for Mission Agents.
3.  **Design** the "Bridge" (IPC/Sync) layer that allows the Browser PWA to trigger Python Agents and view their results.
