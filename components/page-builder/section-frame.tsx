import type { StyleSettings, UniversalSettings } from "@/lib/page-builder/define-section";
import { HEX_COLOR } from "@/lib/page-builder/fields";
import { cn } from "@/lib/utils/cn";

/**
 * The wrapper every builder section renders inside. It applies the three
 * universal settings with what `globals.css` already has, and nothing else:
 *
 *  - `surface` → `data-surface`, which re-points every colour token beneath it;
 *  - `rhythm`  → `section-*`, which retunes every `py-section` / `pb-section`
 *    inside the band, so the component's own spacing classes follow;
 *  - `hideOn`  → a display class at the design's one breakpoint (750px).
 *
 * Then the Style tab (spacing, lines, colours) as ONE inline style — see
 * `frameStyle`. Its Liquid twin is `theme/snippets/sb-section-style.liquid`; the
 * two must produce the same declarations.
 *
 * The component inside is untouched. Class names are written out in full because
 * Tailwind only emits what it can read in the source.
 *
 * `data-section-id` is how the preview finds a section to scroll to and outline.
 */

const RHYTHM: Record<UniversalSettings["rhythm"], string> = {
  default: "",
  xs: "section-xs",
  sm: "section-sm",
  md: "section-md",
  lg: "section-lg",
  xl: "section-xl",
};

const HIDE: Record<UniversalSettings["hideOn"], string> = {
  none: "",
  mobile: "max-sm:hidden",
  desktop: "sm:hidden",
};

/** Only a validated `#rrggbb` ever reaches the style attribute. */
const hex = (value: string) => (HEX_COLOR.test(value) ? value : "");

const BORDER_SIDES: Record<StyleSettings["border"], string[]> = {
  none: [],
  all: ["Top", "Right", "Bottom", "Left"],
  top: ["Top"],
  bottom: ["Bottom"],
  y: ["Top", "Bottom"],
};

/**
 * The Style tab → CSS. Colours rebind the same tokens a `data-surface` does, so
 * every component inside — headings, muted copy, lines, buttons — follows without
 * knowing. Custom padding is handed to `globals.css` as `--sb-pad-*`, where the
 * `[data-sb-pad]` rule makes it REPLACE the section's own band padding.
 */
export function frameStyle(settings: StyleSettings): { style: React.CSSProperties; padded: boolean } {
  const style: Record<string, string> = {};
  const background = hex(settings.bgColor);
  const text = hex(settings.textColor);

  if (background) {
    style["--sb-background"] = background;
    style["--sb-surface"] = background;
    style.backgroundColor = background;
  }
  if (text) {
    style["--sb-foreground"] = text;
    style["--sb-muted"] = `color-mix(in srgb, ${text} 60%, transparent)`;
    style["--sb-border"] = `color-mix(in srgb, ${text} 26%, transparent)`;
    style["--sb-primary"] = text;
    style["--sb-primary-foreground"] = background || "var(--sb-background)";
    style.color = text;
  }
  if (settings.customSpacing) {
    style["--sb-pad-top"] = `${settings.paddingTop}px`;
    style["--sb-pad-bottom"] = `${settings.paddingBottom}px`;
    style.marginTop = `${settings.marginTop}px`;
    style.marginBottom = `${settings.marginBottom}px`;
  }
  const sides = BORDER_SIDES[settings.border] ?? [];
  if (sides.length) {
    const line = `${settings.borderWidth}px solid ${hex(settings.borderColor) || "var(--sb-border)"}`;
    for (const side of sides) style[`border${side}`] = line;
  }
  if (settings.radius > 0) {
    style.borderRadius = `${settings.radius}px`;
    // `clip`, not `hidden`: rounds what the section paints without creating a
    // scroll container, so sticky children keep working.
    style.overflow = "clip";
  }

  return { style: style as React.CSSProperties, padded: settings.customSpacing };
}

export function SectionFrame({
  id,
  type,
  settings,
  children,
}: {
  id: string;
  type: string;
  settings: UniversalSettings;
  children: React.ReactNode;
}) {
  const painted = settings.surface !== "inherit";
  const { style, padded } = frameStyle(settings);

  return (
    <div
      data-section-id={id}
      data-section-type={type}
      data-surface={painted ? settings.surface : undefined}
      data-sb-pad={padded ? "" : undefined}
      style={style}
      className={cn(
        // `flow-root` keeps a child's margin inside the band, so a painted ground
        // reaches the edge of what the section draws.
        (painted || settings.bgColor || settings.customSpacing) && "flow-root",
        painted && "bg-background text-foreground",
        RHYTHM[settings.rhythm],
        HIDE[settings.hideOn],
      )}
    >
      {children}
    </div>
  );
}
