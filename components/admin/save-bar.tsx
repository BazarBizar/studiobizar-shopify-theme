"use client";

import { Loader2Icon, SaveIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";

/**
 * THE save area of a record form — sticky at the bottom, so Save is reachable on a
 * long form without scrolling back: what state the form is in, Discard, Save
 * (see docs/admin/ui-standard.md). It also makes the browser ask before a tab
 * with unsaved changes is closed or reloaded.
 */
export function SaveBar({
  dirty,
  saving,
  onDiscard,
  onSave,
  saveLabel = "Save",
  disabled = false,
  note,
}: {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  /** Omit when the bar sits inside a <form>: Save then submits it. */
  onSave?: () => void;
  saveLabel?: string;
  /** Nothing on the record can be saved (read-only). */
  disabled?: boolean;
  /** Overrides the status line, e.g. "A menu cannot be saved empty". */
  note?: React.ReactNode;
}) {
  useUnsavedChangesWarning(dirty && !saving);

  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t py-4 backdrop-blur">
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {note ?? (disabled ? "Nothing here can be changed" : dirty ? "You have unsaved changes" : "All changes saved")}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={!dirty || saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button type={onSave ? "button" : "submit"} disabled={!dirty || saving || disabled} onClick={onSave}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}

/** The browser's own "Leave site?" prompt while there is something unsaved. */
export function useUnsavedChangesWarning(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
