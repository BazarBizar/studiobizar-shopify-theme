"use client";

import { EyeIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import * as React from "react";

import { NewsletterForm } from "@/components/layout/newsletter-form";
import { PREVIEW_MESSAGE } from "@/components/page-builder/preview-bridge";
import { CustomBlocks } from "@/components/sections/landing/custom-section";
import { Picture } from "@/components/sections/landing/shared";
import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { designStyle, DEVICES, SHADOWS, type DesignValue, type Device, type Responsive, type ShadowId } from "@/lib/page-builder/design-style";
import { HEX_COLOR, type BlockValue, type ImageRef, type LinkValue } from "@/lib/page-builder/fields";
import { isBuilt, isScheduledNow, onDevice, paddingOn, popupDefaults, popupOnPath, POPUP_SIDES, type Popup } from "@/lib/theme-builder/promo";
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
  // The preview's: the pop-up being designed, closed here — offered back with a button.
  // Set only in the preview: only there does the editor name a pop-up (`previewId`).
  const [closedId, setClosedId] = React.useState<string | null>(null);

  /** Tells the editor, so it can offer "Show it again" too. */
  const tellEditor = (id: string | null) => {
    if (window.parent !== window) window.parent.postMessage({ type: PREVIEW_MESSAGE.popupClosed, id }, window.location.origin);
  };

  /* ---- the editor's preview: the named pop-up, at once ---- */
  React.useEffect(() => {
    if (!window.location.pathname.startsWith("/preview")) return;
    const fromHash = () => {
      const id = window.location.hash.startsWith(PREVIEW_HASH) ? window.location.hash.slice(PREVIEW_HASH.length) : "";
      setPreviewId(id || null);
      setClosedId(null);
      tellEditor(null);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: unknown; id?: unknown } | null;
      if (data?.type === PREVIEW_MESSAGE.popup) {
        setPreviewId(typeof data.id === "string" && data.id ? data.id : null);
        setClosedId(null);
      }
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
  const closed = closedId ? (popups.find((popup) => popup.id === closedId) ?? null) : null;

  if (shown) {
    return (
      <PopupView
        key={shown.id}
        popup={shown}
        preview={previewId !== null}
        onClose={() => {
          setOpen(null);
          if (previewId) {
            setClosedId(previewId);
            tellEditor(previewId);
          }
          setPreviewId(null);
        }}
      />
    );
  }

  // The preview only: the pop-up being designed was closed — one click brings it back.
  return closed ? (
    <button
      type="button"
      onClick={() => {
        setPreviewId(closed.id);
        setClosedId(null);
        tellEditor(null);
      }}
      className="fixed bottom-6 left-1/2 z-[2147483000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#302f2d] px-7 py-4 text-lg font-medium text-white shadow-xl transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
    >
      <EyeIcon className="size-5" />
      <span>
        Pop-up “{closed.name || "Pop-up"}” closed — <span className="underline underline-offset-2">show it again</span>
      </span>
    </button>
  ) : null;
}

/* -------------------------------------------------------------------------- *
 * One pop-up
 * -------------------------------------------------------------------------- */

const WIDTH = { small: "sm:max-w-sm", medium: "sm:max-w-lg", large: "sm:max-w-3xl" } as const;
/** The same three sizes in px — what padding at the sides is added to. */
const PRESET_WIDTH = { small: 384, medium: 512, large: 768 } as const;
/** The words' share of the box beside a photograph (`SHARE`). */
const WORDS_SHARE = { third: 2 / 3, half: 1 / 2, twothirds: 1 / 3 } as const;
const ANIMATION = { rise: "sb-popup-in", fade: "sb-popup-fade", zoom: "sb-popup-zoom", slide: "sb-popup-slide", none: "" } as const;
const SPEED: Record<string, string | undefined> = { slow: "0.7s", fast: "0.18s" };
const ALIGN = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" } as const;
type Align = keyof typeof ALIGN;
const SITS = { top: "", middle: "justify-center", bottom: "justify-end" } as const;
const CLOSE = { small: ["size-7", "size-3.5"], medium: ["size-8", "size-4"], large: ["size-10", "size-5"] } as const;
const BORDER_STYLES = new Set(["solid", "dashed", "dotted", "double"]);
const BUTTON_STYLES = new Set<ButtonVariant>(["solid", "outline", "text"]);
/** The photograph's column and the words', photo first; on the right the order turns. */
const SHARE = {
  third: { left: "sm:grid-cols-[1fr_2fr]", right: "sm:grid-cols-[2fr_1fr]" },
  half: { left: "sm:grid-cols-2", right: "sm:grid-cols-2" },
  twothirds: { left: "sm:grid-cols-[2fr_1fr]", right: "sm:grid-cols-[1fr_2fr]" },
} as const;

const hex = (value: unknown) => (typeof value === "string" && HEX_COLOR.test(value) ? value : undefined);
const between = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : undefined;

function rgba(colour: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(colour.slice(at, at + 2), 16));
  return `rgb(${r} ${g} ${b} / ${alpha.toFixed(2)})`;
}

function PopupView({ popup, onClose, preview = false }: { popup: Popup; onClose: () => void; preview?: boolean }) {
  // While it is being designed, only its × and Escape close it: a click around it or on
  // its button (which goes nowhere in the preview) would close it by accident.
  const closeByUse = preview ? () => {} : onClose;
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

  const built = isBuilt(s);
  const imageRef = built ? null : ((s.image as ImageRef | null) ?? null);
  const placed = layout === "center" ? String(s.imagePosition ?? "top") : "top";
  const side = Boolean(imageRef) && (placed === "side" || placed === "right");
  const below = Boolean(imageRef) && layout === "center" && placed === "bottom";
  const align: Align = s.align === "left" || s.align === "right" ? s.align : "center";
  const ratio = s.imageRatio === "landscape" || s.imageRatio === "square" || s.imageRatio === "portrait" || s.imageRatio === "adapt"
    ? s.imageRatio
    : side
      ? "portrait"
      : "landscape";

  // Every value was checked when it was saved; it is checked again here, as everywhere
  // a stored value becomes CSS.
  const background = hex(s.background);
  const text = hex(s.color);
  // The headings, text, buttons and background: the page builder's design rules (sb-design.css).
  const inner = designStyle((s.design as DesignValue | undefined) ?? undefined);
  const style: Record<string, string> = { ...inner.style };
  // As a section's own colours do (`frameStyle`): the tokens are rebound, so the muted
  // text, the lines and the filled button inside follow without knowing.
  if (background) {
    style.backgroundColor = background;
    style["--sb-background"] = background;
    style["--sb-surface"] = background;
  }
  if (text) {
    style.color = text;
    style["--sb-foreground"] = text;
    style["--sb-muted"] = `color-mix(in srgb, ${text} 60%, transparent)`;
    style["--sb-border"] = `color-mix(in srgb, ${text} 26%, transparent)`;
    style["--sb-primary"] = text;
    style["--sb-primary-foreground"] = background ?? "var(--sb-background)";
  }

  // The sizes per device, each device's written out in full (globals.css, "Pop-ups").
  const box = popup.box;
  // The words keep clear of the close button when no photograph is above them (on a
  // phone the photograph on the left stands above them, so there only on the right).
  const closeRoom = !imageRef || below || placed === "side";
  const defaults = popupDefaults(layout, !closeRoom);
  const perDevice: string[] = [];
  const write = (name: string, value: (device: Device) => string) => {
    for (const device of DEVICES) style[`--sb-pop-${name}-${device}`] = value(device);
    perDevice.push(name);
  };
  const sized = (name: string, input: Responsive<number> | undefined, fallback: number, min: number, max: number) => {
    if (input) write(name, (device) => `${between(onDevice(input, device), min, max) ?? fallback}px`);
  };
  const customWidth = layout === "center" && s.width === "custom";
  // Space inside ADDS to the width, as it does around a section's content: more at the
  // sides makes the box wider rather than the words narrower. The width is the box at
  // its own padding; each px more (or less) at the left and right is added (or taken).
  // The screen still caps it (globals.css), so on a phone the words do give way.
  const baseWidth = (device: Device) =>
    customWidth || layout === "corner"
      ? (between(onDevice(box?.width, device), 240, 1200) ?? defaults.width)
      : (PRESET_WIDTH[(s.width as keyof typeof PRESET_WIDTH) ?? "medium"] ?? PRESET_WIDTH.medium);
  const extraWidth = (device: Device) => {
    if (!box?.padding) return 0;
    const sides = paddingOn(box, device, defaults.padding);
    const own = defaults.padding[device];
    const extra = (between(sides.left, 0, 200) ?? own.left) - own.left + (between(sides.right, 0, 200) ?? own.right) - own.right;
    // Beside a photograph the words have only their share of the box (phones stack them),
    // so the box grows by as much as keeps their column as wide as before.
    return side && device !== "m" ? Math.round(extra / WORDS_SHARE[(s.imageShare as keyof typeof WORDS_SHARE) ?? "half"]) : extra;
  };
  const grows = layout !== "bar" && DEVICES.some((device) => extraWidth(device) !== 0);
  if (customWidth || (layout === "corner" && box?.width) || grows) {
    write("w", (device) => `${Math.max(240, baseWidth(device) + extraWidth(device))}px`);
  }
  if (box?.padding) {
    write("pad", (device) => {
      const sides = paddingOn(box, device, defaults.padding);
      return POPUP_SIDES.map((each) => `${between(sides[each], 0, 200) ?? 0}px`).join(" ");
    });
  }
  sized("off", box?.offset, defaults.offset, 0, 120);
  sized("gap", box?.gap, defaults.gap, 0, 96);
  sized("r", box?.radius, defaults.radius, 0, 48);

  if (layout === "center" && s.vertical === "top") Object.assign(style, { marginTop: "var(--sb-pop-off, 1rem)", marginBottom: "auto" });
  if (layout === "center" && s.vertical === "bottom") Object.assign(style, { marginTop: "auto", marginBottom: "var(--sb-pop-off, 1rem)" });

  const line = between(s.borderWidth, 0, 8);
  const lineStyle = BORDER_STYLES.has(String(s.borderStyle)) ? String(s.borderStyle) : "solid";
  // A double line needs room for two lines and the gap between them.
  if (line) style.border = `${lineStyle === "double" ? Math.max(3, line) : line}px ${lineStyle} ${hex(s.borderColor) ?? "currentColor"}`;
  const shadow = String(s.shadow ?? "default");
  if (shadow in SHADOWS) style.boxShadow = SHADOWS[shadow as ShadowId].css;
  // Read by the backdrop, which takes its custom properties from the dialog.
  const darkness = between(s.overlayOpacity, 0, 90) ?? 50;
  style["--sb-popup-backdrop"] = rgba(hex(s.overlay) ?? "#000000", darkness / 100);
  const blur = layout === "center" ? between(s.blur, 0, 20) : undefined;
  if (blur) style["--sb-popup-blur"] = `${blur}px`;
  const speed = SPEED[String(s.speed)];
  if (speed) style.animationDuration = speed;

  const inset = layout !== "bar" ? between(s.imageInset, 0, 64) : undefined;
  const closeColour = hex(s.closeColor);
  const closeGround = s.closeStyle !== "plain" ? hex(s.closeBackground) : undefined;
  const [closeBox, closeIcon] = CLOSE[(s.closeSize as keyof typeof CLOSE) ?? "medium"] ?? CLOSE.medium;
  const share = SHARE[(s.imageShare as keyof typeof SHARE) ?? "half"] ?? SHARE.half;
  const sits = SITS[(s.contentAlign as keyof typeof SITS) ?? "top"] ?? "";

  const photo = imageRef ? (
    <div className={cn(side && "sm:h-full", placed === "right" && "sm:order-last")} style={inset ? { padding: `${inset}px` } : undefined}>
      <Picture
        image={imageRef}
        ratio={ratio}
        sizes={side ? "(min-width: 640px) 384px, 100vw" : "(min-width: 640px) 768px, 100vw"}
        className={cn(side && "sm:h-full")}
      />
    </div>
  ) : null;

  const blocks = built && Array.isArray(s.blocks) ? (s.blocks as BlockValue[]) : [];
  // Built from blocks, the first heading names the dialog for a screen reader.
  const firstHeading = blocks.find((item) => item.type === "heading" && String(item.settings.title ?? "").trim());
  const label = built ? String(firstHeading?.settings.title ?? "").trim() || "Announcement" : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={!built && s.heading ? titleId : undefined}
      aria-label={built ? label : s.heading ? undefined : "Announcement"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the dimmed page around the box (the dialog itself, not its content) closes it.
      onClick={(event) => layout === "center" && event.target === event.currentTarget && closeByUse()}
      data-surface="light"
      {...inner.attrs}
      data-sb-pop={perDevice.length ? perDevice.join(" ") : undefined}
      data-sb-pop-blur={blur ? "" : undefined}
      className={cn(
        "bg-background text-foreground max-h-[calc(100svh-2rem)] overflow-y-auto p-0",
        shadow === "default" && "shadow-xl",
        ANIMATION[(s.animation as keyof typeof ANIMATION) ?? "rise"] ?? ANIMATION.rise,
        layout === "center" &&
          cn("fixed inset-0 m-auto w-[calc(100%-2*var(--sb-pop-off,1rem))]", !customWidth && WIDTH[(s.width as keyof typeof WIDTH) ?? "medium"]),
        layout === "center" && (s.dim === false ? "backdrop:bg-transparent" : "backdrop:bg-[var(--sb-popup-backdrop,rgb(0_0_0/0.5))]"),
        layout === "corner" &&
          cn(
            "fixed inset-auto bottom-[var(--sb-pop-off,1rem)] z-50 m-0 w-[calc(100%-2*var(--sb-pop-off,1rem))] sm:max-w-sm",
            s.corner === "left" ? "left-[var(--sb-pop-off,1rem)]" : "right-[var(--sb-pop-off,1rem)] left-auto",
          ),
        layout === "bar" &&
          "fixed top-auto right-auto bottom-[var(--sb-pop-off,0px)] left-[var(--sb-pop-off,0px)] z-50 m-0 w-[calc(100%-2*var(--sb-pop-off,0px))] max-w-none",
      )}
      style={style as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={closeColour || closeGround ? { color: closeColour, backgroundColor: closeGround } : undefined}
        className={cn(
          "absolute top-2 right-2 z-10 flex items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100",
          closeBox,
          s.closeStyle !== "plain" && !closeGround && "bg-background/80",
        )}
      >
        <XIcon className={closeIcon} />
      </button>

      {built ? (
        <div
          data-sb-pop-body=""
          // A link followed from inside closes it, as the ready-made button does.
          onClick={(event) => (event.target as HTMLElement).closest("a[href]") && closeByUse()}
          className={cn(layout === "bar" ? "px-4 py-4 pe-12 sm:px-8" : cn("p-6 sm:p-8", closeRoom && "pt-10"))}
        >
          <CustomBlocks
            blocks={blocks}
            align={align}
            columnGap={typeof s.columnGap === "string" ? s.columnGap : undefined}
            extra={(item) =>
              item.type === "newsletter" ? (
                <div className="sb-bk-row">
                  <NewsletterForm inputId={`${popup.id}-${item.id}-email`} className="w-full max-w-[26.25rem]" />
                </div>
              ) : null
            }
          />
        </div>
      ) : layout === "bar" ? (
        <div
          data-sb-pop-body=""
          className={cn(
            "flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 pe-12 sm:px-8",
            align === "center" && "justify-center text-center",
            align === "right" && "justify-end text-right",
          )}
        >
          <Words popup={popup} titleId={titleId} compact />
          <Actions popup={popup} onClose={closeByUse} align={align} />
        </div>
      ) : (
        <div className={cn(side && cn("sm:grid", share[placed === "right" ? "right" : "left"]))}>
          {below ? null : photo}
          <div data-sb-pop-body="" className={cn("flex flex-col gap-4 p-6 sm:p-8", ALIGN[align], side && sits, closeRoom && "pt-10")}>
            <Words popup={popup} titleId={titleId} />
            <Actions popup={popup} onClose={closeByUse} align={align} />
          </div>
          {below ? photo : null}
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
    <div data-sb-pop-words="" className={cn("flex flex-col gap-2", compact && "min-w-0")}>
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
  const variant = BUTTON_STYLES.has(popup.settings.buttonStyle as ButtonVariant) ? (popup.settings.buttonStyle as ButtonVariant) : "solid";
  if (!hasButton && !popup.settings.newsletter) return null;
  return (
    <div className={cn("flex w-full flex-col gap-4 sm:w-auto", align === "center" ? "items-center" : align === "right" ? "items-end" : "items-start")}>
      {popup.settings.newsletter ? <NewsletterForm inputId={`${popup.id}-email`} className="w-full max-w-[26.25rem]" /> : null}
      {hasButton ? (
        <span className="inline-flex">
          <ButtonLink href={button!.href} variant={variant} external={/^https?:\/\//i.test(button!.href)} onClick={onClose}>
            {button!.label}
          </ButtonLink>
        </span>
      ) : null}
    </div>
  );
}
