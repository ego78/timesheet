// next.config.mjs
import withPWA from "next-pwa";
import runtimeCaching from "next-pwa/cache.js";

const isProd = process.env.NODE_ENV === "production";

const withPWACustom = withPWA({
  dest: "public",
  disable: !isProd,     // SW attivo solo in prod
  register: true,
  skipWaiting: true,
  runtimeCaching,
  fallbacks: {
    document: "/offline.html",
    image: "/offline.png",
  },
});

export default withPWACustom({
  reactStrictMode: true,
  eslint: {
    // ✅ NON bloccare il build su Vercel per errori ESLint
    ignoreDuringBuilds: true,
  },
});
