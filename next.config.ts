import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mastra's LibSQL memory adapter depends on native Node.js libSQL
  // packages. Keep them outside the webpack server bundle.
  serverExternalPackages: [
    "@mastra/libsql",
    "@libsql/client",
    "@libsql/hrana-client",
    "@libsql/darwin-arm64",
    "libsql",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
