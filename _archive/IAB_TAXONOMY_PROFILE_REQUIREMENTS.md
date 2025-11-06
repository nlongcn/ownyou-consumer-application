# IAB Audience Taxonomy Profile System - Requirements Document

## Project Overview

Build an evidence-based consumer profiling system that analyzes email communications and maps findings to the IAB Tech Lab Audience Taxonomy 1.1 standard. The system uses LangGraph workflows and LangMem persistent memory to maintain and evolve confidence scores over time through daily incremental processing.

## Core Objectives

1. **Taxonomy Mapping**: Map email content to IAB Audience Taxonomy 1.1 values (ONLY existing taxonomy values, never create custom values)
2. **Confidence Evolution**: Maintain confidence scores (0.0-1.0) that strengthen with confirming evidence, weaken with contradictory evidence, and decay when stale
3. **Incremental Processing**: Process ONLY new emails in daily runs (avoid reprocessing)
4. **Memory-Based Learning**: Use LangMem to remember past classifications and improve confidence over time
5. **Future Extensibility**: Prepare architecture for future bank account transaction integration

## Data Sources

### Input Files

**Primary Data**: `emails_processed.csv`
- 200 emails with columns: ID, Date, From, Subject, Summary, Category, Products, Key_Topics, Status, Confidence scores
- Mix of newsletters, personal communications, receipts, security alerts, event invitations

**Taxonomy Reference**: `IABTL-Audience-Taxonomy-1.1-Final.xlsx`
- **Main Sheet** ('Consolidated'): 1,568 rows with hierarchical taxonomy
  - Column A: Unique ID (1-1568)
  - Column B: Parent ID
  - Column C: Condensed Name (pipe-separated path)
  - Columns E-I: Tier 1 through Tier 5
- **Purchase Intent Sheet** ('Purchase Intent Classification'): 23 rows
  - PIPR codes (Past Purchase Recency): PIPR1-8 (<1 day to >12 months)
  - PIPF codes (Past Purchase Frequency): PIPF1-3 (Infrequent/Moderate/Frequent)
  - PIPV codes (Past Purchase Value): PIPV1-3 (Low/Average/High Spender)
  - PIFI codes (Future Buyer Intent): PIFI1-3 (Low/Medium/High)

## Taxonomy Categories to Extract

### 1. Demographics (Rows 11-62)
- **Age Range** (rows 11-24): 18-20, 21-24, 25-29, 30-34, 35-39, 40-44, 45-49, 50-54, 55-59, 60-64, 65-69, 70-74, 75+
- **Education & Occupation** (rows 27-57): Education level + occupation categories
- **Gender** (rows 59-62): Female, Male, Other Gender, Unknown Gender

### 2. Household Data (Rows 64-168)
- Location (Country, Region/State, City, Metro/DMA, Zip/Postal Code)
- Household Income (USD ranges)
- Length of Residence
- Life Stage
- Median Home Value
- Monthly Housing Payment
- Number of Adults
- Number of Children
- Number of Individuals (total household size)
- Ownership (Own/Rent)
- Property Type
- Urbanization level

### 3. Personal Attributes (Rows 169-172)
- Language
- Marital Status

### 4. Personal Finance (Rows 175-207)
- Income levels (USD ranges: $10K-$14,999 through $250K+)
- Personal Level Affluence (USD ranges + bands: Negative to Super High Net Worth)

### 5. Interests (Rows 209-704)
Categories include:
- Academic Interests
- Arts & Entertainment
- Automotive
- Business & Finance
- Careers & Education
- Family & Relationships
- Fashion & Beauty
- Food & Dining
- Health & Wellness
- Hobbies & Leisure
- Home & Garden
- Law & Government
- News & Politics
- Pets
- Real Estate
- Religion & Spirituality
- Science & Technology
- Shopping
- Sports & Fitness
- Travel

### 6. Purchase Intent (Rows 707-1568)
Product/service categories for purchase intent signals:
- Apps (by category)
- Apparel & Accessories
- Automotive
- Baby & Children's Products
- Beauty & Personal Care
- Books & Media
- Business Products & Services
- Consumer Electronics
- Education
- Entertainment
- Events & Attractions
- Financial Services
- Food & Beverage
- Gaming
- Gifts & Occasions
- Health & Medical
- Home & Garden
- Office Supplies
- Pet Care & Supplies
- Real Estate
- Sports & Recreation
- Technology Hardware/Software
- Telecommunications
- Travel & Hospitality

**CRITICAL**: For each purchase intent/purchase, include Purchase Intent Classification codes:
- **PIPR** (Recency): Evidence from order confirmations, shipping notifications, receipt dates
- **PIPF** (Frequency): Count of purchase occurrences over time
- **PIPV** (Value): Infer spending level from product categories, retailers, price signals
- **PIFI** (Future Intent): Analyze browsing patterns, cart abandonment, wishlist emails, newsletter engagement

### 7. Actual Purchases (Same Rows 707-1568)
- Confirmed past purchases with same taxonomy structure
- Evidence: receipts, shipping confirmations, order updates
- Include PIPR/PIPF/PIPV classifications based on transaction history

## Confidence Scoring Requirements

### Confidence Scale
- **0.8-1.0**: High confidence (multiple strong signals, cross-validated)
- **0.5-0.79**: Moderate confidence (some evidence, needs validation)
- **0.0-0.49**: Low confidence (weak/single signal, speculative)

### Confidence Evolution Rules

**1. Initial Assignment**
- LLM assigns initial confidence (0.0-1.0) based on evidence quality in email
- **Evidence Quality Validation (NEW - Phase 3.5):** LLM-as-Judge evaluates reasoning appropriateness
  - **Explicit evidence** (e.g., "I'm 32", "Mr./Ms."): quality = 1.0 → no confidence adjustment
  - **Contextual evidence** (e.g., "graduated 2015" → age ~30-35): quality = 0.7 → confidence × 0.7
  - **Weak evidence** (vague signals): quality = 0.4 → confidence × 0.4
  - **Inappropriate evidence** (age from products, gender from interests): quality = 0.0 → BLOCKED
- Adjusted confidence = original_confidence × evidence_quality_score
- Store evidence: email IDs, reasoning (validated), final adjusted confidence

**2. Confirming Evidence** (Bayesian-style update)
```
new_confidence = current + (1 - current) * new_evidence_strength * 0.3
```
- Multiple emails supporting same classification → increase confidence
- Example: 5 crypto newsletters → "Interest: Cryptocurrency" confidence grows 0.6 → 0.7 → 0.82

**3. Contradicting Evidence**
```
new_confidence = current * (1 - contradiction_strength * 0.5)
```
- New evidence conflicts with existing classification → reduce confidence
- Example: Profile says "No Children" but baby product receipt arrives → reconsider

**4. Temporal Decay** (No new evidence)
```
decay_rate = 0.01 * (days_since_last_validation / 7)
new_confidence = current * (1 - decay_rate)
```
- 1% confidence decay per week without validation
- Prevents stale data from maintaining high confidence indefinitely

**5. Recalibration**
- When confidence drops below 0.5, mark for re-evaluation
- Consider removing classification if confidence falls below 0.2

## Technical Architecture

### Core Technologies
- **LangGraph**: Stateful workflow orchestration with conditional edges
- **LangMem**: Persistent memory across daily runs with semantic/episodic storage
- **PostgreSQL**: Production storage backend (development: SQLite)
- **Existing Stack**: Pandas, Pydantic, OpenAI/Claude/Ollama LLM clients

### LangGraph Workflow Structure

```
START
  ↓
[Load New Emails]
  - Filter already-processed email IDs
  - Load only new emails from CSV
  ↓
[Retrieve Existing Profile]
  - Query LangMem for current taxonomy selections
  - Load confidence scores, evidence trails
  ↓
[Parallel Analysis Nodes] (conditional routing based on email content)
  ├─ [Demographics Extractor] → age, gender, education, marital status, language
  ├─ [Household Analyzer] → location, income, family size, property type
  ├─ [Interests Mapper] → 495 interest categories
  └─ [Purchase Agent] → intent + actual purchases with PIPR/PIPF/PIPV/PIFI codes
  ↓
[Evidence Reconciliation]
  - Compare new extractions vs existing memories
  - Classify: confirming / contradicting / neutral / no_new_evidence
  ↓
[Confidence Update]
  - Apply Bayesian-style updates
  - Calculate temporal decay for unvalidated facts
  - Update confidence scores
  ↓
[Memory Consolidation]
  - Update LangMem semantic memories
  - Store episodic memories (evidence trail)
  - Track processed email IDs
  ↓
[Generate JSON Report]
  - Export updated profile with all taxonomy categories
  - Include confidence scores, evidence counts, metadata
  ↓
END
```

### Conditional Edge Logic
- **Receipt/shipping emails** → Route to Purchase Agent
- **Newsletter topics** → Route to Interests Mapper
- **Personal correspondence** → Route to Demographics Extractor
- **Service updates/bills** → Route to Household Analyzer
- **Multi-signal emails** → Route to multiple analyzers in parallel

### LangMem Memory Structure

**Namespace**: `(user_id, "iab_taxonomy_profile")`

**Semantic Memories** (Facts about user):
```json
{
  "memory_id": "demo_age_range_25_29",
  "taxonomy_id": 5,
  "category_path": "Demographic | Age Range | 25-29",
  "value": "25-29",
  "confidence": 0.75,
  "evidence_count": 8,
  "supporting_evidence": ["email_id_1", "email_id_5", ...],
  "contradicting_evidence": [],
  "last_validated": "2025-09-30",
  "first_observed": "2025-09-15",
  "days_since_validation": 0
}
```

**Episodic Memories** (Evidence trail):
```json
{
  "episode_id": "email_19989c11387876ec",
  "email_id": "19989c11387876ec",
  "date": "2025-09-27",
  "taxonomy_selections": [5, 156, 342],
  "confidence_contributions": {
    "5": 0.8,
    "156": 0.6,
    "342": 0.9
  },
  "reasoning": "Newsletter topics (crypto, tech startups) suggest tech professional age 25-35, high income bracket"
}
```

**Processed Email Tracking**:
```json
{
  "collection": "processed_emails",
  "email_ids": ["19989c11387876ec", "199876daa93f05dd", ...]
}
```

## Daily Run Workflow

### Day 1: Initial Analysis
- Input: 200 emails
- Process: All 200 emails through workflow
- Output: Initial profile with baseline confidence scores
- Memory: Store 200 semantic memories + episodic evidence

### Day 2: Incremental Update
- Input: 210 total emails (10 new)
- Filter: `new_emails = all_emails - processed_email_ids` → 10 emails
- Process: Only 10 new emails
- Update: Confidence scores based on confirming/contradicting evidence
- Memory: Add 10 new episodes, update affected semantic memories

### Day 30: Temporal Decay Check
- Process: No new emails
- Update: Apply temporal decay to all memories
- Example: "Interest: Cryptocurrency" (last validated Day 2) → confidence 0.82 → 0.78 (4-week decay)

### Day 45: Contradiction Handling
- Input: Email with baby product receipt
- Existing: "Household | Number of Children: 0" (confidence 0.7)
- Update: New evidence contradicts → confidence 0.7 → 0.35 → mark for re-evaluation

## Output Format

### JSON Report Schema
```json
{
  "user_id": "user_12345",
  "profile_version": 5,
  "generated_at": "2025-09-30T10:00:00Z",
  "schema_version": "1.0",
  "generator": {
    "system": "email_parser_iab_taxonomy",
    "llm_model": "claude:sonnet-4",
    "workflow_version": "1.0"
  },
  "data_coverage": {
    "total_emails_analyzed": 200,
    "emails_this_run": 15,
    "date_range": "2025-07-15 to 2025-09-30"
  },

  "demographics": {
    "age_range": {
      "taxonomy_id": 5,
      "tier_path": "Demographic | Age Range | 25-29",
      "value": "25-29",
      "confidence": 0.82,
      "evidence_count": 12,
      "last_validated": "2025-09-30",
      "days_since_validation": 0
    },
    "gender": {
      "taxonomy_id": 60,
      "tier_path": "Demographic | Gender | Male",
      "value": "Male",
      "confidence": 0.65,
      "evidence_count": 4,
      "last_validated": "2025-09-25",
      "days_since_validation": 5
    },
    "education": {...},
    "occupation": {...},
    "marital_status": {...},
    "language": {...}
  },

  "household": {
    "location": {
      "country": {...},
      "region_state": {...},
      "city": {...},
      "metro_dma": {...},
      "zip_postal": {...}
    },
    "income": {...},
    "property": {...},
    "family_composition": {...}
  },

  "interests": [
    {
      "taxonomy_id": 342,
      "tier_path": "Interest | Technology | Cryptocurrency",
      "category": "Cryptocurrency",
      "confidence": 0.89,
      "evidence_count": 23,
      "last_validated": "2025-09-30"
    },
    {
      "taxonomy_id": 445,
      "tier_path": "Interest | Finance | Investment",
      "category": "Investment",
      "confidence": 0.76,
      "evidence_count": 15,
      "last_validated": "2025-09-28"
    }
  ],

  "purchase_intent": [
    {
      "taxonomy_id": 812,
      "tier_path": "Purchase Intent | Technology | Laptops",
      "category": "Laptops",
      "confidence": 0.78,
      "evidence_count": 5,
      "classifications": {
        "PIPR3": {
          "code": "PIPR3",
          "description": "<14 days",
          "confidence": 0.85,
          "evidence": "Newsletter browsing behavior, price comparison emails"
        },
        "PIPF2": {
          "code": "PIPF2",
          "description": "Moderate Purchaser",
          "confidence": 0.70,
          "evidence": "3 tech purchases in past 6 months"
        },
        "PIPV3": {
          "code": "PIPV3",
          "description": "High Spender",
          "confidence": 0.65,
          "evidence": "Premium brand newsletters (Apple, Dell XPS)"
        },
        "PIFI2": {
          "code": "PIFI2",
          "description": "Medium",
          "confidence": 0.72,
          "evidence": "Product research emails, comparison shopping"
        }
      },
      "last_validated": "2025-09-29"
    }
  ],

  "actual_purchases": [
    {
      "taxonomy_id": 812,
      "tier_path": "Purchase Intent | Technology | Laptops",
      "category": "Laptops",
      "purchase_date": "2025-09-20",
      "confidence": 0.95,
      "evidence": "Order confirmation from Dell",
      "classifications": {
        "PIPR3": {
          "code": "PIPR3",
          "description": "<14 days",
          "confidence": 1.0,
          "evidence": "Receipt dated 2025-09-20"
        },
        "PIPV3": {
          "code": "PIPV3",
          "description": "High Spender",
          "confidence": 0.9,
          "evidence": "Dell XPS 15 (~$2000 product tier)"
        }
      }
    }
  ],

  "memory_stats": {
    "total_facts_stored": 45,
    "high_confidence_facts": 28,
    "moderate_confidence_facts": 12,
    "low_confidence_facts": 5,
    "facts_needing_validation": 7,
    "average_confidence": 0.74
  },

  "section_confidence": {
    "demographics": 0.73,
    "household": 0.68,
    "interests": 0.82,
    "purchase_intent": 0.75,
    "actual_purchases": 0.91
  }
}
```

## CLI Integration

### Command
```bash
python -m src.email_parser.main --iab-profile emails_processed.csv [options]
```

### Options
- `--iab-profile <csv_file>`: Path to processed emails CSV
- `--user-id <id>`: User identifier for memory namespace (default: "default_user")
- `--model <model_name>`: LLM model for analysis (claude/openai/ollama)
- `--storage <type>`: Storage backend (sqlite/postgresql)
- `--output-dir <path>`: Output directory for JSON reports (default: consumer_profiles/)
- `--force-reprocess`: Reprocess all emails (ignore processed tracking)
- `--dry-run`: Show what would be processed without updating memory
- `--confidence-threshold <float>`: Minimum confidence to include in report (default: 0.3)

## Future Extensibility

### Bank Account Integration (Phase 2)
- Purchase Agent already designed to handle transaction data
- Bank transactions provide definitive purchase evidence:
  - **PIPR**: Exact transaction dates
  - **PIPF**: Precise purchase frequency counts
  - **PIPV**: Actual dollar amounts spent
  - Merchant categories → IAB taxonomy mapping
- Same memory update workflow applies
- High-confidence purchase data (0.95-1.0) from bank records

### Multi-User System
- Each user has isolated memory namespace: `(user_id, "iab_taxonomy_profile")`
- User profiles ONLY accessible to that user (privacy requirement)
- Shared taxonomy definitions, isolated user data
- User authentication layer (future scope)

## Success Criteria

### Functional Requirements
✅ System processes only new emails in daily runs
✅ All taxonomy values come from IAB standard (no custom values)
✅ Confidence scores evolve based on evidence accumulation
✅ Temporal decay reduces confidence for unvalidated facts
✅ Contradicting evidence appropriately lowers confidence
✅ Purchase Intent Classifications (PIPR/PIPF/PIPV/PIFI) assigned with evidence
✅ JSON reports include all required taxonomy sections with confidence scores

### Quality Requirements
✅ Confidence scores are evidence-based and explainable
✅ Memory consolidation prevents duplicate/conflicting facts
✅ Evidence trails traceable to specific emails
✅ System handles 200+ emails with <5min processing time (incremental runs)
✅ Storage scales to 1000+ emails without performance degradation

### Documentation Requirements
✅ CLAUDE.md updated with LangGraph/LangMem architecture
✅ Confidence scoring methodology documented
✅ Memory reconciliation logic explained
✅ CLI usage examples provided
✅ Future integration points documented

## Development Phases Summary

1. **Phase 1**: Foundation & Data Infrastructure
2. **Phase 2**: Memory System Design
3. **Phase 3**: LangGraph Workflow Design
4. **Phase 4**: Analyzer Implementation
5. **Phase 5**: Incremental Processing System
6. **Phase 6**: Output & Integration
7. **Phase 7**: Testing & Validation

Each phase will have its own TODO list tracked using TodoWrite tool.

---

**Document Version**: 1.0
**Created**: 2025-09-30
**Last Updated**: 2025-09-30