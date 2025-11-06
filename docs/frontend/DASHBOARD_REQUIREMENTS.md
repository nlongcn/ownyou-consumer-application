# IAB Taxonomy Profile Dashboard - Requirements Document

**Version:** 1.0
**Date:** October 1, 2025
**Status:** Planning Phase

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technical Stack](#2-technical-stack)
3. [Core Features](#3-core-features)
4. [UI/UX Design Specifications](#4-uiux-design-specifications)
5. [Data Flow & Architecture](#5-data-flow--architecture)
6. [Development Phases](#6-development-phases)
7. [File Structure](#7-file-structure)
8. [Success Criteria](#8-success-criteria)
9. [Open Questions](#9-open-questions)

---

## 1. Project Overview

### 1.1 Purpose

A privacy-first, web-based admin dashboard for visualizing and validating IAB Taxonomy consumer profiles generated from email analysis. The dashboard enables users to:

- Run email analysis from the interface
- View and explore all IAB taxonomy classifications
- Drill down into evidence supporting each classification
- Track confidence evolution over time
- Visualize memory building (semantic and episodic)
- Preview how profiles translate to consumer-facing mission cards

### 1.2 Target Users

**Primary:** Internal team members (developers, data scientists, product managers)
**Secondary:** Future external validators/testers

### 1.3 Key Objectives

1. **Validation:** Verify accuracy of IAB classifications
2. **Transparency:** Show complete evidence trail for every classification
3. **Debugging:** Identify and fix incorrect classifications
4. **Insights:** Understand how profiles build over time
5. **Preview:** Visualize consumer-facing mission cards

---

## 2. Technical Stack

### 2.1 Frontend

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Framework** | Next.js 14 (App Router) | Server-side rendering, routing, optimization |
| **Language** | TypeScript | Type safety, better DX |
| **UI Library** | React 18+ | Component-based architecture |
| **UI Components** | shadcn/ui | Radix UI primitives + Tailwind, accessible |
| **Styling** | Tailwind CSS | Utility-first, responsive, themeable |
| **Charts** | Recharts | React-native charts, customizable |
| **State** | React Context / Zustand | Lightweight state management |
| **HTTP Client** | Fetch API / Axios | API communication |

### 2.2 Backend

| Component | Technology | Justification |
|-----------|-----------|---------------|
| **Framework** | Flask (Python) | Lightweight, easy SQLite integration |
| **Database** | SQLite | Existing db, zero-config, local-first |
| **ORM** | Direct SQL (sqlite3) | Simple queries, no overhead |
| **Auth** | Flask-Session | Session-based, secure cookies |
| **CORS** | Flask-CORS | Enable frontend-backend communication |

### 2.3 Deployment

| Environment | Configuration |
|-------------|---------------|
| **Development** | Local (localhost:3000 frontend, localhost:5000 backend) |
| **Production (Future)** | Self-hosted with Docker |

---

## 3. Core Features

### 3.1 User Authentication & Privacy

**Requirements:**

- ✅ Single-user authentication (local session)
- ✅ User can ONLY access their own profile data
- ✅ No cross-user data sharing or viewing
- ✅ All data stays on local machine (SQLite database)
- ✅ No telemetry or external API calls from dashboard
- ✅ Clear privacy notices on data handling
- ✅ Session-based auth (httpOnly cookies)

**Privacy Guarantees:**

- Email content NOT displayed (only summaries/metadata)
- No data sent to third parties
- All processing happens locally
- User-scoped database queries (strict isolation)

**Future (Phase 2):**

- Production-grade OAuth2 for Gmail/Outlook
- Multi-user support with strict data isolation
- Encrypted storage for credentials

---

### 3.2 Email Analysis Execution

**Three-Step Discrete Workflow:**

The analysis pipeline consists of three independent stages that can be run separately or as a full pipeline:

1. **Email Download** (Step 1)
   - Download emails from Gmail/Outlook via OAuth → `emails_raw.csv`
   - Select provider(s): Gmail, Outlook, or both
   - Specify max emails to download
   - Progress tracking with email count
   - Output: Raw emails CSV with metadata

2. **Email Summarization** (Step 2)
   - Pre-process raw emails into summaries using EMAIL_MODEL → `emails_summaries.csv`
   - Requires Step 1 completion (or existing raw CSV)
   - Model selection: Choose EMAIL_MODEL (e.g., gpt-4o-mini for speed)
   - Progress tracking with summary count
   - Output: Summaries CSV ready for classification

3. **IAB Classification** (Step 3)
   - Run classification agents using TAXONOMY_MODEL → `user_profile.json`
   - Requires Step 2 completion (or existing summaries CSV)
   - Model selection: Choose TAXONOMY_MODEL (e.g., claude-sonnet for accuracy)
   - Progress tracking with classification count
   - Output: Complete IAB consumer profile JSON

**Why Discrete Steps?**

- **Resilience:** Re-run failed steps without reprocessing earlier stages
- **Iteration:** Test different classification models without re-downloading/summarizing
- **Cost savings:** Skip expensive LLM calls when experimenting with settings
- **State persistence:** CSV files act as checkpoints between stages

**Run Analysis Interface:**

**Full Pipeline Mode:**
- Run all 3 steps sequentially with one click
- Specify user ID, provider(s), max emails
- Select EMAIL_MODEL and TAXONOMY_MODEL
- Force reprocess toggle
- Progress indicator showing current step
- Real-time log streaming (Server-Sent Events)
- Cost summary display

**Step-by-Step Mode:**
- Tab navigation between steps
- Prerequisites validation (Step 2 requires Step 1, Step 3 requires Step 2)
- Run individual steps on-demand
- Resume from checkpoints
- Model selection per step
- Cost estimation before running
- Independent progress tracking per step

**Analysis Modes:**

1. From Gmail (OAuth flow)
2. From Outlook (OAuth flow)
3. Combined providers (Gmail + Outlook)
4. From existing CSV (skip Step 1)

**Post-Analysis:**

- Automatic dashboard refresh with new data
- Success/error notifications
- Cost breakdown (per provider, per email, per step)
- Link to view updated profile
- Checkpoint files saved for resume capability

**Current Limitations:**

- OAuth flows use current `.env` credentials (development mode)
- Full pipeline is recommended for initial runs

---

### 3.3 Main Dashboard (Home Page)

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Header (User ID, Theme Toggle, Logout)    │
├─────────────────────────────────────────────┤
│  Overview Cards (4 cards)                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │Total │ │  Avg │ │Emails│ │Memory│      │
│  │Class.│ │Conf. │ │Analyz│ │Stats │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
├─────────────────────────────────────────────┤
│  Section Breakdown Cards                    │
│  ┌───────────┐ ┌───────────┐              │
│  │Demographics│ │ Household │              │
│  │  (6 items) │ │ (12 items)│              │
│  └───────────┘ └───────────┘              │
│  ┌───────────┐ ┌───────────┐              │
│  │ Interests  │ │ Purchase  │              │
│  │ (16 items) │ │Intent (5) │              │
│  └───────────┘ └───────────┘              │
├─────────────────────────────────────────────┤
│  Quick Actions                              │
│  [Run New Analysis] [View All]              │
└─────────────────────────────────────────────┘
```

**Overview Cards:**

1. **Total Classifications**
   - Count of all taxonomy classifications
   - Breakdown by section (pill badges)
   - Trend indicator (↑ ↓ ↔)

2. **Average Confidence**
   - Overall confidence score (0.0-1.0)
   - Visual gauge/progress bar
   - Trend indicator

3. **Emails Analyzed**
   - Total emails processed
   - Date range covered (first → last)
   - New emails since last run

4. **Memory Stats**
   - Semantic memories count (classifications)
   - Episodic memories count (emails)
   - Growth rate

**Section Breakdown Cards:**

Each section card shows:
- Section name (Demographics, Household, Interests, Purchase Intent)
- Classification count
- Average confidence for that section
- Top 3 classifications preview
- Link to view all in that section

**Quick Actions:**

- "Run New Analysis" → Opens analysis modal
- "View All Classifications" → Navigate to Classification Explorer
- "Export Profile JSON" → Download current profile

---

### 3.4 Classification Explorer

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Filters & Search                           │
│  [Section ▼] [Confidence ━━●━━] [Search 🔍] │
├─────────────────────────────────────────────┤
│  Classifications Table                      │
│  ┌────┬─────┬────────┬──────┬────────┬────┐│
│  │Sec │Tax ID│Value   │Conf. │Evidence│View││
│  ├────┼─────┼────────┼──────┼────────┼────┤│
│  │🟢 D│  21 │Female  │ 0.85 │   1    │ 👁 ││
│  │🟡 I│ 342 │Crypto  │ 0.68 │   3    │ 👁 ││
│  │🟢 P│ 510 │Purchase│ 0.95 │   5    │ 👁 ││
│  └────┴─────┴────────┴──────┴────────┴────┘│
│  Pagination: [< 1 2 3 ... 10 >]             │
└─────────────────────────────────────────────┘
```

**Features:**

**Table Columns:**
- Section (icon + initial: D, H, I, P, F)
- Taxonomy ID
- Value (classification name)
- Confidence (with color indicator)
- Evidence Count
- Actions (View evidence button)

**Sorting:**
- Click any column header to sort
- Ascending/descending toggle
- Default: Sort by confidence (descending)

**Filtering:**
- **Section Filter:** Dropdown (All, Demographics, Household, Interests, Purchase Intent, Finance)
- **Confidence Range:** Slider (0.0 - 1.0)
- **Evidence Count:** Min/max input
- **Date Range:** Last validated date picker

**Search:**
- Full-text search on Value and Tier Path
- Real-time filtering as you type

**Confidence Color Coding:**
- 🟢 **Green:** 0.8-1.0 (High confidence)
- 🟡 **Yellow:** 0.5-0.79 (Moderate confidence)
- 🔴 **Red:** <0.5 (Low confidence)

**Pagination:**
- 50 items per page
- Page numbers with "..." for large sets
- Jump to page input

**Mobile View:**
- Table → Card layout
- Swipeable cards
- Tap to expand details

---

### 3.5 Evidence Viewer (Drill-Down)

**Layout:**

```
┌─────────────────────────────────────────────┐
│  ← Back to Classifications                  │
├─────────────────────────────────────────────┤
│  Classification Header                      │
│  Taxonomy ID: 342                           │
│  Interest | Cryptocurrency                  │
│  Confidence: ████████░░ 0.88                │
│  Evidence: 3 emails                         │
│  First Validated: 2025-10-01                │
│  Last Validated: 2025-10-01                 │
├─────────────────────────────────────────────┤
│  Confidence Evolution Chart                 │
│   1.0 ┤                                     │
│   0.8 ┤    ●━━●━━●                          │
│   0.6 ┤   ╱                                 │
│   0.0 ┴──────────────────────────           │
│       Email 1  Email 2  Email 3             │
├─────────────────────────────────────────────┤
│  Evidence Timeline                          │
│  ┌─────────────────────────────────────┐   │
│  │ 📧 Email: 19989c11... (2025-10-01)  │   │
│  │ Subject: Crypto Market Update        │   │
│  │ Confidence: 0.70 → 0.85 (+0.15)     │   │
│  │ [Show Details ▼]                    │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ 📧 Email: 199876da... (2025-10-01)  │   │
│  │ Subject: Bitcoin News                │   │
│  │ Confidence: 0.85 → 0.87 (+0.02)     │   │
│  │ [Show Details ▼]                    │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Classification Header:**
- Taxonomy ID and full tier path
- Current confidence score (large display with progress bar)
- Evidence count
- First validated date
- Last validated date
- Section badge

**Confidence Evolution Chart:**
- Line chart showing confidence over time
- X-axis: Email processed date
- Y-axis: Confidence score (0-1)
- Points: Each email that updated this classification
- Hover tooltip: Email details + confidence change

**Evidence Timeline:**
- Reverse chronological list (newest first)
- Each entry shows:
  - Email ID (truncated, with copy button)
  - Email date
  - Email subject (if available)
  - Confidence change (before → after with delta)
  - Expandable details

**Email Content Preview (Expandable):**
- Email summary (NOT full content for privacy)
- Relevant keywords highlighted (if available)
- LLM reasoning (if logged)
- Bayesian update calculation

**Navigation:**
- Back to Classification Explorer
- Next/Previous classification (arrow keys)

---

### 3.6 Memory Timeline

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Memory Timeline                            │
│  ┌─────────────────────────────────────┐   │
│  │ ◀ ▶ ⏸ [Speed: 1x▼]  🔄 Reset      │   │
│  │ ━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│  │ Email 50/100                        │   │
│  └─────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│  Current State (at Email 50)                │
│  Demographics: 4 | Household: 8             │
│  Interests: 10   | Purchase Intent: 3       │
├─────────────────────────────────────────────┤
│  Semantic Memory Growth                     │
│   30┤                    ╱─                 │
│   20┤              ╱────╱                   │
│   10┤      ╱──────╱                         │
│    0┴──────────────────────                 │
│      0    25    50    75   100              │
├─────────────────────────────────────────────┤
│  Confidence Evolution by Section            │
│   1.0┤   ────────────── Interests           │
│   0.8┤  ╱───────  Demographics              │
│   0.6┤╱────  Household                      │
│   0.0┴──────────────────────                │
│       0    25    50    75   100             │
└─────────────────────────────────────────────┘
```

**Interactive Timeline:**
- Horizontal slider showing all processed emails
- Scrub through time to see profile evolution
- Play/Pause animation
- Speed control (1x, 2x, 5x, 10x)
- Jump to specific email/date
- Step forward/backward buttons

**At Each Time Point:**
- Show current count of classifications by section
- Highlight newly added classifications (flash animation)
- Show confidence changes
- Display currently processing email

**Charts:**

1. **Semantic Memory Growth:**
   - Stacked area chart
   - Y-axis: Number of classifications
   - X-axis: Emails processed
   - Colors: Demographics (blue), Household (green), Interests (purple), Purchase Intent (orange)

2. **Confidence Evolution:**
   - Multi-line chart
   - Y-axis: Average confidence (0-1)
   - X-axis: Emails processed
   - One line per section

3. **Episodic Memory:**
   - Bar chart
   - Y-axis: Email count
   - X-axis: Date
   - Grouped by day/week

**Timeline Events:**
- Mark significant milestones (e.g., "10th email", "First high-confidence classification")
- Annotate major confidence jumps
- Flag potential errors (e.g., conflicting evidence)

---

### 3.7 Confidence Analysis

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Confidence Overview                        │
│  ┌────────────┬────────────┬────────────┐  │
│  │Demographics│ Household  │ Interests  │  │
│  │    0.78    │    0.72    │    0.86    │  │
│  │  ██████░░  │  █████░░░  │  ████████  │  │
│  └────────────┴────────────┴────────────┘  │
├─────────────────────────────────────────────┤
│  Confidence Distribution                    │
│    50┤     ╱╲                               │
│    40┤    ╱  ╲                              │
│    30┤   ╱    ╲___                          │
│    20┤  ╱         ╲___                      │
│    10┤ ╱              ╲___                  │
│     0┴──────────────────────                │
│      0.0  0.2  0.4  0.6  0.8  1.0           │
├─────────────────────────────────────────────┤
│  Biggest Confidence Changes (Last 7 Days)   │
│  ┌──────────┬────┬────┬────────┬────────┐  │
│  │Value     │Old │New │Change  │Email   │  │
│  ├──────────┼────┼────┼────────┼────────┤  │
│  │Crypto    │0.70│0.88│+25.7%  │199876..│  │
│  │Technology│0.82│0.95│+15.9%  │19987..│  │
│  └──────────┴────┴────┴────────┴────────┘  │
└─────────────────────────────────────────────┘
```

**Confidence Overview:**
- Average confidence by section (bar chart)
- Confidence gauge for each section
- Trend indicators (↑ ↓ ↔)

**Confidence Distribution:**
- Histogram showing distribution of all classifications
- X-axis: Confidence buckets (0-0.2, 0.2-0.4, etc.)
- Y-axis: Count of classifications
- Color-coded by confidence level

**Biggest Changes Table:**
- Shows classifications with largest confidence changes
- Filterable by time period (24h, 7d, 30d, All time)
- Columns: Classification, Old Confidence, New Confidence, % Change, Triggering Email
- Sortable

**Bayesian Update Visualization:**
- Interactive component
- Select any classification
- Shows step-by-step Bayesian updates:
  - Prior: P(H) = 0.70
  - Evidence: P(E|H) = 0.85
  - Likelihood ratio
  - Posterior: P(H|E) = 0.88
- Formula display with actual numbers

**Evidence Strength Analysis:**
- Scatter plot: Evidence count (x) vs Confidence (y)
- Quadrants:
  - **Top-right:** Strong (high evidence, high confidence) ✅
  - **Top-left:** Weak (low evidence, high confidence) ⚠️
  - **Bottom-right:** Building (high evidence, low confidence) 🔄
  - **Bottom-left:** New (low evidence, low confidence) 🆕

**Alerts:**
- Classifications needing attention
- Stale facts (>30 days since last validation)
- Low confidence warnings (<0.5)
- Conflicting evidence detection

---

### 3.8 Mission Preview (NEW)

**Purpose:**
Preview how IAB profile classifications translate into consumer-facing mission cards (per Figma design).

**Layout:**

```
┌─────────────────────────────────────────────┐
│  Mission Card Preview                       │
│  "How your profile becomes actionable       │
│   insights for users"                       │
├─────────────────────────────────────────────┤
│  Phone Mockup (iPhone frame)                │
│  ┌───────────────────────────────────────┐ │
│  │  9:41         📶 📡 🔋               │ │
│  │  All  Savings  Ikigai  Health        │ │
│  │                                       │ │
│  │  ┌─────────────────────────────────┐ │ │
│  │  │ 👕 ATELIER NOIR                 │ │ │
│  │  │                                  │ │ │
│  │  │ [Image: Jackie White Dress]     │ │ │
│  │  │                                  │ │ │
│  │  │ Jackie White Dress               │ │ │
│  │  │ £84.50  £299.00                  │ │ │
│  │  │                                  │ │ │
│  │  │ Your recent searches for white   │ │ │
│  │  │ summer dresses made us think     │ │ │
│  │  │ you might like this.             │ │ │
│  │  │                                  │ │ │
│  │  │ 😊 😐                            │ │ │
│  │  └─────────────────────────────────┘ │ │
│  │                                       │ │
│  └───────────────────────────────────────┘ │
│                                             │
│  [◀ Prev Card] [Next Card ▶]                │
├─────────────────────────────────────────────┤
│  IAB Classification Mapping                 │
│  This card was generated from:              │
│  • Interest: Shopping (0.85)                │
│  • Purchase Intent: Clothing (0.78)         │
│  • Demographics: Female (0.82)              │
└─────────────────────────────────────────────┘
```

**Mission Card Types:**

Based on Figma design and IAB classifications:

1. **Shopping Cards** (card_savings_shopping)
   - Source: Purchase Intent + Interests
   - Example: "Jackie White Dress" deal
   - Action: View product

2. **Savings Cards** (card_savings_consumables, card_savings_utility)
   - Source: Purchase Intent + Household
   - Example: "Electricity savings £26.47/year"
   - Action: Switch provider / View basket

3. **Travel Cards** (card_ikigai_travel)
   - Source: Interests (Travel) + Purchase Intent
   - Example: "Laguna Blu - Resort Villa"
   - Action: Reserve

4. **People Cards** (card_ikigai_people)
   - Source: Demographics + Episodic memory
   - Example: "Call David?"
   - Action: Message/Call

5. **Health Cards** (health_card_video)
   - Source: Interests (Health/Fitness)
   - Example: Video content
   - Action: Watch

**Features:**

- Swipeable carousel of mission cards
- Phone mockup frame (iOS style)
- Bottom emoji reactions (😊 😐)
- Mapping panel showing which IAB classifications generated each card
- "Generate More" button to create additional mission cards
- Export preview as image

**Card Generation Logic:**

```
IAB Classifications → Mission Card Mapping:

IF (Purchase Intent: Electronics > 0.7 AND Interests: Technology > 0.8)
  → Generate "Tech Product Deal" card

IF (Household: Utility Bills > 0.7 AND Purchase Intent: PIPR_High > 0.7)
  → Generate "Utility Savings" card

IF (Interests: Travel > 0.8 AND Demographics: Income > $100K)
  → Generate "Premium Travel Deal" card

IF (Interests: Fitness > 0.7)
  → Generate "Workout/Health" card
```

**Note:** This is a preview/demo only. Full mission card generation will be Phase 3.

---

## 4. UI/UX Design Specifications

### 4.1 Design System

**Design Philosophy:**
- Minimalist and clean
- Data-focused (not flashy)
- Accessibility-first
- Mobile-responsive

**Visual Style:**
- Modern SaaS aesthetic
- Generous whitespace
- Clear typography hierarchy
- Subtle shadows and borders
- Smooth transitions

### 4.2 Color Palette

**Light Mode:**

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Background | White | `#FFFFFF` | Main background |
| Surface | Light Gray | `#F9FAFB` | Card backgrounds |
| Border | Gray | `#E5E7EB` | Dividers, borders |
| Text Primary | Dark Gray | `#111827` | Headings, body text |
| Text Secondary | Medium Gray | `#6B7280` | Captions, labels |
| Primary | Blue | `#3B82F6` | Buttons, links, highlights |
| Success | Green | `#10B981` | High confidence, success states |
| Warning | Yellow | `#F59E0B` | Moderate confidence, warnings |
| Error | Red | `#EF4444` | Low confidence, errors |

**Dark Mode:**

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Background | Very Dark Gray | `#111827` | Main background |
| Surface | Dark Gray | `#1F2937` | Card backgrounds |
| Border | Medium Gray | `#374151` | Dividers, borders |
| Text Primary | Off-White | `#F9FAFB` | Headings, body text |
| Text Secondary | Light Gray | `#9CA3AF` | Captions, labels |
| Primary | Light Blue | `#60A5FA` | Buttons, links, highlights |
| Success | Light Green | `#34D399` | High confidence, success states |
| Warning | Light Yellow | `#FBBF24` | Moderate confidence, warnings |
| Error | Light Red | `#F87171` | Low confidence, errors |

### 4.3 Typography

**Font Stack:**
- Primary: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Monospace: `'Fira Code', 'Courier New', monospace` (for IDs, code)

**Scale:**

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 36px | 600 | 1.2 |
| H2 | 30px | 600 | 1.3 |
| H3 | 24px | 600 | 1.4 |
| H4 | 20px | 600 | 1.5 |
| Body | 16px | 400 | 1.6 |
| Small | 14px | 400 | 1.5 |
| Caption | 12px | 400 | 1.4 |

**Usage:**
- H1: Page titles
- H2: Section headings
- H3: Card titles
- H4: Subsection headings
- Body: Main content
- Small: Labels, secondary text
- Caption: Timestamps, metadata

### 4.4 Spacing

**Tailwind Scale:**
- 4px increments (1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64)

**Common Patterns:**
- Card padding: `p-6` (24px)
- Section spacing: `mb-8` (32px)
- Element spacing: `gap-4` (16px)
- Tight spacing: `gap-2` (8px)

### 4.5 Components (shadcn/ui)

**Core Components:**
- `Button`: Primary actions, secondary actions, ghost buttons
- `Card`: Container for grouped content
- `Table`: Data tables with sorting/filtering
- `Dialog`: Modals for analysis runner, confirmations
- `Dropdown Menu`: Filters, user menu
- `Input`: Text inputs, search
- `Label`: Form labels
- `Tabs`: Section navigation
- `Badge`: Tags, status indicators
- `Tooltip`: Contextual help
- `Slider`: Confidence range filter
- `Progress`: Loading states, confidence gauges
- `Accordion`: Expandable email details
- `Separator`: Horizontal/vertical dividers

**Custom Components:**
- `ConfidenceGauge`: Visual confidence indicator
- `EvidenceTimeline`: Evidence list with expand/collapse
- `MemoryChart`: Recharts wrapper with theme support
- `ClassificationCard`: Card view for mobile
- `MissionCardPreview`: Mission card mockup

### 4.6 Responsive Design

**Breakpoints:**

```css
sm: 640px   /* Mobile landscape, small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small desktops */
xl: 1280px  /* Large desktops */
2xl: 1536px /* Extra large screens */
```

**Responsive Patterns:**

**Mobile (<640px):**
- Single column layout
- Stacked cards
- Bottom navigation
- Hamburger menu
- Swipeable tables → cards
- Simplified charts (fewer data points)

**Tablet (640-1024px):**
- 2-column grid
- Side navigation (collapsible)
- Full charts
- Table view with horizontal scroll

**Desktop (>1024px):**
- 3-4 column grid
- Persistent side navigation
- Full-featured tables
- Multi-chart dashboards

**Touch Targets:**
- Minimum 44x44px for interactive elements
- Generous padding for mobile buttons
- Swipe gestures for cards/carousels

### 4.7 Accessibility

**WCAG 2.1 AA Compliance:**

- ✅ Color contrast ratio ≥ 4.5:1 (text)
- ✅ Color contrast ratio ≥ 3:1 (UI components)
- ✅ Keyboard navigation (tab, arrow keys)
- ✅ Focus indicators (visible ring)
- ✅ ARIA labels for screen readers
- ✅ Alt text for images
- ✅ Semantic HTML (`<header>`, `<nav>`, `<main>`, `<section>`)
- ✅ Skip to main content link
- ✅ Form labels and error messages

**Testing:**
- Use axe DevTools for automated testing
- Manual keyboard navigation testing
- Screen reader testing (VoiceOver, NVDA)

### 4.8 Animations & Transitions

**Principles:**
- Subtle and purposeful
- Fast (150-300ms)
- Respect `prefers-reduced-motion`

**Transitions:**
- Hover states: `transition-colors duration-150`
- Modals: `transition-opacity duration-300`
- Slides: `transition-transform duration-300`
- Charts: Animated on load (1s delay)

**Animations:**
- Loading spinners
- Progress bars
- Timeline playback
- New classification flash (pulse)
- Confidence change highlight (fade-in)

---

## 5. Data Flow & Architecture

### 5.1 System Architecture

```
┌──────────────────────────────────────────────┐
│             Frontend (Next.js)               │
│  ┌────────────────────────────────────────┐  │
│  │  React Components                      │  │
│  │  - Pages (Dashboard, Explorer, etc.)   │  │
│  │  - UI Components (shadcn/ui)           │  │
│  │  - Charts (Recharts)                   │  │
│  └────────────────┬───────────────────────┘  │
│                   │ Fetch/Axios              │
│                   ▼                          │
│  ┌────────────────────────────────────────┐  │
│  │  API Client (lib/api.ts)               │  │
│  │  - Auth wrapper                        │  │
│  │  - Error handling                      │  │
│  │  - Type-safe requests                  │  │
│  └────────────────┬───────────────────────┘  │
└───────────────────┼──────────────────────────┘
                    │ HTTP/JSON
                    ▼
┌──────────────────────────────────────────────┐
│             Backend (Flask)                  │
│  ┌────────────────────────────────────────┐  │
│  │  API Routes                            │  │
│  │  - /api/profile                        │  │
│  │  - /api/classifications                │  │
│  │  - /api/memory                         │  │
│  │  - /api/analysis                       │  │
│  └────────────────┬───────────────────────┘  │
│                   │                          │
│  ┌────────────────▼───────────────────────┐  │
│  │  Business Logic                        │  │
│  │  - Query builder                       │  │
│  │  - Data transformers                   │  │
│  │  - Analysis runner                     │  │
│  └────────────────┬───────────────────────┘  │
│                   │                          │
│  ┌────────────────▼───────────────────────┐  │
│  │  Database Layer (db/queries.py)        │  │
│  │  - Parameterized queries               │  │
│  │  - User-scoped access                  │  │
│  └────────────────┬───────────────────────┘  │
└───────────────────┼──────────────────────────┘
                    │ sqlite3
                    ▼
┌──────────────────────────────────────────────┐
│    SQLite Database (data/*.db)               │
│  ┌────────────────────────────────────────┐  │
│  │  Tables:                               │  │
│  │  - semantic_memory (classifications)   │  │
│  │  - episodic_memory (emails)            │  │
│  │  - users (future)                      │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 5.2 Backend API Endpoints

**Authentication:**

```
POST /api/auth/login
  Body: { user_id: string }
  Response: { success: true, user: { id, name } }
  Sets httpOnly session cookie

POST /api/auth/logout
  Response: { success: true }
  Clears session cookie

GET /api/auth/me
  Response: { user: { id, name } } | { error: "Not authenticated" }
```

**Profile:**

```
GET /api/users
  Response: { users: [{ id: string, email_count: number, last_updated: string }] }

GET /api/profile/:user_id
  Response: { profile: IABConsumerProfile }
  Full JSON profile matching schema

GET /api/profile/:user_id/stats
  Response: {
    total_classifications: number,
    avg_confidence: number,
    emails_analyzed: number,
    section_breakdown: {
      demographics: number,
      household: number,
      interests: number,
      purchase_intent: number
    },
    memory_stats: {
      semantic_count: number,
      episodic_count: number
    }
  }
```

**Classifications:**

```
GET /api/classifications/:user_id
  Query Params: ?section=interests&min_confidence=0.8&limit=50&offset=0
  Response: {
    classifications: [
      {
        taxonomy_id: number,
        section: string,
        tier_path: string,
        value: string,
        confidence: number,
        evidence_count: number,
        last_validated: string
      }
    ],
    total: number,
    page: number,
    pages: number
  }

GET /api/classifications/:user_id/:taxonomy_id
  Response: {
    classification: { ... },
    evidence: [
      {
        email_id: string,
        email_date: string,
        email_subject: string,
        confidence_before: number,
        confidence_after: number,
        contribution: number
      }
    ],
    confidence_history: [
      { date: string, confidence: number }
    ]
  }
```

**Memory:**

```
GET /api/memory/semantic/:user_id
  Response: {
    memories: [
      {
        id: string,
        taxonomy_id: number,
        value: string,
        confidence: number,
        evidence_count: number,
        created_at: string,
        last_validated: string
      }
    ]
  }

GET /api/memory/episodic/:user_id
  Query Params: ?limit=100&offset=0
  Response: {
    memories: [
      {
        id: string,
        email_id: string,
        email_date: string,
        email_subject: string,
        processed_at: string
      }
    ],
    total: number
  }

GET /api/memory/timeline/:user_id
  Response: {
    timeline: [
      {
        email_index: number,
        email_date: string,
        classifications_count: {
          demographics: number,
          household: number,
          interests: number,
          purchase_intent: number
        },
        avg_confidence: {
          demographics: number,
          household: number,
          interests: number,
          purchase_intent: number
        },
        new_classifications: [taxonomy_id, ...]
      }
    ]
  }
```

**Analysis (3-Step Discrete Workflow):**

```
# Full Pipeline (All 3 Steps)
POST /api/analyze/full
  Body: {
    provider: "gmail" | "outlook" | "combined",
    max_emails: number,
    email_model: string,
    taxonomy_model: string,
    force_reprocess?: boolean
  }
  Response: {
    job_id: string,
    status: "queued",
    steps: ["download", "summarize", "classify"]
  }

# Step 1: Email Download
POST /api/analyze/download
  Body: {
    provider: "gmail" | "outlook" | "combined",
    max_emails: number
  }
  Response: {
    job_id: string,
    status: "queued",
    output_file: "emails_raw.csv"
  }

# Step 2: Email Summarization
POST /api/analyze/summarize
  Body: {
    input_csv: string,
    email_model: string
  }
  Response: {
    job_id: string,
    status: "queued",
    output_file: "emails_summaries.csv"
  }

# Step 3: IAB Classification
POST /api/analyze/classify
  Body: {
    input_csv: string,
    taxonomy_model: string,
    force_reprocess?: boolean
  }
  Response: {
    job_id: string,
    status: "queued",
    output_file: "user_profile.json"
  }

# Job Status Polling
GET /api/analyze/status/:job_id
  Response: {
    job_id: string,
    status: "queued" | "running" | "completed" | "failed",
    current_step: "download" | "summarize" | "classify",
    progress: {
      current: number,
      total: number,
      percent: number
    },
    result?: {
      emails_processed: number,
      classifications_added: number,
      cost_usd: number
    },
    checkpoint_files?: {
      raw_csv?: string,
      summaries_csv?: string,
      profile_json?: string
    },
    error?: string
  }

# Available Models
GET /api/analyze/models
  Response: {
    email_models: [
      { id: string, name: string, provider: string, cost_per_1k: number }
    ],
    taxonomy_models: [
      { id: string, name: string, provider: string, cost_per_1k: number }
    ]
  }

# Real-time Logs
GET /api/analyze/logs/:job_id
  Response: Server-Sent Events stream
  Event format: { timestamp: string, level: string, message: string, step: string }
```

### 5.3 Database Schema

**Existing Tables (from LangMem/SQLite):**

```sql
-- Semantic Memory (Classifications)
CREATE TABLE semantic_memory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  section TEXT,  -- demographics, household, interests, purchase_intent
  taxonomy_id INTEGER,
  tier_path TEXT,
  value TEXT NOT NULL,
  confidence REAL,
  evidence_count INTEGER,
  last_validated TEXT,
  days_since_validation INTEGER,
  created_at TEXT,
  updated_at TEXT
);

-- Episodic Memory (Email records)
CREATE TABLE episodic_memory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  email_id TEXT NOT NULL,
  email_date TEXT,
  email_subject TEXT,
  processed_at TEXT,
  created_at TEXT
);

-- Indexes
CREATE INDEX idx_semantic_user ON semantic_memory(user_id);
CREATE INDEX idx_semantic_taxonomy ON semantic_memory(taxonomy_id);
CREATE INDEX idx_episodic_user ON episodic_memory(user_id);
```

**Query Patterns:**

```python
# Get all classifications for a user
SELECT * FROM semantic_memory
WHERE user_id = ?
AND namespace = 'iab_taxonomy'
ORDER BY confidence DESC;

# Get evidence for a classification
SELECT em.* FROM episodic_memory em
JOIN semantic_memory sm ON em.user_id = sm.user_id
WHERE sm.taxonomy_id = ? AND sm.user_id = ?
ORDER BY em.processed_at ASC;

# Timeline data (aggregate)
SELECT
  em.processed_at,
  COUNT(DISTINCT sm.id) as classification_count,
  AVG(sm.confidence) as avg_confidence
FROM episodic_memory em
LEFT JOIN semantic_memory sm ON em.user_id = sm.user_id
WHERE em.user_id = ?
GROUP BY em.processed_at
ORDER BY em.processed_at ASC;
```

### 5.4 Data Privacy & Security

**Privacy Requirements:**

✅ **Local Storage:**
- All data in SQLite database on local machine
- No cloud sync or external storage

✅ **No External Calls:**
- Dashboard makes zero external API calls
- No telemetry, analytics, or tracking
- No third-party scripts (except essential UI libraries)

✅ **User Isolation:**
- Database queries ALWAYS scoped to user_id
- Session-based auth prevents cross-user access
- No shared data between users

✅ **Content Protection:**
- Email content NOT stored in dashboard database
- Only summaries/metadata displayed
- Full content remains in source (Gmail/Outlook)

✅ **Secure Sessions:**
- httpOnly cookies (no JS access)
- SameSite=Strict (CSRF protection)
- Session timeout (24h)
- Secure flag in production (HTTPS only)

**Security Best Practices:**

```python
# Backend (Flask)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
app.config['SESSION_COOKIE_SECURE'] = True  # Production only
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# Parameterized queries (prevent SQL injection)
cursor.execute(
  "SELECT * FROM semantic_memory WHERE user_id = ?",
  (user_id,)
)

# Input validation
def validate_user_id(user_id: str) -> bool:
  return bool(re.match(r'^[a-zA-Z0-9_-]+$', user_id))

# Rate limiting (future)
from flask_limiter import Limiter
limiter = Limiter(app, key_func=get_remote_address)
@limiter.limit("10 per minute")
def run_analysis():
  ...
```

**Frontend Security:**

```typescript
// API client with auth
const api = {
  async get(url: string) {
    const res = await fetch(url, {
      credentials: 'include',  // Send cookies
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  }
}

// XSS prevention (React escapes by default)
<div>{userInput}</div>  // Automatically escaped

// Don't use dangerouslySetInnerHTML unless necessary
```

### 5.5 Performance Optimization

**Backend:**

- **Database Indexes:** Add indexes on frequently queried columns
  - `user_id` (most queries filter by user)
  - `taxonomy_id` (evidence lookup)
  - `confidence` (sorting)

- **Query Optimization:**
  - Use LIMIT/OFFSET for pagination
  - Avoid SELECT * (specify needed columns)
  - Use aggregate queries for stats

- **Caching (Future):**
  - Flask-Caching for expensive queries
  - Redis for session storage (production)
  - Cache profile stats (invalidate on update)

**Frontend:**

- **Code Splitting:**
  - Next.js automatic code splitting
  - Lazy load chart libraries
  - Dynamic imports for heavy components

- **Data Fetching:**
  - SWR or React Query for caching
  - Optimistic updates for better UX
  - Pagination for large tables

- **Rendering:**
  - Virtual scrolling for long lists (react-window)
  - Memoization for expensive computations
  - Server-side rendering for initial page load

- **Assets:**
  - Next.js Image component (automatic optimization)
  - WebP format for images
  - Font subsetting

**Performance Targets:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial Load | < 2s | Lighthouse |
| Time to Interactive | < 3s | Lighthouse |
| First Contentful Paint | < 1s | Lighthouse |
| API Response | < 200ms | Backend logs |
| Chart Render | < 500ms | React Profiler |

---

## 6. Development Phases

### 6.1 Phase 1: MVP (Current Scope)

**Goal:** Build functional admin dashboard for internal validation

**Timeline:** 2-3 weeks (estimated)

**Deliverables:**

1. **Backend API (Week 1)**
   - Flask app setup
   - Database query layer
   - Authentication endpoints
   - Profile endpoints
   - Classifications endpoints
   - Memory endpoints
   - Analysis runner (basic)

2. **Frontend Core (Week 1-2)**
   - Next.js project setup
   - shadcn/ui installation
   - Layout with theme toggle
   - Navigation
   - Main Dashboard page
   - Classification Explorer page
   - Evidence Viewer page

3. **Advanced Features (Week 2-3)**
   - Memory Timeline page
   - Confidence Analysis page
   - Mission Preview page
   - Analysis Runner UI
   - Charts integration
   - Mobile responsiveness

4. **Polish (Week 3)**
   - Dark mode refinement
   - Accessibility testing
   - Performance optimization
   - Documentation
   - Deployment setup

**Success Criteria:**
- ✅ All pages functional
- ✅ Mobile responsive
- ✅ Light/dark mode working
- ✅ Can run analysis from dashboard
- ✅ Evidence trail complete for all classifications
- ✅ Load time < 2 seconds

---

### 6.2 Phase 2: Production Features (Future)

**Not in current scope. To be planned later.**

**Features:**
- Production OAuth2 (Gmail/Outlook)
- Multi-user support
- User management dashboard
- Advanced analytics
- Export reports (PDF, CSV)
- Email notifications
- Real-time updates (WebSocket)
- Advanced filtering
- Saved views/bookmarks
- Human-in-the-loop feedback
- Manual classification editing
- Conflicting evidence resolution
- Cloud deployment (Docker + Docker Compose)

---

### 6.3 Phase 3: Consumer Mission App (Future)

**Not in current scope. To be planned later.**

**Features:**
- Card-based swipeable interface (per Figma)
- Mission generator (IAB → Cards)
- Bottom navigation (Home, Savings, Ikigai, Health)
- Emoji feedback (😊😐)
- Action CTAs (Basket, Reserve, Call, etc.)
- Personalization engine
- React Native app (iOS + Android)
- OR Next.js PWA (web-based)
- Push notifications
- Offline support
- Analytics (privacy-respecting)

---

## 7. File Structure

```
dashboard/
├── backend/
│   ├── app.py                      # Flask application entry point
│   ├── config.py                   # Configuration (dev, prod)
│   ├── requirements.txt            # Python dependencies
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py                 # Authentication routes
│   │   ├── profile.py              # Profile endpoints
│   │   ├── classifications.py      # Classification endpoints
│   │   ├── memory.py               # Memory endpoints
│   │   └── analysis.py             # Analysis runner
│   ├── db/
│   │   ├── __init__.py
│   │   └── queries.py              # Database queries
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── validators.py           # Input validation
│   │   └── transformers.py         # Data transformers
│   └── tests/
│       ├── test_api.py
│       └── test_db.py
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (theme provider)
│   │   ├── page.tsx                # Main Dashboard
│   │   ├── globals.css             # Global styles
│   │   ├── classifications/
│   │   │   └── page.tsx            # Classification Explorer
│   │   ├── evidence/
│   │   │   └── [taxonomy_id]/
│   │   │       └── page.tsx        # Evidence Viewer
│   │   ├── timeline/
│   │   │   └── page.tsx            # Memory Timeline
│   │   ├── confidence/
│   │   │   └── page.tsx            # Confidence Analysis
│   │   └── missions/
│   │       └── page.tsx            # Mission Preview
│   ├── components/
│   │   ├── ui/                     # shadcn components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── accordion.tsx
│   │   │   └── separator.tsx
│   │   ├── charts/
│   │   │   ├── confidence-chart.tsx
│   │   │   ├── timeline-chart.tsx
│   │   │   └── distribution-chart.tsx
│   │   ├── shared/
│   │   │   ├── header.tsx
│   │   │   ├── navigation.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   ├── confidence-gauge.tsx
│   │   │   ├── evidence-timeline.tsx
│   │   │   ├── classification-card.tsx
│   │   │   └── mission-card-preview.tsx
│   │   └── analysis/
│   │       ├── analysis-modal.tsx
│   │       └── progress-tracker.tsx
│   ├── lib/
│   │   ├── api.ts                  # API client
│   │   ├── utils.ts                # Utility functions
│   │   ├── types.ts                # TypeScript types
│   │   └── constants.ts            # Constants (colors, etc.)
│   ├── public/
│   │   ├── favicon.ico
│   │   └── images/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── postcss.config.js
│
├── shared/
│   └── types/
│       └── iab-profile.ts          # Shared TypeScript types
│
├── docker-compose.yml              # Local development (future)
├── Dockerfile                      # Production build (future)
├── .env.example                    # Environment variables template
└── README.md                       # Setup instructions
```

---

## 8. Success Criteria

The dashboard is considered successful when:

### 8.1 Functional Requirements

- ✅ User can log in with user ID (session-based)
- ✅ User can run email analysis from dashboard (CSV, Gmail, Outlook)
- ✅ All classifications visible in sortable, filterable table
- ✅ User can drill down to evidence for any classification
- ✅ Confidence evolution visualized over time (charts)
- ✅ Memory timeline shows incremental profile building
- ✅ Mission preview demonstrates consumer card generation
- ✅ Analysis progress tracked in real-time

### 8.2 Performance Requirements

- ✅ Initial page load < 2 seconds
- ✅ API responses < 200ms (p95)
- ✅ Chart render < 500ms
- ✅ Table pagination smooth (no lag)
- ✅ Mobile scroll performance 60fps

### 8.3 UX Requirements

- ✅ Intuitive navigation (no training needed)
- ✅ Clear visual hierarchy
- ✅ Consistent design language
- ✅ Helpful tooltips and labels
- ✅ Error states with clear messages
- ✅ Loading states for all async operations

### 8.4 Design Requirements

- ✅ Works seamlessly on mobile and desktop
- ✅ Light mode and dark mode functional
- ✅ Accessible (WCAG 2.1 AA)
- ✅ Responsive breakpoints smooth
- ✅ Typography scale consistent
- ✅ Color palette applied correctly

### 8.5 Privacy Requirements

- ✅ No privacy leaks (all data stays local)
- ✅ User-scoped data access enforced
- ✅ Email content not displayed
- ✅ No external API calls from dashboard
- ✅ Secure session handling

### 8.6 Code Quality Requirements

- ✅ TypeScript strict mode (no `any`)
- ✅ ESLint passing (no errors)
- ✅ Accessible components (axe-core)
- ✅ Backend tests passing (>80% coverage)
- ✅ API endpoints documented

---

## 9. Open Questions

Before starting implementation, please confirm:

### 9.1 LLM Reasoning Storage

**Question:** Should we log and store LLM responses explaining why each classification was made?

**Pros:**
- Helps debug incorrect classifications
- Provides transparency in evidence viewer
- Useful for improving prompts

**Cons:**
- Increases database size
- Privacy concern (LLM might reference email content)
- Extra storage/processing overhead

**Decision:** ✅ **YES** - Store LLM reasoning

**Implementation:**
- Add `llm_reasoning` field to semantic_memory table
- Display reasoning in Evidence Viewer (expandable section)
- Privacy: Reasoning should reference concepts, not verbatim email content
- Storage: Text field, ~500 chars max per classification

---

### 9.2 Email Summaries

**Question:** Should we store email summaries in the dashboard database, or only email IDs?

**Decision:** ✅ **Store Summaries**

**Implementation:**
- Add `email_summary` field to episodic_memory table
- Use existing summaries from CSV or generate during processing
- Display in Evidence Viewer for context
- Privacy: Summaries are already generated during analysis, not raw content
- Storage: Text field, ~200 chars max

---

### 9.3 Cost Tracking UI

**Question:** Should the dashboard show LLM costs per analysis run?

**Decision:** ✅ **YES** - Show detailed cost breakdown

**Implementation:**
- Display on Main Dashboard (overview card)
- Show in Analysis Results modal after run completes
- Include:
  - Total cost (all-time)
  - Cost this run
  - Cost per email
  - Breakdown by provider (OpenAI, Claude, Ollama)
- Add cost history chart (optional)

---

### 9.4 Taxonomy Browser

**Question:** Want a separate page to browse the full IAB taxonomy (1,568 categories)?

**Decision:** ✅ **YES** - But only for matched categories

**Implementation:**
- "Active Categories" page showing only categories with matches
- Hierarchical tree view (collapsible sections)
- Show count of classifications per category
- Filter by section (Demographics, Household, etc.)
- Search by category name
- Click to view all classifications in that category
- **NOT showing:** All 1,568 categories (too overwhelming)

---

### 9.5 Comparison Mode (Time-based Analysis)

**Question:** Want to compare profile changes over time?

**Decision:** ✅ **YES** - Critical feature for tracking evolution

**Implementation (Phase 1 - MVP):**
- **Confidence Change Tracking:**
  - Table showing classifications with biggest changes
  - Highlight new classifications (appeared in last N days)
  - Highlight removed/stale classifications (no evidence in 30+ days)
  - Time filter: 24h, 7d, 30d, All time

- **Timeline Scrubbing:**
  - Memory Timeline page with slider
  - Scrub to any point in time
  - See profile state at that moment
  - Play/pause animation

**Implementation (Future - Phase 2):**
- Side-by-side date comparison ("Jan 1 vs Today")
- Historical snapshots (daily/weekly profile saves)
- Diff view (added/removed/changed)
- Export comparison report

---

### 9.6 Export Functionality

**Question:** What export formats do you need?

**Decision:** 🤔 **Defer to Phase 2**

**Current Support:**
- ✅ JSON (full profile) - already implemented in backend

**Future Consideration:**
- CSV (classifications table)
- PDF report with charts
- PNG chart screenshots
- Mission card previews as images

**Rationale:** Focus on core validation features first, add exports based on actual usage patterns

---

## 10. Next Steps

1. **Review this document** and answer open questions
2. **Confirm technical stack** (any changes?)
3. **Prioritize features** (must-have vs nice-to-have for MVP)
4. **Set timeline** (realistic estimate for Phase 1)
5. **Begin implementation** (start with backend API)

---

**Document Version:** 1.0
**Last Updated:** October 1, 2025
**Status:** ✅ Approved | ⏳ Pending Review | ❌ Rejected
