import type { NextConfig } from "next";

// The admin panel is opened from the CRM's menu, so only the CRM may frame it.
// Add white-label CRM domains (space separated) in ADMIN_FRAME_ANCESTORS.
const ADMIN_FRAME_ANCESTORS =
  process.env.ADMIN_FRAME_ANCESTORS?.trim() ||
  "https://app.gohighlevel.com https://*.gohighlevel.com https://*.leadconnectorhq.com";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${ADMIN_FRAME_ANCESTORS}` },
        ],
      },
      {
        source: "/retell/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
