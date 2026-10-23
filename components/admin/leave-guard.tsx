"use client";

import * as React from "react";

import { LEAVE_UNSAVED, useConfirm } from "@/components/admin/confirm-dialog";

/**
 * LEAVING A SCREEN WITH UNSAVED CHANGES. The browser's own prompt covers closing
 * or reloading the tab, but not a click inside the panel — the sidebar, a
 * breadcrumb, "‹ Products" — which is a client-side navigation the browser never
 * sees. Those used to throw the edits away without a word.
 *
 * A form with unsaved changes registers here (`useUnsavedChangesWarning`), and
 * `AppLink` asks `confirmLeave()` before it navigates. One dialog for the whole
 * panel, mounted once in `AdminProviders`.
 */

const unsaved = new Set<symbol>();

/** Registers this screen as holding unsaved changes while `active`. */
export function useRegisterUnsaved(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const token = Symbol("unsaved");
    unsaved.add(token);
    return () => {
      unsaved.delete(token);
    };
  }, [active]);
}

export function hasUnsavedChanges() {
  return unsaved.size > 0;
}

let ask: (() => Promise<boolean>) | null = null;

/** True when the editor chose to leave (or there was nothing to lose). */
export async function confirmLeave(): Promise<boolean> {
  if (!hasUnsavedChanges()) return true;
  const answer = ask ? await ask() : window.confirm(LEAVE_UNSAVED.description);
  // Leaving: the screen that held the changes is about to unmount, but it must not
  // stop the navigation that is about to replace it.
  if (answer) unsaved.clear();
  return answer;
}

export function LeaveGuardHost() {
  const [dialog, question] = useConfirm();
  React.useEffect(() => {
    ask = () => question(LEAVE_UNSAVED);
    return () => {
      ask = null;
    };
  }, [question]);
  return dialog;
}
