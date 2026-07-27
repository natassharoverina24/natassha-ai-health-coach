"use client";

import { useEffect } from "react";

/**
 * Registers /public/sw.js once the page has loaded. Kept as its own
 * component (rather than inline in layout.tsx) so it's trivially removable
 * and easy to unit test in isolation.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[pwa] Service worker registration failed", error);
      });
    };

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
