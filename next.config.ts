import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/uploads/:file*",
          destination: "/api/uploads/:file*",
        },
        {
          source: "/clues/:file*",
          destination: "/api/clues/:file*",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
