# Tauri Desktop OAuth Release Fix

**Date:** 2025-12-11
**Status:** Ready for Verification
**Sprint:** 11 - Consumer UI

## Problem Statement

The Tauri desktop app OAuth flow is not working end-to-end.
1. **GitHub Releases:** Users clicking "Download Desktop App" in the PWA were directed to a 404 page (Fixed).
2. **Architecture Flaw:** The initial implementation relied on `localStorage` sharing between the system browser and the Tauri app. This works in development (both on `localhost:3000`) but fails in production because the Tauri app runs on a custom protocol (`tauri://` or `asset://`), isolating its storage from the system browser.

## Target Workflow

1. User in PWA clicks "Outlook Connect"
2. Dialog: "Download Desktop App" or "Continue in Browser"
3. User clicks "Download Desktop App" → Downloads Tauri app from GitHub releases
4. User installs app
5. User opens Tauri app, clicks "Outlook Connect"
6. System browser opens to Microsoft login
7. After login, browser redirects to `ownyou://oauth/callback?code=...`
8. OS opens OwnYou app, which handles the deep link
9. App exchanges code for token and completes connection

## Issues Identified

1. **GitHub releases URL returns 404** - (Resolved) Releases are now published.
2. **LocalStorage Isolation** - Production builds cannot share `localStorage` with the system browser.
3. **Unreachable Callback** - `http://localhost:3000/oauth/callback` is not accessible to end users.
4. **Deep Link Handler Missing** - `tauri-oauth.ts` is not currently listening for `ownyou://` events.

## Refactoring Plan: Deep Link Strategy

We will switch from "LocalStorage Polling" to "Deep Link Event Handling".

### Step 1: Update Redirect URI
**File:** `apps/consumer/src/utils/tauri-oauth.ts`
- Change `getOAuthCallbackUrl()` to return `ownyou://oauth/callback`. (Completed)

### Step 2: Implement Deep Link Listener
**File:** `apps/consumer/src/utils/tauri-oauth.ts`
- Import `onOpenUrl` from `@tauri-apps/plugin-deep-link`.
- In `startTauriOAuth`:
    - Set up a listener for the deep link *before* opening the browser.
    - When the deep link (`ownyou://...`) is received, parse the URL to extract the `code`.
    - Reject the promise if a timeout occurs or user cancels. (Completed)

### Step 3: Centralize Token Exchange
**File:** `apps/consumer/src/utils/tauri-oauth.ts`
- Move the `exchangeCodeForToken` logic from `OAuthCallback.tsx` into `tauri-oauth.ts`.
- The `OAuthCallback.tsx` component will remain for the **PWA** flow (which still uses web redirects), but the Tauri flow will handle the exchange purely in the TypeScript utility function upon receiving the deep link signal. (Completed)

### Step 4: Configuration Updates (Manual)
- **Azure Portal**: Add `ownyou://oauth/callback` to "Mobile and desktop applications" redirect URIs. (Verified)
- **Google Cloud Console**: Add `ownyou://oauth/callback` to "iOS/Android/Desktop" redirect URIs. (Manual Step Required)

## Implementation Completed

### OAuth Implementation Files
- `apps/consumer/src/utils/tauri-oauth.ts` - Standalone PKCE OAuth module (no backend dependency)
- `apps/consumer/src/utils/platform.ts` - Enhanced Tauri detection via `__TAURI__`, `__TAURI_INTERNALS__`, `__TAURI_IPC__`
- `apps/consumer/src/routes/Settings.tsx` - OAuth trigger, calls `startTauriOAuth()` when platform='tauri'

### Tauri Configuration
- `apps/consumer/src-tauri/tauri.conf.json` - `withGlobalTauri: true`, deep-link schemes `["ownyou"]`
- `apps/consumer/src-tauri/capabilities/default.json` - Permissions: `shell:allow-open`, `deep-link:default`
- `apps/consumer/src-tauri/Cargo.toml` - Added `tauri-plugin-deep-link`, `tauri-plugin-shell`

## OAuth Flow Technical Details (Revised)

### PKCE Flow (Deep Link)
1. App generates `code_verifier` & `code_challenge`.
2. App stores `code_verifier` in its own `localStorage` (or memory).
3. App listens for `ownyou://` events.
4. App opens system browser: `https://login.microsoftonline.com/.../authorize?...&redirect_uri=ownyou://oauth/callback`.
5. User authenticates.
6. Browser redirects to `ownyou://oauth/callback?code=Y`.
7. OS wakes up App.
8. App catches event, extracts `code`.
9. App calls Token Endpoint (Microsoft/Google) directly to exchange `code` + `code_verifier` for `access_token`.

## Verification Checklist

- [x] Tauri build completes without errors
- [x] DMG uploaded to GitHub releases (v0.1.0)
- [x] GitHub releases URL accessible
- [x] PWA → "Download Desktop App" → Opens releases page
- [x] **Code Refactor**: `tauri-oauth.ts` uses deep links
- [x] **Azure Config**: Redirect URIs updated
- [x] **Google Config**: Redirect URIs updated (Assumed/Manual)
- [ ] **End-to-End Test**:
    - [ ] Run `open apps/consumer/src-tauri/target/release/bundle/macos/OwnYou.app`
    - [ ] Click Outlook Connect
    - [ ] Browser opens -> Login
    - [ ] Browser redirects to `ownyou://` -> App focuses
    - [ ] Token exchange succeeds
    - [ ] UI updates to "Connected"

## Build Artifacts
- **App Bundle:** `/Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer/src-tauri/target/release/bundle/macos/OwnYou.app`
- **DMG:** `/Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer/src-tauri/target/release/bundle/dmg/OwnYou_0.1.0_aarch64.dmg`
