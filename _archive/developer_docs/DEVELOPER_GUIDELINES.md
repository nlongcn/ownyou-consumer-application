# Developer Guidelines - Working with AI Coding Assistants

## Overview

This guide shows you exactly how to use the project documentation to instruct AI coding assistants effectively. Follow these step-by-step instructions to ensure high-quality, compliant code that meets all project requirements.

## Step 1: Start with Essential Context

Copy this template at the beginning of **every** coding session:

```markdown
# AI Coding Session - Email Parser Frontend

## Project Context:
- **Goal**: Build privacy-first email analysis frontend (React/Next.js PWA)
- **Architecture**: Local-first, developer-managed API keys, encrypted storage
- **Current Sprint**: [Sprint X - Name from DEVELOPMENT_PLAN.md]
- **Current Task**: [Task X.Y - Name from DEVELOPMENT_PLAN.md]

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

## Step 2: Use the Specific Task Instructions

Find your task in `DEVELOPMENT_PLAN.md` and copy the **AI Instructions** section. For example, for Task 1.1:

```markdown
Please set up a Next.js 14 project for the email parser frontend following these requirements:

1. Initialize with TypeScript and App Router
2. Configure development tools:
   - ESLint with TypeScript rules
   - Prettier with 2-space indentation
   - Husky pre-commit hooks for linting
3. Add Tailwind CSS for styling
4. Create this folder structure:
   ```
   src/
   ├── app/                 # Next.js app router
   ├── components/          # React components
   │   ├── ui/             # Reusable UI components
   │   └── auth/           # Authentication components
   ├── lib/                # Utilities and configurations
   │   ├── auth/           # Authentication logic
   │   ├── crypto/         # Encryption utilities
   │   └── storage/        # IndexedDB wrapper
   ├── hooks/              # Custom React hooks
   └── types/              # TypeScript type definitions
   ```
5. Set up environment variables with developer API keys embedded
6. Add package.json scripts for all development tasks

Show me the complete setup with all configuration files.
```

## Step 3: Reference Architecture Constraints

Always include relevant architecture constraints:

```markdown
## Architecture Requirements (from developer_docs/architecture.md):
- Use React/Next.js PWA with service worker
- Local encryption using WebCrypto AES-GCM
- IndexedDB for encrypted storage (never localStorage)
- Developer-managed API keys (embedded in app for POC)
- No server-side processing of user content

## Security Requirements (from developer_docs/security_privacy.md):
- All user data encrypted at rest
- PII redaction before external API calls
- No hardcoded secrets in code
- Proper error handling without information leakage
```

## Step 4: Include Testing Requirements

From `TESTING_PLAN.md`, add the testing requirements:

```markdown
## Testing Requirements (from TESTING_PLAN.md):
Please implement tests alongside the feature:
- Unit tests with >80% coverage for utilities
- Integration tests for key workflows
- Security tests to validate no PII leakage
- Performance tests for Core Web Vitals
- Use Vitest and React Testing Library

Generate tests that cover:
- Happy path scenarios
- Error cases (network failures, invalid inputs)
- Edge cases (empty data, large datasets)
- Security cases (PII protection, token security)
```

## Step 5: Specify Quality Gates

Always include the acceptance criteria and quality gates:

```markdown
## Acceptance Criteria (from DEVELOPMENT_PLAN.md):
- [ ] `npm run dev` starts development server
- [ ] `npm run build` creates production build  
- [ ] `npm run test` runs test suite
- [ ] Code formatting and linting work
- [ ] All folders created with index files

## Quality Gates:
- [ ] Development server starts without errors
- [ ] TypeScript compilation works
- [ ] Linting passes on all files
- [ ] Pre-commit hooks prevent bad commits
```

## Complete Example: Starting Task 2.1 (Gmail OAuth)

Here's a complete instruction for a more complex task:

```markdown
# AI Coding Session - Email Parser Frontend

## Project Context:
- **Goal**: Build privacy-first email analysis frontend (React/Next.js PWA)
- **Architecture**: Local-first, developer-managed API keys, encrypted storage
- **Current Sprint**: Sprint 2 - OAuth Implementation
- **Current Task**: Task 2.1 - Gmail OAuth PKCE

## Documentation References:
- DEVELOPMENT_PLAN.md Sprint 2, Task 2.1
- TESTING_PLAN.md Section 2.1 (Integration Testing)
- developer_docs/architecture.md (OAuth PKCE requirements)
- developer_docs/security_privacy.md (Token security)

## Session Goal:
Implement Gmail OAuth PKCE authentication with encrypted token storage

## Expected Outcome:
Working Gmail authentication that stores encrypted tokens in IndexedDB

---

## Implementation Request:

Implement Gmail OAuth PKCE authentication following these specifications:

### Architecture Requirements (from developer_docs/architecture.md):
- Use PKCE flow for security (no client secret)
- Gmail scope: `https://www.googleapis.com/auth/gmail.readonly`
- Store all tokens encrypted using AES-GCM
- Use IndexedDB, never localStorage
- Handle token refresh silently in background

### Implementation Steps:
1. Create Google Cloud Console OAuth client (I'll provide credentials)
2. Implement PKCE flow with proper state management
3. Create GmailClient class with these methods:
   - `initiateAuth()` - starts OAuth flow
   - `handleCallback()` - processes auth response  
   - `refreshTokens()` - handles token refresh
   - `revokeAccess()` - cleans up tokens
4. Use encryption utilities from Sprint 1 for token storage
5. Add React component for Gmail connection UI

### Error Handling:
- Network failures during auth
- User denies consent
- Token expiry scenarios
- Invalid/corrupted stored tokens

### Testing (from TESTING_PLAN.md Section 2.1):
Generate these tests alongside implementation:
- Unit test: Token encryption/decryption roundtrip
- Integration test: Full OAuth flow end-to-end
- Security test: Verify no plain text tokens in storage
- Privacy test: No sensitive data in browser dev tools

### Acceptance Criteria:
- [ ] User can connect Gmail account
- [ ] Tokens are stored encrypted
- [ ] Token refresh works silently
- [ ] Can revoke access and clear tokens

### Quality Gates:
- [ ] OAuth flow completes in <10 seconds
- [ ] Tokens encrypted in IndexedDB (verify in dev tools)
- [ ] Auto-refresh works before expiry
- [ ] Manual token revocation clears all stored data
- [ ] All tests pass with >80% coverage

Please implement step by step with error handling and tests.
```

## For Subsequent Sessions (Handoff)

When continuing work, use this format:

```markdown
# AI Coding Session Continuation - Task 2.1

## Previous Session Recap:
- ✅ OAuth PKCE flow implemented and working
- ✅ Token encryption working with WebCrypto API
- 🔄 Token refresh logic implemented but triggers too frequently
- ⏸️ React component UI needs better error handling

## Files Modified Last Session:
- src/lib/auth/gmail-client.ts (OAuth implementation)
- src/components/auth/GmailConnect.tsx (basic UI)
- src/hooks/useAuth.ts (React hook)

## Current Session Focus:
Fix token refresh timing and improve error handling UI

## Specific Issues to Address:
1. Token refresh triggers every 5 minutes instead of near expiry
2. Error messages not user-friendly ("OAuth error" vs "Gmail connection failed")
3. Loading states missing during auth flow

## Expected Outcome:
- Token refresh only triggers when needed (15min before expiry)
- Clear, user-friendly error messages
- Proper loading states throughout auth flow
```

## Common Follow-up Instructions

### For Code Review:
```markdown
Please review this implementation against:

## Development Plan Compliance:
- [ ] All requirements from DEVELOPMENT_PLAN.md Task 2.1 met?
- [ ] All acceptance criteria satisfied?
- [ ] Quality gates passing?

## Architecture Compliance:
- [ ] Follows developer_docs/architecture.md constraints?
- [ ] Uses proper encryption (AES-GCM, not plain text)?
- [ ] No localStorage usage (IndexedDB only)?

## Security Review:
- [ ] No PII leakage in logs or external calls?
- [ ] Tokens properly encrypted in storage?
- [ ] Error messages don't expose sensitive info?

## Testing Compliance:
- [ ] Tests follow TESTING_PLAN.md requirements?
- [ ] Coverage >80% for utilities, >70% for components?
- [ ] Security and privacy tests included?
```

### For Debugging:
```markdown
I'm getting this error in Task 2.1 OAuth implementation:

```
TypeError: Cannot read properties of undefined (reading 'access_token')
  at handleOAuthCallback (gmail-client.ts:45)
  at GmailConnect.tsx:23
```

## Context:
- What I was doing: User completed Google OAuth consent, callback URL was called
- Expected: Access token should be extracted and encrypted for storage
- Actual: Getting undefined when trying to access token from response
- Browser: Chrome 120, localhost:3000
- OAuth response URL: http://localhost:3000/auth/callback?code=...&scope=...

## Relevant Code:
[paste the handleOAuthCallback function]

## Requirements:
This needs to follow DEVELOPMENT_PLAN.md Task 2.1 requirements for proper token handling and meet the acceptance criteria for encrypted token storage.

Please help debug and fix while maintaining all security and architecture requirements.
```

## Session Templates for Common Scenarios

### Starting a New Task
```markdown
# AI Coding Session - [Task X.Y Name]

## Context:
- Current Sprint: [Sprint X - Name]
- Current Task: [Task X.Y - Name]
- Dependencies: [What this builds on from previous tasks]
- Risk Level: [High/Medium/Low based on complexity]

## This Session Goal:
[Specific deliverable for this session]

## Success Criteria:
[How to know this session was successful]

## Implementation Request:
[Copy AI Instructions from DEVELOPMENT_PLAN.md]
```

### Continuing Existing Work
```markdown
# AI Coding Session Continuation - [Task X.Y]

## Previous Session Summary:
[Copy from last session's end summary]

## Current Focus:
[What to work on this session]

## Known Issues:
[Any problems that need addressing]

## Next Steps:
[Priority order of work]
```

### Feature Enhancement
```markdown
# AI Coding Session - Enhancement - [Task X.Y]

## Base Implementation Status:
- [What's already working]
- [What needs improvement]

## Enhancement Goals:
- [Specific improvements to make]
- [Performance/UX/Security enhancements]

## Requirements:
[Reference DEVELOPMENT_PLAN.md and TESTING_PLAN.md]
```

### Bug Fixes
```markdown
# AI Coding Session - Bug Fix - [Task X.Y]

## Bug Description:
- What's broken: [specific behavior]
- Expected: [what should happen]
- Actual: [what actually happens]
- Impact: [how it affects users/system]

## Environment:
- Browser: [version]
- OS: [version]
- Steps to reproduce: [numbered list]

## Requirements:
Fix must maintain all requirements from DEVELOPMENT_PLAN.md Task [X.Y]
```

## Quality Assurance Checklist

Before considering any task complete, verify:

### Functional Requirements
```markdown
## Development Plan Compliance:
- [ ] All requirements from DEVELOPMENT_PLAN.md Task [X.Y] implemented
- [ ] All acceptance criteria met
- [ ] All quality gates pass
- [ ] Integration with existing components works

## Architecture Compliance:
- [ ] Follows developer_docs/architecture.md constraints
- [ ] Uses proper encryption for sensitive data
- [ ] No localStorage usage (IndexedDB only)
- [ ] Proper error handling and user feedback
```

### Technical Requirements
```markdown
## Code Quality:
- [ ] TypeScript types complete and accurate
- [ ] No console.log statements in production code
- [ ] Error handling comprehensive and user-friendly
- [ ] Performance meets requirements (from TESTING_PLAN.md)

## Security & Privacy:
- [ ] No PII in logs or external API calls
- [ ] Tokens/sensitive data properly encrypted
- [ ] Input validation and sanitization
- [ ] Error messages don't expose sensitive information
```

### Testing Requirements
```markdown
## Test Coverage:
- [ ] Unit tests >80% coverage (utilities) />70% (components)
- [ ] Integration tests pass
- [ ] Security tests validate PII protection
- [ ] Performance tests meet timing requirements
- [ ] All tests run in <5s total

## Test Quality:
- [ ] Tests use realistic data (not "test@test.com")
- [ ] Error scenarios covered
- [ ] Edge cases covered
- [ ] Tests are maintainable and reliable
```

## Troubleshooting AI Collaboration

### When AI Misses Requirements
**Problem**: AI doesn't implement all requirements from development plan

**Solution**:
```markdown
The implementation is missing these requirements from DEVELOPMENT_PLAN.md Task [X.Y]:
- [Requirement 1]: [what's missing and why it's important]
- [Requirement 2]: [what's missing and expected behavior]

Please update the implementation to include all requirements and ensure tests validate them.
```

### When Tests Are Insufficient
**Problem**: AI generates tests but coverage is low or missing scenarios

**Solution**:
```markdown
The tests need improvement per TESTING_PLAN.md:
- Current coverage: [X]%, need >[Y]%
- Missing test cases: [specific scenarios not covered]
- Missing test types: [security/performance/accessibility/error handling]

Please enhance the test suite to meet all requirements with realistic test data.
```

### When Code Doesn't Follow Architecture
**Problem**: Implementation doesn't follow architecture constraints

**Solution**:
```markdown
The implementation doesn't follow developer_docs/architecture.md constraints:
- Issue 1: [specific violation] - Should be: [correct approach]
- Issue 2: [specific violation] - Should be: [correct approach]

Please refactor to comply with architecture requirements while maintaining functionality.
```

### When Performance Is Poor
**Problem**: Implementation is slow or doesn't meet performance requirements

**Solution**:
```markdown
Performance testing shows issues:
- Current: [metric] vs Required: [target] (from TESTING_PLAN.md)
- Bottleneck: [what's causing the slowness]

Please optimize while maintaining:
- All functional requirements from DEVELOPMENT_PLAN.md
- Test coverage requirements
- Security and privacy constraints
```

## Best Practices Summary

### Always Do:
1. ✅ **Start with context template** - AI needs full project understanding
2. ✅ **Reference specific docs** - Point to exact sections and requirements  
3. ✅ **Include acceptance criteria** - AI knows when task is complete
4. ✅ **Request tests with code** - Don't separate implementation and testing
5. ✅ **Validate against requirements** - Check all criteria are met
6. ✅ **Document handoffs** - Future sessions need clear starting point

### Never Do:
1. ❌ **Skip context** - AI will make wrong assumptions
2. ❌ **Implement without tests** - Quality will suffer
3. ❌ **Ignore architecture docs** - Code won't integrate properly
4. ❌ **Accept partial requirements** - Insist on complete implementation
5. ❌ **Skip quality gates** - Technical debt will accumulate
6. ❌ **Forget session summaries** - Continuity will be lost

### Quality Indicators of Good AI Collaboration:
- **Code passes all quality gates on first try**
- **Tests provide good coverage and catch regressions**
- **Implementation follows established patterns**
- **Documentation is clear and complete**
- **Performance meets all requirements**
- **Security and privacy constraints respected**

Following these guidelines ensures AI assistants produce high-quality, compliant code that integrates seamlessly into the overall project architecture while meeting all functional, security, and performance requirements.