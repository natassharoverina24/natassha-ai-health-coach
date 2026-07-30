/**
 * Authentication Layer
 * ---------------------------------------------------------------------------
 * Thin wrapper around Firebase Authentication. UI code should never import
 * `firebase/auth` directly — go through these functions (or the
 * `useAuth()` hook / `AuthContext`) so the auth *provider* can be swapped
 * later without touching every component.
 */
import {
  type User,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  getIdToken,
  getRedirectResult,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { auth } from "./config";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export type GoogleSignInFlow = "popup" | "redirect";

export const GOOGLE_SIGN_IN_FRIENDLY_ERROR =
  "Google sign-in could not be completed. Please try again.";
type AuthPersistenceMode = "local" | "session" | "indexeddb" | "memory";
let redirectResultPromise: Promise<User | null> | null = null;

/** Pure browser check so the mobile redirect choice remains testable. */
export function shouldUseGoogleRedirect(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  const isIOS =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const isMobileBrowser =
    /Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\//i.test(userAgent);
  return isIOS || isMobileBrowser || isInAppBrowser;
}

export function getGoogleSignInFlow(): GoogleSignInFlow {
  if (typeof navigator === "undefined") {
    return "popup";
  }
  return shouldUseGoogleRedirect(
    navigator.userAgent || "",
    navigator.maxTouchPoints || 0,
  )
    ? "redirect"
    : "popup";
}

function safeAuthErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^auth\/[a-z0-9-]+$/.test(error.code)
  ) {
    return error.code;
  }
  return "auth/unknown";
}

function logAuthEvent(
  event:
    | "flow selected"
    | "redirect result checked"
    | "auth state resolved"
    | "sign-in failed",
  details: Record<string, unknown>,
): void {
  const method = event === "sign-in failed" ? "error" : "info";
  console[method](`[Auth] ${event}`, details);
}

function logGoogleSignInFailure(
  error: unknown,
  flow: GoogleSignInFlow,
): void {
  logAuthEvent("sign-in failed", {
    flow,
    code: safeAuthErrorCode(error),
    message: GOOGLE_SIGN_IN_FRIENDLY_ERROR,
  });
}

async function configureAuthPersistence(): Promise<AuthPersistenceMode> {
  const candidates = [
    ["local", browserLocalPersistence],
    ["session", browserSessionPersistence],
    ["indexeddb", indexedDBLocalPersistence],
    ["memory", inMemoryPersistence],
  ] as const;

  for (const [mode, persistence] of candidates) {
    try {
      await setPersistence(auth, persistence);
      return mode;
    } catch {
      // Safari privacy settings can reject an individual storage mechanism.
      // Continue through Firebase's built-in persistence implementations.
    }
  }
  throw new Error(GOOGLE_SIGN_IN_FRIENDLY_ERROR);
}

export async function signInWithGoogle(): Promise<User | null> {
  const flow = getGoogleSignInFlow();
  logAuthEvent("flow selected", {
    flow,
    code: "auth/ok",
    message: flow === "redirect" ? "mobile-redirect" : "desktop-popup",
  });
  try {
    const persistence = await configureAuthPersistence();
    if (flow === "redirect" && persistence === "memory") {
      // In-memory auth cannot survive a full-page redirect.
      throw new Error("auth/persistence-unavailable");
    }
    if (flow === "redirect") {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  } catch (error) {
    logGoogleSignInFailure(error, flow);
    throw new Error(GOOGLE_SIGN_IN_FRIENDLY_ERROR);
  }
}

/** Completes a mobile redirect when AuthProvider mounts after returning. */
export async function completeGoogleRedirectSignIn(): Promise<User | null> {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth)
      .then((credential) => {
        const user = credential?.user ?? null;
        logAuthEvent("redirect result checked", {
          flow: "redirect",
          code: "auth/ok",
          message: user ? "user-restored" : "no-redirect-result",
        });
        return user;
      })
      .catch((error: unknown) => {
        logGoogleSignInFailure(error, "redirect");
        throw new Error(GOOGLE_SIGN_IN_FRIENDLY_ERROR);
      });
  }
  return redirectResultPromise;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(auth, (user) => {
    logAuthEvent("auth state resolved", {
      flow: "observer",
      code: "auth/ok",
      message: user ? "authenticated" : "signed-out",
    });
    callback(user);
  });
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export async function getCurrentUserIdToken(): Promise<string | null> {
  const user = getCurrentUser();
  return user ? getIdToken(user) : null;
}

export { auth };
export type { User };
