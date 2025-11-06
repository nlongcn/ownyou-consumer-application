## Phase: [X/6 - Phase Name]

### Summary
[Brief description of changes]

### Changes Made
- [ ] File 1 modified
- [ ] File 2 added
- [ ] File 3 refactored

### Testing

#### Unit Tests
```bash
pytest tests/unit/test_xxx.py -v
```
**Result:** X/X passing ✅

#### Integration Tests
```bash
pytest tests/integration/test_xxx.py -v
```
**Result:** X/X passing ✅

#### Coverage
```bash
pytest --cov=src/email_parser/agents --cov-report=term
```
**Result:** XX% coverage ✅

### Manual Testing
[Link to manual test output / screenshots]

### Before/After Metrics
**Before:**
- Cost: $X.XX per email
- Accuracy: XX%
- Speed: X minutes

**After:**
- Cost: $X.XX per email
- Accuracy: XX%
- Speed: X minutes

### Breaking Changes
☐ None
☐ [Describe breaking changes]

### Regression Check
- [ ] Ran existing unit tests (all passing)
- [ ] Ran existing integration tests (all passing)
- [ ] Verified memory reconciliation still works
- [ ] Verified frontend still functions

### Documentation
- [ ] Updated AGENT_CONVERSION_MASTER_PLAN.md
- [ ] Updated AGENT_TESTING_PLAN.md
- [ ] Added/updated docstrings
- [ ] Updated README if needed

### Review Checklist
- [ ] Code follows existing patterns
- [ ] No hardcoded values
- [ ] Error handling present
- [ ] Logging appropriate
- [ ] Tests comprehensive

### Next Steps
[Link to next phase issue]

---

**Reviewer:** Please verify:
1. All tests pass locally
2. Coverage meets threshold
3. No regressions introduced
4. Documentation is clear
