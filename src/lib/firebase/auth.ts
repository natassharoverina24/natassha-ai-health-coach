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
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { auth } from "./config";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/** True for iOS Safari / in-app browsers where popups are unreliable. */
function shouldUseRedirect(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isInAppBrowser = /FBAN|FBAV|Instagram|Line\//.test(ua);
  return isIOS || isInAppBrowser;
}

export async function signInWithGoogle(): Promise<User | null> {
  if (shouldUseRedirect()) {
    await signInWithRedirect(auth, googleProvider);
    return null; // resolves later via getRedirectResult / onAuthStateChanged
  }
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
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
