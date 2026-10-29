"use client";

import { XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";

import { NewsletterForm } from "@/components/layout/newsletter-form";
import { PREVIEW_MESSAGE } from "@/components/page-builder/preview-bridge";
import { Picture } from "@/components/sections/landing/shared";
import { ButtonLink } from "@/components/ui/button";
import { designStyle, SHADOWS, type DesignValue, type Device, type ShadowId } from "@/lib/page-builder/design-style";
import { HEX_COLOR, type ImageRef, type LinkValue } from "@/lib/page-builder/fields";
import { isScheduledNow, popupOnPath, type Popup } from "@/lib/theme-builder/promo";
import { cn } from "@/lib/utils/cn";

/**
 * POP-UPS (Header & footer → Pop-ups). Every decision is the browser's: the dates,
 * the page, the device, the trigger and "seen it already" — the page is cached and
 * the same for everyone, so none of that can be known when it is drawn. Nothing is
 * rendered until one opens, so the first render always matches the server's.
 *
 * At most ONE opens per page: the first in the editor's list whose moment comes.
 *
 * In the editor's preview (`/preview/…`) nothing opens by itself; the editor names
 * the pop-up it is editing in the address (`#popup-<id>`) and that one opens at once,
 * every time, without being remembered. The NAME is kept, not the pop-up: a pop-up
 * just added reaches the preview a moment after its name does, and opens when it
 * arrives. The editor also posts `sb-preview:popup` after each change, so a pop-up
 * closed in the preview opens again as soon as it is edited.
 */

const PREVIEW_HASH = "#popup-";

/** Matches `hideClasses`: phones below 640px, tablets to 1024px. */
function currentDevice(): Device {
  if (window.matchMedia("(min-width: 1024px)").matches) return "d";
  if (window.matchMedia("(min-width: 640px)").matches) return "t";
  return "m";
}

const storageKey = (popup: Popup) => `sb-popup-${popup.id}`;

/** Whether "how often" allows it again, from when it last showed. */
function allowedAgain(popup: Popup): boolean {
  const frequency = popup.settings.frequency;
  if (frequency === "always") return true;
  try {
    if (frequency === "session") return window.sessionStorage.getItem(storageKey(popup)) === null;
    const last = Number(window.localStorage.getItem(storageKey(popup)));
    if (!last) return true;
    if (frequency === "once") return false;
    return Date.now() - last >= Number(popup.settings.days ?? 7) * 86_400_000;
  } catch {
    // Storage blocked: better once per page than never.
    return true;
  }
}

function remember(popup: Popup) {
  try {
    if (popup.settings.frequency === "session") window.sessionStorage.setItem(storageKey(popup), "1");
    else if (popup.settings.frequency !== "always") window.localStorage.setItem(storageKey(popup), String(Date.now()));
  } catch {
    // Not remembered: it may show again.
  }
}

/** Calls `open` when the pop-up's moment comes; returns the clean-up. */
function arm(popup: Popup, open: () => void): () => void {
  const s = popup.settings;
  if (s.trigger === "scroll") {
    const onScroll = () => {
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room <= 0 || window.scrollY / room >= Number(s.scroll ?? 40) / 100) open();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }
  if (s.trigger === "exit") {
    // A pointer leaving through the top of the window, towards the tabs or the address
    // bar. Touch screens have no such moment, so there it never opens.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
    const onLeave = (event: MouseEvent) => {
      if (!event.relatedTarget && event.clientY <= 0) open();
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }
  const timer = window.setTimeout(open, Number(s.delay ?? 5) * 1000);
  return () => window.clearTimeout(timer);
}

export function Popups({ popups }: { popups: Popup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState<Popup | null>(null);
  // The preview's: the id the editor named, shown whenever a pop-up by that id is here.
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  /* ---- the editor's preview: the named pop-up, at once ---- */
  React.useEffect(() => {
    if (!window.location.pathname.startsWith("/preview")) return;
    const fromHash = () => {
      const id = window.location.hash.startsWith(PREVIEW_HASH) ? window.location.hash.slice(PREVIEW_HASH.length) : "";
      setPreviewId(id || null);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown; id?: unknown } | null;
      if (data?.type === PREVIEW_MESSAGE.popup) setPreviewId(typeof data.id === "string" && data.id ? data.id : null);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  /* ---- the live site: each pop-up meant for this page waits for its moment ---- */
  React.useEffect(() => {
    if (window.location.pathname.startsWith("/preview")) return;
    const device = currentDevice();
    const now = Date.now();
    let shown = false;
    const candidates = popups.filter(
      (popup) => isScheduledNow(popup, now) && popupOnPath(popup.pages, pathname) && !popup.hide?.[device] && allowedAgain(popup),
    );
    const cleanups = candidates.map((popup) =>
      arm(popup, () => {
        if (shown) return;
        shown = true;
        remember(popup);
        setOpen(popup);
        for (const cleanup of cleanups) cleanup();
      }),
    );
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [popups, pathname]);

  // In the preview the named one follows the editor's changes as they are drawn.
  const shown = previewId ? (popups.find((popup) => popup.id === previewId) ?? null) : open;
  return shown ? (
    <PopupView
      key={shown.id}
      popup={shown}
      onClose={() => {
        setOpen(null);
        setPreviewId(null);
      }}
    />
  ) : null;
}

/* -------------------------------------------------------------------------- *
 * One pop-up
 * -------------------------------------------------------------------------- */

const WIDTH = { small: "sm:max-w-sm", medium: "sm:max-w-lg", large: "sm:max-w-3xl" } as const;
const ANIMATION = { rise: "sb-popup-in", fade: "sb-popup-fade", zoom: "sb-popup-zoom", slide: "sb-popup-slide", none: "" } as const;
const ALIGN = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" } as const;
type Align = keyof typeof ALIGN;

const hex = (value: unknown) => (typeof value === "string" && HEX_COLOR.test(value) ? value : undefined);
const between = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : undefined;

function rgba(colour: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(colour.slice(at, at + 2), 16));
  return `rgb(${r} ${g} ${b} / ${alpha.toFixed(2)})`;
}

function PopupView({ popup, onClose }: { popup: Popup; onClose: () => void }) {
  const s = popup.settings;
  const layout = (s.layout as "center" | "corner" | "bar") ?? "center";
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = `${popup.id}-title`;

  // The box in the middle is modal: focus stays in it, Escape closes it, the page
  // behind cannot be clicked. The corner box and the bar leave the page usable.
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (layout === "center") dialog.showModal();
    else dialog.show();
    return () => dialog.close();
  }, [layout]);

  React.useEffect(() => {
    if (layout === "center") return; // the modal dialog handles Escape itself
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layout, onClose]);

  // Every value was checked when it was saved; it is checked again here, as everywhere
  // a stored value becomes CSS.
  const background = hex(s.background);
  const text = hex(s.color);
  // The headings, text and buttons inside: the page builder's design rules (sb-design.css).
  const inner = designStyle((s.design as DesignValue | undefined) ?? undefined);
  const style: Record<string, string> = { ...inner.style };
  if (background) {
    style.backgroundColor = background;
    style["--sb-background"] = background;
  }
  if (text) {
    style.color = text;
    style["--sb-foreground"] = text;
  }

  const custom = layout === "center" && s.width === "custom" ? between(s.customWidth, 280, 1200) : undefined;
  if (custom) style.maxWidth = `min(${custom}px, calc(100% - 2rem))`;
  if (layout === "center" && s.vertical === "top") Object.assign(style, { marginTop: "1rem", marginBottom: "auto" });
  if (layout === "center" && s.vertical === "bottom") Object.assign(style, { marginTop: "auto", marginBottom: "1rem" });

  const radius = between(s.radius, 0, 48);
  if (radius) style.borderRadius = `${radius}px`;
  const line = between(s.borderWidth, 0, 8);
  if (line) style.border = `${line}px solid ${hex(s.borderColor) ?? "currentColor"}`;
  const shadow = String(s.shadow ?? "default");
  if (shadow in SHADOWS) style.boxShadow = SHADOWS[shadow as ShadowId].css;
  // Read by the backdrop, which takes its custom properties from the dialog.
  const darkness = between(s.overlayOpacity, 0, 90) ?? 50;
  style["--sb-popup-backdrop"] = rgba(hex(s.overlay) ?? "#000000", darkness / 100);

  const padding = between(s.padding, 0, 96);
  const inside = padding !== undefined && padding !== 32 ? { padding: `${padding}px` } : undefined;
  const closeColour = hex(s.closeColor);

  const imageRef = (s.image as ImageRef | null) ?? null;
  const side = layout === "center" && s.imagePosition === "side" && imageRef;
  const align: Align = s.align === "left" || s.align === "right" ? s.align : "center";
  const ratio = s.imageRatio === "landscape" || s.imageRatio === "square" || s.imageRatio === "portrait" || s.imageRatio === "adapt"
    ? s.imageRatio
    : side
      ? "portrait"
      : "landscape";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={s.heading ? titleId : undefined}
      aria-label={s.heading ? undefined : "Announcement"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the dimmed page around the box (the dialog itself, not its content) closes it.
      onClick={(event) => layout === "center" && event.target === event.currentTarget && onClose()}
      data-surface="light"
      {...inner.attrs}
      className={cn(
        "bg-background text-foreground max-h-[calc(100svh-2rem)] overflow-y-auto p-0",
        shadow === "default" && "shadow-xl",
        ANIMATION[(s.animation as keyof typeof ANIMATION) ?? "rise"] ?? ANIMATION.rise,
        layout === "center" && cn("fixed inset-0 m-auto w-[calc(100%-2rem)]", !custom && WIDTH[(s.width as keyof typeof WIDTH) ?? "medium"]),
        layout === "center" && (s.dim === false ? "backdrop:bg-transparent" : "backdrop:bg-[var(--sb-popup-backdrop,rgb(0_0_0/0.5))]"),
        layout === "corner" &&
          cn("fixed inset-auto bottom-4 z-50 m-0 w-[calc(100%-2rem)] sm:max-w-sm", s.corner === "left" ? "left-4" : "right-4 left-auto"),
        layout === "bar" && "fixed inset-x-0 top-auto bottom-0 z-50 m-0 w-full max-w-none",
      )}
      style={style as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={closeColour ? { color: closeColour } : undefined}
        className={cn(
          "absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100",
          s.closeStyle !== "plain" && "bg-background/80",
        )}
      >
        <XIcon className="size-4" />
      </button>

      {layout === "bar" ? (
        <div
          style={inside}
          className={cn(
            "flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 pe-12 sm:px-8",
            align === "center" && "justify-center text-center",
            align === "right" && "justify-end text-right",
          )}
        >
          <Words popup={popup} titleId={titleId} compact />
          <Actions popup={popup} onClose={onClose} align={align} />
        </div>
      ) : (
        <div className={cn(side && "sm:grid sm:grid-cols-2")}>
          {imageRef ? (
            <Picture
              image={imageRef}
              ratio={ratio}
              sizes={side ? "(min-width: 640px) 384px, 100vw" : "(min-width: 640px) 768px, 100vw"}
              className={cn(side && "sm:h-full")}
            />
          ) : null}
          <div style={inside} className={cn("flex flex-col gap-4 p-6 sm:p-8", ALIGN[align], !imageRef && !inside && "pt-10")}>
            <Words popup={popup} titleId={titleId} />
            <Actions popup={popup} onClose={onClose} align={align} />
          </div>
        </div>
      )}
    </dialog>
  );
}

function Words({ popup, titleId, compact = false }: { popup: Popup; titleId: string; compact?: boolean }) {
  const heading = String(popup.settings.heading ?? "").trim();
  const text = String(popup.settings.text ?? "").trim();
  if (!heading && !text) return null;
  return (
    <div className={cn("space-y-2", compact && "min-w-0")}>
      {heading ? (
        <h2 id={titleId} className={compact ? "text-body font-medium" : "text-h3"}>
          {heading}
        </h2>
      ) : null}
      {text ? <p className={cn("whitespace-pre-line", compact ? "text-tertiary" : "text-secondary")}>{text}</p> : null}
    </div>
  );
}

function Actions({ popup, onClose, align }: { popup: Popup; onClose: () => void; align: Align }) {
  const button = popup.settings.button as LinkValue | null;
  const hasButton = Boolean(button?.href && button.label);
  if (!hasButton && !popup.settings.newsletter) return null;
  return (
    <div className={cn("flex w-full flex-col gap-4 sm:w-auto", align === "center" ? "items-center" : align === "right" ? "items-end" : "items-start")}>
      {popup.settings.newsletter ? <NewsletterForm inputId={`${popup.id}-email`} className="w-full max-w-[26.25rem]" /> : null}
      {hasButton ? (
        <span className="inline-flex">
          <ButtonLink href={button!.href} variant="solid" external={/^https?:\/\//i.test(button!.href)} onClick={onClose}>
            {button!.label}
          </ButtonLink>
        </span>
      ) : null}
    </div>
  );
}
