"use client";

import * as React from "react";

import type { ContentStatus } from "@/lib/admin/page-status";

/**
 * SWITCHING TABS WITHOUT LOSING THE BAR. Content and Settings are separate
 * routes, so while the next tab loads, its own bar does not exist yet. Without
 * this the whole header — title, tabs, status — vanished into a skeleton and came
 * back a moment later, which made a tab click feel like leaving the page.
 *
 * The page's layout keeps the last bar it saw; the loading screens draw that bar
 * again (`PendingPageBar`), with the tab being opened already selected, so only what is below it
 * changes.
 */

type Snapshot = {
  param: string;
  title: string;
  path: string;
  isPublished: boolean;
  content: ContentStatus;
};

const Memory = React.createContext<{
  last: Snapshot | null;
  remember: (snapshot: Snapshot) => void;
} | null>(null);

export function PageBarMemoryProvider({ children }: { children: React.ReactNode }) {
  const [last, setLast] = React.useState<Snapshot | null>(null);
  const remember = React.useCallback((next: Snapshot) => {
    setLast((current) =>
      current &&
      current.param === next.param &&
      current.title === next.title &&
      current.path === next.path &&
      current.isPublished === next.isPublished &&
      current.content === next.content
        ? current
        : next,
    );
  }, []);
  const value = React.useMemo(() => ({ last, remember }), [last, remember]);
  return <Memory.Provider value={value}>{children}</Memory.Provider>;
}

/** Called by the bar itself, so the loading screens can draw it again. */
export function useRememberPageBar(snapshot: Snapshot | null) {
  const remember = React.useContext(Memory)?.remember;
  const { param, title, path, isPublished, content } = snapshot ?? {};
  React.useEffect(() => {
    if (remember && param !== undefined && title !== undefined && path !== undefined && content !== undefined) {
      remember({ param, title, path, isPublished: Boolean(isPublished), content });
    }
  }, [remember, param, title, path, isPublished, content]);
}

/** The last bar seen on this page, for the loading screens. */
export function useRememberedPageBar(): Snapshot | null {
  return React.useContext(Memory)?.last ?? null;
}
