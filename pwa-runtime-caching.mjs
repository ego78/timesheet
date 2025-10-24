// pwa-runtime-caching.mjs
export default [
  // Static Next.js assets
  { urlPattern: /^https:\/\/_next\//, handler: "StaleWhileRevalidate", options: { cacheName: "next-static" } },
  // API requests
  {
    urlPattern: /^https?:\/\/[^/]+\/api\//,
    handler: "NetworkFirst",
    options: {
      cacheName: "api-cache",
      networkTimeoutSeconds: 5,
      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 }
    }
  },
  // Images
  {
    urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
    handler: "StaleWhileRevalidate",
    options: { cacheName: "images" }
  }
];
