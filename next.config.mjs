import withPWA from "next-pwa";
import runtimeCaching from "next-pwa/cache.js";

const isProd = process.env.NODE_ENV === "production";

const withPWACustom = withPWA({
  dest: "public",
  disable: !isProd,
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
    ignoreDuringBuilds: true, // non bloccare il build
    dirs: [],                 // non lanciare eslint durante il build
  },
  typescript: {
    ignoreBuildErrors: true,  // (paracadute) non bloccare per errori TS
  },
});
