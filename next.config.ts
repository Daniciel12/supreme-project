import type { NextConfig } from "next";

export function buildSecurityHeaders(nodeEnvironment: string | undefined) {
  const isDevelopment = nodeEnvironment === "development";
  const isProduction = nodeEnvironment === "production";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://utfs.io https://*.ufs.sh",
    "font-src 'self' data:",
    `connect-src 'self' https://uploadthing.com https://*.uploadthing.com https://utfs.io https://*.ufs.sh${isDevelopment ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  return [
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy,
    },
    ...(isProduction
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
        ]
      : []),
  ];
}

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(process.env.NODE_ENV),
      },
    ];
  },
};

export default nextConfig;
