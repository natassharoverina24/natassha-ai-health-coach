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
  GoogleAuthProvider,
  getIdToken,
  getRedirectResult,
  onAuthStateChanged as firebaseOnAuthStateChanged,
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

function logGoogleSignInFailure(
  error: unknown,
  flow: GoogleSignInFlow,
): void {
  if (process.env.NODE_ENV === "production") return;
  console.error("[Auth] Google sign-in failed", {
    flow,
    code: safeAuthErrorCode(error),
    message: GOOGLE_SIGN_IN_FRIENDLY_ERROR,
  });
}

export async function signInWithGoogle(): Promise<User | null> {
  const flow = getGoogleSignInFlow();
  try {
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
  try {
    const credential = await getRedirectResult(auth);
    return credential?.user ?? null;
  } catch (error) {
    logGoogleSignInFailure(error, "redirect");
    throw new Error(GOOGLE_SIGN_IN_FRIENDLY_ERROR);
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
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
