
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // B4.2.9: Keep development and production builds separate.
  // Prevents development from overwriting production CSS/JS files.
  distDir:
    process.env.DUJUAN_BUILD_TARGET === "dev"
      ? ".next-dev"
      : ".next",
};

export default nextConfig;
