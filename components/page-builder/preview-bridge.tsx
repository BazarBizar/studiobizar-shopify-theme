"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The preview's half of the conversation with the editor that frames it.
 *
 *   editor → preview   `sb-preview:refresh`   re-render from the saved draft
 *                      `sb-preview:content`   draw this content, unsaved (`LivePreview`)
 *                      `sb-preview:style`     restyle one section NOW, before it is redrawn
 *                      `sb-preview:select`    outline a section and scroll to it
 *   preview → editor   `sb-preview:clicked`   the operator clicked a section
 *
 * Editing text in place (`lib/page-builder/inline-edit.ts`):
 *   preview → editor   `sb-preview:edit-request`  this text was double-clicked — which setting is it?
 *   editor → preview   `sb-preview:editable`      that one (a path), or none
 *   preview → editor   `sb-preview:edit`          its new value, on every keystroke
 * Enter (or a click elsewhere) finishes, Escape puts the text back; Shift+Enter is a
 * new line. While a line is being edited the live redraw waits (`LivePreview`), so
 * the caret never jumps.
 *
 * `sb-preview:style` is what makes a slider feel live: the section's custom
 * properties and `data-sb-*` attributes are set on the spot, in the same frame as the
 * drag, and the redraw that follows a moment later lands on the same values.
 *
 * Links are inert here. A click on one would navigate the frame away from the
 * page being edited; in the preview a click means "select this section".
 *
 * Messages are accepted from this origin only — the editor and the preview are the
 * same app.
 */

export const PREVIEW_MESSAGE = {
  refresh: "sb-preview:refresh",
  content: "sb-preview:content",
  style: "sb-preview:style",
  select: "sb-preview:select",
  clicked: "sb-preview:clicked",
  editRequest: "sb-preview:edit-request",
  editable: "sb-preview:editable",
  edit: "sb-preview:edit",
  contents: "sb-preview:contents",
} as const;

/** Dispatched on the preview's window when an in-place text edit ends. */
export const PREVIEW_EDIT_END = "sb-preview:edit-end";

/** What a section actually draws — so the Style tab offers only controls that do something. */
export type SectionContents = {
  heading: boolean;
  text: boolean;
  button: boolean;
  image: boolean;
  /** A content column (`sb-container`) that "Content width" can narrow. */
  container: boolean;
};

/** True while a line of text is being edited in place. */
export const isEditingInPlace = () => document.querySelector("[data-sb-editing]") !== null;

/** Dispatched on the preview's window once a live redraw is on screen. */
export const PREVIEW_RENDERED = "sb-preview:rendered";

const SECTION_ID = /^s_[a-z0-9]+$/;
const kebab = (name: string) => (name.startsWith("--") ? name : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));

function restyle(id: string, style: Record<string, string>, attrs: Record<string, string>) {
  const element = document.querySelector<HTMLElement>(`[data-section-id="${id}"]`);
  if (!element) return;
  for (const name of element.getAttributeNames()) {
    if (name.startsWith("data-sb-") || name === "data-surface") element.removeAttribute(name);
  }
  for (const [name, value] of Object.entries(attrs)) {
    if (/^data-(sb-[a-z0-9-]+|surface)$/.test(name)) element.setAttribute(name, value);
  }
  element.style.cssText = "";
  for (const [name, value] of Object.entries(style)) element.style.setProperty(kebab(name), value);
}

export function PreviewBridge() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  /** A section selected before it exists here — one just added, still being drawn. */
  const pendingScroll = useRef<string | null>(null);
  /** The double-clicked element waiting for the editor's answer, by request token. */
  const editRequests = useRef(new Map<number, { element: HTMLElement; id: string }>());
  const nextToken = useRef(0);
  /** The section just clicked HERE: selecting it must not scroll the page out from under the pointer. */
  const clickedHere = useRef<string | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    const scrollTo = (id: string) => {
      const element = document.querySelector(`[data-section-id="${id}"]`);
      if (!element) return false;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return;
      const data = event.data as {
        type?: unknown;
        id?: unknown;
        style?: Record<string, string>;
        attrs?: Record<string, string>;
      } | null;

      if (data?.type === PREVIEW_MESSAGE.refresh) router.refresh();

      if (data?.type === PREVIEW_MESSAGE.style && typeof data.id === "string" && SECTION_ID.test(data.id)) {
        restyle(data.id, data.style ?? {}, data.attrs ?? {});
      }

      if (data?.type === PREVIEW_MESSAGE.editable) {
        const reply = data as { token?: unknown; path?: unknown };
        const request = typeof reply.token === "number" ? editRequests.current.get(reply.token) : undefined;
        if (typeof reply.token === "number") editRequests.current.delete(reply.token);
        if (request && Array.isArray(reply.path)) startEditing(request.element, request.id, reply.path as (string | number)[]);
      }

      if (data?.type === PREVIEW_MESSAGE.select) {
        const id = typeof data.id === "string" && SECTION_ID.test(data.id) ? data.id : null;
        setSelected(id);
        selectedRef.current = id;
        if (id) report(id);
        if (id && id === clickedHere.current) {
          clickedHere.current = null;
          return;
        }
        pendingScroll.current = id && !scrollTo(id) ? id : null;
      }
    }

    /** The line becomes editable where it is; every keystroke goes to its setting. */
    function startEditing(element: HTMLElement, id: string, path: (string | number)[]) {
      if (isEditingInPlace()) return;
      const original = element.textContent ?? "";
      const send = (value: string) =>
        window.parent.postMessage({ type: PREVIEW_MESSAGE.edit, id, path, value }, origin);

      element.setAttribute("data-sb-editing", "");
      element.contentEditable = "plaintext-only";
      element.focus();
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const onInput = () => send(element.textContent ?? "");
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          element.blur();
        }
        if (event.key === "Escape") {
          element.textContent = original;
          send(original);
          element.blur();
        }
      };
      const onBlur = () => {
        element.removeAttribute("data-sb-editing");
        element.contentEditable = "inherit";
        element.removeEventListener("input", onInput);
        element.removeEventListener("keydown", onKey);
        window.dispatchEvent(new Event(PREVIEW_EDIT_END));
      };
      element.addEventListener("input", onInput);
      element.addEventListener("keydown", onKey);
      element.addEventListener("blur", onBlur, { once: true });
    }

    function onDoubleClick(event: MouseEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const section = target?.closest("[data-section-id]");
      if (!target || !section || window.parent === window || isEditingInPlace()) return;
      const text = target.textContent ?? "";
      if (!text.trim() || target.querySelector("img, svg, input")) return;
      event.preventDefault();
      const token = ++nextToken.current;
      editRequests.current.set(token, { element: target, id: section.getAttribute("data-section-id")! });
      window.parent.postMessage(
        { type: PREVIEW_MESSAGE.editRequest, id: section.getAttribute("data-section-id"), text, token },
        origin,
      );
    }

    /** The editor's Style tab offers headings, text, buttons and images only where they exist. */
    function report(id: string) {
      const section = document.querySelector(`[data-section-id="${id}"]`);
      if (!section || window.parent === window) return;
      const contents: SectionContents = {
        heading: section.querySelector("h1, h2, h3, h4, h5, h6") !== null,
        text: section.querySelector("p, li, figcaption, blockquote, dt, dd") !== null,
        button: section.querySelector("[data-sb-button]") !== null,
        image: section.querySelector("img") !== null,
        container: section.querySelector(".sb-container") !== null,
      };
      window.parent.postMessage({ type: PREVIEW_MESSAGE.contents, id, contents }, origin);
    }

    function onRendered() {
      if (selectedRef.current) report(selectedRef.current);
      if (pendingScroll.current && scrollTo(pendingScroll.current)) pendingScroll.current = null;
    }

    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest("a[href]")) event.preventDefault();

      const section = target.closest("[data-section-id]");
      if (section && window.parent !== window) {
        clickedHere.current = section.getAttribute("data-section-id");
        window.parent.postMessage(
          { type: PREVIEW_MESSAGE.clicked, id: section.getAttribute("data-section-id") },
          origin,
        );
      }
    }

    window.addEventListener("message", onMessage);
    window.addEventListener(PREVIEW_RENDERED, onRendered);
    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDoubleClick, true);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener(PREVIEW_RENDERED, onRendered);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDoubleClick, true);
    };
  }, [router]);

  // A rule rather than an attribute on the element, so the outline survives a
  // redraw that re-creates the section's DOM.
  // In the selected section, text says it can be edited: a text cursor and a faint
  // dashed line under the pointer; the line being edited, a solid one.
  return selected ? (
    <style>{`[data-section-id="${selected}"]{outline:2px solid #2563eb;outline-offset:-2px;transition:outline-color .2s}
[data-section-id="${selected}"] :is(h1,h2,h3,h4,h5,h6,p,li,figcaption,a,dt,dd,summary):hover{cursor:text;outline:1px dashed rgb(37 99 235 / .55);outline-offset:2px}
[data-sb-editing]{outline:2px solid #2563eb !important;outline-offset:2px;cursor:text}`}</style>
  ) : null;
}
