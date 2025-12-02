const withPWA = require('next-pwa')({
  dest: 'public',
  disable: false,  // Enable PWA in development for testing
  register: true,
  skipWaiting: true,
  // CRITICAL FIX: Exclude /api routes from Service Worker caching
  // API routes must always hit the server, never return stale cached responses
  runtimeCaching: [
    {
      // Match all requests EXCEPT /api/* routes
      urlPattern: /^(?!.*\/api\/).*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      // API routes: NEVER cache, always fetch from network
      urlPattern: /\/api\/.*/,
      handler: 'NetworkOnly',
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable App Router
  experimental: {
    serverActions: {
      enabled: true,
    },
  },

  // ESLint: Don't fail build on warnings (console.log, etc)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Webpack configuration for IndexedDB and browser APIs
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve Node.js built-ins on the client to prevent errors
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        'async_hooks': false,
        'node:async_hooks': false,
      };

      // Add alias to replace node: protocol imports with empty modules
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:async_hooks': false,
      };
    } else {
      // Server-side: externalize packages that use Node.js built-ins
      config.externals = config.externals || [];
      config.externals.push({
        '@langchain/langgraph': '@langchain/langgraph',
        '@langchain/core': '@langchain/core',
      });
    }

    return config;
  },

  // Allow imports from parent directory (shared browser code)
  transpilePackages: [],

  // Environment variables
  env: {
    NEXT_PUBLIC_ADMIN_DASHBOARD: 'true',
  },
};

module.exports = withPWA(nextConfig);
