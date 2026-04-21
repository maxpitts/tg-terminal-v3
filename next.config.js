/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["ws"],
    optimizePackageImports: ["lightweight-charts"],
  },
  webpack: (config, { dev, isServer }) => {
    config.externals.push({
      bufferutil: "bufferutil",
      "utf-8-validate": "utf-8-validate",
    });
    // Production: minimize bundle
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            lightweightCharts: {
              test: /[\\/]node_modules[\\/]lightweight-charts[\\/]/,
              name: "lightweight-charts",
              chunks: "all",
              priority: 30,
            },
            commons: {
              name: "commons",
              chunks: "all",
              minChunks: 2,
              priority: 10,
            },
          },
        },
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Cache static assets aggressively
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // Cache API responses for scanner (5min) and candles (1min)
        source: "/api/scanner",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=300, stale-while-revalidate=60" }],
      },
      {
        source: "/api/polygon/candles",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=30" }],
      },
    ];
  },
};

module.exports = nextConfig;
