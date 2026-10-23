"use client";

import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  Link2Icon,
  RotateCcwIcon,
  Trash2Icon,
  Unlink2Icon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Separator } from "@/components/admin/ui/separator";
import { Switch } from "@/components/admin/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { PAGE_SURFACES, type PageSettings, type SectionInstance } from "@/lib/page-builder/document";
import { NEUTRAL_STYLE, RHYTHM_OPTIONS, SURFACE_OPTIONS } from "@/lib/page-builder/define-section";
import {
  contrastRatio,
  DEVICE_LABELS,
  getAt,
  resolveResponsive,
  setAt,
  SHADOWS,
  SURFACE_COLOURS,
  type DesignValue,
  type Device,
  type Responsive,
} from "@/lib/page-builder/design";
import { isFieldActive, isFieldFilled, type FieldDef } from "@/lib/page-builder/fields";
import { sectionDefinition } from "@/lib/page-builder/registry";

import type { SectionContents } from "@/components/page-builder/preview-bridge";

import { BackgroundPart, DesignControls, Part, Segmented, Slider } from "./design-controls";
import { DEVICE_ICONS, DeviceSwitch, useEditorDevice } from "./editor-device";
import { FieldControl, type CollectionOption } from "./field-controls";

/**
 * The form for one section, built from its field list — Content first, then
 * Layout. A field whose `when` is not met is not shown; one marked required
 * says so, but an empty one does not stop a draft from saving. Only publishing
 * waits for it.
 */

function Field({
  field,
  sectionId,
  settings,
  collections,
  onChange,
}: {
  field: FieldDef;
  sectionId: string;
  settings: Record<string, unknown>;
  collections: CollectionOption[];
  onChange: (key: string, value: unknown) => void;
}) {
  const inputId = `${sectionId}-${field.key}`;
  const value = settings[field.key];
  const missing = field.required && !isFieldFilled(field, value);
  const inline = field.kind === "toggle";

  return (
    <div className={inline ? "flex items-center justify-between gap-4" : "space-y-1.5"}>
      <Label htmlFor={inputId} className="text-xs">
        {field.label}
        {field.required && (
          <span className="text-muted-foreground" aria-label="required">
            *
          </span>
        )}
      </Label>
      <FieldControl
        field={field}
        value={value}
        inputId={inputId}
        collections={collections}
        onChange={(next) => onChange(field.key, next)}
      />
      {field.help && !inline && <p className="text-muted-foreground text-xs">{field.help}</p>}
      {missing && <p className="text-xs text-amber-600 dark:text-amber-500">Needed before this page can be published.</p>}
    </div>
  );
}

export function SectionEditor({
  section,
  previousType,
  collections,
  tab,
  onTabChange,
  onBack,
  onOpenHeading,
  onChange,
  onToggle,
  onDuplicate,
  onRemove,
  contents = null,
}: {
  section: SectionInstance;
  /** The type of the section above — whether this one can share the page heading's band. */
  previousType: string | null;
  collections: CollectionOption[];
  tab: "content" | "style";
  onTabChange: (tab: "content" | "style") => void;
  onBack: () => void;
  /** Opens the Page heading above on its Style tab — where a joined section's look is set. */
  onOpenHeading: () => void;
  onChange: (key: string, value: unknown) => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  /** What the section draws, from the preview — null until it has said. */
  contents?: SectionContents | null;
}) {
  const definition = sectionDefinition(section.type);
  if (!definition) return null;

  const settings = section.settings as Record<string, unknown>;

  /**
   * "Same band as the heading" only means anything directly under a Page heading,
   * so that is the only place it is offered. When it is on, the section draws
   * inside the heading's band and its own background and spacing do not apply —
   * so those are not offered either, rather than offered and ignored.
   */
  const afterHeading = previousType === "page_heading";
  const joined = afterHeading && settings.placement === "heading";
  // A section with the design panel has ONE "Show on": the three switches there.
  // The older select is folded into them (see `visibilityOf`), so it is not offered.
  const hasDesign = definition.fields.some((field) => field.kind === "design");
  const offered = (field: FieldDef) =>
    !(hasDesign && field.key === "hideOn") &&
    !(field.key === "placement" && !afterHeading) && !(joined && field.group === "style");

  const active = definition.fields.filter((field) => isFieldActive(field, settings) && offered(field));
  const content = active.filter((field) => (field.group ?? "content") === "content");
  const layout = active.filter((field) => field.group === "layout");
  const style = active.filter((field) => field.group === "style");
  const advanced = active.filter((field) => field.group === "advanced");
  const source = definition.source(settings);
  // A tab with nothing on it is not offered: a section with nothing to fill in opens
  // straight on its Style.
  const contentEmpty = content.length === 0 && layout.length === 0 && advanced.length === 0 && !source;
  const showTabs = (style.length > 0 || joined) && !contentEmpty;
  const styleOnly = contentEmpty && (style.length > 0 || joined);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to sections" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{definition.label}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={section.visible ? "Hide section" : "Show section"}
          title={section.visible ? "Hide section" : "Show section"}
          onClick={onToggle}
        >
          {section.visible ? <EyeIcon /> : <EyeOffIcon />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Duplicate section" title="Duplicate" onClick={onDuplicate}>
          <CopyIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          aria-label="Delete section"
          title="Delete"
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>

      {/* Content | Style, as in Elementor: what the section says, then how it looks. */}
      {showTabs && (
        <div className="border-b px-4 py-2">
          <Tabs value={tab} onValueChange={(next) => onTabChange(next as "content" | "style")}>
            <TabsList className="w-full">
              <TabsTrigger value="content" className="flex-1">
                Content
              </TabsTrigger>
              <TabsTrigger value="style" className="flex-1">
                Style
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {(showTabs && tab === "style") || styleOnly ? (
        <StyleTab
          fields={style}
          joined={joined}
          category={definition.category}
          textAlign={definition.textAlign}
          innerSpacing={definition.innerSpacing}
          contents={contents}
          sectionId={section.id}
          settings={settings}
          collections={collections}
          onChange={onChange}
          onOpenHeading={onOpenHeading}
        />
      ) : (
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <p className="text-muted-foreground text-xs">{definition.description}</p>
        <p className="text-muted-foreground text-xs">
          Tip: double-click a heading, a line or a button in the preview to type over it there.
        </p>

        {!section.visible && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs">
            <p>Hidden — visitors don’t see this section. Everything in it is kept.</p>
            <Button type="button" variant="outline" size="xs" onClick={onToggle}>
              Show
            </Button>
          </div>
        )}

        {source && (
          <p className="bg-muted/50 rounded-md px-3 py-2 text-xs">
            Its content comes from{" "}
            <a href={source.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2">
              {source.label}
              <ExternalLinkIcon className="size-3" />
            </a>
            . Edit it there — every page that shows it updates.
          </p>
        )}

        {content.length > 0 && (
          <div className="space-y-4">
            {content.map((field) => (
              <Field
                key={field.key}
                field={field}
                sectionId={section.id}
                settings={settings}
                collections={collections}
                onChange={onChange}
              />
            ))}
          </div>
        )}

        {layout.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Layout</h3>
              {layout.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  sectionId={section.id}
                  settings={settings}
                  collections={collections}
                  onChange={onChange}
                />
              ))}
              {joined && (
                <p className="text-muted-foreground text-xs">
                  Joined to the Page heading, so it uses the heading’s background and spacing. Choose “Its own
                  section” to style it separately.
                </p>
              )}
            </div>
          </>
        )}

        {/* The fine adjustments some pages need to match their design exactly —
            folded away so the usual edit never meets them. */}
        {advanced.length > 0 && (
          <details className="group rounded-md border">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon className="text-muted-foreground size-3.5 transition-transform group-open:rotate-90" />
              Advanced
            </summary>
            <div className="space-y-4 border-t px-3 py-3">
              {advanced.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  sectionId={section.id}
                  settings={settings}
                  collections={collections}
                  onChange={onChange}
                />
              ))}
            </div>
          </details>
        )}
      </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Style tab
 * -------------------------------------------------------------------------- */

/**
 * "Show on devices", one control over TWO stored settings: the original `hideOn`
 * (all / desktop only / mobile only — what the Liquid theme reads) and the design's
 * per-device `hide` (Next), which adds tablet. A choice the original can express is
 * stored there, and the design's `hide` cleared; only one it cannot (tablet on its
 * own) goes to the design.
 */
function visibilityOf(settings: Record<string, unknown>, onChange: (key: string, value: unknown) => void) {
  const design = (settings.design as DesignValue | undefined) ?? {};
  const fromHideOn: Device[] = settings.hideOn === "mobile" ? ["m"] : settings.hideOn === "desktop" ? ["d", "t"] : [];
  const fromDesign = (["d", "t", "m"] as const).filter((device) => design.hide?.[device]);
  const hidden = [...new Set([...fromHideOn, ...fromDesign])];

  return {
    hidden,
    onChange: (next: Device[]) => {
      const key = [...next].sort().join(",");
      const rest = { ...design };
      delete rest.hide;
      const hideOn = key === "m" ? "mobile" : key === "d,t" ? "desktop" : "none";
      const expressible = key === "" || key === "m" || key === "d,t";
      onChange("hideOn", hideOn);
      onChange("design", expressible ? rest : { ...rest, hide: Object.fromEntries(next.map((device) => [device, true])) });
    },
  };
}

/**
 * Text that would be hard to read on its background — said in words, with the
 * number, while the colours are being chosen rather than after the page is live.
 * Checked only where both colours are known: a chosen colour, or a ground's own.
 */
function readability(settings: Record<string, unknown>): string[] {
  const design = (settings.design as DesignValue | undefined) ?? {};
  const surface = SURFACE_COLOURS[String(settings.surface)];
  const background = (settings.bgColor as string) || surface?.background;
  if (!background) return [];
  const text = (settings.textColor as string) || surface?.text;
  const pairs: [string, string | undefined, number][] = [
    ["Text", text, 4.5],
    ["Headings", design.heading?.color ?? text, 3],
    ["Body text", design.text?.color ?? text, 4.5],
  ];
  const seen = new Set<string>();
  return pairs.flatMap(([what, colour, needed]) => {
    if (!colour || seen.has(colour + needed)) return [];
    seen.add(colour + needed);
    const ratio = contrastRatio(colour, background);
    return ratio < needed
      ? [`${what} may be hard to read on this background (contrast ${ratio.toFixed(1)}:1 — aim for at least ${needed}:1). Choose a lighter or darker colour.`]
      : [];
  });
}

const IMAGE_GROUND_CATEGORIES: readonly string[] = ["Banners", "Intro"];


/**
 * A readable text colour for a background — the design's two neutrals, chosen by
 * the background's brightness. Offered automatically, so picking a dark
 * background never leaves dark text on it.
 */
function contrastFor(background: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(background.slice(at, at + 2), 16));
  const luminance = (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255;
  return luminance < 0.55 ? "#ebe8e3" : "#302f2d";
}

/** Settings the Style tab places itself. Any other style setting of a section joins Background. */
const SPACING_KEYS: readonly string[] = ["rhythm", "customSpacing", "paddingTop", "paddingBottom", "marginTop", "marginBottom"];
const BORDER_KEYS: readonly string[] = ["border", "borderWidth", "borderColor", "radius"];
const BACKGROUND_KEYS: readonly string[] = ["surface", "bgColor", "textColor"];

const STYLE_RESET: Record<string, unknown> = { ...NEUTRAL_STYLE, surface: "inherit", rhythm: "default" };

/** The highest the section's own spacing settings go (their fields' `max`). */
const SPACE_MAX = 200;

/**
 * A number that can differ per device, as one control: it edits the device chosen at
 * the top. Desktop is the section's own setting; tablet and mobile live in the design
 * value, and an empty one follows the larger screen.
 */
function DeviceNumber({
  label,
  hint,
  max,
  desktop,
  onDesktop,
  own,
  onOwn,
}: {
  label: string;
  hint?: string;
  max: number;
  desktop: number;
  onDesktop: (next: number) => void;
  /** The tablet or mobile value, if set. */
  own: (device: "t" | "m") => number | undefined;
  onOwn: (device: "t" | "m", next: number | undefined) => void;
}) {
  const { device } = useEditorDevice();
  if (device === "d") {
    return (
      <Slider
        label={label}
        hint={hint}
        unit="px"
        min={0}
        max={max}
        step={1}
        // 0 is the default: shown as the placeholder, with no reset.
        value={desktop === 0 ? undefined : desktop}
        placeholder="0"
        device="d"
        onChange={(next) => onDesktop(next ?? 0)}
      />
    );
  }
  const tablet = own("t");
  const inherited = device === "m" ? (tablet ?? desktop) : desktop;
  const value = own(device);
  return (
    <Slider
      label={label}
      hint={hint}
      unit="px"
      min={0}
      max={max}
      step={1}
      value={value}
      placeholder={String(inherited)}
      device={device}
      inheritedNote={
        value === undefined ? `Same as ${device === "m" && tablet !== undefined ? "tablet" : "desktop"} until changed here.` : null
      }
      onChange={(next) => onOwn(device, next)}
    />
  );
}

type BoxSide = "top" | "right" | "bottom" | "left";
const BOX_SIDES: readonly BoxSide[] = ["top", "right", "bottom", "left"];
const BOX_LABEL: Record<BoxSide, string> = { top: "Top", right: "Right", bottom: "Bottom", left: "Left" };

/**
 * Padding or margin as four small boxes in one row — top, right, bottom, left, as in
 * Elementor — for the device chosen at the top. Linked, one number fills all four. An
 * empty box follows the larger screen (or, for the sides, the design's own).
 */
function SpacingBox({
  title,
  values,
  placeholders,
  disabled = {},
  hint,
  onChange,
}: {
  title: string;
  values: Record<BoxSide, number | undefined>;
  placeholders: Record<BoxSide, string>;
  disabled?: Partial<Record<BoxSide, boolean>>;
  hint?: string;
  onChange: (changes: Partial<Record<BoxSide, number | undefined>>) => void;
}) {
  const { device } = useEditorDevice();
  const [linked, setLinked] = React.useState(false);
  const DeviceGlyph = DEVICE_ICONS[device];
  const open = BOX_SIDES.filter((side) => !disabled[side]);

  const type = (side: BoxSide, raw: string) => {
    const next = raw === "" ? undefined : Math.max(0, Math.min(SPACE_MAX, Math.round(Number(raw))));
    if (next !== undefined && !Number.isFinite(next)) return;
    onChange(linked ? Object.fromEntries(open.map((each) => [each, next])) : { [side]: next });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          {title}
          <DeviceGlyph className="text-muted-foreground size-3.5" aria-label={DEVICE_LABELS[device]} />
        </span>
        <Button
          type="button"
          variant={linked ? "secondary" : "ghost"}
          size="icon-xs"
          aria-pressed={linked}
          aria-label={linked ? `${title}: set each side on its own` : `${title}: the same on all sides`}
          title={linked ? "Each side on its own" : "The same on all sides"}
          onClick={() => setLinked((on) => !on)}
        >
          {linked ? <Link2Icon /> : <Unlink2Icon />}
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {BOX_SIDES.map((side) => (
          <label key={side} className="space-y-0.5">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={SPACE_MAX}
              disabled={disabled[side]}
              aria-label={`${title} ${side} (px)`}
              value={values[side] === undefined ? "" : String(values[side])}
              placeholder={disabled[side] ? "–" : placeholders[side]}
              onChange={(event) => type(side, event.target.value)}
              className="h-8 [appearance:textfield] px-1.5 text-center text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-muted-foreground block text-center text-[10px]">{BOX_LABEL[side]}</span>
          </label>
        ))}
      </div>
      {hint ? <p className="text-muted-foreground text-[11px]">{hint}</p> : null}
    </div>
  );
}

/**
 * THE STYLE TAB — one list of groups that fold away, each holding everything of one
 * kind, wherever it is stored:
 *
 *   Background       the brand ground or an own colour, a gradient, a photo, an overlay
 *                    over all of it, the section's own darkening, the text colour
 *   Spacing          set by hand (or the design's own) — per device
 *   Border & shadow  the line, the corners (the section's and its photos'), shadow,
 *                    transparency
 *   then the design's Typography, Buttons, Images, Width & height, Show on devices.
 *
 * Only what does something is offered: a section whose own photograph or band is its
 * ground gets no background photo or gradient (they would sit behind it, unseen), and a
 * section whose height is fixed gets no space inside.
 */
function StyleTab({
  fields,
  joined,
  category,
  textAlign,
  innerSpacing,
  contents,
  sectionId,
  settings,
  collections,
  onChange,
  onOpenHeading,
}: {
  fields: FieldDef[];
  joined: boolean;
  /** Where the section sits in Add section — a banner's photograph is its ground. */
  category: string;
  textAlign: boolean;
  innerSpacing: boolean;
  contents: SectionContents | null;
  onOpenHeading: () => void;
  sectionId: string;
  settings: Record<string, unknown>;
  collections: CollectionOption[];
  onChange: (key: string, value: unknown) => void;
}) {
  const { device } = useEditorDevice();
  const designField = fields.find((field) => field.kind === "design");
  const parts = designField?.kind === "design" ? designField.parts : [];
  const field = (key: string) => fields.find((candidate) => candidate.key === key);
  const design = (settings.design as DesignValue | undefined) ?? {};
  const getDesign = (path: readonly (string | number)[]) => getAt(design, path);
  const setDesign = (path: readonly (string | number)[], next: unknown) => onChange("design", setAt(design, path, next));

  // A new background with no text colour yet gets a readable one alongside it —
  // still the editor's to change.
  const change = (key: string, value: unknown) => {
    onChange(key, value);
    if (key === "bgColor" && typeof value === "string" && value && !settings.textColor) {
      onChange("textColor", contrastFor(value));
    }
  };
  const plain = (candidate: FieldDef | undefined, overrides: { label?: string; help?: string } = {}) =>
    candidate ? (
      <Field
        key={candidate.key}
        field={{ ...candidate, ...overrides } as FieldDef}
        sectionId={sectionId}
        settings={settings}
        collections={collections}
        onChange={change}
      />
    ) : null;

  /* Background */
  // Behind a section's own photograph or band (no own colour is offered there), a
  // background photo or gradient would never be seen.
  const backgroundDesign = parts.includes("background") && Boolean(field("bgColor"));
  const ownBackground = fields.filter(
    (candidate) =>
      candidate.kind !== "design" &&
      ![...SPACING_KEYS, ...BORDER_KEYS, ...BACKGROUND_KEYS, "hideOn"].includes(candidate.key),
  );
  const hasBackground = BACKGROUND_KEYS.some((key) => field(key)) || ownBackground.length > 0 || backgroundDesign;
  const problems = readability(settings);

  /* Spacing */
  const spacing = Boolean(field("customSpacing"));
  const custom = Boolean(settings.customSpacing);
  const legacy = settings.rhythm && settings.rhythm !== "default" ? String(settings.rhythm) : null;
  const legacyLabel = RHYTHM_OPTIONS.find((option) => option.value === legacy)?.label ?? legacy;
  const setSpacingYourself = (on: boolean) => {
    if (!on) {
      onChange("customSpacing", false);
      return;
    }
    // Start from what the section has now (as the preview measures it on desktop), so
    // switching to numbers changes nothing until a number is changed.
    const now = device === "d" && contents ? contents : null;
    onChange("customSpacing", true);
    if (now && innerSpacing) {
      onChange("paddingTop", Math.min(SPACE_MAX, now.padTop));
      onChange("paddingBottom", Math.min(SPACE_MAX, now.padBottom));
    }
    if (legacy) onChange("rhythm", "default");
  };
  // Padding and margin, for the device being edited. Top and bottom on desktop are the
  // section's own settings; tablet and mobile, and every side, live in the design value.
  const box = (kind: "padding" | "margin") => {
    const [topKey, topShort, bottomKey, bottomShort] =
      kind === "padding"
        ? (["paddingTop", "pt", "paddingBottom", "pb"] as const)
        : (["marginTop", "mt", "marginBottom", "mb"] as const);
    const [leftKey, rightKey] = kind === "padding" ? (["padLeft", "padRight"] as const) : (["marginLeft", "marginRight"] as const);
    const desktop = { top: Number(settings[topKey]) || 0, bottom: Number(settings[bottomKey]) || 0 };
    const own = (target: "t" | "m", short: string) => getDesign(["spacing", target, short]) as number | undefined;
    const vertical = (side: "top" | "bottom", short: string) => {
      if (device === "d") return { value: desktop[side], placeholder: "0" };
      const inherited = device === "m" ? (own("t", short) ?? desktop[side]) : desktop[side];
      return { value: own(device, short), placeholder: String(inherited) };
    };
    // An empty side keeps the design's own: the gutter the preview measures, or no margin.
    const sideOf = (key: string, measured: number | undefined) => {
      const value = getDesign(["sides", key]) as Responsive<number> | undefined;
      const inherited = device === "d" ? undefined : resolveResponsive(value, device === "m" ? "t" : "d");
      return {
        value: value?.[device],
        placeholder: inherited !== undefined ? String(inherited) : measured !== undefined ? String(measured) : "0",
      };
    };
    const top = vertical("top", topShort);
    const bottom = vertical("bottom", bottomShort);
    const left = sideOf(leftKey, kind === "padding" ? contents?.padLeft : undefined);
    const right = sideOf(rightKey, kind === "padding" ? contents?.padRight : undefined);

    const change = (changes: Partial<Record<BoxSide, number | undefined>>) => {
      let next = design;
      for (const [side, value] of Object.entries(changes) as [BoxSide, number | undefined][]) {
        if (side === "top" || side === "bottom") {
          const [key, short] = side === "top" ? [topKey, topShort] : [bottomKey, bottomShort];
          if (device === "d") onChange(key, value ?? 0);
          else next = setAt(next, ["spacing", device, short], value);
        } else {
          const key = side === "left" ? leftKey : rightKey;
          const current = { ...((getAt(next, ["sides", key]) as Responsive<number> | undefined) ?? {}) };
          if (value === undefined) delete current[device];
          else current[device] = value;
          next = setAt(next, ["sides", key], Object.keys(current).length ? current : undefined);
        }
      }
      // One write for the design, so linked boxes do not overwrite each other.
      if (next !== design) onChange("design", next);
    };
    return {
      values: { top: top.value, right: right.value, bottom: bottom.value, left: left.value },
      placeholders: { top: top.placeholder, right: right.placeholder, bottom: bottom.placeholder, left: left.placeholder },
      change,
    };
  };
  const padding = box("padding");
  const margin = box("margin");

  /* Border & shadow */
  // A banner's or a hero's photograph is its ground, not an image inside it; and a
  // section with no photograph has nothing for photo controls to shape.
  const photos = parts.includes("images") && !IMAGE_GROUND_CATEGORIES.includes(category) && contents?.image !== false;
  // The section's own corners round its background and line — on the page's own
  // ground with no line, there is nothing to see them on.
  const boxShows = Boolean(
    settings.bgColor ||
      (settings.surface && settings.surface !== "inherit") ||
      (settings.border && settings.border !== "none") ||
      design.background?.image ||
      design.background?.gradient ||
      design.shadow,
  );
  const effects = parts.includes("effects");
  const hasBorder = BORDER_KEYS.some((key) => field(key)) || effects;

  // By value: the design is an object, and a fresh `{}` is never `===` another.
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changed = Object.entries(STYLE_RESET).some(([key, value]) => key in settings && !same(settings[key], value));

  // Not a dead end: say why there is nothing here, then offer both ways out as
  // buttons, so the editor never has to find a setting by its name.
  if (joined) {
    return (
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-xs">
          This section is joined to the <span className="font-medium">Page heading</span> above it, so it uses the
          heading’s background and spacing.
        </p>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenHeading}>
            Change the look on the Page heading
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("placement", "band")}>
            Style this section on its own
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {/* The device being edited — the same switch as above the preview. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Settings marked with a device icon can differ on desktop, tablet and mobile.
        </p>
        <DeviceSwitch />
      </div>

      <div className="space-y-2">
        {hasBackground ? (
          <Part
            title="Background"
            changed={Boolean(
              (settings.surface && settings.surface !== "inherit") || settings.bgColor || settings.textColor || design.background,
            )}
            defaultOpen={false}
          >
            <div className="space-y-4">
              {plain(field("surface"), { label: "Brand colour" })}
              {plain(field("bgColor"), { label: "Own colour", help: "Instead of the brand colour. Empty keeps it." })}
              {backgroundDesign ? <BackgroundPart get={getDesign} set={setDesign} /> : null}
              {ownBackground.map((candidate) => plain(candidate))}
              {plain(field("textColor"))}
              {problems.length ? (
                <div
                  role="status"
                  className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                >
                  {problems.map((problem) => (
                    <p key={problem}>{problem}</p>
                  ))}
                </div>
              ) : null}
            </div>
          </Part>
        ) : null}

        {spacing ? (
          <Part
            title="Spacing"
            changed={custom || Boolean(legacy) || Boolean(design.spacing) || Boolean(design.sides)}
            defaultOpen={false}
          >
            <div className="space-y-4">
              {legacy && !custom ? (
                // An older choice, no longer offered: said, with both ways forward.
                <div className="space-y-2 rounded-md border px-3 py-2 text-xs">
                  <p>
                    This section uses an earlier spacing choice, <span className="font-medium">{legacyLabel}</span>.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setSpacingYourself(true)}>
                      Keep it, as numbers
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onChange("rhythm", "default")}>
                      Use the design’s spacing
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor={`${sectionId}-customSpacing`} className="text-xs">
                  Set the spacing yourself
                </Label>
                <Switch id={`${sectionId}-customSpacing`} checked={custom} onCheckedChange={setSpacingYourself} />
              </div>
              {custom ? (
                <>
                  <SpacingBox
                    title="Padding"
                    values={padding.values}
                    placeholders={padding.placeholders}
                    disabled={innerSpacing ? {} : { top: true, bottom: true }}
                    hint={
                      innerSpacing
                        ? "Space inside. Empty left and right keep the design’s own side margin."
                        : "Space inside, at the sides — this section’s height comes from its photo and Height choice."
                    }
                    onChange={padding.change}
                  />
                  <SpacingBox
                    title="Margin"
                    values={margin.values}
                    placeholders={margin.placeholders}
                    hint="Space around. Left and right narrow the section — with a colour and corners, a card."
                    onChange={margin.change}
                  />
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Off: the design’s own spacing for this section.</p>
              )}
            </div>
          </Part>
        ) : null}

        {hasBorder ? (
          <Part
            title="Border & shadow"
            changed={Boolean(
              (settings.border && settings.border !== "none") ||
                Number(settings.radius) > 0 ||
                design.radius ||
                design.images?.radius ||
                design.shadow ||
                design.opacity !== undefined,
            )}
            defaultOpen={false}
          >
            <div className="space-y-4">
              {plain(field("border"))}
              {plain(field("borderWidth"))}
              {plain(field("borderColor"))}
              {field("radius") ? (
                <DeviceNumber
                  label={photos ? "Section corners" : "Rounded corners"}
                  hint={
                    boxShows
                      ? "Rounds the section’s background and line."
                      : `Rounds the section’s background and line — they show once it has a colour or a line.${photos ? " For the photos, use Photo corners." : ""}`
                  }
                  max={48}
                  desktop={Number(settings.radius) || 0}
                  onDesktop={(next) => onChange("radius", next)}
                  own={(target) => getDesign(["radius", target]) as number | undefined}
                  onOwn={(target, next) => setDesign(["radius", target], next)}
                />
              ) : null}
              {photos ? (
                <Slider
                  label="Photo corners"
                  hint="Rounds every photograph in this section."
                  unit="px"
                  min={0}
                  max={120}
                  step={1}
                  value={getDesign(["images", "radius"]) as number | undefined}
                  placeholder="0"
                  onChange={(next) => setDesign(["images", "radius"], next === 0 ? undefined : next)}
                />
              ) : null}
              {effects ? (
                <>
                  <Segmented
                    label="Shadow"
                    value={(getDesign(["shadow"]) as string | undefined) ?? "none"}
                    options={Object.entries(SHADOWS).map(([value, shadow]) => ({ value, label: shadow.label }))}
                    onChange={(next) => setDesign(["shadow"], next === "none" ? undefined : next)}
                  />
                  <Slider
                    label="Transparency"
                    hint="The whole section, content and all. 100% is fully visible."
                    unit="%"
                    min={10}
                    max={100}
                    step={5}
                    value={getDesign(["opacity"]) as number | undefined}
                    placeholder="100"
                    onChange={(next) => setDesign(["opacity"], next === 100 ? undefined : next)}
                  />
                </>
              ) : null}
            </div>
          </Part>
        ) : null}

        {designField ? (
          <DesignControls
            value={design}
            parts={parts.filter(
              (part) =>
                !["background", "spacing", "effects"].includes(part) &&
                (part !== "images" || (!IMAGE_GROUND_CATEGORIES.includes(category) && contents?.image !== false)),
            )}
            align={textAlign}
            contents={contents}
            onChange={(next) => onChange("design", next)}
            visibility={visibilityOf(settings, onChange)}
          />
        ) : null}
      </div>

      {changed && (
        <>
          <Separator />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              for (const [key, value] of Object.entries(STYLE_RESET)) {
                if (key in settings && !same(settings[key], value)) onChange(key, value);
              }
            }}
          >
            <RotateCcwIcon />
            Reset style
          </Button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Page settings
 * -------------------------------------------------------------------------- */

const PAGE_SURFACE_OPTIONS = SURFACE_OPTIONS.filter((option) =>
  (PAGE_SURFACES as readonly string[]).includes(option.value),
);

function SurfaceSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldControl
      field={{ kind: "select", key: id, label: id, options: PAGE_SURFACE_OPTIONS, default: "light" }}
      value={value}
      inputId={id}
      collections={[]}
      onChange={(next) => onChange(next as string)}
    />
  );
}

export function PageSettingsEditor({
  settings,
  settingsHref,
  onBack,
  onChange,
}: {
  settings: PageSettings;
  /** The page's own settings screen — title, address, SEO. */
  settingsHref: string;
  onBack: () => void;
  onChange: (key: keyof PageSettings, value: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to sections" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <h2 className="text-sm font-medium">Page colours</h2>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label htmlFor="page-surface" className="text-xs">
            Page background
          </Label>
          <SurfaceSelect id="page-surface" value={settings.surface} onChange={(value) => onChange("surface", value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="page-footer" className="text-xs">
            Footer background
          </Label>
          <SurfaceSelect
            id="page-footer"
            value={settings.footerSurface}
            onChange={(value) => onChange("footerSurface", value)}
          />
        </div>

        <p className="text-muted-foreground text-xs">
          The page’s title, web address, visibility and Google listing are set in{" "}
          <a href={settingsHref} className="text-foreground font-medium underline underline-offset-2">
            page settings
          </a>
          .
        </p>
      </div>
    </div>
  );
}
