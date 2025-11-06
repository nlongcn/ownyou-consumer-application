---
name: git-workflow-discipline
description: Enforce git workflow discipline for OwnYou development - branch creation, regular testing, commit frequency, and GitHub sync. Use when starting ANY task to ensure proper git workflow, or when an AI assistant needs to remember workflow steps. Prevents working on master, skipping tests, or forgetting to push.
---

# Git Workflow Discipline

**MANDATORY workflow for ALL development tasks in OwnYou.**

## When to Use This Skill

- **Starting ANY task** (implementation, bugfix, documentation)
- **Before writing ANY code**
- **When AI assistant asks "how do I remember to X"** (where X = branch/test/commit/push)
- **When about to work on master branch** (STOP - create branch instead)
- **When about to commit without testing** (STOP - run tests first)
- **When completing a task** (ensure full workflow followed)

## Why This Skill Exists

**Problem:** Developers (human and AI) forget workflow steps:
- Working directly on master
- Committing without testing
- Forgetting to push to GitHub
- Skipping code review
- Leaving feature branches undeleted

**Solution:** This skill enforces discipline through:
1. TodoWrite integration (workflow as checklist items)
2. Automated reminders at each step
3. Integration with superpowers skills
4. Clear decision trees

## The Five Workflow Steps

### Step 1: Create Branch for Every Task

**BEFORE starting implementation:**

```bash
# Check current status
git status
git branch --show-current

# If on master, create feature branch
git checkout master
git pull origin master
git checkout -b feature/descriptive-name

# Branch naming:
# feature/  - New functionality
# fix/      - Bug fixes
# docs/     - Documentation
# test/     - Test additions
# refactor/ - Code restructuring
```

**Add to TodoWrite:**

```python
todos = [
    {"content": "Create feature branch", "status": "completed", "activeForm": "Creating feature branch"},
    {"content": "Implement X", "status": "pending", "activeForm": "Implementing X"},
    # ... rest of todos
]
```

**Decision Tree:**

```
Are you on master branch?
├─ YES → STOP. Create feature branch first.
└─ NO → Proceed with implementation.
```

### Step 2: Test Regularly (Not Just at End)

**Test at EVERY checkpoint:**

1. **After writing a test** (Red phase)
   ```bash
   pytest tests/path/to/test_file.py::test_function -v
   # Should FAIL (you haven't implemented yet)
   ```

2. **After minimal implementation** (Green phase)
   ```bash
   pytest tests/path/to/test_file.py::test_function -v
   # Should PASS (minimal implementation works)
   ```

3. **After refactoring**
   ```bash
   pytest tests/path/to/test_file.py -v
   # Should still PASS (refactoring didn't break)
   ```

4. **Before committing**
   ```bash
   pytest --cov=src --cov-report=term-missing
   mypy src/
   flake8 src/ tests/
   # All must PASS before commit
   ```

**Add testing todos:**

```python
todos = [
    {"content": "Write test for execute_node", "status": "pending", "activeForm": "Writing test for execute_node"},
    {"content": "Run test (should fail)", "status": "pending", "activeForm": "Running test (should fail)"},
    {"content": "Implement execute_node", "status": "pending", "activeForm": "Implementing execute_node"},
    {"content": "Run test (should pass)", "status": "pending", "activeForm": "Running test (should pass)"},
    {"content": "Run full test suite", "status": "pending", "activeForm": "Running full test suite"},
]
```

**Decision Tree:**

```
About to mark implementation todo as complete?
├─ Have you run tests? → NO → STOP. Run tests first.
└─ YES → Did all tests pass?
           ├─ NO → STOP. Fix failures before marking complete.
           └─ YES → Mark complete.
```

**Integration with Superpowers:**
- Use `superpowers:test-driven-development` for TDD enforcement
- Use `superpowers:verification-before-completion` before marking done

### Step 3: Commit Early and Often

**Commit at logical checkpoints:**

```bash
# After implementing a function
git add src/path/to/file.py
git commit -m "feat(scope): add function_name

- Implement core logic
- Add error handling
- Extract helper methods

Related to #123"

# After writing tests for that function
git add tests/path/to/test_file.py
git commit -m "test(scope): add tests for function_name

- Test happy path
- Test edge cases
- Test error handling
- Coverage: 95%

Related to #123"
```

**Commit frequency guideline:**
- ✅ After implementing each function/class
- ✅ After writing tests for that function/class
- ✅ After fixing a bug
- ✅ After refactoring
- ✅ After updating documentation
- ❌ NOT at end of day with all changes mixed

**Add commit todos:**

```python
todos = [
    {"content": "Implement execute_node", "status": "completed", "activeForm": "Implementing execute_node"},
    {"content": "Test execute_node", "status": "completed", "activeForm": "Testing execute_node"},
    {"content": "Commit execute_node implementation", "status": "in_progress", "activeForm": "Committing execute_node implementation"},
    {"content": "Implement filter_node", "status": "pending", "activeForm": "Implementing filter_node"},
]
```

**Decision Tree:**

```
Have you completed a logical unit of work?
├─ YES → Have tests passed?
│         ├─ YES → Commit now
│         └─ NO → Fix tests, then commit
└─ NO → Continue working
```

### Step 4: Push to GitHub Regularly

**Push at these intervals:**

```bash
# After each commit (or group of related commits)
git push origin feature/your-branch-name

# Minimum push frequency:
# - End of each work session
# - After completing logical unit
# - Before switching to different task
# - Before creating PR
```

**Add push todos:**

```python
todos = [
    {"content": "Commit implementation", "status": "completed", "activeForm": "Committing implementation"},
    {"content": "Push to GitHub", "status": "in_progress", "activeForm": "Pushing to GitHub"},
    {"content": "Continue with next feature", "status": "pending", "activeForm": "Continuing with next feature"},
]
```

**Why push regularly:**
- Backup of work
- Enables collaboration
- Triggers CI/CD
- Provides visibility

**Decision Tree:**

```
Are you switching tasks or ending work session?
├─ YES → Have you pushed to GitHub?
│         ├─ NO → STOP. Push first.
│         └─ YES → Proceed.
└─ NO → Optional to push now, but recommended
```

### Step 5: Merge When Task Complete

**Before merging, complete pre-merge checklist:**

```bash
# 1. Run full test suite
pytest --cov=src --cov-report=term-missing
# Must pass with coverage requirements met

# 2. Run type checking
mypy src/

# 3. Run linting
black src/ tests/
flake8 src/ tests/

# 4. Ensure all commits pushed
git status
# Should show "Your branch is up to date"

# 5. Create PR
gh pr create --title "feat: descriptive title" --body "..."

# 6. Request code review (use superpowers:requesting-code-review)

# 7. After approval, merge

# 8. Delete feature branch
git checkout master
git pull origin master
git branch -d feature/your-branch
git push origin --delete feature/your-branch
```

**Pre-merge todos:**

```python
todos = [
    {"content": "Run full test suite", "status": "pending", "activeForm": "Running full test suite"},
    {"content": "Run type checking", "status": "pending", "activeForm": "Running type checking"},
    {"content": "Run linting", "status": "pending", "activeForm": "Running linting"},
    {"content": "Push all commits", "status": "pending", "activeForm": "Pushing all commits"},
    {"content": "Create PR", "status": "pending", "activeForm": "Creating PR"},
    {"content": "Request code review", "status": "pending", "activeForm": "Requesting code review"},
    {"content": "Merge after approval", "status": "pending", "activeForm": "Merging after approval"},
    {"content": "Delete feature branch", "status": "pending", "activeForm": "Deleting feature branch"},
]
```

**Integration with Superpowers:**
- Use `superpowers:verification-before-completion` before claiming done
- Use `superpowers:requesting-code-review` before merging
- Use `superpowers:finishing-a-development-branch` for merge guidance

**Decision Tree:**

```
Ready to merge?
├─ All tests pass? → NO → STOP. Fix failures.
├─ Type checking pass? → NO → STOP. Fix type errors.
├─ Linting pass? → NO → STOP. Fix linting.
├─ Code reviewed? → NO → STOP. Request review.
└─ All YES → Merge, then delete branch.
```

## AI Assistant Integration

**For AI assistants (Claude Code), ALWAYS:**

### 1. Check Branch Before Starting

```bash
# First command in ANY task
git branch --show-current
```

If output is "master" or "main":

```bash
# Create feature branch
git checkout -b feature/task-description
```

### 2. Create TodoWrite with Git Steps

**EVERY task todo list MUST include git workflow steps:**

```python
todos = [
    {"content": "Create feature branch", "status": "completed", "activeForm": "Creating feature branch"},
    {"content": "Implement feature X", "status": "in_progress", "activeForm": "Implementing feature X"},
    {"content": "Write tests for X", "status": "pending", "activeForm": "Writing tests for X"},
    {"content": "Run tests (verify pass)", "status": "pending", "activeForm": "Running tests (verify pass)"},
    {"content": "Commit implementation", "status": "pending", "activeForm": "Committing implementation"},
    {"content": "Push to GitHub", "status": "pending", "activeForm": "Pushing to GitHub"},
    {"content": "Run full test suite", "status": "pending", "activeForm": "Running full test suite"},
    {"content": "Create PR", "status": "pending", "activeForm": "Creating PR"},
]
```

### 3. Never Mark Complete Without Testing

**NEVER:**
- Mark implementation complete without running tests
- Commit without verifying tests pass
- Create PR without full test suite passing
- Merge without code review

**ALWAYS:**
- Run tests after implementation
- Verify tests pass before marking complete
- Run full test suite before commit
- Use `superpowers:verification-before-completion` before claiming "done"

### 4. Use Superpowers Skills

```python
# Before starting work
# Use: superpowers:using-git-worktrees (for isolated environments)

# During development
# Use: superpowers:test-driven-development (TDD enforcement)

# Before claiming done
# Use: superpowers:verification-before-completion (run tests)

# Before merging
# Use: superpowers:requesting-code-review (get review)
# Use: superpowers:finishing-a-development-branch (merge guidance)
```

## Complete Task Workflow Example

**Scenario:** Implement Shopping Agent

```python
# Step 1: Create branch and todos
todos = [
    {"content": "Create feature branch", "status": "in_progress", "activeForm": "Creating feature branch"},
    {"content": "Write test for execute_node (RED)", "status": "pending", "activeForm": "Writing test for execute_node (RED)"},
    {"content": "Implement execute_node (GREEN)", "status": "pending", "activeForm": "Implementing execute_node (GREEN)"},
    {"content": "Refactor execute_node", "status": "pending", "activeForm": "Refactoring execute_node"},
    {"content": "Run tests (verify pass)", "status": "pending", "activeForm": "Running tests (verify pass)"},
    {"content": "Commit execute_node", "status": "pending", "activeForm": "Committing execute_node"},
    {"content": "Push to GitHub", "status": "pending", "activeForm": "Pushing to GitHub"},
    {"content": "Write test for filter_node (RED)", "status": "pending", "activeForm": "Writing test for filter_node (RED)"},
    {"content": "Implement filter_node (GREEN)", "status": "pending", "activeForm": "Implementing filter_node (GREEN)"},
    {"content": "Run full test suite", "status": "pending", "activeForm": "Running full test suite"},
    {"content": "Commit filter_node", "status": "pending", "activeForm": "Committing filter_node"},
    {"content": "Push to GitHub", "status": "pending", "activeForm": "Pushing to GitHub"},
    {"content": "Run final verification", "status": "pending", "activeForm": "Running final verification"},
    {"content": "Create PR", "status": "pending", "activeForm": "Creating PR"},
    {"content": "Request code review", "status": "pending", "activeForm": "Requesting code review"},
]
```

```bash
# Execute workflow
git checkout -b feature/shopping-agent-implementation

# TDD Cycle 1: execute_node
# Write test (RED)
pytest tests/.../test_shopping_agent.py::test_execute_node -v  # FAILS

# Implement (GREEN)
pytest tests/.../test_shopping_agent.py::test_execute_node -v  # PASSES

# Refactor
pytest tests/.../test_shopping_agent.py -v  # Still PASSES

# Commit
git add src/.../shopping_agent.py tests/.../test_shopping_agent.py
git commit -m "feat(shopping): add execute_node for product search"
git push origin feature/shopping-agent-implementation

# TDD Cycle 2: filter_node
# ... repeat ...

# Final verification
pytest --cov=src --cov-report=term-missing  # All pass
mypy src/  # Passes
flake8 src/ tests/  # Passes

# Create PR
gh pr create --title "feat: Add Shopping Agent with IAB trigger support" --body "..."

# Request review (use superpowers:requesting-code-review)

# After approval, merge and cleanup
git checkout master
git pull origin master
git branch -d feature/shopping-agent-implementation
```

## Common Mistakes

**❌ Don't:**
- Work on master branch
- Commit without testing
- Skip test checkpoints
- Push untested code
- Create PR without full verification
- Merge without review
- Leave branches undeleted
- Mix multiple features in one branch

**✅ Do:**
- Create branch before starting
- Test at every checkpoint
- Commit after each logical unit
- Push regularly
- Run full verification before PR
- Request code review
- Delete merged branches
- One feature per branch

## Validation Checklist

Before considering task complete:

- [ ] Feature branch created
- [ ] Tests written using TDD (RED-GREEN-REFACTOR)
- [ ] All tests passing
- [ ] Type checking passes (mypy)
- [ ] Linting passes (flake8, black)
- [ ] All commits pushed to GitHub
- [ ] PR created with description
- [ ] Code review requested
- [ ] Review approved
- [ ] Branch merged
- [ ] Feature branch deleted

## Reference

- **Repository Guidelines**: `docs/development/REPOSITORY_GUIDELINES.md`
- **Development Guidelines**: `docs/reference/DEVELOPMENT_GUIDELINES.md`
- **Superpowers Skills**:
  - `superpowers:using-git-worktrees`
  - `superpowers:test-driven-development`
  - `superpowers:verification-before-completion`
  - `superpowers:requesting-code-review`
  - `superpowers:finishing-a-development-branch`
