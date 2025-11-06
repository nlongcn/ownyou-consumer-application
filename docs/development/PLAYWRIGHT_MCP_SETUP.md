# Playwright MCP Setup for OwnYou Frontend Testing

**Purpose**: Configure Playwright Model Context Protocol (MCP) integration for testing OwnYou dashboard and frontend components.

**Last Updated**: 2025-01-05

---

## What is Playwright MCP?

**Playwright MCP** is a Model Context Protocol server that exposes Playwright browser automation tools to AI assistants (like Claude Code). This enables AI-driven testing of web interfaces without writing traditional test scripts.

**Benefits:**
- AI assistant can test frontend directly
- No need to write Playwright scripts manually
- Take screenshots for visual verification
- Check console for errors
- Test user interactions (clicks, typing, navigation)

---

## Installation

### Prerequisites

```bash
# Node.js required (v18 or higher)
node --version  # Should show v18.x or higher

# npm required
npm --version
```

### Install Playwright MCP Server

```bash
# Install globally
npm install -g @modelcontextprotocol/server-playwright

# Verify installation
npx -y @modelcontextprotocol/server-playwright --help
```

---

## Configuration

### Create MCP Config File

**File:** `.claude/mcp-config.json`

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-playwright"
      ],
      "env": {
        "PLAYWRIGHT_HEADLESS": "true"
      }
    }
  }
}
```

**Configuration options:**
- `PLAYWRIGHT_HEADLESS="true"` - Run browser without GUI (faster, for CI/CD)
- `PLAYWRIGHT_HEADLESS="false"` - Show browser window (for debugging)
- `PLAYWRIGHT_TIMEOUT="30000"` - Default timeout in ms (30 seconds)

### Restart Claude Code

After creating/updating `.claude/mcp-config.json`:

1. Close Claude Code completely
2. Reopen Claude Code
3. MCP server will initialize automatically
4. Check that Playwright tools are available

---

## Available MCP Tools

### Navigation Tools

**`mcp__playwright__browser_navigate`**
- **Purpose**: Navigate to a URL
- **Parameters**:
  - `url` (string): URL to navigate to
- **Example**: Navigate to http://localhost:3000

**`mcp__playwright__browser_snapshot`**
- **Purpose**: Take screenshot of current page
- **Parameters**: None
- **Returns**: Screenshot as base64-encoded image
- **Example**: Capture dashboard state

### Interaction Tools

**`mcp__playwright__browser_click`**
- **Purpose**: Click an element on the page
- **Parameters**:
  - `selector` (string): CSS selector for element
- **Example**: Click mission card `.mission-card:first-child`

**`mcp__playwright__browser_type`**
- **Purpose**: Type text into an input field
- **Parameters**:
  - `selector` (string): CSS selector for input
  - `text` (string): Text to type
- **Example**: Type search query into search box

**`mcp__playwright__browser_press_key`**
- **Purpose**: Press keyboard key
- **Parameters**:
  - `key` (string): Key name (e.g., "Enter", "Escape")
- **Example**: Press Enter to submit form

### Waiting Tools

**`mcp__playwright__browser_wait_for`**
- **Purpose**: Wait for element to appear/disappear
- **Parameters**:
  - `selector` (string): CSS selector
  - `state` (string): "attached", "detached", "visible", "hidden"
  - `timeout` (number): Timeout in ms (default: 30000)
- **Example**: Wait for mission cards to load

### Evaluation Tools

**`mcp__playwright__browser_evaluate`**
- **Purpose**: Execute JavaScript in browser context
- **Parameters**:
  - `script` (string): JavaScript code to execute
- **Returns**: Result of script execution
- **Example**: Get number of mission cards on page

**`mcp__playwright__browser_console_messages`**
- **Purpose**: Get console messages from browser
- **Parameters**: None
- **Returns**: Array of console messages with level (log/warn/error)
- **Example**: Check for errors during page load

---

## Testing Workflow

### 1. Start Development Servers

**Before testing, ensure servers are running:**

```bash
# Terminal 1: Frontend dev server
cd dashboard/frontend
npm run dev
# Runs on http://localhost:3000

# Terminal 2: Backend API server
cd dashboard/backend
python app.py
# Runs on http://localhost:5000
```

### 2. AI Assistant Uses Playwright MCP

**Example conversation:**

**User:** "Test the dashboard login flow"

**AI Assistant (Claude Code):**

```
I'll use Playwright MCP to test the login flow:

1. Navigating to dashboard...
   [Uses: mcp__playwright__browser_navigate]
   URL: http://localhost:3000

2. Taking initial screenshot...
   [Uses: mcp__playwright__browser_snapshot]
   Screenshot captured ✓

3. Waiting for "Connect Wallet" button...
   [Uses: mcp__playwright__browser_wait_for]
   Selector: button:has-text("Connect Wallet")
   Button found ✓

4. Clicking "Connect Wallet"...
   [Uses: mcp__playwright__browser_click]
   Clicked ✓

5. Waiting for wallet modal...
   [Uses: mcp__playwright__browser_wait_for]
   Selector: .wallet-modal
   Modal appeared ✓

6. Checking console for errors...
   [Uses: mcp__playwright__browser_console_messages]
   No errors found ✓

7. Taking final screenshot...
   [Uses: mcp__playwright__browser_snapshot]
   Screenshot captured ✓

Result: Login flow works correctly. No console errors.
Screenshots attached for verification.
```

### 3. Common Test Scenarios

#### Test Mission Card Display

```
1. Navigate to http://localhost:3000
2. Wait for .mission-card elements
3. Take screenshot
4. Verify at least 3 cards visible
5. Check console for errors
```

#### Test Mission Card Click

```
1. Navigate to dashboard
2. Wait for mission cards
3. Click first card
4. Wait for modal to appear
5. Verify modal contains card details
6. Take screenshot
7. Check console for errors
```

#### Test Mission Feedback Submission

```
1. Navigate to dashboard
2. Click mission card
3. Click feedback button
4. Wait for rating selector
5. Click 5-star rating
6. Type feedback text
7. Click submit
8. Wait for success message
9. Verify feedback saved
10. Check console for errors
```

---

## Testing Checklist Template

### For AI Assistants

**When testing ANY frontend feature, complete this checklist:**

```markdown
- [ ] Start frontend dev server (http://localhost:3000)
- [ ] Start backend API server (http://localhost:5000)
- [ ] Navigate to page using mcp__playwright__browser_navigate
- [ ] Wait for key elements using mcp__playwright__browser_wait_for
- [ ] Take initial screenshot using mcp__playwright__browser_snapshot
- [ ] Test interactions using mcp__playwright__browser_click
- [ ] Verify UI state changes
- [ ] Take final screenshot
- [ ] Check console messages using mcp__playwright__browser_console_messages
- [ ] Verify no errors present
- [ ] Show user screenshots and test results
```

---

## Troubleshooting

### MCP Server Not Available

**Problem:** Playwright MCP tools not showing up in tool list

**Solution:**
```bash
# 1. Verify MCP config exists
cat .claude/mcp-config.json

# 2. Check Node.js version
node --version  # Should be v18+

# 3. Reinstall Playwright MCP
npm install -g @modelcontextprotocol/server-playwright

# 4. Restart Claude Code completely
```

### Browser Fails to Launch

**Problem:** Error "Failed to launch browser"

**Solution:**
```bash
# Install browser binaries
npx playwright install chromium

# Or install all browsers
npx playwright install
```

### Timeout Errors

**Problem:** "Timeout waiting for element"

**Solution:**
```bash
# Increase timeout in MCP config
# Edit .claude/mcp-config.json:
{
  "env": {
    "PLAYWRIGHT_TIMEOUT": "60000"  # 60 seconds
  }
}
```

### Headless Mode Issues

**Problem:** Tests fail in headless mode but work with GUI

**Solution:**
```bash
# Temporarily disable headless for debugging
# Edit .claude/mcp-config.json:
{
  "env": {
    "PLAYWRIGHT_HEADLESS": "false"
  }
}

# Watch browser behavior
# Fix issues
# Re-enable headless mode
```

---

## Best Practices

### 1. Always Check Console

```javascript
// After every interaction, check console
// Use: mcp__playwright__browser_console_messages

// Verify no errors:
const messages = await getConsoleMessages();
const errors = messages.filter(m => m.type === 'error');
assert(errors.length === 0, "Console has errors!");
```

### 2. Wait for Elements

```javascript
// Don't click immediately - wait first
// Use: mcp__playwright__browser_wait_for

// Wrong:
click('.mission-card')  // May not be loaded yet

// Correct:
wait_for('.mission-card', state='visible')
click('.mission-card')
```

### 3. Take Screenshots for Verification

```javascript
// Take before/after screenshots
// Use: mcp__playwright__browser_snapshot

// Before interaction
snapshot()  // "before.png"

// Interact
click('.button')

// After interaction
snapshot()  // "after.png"

// Compare visually or show to user
```

### 4. Use Descriptive Selectors

```javascript
// Prefer semantic selectors
'.mission-card'               // Good - class name
'button:has-text("Submit")'   // Good - text content
'[data-testid="mission-123"]' // Best - test ID

// Avoid fragile selectors
'div > div > button:nth-child(3)'  // Bad - brittle
```

---

## Integration with Testing Discipline

**Playwright MCP testing is part of TDD cycle:**

1. **RED Phase**: Write test describing expected UI behavior
2. **GREEN Phase**: Implement UI to pass test
3. **REFACTOR Phase**: Improve UI code, test still passes
4. **Verification**: Use Playwright MCP to verify manually

**Example TodoWrite integration:**

```python
todos = [
    {"content": "Write test for mission card component", "status": "completed"},
    {"content": "Implement mission card component", "status": "completed"},
    {"content": "Start dev servers", "status": "completed"},
    {"content": "Test rendering with Playwright MCP", "status": "in_progress"},
    {"content": "Verify card displays correctly", "status": "pending"},
    {"content": "Test click interaction", "status": "pending"},
    {"content": "Check console for errors", "status": "pending"},
    {"content": "Take screenshots for review", "status": "pending"},
]
```

---

## Example Test Scripts

### Mission Card Display Test

```javascript
// Test: Mission cards display correctly

// 1. Navigate
await navigate('http://localhost:3000')

// 2. Wait for cards
await wait_for('.mission-card', state='visible', timeout=10000)

// 3. Count cards
const cardCount = await evaluate(`document.querySelectorAll('.mission-card').length`)
assert(cardCount >= 1, "At least one mission card should display")

// 4. Screenshot
await snapshot()

// 5. Check console
const messages = await getConsoleMessages()
const errors = messages.filter(m => m.type === 'error')
assert(errors.length === 0, "No console errors")
```

### Mission Feedback Test

```javascript
// Test: Submit mission feedback

// 1. Navigate and wait
await navigate('http://localhost:3000')
await wait_for('.mission-card', state='visible')

// 2. Click first card
await click('.mission-card:first-child')

// 3. Wait for modal
await wait_for('.mission-modal', state='visible')

// 4. Click feedback button
await click('button:has-text("Provide Feedback")')

// 5. Select rating
await click('.rating-star:nth-child(5)')  // 5 stars

// 6. Type feedback
await type('textarea[name="feedback"]', 'Great recommendation!')

// 7. Submit
await click('button:has-text("Submit")')

// 8. Wait for success
await wait_for('.success-message', state='visible')

// 9. Screenshot
await snapshot()

// 10. Verify no errors
const messages = await getConsoleMessages()
const errors = messages.filter(m => m.type === 'error')
assert(errors.length === 0, "No console errors")
```

---

## Reference

- **Testing Plan**: `docs/development/TESTING_PLAN.md`
- **Testing Discipline Skill**: `.claude/skills/testing-discipline/SKILL.md`
- **Playwright Documentation**: https://playwright.dev/
- **MCP Documentation**: https://modelcontextprotocol.io/

---

**Remember**: Use Playwright MCP for ALL frontend testing. Never manually write Playwright scripts - let the AI assistant use MCP tools instead.
