"use client";

/**
 * AuthContext
 * ---------------------------------------------------------------------------
 * Single source of truth for "who is signed in" across the app. Wraps
 * Firebase Auth state and ensures a corresponding `users` Firestore profile
 * exists (creating one with sensible defaults on first sign-in).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  onAuthStateChanged,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  type User,
} from "@/lib/firebase/auth";
import { usersRepository } from "@/lib/db/users.repository";
import { DEFAULT_USER_PROFILE } from "@/lib/utils/constants";
import type { UserProfile } from "@/types/firestore";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setError(null);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const ensured = await usersRepository.ensureProfile(firebaseUser.uid, {
          ...DEFAULT_USER_PROFILE,
          email: firebaseUser.email ?? "",
          photoURL: firebaseUser.photoURL ?? null,
          displayName: firebaseUser.displayName ?? DEFAULT_USER_PROFILE.displayName,
          dateOfBirth: null,
          sex: "unspecified",
          onboardingCompleted: false,
        });
        setProfile(ensured);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Keep the profile live once we know the uid, so edits from Settings
  // reflect everywhere immediately without a manual refetch.
  useEffect(() => {
    if (!user) return;
    const unsubscribe = usersRepository.subscribeByUid(
      user.uid,
      (updated) => {
        if (updated) setProfile(updated);
      },
      (err) => setError(err.message),
    );
    return unsubscribe;
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-out failed.");
      throw err;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, loading, error, signInWithGoogle, signOut }),
    [user, profile, loading, error, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
