import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright's webServer drives the dev server via http://127.0.0.1:3000;
  // without this, Next.js dev mode blocks cross-origin static/HMR requests
  // from that origin, silently breaking client-side hydration in E2E runs.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
