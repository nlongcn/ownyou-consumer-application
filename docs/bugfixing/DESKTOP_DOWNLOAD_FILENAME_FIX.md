# Desktop App Download Filename Fix

**Date:** 2025-12-12
**Status:** RESOLVED
**Component:** Consumer PWA - Settings > Data > Outlook Connect Dialog

---

## Problem Statement

When users clicked "Download Desktop App" in the Outlook Connect dialog, Chrome downloaded the DMG file with a **UUID filename** (e.g., `6ea3ead3-1389-44c3-8306-e3cd9126f676`) instead of the correct filename `OwnYou_0.1.0_aarch64.dmg`.

This created a poor user experience as users had to manually rename the downloaded file.

---

## Root Cause Analysis

### The Fundamental Issue

**Chrome ignores filename suggestions for cross-origin downloads.**

When downloading from a different origin (GitHub releases → localhost:3000), Chrome's security model prevents client-side code from controlling the download filename, regardless of:

1. The `download` attribute on anchor tags
2. `Content-Disposition` headers from the server
3. Blob URLs created from fetched content

### Technical Details

The download flow involves:
```
User's Browser (localhost:3000)
    ↓ clicks download
GitHub Releases (github.com)
    ↓ 302 redirect
GitHub CDN (objects.githubusercontent.com)
    ↓ file content
User's Downloads folder
```

Chrome generates a UUID filename because:
- Cross-origin downloads ignore the `download` attribute (security feature)
- GitHub's CDN doesn't set `Content-Disposition` headers
- Even with a proxy setting the header, Chrome's download manager generates UUIDs for navigations to cross-origin resources

---

## Failed Approaches

### Attempt 1: Direct Anchor Tag with `download` Attribute

```typescript
<a
  href="https://github.com/.../OwnYou_0.1.0_aarch64.dmg"
  download="OwnYou_0.1.0_aarch64.dmg"
>
```

**Result:** UUID filename
**Why it failed:** The `download` attribute is ignored for cross-origin URLs per the HTML spec.

### Attempt 2: Cloudflare Worker Proxy with `window.location.href`

Created a Cloudflare Worker that:
1. Fetches from GitHub (following redirects)
2. Returns with `Content-Disposition: attachment; filename="OwnYou_0.1.0_aarch64.dmg"`

```typescript
function downloadDesktopApp(url: string, filename: string): void {
  const proxyUrl = `https://ownyou-download-proxy.nlongcroft.workers.dev/...`;
  window.location.href = proxyUrl;
}
```

**Result:** UUID filename
**Why it failed:** Chrome's download manager still treats the navigation as cross-origin and generates a UUID.

**Verification:** The Worker correctly returns the header (verified via curl):
```bash
$ curl -I "https://ownyou-download-proxy.nlongcroft.workers.dev/..."
content-disposition: attachment; filename="OwnYou_0.1.0_aarch64.dmg"
```

### Attempt 3: Anchor Element Click Instead of Location Change

```typescript
function downloadDesktopApp(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = proxyUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

**Result:** UUID filename
**Why it failed:** Same cross-origin restriction applies regardless of how the navigation is triggered.

### Attempt 4: Async Blob Download with Object URL

```typescript
async function downloadDesktopApp(url: string, filename: string) {
  const response = await fetch(proxyUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;  // blob:http://localhost:3000/...
  link.download = filename;
  link.click();
}
```

**Result:** UUID filename
**Why it failed:** Chrome's "user activation" expires after ~5 seconds and doesn't propagate through `async/await`. By the time the 6MB file downloads, the user gesture context is lost, and Chrome ignores the `download` attribute.

**Reference:** [Chrome User Activation Blog](https://developer.chrome.com/blog/user-activation)

### Attempt 5: Two-Step Download (Prepare, Then Click)

```typescript
// Step 1: Fetch and prepare blob
const blob = await response.blob();
const objectUrl = URL.createObjectURL(blob);
preparedDownload = { blob, filename, objectUrl };
setDownloadState('ready');

// Step 2: User clicks again with fresh gesture
function triggerPreparedDownload() {
  const link = document.createElement('a');
  link.href = preparedDownload.objectUrl;
  link.download = preparedDownload.filename;
  link.click();
}
```

**Result:** UUID filename
**Why it failed:** Chrome bug #892133 - blob URLs derived from cross-origin content still get UUID filenames. Chrome tracks the "origin" of data even after blob transformation.

---

## Solution: File System Access API

The **File System Access API** (`showSaveFilePicker`) provides a native "Save As" dialog where the user controls the filename.

### Implementation

```typescript
async function downloadDesktopApp(url: string, filename: string): Promise<void> {
  const proxyUrl = `https://ownyou-download-proxy.nlongcroft.workers.dev/download/${encodeURIComponent(filename)}?url=${encodeURIComponent(url)}`;

  // Check if File System Access API is available
  if ('showSaveFilePicker' in window) {
    try {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const mimeTypes: Record<string, string> = {
        'dmg': 'application/x-apple-diskimage',
        'exe': 'application/x-msdownload',
        'msi': 'application/x-msi',
      };

      // Show native "Save As" dialog with suggested filename
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Desktop Application',
          accept: { [mimeTypes[ext] || 'application/octet-stream']: [`.${ext}`] },
        }],
      });

      // Fetch the file
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const blob = await response.blob();

      // Write to user-selected file
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      alert('Download complete! File saved successfully.');
      return;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // User cancelled
      }
      // Fall through to fallback
    }
  }

  // Fallback for browsers without File System Access API
  const proceed = confirm(
    `Note: Due to browser limitations, the downloaded file may have a random name.\n\n` +
    `After downloading, please rename it to:\n${filename}\n\n` +
    `Click OK to proceed with download.`
  );

  if (proceed) {
    window.location.href = proxyUrl;
  }
}
```

### Why This Works

1. **Native OS Dialog:** `showSaveFilePicker` shows the operating system's native file picker
2. **User-Controlled Filename:** The `suggestedName` parameter pre-fills the correct filename
3. **User Confirms:** User sees and approves the filename before saving
4. **Direct File Write:** The blob is written directly to the user-chosen location
5. **No Cross-Origin Restrictions:** Since the user explicitly chose the file location, Chrome allows the write

### Browser Support

- **Chrome 86+:** Full support
- **Edge 86+:** Full support
- **Safari:** Not supported (falls back to confirm dialog)
- **Firefox:** Not supported (falls back to confirm dialog)

For unsupported browsers, the fallback provides clear instructions to rename the file.

---

## Files Modified

| File | Change |
|------|--------|
| `apps/consumer/src/routes/Settings.tsx` | Replaced download function with File System Access API implementation |

---

## Infrastructure

The Cloudflare Worker proxy remains in place at `https://ownyou-download-proxy.nlongcroft.workers.dev` for:
1. Following GitHub's redirect chain server-side
2. Adding CORS headers for fetch requests
3. Setting Content-Disposition header (helpful for browsers that do respect it)

**Worker location:** `infrastructure/cloudflare-download-proxy/worker.js`

---

## Testing

### Manual Test Steps

1. Open http://localhost:3000/settings?tab=data in Chrome
2. Click "Connect" on Outlook
3. Click "Download Desktop App"
4. Verify native "Save As" dialog appears with filename `OwnYou_0.1.0_aarch64.dmg`
5. Click Save
6. Verify file downloads with correct filename

### Playwright Note

Playwright automatically dismisses `showSaveFilePicker` dialogs, logging "User cancelled save dialog". This is expected behavior - Playwright intercepts downloads differently than real browsers.

---

## Lessons Learned

1. **Cross-origin download restrictions are fundamental to browser security** - no amount of clever JavaScript can bypass them
2. **Playwright tests can pass while real browser tests fail** - Playwright intercepts downloads at the network level, bypassing browser download manager behavior
3. **User activation has strict rules** - it doesn't propagate through async operations
4. **The File System Access API is the correct solution** for giving users control over downloaded filenames
5. **Always have a fallback** - graceful degradation with clear instructions is better than a broken experience

---

## References

- [Chrome User Activation](https://developer.chrome.com/blog/user-activation)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Chromium Bug #892133](https://bugs.chromium.org/p/chromium/issues/detail?id=892133) - Blob URL filename issues
- [Cross-Origin Download Restrictions](https://macarthur.me/posts/trigger-cross-origin-download/)
- [WHATWG HTML Issue #2562](https://github.com/whatwg/html/issues/2562) - Confusion on cross-origin download attribute
