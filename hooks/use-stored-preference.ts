"use client";

import * as React from "react";

/**
 * Per-operator preferences that live in `localStorage` — hidden columns, collapsed
 * sections, page size.
 *
 * WHY `useSyncExternalStore` AND NOT `useState` + `useEffect`. The obvious version
 * reads storage in an effect and pushes it into state, which trips
 * `react-hooks/set-state-in-effect` and, more importantly, renders once with the
 * wrong value before correcting itself. `useSyncExternalStore` has a dedicated
 * server snapshot, so the server renders the default, the client renders the stored
 * value from the first commit, and React knows the two are allowed to differ.
 *
 * Reads and writes are wrapped: Safari in private mode throws on `localStorage`
 * access rather than returning null, and a preference is never worth a crash.
 */

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` fires only in OTHER tabs, which is exactly the case a same-tab
  // notification cannot cover.
  window.addEventListener("storage", onChange);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredPreference<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T,
): [T, (value: T) => void] {
  const getSnapshot = React.useCallback(() => read(key), [key]);

  // The server has no localStorage, so it must be told what the snapshot is
  // rather than left to guess — that is what prevents a hydration mismatch.
  const getServerSnapshot = React.useCallback(() => null, []);

  const raw = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = React.useMemo(() => {
    if (raw === null) return fallback;
    try {
      return parse(raw);
    } catch {
      // A stored value written by an older version of the panel must not brick
      // the screen that reads it.
      return fallback;
    }
    // `fallback` is intentionally not a dependency: callers pass object literals,
    // and depending on it would re-parse on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, parse]);

  const set = React.useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage full or blocked — the preference is lost, the session is not.
      }
      emit();
    },
    [key],
  );

  return [value, set];
}

/** The common case: a JSON-serialisable preference. */
export function useStoredJson<T>(key: string, fallback: T) {
  const parse = React.useCallback((raw: string) => JSON.parse(raw) as T, []);
  return useStoredPreference<T>(key, fallback, parse);
}
