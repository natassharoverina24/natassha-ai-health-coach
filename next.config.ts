import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      // Google account profile photos, used by Auth (see components/ui/Avatar.tsx)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // Firebase Storage download URLs, used for meal photos (see components/meal/MealPhotoSection.tsx)
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },

  async headers() {
    return [
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
