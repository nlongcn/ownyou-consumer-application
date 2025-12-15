# OwnYou Download Proxy

Cloudflare Worker that proxies GitHub release downloads with correct `Content-Disposition` header.

## Why This Exists

Browsers give UUID filenames to cross-origin downloads because:
1. GitHub releases redirect through a CDN
2. The CDN doesn't set proper `Content-Disposition` headers
3. Chrome's user activation expires during async blob downloads

This worker solves it by:
1. Fetching from GitHub server-side (follows redirects)
2. Setting `Content-Disposition: attachment; filename="..."` header
3. Returning the file with correct filename

## Deployment

### Prerequisites
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Steps

```bash
# Install Wrangler if not installed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
cd infrastructure/cloudflare-download-proxy
wrangler deploy
```

### Output
After deployment, you'll get a URL like:
```
https://ownyou-download-proxy.<your-subdomain>.workers.dev
```

## Usage

```
GET https://ownyou-download-proxy.xxx.workers.dev/?url=<github-url>&filename=<desired-filename>
```

### Example
```
https://ownyou-download-proxy.xxx.workers.dev/?url=https://github.com/nlongcn/ownyou-consumer-application/releases/download/v0.1.0/OwnYou_0.1.0_aarch64.dmg&filename=OwnYou_0.1.0_aarch64.dmg
```

## Security

- Only allows GitHub URLs (github.com, objects.githubusercontent.com)
- No authentication required (public downloads only)
- Rate limited by Cloudflare (100k requests/day on free tier)

## Client Integration

```typescript
function downloadDesktopApp(url: string, filename: string): void {
  const proxyUrl = `https://ownyou-download-proxy.xxx.workers.dev/?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
  window.location.href = proxyUrl;
}
```
