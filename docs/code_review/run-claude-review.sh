#!/bin/bash
# run-claude-review.sh
# Runs Claude Code for code review analysis

set -e

# Configuration
CONTEXT_DIR="${CONTEXT_DIR:-.review-context}"
OUTPUT_DIR="${OUTPUT_DIR:-.review-output}"
PROMPTS_DIR="${PROMPTS_DIR:-.review-prompts}"
MODE="${1:-all}"  # all, quality, requirements, architecture

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Claude Code Review Analysis       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if Claude Code is available
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: Claude Code CLI not found${NC}"
    echo "Install with: npm install -g @anthropic-ai/claude-code"
    exit 1
fi

# Function to run Claude Code with a prompt
run_claude_analysis() {
    local name="$1"
    local prompt_file="$2"
    local output_file="$3"
    
    echo -e "${YELLOW}▶ Running: $name${NC}"
    
    if [ -f "$prompt_file" ]; then
        prompt=$(cat "$prompt_file")
    else
        prompt="$2"  # Use inline prompt if file doesn't exist
    fi
    
    # Run Claude Code
    # Note: Adjust the command based on actual Claude Code CLI syntax
    claude --print "$prompt" > "$output_file" 2>&1 || {
        echo -e "${RED}  ✗ Failed: $name${NC}"
        return 1
    }
    
    echo -e "${GREEN}  ✓ Complete: $output_file${NC}"
}

# ============================================
# Analysis 1: Code Quality Assessment
# ============================================
if [ "$MODE" = "all" ] || [ "$MODE" = "quality" ]; then
    echo -e "\n${BLUE}━━━ Code Quality Assessment ━━━${NC}\n"
    
    QUALITY_PROMPT=$(cat << 'PROMPT'
I need you to perform a comprehensive code quality review of this codebase.

## Context
- Review the requirements in /docs/requirements/ for expected functionality
- Review the roadmap in /docs/roadmap/ for priorities and timelines
- Analyze the actual implementation in the source directories

## Evaluation Criteria

### 1. Architecture Quality
- Assess separation of concerns
- Evaluate module cohesion and coupling  
- Identify design pattern usage (or misuse)
- Check for scalability considerations
- Review dependency management

### 2. Code Standards
- Naming conventions (files, functions, variables, classes)
- File and folder organization
- Comment quality and documentation coverage
- Type safety and type definitions
- Consistent coding style

### 3. Error Handling
- Exception/error coverage completeness
- Edge case handling
- Graceful degradation patterns
- Error logging and monitoring hooks
- User-facing error messages

### 4. Testing
- Unit test presence and coverage
- Integration test coverage
- Test quality (meaningful assertions, not just coverage)
- Mock usage appropriateness
- Test organization

### 5. Security
- Input validation patterns
- Authentication/authorization implementation
- Sensitive data handling
- Dependency vulnerability potential
- Security headers/configurations

### 6. Performance
- Obvious performance anti-patterns
- Database query efficiency (if applicable)
- Memory management concerns
- Caching strategies

## Output Format

Provide your analysis as a structured JSON object:

```json
{
  "overall_score": 75,
  "summary": "Brief 2-3 sentence summary",
  "categories": {
    "architecture": {
      "score": 80,
      "findings": [
        {
          "severity": "high|medium|low",
          "title": "Issue title",
          "description": "Detailed description",
          "location": "file/path or pattern",
          "recommendation": "How to fix"
        }
      ]
    },
    "code_standards": { ... },
    "error_handling": { ... },
    "testing": { ... },
    "security": { ... },
    "performance": { ... }
  },
  "top_priorities": [
    "Most important issue to address",
    "Second priority",
    "Third priority"
  ]
}
```

Be specific about file locations and provide actionable recommendations.
PROMPT
)
    
    run_claude_analysis \
        "Code Quality Assessment" \
        "$QUALITY_PROMPT" \
        "$OUTPUT_DIR/claude-quality.json"
fi

# ============================================
# Analysis 2: Requirements Alignment
# ============================================
if [ "$MODE" = "all" ] || [ "$MODE" = "requirements" ]; then
    echo -e "\n${BLUE}━━━ Requirements Alignment ━━━${NC}\n"
    
    REQUIREMENTS_PROMPT=$(cat << 'PROMPT'
Perform a requirements traceability analysis for this codebase.

## Task
Cross-reference the code against all requirements in /docs/requirements/

## For Each Requirement

1. **Identify** the requirement (ID, title, description)
2. **Locate** implementing code files
3. **Assess** implementation completeness (0-100%)
4. **Document** any deviations from specification
5. **Flag** missing implementations

## Output Format

```json
{
  "analysis_timestamp": "ISO-8601",
  "total_requirements": 25,
  "fully_implemented": 15,
  "partially_implemented": 7,
  "not_implemented": 3,
  "overall_coverage": 68,
  
  "requirements": [
    {
      "id": "REQ-001",
      "title": "User Authentication",
      "source_file": "/docs/requirements/auth.md",
      "status": "partial",
      "completeness_percent": 65,
      "implementing_files": [
        "src/auth/login.ts",
        "src/auth/session.ts"
      ],
      "implemented_aspects": [
        "Basic login flow",
        "Session management"
      ],
      "missing_aspects": [
        "MFA support (specified in requirement)",
        "Password reset flow"
      ],
      "deviations": [
        {
          "specified": "Use session tokens",
          "actual": "Uses JWT tokens",
          "impact": "medium",
          "justification_found": false
        }
      ],
      "notes": "Core functionality works but missing security features"
    }
  ],
  
  "untracked_code": [
    {
      "file": "src/features/experimental.ts",
      "description": "Code with no matching requirement",
      "recommendation": "Document or remove"
    }
  ],
  
  "recommendations": [
    "Priority items to implement",
    "Requirements needing clarification"
  ]
}
```

Be thorough in mapping code to requirements. If a requirement is ambiguous, note it.
PROMPT
)
    
    run_claude_analysis \
        "Requirements Alignment" \
        "$REQUIREMENTS_PROMPT" \
        "$OUTPUT_DIR/claude-requirements.json"
fi

# ============================================
# Analysis 3: Architecture Deep Dive
# ============================================
if [ "$MODE" = "all" ] || [ "$MODE" = "architecture" ]; then
    echo -e "\n${BLUE}━━━ Architecture Analysis ━━━${NC}\n"
    
    ARCHITECTURE_PROMPT=$(cat << 'PROMPT'
Perform a deep architectural analysis of this codebase.

## Analysis Areas

### 1. System Structure
- Identify the overall architectural pattern (MVC, Clean Architecture, etc.)
- Map the major components/modules
- Document data flow patterns
- Identify integration points

### 2. Dependency Analysis
- Internal module dependencies
- External package dependencies
- Circular dependency detection
- Coupling assessment

### 3. Scalability Assessment
- Horizontal scaling readiness
- Stateless design patterns
- Database access patterns
- Caching strategies

### 4. Technical Debt Identification
- Legacy patterns that need modernization
- Inconsistent implementations
- TODO/FIXME/HACK comments
- Deprecated dependency usage

### 5. Roadmap Alignment
Reference /docs/roadmap/ and assess:
- Is the architecture ready for planned features?
- What architectural changes are needed?
- Are there blocking technical decisions?

## Output Format

```json
{
  "architecture_pattern": "Clean Architecture with modifications",
  "pattern_adherence": 70,
  
  "component_map": {
    "core": {
      "path": "src/core/",
      "responsibility": "Business logic",
      "dependencies": ["utils"],
      "dependents": ["api", "ui"]
    }
  },
  
  "dependency_graph": {
    "cycles_detected": [
      ["moduleA", "moduleB", "moduleA"]
    ],
    "highly_coupled": [
      {"module": "src/services/", "coupling_score": 0.8}
    ]
  },
  
  "technical_debt": [
    {
      "category": "legacy_pattern",
      "description": "Callback-based async in auth module",
      "location": "src/auth/legacy/",
      "effort": "medium",
      "priority": "high",
      "recommendation": "Migrate to async/await"
    }
  ],
  
  "roadmap_readiness": {
    "planned_feature": "Real-time collaboration",
    "current_readiness": "low",
    "blockers": [
      "No WebSocket infrastructure",
      "State management not designed for real-time"
    ],
    "required_changes": [
      "Add event-driven architecture layer",
      "Implement pub/sub system"
    ]
  },
  
  "recommendations": [
    {
      "priority": 1,
      "title": "Address circular dependencies",
      "effort": "low",
      "impact": "high"
    }
  ]
}
```
PROMPT
)
    
    run_claude_analysis \
        "Architecture Analysis" \
        "$ARCHITECTURE_PROMPT" \
        "$OUTPUT_DIR/claude-architecture.json"
fi

# ============================================
# Summary
# ============================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}   Claude Code Analysis Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Output files:"
ls -la "$OUTPUT_DIR"/claude-*.json 2>/dev/null || echo "  (no output files found)"
echo ""
echo "Next: Run Gemini analysis"
echo "  ./scripts/run-gemini-review.sh"
