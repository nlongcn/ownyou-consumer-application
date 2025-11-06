# AI Collaboration Guide - Email Parser Frontend

## Overview
This guide provides specific instructions for collaborating with AI coding assistants (Claude, ChatGPT, Cursor, etc.) throughout the email parser frontend development process.

## Quick Start for AI Sessions

### Essential Context Template
Copy this template at the start of every AI coding session:

```markdown
# AI Coding Session - Email Parser Frontend

## Project Context:
- **Goal**: Build privacy-first email analysis frontend (React/Next.js PWA)
- **Architecture**: Local-first, developer-managed API keys, encrypted storage
- **Current Sprint**: [Sprint X - Name from DEVELOPMENT_PLAN.md]
- **Current Task**: [Task X.Y - Name with acceptance criteria]

## Documentation References:
- DEVELOPMENT_PLAN.md - Sprint-by-sprint implementation tasks
- TESTING_PLAN.md - Testing requirements and examples
- developer_docs/architecture.md - Technical architecture constraints
- developer_docs/security_privacy.md - Privacy and security requirements

## Session Goal:
[Specific thing to accomplish this session]

## Expected Outcome:
[What should be working by end of session]
```

## Development Workflow with AI

### 1. Task Planning Phase

**Human Input**:
```markdown
I'm starting Task [X.Y] from DEVELOPMENT_PLAN.md. 

Current requirements:
- [copy requirements from development plan]
- [copy acceptance criteria]
- [copy quality gates]

Please break this down into implementation steps and identify any dependencies or risks.
```

**AI Response Should Include**:
- Step-by-step implementation plan
- Dependencies on previous tasks
- Potential risks or challenges
- Recommended order of implementation
- Estimated complexity/time

### 2. Implementation Phase

**For Each Implementation Step**:

```markdown
Implement [specific step] with these requirements:

## Technical Constraints:
- [reference architecture.md constraints]
- [reference security_privacy.md requirements]

## Testing Requirements:
- [copy from TESTING_PLAN.md relevant section]
- Generate tests alongside implementation
- Ensure >80% coverage for utilities, >70% for components

## Acceptance Criteria:
- [specific criteria from development plan]

Please implement with proper error handling, TypeScript types, and corresponding tests.
```

### 3. Testing and Validation Phase

```markdown
Review the implementation against:

## Development Plan Requirements:
- [ ] Requirement 1: [check implementation]
- [ ] Requirement 2: [check implementation]

## Testing Plan Compliance:
- [ ] Tests generated and passing
- [ ] Coverage meets requirements
- [ ] Security tests validate PII protection
- [ ] Performance tests validate timing requirements

## Architecture Compliance:
- [ ] Follows local-first principles
- [ ] Uses proper encryption for sensitive data
- [ ] Handles errors gracefully
- [ ] Provides good user feedback

Please fix any gaps and ensure all criteria are met.
```

## Specific Collaboration Patterns

### Pattern 1: Feature + Tests Together

**Request**:
```markdown
Implement [feature] with comprehensive tests following TESTING_PLAN.md Section [X].

Requirements:
- TDD approach: write failing tests first
- Cover happy path, edge cases, error scenarios
- Include security tests for PII protection
- Performance assertions where relevant
- Use realistic test data, not placeholder strings
```

### Pattern 2: Progressive Enhancement

**Phase 1 Request**:
```markdown
Implement basic [feature] functionality:
- Core happy path working
- Minimal error handling
- Basic tests passing

Keep it simple but correct. We'll enhance in next phases.
```

**Phase 2 Request**:
```markdown
Enhance [feature] with:
- Comprehensive error handling
- User-friendly error messages
- Edge case coverage
- Complete test suite
```

### Pattern 3: Integration and Polish

**Request**:
```markdown
Integrate [feature] with existing components:
- Test with [related components]
- Ensure proper TypeScript types
- Add loading states and error boundaries
- Validate accessibility (WCAG 2.2 AA)
- Performance optimization if needed
```

## Code Quality Standards for AI

### TypeScript Requirements
```markdown
Ensure all code includes:
- Proper TypeScript types (no 'any' types)
- JSDoc comments for public functions
- Consistent naming conventions (camelCase)
- Proper error handling with typed exceptions
```

### React/Next.js Best Practices
```markdown
Follow these patterns:
- Functional components with hooks
- Proper dependency arrays in useEffect
- Error boundaries for error handling
- Accessibility attributes (ARIA labels, roles)
- Semantic HTML elements
```

### Security Requirements
```markdown
Always validate:
- No PII in console.log statements
- Sensitive data encrypted before storage
- Input sanitization for user data
- HTTPS-only for external API calls
- Proper token handling (no exposure)
```

## Session Handoff Protocol

### End of Session Summary
```markdown
# Session Complete - Task [X.Y]

## Completed:
- ✅ [Requirement 1] - fully implemented and tested
- 🔄 [Requirement 2] - 80% done, needs [specific work]
- ⏸️ [Requirement 3] - not started, blocked by [issue]

## Files Created/Modified:
- src/[path]/[file].ts - [description of changes]
- src/[path]/[file].test.ts - [test coverage added]
- [other files]

## Test Results:
- Unit tests: [X] passing, [Y] total
- Coverage: [X]% statements, [Y]% branches
- Integration tests: [status]
- Performance: [metrics if relevant]

## Known Issues:
- [Issue 1]: [description and impact]
- [Issue 2]: [description and next steps]

## Next Session Should:
1. [Priority 1 task]
2. [Priority 2 task]
3. [Priority 3 task]

## Architecture Decisions:
- [Any important technical decisions made]
- [Rationale for approach taken]
- [Alternatives considered]
```

### Start of Next Session
```markdown
# Session Start - Task [X.Y] Continuation

## Previous Session Recap:
[Copy relevant parts from previous session summary]

## Current Focus:
[Specific goal for this session]

## Success Criteria:
[How to know this session was successful]
```

## Common AI Collaboration Scenarios

### Scenario 1: Debugging Issues
```markdown
I'm getting this error in Task [X.Y]:
```
[Error message and stack trace]
```

Context:
- What I was trying to do: [description]
- What I expected: [expected behavior]
- What happened: [actual behavior]
- Environment: [browser, versions, etc.]

The issue seems to be in [file/function]. Here's the relevant code:
[code snippet]

Please help debug and fix this issue while maintaining the requirements from DEVELOPMENT_PLAN.md Task [X.Y].
```

### Scenario 2: Performance Optimization
```markdown
Task [X.Y] is complete but performance testing shows:
- [Metric 1]: [current] vs [target]
- [Metric 2]: [current] vs [target]

Requirements from TESTING_PLAN.md:
- [performance requirements]

Please optimize while maintaining functionality and test coverage.
```

### Scenario 3: Security Review
```markdown
Please review Task [X.Y] implementation for security compliance:

Check against developer_docs/security_privacy.md:
- PII protection in external API calls
- Token encryption and storage
- Input validation and sanitization
- Error handling without information leakage

Identify any security issues and provide fixes.
```

### Scenario 4: Accessibility Improvements
```markdown
Enhance Task [X.Y] for accessibility compliance:

Requirements:
- WCAG 2.2 AA compliance
- Screen reader support
- Keyboard-only navigation
- Focus management
- Color contrast requirements

Test with accessibility tools and provide improvements.
```

## Quality Assurance with AI

### Pre-Merge Checklist
```markdown
Before considering Task [X.Y] complete, verify:

## Functional Requirements:
- [ ] All acceptance criteria from DEVELOPMENT_PLAN.md met
- [ ] All quality gates pass
- [ ] Integration with existing components works

## Technical Requirements:
- [ ] TypeScript types complete and accurate
- [ ] No console.log statements in production code
- [ ] Error handling comprehensive and user-friendly
- [ ] Performance meets requirements

## Testing Requirements:
- [ ] Unit tests >80% coverage (utilities) />70% (components)
- [ ] Integration tests pass
- [ ] Security tests validate PII protection
- [ ] All tests run in <5s total

## Documentation:
- [ ] JSDoc comments for public APIs
- [ ] README updates if needed
- [ ] Architecture decisions documented
```

## Troubleshooting AI Collaboration

### When AI Misses Requirements
**Problem**: AI doesn't implement all requirements from development plan

**Solution**:
```markdown
The implementation is missing these requirements from DEVELOPMENT_PLAN.md Task [X.Y]:
- [Requirement 1]: [what's missing]
- [Requirement 2]: [what's missing]

Please update the implementation to include all requirements and ensure tests validate them.
```

### When Tests Are Insufficient
**Problem**: AI generates tests but coverage is low or missing scenarios

**Solution**:
```markdown
The tests need improvement per TESTING_PLAN.md:
- Current coverage: [X]%, need >[Y]%
- Missing test cases: [list scenarios not covered]
- Missing test types: [security/performance/accessibility]

Please enhance the test suite to meet all requirements.
```

### When Code Doesn't Follow Architecture
**Problem**: Implementation doesn't follow architecture constraints

**Solution**:
```markdown
The implementation doesn't follow developer_docs/architecture.md constraints:
- Issue 1: [specific violation and correct approach]
- Issue 2: [specific violation and correct approach]

Please refactor to comply with the architecture requirements.
```

## Success Metrics for AI Collaboration

### Effective AI Sessions Include:
- Clear context and requirements upfront
- Step-by-step implementation with rationale
- Tests generated alongside code
- Architecture compliance validation
- Proper session handoff documentation

### Quality Indicators:
- Code passes all quality gates on first try
- Tests provide good coverage and catch regressions
- Implementation follows established patterns
- Documentation is clear and complete
- Performance meets requirements

This collaboration approach ensures AI assistants have the context and guidance needed to produce high-quality, compliant code that fits seamlessly into the overall project architecture.