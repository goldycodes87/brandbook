import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // self, not (). The old value denied the microphone to our own origin too,
  // which silently blocks voice — and the camera, which the brand-photo and
  // tag-reading screens need. Third parties are still denied; geolocation
  // stays off entirely because nothing here asks for it.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['square'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-a76713f4122744ba98206ae0dda612a4.r2.dev',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
