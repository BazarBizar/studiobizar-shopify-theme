"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The preview's half of the conversation with the builder that frames it.
 *
 *   builder → preview   `sb-preview:refresh`   re-render from the saved draft
 *                       `sb-preview:select`    outline a section and scroll to it
 *   preview → builder   `sb-preview:clicked`   the operator clicked a section
 *
 * `router.refresh()` re-renders the Server Components in place, so the scroll
 * position and every carousel's state survive an autosave — the page does not
 * reload and flash.
 *
 * Links are inert here. A click on one would navigate the frame away from the
 * page being edited; in the preview a click means "select this section".
 *
 * Messages are accepted from this origin only — the builder and the preview
 * are the same app.
 */

export const PREVIEW_MESSAGE = {
  refresh: "sb-preview:refresh",
  select: "sb-preview:select",
  clicked: "sb-preview:clicked",
} as const;

export function PreviewBridge() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const origin = window.location.origin;

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      const data = event.data as { type?: unknown; id?: unknown } | null;

      if (data?.type === PREVIEW_MESSAGE.refresh) router.refresh();

      if (data?.type === PREVIEW_MESSAGE.select) {
        const id = typeof data.id === "string" && /^s_[a-z0-9]+$/.test(data.id) ? data.id : null;
        setSelected(id);
        if (id) {
          document
            .querySelector(`[data-section-id="${id}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }

    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest("a[href]")) event.preventDefault();

      const section = target.closest("[data-section-id]");
      if (section && window.parent !== window) {
        window.parent.postMessage(
          { type: PREVIEW_MESSAGE.clicked, id: section.getAttribute("data-section-id") },
          origin,
        );
      }
    }

    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);

  // A rule rather than an attribute on the element, so the outline survives a
  // refresh that re-creates the section's DOM.
  return selected ? (
    <style>{`[data-section-id="${selected}"]{outline:2px solid #2563eb;outline-offset:-2px}`}</style>
  ) : null;
}
