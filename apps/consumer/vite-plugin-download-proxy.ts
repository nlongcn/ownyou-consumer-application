import { Plugin } from 'vite';
import https from 'https';
import { IncomingMessage, ServerResponse } from 'http';

export function downloadProxyPlugin(): Plugin {
  return {
    name: 'download-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy-download', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        // Parse URL from query string
        const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
        const targetUrl = urlObj.searchParams.get('url');

        if (!targetUrl) {
          res.statusCode = 400;
          res.end('Missing url parameter');
          return;
        }

        console.log(`[Proxy] Proxying download for: ${targetUrl}`);

        const fetchUrl = (url: string) => {
          https.get(url, (proxyRes) => {
            // Handle redirects
            if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
              console.log(`[Proxy] Following redirect to: ${proxyRes.headers.location}`);
              fetchUrl(proxyRes.headers.location);
              return;
            }

            // Forward headers
            res.statusCode = proxyRes.statusCode || 200;
            if (proxyRes.headers['content-type']) {
              res.setHeader('Content-Type', proxyRes.headers['content-type']);
            }
            if (proxyRes.headers['content-length']) {
              res.setHeader('Content-Length', proxyRes.headers['content-length']);
            }
            // Force Content-Disposition if present, or create one
            if (proxyRes.headers['content-disposition']) {
              res.setHeader('Content-Disposition', proxyRes.headers['content-disposition']);
            } else {
                // Fallback if upstream doesn't send it (unlikely for GitHub releases)
                const filename = url.split('/').pop()?.split('?')[0] || 'download.bin';
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            }

            // Pipe data
            proxyRes.pipe(res);
          }).on('error', (err) => {
            console.error('[Proxy] Download error:', err);
            if (!res.headersSent) {
                res.statusCode = 500;
                res.end('Download failed');
            }
          });
        };

        fetchUrl(targetUrl);
      });
    },
  };
}
