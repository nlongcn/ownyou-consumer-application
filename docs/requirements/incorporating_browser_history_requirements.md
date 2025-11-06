# Browser Extension Development for History Access: Chrome and Safari Implementation Guide

**Safari does not support browsing history APIs.** This fundamental limitation shapes every decision when building cross-browser extensions requiring history access. Chrome offers full-featured history APIs through Manifest V3, while Safari requires workarounds using navigation tracking and local storage. This guide provides practical, implementation-ready approaches for both platforms, with emphasis on minimal user friction and privacy-first design.

## Chrome extension development has fully transitioned to Manifest V3

As of June 2025, Chrome 139 completely removed Manifest V2 support with no enterprise workarounds available. All Chrome extensions must now use Manifest V3, which replaces background pages with service workers, separates host permissions from regular permissions, and eliminates remotely hosted code. This affects architecture fundamentally—service workers terminate after 30 seconds of inactivity, requiring storage APIs for persistence instead of global variables.

### Chrome History API provides comprehensive browsing data access

The `chrome.history` API offers eight methods for reading, searching, and modifying browsing history. Request the `"history"` permission in manifest.json, which triggers a user-visible warning stating the extension can "Read your browsing history." The API supports Promise-based calls as of Chrome 122, enabling modern async/await patterns.

**Core API methods with practical examples:**

```javascript
// manifest.json
{
  "manifest_version": 3,
  "name": "History Tracker",
  "version": "1.0.0",
  "permissions": ["history", "storage"],
  "background": {
    "service_worker": "background.js"
  }
}

// Search history with time constraints
const results = await chrome.history.search({
  text: 'github.com',
  startTime: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
  maxResults: 100
});

// Get detailed visit information
const visits = await chrome.history.getVisits({
  url: 'https://example.com/'
});

visits.forEach(visit => {
  console.log(`Visit Time: ${new Date(visit.visitTime)}`);
  console.log(`Transition: ${visit.transition}`); // link, typed, reload, etc.
  console.log(`Is Local: ${visit.isLocal}`); // Chrome 115+
});

// Real-time monitoring
chrome.history.onVisited.addListener((historyItem) => {
  console.log(`Visited: ${historyItem.url}`);
  // Fires before page loads
});
```

The HistoryItem interface returns url, title, lastVisitTime, visitCount, and typedCount. TransitionType indicates how users navigated—link, typed, auto_bookmark, form_submit, reload, or keyword. Use startTime and endTime parameters to constrain queries, as the default only searches 24 hours of history.

### Service worker architecture requires persistence strategies

Background scripts now run as service workers that terminate when idle, creating challenges for maintaining state. Use chrome.storage for persistence, implement alarms for periodic tasks, and handle the onSuspend event to save data before termination.

```javascript
// Service worker lifecycle management
let cachedData = null;

async function getData() {
  if (!cachedData) {
    const stored = await chrome.storage.local.get('data');
    cachedData = stored.data || [];
  }
  return cachedData;
}

chrome.runtime.onSuspend.addListener(async () => {
  if (cachedData) {
    await chrome.storage.local.set({ data: cachedData });
  }
});

// Use alarms for periodic processing
chrome.alarms.create('analyzeHistory', {
  periodInMinutes: 60
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'analyzeHistory') {
    const history = await chrome.history.search({
      text: '',
      maxResults: 500
    });
    // Process history data
  }
});
```

## Safari Web Extensions lack history API support entirely

Apple's Safari Web Extensions framework, mature since Safari 14 (2020) and supporting iOS since Safari 15 (2021), implements most WebExtensions APIs but **does not support any browsing history APIs**. According to Apple Developer Forums, Safari doesn't support browser.history.search, getVisits, addUrl, deleteUrl, or any history events. Apple recommends filing feedback requests for this feature through feedbackassistant.apple.com.

### Safari requires navigation tracking workarounds

Without history APIs, track browsing manually using tabs.onUpdated and store data locally. This approach provides current-session tracking but cannot access historical data from before extension installation.

```javascript
// Safari workaround: manual history tracking
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && !tab.incognito) {
    // Store visit data locally
    const { visitLog = [] } = await browser.storage.local.get('visitLog');
    
    visitLog.push({
      url: changeInfo.url,
      title: tab.title,
      timestamp: Date.now(),
      domain: new URL(changeInfo.url).hostname
    });
    
    // Maintain reasonable size
    if (visitLog.length > 1000) {
      visitLog.shift();
    }
    
    await browser.storage.local.set({ visitLog });
  }
});
```

This limitation fundamentally affects Safari compatibility. Extensions requiring comprehensive browsing history cannot provide full functionality on Safari without access to native macOS History.db, which requires additional permissions and works only on macOS, not iOS.

### Safari distribution requires App Store packaging

Safari extensions must be wrapped in native Mac/iOS apps and distributed exclusively through the App Store. Use Xcode's `safari-web-extension-converter` tool or upload ZIP files to App Store Connect for automatic conversion. This requires a $99/year Apple Developer Program membership with no alternatives for distribution outside the App Store.

```bash
# Convert Chrome extension to Safari format
xcrun safari-web-extension-converter \
  --bundle-identifier com.company.extension \
  --swift \
  --project-location ./safari-output \
  /path/to/chrome-extension
```

The conversion tool generates Xcode projects with macOS/iOS targets, warns about unsupported APIs (like history), and requires 512x512 and 1024x1024 icons. The containing app must provide value beyond hosting the extension—Apple rejects trivial wrapper apps.

## WXT Framework provides optimal cross-browser development

After evaluating frameworks, **WXT emerges as the recommended solution** for Chrome and Safari development. Built on Vite, WXT offers superior developer experience with fast HMR, smallest bundle sizes through effective tree-shaking, and active maintenance. It supports both Manifest V2 (Safari default) and V3 (Chrome) from unified codebases.

### WXT architecture and setup

Install WXT and scaffold projects through the interactive CLI, which supports vanilla JavaScript, React, Vue, Svelte, and Solid templates. The framework uses file-based configuration with automatic manifest generation.

```bash
# Create new project
npx wxt@latest init my-extension --template react

# Build for specific browsers
pnpm wxt build -b chrome  # Manifest V3
pnpm wxt build -b safari  # Manifest V2

# Development with live reload
pnpm wxt dev --browser=chrome
```

**Project structure:**

```
project-root/
├── entrypoints/
│   ├── background.ts        # Service worker
│   ├── content.ts           # Content scripts
│   ├── popup/
│   │   ├── index.html
│   │   └── main.tsx
│   └── options/
│       └── index.html
├── components/              # Shared UI components
├── utils/                   # Shared utilities
└── wxt.config.ts           # Configuration
```

Configure WXT for browser-specific requirements through wxt.config.ts:

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'My Extension',
    permissions: ['storage', 'tabs'],
  },
  // Browser detection in code
  // Use import.meta.env.BROWSER === 'safari'
});
```

### Plasmo Framework as React-focused alternative

Plasmo provides batteries-included development with first-class React support, built-in messaging APIs, and declarative file-based architecture. However, it uses outdated Parcel bundler causing compatibility issues, produces larger bundles than Vite-based solutions, and appears in maintenance mode with limited active development as of 2024-2025.

Choose Plasmo for rapid prototyping of React-centric extensions where bundle size isn't critical. Choose WXT for production projects requiring optimal performance, long-term maintainability, and framework flexibility.

### webextension-polyfill enables Promise-based APIs

Mozilla's webextension-polyfill library bridges Chrome's callback-based APIs with Firefox/Safari's Promise-based browser namespace. This lightweight polyfill (acts as NO-OP on Firefox) converts chrome.* APIs to Promise-supporting browser.* APIs.

```javascript
import browser from 'webextension-polyfill';

// Promise-based API across browsers
const tabs = await browser.tabs.query({active: true});
const results = await browser.storage.local.get('key');
```

WXT includes equivalent functionality through `@wxt-dev/browser`. Always use polyfills or Promise wrappers to avoid callback hell and enable modern async/await patterns.

## Cross-browser communication requires universal patterns

Extensions need robust communication between background scripts, content scripts, and web applications. Chrome supports externally_connectable for direct web-to-extension messaging, but Safari does not. Use window.postMessage for universal compatibility.

### Web app to extension communication pattern

The most reliable approach uses postMessage for web-to-content script communication, with content scripts bridging to background scripts via runtime.sendMessage.

```javascript
// Web page sends message
window.postMessage({
  direction: 'from-page',
  type: 'GET_USER_DATA',
  payload: { userId: 123 }
}, '*');

// Web page listens for response
window.addEventListener('message', (event) => {
  if (event.source === window && 
      event.data.direction === 'from-extension') {
    console.log('Extension response:', event.data);
  }
});

// Content script bridges (with origin validation)
window.addEventListener('message', async (event) => {
  // Validate origin - critical security requirement
  const allowedOrigins = ['https://example.com', 'https://app.example.com'];
  if (!allowedOrigins.includes(event.origin)) return;
  if (event.source !== window) return;
  if (event.data.direction !== 'from-page') return;
  
  // Forward to background script
  const response = await browser.runtime.sendMessage({
    type: event.data.type,
    payload: event.data.payload,
    origin: window.location.origin // Set from content script, not page
  });
  
  // Send response back to page
  window.postMessage({
    direction: 'from-extension',
    ...response
  }, event.origin);
});

// Background script processes request
browser.runtime.onMessage.addListener(async (message) => {
  if (message.origin === 'https://example.com') {
    const data = await processData(message.payload);
    return { success: true, data };
  }
});
```

**Critical security requirement:** Always validate event.origin against a whitelist. Never trust messages from arbitrary origins, as malicious sites can send postMessage to any window. Validate message structure and sanitize all data.

### Extension internal communication

Use runtime.sendMessage for one-time requests and runtime.connect for long-lived connections with continuous data streams.

```javascript
// One-time message (background to content script)
const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
const response = await chrome.tabs.sendMessage(tab.id, {
  type: 'UPDATE_UI',
  payload: { count: 42 }
});

// Content script handles messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_UI') {
    updateUI(message.payload);
    sendResponse({ success: true });
  }
  return true; // Keeps channel open for async response
});

// Long-lived connection for continuous updates
const port = chrome.runtime.connect({ name: 'data-stream' });
port.onMessage.addListener((msg) => {
  console.log('Stream update:', msg);
});
port.postMessage({ action: 'start' });
```

## Minimal friction UX starts with optional permissions

The most effective strategy for reducing installation friction uses optional permissions requested contextually when users activate features. This eliminates scary permission warnings during installation and increases conversion rates.

### Progressive permission request pattern

Declare core functionality permissions in the permissions array and non-essential permissions in optional_permissions. Request optional permissions through chrome.permissions.request when users need specific features.

```json
{
  "permissions": ["activeTab", "storage"],
  "optional_permissions": ["history"],
  "optional_host_permissions": ["https://*/*"]
}
```

```javascript
// Request permission when user activates history feature
async function enableHistoryFeature() {
  const granted = await chrome.permissions.request({
    permissions: ['history']
  });
  
  if (granted) {
    initializeHistoryFeature();
  } else {
    showExplanation('We need history access to show your recent sites');
  }
}
```

Studies show activeTab permission generates no warning messages and grants access to the current tab when users click the extension icon—sufficient for many use cases. Request broader permissions only when genuinely needed.

### Onboarding flow best practices

Effective onboarding follows a five-step maximum pattern with progressive disclosure. Research shows 80% of users skip tours exceeding five steps. Open a welcome page immediately after installation explaining core value in three sentences or less.

**Critical onboarding elements:**

1. **Pre-installation transparency**: Clearly describe history access need in store listing with accurate screenshots
2. **First launch**: Brief welcome message with single call-to-action
3. **Permission context**: Explain why each permission is needed when requested, not in bulk during installation
4. **Pin guidance**: Explicitly instruct users to pin extension to toolbar for better retention
5. **Interactive tour**: Maximum 5 steps with progress indicators and skip option

```javascript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: 'welcome.html'
    });
  }
});
```

Use tooltips and contextual hints triggered within features rather than comprehensive upfront tours. Allow users to revisit onboarding through help sections.

## Privacy-first design minimizes data collection and maximizes transparency

Chrome Web Store's Limited Use policy mandates browsing history collection **only for user-facing features prominently described in both store listing and extension UI**. This is the most critical compliance requirement—violations result in immediate rejection or removal.

### Limited Use policy requirements

**Allowed uses:**
- Showing users their browsing statistics with visible UI
- Displaying recent sites in new tab page
- Providing WHOIS information for current domain
- Site annotations visible to user

**Prohibited uses:**
- Ad targeting or monetization
- Selling data to third parties
- Background collection without user benefit
- Analytics collection for any purpose
- Credit scoring or financial determination

Every browsing history collection must directly support an interactive UI element the user actively uses. The feature must be prominently described on the Chrome Web Store page and within the extension interface. Extensions violating this policy face immediate suspension.

### Local-first processing pattern

Process browsing history locally whenever possible to minimize privacy risks and comply with data minimization principles. Use chrome.storage.local for persistence with encryption for sensitive data.

```javascript
// Process history locally, don't transmit
async function analyzeHistory() {
  const items = await chrome.history.search({
    text: '',
    startTime: Date.now() - (7 * 24 * 60 * 60 * 1000),
    maxResults: 1000
  });
  
  // Process locally - calculate domain statistics
  const stats = items.reduce((acc, item) => {
    const url = new URL(item.url);
    acc[url.hostname] = (acc[url.hostname] || 0) + 1;
    return acc;
  }, {});
  
  // Store locally, never transmit
  await chrome.storage.local.set({ stats });
}

// Respect incognito mode
function saveTabData(tab) {
  if (tab.incognito) {
    return; // Don't save incognito browsing
  }
  chrome.storage.local.set({data: tab.url});
}
```

Implement domain blacklists for sensitive sites (banking, healthcare) to avoid collecting data users wouldn't want stored. Provide visible privacy controls allowing users to view, export, and delete all collected data.

### Transparent data controls

Every extension collecting browsing history must provide an in-extension privacy dashboard showing exactly what data is collected with export and delete functionality.

```javascript
// Privacy dashboard functionality
async function exportUserData() {
  const { visitLog } = await chrome.storage.local.get('visitLog');
  const dataStr = JSON.stringify(visitLog, null, 2);
  const blob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: 'my-history-data.json',
    saveAs: true
  });
}

async function deleteAllData() {
  await chrome.storage.local.clear();
  console.log('All stored data cleared');
}
```

Display clear statistics about data collection: number of entries stored, date range, storage space used, and whether any data is transmitted. Provide one-click deletion and export in machine-readable formats (JSON, CSV).

## Security requires encryption and secure transmission

Chrome Web Store mandates HTTPS/WSS for all data transmission and strong encryption (RSA or AES) for data at rest. These are non-negotiable security requirements for extensions handling personal and sensitive user data.

### Secure data handling implementation

```javascript
// Always use HTTPS for any transmission
async function syncData(historyData) {
  const response = await fetch('https://example.com/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getToken()}`
    },
    body: JSON.stringify(historyData)
  });
  return response.json();
}

// Encrypt sensitive data before storage
async function encryptAndStore(data) {
  const encryptedData = await encryptData(data);
  await chrome.storage.local.set({ history: encryptedData });
}

// Never store credentials in extension code
// Use secure server-side authentication with token rotation
```

Implement Content Security Policy restricting script sources to prevent XSS attacks:

```json
{
  "content_security_policy": {
    "extension_pages": "default-src 'self'; connect-src https:; script-src 'self'"
  }
}
```

Never use eval() or execute remote code—Manifest V3 prohibits remotely hosted code entirely. All JavaScript must be bundled within the extension package and subject to review. Use sandboxed execution for content scripts, which run in isolated worlds without direct access to page JavaScript.

## Chrome Web Store approval requires specific disclosures

Chrome's review process includes automated scanning for malware and policy violations followed by manual review by human reviewers who test actual functionality. Extensions with history permissions typically undergo in-depth review requiring several days.

### Required privacy disclosures in Developer Dashboard

Complete the Privacy Practices tab in Chrome Web Store Developer Dashboard before submission. Failure to complete results in suspension after 30-day warning. Required elements include:

1. Data collection certification
2. All personal data types collected (browsing history must be listed)
3. Purpose of each data collection type
4. Whether data is sold or shared with third parties
5. Limited Use compliance statement

**Required statement for Google APIs:**
"The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements."

### Privacy policy requirements

Provide a comprehensive privacy policy linked in the Developer Dashboard and accessible within the extension. Minimum required content includes:

- What information is collected (including automatic collection)
- How information is used with specific examples
- All third parties receiving data and why
- Data retention and deletion policies
- How users can access, modify, and delete their data
- User rights under GDPR and CCPA if applicable

Use clear language (8th grade reading level) avoiding legal jargon. Be specific—state "We collect the last 50 sites you visited" rather than "We may collect certain browsing information." The privacy policy must exactly match actual extension behavior.

### Common rejection reasons and prevention

**Top rejection causes for history extensions:**

1. **Excessive permissions**: Requesting permissions not used in current version. Solution: Audit manifest.json quarterly, remove unused permissions, use activeTab where possible.

2. **Missing privacy policy**: No policy provided or policy doesn't describe history collection. Solution: Comprehensive, specific privacy policy matching actual behavior.

3. **Misleading metadata**: Store description doesn't mention history access or screenshots don't show actual functionality. Solution: Accurate store listing with clear permission explanations.

4. **Limited Use violation**: Collecting history without user-facing feature or using for analytics/ads. Solution: Ensure every history API call supports visible, interactive features.

5. **Remote code execution**: Loading external scripts or using eval(). Solution: Bundle all code in package, no external script loading.

Red flags triggering deeper review include requesting host permissions for all URLs (`<all_urls>`), obfuscated code without clear justification, and privacy policy inconsistencies with actual behavior.

## Safari App Store review follows stricter standards

Safari extensions undergo full App Store review examining both the containing app and the extension itself. Review typically takes 1-3 days for standard extensions but extends to a week for complex cases or privacy concerns. Apple's guidelines (Section 4.4.2) require extensions to run on current Safari versions, avoid interfering with system or Safari UI, and claim access only to strictly necessary websites.

### Safari-specific privacy requirements

Apple enforces stronger privacy controls than Chrome. All extensions must:

1. Include privacy policy in app and App Store Connect metadata
2. Disclose data collection before obtaining user consent
3. Obtain explicit consent through user action (checkbox, button)
4. Minimize data collection to only necessary information
5. Provide account deletion within app if account creation is offered
6. Use out-of-process pickers for Photos, Contacts access when possible

Safari extensions accessing websites must explain why access is needed and provide per-site permission controls. Private browsing mode disables all extensions by default—users must explicitly enable each extension for private browsing.

### Distribution and technical requirements

Package Safari extensions within native Mac/iOS apps providing value beyond hosting the extension. Apple rejects trivial wrapper apps. The extension bundle ID must contain the app bundle ID (e.g., com.app and com.app.extension). Use App Groups for shared storage between app and extension.

```swift
// Native app handler for extension messaging
override func beginRequest(with context: NSExtensionContext) {
    let item = context.inputItems[0] as! NSExtensionItem
    let message = item.userInfo?[SFExtensionMessageKey]
    
    // Process message from extension
    let response = ["status": "success"]
    
    let responseItem = NSExtensionItem()
    responseItem.userInfo = [SFExtensionMessageKey: response]
    context.completeRequest(returningItems: [responseItem])
}
```

Safari's native messaging only communicates with the containing app for security. No need to specify application IDs—connections are automatic. This enables extensions to leverage native capabilities unavailable through web APIs.

## GDPR and CCPA compliance requires specific implementations

Extensions collecting browsing history from EU users must comply with GDPR requiring legal basis (typically user consent), data subject rights (access, rectification, erasure, portability), and comprehensive privacy notices. Research of 64,114 Chrome extensions found only 8% were fully GDPR compliant, with common violations including missing privacy policies and actual collection exceeding stated collection.

### GDPR consent requirements

Consent must be freely given, specific per purpose, informed with clear language, unambiguous through explicit action, and as easy to withdraw as to give.

```javascript
// GDPR-compliant consent implementation
async function requestHistoryConsent() {
  const consentGiven = await showConsentDialog({
    title: 'Browsing History Access',
    message: `We need access to your browsing history to provide [specific feature]. 
              Your data stays on your device and is never shared with third parties. 
              Learn more in our Privacy Policy.`,
    checkboxText: 'I agree to allow [Extension Name] to access my browsing history',
    buttons: ['Agree', 'Decline']
  });
  
  if (consentGiven) {
    await chrome.storage.local.set({ 
      historyConsent: true,
      consentDate: Date.now()
    });
    enableHistoryFeatures();
  }
}

// Provide easy withdrawal mechanism
async function withdrawConsent() {
  await chrome.storage.local.set({ historyConsent: false });
  await deleteAllHistoryData();
  disableHistoryFeatures();
}
```

Article 13 requires privacy notices include data controller identity, processing purposes, legal basis, recipients of personal data, retention period, user rights and how to exercise them, right to lodge complaints with supervisory authorities, and safeguards for data transferred outside the EU.

### CCPA/CPRA compliance

California law applies when businesses have annual revenue over $25 million, process data from 100,000+ California consumers, or derive 50%+ revenue from selling consumer data. Required consumer rights include knowing what data is collected, whether data is sold/shared, opting out of sale/sharing, deleting personal information, correcting inaccurate information, and limiting use of sensitive personal information.

Implement "Do Not Sell or Share My Personal Information" and "Limit the Use of My Sensitive Personal Information" links. Respect Global Privacy Control signals:

```javascript
if (navigator.globalPrivacyControl) {
  // User has opted out of data sale/sharing
  // Legally binding under CCPA - must respect
  disableDataSharing();
}
```

Respond to data requests within 45 days (extendable to 90 days). Provide data exports in machine-readable formats (JSON, CSV) and implement secure deletion mechanisms removing all traces of user data.

## Production implementation workflow

Follow this practical workflow for developing history-accessing extensions from concept to deployment.

### Phase 1: Architecture and setup (Week 1)

```bash
# Initialize WXT project with React
npx wxt@latest init my-history-extension --template react
cd my-history-extension
pnpm install

# Project structure
mkdir -p entrypoints/background
mkdir -p entrypoints/content
mkdir -p entrypoints/popup
mkdir -p components
mkdir -p utils
```

Configure manifest through wxt.config.ts:

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'History Manager',
    description: 'Manage and analyze your browsing history',
    permissions: ['storage'],
    optional_permissions: ['history'],
    action: {
      default_popup: 'popup.html'
    }
  }
});
```

### Phase 2: Core functionality (Week 2-3)

Implement background service worker handling history API calls:

```typescript
// entrypoints/background.ts
export default defineBackground(() => {
  // Listen for history permission grant
  chrome.permissions.onAdded.addListener((permissions) => {
    if (permissions.permissions?.includes('history')) {
      initializeHistoryTracking();
    }
  });
  
  // Handle messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getHistory') {
      getRecentHistory(request.days).then(sendResponse);
      return true;
    }
  });
});

async function getRecentHistory(days = 7) {
  const hasPermission = await chrome.permissions.contains({
    permissions: ['history']
  });
  
  if (!hasPermission) {
    return { error: 'History permission not granted' };
  }
  
  const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  const results = await chrome.history.search({
    text: '',
    startTime,
    maxResults: 500
  });
  
  return { success: true, data: results };
}
```

Create popup interface with permission request:

```typescript
// entrypoints/popup/main.tsx
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

function Popup() {
  const [hasPermission, setHasPermission] = useState(false);
  const [history, setHistory] = useState([]);
  
  useEffect(() => {
    checkPermission();
  }, []);
  
  async function checkPermission() {
    const granted = await chrome.permissions.contains({
      permissions: ['history']
    });
    setHasPermission(granted);
    if (granted) loadHistory();
  }
  
  async function requestPermission() {
    const granted = await chrome.permissions.request({
      permissions: ['history']
    });
    if (granted) {
      setHasPermission(true);
      loadHistory();
    }
  }
  
  async function loadHistory() {
    const response = await chrome.runtime.sendMessage({
      action: 'getHistory',
      days: 7
    });
    if (response.success) {
      setHistory(response.data);
    }
  }
  
  if (!hasPermission) {
    return (
      <div className="permission-prompt">
        <h2>History Access Required</h2>
        <p>To show your recent browsing history, we need permission to access your browser history.</p>
        <button onClick={requestPermission}>Grant Permission</button>
      </div>
    );
  }
  
  return (
    <div className="history-list">
      <h2>Recent History</h2>
      {history.map(item => (
        <div key={item.id} className="history-item">
          <a href={item.url} target="_blank">{item.title || 'Untitled'}</a>
          <span className="domain">{new URL(item.url).hostname}</span>
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Popup />);
```

### Phase 3: Safari compatibility layer (Week 4)

Since Safari doesn't support history API, implement fallback using navigation tracking:

```typescript
// utils/history-provider.ts
interface HistoryItem {
  url: string;
  title: string;
  timestamp: number;
  domain: string;
}

class HistoryProvider {
  async getHistory(days: number): Promise<HistoryItem[]> {
    if (import.meta.env.BROWSER === 'safari') {
      return this.getSafariHistory(days);
    }
    return this.getChromeHistory(days);
  }
  
  private async getChromeHistory(days: number): Promise<HistoryItem[]> {
    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const results = await chrome.history.search({
      text: '',
      startTime,
      maxResults: 500
    });
    
    return results.map(item => ({
      url: item.url!,
      title: item.title || '',
      timestamp: item.lastVisitTime!,
      domain: new URL(item.url!).hostname
    }));
  }
  
  private async getSafariHistory(days: number): Promise<HistoryItem[]> {
    // Safari workaround: use manually tracked history
    const { visitLog = [] } = await browser.storage.local.get('visitLog');
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return visitLog.filter(item => item.timestamp > cutoff);
  }
}

export const historyProvider = new HistoryProvider();
```

Implement navigation tracking for Safari:

```typescript
// entrypoints/background.ts (Safari-specific code)
if (import.meta.env.BROWSER === 'safari') {
  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && !tab.incognito) {
      const { visitLog = [] } = await browser.storage.local.get('visitLog');
      
      visitLog.push({
        url: changeInfo.url,
        title: tab.title || '',
        timestamp: Date.now(),
        domain: new URL(changeInfo.url).hostname
      });
      
      // Maintain size limit
      if (visitLog.length > 1000) {
        visitLog.shift();
      }
      
      await browser.storage.local.set({ visitLog });
    }
  });
}
```

### Phase 4: Privacy controls and compliance (Week 5)

Implement comprehensive privacy dashboard:

```typescript
// entrypoints/options/privacy.tsx
function PrivacyDashboard() {
  const [stats, setStats] = useState({ count: 0, size: 0 });
  
  useEffect(() => {
    loadStats();
  }, []);
  
  async function loadStats() {
    const data = await chrome.storage.local.get(null);
    const count = data.visitLog?.length || 0;
    const size = JSON.stringify(data).length;
    setStats({ count, size });
  }
  
  async function exportData() {
    const data = await chrome.storage.local.get('visitLog');
    const blob = new Blob([JSON.stringify(data.visitLog, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-history-data.json';
    a.click();
  }
  
  async function deleteAllData() {
    if (confirm('Delete all stored history data? This cannot be undone.')) {
      await chrome.storage.local.clear();
      setStats({ count: 0, size: 0 });
    }
  }
  
  return (
    <div className="privacy-dashboard">
      <h2>Your Privacy</h2>
      
      <section>
        <h3>Data Collection Status</h3>
        <p>Entries stored: {stats.count}</p>
        <p>Storage used: {(stats.size / 1024).toFixed(2)} KB</p>
        <p>Storage location: Local only (not transmitted)</p>
      </section>
      
      <section>
        <h3>Your Data Controls</h3>
        <button onClick={exportData}>Export My Data</button>
        <button onClick={deleteAllData} className="danger">Delete All Data</button>
      </section>
      
      <section>
        <h3>Privacy Policy</h3>
        <p>Read our <a href="https://example.com/privacy">privacy policy</a> 
           for complete details on data handling.</p>
      </section>
    </div>
  );
}
```

### Phase 5: Testing and submission (Week 6)

Test across browser versions and platforms:

```bash
# Test Chrome
pnpm dev --browser=chrome

# Build for production
pnpm build --browser=chrome

# Test Safari
pnpm build --browser=safari
xcrun safari-web-extension-converter \
  --bundle-identifier com.company.historyext \
  .output/safari-mv3

# Open in Xcode and test
```

Complete Chrome Web Store submission checklist:
- ✓ Accurate store description mentioning history access
- ✓ Screenshots showing actual history features
- ✓ Privacy policy linked in Developer Dashboard
- ✓ Privacy Practices tab completed with Limited Use statement
- ✓ Detailed review notes explaining history usage
- ✓ All permissions justified in store listing
- ✓ Optional permissions used where appropriate

Complete Safari App Store submission checklist:
- ✓ Container app provides value beyond wrapper
- ✓ Privacy policy in app and App Store Connect
- ✓ App Group configured for shared storage
- ✓ Safari-specific limitations documented
- ✓ TestFlight beta testing completed
- ✓ All App Store Review Guidelines followed

## Open-source references and learning resources

Study production extensions for implementation patterns and architecture decisions. **Falcon** (github.com/lengstrom/falcon) demonstrates full-text search of browsing history with custom indexing, omnibox integration, and local-only processing. **History by Date** (github.com/richgong/history-by-date) shows React + MobX architecture with session tracking, domain statistics, and Bootstrap UI. **Quick History Viewer** (github.com/WayneLai0127/quick-history-viewer) provides minimal vanilla JavaScript implementation with keyboard shortcuts.

Use **GoogleChrome/chrome-extensions-samples** as the definitive reference for Chrome APIs with official, maintained examples. The Jonghakseo/chrome-extension-boilerplate-react-vite repository provides the most modern React + Vite starter template with excellent HMR and TypeScript support. For minimal projects, SimGus/chrome-extension-v3-starter offers clean Manifest V3 foundation without framework dependencies.

Essential npm packages include **extension** (v2.1.3) for cross-browser development with zero configuration, **webextension-polyfill** for Promise-based API compatibility, **crx** for Chrome extension packaging via Node API, and **@webext-core/messaging** for type-safe messaging when using WXT.

Study Chrome's official documentation at developer.chrome.com/docs/extensions/reference/api/history for complete API reference. Review Mozilla's Extension Workshop at extensionworkshop.com for UX best practices applicable across browsers. Follow Apple's Safari Extensions documentation at developer.apple.com/safari/extensions for Safari-specific requirements and conversion tools.

## Final recommendations for robust implementation

Build extensions with privacy as the foundation, not an afterthought. Use optional permissions requested contextually to maximize installation conversion. Process data locally whenever possible, transmit only when absolutely necessary using HTTPS with encryption. Provide comprehensive privacy controls allowing users to view, export, and delete all collected data at any time.

For Chrome development, leverage Manifest V3's service worker architecture with proper lifecycle management using storage APIs for persistence and alarms for periodic tasks. Implement comprehensive error handling for history API calls and gracefully degrade when permissions are denied. For Safari, accept that full history access is unavailable and design features around navigation tracking for current sessions.

Choose WXT Framework for new projects requiring optimal performance, modern developer experience, and framework flexibility. Use webextension-polyfill or WXT's browser wrapper for Promise-based APIs across platforms. Implement window.postMessage patterns for web app communication to ensure Safari compatibility without relying on Chrome-only externally_connectable.

Test thoroughly on both Chrome and Safari, understanding that Safari limitations may require reduced feature sets or alternative approaches. Complete all required privacy disclosures before submission—missing privacy policies or Limited Use violations are the top rejection reasons. Respond promptly to user reviews and maintain regular updates demonstrating active development, which increases trust and store visibility.

The fundamental constraint remains Safari's lack of history API support. Extensions requiring comprehensive browsing history cannot achieve feature parity on Safari. Evaluate whether reduced Safari functionality is acceptable or whether Chrome-only development better serves user needs. For extensions where history access is critical, focus on Chrome/Firefox/Edge platforms and file feedback with Apple requesting history API support for future Safari versions.