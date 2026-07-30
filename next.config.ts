import type { NextConfig } from "next";

const FIREBASE_PROJECT_ID_PATTERN = /^[a-z0-9-]+$/;

export function buildFirebaseAuthRewrites(projectId: string | undefined) {
  const normalizedProjectId = projectId?.trim();
  if (
    !normalizedProjectId ||
    !FIREBASE_PROJECT_ID_PATTERN.test(normalizedProjectId)
  ) {
    return [];
  }

  const firebaseHostingOrigin = `https://${normalizedProjectId}.firebaseapp.com`;
  return [
    {
      source: "/__/auth/:path*",
      destination: `${firebaseHostingOrigin}/__/auth/:path*`,
    },
    {
      source: "/__/firebase/init.json",
      destination: `${firebaseHostingOrigin}/__/firebase/init.json`,
    },
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      // Google account profile photos, used by Auth (see components/ui/Avatar.tsx)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  async rewrites() {
    return buildFirebaseAuthRewrites(
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    );
  },

  async headers() {
    return [
      {
        // Firebase's same-origin auth iframe must be embeddable by this app.
        // The proxied reserved helper paths retain Firebase's own headers.
        source: "/((?!__/auth(?:/.*)?|__/firebase/init\\.json).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // The service worker must be served from the root with no caching,
        // otherwise browsers can pin an old worker indefinitely and users
        // never receive app updates.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
