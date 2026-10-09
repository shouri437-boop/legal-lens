// ABOUTME: Next.js configuration for Legal Lens frontend
// ABOUTME: Sets standalone output for Docker deployment and configures app settings

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment
  output: "standalone",

  // Turbopack config for monorepo Docker builds
  turbopack: {
    root: "..",
  },

  // Image optimization for external URLs (OAuth provider avatars)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.gravatar.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
