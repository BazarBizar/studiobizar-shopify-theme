import { HEX_COLOR, type ImageRef } from "./value-types";

/**
 * THE DESIGN VALUE — the advanced look of one thing on the page: a section, a slide,
 * later a header or footer element. One shape, one editor (`DesignControls`), one
 * conversion to CSS (`designStyle`), so every place that offers "design" offers the
 * same controls and they mean the same thing.
 *
 * SPARSE BY DESIGN. Every key is optional and an empty object changes nothing, so a
 * page made before this existed looks exactly as it did, and a reset is deleting a
 * key. Unset always means "the brand's own value" — the design system stays the
 * default, and a custom value is an explicit choice on top of it.
 *
 * RESPONSIVE values are `{ d, t, m }` — desktop, tablet, mobile — each optional.
 * Desktop applies everywhere; tablet overrides it below 1024px; mobile overrides
 * both below 750px (the design's own breakpoint). That is Elementor's inheritance:
 * set a size once, change it only where a smaller screen needs it.
 *
 * THIS MODULE has no zod: the shapes, the font list and `designStyle` — what a
 * storefront client component (the slideshow) imports, so no validation code reaches
 * a visitor's browser. The schemas are in `design.ts`, which re-exports all of this.
 *
 * NO React and no `server-only`: the editor, the write API and the storefront all
 * import this. Values land in a style attribute, so every one is validated to a
 * narrow shape here — a colour is `#rrggbb`, a size a bounded number, a font one of
 * the list — and nothing typed ever reaches CSS as free text.
 *
 * LIQUID: not rendered by the theme yet (Next first, by decision). The value is plain
 * JSON in the same document, so the theme can read it when it catches up.
 */

/* -------------------------------------------------------------------------- *
 * Devices
 * -------------------------------------------------------------------------- */

export const DEVICES = ["d", "t", "m"] as const;
export type Device = (typeof DEVICES)[number];

export const DEVICE_LABELS: Record<Device, string> = { d: "Desktop", t: "Tablet", m: "Mobile" };

/** Tablet starts below this width, mobile below 750px — `globals.css` uses the same two. */
export const TABLET_MAX = 1023;
export const MOBILE_MAX = 749;

export type Responsive<T> = Partial<Record<Device, T>>;

/** The value that applies on a device, following desktop → tablet → mobile inheritance. */
export function resolveResponsive<T>(value: Responsive<T> | undefined, device: Device): T | undefined {
  if (!value) return undefined;
  if (device === "m") return value.m ?? value.t ?? value.d;
  if (device === "t") return value.t ?? value.d;
  return value.d;
}

/** Where the value a device shows comes from — for the editor's "inherited from Desktop". */
export function inheritedFrom<T>(value: Responsive<T> | undefined, device: Device): Device | null {
  if (!value || device === "d") return null;
  if (value[device] !== undefined) return null;
  if (device === "m" && value.t !== undefined) return "t";
  return value.d !== undefined ? "d" : null;
}

/* -------------------------------------------------------------------------- *
 * Fonts — the curated list, self-hosted (Fontsource), downloaded only when used
 * -------------------------------------------------------------------------- */

export const FONTS = [
  { id: "inter", label: "Inter", family: "'Inter Variable'", style: "Sans" },
  { id: "dm-sans", label: "DM Sans", family: "'DM Sans Variable'", style: "Sans" },
  { id: "manrope", label: "Manrope", family: "'Manrope Variable'", style: "Sans" },
  { id: "work-sans", label: "Work Sans", family: "'Work Sans Variable'", style: "Sans" },
  { id: "space-grotesk", label: "Space Grotesk", family: "'Space Grotesk Variable'", style: "Sans" },
  { id: "syne", label: "Syne", family: "'Syne Variable'", style: "Display" },
  { id: "playfair-display", label: "Playfair Display", family: "'Playfair Display Variable'", style: "Serif" },
  { id: "cormorant-garamond", label: "Cormorant Garamond", family: "'Cormorant Garamond Variable'", style: "Serif" },
  { id: "fraunces", label: "Fraunces", family: "'Fraunces Variable'", style: "Serif" },
  { id: "eb-garamond", label: "EB Garamond", family: "'EB Garamond Variable'", style: "Serif" },
] as const;

export type FontId = (typeof FONTS)[number]["id"];

/** The CSS stack for a font, falling back to the brand's own. */
export function fontStack(id: FontId): string {
  const font = FONTS.find((candidate) => candidate.id === id);
  const fallback = font?.style === "Serif" ? "Georgia, serif" : "var(--font-body)";
  return font ? `${font.family}, ${fallback}` : "var(--font-body)";
}

export const FONT_WEIGHTS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra bold" },
] as const;

export const TEXT_TRANSFORMS = [
  { value: "none", label: "As typed" },
  { value: "uppercase", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
  { value: "capitalize", label: "Each Word" },
] as const;

export const ALIGNMENTS = ["left", "center", "right"] as const;

/** Brand-feeling presets beside "Custom": the shadow a card in this design would have. */
export const SHADOWS = {
  none: { label: "None", css: "none" },
  soft: { label: "Soft", css: "0 1px 3px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.06)" },
  medium: { label: "Medium", css: "0 4px 10px rgb(0 0 0 / 0.1), 0 12px 32px rgb(0 0 0 / 0.1)" },
  strong: { label: "Strong", css: "0 10px 24px rgb(0 0 0 / 0.16), 0 24px 64px rgb(0 0 0 / 0.18)" },
} as const;

export type ShadowId = keyof typeof SHADOWS;

/** Image shapes, as CSS aspect ratios. */
export const IMAGE_RATIOS = {
  square: { label: "Square", css: "1 / 1" },
  portrait: { label: "Tall", css: "4 / 5" },
  landscape: { label: "Landscape", css: "3 / 2" },
  wide: { label: "Wide", css: "16 / 9" },
} as const;

export type ImageRatio = keyof typeof IMAGE_RATIOS;

/* -------------------------------------------------------------------------- *
 * Shape
 * -------------------------------------------------------------------------- */

export type TypeStyle = {
  font?: FontId;
  /** px */
  size?: Responsive<number>;
  weight?: number;
  /** A multiple of the size: 1.2 */
  lineHeight?: Responsive<number>;
  /** px, may be negative */
  letterSpacing?: Responsive<number>;
  color?: string;
  transform?: (typeof TEXT_TRANSFORMS)[number]["value"];
};

/**
 * How the buttons inside look: their colours (and under the pointer), line, corners,
 * and the space in and around them. Filled and outlined buttons take all of it; a
 * text link (`learn more`) only its colours.
 */
export type ButtonLook = {
  background?: string;
  color?: string;
  borderColor?: string;
  /** px; 0 removes the line. */
  borderWidth?: number;
  /** px */
  radius?: number;
  hoverBackground?: string;
  hoverColor?: string;
  hoverBorderColor?: string;
  /** Space inside, left and right, px. */
  padX?: Responsive<number>;
  /** Space inside, top and bottom, px. */
  padY?: Responsive<number>;
  /** Space above the buttons, px — instead of the design's own. */
  spaceAbove?: Responsive<number>;
  /** Space between buttons side by side, px. */
  gap?: Responsive<number>;
};

/** The space a section keeps, per device, when Custom spacing is on: px. */
export type SpaceBox = { pt?: number; pb?: number; mt?: number; mb?: number };

export type DesignValue = {
  /** Headings inside: h1–h6. */
  heading?: TypeStyle;
  /** Running text inside: paragraphs and list items. */
  text?: TypeStyle;
  /** The site's buttons inside — font, size, weight, letter spacing, case. */
  button?: TypeStyle;
  /** The buttons' colours, line, corners and spacing — see `ButtonLook`. */
  buttonLook?: ButtonLook;
  align?: Responsive<(typeof ALIGNMENTS)[number]>;
  /** Tablet and mobile overrides of the Style tab's Custom spacing. */
  spacing?: { t?: SpaceBox; m?: SpaceBox };
  /**
   * Space at the sides, px, per device — with Custom spacing on, as the top and bottom
   * are. Inside replaces the content column's gutter; outside narrows the section.
   * Unset: the design's own gutter, and no space outside.
   */
  sides?: {
    padLeft?: Responsive<number>;
    padRight?: Responsive<number>;
    marginLeft?: Responsive<number>;
    marginRight?: Responsive<number>;
  };
  background?: {
    image?: ImageRef | null;
    /** A different crop for phones. */
    mobileImage?: ImageRef | null;
    position?: "center" | "top" | "bottom";
    /** A colour over the image, for legible text. */
    overlay?: string;
    /** 0–90 % */
    overlayOpacity?: number;
    /** A two-colour gradient — behind the image when there is one, or the whole ground. */
    gradient?: { from: string; to: string; angle: number };
  };
  shadow?: ShadowId;
  /** Rounded corners on tablet and on mobile, px — the Style tab's own is desktop's. */
  radius?: { t?: number; m?: number };
  /** The photographs inside the section. */
  images?: {
    ratio?: ImageRatio;
    /** px */
    radius?: number;
    /** A slow zoom when the pointer is over a photograph. */
    zoom?: boolean;
  };
  /** 10–100 % */
  opacity?: number;
  /** The content's width, px. */
  maxWidth?: Responsive<number>;
  /** px */
  minHeight?: Responsive<number>;
  /** Where the content sits when the section is taller than it. */
  verticalAlign?: "top" | "center" | "bottom";
  /** Hidden on these devices. */
  hide?: Partial<Record<Device, boolean>>;
};

/* -------------------------------------------------------------------------- *
 * Editing helpers
 * -------------------------------------------------------------------------- */

type Path = readonly (string | number)[];

/** The value at a path, e.g. `["heading", "size", "t"]`. */
export function getAt(value: unknown, path: Path): unknown {
  return path.reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), value);
}

/**
 * A copy with the value at `path` set — or REMOVED when `next` is undefined, "" or
 * null, with any object left empty removed too. So a reset leaves no trace, and an
 * untouched design stays `{}`.
 */
export function setAt<T>(value: T, path: Path, next: unknown): T {
  const [head, ...rest] = path;
  const node = (value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {}) as Record<string, unknown>;
  if (head === undefined) return value;
  if (rest.length === 0) {
    if (next === undefined || next === "" || next === null) delete node[head];
    else node[head] = next;
  } else {
    const child = setAt(node[head], rest, next);
    if (child && typeof child === "object" && Object.keys(child).length === 0) delete node[head];
    else node[head] = child;
  }
  return node as T;
}

export function isEmptyDesign(value: DesignValue | undefined): boolean {
  return !value || Object.keys(value).length === 0;
}

/* -------------------------------------------------------------------------- *
 * To CSS
 * -------------------------------------------------------------------------- */

/**
 * Inline style + data attributes for an element carrying a design. The style holds
 * VALUES as custom properties; the attributes say which ones are set on which
 * device, and the static rules in `globals.css` (section "Design") apply them per
 * breakpoint. So there is no `<style>` per section, and an unset value never
 * overrides the component's own.
 */
export function designStyle(value: DesignValue | undefined): {
  style: Record<string, string>;
  attrs: Record<string, string>;
} {
  const style: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  if (!value || isEmptyDesign(value)) return { style, attrs };

  /** A responsive number → `--name`, `--name-t`, `--name-m` and the device list. */
  const each = <T>(attr: string, name: string, input: Responsive<T> | undefined, format: (value: T) => string) => {
    if (!input) return;
    const set: Device[] = [];
    for (const device of DEVICES) {
      const v = input[device];
      if (v === undefined) continue;
      style[device === "d" ? name : `${name}-${device}`] = format(v);
      set.push(device);
    }
    if (set.length) attrs[`data-sb-${attr}`] = set.join(" ");
  };

  const type = (prefix: "h" | "p" | "b", input: TypeStyle | undefined) => {
    if (!input) return;
    if (input.font) {
      style[`--sb-${prefix}-font`] = fontStack(input.font);
      attrs[`data-sb-${prefix}font`] = "";
    }
    each(`${prefix}size`, `--sb-${prefix}-size`, input.size, (v) => `${v}px`);
    each(`${prefix}lh`, `--sb-${prefix}-lh`, input.lineHeight, (v) => String(v));
    each(`${prefix}ls`, `--sb-${prefix}-ls`, input.letterSpacing, (v) => `${v}px`);
    if (input.weight) {
      style[`--sb-${prefix}-weight`] = String(input.weight);
      attrs[`data-sb-${prefix}weight`] = "";
    }
    if (input.color && HEX_COLOR.test(input.color)) {
      style[`--sb-${prefix}-color`] = input.color;
      attrs[`data-sb-${prefix}color`] = "";
    }
    if (input.transform) {
      style[`--sb-${prefix}-tt`] = input.transform;
      attrs[`data-sb-${prefix}tt`] = "";
    }
  };

  type("h", value.heading);
  type("p", value.text);
  type("b", value.button);
  each("align", "--sb-align", value.align, (v) => v);

  const look = value.buttonLook;
  if (look) {
    const colour = (attr: string, name: string, input: string | undefined) => {
      if (!input || !HEX_COLOR.test(input)) return;
      style[name] = input;
      attrs[`data-sb-${attr}`] = "";
    };
    colour("btn-bg", "--sb-btn-bg", look.background);
    colour("btn-fg", "--sb-btn-fg", look.color);
    colour("btn-bc", "--sb-btn-bc", look.borderColor);
    colour("btn-hbg", "--sb-btn-hbg", look.hoverBackground);
    colour("btn-hfg", "--sb-btn-hfg", look.hoverColor);
    colour("btn-hbc", "--sb-btn-hbc", look.hoverBorderColor);
    if (look.borderWidth !== undefined) {
      style["--sb-btn-bw"] = `${look.borderWidth}px`;
      attrs["data-sb-btn-bw"] = "";
    }
    if (look.radius !== undefined) {
      style["--sb-btn-r"] = `${look.radius}px`;
      attrs["data-sb-btn-r"] = "";
    }
    each("btn-px", "--sb-btn-px", look.padX, (v) => `${v}px`);
    each("btn-py", "--sb-btn-py", look.padY, (v) => `${v}px`);
    each("btn-mt", "--sb-btn-mt", look.spaceAbove, (v) => `${v}px`);
    each("btn-gap", "--sb-btn-gap", look.gap, (v) => `${v}px`);
  }

  for (const device of ["t", "m"] as const) {
    const box = value.spacing?.[device];
    if (!box) continue;
    if (box.pt !== undefined) style[`--sb-pad-top-${device}`] = `${box.pt}px`;
    if (box.pb !== undefined) style[`--sb-pad-bottom-${device}`] = `${box.pb}px`;
    if (box.mt !== undefined) style[`--sb-mt-${device}`] = `${box.mt}px`;
    if (box.mb !== undefined) style[`--sb-mb-${device}`] = `${box.mb}px`;
    attrs[`data-sb-space-${device}`] = "";
  }

  each("padl", "--sb-padl", value.sides?.padLeft, (v) => `${v}px`);
  each("padr", "--sb-padr", value.sides?.padRight, (v) => `${v}px`);
  each("marl", "--sb-marl", value.sides?.marginLeft, (v) => `${v}px`);
  each("marr", "--sb-marr", value.sides?.marginRight, (v) => `${v}px`);

  const background = value.background;
  const gradient =
    background?.gradient && HEX_COLOR.test(background.gradient.from) && HEX_COLOR.test(background.gradient.to)
      ? `linear-gradient(${Math.round(background.gradient.angle)}deg, ${background.gradient.from}, ${background.gradient.to})`
      : null;
  if (background?.image || background?.overlay || gradient) {
    const overlay =
      background!.overlay && HEX_COLOR.test(background!.overlay)
        ? `linear-gradient(${rgba(background!.overlay, (background!.overlayOpacity ?? 40) / 100)}, ${rgba(background!.overlay, (background!.overlayOpacity ?? 40) / 100)})`
        : null;
    // Top to bottom: the overlay, the photograph, the gradient behind it.
    const layer = (image: ImageRef | null | undefined) =>
      [overlay, image ? `url(${JSON.stringify(image.url)})` : null, gradient].filter(Boolean).join(", ");
    style["--sb-bg"] = layer(background!.image) || "none";
    if (background!.mobileImage) {
      style["--sb-bg-m"] = layer(background!.mobileImage);
      attrs["data-sb-bg-m"] = "";
    }
    style["--sb-bg-pos"] = background!.position ?? "center";
    attrs["data-sb-bg"] = "";
  }

  if (value.shadow && value.shadow !== "none") style.boxShadow = SHADOWS[value.shadow].css;

  // Corners per device: the frame draws `var(--sb-rad, <desktop>)`; these set --sb-rad
  // below 1024px and below 750px.
  const corners = (["t", "m"] as const).filter((device) => value.radius?.[device] !== undefined);
  if (corners.length) {
    for (const device of corners) style[`--sb-rad-${device}`] = `${value.radius![device]}px`;
    attrs["data-sb-rad"] = corners.join(" ");
    style.borderRadius = "var(--sb-rad, var(--sb-radius, 0px))";
    style.overflow = "clip";
  }

  const images = value.images;
  if (images?.ratio && IMAGE_RATIOS[images.ratio]) {
    style["--sb-ratio"] = IMAGE_RATIOS[images.ratio].css;
    attrs["data-sb-ratio"] = "";
  }
  if (images?.radius) {
    style["--sb-imgr"] = `${images.radius}px`;
    attrs["data-sb-imgr"] = "";
  }
  if (images?.zoom) attrs["data-sb-zoom"] = "";
  if (value.opacity !== undefined && value.opacity < 100) style.opacity = String(value.opacity / 100);

  each("maxw", "--sb-maxw", value.maxWidth, (v) => `${v}px`);
  each("minh", "--sb-minh", value.minHeight, (v) => `${v}px`);
  if (value.minHeight && value.verticalAlign) {
    attrs["data-sb-valign"] = value.verticalAlign;
  }

  const hidden = DEVICES.filter((device) => value.hide?.[device]);
  if (hidden.length) attrs["data-sb-hide"] = hidden.join(" ");

  return { style, attrs };
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r} ${g} ${b} / ${Math.max(0, Math.min(1, alpha)).toFixed(2)})`;
}

/* -------------------------------------------------------------------------- *
 * Readability
 * -------------------------------------------------------------------------- */

/** The grounds' own colours (`globals.css` section H), for checking a choice against them. */
export const SURFACE_COLOURS: Record<string, { background: string; text: string }> = {
  light: { background: "#ebe8e3", text: "#302f2d" },
  dark: { background: "#302f2d", text: "#ebe8e3" },
  olive: { background: "#41473e", text: "#ebe8e3" },
  mocha: { background: "#4a3c3f", text: "#ebe8e3" },
  blue: { background: "#47515c", text: "#ebe8e3" },
  black: { background: "#1d1d1b", text: "#ebe8e3" },
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio of two `#rrggbb` colours, 1–21. 4.5 is what body text needs. */
export function contrastRatio(a: string, b: string): number {
  if (!HEX_COLOR.test(a) || !HEX_COLOR.test(b)) return 21;
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}
