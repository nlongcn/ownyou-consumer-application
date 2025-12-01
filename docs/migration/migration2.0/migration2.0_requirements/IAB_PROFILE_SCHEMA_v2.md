# IAB Consumer Profile Schema v2.0

## Overview

Schema v2.0 extends the IAB Consumer Profile with **tiered confidence classification**, enabling:
- **Primary vs Alternative** classification distinction
- **Granularity-weighted scoring** that prioritizes specific (deeper tier) classifications
- **Uncertainty preservation** for mutually-exclusive categories
- **Profile evolution tracking** through confidence deltas

This is a **backward-compatible** extension that adds a new `tiered_classifications` section while preserving the original flat structure.

## Schema Version

```json
{
  "schema_version": "2.0",
  ...
}
```

## Key Changes from v1.0

### 1. Added `tiered_classifications` Section

The new section provides structured primary/alternative classifications:

```json
{
  "tiered_classifications": {
    "demographics": { ... },
    "household": { ... },
    "interests": [ ... ],
    "purchase_intent": [ ... ]
  }
}
```

### 2. Preserved Original Structure

All original v1.0 fields remain unchanged for backward compatibility:
- `demographics` (flat structure)
- `household` (flat structure)
- `interests` (flat list)
- `purchase_intent` (flat list)

## Tiered Classification Structure

### For Mutually-Exclusive Categories (Demographics, Household)

Mutually-exclusive tier groups (e.g., Gender, Age Range, Income) use this structure:

```json
{
  "demographics": {
    "gender": {
      "primary": {
        "taxonomy_id": 21,
        "tier_path": "Demographic | Female",
        "value": "Female",
        "confidence": 0.99,
        "evidence_count": 5,
        "last_validated": "2025-01-01T00:00:00Z",
        "days_since_validation": 10,
        "tier_depth": 2,
        "granularity_score": 0.99,
        "classification_type": "primary",
        "confidence_delta": null
      },
      "alternatives": [
        {
          "taxonomy_id": 20,
          "tier_path": "Demographic | Male",
          "value": "Male",
          "confidence": 0.75,
          "evidence_count": 2,
          "last_validated": "2025-01-01T00:00:00Z",
          "days_since_validation": 10,
          "tier_depth": 2,
          "granularity_score": 0.75,
          "classification_type": "alternative",
          "confidence_delta": 0.24
        }
      ],
      "selection_method": "highest_confidence"
    }
  }
}
```

**Field Descriptions:**

- **primary**: Highest-ranked classification within the tier group
- **alternatives**: Other viable classifications within confidence delta threshold (default: 0.3)
- **selection_method**: Algorithm used for primary selection
  - `"highest_confidence"`: Selected by raw confidence (< 0.7 confidence)
  - `"granularity_weighted"`: Selected by granularity score (≥ 0.7 confidence)
- **tier_depth**: Number of non-empty tiers (1-5)
- **granularity_score**: Weighted score = confidence + (tier_depth × 0.05) if confidence ≥ 0.7
- **confidence_delta**: Difference between primary and alternative confidence (alternatives only)

### For Non-Exclusive Categories (Interests, Purchase Intent)

Non-exclusive categories treat all classifications as primaries, ranked by granularity:

```json
{
  "interests": [
    {
      "primary": {
        "taxonomy_id": 451,
        "tier_path": "Interest | Careers | Remote Working",
        "value": "Remote Working",
        "confidence": 0.95,
        "evidence_count": 3,
        "last_validated": "2025-01-01T00:00:00Z",
        "days_since_validation": 5,
        "tier_depth": 3,
        "granularity_score": 1.10,
        "classification_type": "primary",
        "confidence_delta": null
      },
      "alternatives": [],
      "selection_method": "non_exclusive",
      "granularity_score": 1.10
    }
  ]
}
```

**Sorting:** Interests and purchase intent are sorted by `granularity_score` (descending).

## Granularity Scoring Algorithm

The system prioritizes more specific (deeper tier) classifications when confidence is high:

```python
if confidence >= 0.7:
    granularity_score = confidence + (tier_depth * 0.05)
else:
    granularity_score = confidence
```

**Examples:**

| Classification | Confidence | Tier Depth | Granularity Score |
|----------------|-----------|------------|-------------------|
| Remote Working (tier_3) | 0.95 | 3 | 1.10 |
| Technology (tier_2) | 0.75 | 2 | 0.85 |
| Careers (tier_2) | 0.65 | 2 | 0.65 (no bonus) |

This ensures that:
- **High-confidence, specific** classifications rank highest (0.95 + 0.15 = 1.10)
- **High-confidence, broad** classifications rank lower (0.75 + 0.10 = 0.85)
- **Low-confidence** classifications don't benefit from depth (0.65)

## Primary/Alternative Selection Rules

### Mutually-Exclusive Groups

1. **Filter** by minimum confidence (default: 0.5)
2. **Calculate** granularity scores
3. **Select** highest scoring as primary
4. **Include alternatives** if:
   - Confidence delta ≤ 0.3 (configurable)
   - Confidence ≥ minimum threshold

**Example:**

```python
# Input classifications
classifications = [
    {"value": "Female", "confidence": 0.99, "tier_depth": 2},  # score: 0.99
    {"value": "Male", "confidence": 0.75, "tier_depth": 2},    # score: 0.85
]

# Result
primary = "Female" (score: 0.99)
alternatives = ["Male"] (delta: 0.24, within 0.3 threshold)
```

### Non-Exclusive Groups

All classifications are primaries (no alternatives). Sorted by granularity score descending.

## Mutually-Exclusive Tier Groups

### Demographics
- **Gender**: Male, Female, Other Gender, Unknown Gender
- **Age Ranges**: 18-20, 21-24, 25-29, 30-34, 35-39, 40-44, 45-49, 50-54, 55-59, 60-64, 65-69, 70-74, 75+
- **Education**: High School, Some College, Bachelor's Degree, Master's Degree, Doctorate
- **Marital Status**: Single, Married, Divorced, Widowed

### Household
- **Income**: $0-$24,999, $25,000-$49,999, ..., $250,000+
- **Property Types**: Apartment, House, Condo, Townhouse
- **Ownership**: Own, Rent

## Implementation Details

### Modules

- **`classification_tier_selector.py`**: Core algorithm for primary/alternative selection
  - `calculate_tier_depth()`: Counts non-empty tiers
  - `calculate_granularity_score()`: Computes weighted score
  - `select_primary_and_alternatives()`: Selects primary and alternatives
  - `apply_tiered_classification()`: Main entry point

- **`profile_tier_formatter.py`**: Presentation layer transformation
  - `format_tiered_demographics()`: Formats demographics into tiered structure
  - `format_tiered_household()`: Formats household data
  - `format_tiered_interests()`: Formats and ranks interests
  - `format_tiered_purchase_intent()`: Formats purchase intent
  - `add_tiered_structure_to_profile()`: Adds tiered section to profile dict

- **Integration**: `main.py:generate_iab_profile()` (lines 447-478)

### Storage

Classifications are stored in **semantic memory** (SQLite) with flat structure. Tiering is applied at **presentation layer** during JSON export.

**Memory Fields:**
```python
{
    "taxonomy_id": 21,
    "tier_1": "Demographic",
    "tier_2": "Female",
    "tier_3": "",
    "tier_4": "",
    "tier_5": "",
    "value": "Female",
    "confidence": 0.99,
    "evidence_count": 5,
    "last_validated": "2025-01-01T00:00:00Z"
}
```

**Presentation Output:**
```json
{
  "gender": {
    "primary": { ... },
    "alternatives": [ ... ],
    "selection_method": "highest_confidence"
  }
}
```

## Use Cases

### 1. Conflicting Demographics

**Scenario:** User has both Male (0.89) and Female (0.99) gender signals.

**v1.0 Behavior:** Both appear in flat demographics list.

**v2.0 Behavior:**
```json
{
  "demographics": {
    "gender": {
      "primary": {"value": "Female", "confidence": 0.99},
      "alternatives": [{"value": "Male", "confidence": 0.89, "confidence_delta": 0.10}]
    }
  }
}
```

**Benefit:** Clear primary classification while preserving uncertainty.

### 2. Granularity Prioritization

**Scenario:** User has:
- "Technology" (tier_2, confidence: 0.75)
- "Remote Working" (tier_3, confidence: 0.95)

**v1.0 Behavior:** Sorted by confidence or arbitrary order.

**v2.0 Behavior:**
```json
{
  "interests": [
    {"primary": {"value": "Remote Working", "granularity_score": 1.10}},
    {"primary": {"value": "Technology", "granularity_score": 0.85}}
  ]
}
```

**Benefit:** More specific interests ranked higher.

### 3. Profile Evolution

**Scenario:** New evidence shifts confidence from Male (0.85) to Female (0.90).

**v1.0 Behavior:** Flat list updated.

**v2.0 Behavior:**
```json
{
  "demographics": {
    "gender": {
      "primary": {"value": "Female", "confidence": 0.90},
      "alternatives": [{"value": "Male", "confidence": 0.85, "confidence_delta": 0.05}]
    }
  }
}
```

**Benefit:** Track transitions via confidence deltas (0.05 indicates close call).

## Testing

### Unit Tests

**Tier Selector** (`tests/unit/test_classification_tier_selector.py`):
- 30 tests covering tier depth, granularity scoring, selection, grouping, exclusivity

**Profile Formatter** (`tests/unit/test_profile_tier_formatter.py`):
- 12 tests covering demographics, household, interests, purchase intent formatting

### Integration Test

```bash
python -m src.email_parser.main --iab-csv test_data.csv \
    --iab-output profile_v2.json --user-id test_user --force-reprocess
```

**Expected Output:**
```json
{
  "schema_version": "2.0",
  "tiered_classifications": {
    "demographics": { ... },
    "household": { ... },
    "interests": [ ... ],
    "purchase_intent": [ ... ]
  }
}
```

## Migration Guide

### From v1.0 to v2.0

**No action required!** v2.0 is backward compatible.

**To use tiered classifications:**
1. Access `profile["tiered_classifications"]` instead of flat lists
2. Check `primary` for highest-ranked classification
3. Review `alternatives` for competing classifications
4. Use `granularity_score` for ranking

### Example: Accessing Primary Gender

**v1.0:**
```python
gender = profile["demographics"].get("gender")
if gender:
    print(f"Gender: {gender['value']} ({gender['confidence']})")
```

**v2.0 (backward compatible):**
```python
# Still works (flat structure preserved)
gender = profile["demographics"].get("gender")

# New tiered approach
tiered_gender = profile["tiered_classifications"]["demographics"].get("gender")
if tiered_gender:
    primary = tiered_gender["primary"]
    print(f"Primary Gender: {primary['value']} ({primary['confidence']})")

    if tiered_gender["alternatives"]:
        print("Alternatives:")
        for alt in tiered_gender["alternatives"]:
            print(f"  - {alt['value']} ({alt['confidence']}, Δ={alt['confidence_delta']})")
```

## Configuration

### Tier Selector Parameters

Configurable in `classification_tier_selector.py:select_primary_and_alternatives()`:

```python
select_primary_and_alternatives(
    classifications,
    tier_group,
    min_confidence=0.5,          # Minimum confidence threshold
    confidence_delta_threshold=0.3,  # Max delta for alternatives
    granularity_bonus=0.05       # Bonus per tier level
)
```

**Tuning Recommendations:**

- **Increase `min_confidence`** (e.g., 0.6) to filter low-quality classifications
- **Decrease `confidence_delta_threshold`** (e.g., 0.2) to show fewer alternatives
- **Increase `granularity_bonus`** (e.g., 0.10) to prioritize deeper tiers more aggressively

## Future Enhancements

### Planned (Not Yet Implemented)

1. **Confidence Trends**: Track confidence changes over time
2. **Evidence Strength**: Weight evidence by source reliability
3. **Temporal Decay**: Reduce confidence of old classifications
4. **Conflict Resolution UI**: Dashboard for reviewing alternatives
5. **Custom Tier Weights**: Per-taxonomy granularity bonuses

## References

- **Proposal**: `docs/TIERED_CONFIDENCE_CLASSIFICATION_PROPOSAL.md`
- **Taxonomy**: `IABTL-Audience-Taxonomy-1.1-Final.xlsx`
- **Workflow**: `docs/END_TO_END_TAXONOMY_WORKFLOW.md`
- **Implementation**:
  - `src/email_parser/utils/classification_tier_selector.py`
  - `src/email_parser/utils/profile_tier_formatter.py`
  - `src/email_parser/main.py` (lines 447-478)
