"use client";

import { Loader2Icon } from "lucide-react";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Button } from "@/components/admin/ui/button";

/**
 * THE confirmation for anything that cannot be undone, or that throws work away
 * (see docs/admin/ui-standard.md). One behaviour everywhere:
 *
 *  - Cancel holds the focus, so a reflexive Enter cancels;
 *  - the action is styled destructive when it destroys;
 *  - while `onConfirm` runs the dialog STAYS OPEN with a spinner, so a failure is
 *    seen on the dialog that caused it, not behind it. It closes when the promise
 *    resolves; a rejected promise leaves it open for the caller's toast.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [working, setWorking] = React.useState(false);

  async function confirm() {
    setWorking(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the failure; the dialog stays so it is seen in context.
    } finally {
      setWorking(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !working && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>{cancelLabel}</AlertDialogCancel>
          <Button type="button" variant={destructive ? "destructive" : "default"} disabled={working} onClick={() => void confirm()}>
            {working ? <Loader2Icon className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type Question = Omit<React.ComponentProps<typeof ConfirmDialog>, "open" | "onOpenChange" | "onConfirm">;

/**
 * The same dialog, asked as a question — `if (await ask({...}))` — for flows that
 * need a yes or no before going on (leaving with unsaved changes). Render the
 * returned element once.
 */
export function useConfirm(): [React.ReactNode, (question: Question) => Promise<boolean>] {
  const [question, setQuestion] = React.useState<Question | null>(null);
  const resolver = React.useRef<((answer: boolean) => void) | null>(null);

  const ask = React.useCallback((next: Question) => {
    setQuestion(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setQuestion(null);
  };

  const element = question ? (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && answer(false)}
      {...question}
      onConfirm={() => answer(true)}
    />
  ) : null;

  return [element, ask];
}

/** The question every unsaved form asks before letting you leave. */
export const LEAVE_UNSAVED = {
  title: "Leave without saving?",
  description: "Your changes on this screen are not saved yet. If you leave now, they are lost.",
  confirmLabel: "Leave without saving",
  cancelLabel: "Stay",
  destructive: true,
} as const;
