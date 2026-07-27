import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {},
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};

    return config;
  },
};

export default nextConfig;
