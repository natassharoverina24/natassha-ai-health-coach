/**
 * Cloud Messaging Layer
 * ---------------------------------------------------------------------------
 * Push notifications (meal reminders, weigh-in nudges, supplement alerts,
 * "your weekly report is ready"). Messaging only works in the browser with
 * a registered service worker, so every export here is a no-op on the
 * server and guarded behind feature/permission checks.
 */
import { app } from "./config";

export type NotificationPermissionState = NotificationPermission | "unsupported";

export function isMessagingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isMessagingSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isMessagingSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Registers the FCM token for the current browser. Requires
 * NEXT_PUBLIC_FIREBASE_VAPID_KEY to be set (generated in Firebase Console →
 * Project Settings → Cloud Messaging → Web Push certificates).
 *
 * Lazily imports `firebase/messaging` because that module touches
 * `navigator`/`window` at import time and must never load during SSR.
 */
export async function registerFcmToken(): Promise<string | null> {
  if (!isMessagingSupported()) return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn(
      "[messaging] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set; push notifications disabled.",
    );
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;

  const { getMessaging, getToken } = await import("firebase/messaging");
  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    return token || null;
  } catch (error) {
    console.error("[messaging] Failed to retrieve FCM token", error);
    return null;
  }
}

export type ForegroundMessageHandler = (payload: {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}) => void;

/** Subscribes to messages received while the app is in the foreground. */
export async function onForegroundMessage(
  handler: ForegroundMessageHandler,
): Promise<() => void> {
  if (!isMessagingSupported()) return () => {};

  const { getMessaging, onMessage } = await import("firebase/messaging");
  const messaging = getMessaging(app);

  return onMessage(messaging, (payload) => {
    handler({
      title: payload.notification?.title,
      body: payload.notification?.body,
      data: payload.data as Record<string, string> | undefined,
    });
  });
}
