# Development Plan - Email Parser Frontend

## Overview
This document outlines a realistic, step-by-step development plan for building the email parser frontend as a proof-of-concept. Each task is discrete, testable, and builds incrementally toward the MVP.

**This plan is designed for AI-assisted development** - each task includes specific instructions for collaborating with AI coding assistants like Claude, ChatGPT, or Cursor.

## Sprint Structure
- **Sprint Duration**: 2 weeks
- **Total Estimated Duration**: 12-16 weeks (6-8 sprints)
- **Team Size**: 1-2 developers + AI coding assistant

## AI Collaboration Guidelines

### Session Context Template
Use this template at the start of each AI coding session:

```markdown
# AI Coding Session Context
## Current Sprint: [Sprint X - Name]
## Current Task: [Task X.Y - Name] 
## Progress: [X% complete - what's working/what's not]
## Files Modified: [list of files touched]
## Current Issue: [specific problem to solve]
## Next Steps: [what needs to happen next]
```

### Task Instructions for AI
Each task below includes:
- **Context**: What this builds on from previous tasks
- **Requirements**: Specific technical requirements
- **Acceptance Criteria**: How to know it's done
- **AI Instructions**: Specific guidance for AI implementation
- **Testing Requirements**: What tests to implement
- **Quality Gates**: How to verify the implementation

### Session Handoff Protocol

**At End of Each Session**:
```markdown
# Session Summary - [Task X.Y]
## Completed:
- [✅] Requirement 1 - working correctly
- [🔄] Requirement 2 - 80% done, needs error handling
- [ ] Requirement 3 - not started

## Files Created/Modified:
- src/lib/auth/gmail-client.ts (OAuth implementation)
- src/components/auth/GmailConnect.tsx (UI component)
- src/hooks/useAuth.ts (React hook)

## Known Issues:
- Token refresh triggers too frequently (every 5min vs near expiry)
- Error messages not user-friendly
- Tests pass but coverage only 65%

## Next Session Should:
1. Fix token refresh timing logic
2. Improve error handling and user feedback
3. Add missing test cases to reach 80% coverage

## Architecture Notes:
- Using Web Crypto API for encryption (works in all browsers)
- IndexedDB structure: { tokenData: encryptedTokens, keyDerivation: salt }
- OAuth state stored in sessionStorage for security
```

**At Start of Each Session**:
```markdown
# Session Context - [Task X.Y] 
## Previous Progress: [reference last session summary]
## Current Goal: [specific thing to work on this session]
## Expected Outcome: [what should be working by end of session]
```

### Progressive Implementation Strategy

**Phase 1: Core Functionality**
- Get basic happy path working
- Minimal error handling
- Basic tests

**Phase 2: Error Handling**
- Add comprehensive error handling
- User-friendly error messages
- Edge case coverage

**Phase 3: Polish & Performance**
- Performance optimization
- Accessibility improvements
- Complete test coverage

**Phase 4: Integration**
- Test with other components
- End-to-end validation
- Production readiness

---

## Sprint 1: Project Foundation (Weeks 1-2)

### Task 1.1: Project Setup
**Deliverable**: Working development environment

**Context**: Starting fresh - this is the foundation for all subsequent tasks.

**Requirements**:
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Configure ESLint, Prettier, Husky pre-commit hooks
- [ ] Set up Tailwind CSS for styling
- [ ] Configure environment variables (.env.local, .env.example)
- [ ] Create basic folder structure (`/components`, `/lib`, `/hooks`, `/types`)
- [ ] Set up package.json scripts (dev, build, test, lint)

**AI Instructions**:
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

**Acceptance Criteria**:
- `npm run dev` starts development server
- `npm run build` creates production build
- `npm run test` runs (empty) test suite
- Code formatting and linting work
- All folders created with index files

**Quality Gates**:
- [ ] Development server starts without errors
- [ ] TypeScript compilation works
- [ ] Linting passes on all files
- [ ] Pre-commit hooks prevent bad commits

### Task 1.2: Basic PWA Shell
**Deliverable**: Installable PWA with offline capability
- [ ] Configure next.config.js for PWA
- [ ] Create app manifest.json
- [ ] Set up service worker for offline support
- [ ] Create basic app shell (header, nav, main content area)
- [ ] Add loading states and error boundaries

**Acceptance Criteria**:
- App is installable on mobile/desktop
- Works offline (shows cached content)
- Lighthouse PWA score > 90

### Task 1.3: Local Storage & Encryption Setup
**Deliverable**: Encrypted local storage system
- [ ] Install and configure crypto libraries (WebCrypto API wrapper)
- [ ] Create encryption/decryption utilities
- [ ] Set up IndexedDB wrapper with encryption
- [ ] Create key derivation from passphrase (PBKDF2)
- [ ] Implement session lock/unlock mechanism

**Acceptance Criteria**:
- Can store/retrieve encrypted data in IndexedDB
- Session locks after inactivity
- Passphrase unlock works
- Browser dev tools show encrypted data only

---

## Sprint 2: OAuth Implementation (Weeks 3-4)

### Task 2.1: Gmail OAuth PKCE
**Deliverable**: Gmail authentication flow

**Context**: Builds on Sprint 1 encryption utilities and storage system. This is critical path - email import depends on this.

**Requirements**:
- [ ] Set up Google Cloud Console project
- [ ] Configure OAuth 2.0 client for SPA
- [ ] Implement PKCE flow for Gmail
- [ ] Store tokens in encrypted IndexedDB
- [ ] Handle token refresh automatically
- [ ] Add token revocation

**AI Instructions**:
```markdown
Implement Gmail OAuth PKCE authentication following these specifications:

## Architecture Requirements (from developer_docs/architecture.md):
- Use PKCE flow for security (no client secret)
- Gmail scope: `https://www.googleapis.com/auth/gmail.readonly`
- Store all tokens encrypted using AES-GCM
- Use IndexedDB, never localStorage
- Handle token refresh silently in background

## Implementation Steps:
1. Create Google Cloud Console OAuth client (I'll provide credentials)
2. Implement PKCE flow with proper state management
3. Create GmailClient class with these methods:
   - `initiateAuth()` - starts OAuth flow
   - `handleCallback()` - processes auth response
   - `refreshTokens()` - handles token refresh
   - `revokeAccess()` - cleans up tokens
4. Use encryption utilities from Sprint 1 for token storage
5. Add React component for Gmail connection UI

## Error Handling:
- Network failures during auth
- User denies consent
- Token expiry scenarios
- Invalid/corrupted stored tokens

## Testing (from TESTING_PLAN.md Section 2.1):
- Unit test: Token encryption/decryption roundtrip
- Integration test: Full OAuth flow end-to-end
- Security test: Verify no plain text tokens in storage
- Privacy test: No sensitive data in browser dev tools

Show implementation step by step with error handling and tests.
```

**Acceptance Criteria**:
- User can connect Gmail account
- Tokens are stored encrypted
- Token refresh works silently
- Can revoke access and clear tokens

**Quality Gates**:
- [ ] OAuth flow completes in <10 seconds
- [ ] Tokens encrypted in IndexedDB (verify in dev tools)
- [ ] Auto-refresh works before expiry
- [ ] Manual token revocation clears all stored data
- [ ] All tests pass with >80% coverage

### Task 2.2: Outlook OAuth PKCE
**Deliverable**: Outlook/Microsoft authentication flow
- [ ] Set up Azure App Registration
- [ ] Configure Microsoft Graph API permissions
- [ ] Implement PKCE flow for Microsoft Graph
- [ ] Handle both Outlook.com and Office 365
- [ ] Store tokens alongside Gmail tokens
- [ ] Add provider selection UI

**Acceptance Criteria**:
- User can connect Outlook/Hotmail account
- Both personal and work accounts supported
- Can have both Gmail and Outlook connected
- Provider status visible in UI

### Task 2.3: Account Management UI
**Deliverable**: Account connection and management interface
- [ ] Create account setup wizard
- [ ] Show connected accounts status
- [ ] Add disconnect/revoke functionality
- [ ] Display token expiry and health
- [ ] Handle authentication errors gracefully

**Acceptance Criteria**:
- Clear setup flow for new users
- Connected accounts visible with status
- Can disconnect accounts
- Error states are user-friendly

---

## Sprint 3: Email Import Foundation (Weeks 5-6)

### Task 3.1: Gmail API Integration
**Deliverable**: Gmail email fetching
- [ ] Implement Gmail API client
- [ ] Fetch messages with metadata only first
- [ ] Handle pagination and rate limits
- [ ] Add date range filtering
- [ ] Implement incremental sync with cursors

**Acceptance Criteria**:
- Can fetch Gmail messages for date range
- Respects Gmail API rate limits
- Handles pagination correctly
- Shows progress during import

### Task 3.2: Outlook API Integration
**Deliverable**: Outlook email fetching
- [ ] Implement Microsoft Graph Mail API client
- [ ] Fetch messages with consistent format
- [ ] Handle Outlook-specific pagination
- [ ] Add delta queries for incremental sync
- [ ] Normalize data format with Gmail

**Acceptance Criteria**:
- Can fetch Outlook messages for date range
- Data format matches Gmail implementation
- Delta sync works for updates
- Progress tracking works

### Task 3.3: MIME/HTML Parser in WebWorker
**Deliverable**: Email content parsing system
- [ ] Set up WebWorker for background parsing
- [ ] Implement MIME parsing (headers, multipart)
- [ ] Add HTML-to-text conversion
- [ ] Create email content sanitization
- [ ] Add progress reporting from worker

**Acceptance Criteria**:
- Emails parsed without blocking UI
- HTML content safely sanitized
- Plain text extracted correctly
- Worker reports parsing progress

---

## Sprint 4: Analysis Engine Core (Weeks 7-8)

### Task 4.1: Port Python Analysis to TypeScript
**Deliverable**: Client-side analysis engine
- [ ] Port EmailSummary and EmailClassification models
- [ ] Implement basic categorization rules
- [ ] Add sentiment analysis (rule-based first)
- [ ] Create product extraction patterns
- [ ] Add confidence scoring

**Acceptance Criteria**:
- Can categorize emails locally
- Produces consistent results with Python version
- Performance acceptable for 100+ emails
- Confidence scores are meaningful

### Task 4.2: LLM Integration (Developer Keys)
**Deliverable**: External LLM analysis capability
- [ ] Create OpenAI API client with developer keys
- [ ] Add Claude API client with developer keys
- [ ] Implement request batching and rate limiting
- [ ] Add data redaction before LLM calls
- [ ] Create fallback to local analysis

**Acceptance Criteria**:
- Can analyze emails with OpenAI/Claude
- PII is redacted before external calls
- Rate limiting prevents API errors
- Graceful fallback when APIs unavailable

### Task 4.3: Analysis UI and Progress
**Deliverable**: Analysis execution interface
- [ ] Create analysis configuration UI
- [ ] Show real-time progress during analysis
- [ ] Display results in structured format
- [ ] Add re-run capability with different settings
- [ ] Show confidence and coverage metrics

**Acceptance Criteria**:
- User can start analysis easily
- Progress is clearly communicated
- Results are well-formatted
- Can adjust settings and re-run

---

## Sprint 5: Data Visualization (Weeks 9-10)

### Task 5.1: Ikigai Dashboard
**Deliverable**: Ikigai analysis visualization
- [ ] Create ikigai radar/circle chart
- [ ] Show personal vs commercial email breakdown
- [ ] Display confidence scores and evidence
- [ ] Add filtering and drill-down capabilities
- [ ] Implement responsive design

**Acceptance Criteria**:
- Ikigai results clearly visualized
- Interactive charts with good UX
- Works on mobile and desktop
- Accessible to screen readers

### Task 5.2: Marketing Dashboard
**Deliverable**: Marketing analysis visualization
- [ ] Create category breakdown charts
- [ ] Show brand engagement timeline
- [ ] Display purchase prediction cards
- [ ] Add geographic insights visualization
- [ ] Implement data export functionality

**Acceptance Criteria**:
- Marketing insights clearly presented
- Charts are interactive and informative
- Purchase predictions well-formatted
- Data can be exported as CSV/JSON

### Task 5.3: Email List and Search
**Deliverable**: Email browsing and search interface
- [ ] Create paginated email list
- [ ] Add search and filtering capabilities
- [ ] Show analysis results per email
- [ ] Add bulk selection and actions
- [ ] Implement virtual scrolling for performance

**Acceptance Criteria**:
- Can browse large email collections smoothly
- Search is fast and accurate
- Filters work correctly
- Performance good with 1000+ emails

---

## Sprint 6: External API Integration (Weeks 11-12)

### Task 6.1: ASIN Data API Integration
**Deliverable**: Product recommendation system
- [ ] Set up ASIN Data API with developer keys
- [ ] Implement product search based on analysis
- [ ] Create product card components
- [ ] Add image loading and caching
- [ ] Implement rate limiting and error handling

**Acceptance Criteria**:
- Recommendations based on email analysis
- Product images load quickly
- API errors handled gracefully
- Rate limits respected

### Task 6.2: Basic Sharing System
**Deliverable**: Share analysis results
- [ ] Create encrypted export functionality
- [ ] Generate shareable reports (PDF/HTML)
- [ ] Implement basic sharing UI
- [ ] Add privacy controls and redaction options
- [ ] Create share link generation

**Acceptance Criteria**:
- Can export analysis as encrypted file
- Sharing respects privacy settings
- Reports are well-formatted
- Share links work correctly

---

## Sprint 7-8: Polish and Testing (Weeks 13-16)

### Task 7.1: Comprehensive Testing
**Deliverable**: Full test suite
- [ ] Unit tests for all utilities and components
- [ ] Integration tests for API clients
- [ ] E2E tests for critical user flows
- [ ] Accessibility testing with axe
- [ ] Performance testing with Lighthouse

### Task 7.2: Security and Privacy Audit
**Deliverable**: Security-validated application
- [ ] ZAP security scan and fixes
- [ ] Privacy flow audit (no PII leakage)
- [ ] Dependency security audit
- [ ] CSP and security headers implementation
- [ ] Rate limiting and abuse prevention

### Task 7.3: Production Readiness
**Deliverable**: Production-ready application
- [ ] Performance optimization
- [ ] Error monitoring setup
- [ ] Documentation and user guides
- [ ] Deployment configuration
- [ ] Monitoring and alerting setup

---

## Success Metrics

### Technical Metrics
- **Performance**: Time to Interactive < 3s, Largest Contentful Paint < 2s
- **Reliability**: Error rate < 1%, API success rate > 99%
- **Security**: Zero high-severity vulnerabilities
- **Accessibility**: WCAG 2.2 AA compliance

### User Experience Metrics
- **Import Success Rate**: >95% of import attempts succeed
- **Analysis Completion Rate**: >90% of analyses complete successfully
- **User Satisfaction**: Positive feedback on ease of use
- **Privacy Compliance**: Zero PII leakage incidents

### Business Metrics
- **Proof of Concept Goals**: Demonstrate feasibility of local-first email analysis
- **Technology Validation**: Validate architecture for scale
- **User Validation**: Confirm user value proposition