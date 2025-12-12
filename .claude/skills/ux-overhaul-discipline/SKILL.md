---
name: ux-overhaul-discipline
description: Enforce UX-focused development discipline for OwnYou consumer app. Use when implementing any UI/UX changes, before completing any phase, or when uncertain about implementation approach. Ensures work aligns with user experience goals, V13 architecture, and strategic roadmap.
---

# UX Overhaul Discipline

This skill enforces quality gates and checkpoints during OwnYou UX implementation to ensure all changes improve user experience and align with project vision.

## Mandatory Checkpoints

### Before Starting Each Phase

1. Review the plan file: `~/.claude/plans/shimmering-zooming-leaf.md`
2. Confirm phase objectives and success criteria
3. Create TodoWrite items for all tasks in the phase

### During Implementation

1. **UX Question:** Before each change, ask: "Does this improve the user experience?"
2. **Consult V13:** When uncertain, read `docs/architecture/OwnYou_architecture_v13.md`
3. **Check Roadmap:** Verify alignment with `docs/roadmap/OwnYou_strategic_roadmap_v2.md`
4. **Vision Reference:** For value props, use `docs/requirements/*OwnYou's Vision and User Experiences*`

### After Completing Each Phase

1. Update plan file with ✅ completed items
2. Run tests: `cd apps/consumer && pnpm test`
3. Commit changes with descriptive message
4. Push to GitHub: `git push origin feature/sprint11-consumer-ui`
5. Update plan file with next phase status

## UX Principles

1. **Immediate Value** - Users should see value within 60 seconds of connecting data
2. **Abstraction** - Hide complexity (wallet, sync, crypto) from users
3. **Feedback** - Every action should have visible response
4. **Clarity** - Specific value props, not generic "AI assistant"
5. **Privacy First** - Emphasize "your data stays yours"

## Key Files Reference

| Purpose | File |
|---------|------|
| Plan | `~/.claude/plans/shimmering-zooming-leaf.md` |
| V13 Architecture | `docs/architecture/OwnYou_architecture_v13.md` |
| Strategic Roadmap | `docs/roadmap/OwnYou_strategic_roadmap_v2.md` |
| Vision Doc | `docs/requirements/*OwnYou's Vision and User Experiences*` |
| Consumer App | `apps/consumer/src/` |
| UI Components | `packages/ui-components/src/` |
| Design Tokens | `packages/ui-design-system/src/tokens/` |

## Implementation Phases

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 1 | Mission Pipeline | IAB → Agents → Mission Feed |
| 2 | Visual Design | Brand colors, 35px radius, fonts |
| 3 | Onboarding | Value props, wallet abstraction, Browser vs Desktop |
| 4 | Feedback Loop | Visual responses to actions |
| 5 | Ikigai Profile | Real data from classifications |
| 6 | Mission Detail | "Why this mission?" reasoning |
| 7 | Polish | Celebration moments, chat input |
