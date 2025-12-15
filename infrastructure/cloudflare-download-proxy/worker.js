/**
 * OwnYou Download Proxy - Cloudflare Worker
 *
 * Purpose: Proxy GitHub release downloads with correct Content-Disposition header
 * This solves the browser filename issue where cross-origin downloads get UUID filenames.
 *
 * Usage: https://your-worker.workers.dev/download/FILENAME?url=<github-url>
 * Example: https://your-worker.workers.dev/download/OwnYou_0.1.0_aarch64.dmg?url=https://github.com/...
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Extract filename from URL path: /download/FILENAME
    const pathMatch = url.pathname.match(/^\/download\/(.+)$/);
    const filename = pathMatch ? decodeURIComponent(pathMatch[1]) : url.searchParams.get('filename');
    const targetUrl = url.searchParams.get('url');

    // Validate parameters
    if (!targetUrl) {
      return new Response('Missing "url" parameter', { status: 400 });
    }

    if (!filename) {
      return new Response('Missing "filename" parameter', { status: 400 });
    }

    // Security: Only allow GitHub URLs
    const allowedDomains = [
      'github.com',
      'objects.githubusercontent.com',
      'github-releases.githubusercontent.com'
    ];

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    const isAllowed = allowedDomains.some(domain =>
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return new Response('URL domain not allowed. Only GitHub URLs are permitted.', { status: 403 });
    }

    try {
      // Fetch from GitHub (follows redirects automatically)
      const response = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'OwnYou-Download-Proxy/1.0'
        }
      });

      if (!response.ok) {
        return new Response(`Upstream error: ${response.status}`, { status: response.status });
      }

      // Return with correct Content-Disposition header
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Length': response.headers.get('Content-Length') || '',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      });
    } catch (error) {
      return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
  }
};
