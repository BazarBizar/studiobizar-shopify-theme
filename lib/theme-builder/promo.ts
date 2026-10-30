import { z } from "zod";

import type { Device, Responsive } from "@/lib/page-builder/design";
import {
  color,
  design,
  fieldDefault,
  fieldSchema,
  HEX_COLOR,
  image,
  lenientFieldSchema,
  link,
  newBlockId,
  number,
  select,
  text,
  textarea,
  toggle,
  url,
  type LeafFieldDef,
  type LinkValue,
} from "@/lib/page-builder/fields";

/**
 * PROMOTIONS — the announcement bar above the header and the pop-ups that open over
 * a page. Both live in the theme layout (`layout.ts`), so they are drafted, previewed,
 * published and rolled back with the header and footer, in the same editor.
 *
 * Everything that depends on the visitor — the date, the page they are on, whether
 * they closed the bar or already saw a pop-up — is decided IN THE BROWSER
 * (`components/layout/announcement-bar.tsx`, `popups.tsx`): the pages are cached, so
 * a date checked on the server would be up to a cache period late, and a page would
 * have to be drawn per visitor.
 *
 * NO React and no `server-only` — the editor, the API and the storefront import it.
 * Next only for now, like the rest of the layout.
 */

export const PROMO_ID = /^b_[a-z0-9]{6,24}$/;

const hex = z.string().refine((value) => value === "" || HEX_COLOR.test(value), "Use a colour like #302f2d.");
const hide = z.strictObject({ d: z.boolean().optional(), t: z.boolean().optional(), m: z.boolean().optional() });

/** A moment as `Date.toISOString()` writes it, or "" for none. */
const moment = z
  .string()
  .max(40)
  .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "Not a date.");

export type Schedule = { startsAt: string; endsAt: string };

/** Within its dates — either end may be open. */
export function isScheduledNow(schedule: Schedule, now = Date.now()): boolean {
  const starts = schedule.startsAt ? Date.parse(schedule.startsAt) : Number.NEGATIVE_INFINITY;
  const ends = schedule.endsAt ? Date.parse(schedule.endsAt) : Number.POSITIVE_INFINITY;
  return now >= starts && now < ends;
}

/** "Ended", "Starts 3 Dec", or null when it is showing (or has no dates). For the editor's lists. */
export function scheduleNote(schedule: Schedule, now = Date.now()): string | null {
  const day = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (schedule.endsAt && Date.parse(schedule.endsAt) <= now) return "Ended";
  if (schedule.startsAt && Date.parse(schedule.startsAt) > now) return `Starts ${day(schedule.startsAt)}`;
  return null;
}

/** A short fingerprint of some text — a closed bar comes back when its messages change. */
export function fingerprint(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}

/* -------------------------------------------------------------------------- *
 * The announcement bar
 * -------------------------------------------------------------------------- */

/** `href`: where the message leads — the message itself is the link, so it has no label of its own. "" for none. */
export type AnnouncementMessage = Schedule & { id: string; text: string; href: string };

export type Announcement = {
  enabled: boolean;
  messages: AnnouncementMessage[];
  /** One message after another, or all of them moving across (a marquee). */
  mode: "rotate" | "scroll";
  /** Seconds each message stays, one at a time. */
  interval: number;
  speed: "slow" | "normal" | "fast";
  direction: "left" | "right";
  separator: "dot" | "dash" | "star" | "none";
  size: "secondary" | "tertiary" | "caption";
  /** A × that hides the bar for that visitor until the messages change. */
  dismissible: boolean;
  /** `#rrggbb`, "" for the brand's off-black / earth. */
  background: string;
  color: string;
  hide?: Partial<Record<Device, boolean>>;
};

export const MAX_MESSAGES = 8;
export const MESSAGE_MAX = 200;

export function createMessage(text = ""): AnnouncementMessage {
  return { id: newBlockId(), text, href: "", startsAt: "", endsAt: "" };
}

export function defaultAnnouncement(): Announcement {
  return {
    enabled: false,
    messages: [createMessage()],
    mode: "rotate",
    interval: 5,
    speed: "normal",
    direction: "left",
    separator: "dot",
    size: "tertiary",
    dismissible: false,
    background: "",
    color: "",
  };
}

const messageSchema = z.strictObject({
  id: z.string().regex(PROMO_ID),
  text: z.string().max(MESSAGE_MAX),
  href: fieldSchema(url("href", "Link")),
  startsAt: moment,
  endsAt: moment,
});

const announcementShape = {
  enabled: z.boolean(),
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
  mode: z.enum(["rotate", "scroll"]),
  interval: z.number().int().min(2).max(30),
  speed: z.enum(["slow", "normal", "fast"]),
  direction: z.enum(["left", "right"]),
  separator: z.enum(["dot", "dash", "star", "none"]),
  size: z.enum(["secondary", "tertiary", "caption"]),
  dismissible: z.boolean(),
  background: hex,
  color: hex,
  hide: hide.optional(),
};

export const announcementSchema = z.strictObject(announcementShape);

/**
 * A read announcement: each setting kept or defaulted on its own, damaged messages
 * dropped. The bar before it had several messages — one `text` and one `link` — is
 * read as a bar with that one message, leading where its link led.
 */
export function readAnnouncement(input: unknown): Announcement {
  const base = defaultAnnouncement();
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;

  const messages = Array.isArray(raw.messages)
    ? raw.messages.flatMap((message) => {
        const parsed = messageSchema.safeParse(message);
        return parsed.success ? [parsed.data] : [];
      })
    : typeof raw.text === "string"
      ? [
          {
            ...createMessage(raw.text.slice(0, MESSAGE_MAX)),
            href: (fieldSchema(link("link", "Link")).catch(null).parse(raw.link) as LinkValue | null)?.href ?? "",
          },
        ]
      : [];

  const out = { ...base, messages: messages.length ? messages.slice(0, MAX_MESSAGES) : base.messages } as Record<string, unknown>;
  for (const key of Object.keys(announcementShape) as (keyof typeof announcementShape)[]) {
    if (key === "messages" || key === "hide") continue;
    const parsed = announcementShape[key].safeParse(raw[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  const hidden = hide.safeParse(raw.hide);
  if (hidden.success && Object.keys(hidden.data).length) out.hide = hidden.data;
  return out as Announcement;
}

/* -------------------------------------------------------------------------- *
 * Pop-ups
 * -------------------------------------------------------------------------- */

/**
 * A pop-up's own settings, in the page builder's field vocabulary — so the editor
 * draws them with the same controls (`FieldControl`) and the write API validates
 * them with the same schemas. `group` says which fold of the editor each sits in.
 */
export const POPUP_FIELDS = [
  // What it says
  image("image", "Photograph", { group: "content" }),
  text("heading", "Heading", { max: 120, group: "content" }),
  textarea("text", "Text", { max: 600, group: "content" }),
  link("button", "Button", { group: "content", help: "Optional. Closes the pop-up and goes to the page." }),
  select(
    "buttonStyle",
    "Button style",
    [
      { value: "solid", label: "Filled" },
      { value: "outline", label: "Outlined" },
      { value: "text", label: "Underlined text" },
    ],
    { default: "solid", group: "content", display: "buttons" },
  ),
  toggle("newsletter", "Add the newsletter sign-up", { group: "content" }),

  // Shape and position (the Content tab's Layout), then the look (the Style tab, `POPUP_STYLE_FOLD`)
  select(
    "layout",
    "Shape",
    [
      { value: "center", label: "Box in the middle" },
      { value: "corner", label: "Small box in a corner" },
      { value: "bar", label: "Bar along the bottom" },
    ],
    { group: "layout" },
  ),
  select(
    "corner",
    "Corner",
    [
      { value: "right", label: "Bottom right" },
      { value: "left", label: "Bottom left" },
    ],
    { group: "layout", when: { field: "layout", is: ["corner"] }, display: "buttons" },
  ),
  select(
    "width",
    "Size",
    [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
      { value: "custom", label: "Custom" },
    ],
    { default: "medium", group: "style", when: { field: "layout", is: ["center"] }, display: "buttons" },
  ),
  select(
    "vertical",
    "Position on the screen",
    [
      { value: "top", label: "Top" },
      { value: "middle", label: "Middle" },
      { value: "bottom", label: "Bottom" },
    ],
    { default: "middle", group: "layout", when: { field: "layout", is: ["center"] }, display: "buttons" },
  ),
  select(
    "imagePosition",
    "Photograph",
    [
      { value: "top", label: "Above the text" },
      { value: "bottom", label: "Below the text" },
      { value: "side", label: "On the left" },
      { value: "right", label: "On the right" },
    ],
    { group: "layout", when: { field: "layout", is: ["center"] }, display: "buttons" },
  ),
  select(
    "imageShare",
    "Photograph's width",
    [
      { value: "third", label: "A third" },
      { value: "half", label: "Half" },
      { value: "twothirds", label: "Two thirds" },
    ],
    { default: "half", group: "layout", when: { field: "imagePosition", is: ["side", "right"] }, display: "buttons" },
  ),
  select(
    "contentAlign",
    "Text sits",
    [
      { value: "top", label: "Top" },
      { value: "middle", label: "Middle" },
      { value: "bottom", label: "Bottom" },
    ],
    { default: "top", group: "layout", when: { field: "imagePosition", is: ["side", "right"] }, display: "buttons" },
  ),
  select(
    "imageRatio",
    "Photograph's shape",
    [
      { value: "auto", label: "To suit the layout" },
      { value: "landscape", label: "Landscape" },
      { value: "square", label: "Square" },
      { value: "portrait", label: "Tall" },
      { value: "adapt", label: "As the photograph is" },
    ],
    { default: "auto", group: "style", when: { field: "layout", is: ["center", "corner"] } },
  ),
  number("imageInset", "Space around the photograph (px)", { min: 0, max: 64, default: 0, group: "style", when: { field: "layout", is: ["center", "corner"] } }),
  select(
    "align",
    "Text",
    [
      { value: "center", label: "Centred" },
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
    ],
    { group: "layout", display: "buttons" },
  ),
  color("background", "Own colour", { group: "style", help: "Empty: the site's light background." }),
  color("color", "Text colour", { group: "style" }),

  number("borderWidth", "Line around it (px)", { min: 0, max: 8, default: 0, group: "style", help: "0: no line." }),
  select(
    "borderStyle",
    "Line",
    [
      { value: "solid", label: "Solid" },
      { value: "dashed", label: "Dashed" },
      { value: "dotted", label: "Dotted" },
      { value: "double", label: "Double" },
    ],
    { default: "solid", group: "style", display: "buttons" },
  ),
  color("borderColor", "Line colour", { group: "style", help: "Empty: the text colour." }),
  select(
    "shadow",
    "Shadow",
    [
      { value: "default", label: "Default" },
      { value: "none", label: "None" },
      { value: "soft", label: "Soft" },
      { value: "medium", label: "Medium" },
      { value: "strong", label: "Strong" },
    ],
    { default: "default", group: "style", display: "buttons" },
  ),
  toggle("dim", "Darken the page behind it", { default: true, group: "style", when: { field: "layout", is: ["center"] } }),
  color("overlay", "Colour behind it", { group: "style", when: { field: "dim", is: [true] }, help: "Empty: black." }),
  number("overlayOpacity", "How dark (%)", { min: 0, max: 90, default: 50, group: "style", when: { field: "dim", is: [true] } }),
  number("blur", "Blur the page behind it (px)", { min: 0, max: 20, default: 0, group: "style", when: { field: "layout", is: ["center"] }, help: "0: sharp." }),
  select(
    "closeStyle",
    "Look",
    [
      { value: "circle", label: "On a circle" },
      { value: "plain", label: "Plain" },
    ],
    { default: "circle", group: "style", display: "buttons" },
  ),
  select(
    "closeSize",
    "Size",
    [
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
    { default: "medium", group: "style", display: "buttons" },
  ),
  color("closeColor", "Colour", { group: "style", help: "Empty: the text colour." }),
  color("closeBackground", "Circle colour", { group: "style", when: { field: "closeStyle", is: ["circle"] }, help: "Empty: the background, slightly see-through." }),
  select(
    "animation",
    "How it appears",
    [
      { value: "rise", label: "Rise and fade in" },
      { value: "fade", label: "Fade in" },
      { value: "zoom", label: "Zoom in" },
      { value: "slide", label: "Slide up from below" },
      { value: "none", label: "At once" },
    ],
    { default: "rise", group: "style" },
  ),
  select(
    "speed",
    "Speed",
    [
      { value: "slow", label: "Slow" },
      { value: "normal", label: "Normal" },
      { value: "fast", label: "Fast" },
    ],
    { default: "normal", group: "style", when: { field: "animation", is: ["rise", "fade", "zoom", "slide"] }, display: "buttons" },
  ),

  // The page builder's own design value: Typography and Buttons, and the background's
  // gradient, photo and overlay and the photographs' corners — drawn by `designStyle`.
  design("design", "Text & buttons", { parts: ["typography", "buttons", "background"], targets: ["heading", "text", "button"], group: "style" }),

  // When it opens
  select(
    "trigger",
    "Opens",
    [
      { value: "delay", label: "After a few seconds" },
      { value: "scroll", label: "After scrolling down" },
      { value: "exit", label: "When the visitor is about to leave" },
    ],
    { group: "advanced" },
  ),
  number("delay", "Seconds after the page opens", { min: 0, max: 120, default: 5, group: "advanced", when: { field: "trigger", is: ["delay"] } }),
  number("scroll", "How far down the page (%)", { min: 5, max: 100, default: 40, group: "advanced", when: { field: "trigger", is: ["scroll"] } }),
  select(
    "frequency",
    "How often",
    [
      { value: "session", label: "Once per visit" },
      { value: "days", label: "Once every few days" },
      { value: "once", label: "Only once, ever" },
      { value: "always", label: "Every time a page opens" },
    ],
    { group: "advanced" },
  ),
  number("days", "Days before it shows again", { min: 1, max: 365, default: 7, group: "advanced", when: { field: "frequency", is: ["days"] } }),
] as const satisfies readonly LeafFieldDef[];

/**
 * The folds of the editor's Style tab — as a section's Style tab: Background, Spacing,
 * Border & shadow, then the pop-up's own, then Images and Size — and the look's
 * settings each holds. Shape and position are the Content tab's Layout, as a section's
 * layout settings are. The per-device values (`PopupBox`) and the design value's parts
 * are placed in the folds by the editor itself.
 */
export const POPUP_STYLE_FOLDS = ["background", "spacing", "border", "behind", "close", "animation", "images", "size"] as const;
export type PopupStyleFold = (typeof POPUP_STYLE_FOLDS)[number];

export const POPUP_STYLE_FOLD: Record<string, PopupStyleFold> = {
  width: "size",
  imageRatio: "images",
  imageInset: "images",
  background: "background",
  color: "background",
  borderWidth: "border",
  borderStyle: "border",
  borderColor: "border",
  shadow: "border",
  dim: "behind",
  overlay: "behind",
  overlayOpacity: "behind",
  blur: "behind",
  closeStyle: "close",
  closeSize: "close",
  closeColor: "close",
  closeBackground: "close",
  animation: "animation",
  speed: "animation",
};

/* ---- the values that can differ per device ---- */

export type PopupSides = { top?: number; right?: number; bottom?: number; left?: number };

/**
 * A pop-up's sizes per device — desktop, tablet, mobile, each optional and following
 * the larger screen when empty, as a section's design does. Sparse: `{}` changes
 * nothing, and an unset value is the pop-up's own.
 */
export type PopupBox = {
  /** px. The box in the middle with Size "Custom", and the corner box. */
  width?: Responsive<number>;
  /** Space inside, around the words and buttons (the photograph runs to the edge). */
  padding?: Responsive<PopupSides>;
  /** px from the screen's edges it sits against. */
  offset?: Responsive<number>;
  /** px between the heading, the text and the buttons. */
  gap?: Responsive<number>;
  /** Rounded corners, px. */
  radius?: Responsive<number>;
};

export const POPUP_SIDES = ["top", "right", "bottom", "left"] as const;

export const POPUP_LIMITS = {
  width: { min: 240, max: 1200 },
  padding: { min: 0, max: 200 },
  offset: { min: 0, max: 120 },
  gap: { min: 0, max: 96 },
  radius: { min: 0, max: 48 },
} as const;

const responsive = <T extends z.ZodType>(inner: T) =>
  z.strictObject({ d: inner.optional(), t: inner.optional(), m: inner.optional() });
const px = ({ min, max }: { min: number; max: number }) => z.number().int().min(min).max(max);
const sidesSchema = z.strictObject(
  Object.fromEntries(POPUP_SIDES.map((side) => [side, px(POPUP_LIMITS.padding).optional()])) as Record<
    (typeof POPUP_SIDES)[number],
    z.ZodOptional<z.ZodNumber>
  >,
);

const boxShape = {
  width: responsive(px(POPUP_LIMITS.width)).optional(),
  padding: responsive(sidesSchema).optional(),
  offset: responsive(px(POPUP_LIMITS.offset)).optional(),
  gap: responsive(px(POPUP_LIMITS.gap)).optional(),
  radius: responsive(px(POPUP_LIMITS.radius)).optional(),
};

export const popupBoxSchema = z.strictObject(boxShape);

/** Each value kept or dropped on its own. */
function readBox(input: unknown): PopupBox {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(boxShape) as (keyof typeof boxShape)[]) {
    const parsed = boxShape[key].safeParse((input as Record<string, unknown>)[key]);
    if (parsed.success && parsed.data && Object.keys(parsed.data).length) out[key] = parsed.data;
  }
  return out as PopupBox;
}

/**
 * The single values a pop-up had before they could differ per device — one space
 * inside, one corner, one custom width — read as desktop's, which the smaller screens
 * follow. So a pop-up made then looks as it did.
 */
function boxFromBefore(settings: Record<string, unknown>, box: PopupBox): PopupBox {
  const out = { ...box };
  const n = (value: unknown, { min, max }: { min: number; max: number }) =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
  const padding = n(settings.padding, POPUP_LIMITS.padding);
  if (!out.padding && padding !== undefined && padding !== 32) out.padding = { d: { top: padding, right: padding, bottom: padding, left: padding } };
  const radius = n(settings.radius, POPUP_LIMITS.radius);
  if (!out.radius && radius) out.radius = { d: radius };
  const width = n(settings.customWidth, POPUP_LIMITS.width);
  if (!out.width && width !== undefined && settings.width === "custom") out.width = { d: width };
  return out;
}

type Layout = "center" | "corner" | "bar";
type FullSides = Record<(typeof POPUP_SIDES)[number], number>;

/**
 * What a pop-up has where nothing is set, per device — as `popups.tsx` draws it. On a
 * phone the top keeps clear of the close button when no photograph is above the words.
 */
export function popupDefaults(layout: Layout, photoAbove: boolean) {
  const padding: Record<Device, FullSides> =
    layout === "bar"
      ? {
          d: { top: 16, right: 48, bottom: 16, left: 32 },
          t: { top: 16, right: 48, bottom: 16, left: 32 },
          m: { top: 16, right: 48, bottom: 16, left: 16 },
        }
      : {
          d: { top: 32, right: 32, bottom: 32, left: 32 },
          t: { top: 32, right: 32, bottom: 32, left: 32 },
          m: { top: photoAbove ? 24 : 40, right: 24, bottom: 24, left: 24 },
        };
  return { padding, offset: layout === "bar" ? 0 : 16, gap: 16, radius: 0, width: layout === "corner" ? 384 : 520 };
}

const LARGER: Record<Device, Device[]> = { d: [], t: ["d"], m: ["t", "d"] };

/** A value on a device: its own, else the next larger screen's, else the default. */
export function onDevice<T>(value: Responsive<T> | undefined, device: Device): T | undefined {
  for (const each of [device, ...LARGER[device]]) if (value?.[each] !== undefined) return value[each];
  return undefined;
}

/** The space inside on a device, side by side: own, larger screen's, default. */
export function paddingOn(box: PopupBox | undefined, device: Device, defaults: Record<Device, FullSides>): FullSides {
  return Object.fromEntries(
    POPUP_SIDES.map((side) => {
      for (const each of [device, ...LARGER[device]]) {
        const value = box?.padding?.[each]?.[side];
        if (value !== undefined) return [side, value];
      }
      return [side, defaults[device][side]];
    }),
  ) as FullSides;
}

export type PopupPages = {
  /** Every page, the home page only, only the listed pages, or every page but those. */
  mode: "all" | "home" | "only" | "except";
  /** Site paths, `/our-story`. A path ending in `/*` covers everything under it. */
  paths: string[];
};

export type Popup = Schedule & {
  id: string;
  /** For the editor's list only — visitors never see it. */
  name: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  /** The sizes that can differ per device. Absent: the pop-up's own. */
  box?: PopupBox;
  pages: PopupPages;
  hide?: Partial<Record<Device, boolean>>;
};

export const MAX_POPUPS = 10;
export const MAX_POPUP_PATHS = 30;

export function createPopup(name: string, settings: Record<string, unknown> = {}): Popup {
  const fields = POPUP_FIELDS as readonly LeafFieldDef[];
  return {
    id: newBlockId(),
    name,
    enabled: true,
    settings: { ...Object.fromEntries(fields.map((field) => [field.key, fieldDefault(field)])), ...settings },
    pages: { mode: "all", paths: [] },
    startsAt: "",
    endsAt: "",
  };
}

const PATH = /^\/[^\s?#]*$/;

const pagesSchema = z.strictObject({
  mode: z.enum(["all", "home", "only", "except"]),
  paths: z.array(z.string().max(512).regex(PATH, "Use a path like /our-story.")).max(MAX_POPUP_PATHS),
});

const popupSchema = z.strictObject({
  id: z.string().regex(PROMO_ID),
  name: z.string().max(60),
  enabled: z.boolean(),
  settings: z.strictObject(
    Object.fromEntries((POPUP_FIELDS as readonly LeafFieldDef[]).map((field) => [field.key, fieldSchema(field)])),
  ),
  box: popupBoxSchema.optional(),
  pages: pagesSchema,
  startsAt: moment,
  endsAt: moment,
  hide: hide.optional(),
});

export const popupsSchema = z
  .array(popupSchema)
  .max(MAX_POPUPS)
  .superRefine((popups, context) => {
    const seen = new Set<string>();
    popups.forEach((popup, index) => {
      if (seen.has(popup.id)) context.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate pop-up id." });
      seen.add(popup.id);
    });
  });

/** Read pop-ups: a damaged one dropped, a damaged setting back to its default alone. */
export function readPopups(input: unknown): Popup[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const fields = POPUP_FIELDS as readonly LeafFieldDef[];
  return input
    .flatMap((candidate): Popup[] => {
      const raw = (candidate && typeof candidate === "object" ? candidate : {}) as Record<string, unknown>;
      if (typeof raw.id !== "string" || !PROMO_ID.test(raw.id) || seen.has(raw.id)) return [];
      seen.add(raw.id);
      const settings = (raw.settings && typeof raw.settings === "object" ? raw.settings : {}) as Record<string, unknown>;
      const pages = pagesSchema.safeParse(raw.pages);
      const hidden = hide.safeParse(raw.hide);
      const box = boxFromBefore(settings, readBox(raw.box));
      return [
        {
          id: raw.id,
          name: z.string().max(60).catch("").parse(raw.name),
          enabled: z.boolean().catch(false).parse(raw.enabled),
          settings: Object.fromEntries(fields.map((field) => [field.key, lenientFieldSchema(field).parse(settings[field.key])])),
          pages: pages.success ? pages.data : { mode: "all", paths: [] },
          startsAt: moment.catch("").parse(raw.startsAt),
          endsAt: moment.catch("").parse(raw.endsAt),
          ...(hidden.success && Object.keys(hidden.data).length ? { hide: hidden.data } : {}),
          ...(Object.keys(box).length ? { box } : {}),
        },
      ];
    })
    .slice(0, MAX_POPUPS);
}

/** A path as the browser reports it, without a trailing slash (the home page stays `/`). */
export function normalisePath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** Whether a pop-up is meant for this page. */
export function popupOnPath(pages: PopupPages, pathname: string): boolean {
  const path = normalisePath(pathname);
  const listed = pages.paths.some((entry) =>
    entry.endsWith("/*") ? path === entry.slice(0, -2) || path.startsWith(entry.slice(0, -1)) : path === normalisePath(entry),
  );
  switch (pages.mode) {
    case "all":
      return true;
    case "home":
      return path === "/";
    case "only":
      return listed;
    case "except":
      return !listed;
  }
}

/** Has something to show: words, a photograph, a button or the sign-up. */
export function popupHasContent(popup: Popup): boolean {
  const s = popup.settings;
  return Boolean(
    String(s.heading ?? "").trim() || String(s.text ?? "").trim() || s.image || (s.button as LinkValue | null)?.href || s.newsletter,
  );
}
