---
name: skill-enforcement
description: Meta-skill that enforces proper skill usage. Use this when Claude skips skills or needs a reminder about the mandatory skill protocol. Also triggered automatically by hooks. (project)
---

# Skill Enforcement Protocol

## Purpose

This skill exists because Claude repeatedly skips using skills despite:
- Explicit instructions in CLAUDE.md
- Session start reminders
- The using-superpowers skill being loaded

**This skill is the nuclear option** - it should be invoked when Claude fails to follow the skill protocol.

## When This Skill Applies

- User says "You skipped skills"
- User says "Start over"
- User mentions skill enforcement
- Claude is caught making changes without using skills first
- As a reminder at session start

## Mandatory Protocol (Non-Negotiable)

### Before ANY Response:

```
1. ☐ List available skills mentally
2. ☐ Ask: "Does ANY skill match this task?"
3. ☐ If yes → Skill(skill-name) BEFORE anything else
4. ☐ Announce: "I'm using [skill] to [task]"
5. ☐ Follow the skill EXACTLY
```

### Failure Detection

You are FAILING if you:
- Start editing files before using Skill tool
- Say "let me check" without invoking skills first
- Rationalize skipping skills for "simple" tasks
- Complete work without announcing skill usage

## Required Skills by Task

| Trigger Words | Required Skill |
|--------------|----------------|
| sprint, phase, milestone | `sprint-mode` |
| implement, build, create, add feature | `implement-package` |
| test, TDD, verify | `testing-discipline` |
| bug, fix, debug, error | `superpowers:systematic-debugging` |
| complete, done, finish | `v13-compliance-check` |
| commit, push, branch, git | `git-workflow-discipline` |
| design, plan, architect | `superpowers:brainstorming` |
| review, check code | `superpowers:requesting-code-review` |

## Enforcement Mechanisms Active

1. **Hook: PreToolUse** - Blocks Edit/Write if skills not used
2. **Hook: SessionStart** - Reminds about skill usage
3. **CLAUDE.md** - MANDATORY FIRST ACTION section
4. **This skill** - Nuclear option for enforcement

## Recovery Protocol

If you've been told "You skipped skills", do this:

1. **STOP** what you're doing
2. **Apologize**: "You're right, I skipped the skill protocol."
3. **Identify**: "For this task, I should use [skill-name]"
4. **Invoke**: `Skill(skill-name)`
5. **Restart**: Begin the task following the skill

## Why This Matters

Skills encode:
- Proven workflows that prevent mistakes
- Project-specific requirements
- Quality gates and checkpoints
- Architectural constraints

**Skipping skills = repeating known mistakes = wasting user's time**

## Checklist (Create TodoWrite items for each)

- [ ] Acknowledged skill enforcement protocol
- [ ] Identified relevant skills for current task
- [ ] Invoked Skill tool for each relevant skill
- [ ] Announced skill usage to user
- [ ] Following skill workflow exactly
- [ ] Will not rationalize skipping any steps
