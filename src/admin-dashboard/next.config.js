/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable App Router
  experimental: {
    serverActions: {
      enabled: true,
    },
  },

  // Webpack configuration for IndexedDB and browser APIs
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs' module on the client to prevent errors
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        'async_hooks': false,
      };
    } else {
      // Server-side: externalize packages that use Node.js built-ins
      config.externals = config.externals || [];
      config.externals.push({
        '@langchain/langgraph': '@langchain/langgraph',
        '@langchain/core': '@langchain/core',
      });
    }

    // Handle node: protocol imports
    config.resolve.alias = {
      ...config.resolve.alias,
    };

    return config;
  },

  // Allow imports from parent directory (shared browser code)
  transpilePackages: [],

  // Environment variables
  env: {
    NEXT_PUBLIC_ADMIN_DASHBOARD: 'true',
  },
};

module.exports = nextConfig;
