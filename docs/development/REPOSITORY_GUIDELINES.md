# Repository Guidelines

## Project Structure & Module Organization
- `src/email_parser/`: Core package.
  - `providers/` (Gmail/Outlook integrations), `llm_clients/` (OpenAI/Claude/Ollama), `analysis/` (marketing, ikigai), `models/`, `utils/`, `setup/`, `main.py` (CLI).
- `tests/`: Integration, phase, and unit tests (`tests/unit/`).
- `ikigai_insights/`, `marketing_insights/`, `logs/`: Generated outputs and logs.
- Entry points: `email-parser`, `email-parser-setup` (via `pyproject.toml`).

## Build, Test, and Development Commands
- Install (dev): `python -m pip install -e .[dev]`
- Lint: `flake8 src tests`
- Format: `black .`  (check: `black --check .`)
- Type-check: `mypy src`
- Tests: `pytest -q` (coverage: `pytest --cov=src --cov-report=term-missing`)
- Run CLI: `python -m email_parser.main --help` or `email-parser --help`
- Setup wizard: `python -m email_parser.main setup` or `email-parser-setup`

## Coding Style & Naming Conventions
- Python 3.8+; 4-space indentation; max line length 100 (Black config).
- Names: modules/functions `snake_case`, classes `CapWords`, constants `UPPER_CASE`.
- Type hints required (mypy `disallow_untyped_defs = true`).
- Keep modules focused; colocate tests under `tests/` with matching names.

## Testing Guidelines
- Framework: `pytest` with optional `unittest.mock`.
- Place unit tests in `tests/unit/`; broader flows in existing phase/integration suites.
- Name tests `test_*.py`; write deterministic tests and include edge cases for providers and LLM clients.
- Run `pytest --cov=src` and ensure new code is covered meaningfully.

## Git Workflow Discipline

**MANDATORY:** Follow this workflow for EVERY task, no exceptions.

### 1. Create Branch for Every Task

**Before starting ANY work:**

```bash
# Check current branch
git status

# Ensure you're on master/main
git checkout master
git pull origin master

# Create feature branch with descriptive name
git checkout -b feature/task-description

# Examples:
git checkout -b feature/shopping-agent-implementation
git checkout -b fix/store-namespace-validation
git checkout -b docs/api-endpoint-documentation
git checkout -b test/mission-card-integration
```

**Branch naming conventions:**
- `feature/` - New functionality
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `test/` - Test additions/improvements
- `refactor/` - Code restructuring

**Why:** Isolates work, enables parallel development, prevents breaking master.

### 2. Test Regularly (Throughout Development)

**Test at EVERY checkpoint, not just at the end:**

```bash
# After implementing a function
pytest tests/mission_agents/agents/shopping/test_shopping_agent.py -v

# After completing a module
pytest tests/mission_agents/ -v

# Before committing
pytest --cov=src --cov-report=term-missing

# Run type checking
mypy src/

# Run linting
flake8 src/ tests/
black --check src/ tests/
```

**Testing checkpoints:**
1. **After writing a test** (Red phase - test should fail)
2. **After minimal implementation** (Green phase - test should pass)
3. **After refactoring** (Ensure tests still pass)
4. **Before committing** (All tests must pass)
5. **Before creating PR** (Full test suite + coverage)

**Use TodoWrite to track testing:**
```python
# In your todos:
- [ ] Implement shopping agent execute node
- [ ] Test shopping agent execute node (unit test)
- [ ] Implement shopping agent filter node
- [ ] Test shopping agent filter node (unit test)
- [ ] Run integration tests
- [ ] Run full test suite before commit
```

**Why:** Catch bugs early, ensure code quality, prevent broken commits.

### 3. Commit Early and Often

**Commit at logical checkpoints:**

```bash
# After completing a logical unit of work
git add src/mission_agents/agents/shopping/nodes.py
git commit -m "feat(shopping): add execute node for product search

- Implement execute_node() to call external shopping API
- Add error handling for API failures
- Extract user preferences from Store
- Return state updates with api_results

Related to #123"

# Run tests before committing
pytest tests/mission_agents/agents/shopping/ -v

# If tests pass, commit
git add tests/mission_agents/agents/shopping/test_nodes.py
git commit -m "test(shopping): add unit tests for execute node

- Test happy path with valid preferences
- Test edge case with empty Store
- Test error handling for API failures
- Coverage: 95%

Related to #123"
```

**Commit frequency:**
- ✅ After implementing a function/class
- ✅ After writing tests for that function/class
- ✅ After fixing a bug
- ✅ After refactoring
- ❌ NOT at the end of the day with everything mixed together

**Why:** Granular history, easier debugging, easier rollback, clearer progress.

### 4. Merge Branch When Task Complete

**Before merging, complete this checklist:**

```bash
# 1. Ensure all tests pass
pytest --cov=src --cov-report=term-missing
# Coverage must meet requirements (>70% for business logic)

# 2. Ensure type checking passes
mypy src/

# 3. Ensure formatting is correct
black src/ tests/
flake8 src/ tests/

# 4. Ensure all commits are pushed
git status  # Should show "Your branch is up to date"

# 5. Rebase on master (if needed)
git checkout master
git pull origin master
git checkout feature/shopping-agent-implementation
git rebase master
# Resolve conflicts if any

# 6. Push to remote
git push origin feature/shopping-agent-implementation

# 7. Create Pull Request
# Via GitHub UI or:
gh pr create --title "feat: Add Shopping Agent with IAB trigger support" \
  --body "## Summary
- Implement ShoppingAgent with IAB_PROFILE_CHANGE trigger
- Add Store integration for user preferences
- Include comprehensive tests (unit + integration)

## Testing
- All tests pass: pytest --cov=src
- Coverage: 85% (exceeds 70% requirement)
- Type checking: mypy passes
- Linting: flake8 passes

## Related Issues
Closes #123

## Checklist
- [x] Tests written and passing
- [x] Documentation updated
- [x] Type hints complete
- [x] No PII in logs
- [x] Performance requirements met"

# 8. Wait for review, address feedback

# 9. After approval, merge via GitHub UI
# (Use "Squash and merge" for feature branches)

# 10. Delete feature branch
git checkout master
git pull origin master
git branch -d feature/shopping-agent-implementation
git push origin --delete feature/shopping-agent-implementation
```

**When a task is complete:**
- All acceptance criteria met
- All tests passing
- Documentation updated
- Code reviewed and approved
- Branch merged to master
- Feature branch deleted

**Why:** Ensures quality, maintains clean history, prevents broken master.

### 5. Update GitHub Regularly

**Push to GitHub at these intervals:**

```bash
# After each commit (or group of related commits)
git push origin feature/shopping-agent-implementation

# At minimum:
# - End of each work session
# - After completing a logical unit
# - Before switching to different task
# - Before creating PR
```

**Why:** Backup, collaboration, CI/CD runs, visibility.

### Using Superpowers Skills for Workflow

The repository includes Superpowers skills that enforce workflow discipline:

```bash
# Before starting work
# Use: superpowers:using-git-worktrees (for isolated environments)

# Before claiming work is done
# Use: superpowers:verification-before-completion (ensures tests run)

# When ready to merge
# Use: superpowers:finishing-a-development-branch (guides merge process)

# For code review
# Use: superpowers:requesting-code-review (before merging)
```

### Git Workflow for AI Assistants

**AI assistants (Claude Code) MUST:**

1. **Check current branch before starting:**
   ```bash
   git branch --show-current
   # If not on feature branch, create one
   ```

2. **Create TodoWrite todos that include git steps:**
   ```python
   todos = [
       {"content": "Create feature branch", "status": "in_progress"},
       {"content": "Implement shopping agent", "status": "pending"},
       {"content": "Test shopping agent", "status": "pending"},
       {"content": "Commit changes", "status": "pending"},
       {"content": "Push to GitHub", "status": "pending"},
       {"content": "Run full test suite", "status": "pending"},
       {"content": "Create PR", "status": "pending"}
   ]
   ```

3. **Run tests before marking todos complete:**
   - NEVER mark implementation complete without running tests
   - NEVER commit without verifying tests pass
   - NEVER create PR without full test suite passing

4. **Use verification-before-completion skill:**
   - Before claiming "done"
   - Before committing
   - Before creating PR

### Common Mistakes to Avoid

**❌ Don't:**
- Work directly on master branch
- Commit without running tests
- Push untested code
- Create PRs without description
- Merge without review
- Leave feature branches undeleted
- Mix multiple features in one branch
- Commit broken code "to save progress"

**✅ Do:**
- Create branch for every task
- Test at every checkpoint
- Commit early and often
- Push to GitHub regularly
- Write descriptive commit messages
- Request code review
- Delete merged branches
- Keep master always deployable

## Commit & Pull Request Guidelines

**Commit Message Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `test` - Adding tests
- `refactor` - Code change without feature/fix
- `perf` - Performance improvement
- `chore` - Build/tooling changes

**Examples:**
```bash
git commit -m "feat(shopping): add ShoppingAgent with IAB trigger support

- Implement execute_node() for product search
- Add filter_node() for preference-based filtering
- Integrate with Store for user preferences
- Add comprehensive tests (unit + integration)

Closes #123"

git commit -m "fix(store): correct namespace validation for ikigai profiles

- Fix regex pattern for multi-level namespaces
- Add validation test for edge cases
- Update documentation with correct examples

Fixes #145"

git commit -m "test(mission-card): add integration tests for card creation

- Test card creation from IAB trigger
- Test card creation from user request
- Test memory context inclusion
- Coverage increased to 85%

Related to #123"
```

**Pull Request Requirements:**

PRs must include:
- **Clear title** (same format as commit messages)
- **Summary** (what was implemented and why)
- **Testing section** (how it was tested, coverage results)
- **Screenshots/logs** (for UI changes or CLI output)
- **Related issues** (Closes #123, Related to #456)
- **Checklist** (tests, docs, type hints, etc.)

**PR Checklist Template:**
```markdown
## Summary
Brief description of changes

## Testing
- [ ] All tests pass
- [ ] Coverage meets requirements
- [ ] Type checking passes
- [ ] Linting passes

## Related Issues
Closes #123

## Checklist
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Type hints complete
- [ ] No PII in logs
- [ ] Performance requirements met
- [ ] Code reviewed
```

**Keep PRs focused:**
- One feature per PR
- Update README/docs when changing CLI flags, outputs, or config
- Link related issues

## Security & Configuration Tips
- Do not commit secrets or tokens. Use `.env` locally (copy from `.env.example` if present; otherwise follow README config keys).
- Keys used by providers (OpenAI/Anthropic/Ollama) are read via `python-dotenv` in `utils/config.py`.
- Redact personal email content in shared logs; prefer synthetic fixtures for tests.

