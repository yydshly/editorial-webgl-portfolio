import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  typescript: {
    tsconfigPath: process.env.NEXT_TSCONFIG_PATH ?? "tsconfig.json",
  },
  turbopack: {},
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};

    return config;
  },
};

export default nextConfig;
