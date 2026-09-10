"use client";

import { useEffect, useRef } from "react";

/**
 * Shared shell for the media and reference pickers.
 *
 * A native `<dialog>` rather than a hand-rolled overlay: it gives focus trapping,
 * Escape-to-close and inertness of the page behind it for free, and those are the
 * parts people usually get wrong. `showModal()` has to be called imperatively —
 * there is no declarative "open" attribute that produces a modal.
 */
export function PickerDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Escape fires `cancel`, and the dialog closes itself; the parent's state has
      // to follow or it will refuse to reopen.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      aria-label={title}
      className="rounded-admin bg-admin-panel text-admin-fg m-auto w-[min(52rem,92vw)] max-w-none p-0 backdrop:bg-black/40"
    >
      {/* The dialog is outside the admin shell in the DOM, so it needs its own
          `data-admin` to pick up the panel's type scale and tokens. */}
      <div data-admin className="rounded-admin overflow-hidden">
        <div className="border-admin-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-admin-fg text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-admin-muted hover:text-admin-fg rounded px-2 py-1"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
