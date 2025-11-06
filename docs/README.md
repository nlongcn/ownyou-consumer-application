# IAB Taxonomy Profile System - Documentation

## Overview

This directory contains comprehensive documentation for the IAB Audience Taxonomy Profile System development project.

## Documentation Files

### 🎯 Classification System Overview
**[Classification1.0.md](./Classification1.0.md)** ⭐ **NEW**
- Complete guide to how the classification system works
- Workflow components and architecture
- Batch processing explained
- Evidence validation system
- Memory and confidence evolution
- LangGraph Studio debugging guide
- Performance characteristics
- API reference and examples

**👉 START HERE** to understand how the system classifies emails and builds profiles.

---

### 📋 Project Requirements
**[IAB_TAXONOMY_PROFILE_REQUIREMENTS.md](./IAB_TAXONOMY_PROFILE_REQUIREMENTS.md)**
- Complete project specification
- All taxonomy categories to extract (Demographics, Household, Interests, Purchases)
- Confidence scoring formulas and evolution rules
- LangGraph workflow architecture
- LangMem memory structure
- JSON output schema
- Daily run workflow examples
- Success criteria

**👉 USE THIS** for detailed requirements and specifications.

---

### ✅ Best Practices
**[BEST_PRACTICES.md](./BEST_PRACTICES.md)**
- **STOP, THINK, ASK** decision framework
- LangGraph and LangMem documentation references
- Requirements alignment checklist
- Code quality standards
- Testing requirements
- GitHub workflow and commit strategy
- Phase transition checklist
- Quick reference card

**👉 REFER TO THIS** at every stage of development, before making any implementation decisions.

---

### 🧪 Testing Strategy
**[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)**
- Comprehensive testing for all phases
- Unit test examples for each phase
- Integration test patterns
- Manual validation checklists
- Performance benchmarks
- GitHub Actions CI/CD setup
- Test coverage requirements

**👉 USE THIS** to write tests for each completed feature.

---

### 📝 Phase TODO Lists

**[PHASE_1_TODO.md](./PHASE_1_TODO.md)** - Foundation & Data Infrastructure
- 6 tasks with detailed subtasks
- Success criteria for each task
- Manual verification checklist
- Notes section for design decisions

**Future Phases** (to be created as needed):
- PHASE_2_TODO.md - Memory System Design
- PHASE_3_TODO.md - LangGraph Workflow Design
- PHASE_4_TODO.md - Analyzer Implementation
- PHASE_5_TODO.md - Incremental Processing System
- PHASE_6_TODO.md - Output & Integration
- PHASE_7_TODO.md - Testing & Validation

---

## Development Workflow

### 1. Starting a New Phase

```bash
# Read documentation
1. Review IAB_TAXONOMY_PROFILE_REQUIREMENTS.md (relevant section)
2. Review BEST_PRACTICES.md (entire document)
3. Open PHASE_X_TODO.md (current phase)
4. Check LangGraph/LangMem documentation if implementing those features
```

### 2. Implementing a Task

```bash
# For each task in PHASE_X_TODO.md:
1. Read task description and subtasks
2. Check success criteria
3. Implement feature following existing patterns
4. Write unit tests (see TESTING_STRATEGY.md)
5. Run tests: pytest tests/ -v
6. Manual validation from TODO checklist
7. Update PHASE_X_TODO.md with status and notes
8. Git commit with descriptive message
9. Git push to GitHub
```

### 3. Completing a Phase

```bash
# Before moving to next phase:
1. Complete all tasks in PHASE_X_TODO.md
2. All tests passing (unit + integration)
3. No regressions in existing test suite
4. Manual validation complete
5. Documentation updated
6. All commits pushed to GitHub
7. Review BEST_PRACTICES.md Phase Transition Checklist
8. Get user approval
9. Create PHASE_X+1_TODO.md
```

---

## Quick Command Reference

### Testing
```bash
# Run all tests
pytest tests/ -v

# Run specific phase tests
pytest tests/unit/test_phase1_*.py -v

# Run with coverage
pytest tests/ --cov=src/email_parser --cov-report=html

# View coverage report
open htmlcov/index.html
```

### Git Workflow
```bash
# Commit after task completion
git add <files>
git commit -m "Phase X, Task Y: [Brief description]

- Change 1
- Change 2

Ref: docs/PHASE_X_TODO.md Task Y"

# Push to GitHub
git push origin master
```

### GitHub Actions
```bash
# Configured in .github/workflows/test.yml
# Runs automatically on push/pull request to master
# View results at: https://github.com/[user]/email-parser-iab-taxonomy/actions
```

---

## Key Principles

### 🛑 STOP, THINK, ASK
Before implementing any significant feature, pause and verify:
- Does this align with requirements?
- Have I checked official documentation?
- Is there a simpler approach?
- Should I ask the user?

### 📚 Documentation First
Always check official docs before creating custom solutions:
- **LangGraph**: https://docs.langchain.com/oss/python/langgraph/overview
- **LangMem**: https://langchain-ai.github.io/langmem/

### ✅ Test Everything
No untested code. Write tests before marking tasks complete.

### 💾 Commit Frequently
Commit after each completed task. Push to GitHub for backup.

### 📊 Track Progress
Update PHASE_X_TODO.md with status, notes, and decisions.

---

## Documentation Standards

### Updating TODO Files

When completing a task:
```markdown
### ✅ Task 1: Add Dependencies to requirements.txt
**Status**: Completed (2025-09-30)

**Notes**:
- Added langgraph, langmem, langchain-core, langchain-openai, langchain-anthropic
- Added openpyxl for Excel parsing
- All dependencies installed successfully
- No conflicts detected

**Challenges**:
- None

**Next Steps**:
- Proceed to Task 2
```

### Design Decisions

Document all significant decisions in TODO Notes section:
```markdown
### Design Decisions
- **Decision**: Used PostgresStore for production storage
- **Reasoning**: Need persistence across server restarts, better performance than SQLite at scale
- **Reference**: LangMem docs - Storage Backends
- **Date**: 2025-09-30
```

---

## File Structure

```
docs/
├── README.md                                    # This file
├── IAB_TAXONOMY_PROFILE_REQUIREMENTS.md        # Project specification
├── BEST_PRACTICES.md                           # Development guidelines
├── TESTING_STRATEGY.md                         # Testing approach
├── PHASE_1_TODO.md                             # Phase 1 tasks
├── PHASE_2_TODO.md                             # (Created when Phase 1 complete)
└── ...                                         # Additional phase TODOs
```

---

## Support & Questions

If uncertain about any implementation decision:
1. 🛑 Stop coding
2. 📖 Re-read requirements and best practices
3. 🔍 Check LangGraph/LangMem documentation
4. 💭 Think through the problem
5. 🙋 **Ask the user** - Better to clarify than implement incorrectly

---

## Version History

- **v1.0** (2025-09-30): Initial documentation structure
  - Requirements document
  - Best practices guide
  - Testing strategy
  - Phase 1 TODO
  - GitHub workflow setup

---

**Remember**: Quality over speed. Test everything. Commit frequently. Refer to documentation constantly.

**Ready to Start**: Begin with Phase 1 by opening [PHASE_1_TODO.md](./PHASE_1_TODO.md)

---

## Archive

Historical documentation has been moved to the [archive](./archive/) directory. These files are preserved for reference but are no longer actively maintained. Always refer to current documentation for development work.