import { useState } from "react";

function depsChanged(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((value, index) => !Object.is(value, b[index]));
}

/**
 * Returns a referentially-stable value, recomputed only when `deps`
 * shallow-changes — the same contract as `useCallback`/`useMemo`, but
 * implemented for hooks whose dependency array is supplied by the
 * *caller* (e.g. useFirestoreCollection(subscribe, deps)) rather than
 * written inline at the call site.
 *
 * React's compiler-oriented lint rules require `useCallback`/`useMemo`
 * dependency arrays to be array literals written directly in the call —
 * a variable holding the array (as any generic/library hook necessarily
 * has) can't satisfy that statically. Reaching for `useRef` instead runs
 * into the same generation of lint rules forbidding ref reads/writes
 * during render. The one primitive both rules leave available for this is
 * `useState`'s "adjust state during render" pattern — computing the next
 * value locally and persisting it with a conditional `setState` call, the
 * same technique React's own docs recommend for derived state
 * (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
 */
export function useStable<T>(factory: () => T, deps: unknown[]): T {
  const [cached, setCached] = useState<{ deps: unknown[]; value: T }>(() => ({
    deps,
    value: factory(),
  }));

  if (depsChanged(cached.deps, deps)) {
    const next = { deps, value: factory() };
    setCached(next);
    return next.value;
  }

  return cached.value;
}
