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
 * ONE DRAW AT A TIME. A draw takes the server a while (a second or more in
 * development), and edits come faster than that — a word typed is a request per
 * letter. Sent side by side they slowed one another down, all but the last were
 * thrown away, and the page lagged and then jumped. Now an edit made while a draw is
 * on its way waits, and only the newest of those is drawn when it lands: the page
 * follows steadily, one fresh draw after another, and the server does a fraction
 * of the work.
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
  const waiting = React.useRef<{ content: unknown } | null>(null);
  /** A draw is on its way. */
  const busy = React.useRef(false);
  /** The newest content that came in meanwhile — drawn next. */
  const queued = React.useRef<{ content: unknown } | null>(null);
  /**
   * Called once a draw is ON SCREEN. The server function's promise settles when the
   * first part of the page arrives; the rest streams in after it and the transition
   * commits only then — so "done" is the commit, not the promise.
   */
  const onCommit = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    const origin = window.location.origin;

    async function draw(content: unknown) {
      if (isEditingInPlace()) {
        waiting.current = { content };
        return;
      }
      if (busy.current) {
        queued.current = { content };
        return;
      }
      busy.current = true;
      try {
        const next = await render(content);
        if (next !== null) {
          // An edit began while this was being drawn: keep it for when the edit ends.
          if (isEditingInPlace()) waiting.current ??= { content };
          // Shown even when newer content waits: it is one step behind at most, and the
          // bridge puts the selected section's newest style straight back on it.
          else {
            await new Promise<void>((resolve) => {
              onCommit.current = resolve;
              React.startTransition(() => setPage(next));
              // Never wait for ever: a draw that does not commit must not stop the next.
              window.setTimeout(resolve, 10_000);
            });
          }
        }
      } catch {
        // A failed draw keeps the last good one on screen; the next edit tries again.
      } finally {
        busy.current = false;
        const next = queued.current;
        queued.current = null;
        if (next) void draw(next.content);
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
    onCommit.current?.();
    onCommit.current = null;
  }, [page]);

  return page;
}
