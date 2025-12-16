---
name: tauri-build-discipline
description: Enforce Tauri build workflow for desktop app development. Use BEFORE testing OAuth, deep links, or after making any code changes to apps/consumer/. Prevents testing against stale installed app versions.
---

# Tauri Build Discipline

## When This Skill Applies

Use this skill when:
- Making ANY changes to `apps/consumer/`
- Testing OAuth authentication flow
- Testing deep link callbacks (`ownyou://` URLs)
- Debugging "OAuth works but nothing happens" issues
- Before claiming OAuth/deep link features are working

## The Critical Rule

**After making ANY code changes to `apps/consumer/`, you MUST run:**

```bash
cd apps/consumer
pnpm tauri:build
```

This builds the app AND deploys it to `/Applications/OwnYou.app`.

## Why This Matters

### How macOS Deep Links Work

1. User clicks OAuth login in app
2. Browser opens, user authenticates
3. OAuth provider redirects to Cloudflare Worker
4. Worker exchanges code for tokens
5. Worker redirects to `ownyou://oauth/callback?access_token=...`
6. **macOS Launch Services routes `ownyou://` to INSTALLED app**
7. App receives deep link callback

**The key insight:** Step 6 routes to `/Applications/OwnYou.app`, NOT to the dev server.

### Common Failure Mode

1. Developer makes code changes
2. Developer runs `pnpm tauri:dev` for hot reload
3. Developer tests OAuth
4. OAuth appears to work (browser auth succeeds)
5. **Nothing happens** - deep link goes to OLD installed version
6. Developer thinks code is broken (it's not - wrong version is running)

## Commands

| Command | What It Does | When to Use |
|---------|--------------|-------------|
| `pnpm tauri:dev` | Hot reload dev server | UI-only changes, no OAuth testing |
| `pnpm tauri:build` | Build + deploy to /Applications | ANY code changes before OAuth testing |

## Mandatory Workflow

### Before Testing OAuth/Deep Links

```bash
# 1. Make sure you're in the right directory
cd apps/consumer

# 2. Build and deploy (takes ~60 seconds)
pnpm tauri:build

# 3. Launch the installed app
open /Applications/OwnYou.app

# 4. Now test OAuth flow
```

### After ANY Code Changes

If you modified any file in `apps/consumer/` and need to test:

1. Stop any running dev server
2. Run `pnpm tauri:build`
3. Wait for "Deployed to /Applications/OwnYou.app" message
4. Test with the installed app

## Checklist for OAuth Testing

- [ ] Code changes complete
- [ ] `pnpm tauri:build` run successfully
- [ ] See "Deployed to /Applications/OwnYou.app" message
- [ ] Testing with installed app (not dev server)
- [ ] Browser opens for OAuth
- [ ] Token exchange completes (Cloudflare Worker)
- [ ] Deep link callback received by app
- [ ] App processes callback correctly

## Anti-Patterns

**WRONG:**
```bash
pnpm tauri:dev
# Test OAuth... nothing happens after browser auth
# "OAuth must be broken!"
```

**RIGHT:**
```bash
pnpm tauri:build
# Test OAuth... callback received, sync starts
# "OAuth working correctly"
```

## Related Files

- `apps/consumer/src/utils/tauri-oauth.ts` - OAuth flow implementation
- `apps/consumer/src/contexts/DataSourceContext.tsx` - Data source connection
- `infrastructure/cloudflare-oauth-callback/worker.js` - Token exchange
- `apps/consumer/src-tauri/tauri.conf.json` - Deep link registration
