import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Cache Components / Partial Prefetching off — they were stacking
  // previous routes in the DOM (duplicate headers/nav) and breaking tab clicks.
  // Note: do not set output:"standalone" — Cursor hosting / `next start` need the
  // default build layout; standalone breaks `next start` with a runtime warning.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.trycloudflare.com",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
