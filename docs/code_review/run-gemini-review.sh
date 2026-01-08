#!/bin/bash
# run-gemini-review.sh
# Runs Gemini CLI for complementary code review analysis

set -e

# Configuration
CONTEXT_DIR="${CONTEXT_DIR:-.review-context}"
OUTPUT_DIR="${OUTPUT_DIR:-.review-output}"
MODE="${1:-all}"  # all, redundancy, gaps, specification

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

echo -e "${MAGENTA}╔═══════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║      Gemini CLI Review Analysis       ║${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if Gemini CLI is available
if ! command -v gemini &> /dev/null; then
    echo -e "${RED}Error: Gemini CLI not found${NC}"
    echo "Install with: npm install -g @google/gemini-cli"
    echo "         or: pip install gemini-cli"
    exit 1
fi

# Function to run Gemini analysis
run_gemini_analysis() {
    local name="$1"
    local prompt="$2"
    local output_file="$3"
    
    echo -e "${YELLOW}▶ Running: $name${NC}"
    
    # Run Gemini CLI
    # Note: Adjust command based on actual Gemini CLI syntax
    echo "$prompt" | gemini > "$output_file" 2>&1 || {
        echo -e "${RED}  ✗ Failed: $name${NC}"
        return 1
    }
    
    echo -e "${GREEN}  ✓ Complete: $output_file${NC}"
}

# ============================================
# Analysis 1: Redundancy Detection
# ============================================
if [ "$MODE" = "all" ] || [ "$MODE" = "redundancy" ]; then
    echo -e "\n${MAGENTA}━━━ Redundancy Detection ━━━${NC}\n"
    
    REDUNDANCY_PROMPT=$(cat << 'PROMPT'
Analyze this codebase for redundant and unnecessary files.

## Detection Tasks

### 1. Duplicate Files
Identify files with identical or near-identical content:
- Exact duplicates (same content, different locations)
- Near-duplicates (>80% similar content)
- Copy-paste code across files

### 2. Dead Code
Find unused code:
- Exported functions/classes never imported elsewhere
- Unreachable code paths (after returns, in dead branches)
- Large blocks of commented-out code
- Unused variables and imports

### 3. Orphaned Files
Files not connected to the codebase:
- Source files not imported/required anywhere
- Test files for deleted source files
- Config files for removed features
- Outdated migration or seed files

### 4. Redundant Dependencies
Package and import issues:
- Unused npm/pip packages
- Duplicate functionality (e.g., lodash + underscore)
- Polyfills for supported features
- Dev dependencies in production

### 5. Stale Assets
- Unused images, fonts, or static files
- Outdated documentation
- Legacy configuration files

## Output Format

```json
{
  "scan_timestamp": "ISO-8601",
  "total_files_scanned": 150,
  "issues_found": 23,
  
  "duplicates": [
    {
      "type": "exact",
      "files": [
        "src/utils/helpers.js",
        "src/legacy/helpers.js"
      ],
      "size_bytes": 2048,
      "recommendation": "Keep src/utils/helpers.js, delete legacy version",
      "confidence": 1.0
    },
    {
      "type": "near_duplicate",
      "similarity": 0.87,
      "files": [
        "src/components/Button.tsx",
        "src/components/ButtonLegacy.tsx"
      ],
      "diff_summary": "Legacy version uses class components",
      "recommendation": "Migrate usages to Button.tsx",
      "confidence": 0.9
    }
  ],
  
  "dead_code": [
    {
      "type": "unused_export",
      "location": "src/utils/math.ts:45",
      "name": "calculateComplexThing",
      "last_modified": "2024-03-15",
      "confidence": 0.95,
      "recommendation": "Remove or document why kept"
    },
    {
      "type": "commented_code",
      "location": "src/api/handler.ts:120-180",
      "lines": 60,
      "recommendation": "Remove - use git history instead"
    }
  ],
  
  "orphaned_files": [
    {
      "file": "src/features/deprecated-feature/",
      "reason": "No imports found",
      "last_modified": "2024-01-10",
      "size_bytes": 15000,
      "recommendation": "Archive or delete entire directory"
    }
  ],
  
  "redundant_dependencies": [
    {
      "package": "moment",
      "reason": "date-fns already installed with same functionality",
      "usages_found": 3,
      "recommendation": "Migrate to date-fns"
    }
  ],
  
  "cleanup_summary": {
    "estimated_removable_files": 12,
    "estimated_removable_lines": 1500,
    "estimated_size_savings_kb": 45,
    "priority_deletions": [
      "src/legacy/ (entire directory)",
      "src/deprecated-api.ts"
    ]
  }
}
```

Provide high confidence scores only when certain. Flag uncertain findings for human review.
PROMPT
)
    
    run_gemini_analysis \
        "Redundancy Detection" \
        "$REDUNDANCY_PROMPT" \
        "$OUTPUT_DIR/gemini-redundancy.json"
fi

# ============================================
# Analysis 2: Roadmap Gap Analysis
# ============================================
if [ "$MODE" = "all" ] || [ "$MODE" = "gaps" ]; then
    echo -e "\n${MAGENTA}━━━ Roadmap Gap Analysis ━━━${NC}\n"
    
    GAPS_PROMPT=$(cat << 'PROMPT'
Compare the roadmap documentation (/docs/roadmap/) against the current codebase implementation.

## Analysis Tasks

### 1. Implementation Status Mapping
For each roadmap item, determine:
- Is it fully implemented?
- Is it partially implemented?
- Is it not started?
- Is there code that doesn't map to any roadmap item?

### 2. Gap Identification
What's missing between roadmap and reality:
- Features on roadmap with no code
- Milestone items behind schedule
- Dependencies blocking progress

### 3. Scope Creep Detection
Code that exists outside the roadmap:
- Unplanned features
- Over-engineered solutions
- Premature optimizations

### 4. Priority Assessment
Based on roadmap timeline:
- What should be worked on now?
- What's blocking other items?
- What can be deferred?

## Output Format

```json
{
  "analysis_timestamp": "ISO-8601",
  
  "roadmap_coverage": {
    "total_items": 30,
    "completed": 12,
    "in_progress": 8,
    "not_started": 7,
    "blocked": 3,
    "coverage_percent": 40
  },
  
  "items": [
    {
      "roadmap_id": "M1-F3",
      "title": "User Dashboard",
      "roadmap_status": "Q1 2025",
      "implementation_status": "in_progress",
      "completeness_percent": 45,
      "implementing_files": [
        "src/pages/dashboard/",
        "src/components/widgets/"
      ],
      "completed_aspects": [
        "Basic layout",
        "Widget framework"
      ],
      "remaining_work": [
        "Data visualization",
        "Export functionality",
        "Mobile responsive"
      ],
      "estimated_effort": "2 weeks",
      "blockers": [],
      "dependencies": ["M1-F1", "M1-F2"]
    },
    {
      "roadmap_id": "M2-F1",
      "title": "API v2",
      "roadmap_status": "Q2 2025",
      "implementation_status": "not_started",
      "completeness_percent": 0,
      "implementing_files": [],
      "notes": "Blocked by M1 completion",
      "estimated_effort": "4 weeks",
      "blockers": ["M1-F3 incomplete"]
    }
  ],
  
  "unplanned_code": [
    {
      "location": "src/experimental/ai-features/",
      "description": "AI integration not on current roadmap",
      "lines_of_code": 500,
      "recommendation": "Add to roadmap or archive"
    }
  ],
  
  "immediate_priorities": [
    {
      "item": "M1-F3",
      "reason": "Blocking 3 other items",
      "action": "Complete dashboard core functionality"
    }
  ],
  
  "timeline_risks": [
    {
      "milestone": "M1",
      "planned_date": "2025-03-31",
      "projected_date": "2025-04-15",
      "delay_days": 15,
      "risk_factors": [
        "F3 behind schedule",
        "Testing not started"
      ]
    }
  ],
  
  "recommendations": [
    "Prioritize completing blocked items",
    "Consider descoping M1-F4 to meet deadline",
    "Add AI features to roadmap or remove code"
  ]
}
```
PROMPT
)
    
    run_gemini_analysis \
        "Roadmap Gap Analysis" \
        "$GAPS_PROMPT" \
        "$OUTPUT_DIR/gemini-gaps.json"
fi

# ============================================
# Analysis 3: Specification Quality
# ============================================
if [ "$MODE" = "all" ] || [ "$MODE" = "specification" ]; then
    echo -e "\n${MAGENTA}━━━ Specification Quality Analysis ━━━${NC}\n"
    
    SPEC_PROMPT=$(cat << 'PROMPT'
Evaluate the quality of specifications in /docs/requirements/ and /docs/roadmap/.

## Quality Criteria

### 1. Completeness
- Do requirements have all necessary sections?
- Are acceptance criteria defined?
- Are edge cases documented?
- Are dependencies listed?

### 2. Clarity
- Is the language unambiguous?
- Are technical terms defined?
- Could two developers interpret it the same way?

### 3. Testability
- Can acceptance criteria be verified?
- Are success metrics defined?
- Are there measurable outcomes?

### 4. Consistency
- Do requirements conflict with each other?
- Is terminology used consistently?
- Do priorities align across documents?

### 5. Traceability
- Are requirements uniquely identified?
- Can features be traced to requirements?
- Is there a clear hierarchy?

## Output Format

```json
{
  "analysis_timestamp": "ISO-8601",
  
  "overall_quality_score": 65,
  
  "document_analysis": [
    {
      "file": "/docs/requirements/auth.md",
      "quality_score": 75,
      "issues": [
        {
          "type": "ambiguity",
          "severity": "high",
          "location": "Section 2.3",
          "quote": "System should handle multiple sessions appropriately",
          "problem": "What does 'appropriately' mean?",
          "recommendation": "Define specific behavior: 'Limit to 3 concurrent sessions, invalidate oldest on new login'"
        },
        {
          "type": "missing_criteria",
          "severity": "medium",
          "location": "REQ-AUTH-005",
          "problem": "No acceptance criteria defined",
          "recommendation": "Add: 'Given... When... Then...' format acceptance criteria"
        }
      ],
      "strengths": [
        "Well-structured document",
        "Clear requirement IDs",
        "Good use of diagrams"
      ]
    }
  ],
  
  "cross_document_issues": [
    {
      "type": "conflict",
      "severity": "critical",
      "documents": ["auth.md", "user-management.md"],
      "description": "Session timeout defined as 30min in auth.md, 60min in user-management.md",
      "recommendation": "Align to single source of truth"
    },
    {
      "type": "inconsistent_terminology",
      "severity": "medium",
      "terms": ["user", "account", "profile"],
      "occurrences": 45,
      "recommendation": "Create glossary, standardize usage"
    }
  ],
  
  "missing_specifications": [
    {
      "feature": "Error handling",
      "evidence": "Code exists but no requirement document",
      "recommendation": "Document error handling requirements"
    }
  ],
  
  "improvement_priorities": [
    {
      "priority": 1,
      "action": "Resolve conflicting specifications",
      "effort": "low",
      "impact": "critical"
    },
    {
      "priority": 2,
      "action": "Add acceptance criteria to 12 requirements",
      "effort": "medium", 
      "impact": "high"
    }
  ],
  
  "templates_needed": [
    "Requirement template with mandatory sections",
    "Acceptance criteria template",
    "Glossary document"
  ]
}
```

Be specific about problems and provide concrete improvement suggestions.
PROMPT
)
    
    run_gemini_analysis \
        "Specification Quality" \
        "$SPEC_PROMPT" \
        "$OUTPUT_DIR/gemini-specification.json"
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}   Gemini CLI Analysis Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Output files:"
ls -la "$OUTPUT_DIR"/gemini-*.json 2>/dev/null || echo "  (no output files found)"
echo ""
echo "Next: Merge and synthesize reports"
echo "  ./scripts/merge-reports.sh"
