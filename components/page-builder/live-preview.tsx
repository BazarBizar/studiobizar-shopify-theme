"use client";

import * as React from "react";

import {
  isEditingInPlace,
  PREVIEW_EDIT_END,
  PREVIEW_MESSAGE,
  PREVIEW_RENDERED,
} from "./preview-bridge";

/**
 * The preview's page, kept in step with the editor WITHOUT a save in between: the
 * editor posts its current content (`sb-preview:content`), this asks the server to draw
 * it (`render`, a Server Function), and swaps the result in. React reconciles it into
 * the page already on screen — same sections, same DOM — so the scroll position, a
 * playing slideshow and an open accordion all stay put; only what changed changes.
 *
 * Several edits in quick succession: only the newest answer is shown, so a slow
 * response can never overwrite a newer one.
 *
 * While a line is being edited in place, redraws WAIT — replacing the element under
 * the caret would lose it — and the newest content is drawn when the edit ends.
 */
export function LivePreview({
  initial,
  render,
}: {
  initial: React.ReactNode;
  render: (content: unknown) => Promise<React.ReactNode>;
}) {
  const [page, setPage] = React.useState<React.ReactNode>(initial);
  const latest = React.useRef(0);
  const waiting = React.useRef<{ content: unknown } | null>(null);

  React.useEffect(() => {
    const origin = window.location.origin;

    async function draw(content: unknown) {
      if (isEditingInPlace()) {
        waiting.current = { content };
        return;
      }
      const mine = ++latest.current;
      try {
        const next = await render(content);
        if (mine !== latest.current || next === null) return;
        // An edit began while this was being drawn: keep it for when the edit ends.
        if (isEditingInPlace()) {
          waiting.current = { content };
          return;
        }
        React.startTransition(() => setPage(next));
      } catch {
        // A failed draw keeps the last good one on screen; the next edit tries again.
      }
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      const data = event.data as { type?: unknown; content?: unknown } | null;
      if (data?.type === PREVIEW_MESSAGE.content) void draw(data.content);
    }
    function onEditEnd() {
      const pending = waiting.current;
      waiting.current = null;
      if (pending) void draw(pending.content);
    }

    window.addEventListener("message", onMessage);
    window.addEventListener(PREVIEW_EDIT_END, onEditEnd);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener(PREVIEW_EDIT_END, onEditEnd);
    };
  }, [render]);

  // Once the new page is in the DOM — a transition can commit frames later than it
  // was asked for — the bridge re-applies the outline and scroll, and re-reads what
  // the selected section shows.
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.dispatchEvent(new Event(PREVIEW_RENDERED));
  }, [page]);

  return page;
}
