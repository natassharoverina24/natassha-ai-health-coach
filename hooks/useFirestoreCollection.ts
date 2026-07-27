"use client";

/**
 * Generic hook for subscribing to a Firestore collection query via a
 * repository's `.subscribe()` method. Built on `useSyncExternalStore`
 * (React's purpose-built primitive for subscribing to an external data
 * source) rather than `useEffect` + `useState`, which sidesteps the
 * "setState synchronously in an effect" anti-pattern entirely and gives
 * React proper tearing-safe semantics for free.
 *
 * Usage:
 *   const { data, loading, error } = useFirestoreCollection(
 *     uid ? (onData, onError) => weightsRepository.subscribeForUser(uid, onData, onError) : null,
 *     [uid],
 *   );
 */
import { useRef, useSyncExternalStore } from "react";

import { useStable } from "./useStable";

type Subscriber<T> = (
  onData: (items: T[]) => void,
  onError: (error: Error) => void,
) => () => void;

export interface FirestoreCollectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

function emptyState<T>(): FirestoreCollectionState<T> {
  return { data: [], loading: false, error: null };
}

export function useFirestoreCollection<T>(
  subscribeToSource: Subscriber<T> | null,
  deps: unknown[],
): FirestoreCollectionState<T> {
  const stateRef = useRef<FirestoreCollectionState<T>>({
    data: [],
    loading: Boolean(subscribeToSource),
    error: null,
  });

  const subscribe = useStable(
    () => (onStoreChange: () => void) => {
      if (!subscribeToSource) {
        stateRef.current = emptyState<T>();
        onStoreChange();
        return () => {};
      }

      stateRef.current = { data: stateRef.current.data, loading: true, error: null };
      onStoreChange();

      const unsubscribe = subscribeToSource(
        (items) => {
          stateRef.current = { data: items, loading: false, error: null };
          onStoreChange();
        },
        (error) => {
          stateRef.current = { data: [], loading: false, error: error.message };
          onStoreChange();
        },
      );

      return unsubscribe;
    },
    // Re-subscribe whenever the caller's dependency array changes — this
    // mirrors the dependency-array contract of useEffect on purpose.
    deps,
  );

  const getSnapshot = useStable(() => () => stateRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
