import type { NextConfig } from "next";
// @ts-ignore — next-pwa has no types
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
