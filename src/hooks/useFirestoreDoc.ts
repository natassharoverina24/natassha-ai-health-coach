"use client";

/**
 * Generic hook for subscribing to a single Firestore document via a
 * repository's `.subscribeOne()` method. Built on `useSyncExternalStore`
 * for the same reason as useFirestoreCollection — see that file's header
 * comment for the full rationale.
 */
import { useRef, useSyncExternalStore } from "react";

import { useStable } from "./useStable";

type Subscriber<T> = (
  onData: (item: T | null) => void,
  onError: (error: Error) => void,
) => () => void;

export interface FirestoreDocState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function emptyState<T>(): FirestoreDocState<T> {
  return { data: null, loading: false, error: null };
}

export function useFirestoreDoc<T>(
  subscribeToSource: Subscriber<T> | null,
  deps: unknown[],
): FirestoreDocState<T> {
  const stateRef = useRef<FirestoreDocState<T>>({
    data: null,
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
        (item) => {
          stateRef.current = { data: item, loading: false, error: null };
          onStoreChange();
        },
        (error) => {
          stateRef.current = { data: null, loading: false, error: error.message };
          onStoreChange();
        },
      );

      return unsubscribe;
    },
    deps,
  );

  const getSnapshot = useStable(() => () => stateRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
