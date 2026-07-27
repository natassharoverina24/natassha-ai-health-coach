"use client";

/**
 * Tracks browser connectivity via useSyncExternalStore (React's primitive
 * for subscribing to external, mutable sources like `navigator.onLine`)
 * and drains the offline sync queue the moment we come back online.
 * Firestore handles its own write queue internally; this hook is what
 * triggers our custom queue (Storage uploads, etc.) in
 * src/lib/offline/syncQueue.ts.
 */
import { useSyncExternalStore } from "react";

import { drainQueue } from "@/lib/offline/syncQueue";

function subscribe(onStoreChange: () => void) {
  const handleOnline = () => {
    onStoreChange();
    // Handlers are registered by feature modules as they're implemented;
    // draining with an empty map here is a safe no-op until then.
    void drainQueue({});
  };
  const handleOffline = () => onStoreChange();

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
