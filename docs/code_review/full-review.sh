#!/bin/bash
# full-review.sh
# Complete code review pipeline orchestrator

set -e

# Default configuration for OwnYou
REQUIREMENTS_DIR="docs/requirements"
ROADMAP_DIR="docs/sprints"
ARCHITECTURE_DIR="docs/architecture"
OUTPUT_DIR=".review-output"
CONTEXT_DIR=".review-context"
PARALLEL=false
SKIP_CONTEXT=false
REPORT_FORMAT="markdown"
PACKAGE=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     🔍 OwnYou Code Review Process                         ║"
    echo "║        Claude Code + Gemini CLI                           ║"
    echo "║        v13 Architecture Compliance                        ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --requirements-dir DIR   Requirements folder (default: docs/requirements)"
    echo "  --roadmap-dir DIR        Sprint/roadmap folder (default: docs/sprints)"
    echo "  --architecture-dir DIR   Architecture docs (default: docs/architecture)"
    echo "  --output-dir DIR         Output directory (default: .review-output)"
    echo "  --package PKG            Review single package (e.g., packages/iab-classifier)"
    echo "  --parallel               Run Claude and Gemini analyses in parallel"
    echo "  --skip-context           Skip context preparation (reuse existing)"
    echo "  --report-format FORMAT   Output format: markdown, json, html (default: markdown)"
    echo "  --claude-only            Run only Claude Code analysis"
    echo "  --gemini-only            Run only Gemini CLI analysis"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run full review with OwnYou defaults"
    echo "  $0 --parallel                         # Run analyses in parallel"
    echo "  $0 --package packages/iab-classifier  # Review single package"
    echo "  $0 --claude-only --skip-context       # Just re-run Claude analysis"
}

# Parse arguments
CLAUDE_ONLY=false
GEMINI_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --requirements-dir)
            REQUIREMENTS_DIR="$2"
            shift 2
            ;;
        --roadmap-dir)
            ROADMAP_DIR="$2"
            shift 2
            ;;
        --architecture-dir)
            ARCHITECTURE_DIR="$2"
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --package)
            PACKAGE="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL=true
            shift
            ;;
        --skip-context)
            SKIP_CONTEXT=true
            shift
            ;;
        --report-format)
            REPORT_FORMAT="$2"
            shift 2
            ;;
        --claude-only)
            CLAUDE_ONLY=true
            shift
            ;;
        --gemini-only)
            GEMINI_ONLY=true
            shift
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Export for subscripts
export REQUIREMENTS_DIR
export ROADMAP_DIR
export ARCHITECTURE_DIR
export OUTPUT_DIR
export CONTEXT_DIR
export PACKAGE

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_banner

# ============================================
# Pre-flight Checks
# ============================================
echo -e "${YELLOW}━━━ Pre-flight Checks ━━━${NC}"
echo ""

# Check directories exist
if [ ! -d "$REQUIREMENTS_DIR" ]; then
    echo -e "${RED}✗ Requirements directory not found: $REQUIREMENTS_DIR${NC}"
    exit 1
else
    REQ_COUNT=$(find "$REQUIREMENTS_DIR" -type f \( -name "*.md" -o -name "*.txt" \) | wc -l | tr -d ' ')
    echo -e "${GREEN}✓ Requirements directory: $REQUIREMENTS_DIR ($REQ_COUNT files)${NC}"
fi

if [ ! -d "$ROADMAP_DIR" ]; then
    echo -e "${RED}✗ Sprint/Roadmap directory not found: $ROADMAP_DIR${NC}"
    exit 1
else
    ROAD_COUNT=$(find "$ROADMAP_DIR" -type f \( -name "*.md" -o -name "*.txt" \) | wc -l | tr -d ' ')
    echo -e "${GREEN}✓ Sprint/Roadmap directory: $ROADMAP_DIR ($ROAD_COUNT files)${NC}"
fi

if [ ! -d "$ARCHITECTURE_DIR" ]; then
    echo -e "${YELLOW}⚠ Architecture directory not found: $ARCHITECTURE_DIR${NC}"
else
    ARCH_COUNT=$(find "$ARCHITECTURE_DIR" -type f -name "*.md" | wc -l | tr -d ' ')
    echo -e "${GREEN}✓ Architecture directory: $ARCHITECTURE_DIR ($ARCH_COUNT files)${NC}"
fi

# Check package if specified
if [ -n "$PACKAGE" ]; then
    if [ ! -d "$PACKAGE" ]; then
        echo -e "${RED}✗ Package not found: $PACKAGE${NC}"
        exit 1
    else
        echo -e "${GREEN}✓ Package focus: $PACKAGE${NC}"
    fi
fi

# Check tools
TOOLS_OK=true

if ! command -v claude &> /dev/null; then
    if [ "$GEMINI_ONLY" = false ]; then
        echo -e "${RED}✗ Claude Code CLI not found${NC}"
        TOOLS_OK=false
    else
        echo -e "${YELLOW}⊘ Claude Code CLI not found (skipping - gemini-only mode)${NC}"
    fi
else
    CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Claude Code CLI: $CLAUDE_VERSION${NC}"
fi

if ! command -v gemini &> /dev/null; then
    if [ "$CLAUDE_ONLY" = false ]; then
        echo -e "${RED}✗ Gemini CLI not found${NC}"
        TOOLS_OK=false
    else
        echo -e "${YELLOW}⊘ Gemini CLI not found (skipping - claude-only mode)${NC}"
    fi
else
    GEMINI_VERSION=$(gemini --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Gemini CLI: $GEMINI_VERSION${NC}"
fi

if [ "$TOOLS_OK" = false ]; then
    echo ""
    echo -e "${RED}Missing required tools. Install them and try again.${NC}"
    exit 1
fi

echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# ============================================
# Phase 1: Context Preparation
# ============================================
if [ "$SKIP_CONTEXT" = false ]; then
    echo -e "${BLUE}━━━ Phase 1: Context Preparation ━━━${NC}"
    echo ""
    
    "$SCRIPT_DIR/prepare-context.sh"
    
    echo ""
else
    echo -e "${YELLOW}━━━ Skipping context preparation (--skip-context)${NC}"
    echo ""
    
    if [ ! -d "$CONTEXT_DIR" ]; then
        echo -e "${RED}Error: Context directory not found. Run without --skip-context first.${NC}"
        exit 1
    fi
fi

# ============================================
# Phase 2: AI Analysis
# ============================================
echo -e "${BLUE}━━━ Phase 2: AI Analysis ━━━${NC}"
echo ""

START_TIME=$(date +%s)

if [ "$PARALLEL" = true ] && [ "$CLAUDE_ONLY" = false ] && [ "$GEMINI_ONLY" = false ]; then
    echo -e "${YELLOW}Running analyses in parallel...${NC}"
    echo ""
    
    # Run both in background
    "$SCRIPT_DIR/run-claude-review.sh" > "$OUTPUT_DIR/claude-run.log" 2>&1 &
    CLAUDE_PID=$!
    
    "$SCRIPT_DIR/run-gemini-review.sh" > "$OUTPUT_DIR/gemini-run.log" 2>&1 &
    GEMINI_PID=$!
    
    # Wait for completion with progress
    echo -n "  Claude Code: "
    while kill -0 $CLAUDE_PID 2>/dev/null; do
        echo -n "."
        sleep 2
    done
    wait $CLAUDE_PID && echo -e " ${GREEN}done${NC}" || echo -e " ${RED}failed${NC}"
    
    echo -n "  Gemini CLI: "
    while kill -0 $GEMINI_PID 2>/dev/null; do
        echo -n "."
        sleep 2
    done
    wait $GEMINI_PID && echo -e " ${GREEN}done${NC}" || echo -e " ${RED}failed${NC}"
    
else
    # Sequential execution
    if [ "$GEMINI_ONLY" = false ]; then
        echo -e "${BLUE}Running Claude Code analysis...${NC}"
        "$SCRIPT_DIR/run-claude-review.sh" || {
            echo -e "${RED}Claude analysis failed. Check logs.${NC}"
        }
        echo ""
    fi
    
    if [ "$CLAUDE_ONLY" = false ]; then
        echo -e "${MAGENTA}Running Gemini CLI analysis...${NC}"
        "$SCRIPT_DIR/run-gemini-review.sh" || {
            echo -e "${RED}Gemini analysis failed. Check logs.${NC}"
        }
        echo ""
    fi
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "${GREEN}Analysis completed in ${DURATION}s${NC}"
echo ""

# ============================================
# Phase 3: Report Generation
# ============================================
echo -e "${CYAN}━━━ Phase 3: Report Generation ━━━${NC}"
echo ""

"$SCRIPT_DIR/merge-reports.sh"

# ============================================
# Final Summary
# ============================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║               Review Complete! 🎉                         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "📁 ${CYAN}Output Directory:${NC} $OUTPUT_DIR/"
echo ""
echo "   Generated files:"

# List output files
if [ -f "$OUTPUT_DIR/CODE_REVIEW_REPORT.md" ]; then
    echo -e "   📄 ${GREEN}CODE_REVIEW_REPORT.md${NC} - Main report"
fi
for f in "$OUTPUT_DIR"/*.json; do
    [ -f "$f" ] && echo -e "   📊 $(basename "$f")"
done

echo ""
echo -e "${YELLOW}Quick view:${NC}"
echo "   cat $OUTPUT_DIR/CODE_REVIEW_REPORT.md"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "   1. Review the generated report"
echo "   2. Validate AI findings manually"  
echo "   3. Create tickets for action items"
echo "   4. Update documentation for spec gaps"
echo ""
