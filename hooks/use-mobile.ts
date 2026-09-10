import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * Used by the shadcn `sidebar` primitive to decide between the inset sidebar and the
 * mobile sheet.
 *
 * REWRITTEN from what the shadcn CLI generates. The generated version calls `setIsMobile`
 * synchronously inside an effect, which `react-hooks/set-state-in-effect` reports as an
 * error under this repo's lint config — and it is right: that pattern renders once with
 * `undefined`, then immediately re-renders, so the sidebar mounts in the wrong mode for a
 * frame.
 *
 * `useSyncExternalStore` is the shape this actually is: a subscription to a browser API
 * with a distinct server answer. It gives the correct value on the first client render and
 * a defined server snapshot, so there is no cascade and no hydration mismatch.
 *
 * Re-running `shadcn add sidebar` will overwrite this file — reapply the change.
 */
export function useIsMobile() {
  const subscribe = React.useCallback((onChange: () => void) => {
    const query = window.matchMedia(QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const getSnapshot = React.useCallback(() => window.matchMedia(QUERY).matches, []);

  // The server has no viewport. Desktop is the safer default: the mobile branch renders a
  // Sheet, and hydrating a Sheet into an inset layout is the more disruptive correction.
  const getServerSnapshot = React.useCallback(() => false, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
