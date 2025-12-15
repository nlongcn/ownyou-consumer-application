# TriggerEngine Auto-Start Test Procedure

## Objective
Verify that TriggerEngine automatically starts after wallet authentication and all components initialize correctly.

## Prerequisites
- Dev server running at http://localhost:3002
- Browser with DevTools (Chrome/Firefox recommended)

## Test Steps

### 1. Open Browser DevTools
1. Navigate to http://localhost:3002
2. Open DevTools (F12 or Cmd+Option+I on Mac)
3. Go to the **Console** tab
4. Clear existing logs

### 2. Authenticate
1. Click "Get Started" button to create/load wallet
2. Complete wallet creation/authentication flow
3. Wait for home screen to load

### 3. Monitor Console Output

#### Expected Console Messages (in order):

**After Authentication:**
```
[TriggerContext] TriggerEngine initialized
[TriggerEngine] Started
  - Watching namespaces: ownyou.iab, ownyou.feedback
  - Active schedules: 2
[StoreWatcher] Started watching: ['ownyou.iab', 'ownyou.feedback']
[CronScheduler] Started with 2 schedules
[TriggerContext] TriggerEngine auto-started - watching for new classifications
```

#### Component Checklist:
- [ ] `[TriggerContext] TriggerEngine initialized` - Context created engine
- [ ] `[TriggerEngine] Started` - Engine started successfully
- [ ] `[StoreWatcher] Started watching` - Data-driven triggers active
- [ ] `[CronScheduler] Started` - Scheduled triggers active
- [ ] Auto-start message appears

### 4. Verify Configuration

#### Expected Namespaces Being Watched:
- `ownyou.iab` - IAB classifications (trigger shopping/restaurant/travel agents)
- `ownyou.feedback` - Mission feedback (trigger reflection)

#### Expected Schedules:
- `daily_digest` - 9 AM daily (cron: `0 9 * * *`)
- `weekly_summary` - 10 AM Sunday (cron: `0 10 * * 0`)

### 5. Check for Errors

**No errors should appear related to:**
- TriggerEngine initialization
- StoreWatcher setup
- CronScheduler setup
- Agent factory creation

**Common Issues to Watch For:**
- "Agent type X not enabled" - Normal for unbuilt agents
- "TriggerEngine Already running" - Indicates double-start (BUG)
- Any TypeScript/runtime errors in TriggerContext

### 6. Verify TriggerEngine State

Run in Console:
```javascript
// Check if TriggerEngine is accessible
window.__OWNYOU_DEBUG__ = true;

// This should be available if properly initialized
// (Note: May not be exposed to window - check React DevTools instead)
```

**Alternative: Use React DevTools**
1. Install React DevTools extension
2. Find `TriggerProvider` component
3. Check hooks state:
   - `isRunning` should be `true`
   - `isExecuting` should be `false`
   - `recentMissions` should be `[]` (empty initially)

## Expected Results

### Success Criteria:
✅ All 4 initialization messages appear in console
✅ Namespaces include `ownyou.iab` and `ownyou.feedback`
✅ 2 schedules are active
✅ No errors in console related to TriggerEngine
✅ Auto-start message confirms automatic initialization
✅ React DevTools shows `isRunning: true`

### Failure Indicators:
❌ Missing initialization messages
❌ "Already running" warning (double initialization)
❌ TypeScript errors related to TriggerEngine
❌ React DevTools shows `isRunning: false`
❌ No namespaces or schedules active

## Test Report Template

```
Date: ___________
Tester: ___________
Browser: ___________

RESULTS:
[ ] TriggerEngine Started
[ ] StoreWatcher Started
[ ] CronScheduler Started
[ ] Auto-start confirmed

CONFIGURATION:
Namespaces: ___________
Schedules: ___________

ERRORS:
(List any errors)

OVERALL STATUS: PASS / FAIL

Notes:
___________
```

## Automated Testing Alternative

For automated testing, use the Playwright script:

```bash
cd apps/consumer
node test-trigger-engine-browser.mjs
```

## Troubleshooting

### TriggerEngine doesn't start
- Check if `isAuthenticated` is true
- Verify `StoreProvider` is initialized
- Check browser console for React errors

### Missing console messages
- Ensure console logging isn't filtered
- Check that dev build includes console.log (not stripped)
- Verify TriggerContext is in provider chain

### Double initialization
- Check if TriggerProvider is wrapped twice in App
- Verify React StrictMode isn't causing issues (expected in dev)
- Look for duplicate context imports

## Related Files

- **TriggerContext**: `/apps/consumer/src/contexts/TriggerContext.tsx`
- **TriggerEngine**: `/packages/triggers/src/engine/trigger-engine.ts`
- **StoreWatcher**: `/packages/triggers/src/data-driven/store-watcher.ts`
- **CronScheduler**: `/packages/triggers/src/scheduled/cron-scheduler.ts`
