"use client";

import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import { Label } from "@/components/admin/ui/label";
import { Separator } from "@/components/admin/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { PAGE_SURFACES, type PageSettings, type SectionInstance } from "@/lib/page-builder/document";
import { NEUTRAL_STYLE, SURFACE_OPTIONS } from "@/lib/page-builder/define-section";
import { contrastRatio, SURFACE_COLOURS, type DesignValue, type Device } from "@/lib/page-builder/design";
import { isFieldActive, isFieldFilled, number, type FieldDef } from "@/lib/page-builder/fields";
import { sectionDefinition } from "@/lib/page-builder/registry";

import type { SectionContents } from "@/components/page-builder/preview-bridge";

import { DesignControls } from "./design-controls";
import { DeviceSwitch } from "./editor-device";
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
  const showTabs = style.length > 0 || joined;

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

      {showTabs && tab === "style" ? (
        <StyleTab
          fields={style}
          joined={joined}
          category={definition.category}
          textAlign={definition.textAlign}
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

        {content.length === 0 && layout.length === 0 && advanced.length === 0 && !source && (
          <p className="text-muted-foreground text-xs">This section has nothing to set.</p>
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

/** Not a setting of its own: it edits the design's photo corners (`design.images.radius`). */
const PHOTO_CORNERS = number("photoCorners", "Photo corners (px)", {
  group: "style",
  min: 0,
  max: 120,
  default: 0,
  help: "Rounds every photograph in this section.",
});

/** The Style tab's three headings, by setting key. Anything else lands under the first. */
const STYLE_GROUPS = [
  { title: "Background & text", keys: ["surface", "bgColor", "textColor"] },
  { title: "Spacing", keys: ["rhythm", "customSpacing", "paddingTop", "paddingBottom", "marginTop", "marginBottom"] },
  { title: "Line & corners", keys: ["border", "borderWidth", "borderColor", "radius"] },
] as const;

const STYLE_RESET: Record<string, unknown> = { ...NEUTRAL_STYLE, surface: "inherit", rhythm: "default" };

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

function StyleTab({
  fields,
  joined,
  category,
  textAlign,
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
  contents: SectionContents | null;
  onOpenHeading: () => void;
  sectionId: string;
  settings: Record<string, unknown>;
  collections: CollectionOption[];
  onChange: (key: string, value: unknown) => void;
}) {
  // The design value has its own panel below the groups; see `DesignControls`.
  const designField = fields.find((field) => field.kind === "design");
  const plain = fields.filter((field) => field.kind !== "design");
  const grouped = STYLE_GROUPS.map((group, index) => ({
    title: group.title,
    fields: plain.filter((field) =>
      (group.keys as readonly string[]).includes(field.key) ||
      (index === 0 && !STYLE_GROUPS.some((other) => (other.keys as readonly string[]).includes(field.key))),
    ),
  })).filter((group) => group.fields.length > 0);

  const design = (settings.design as DesignValue | undefined) ?? {};
  // A banner's or a hero's photograph is its ground, not an image inside it; and a
  // section with no photograph has nothing for photo controls to shape.
  const photos =
    designField?.kind === "design" &&
    designField.parts.includes("images") &&
    !IMAGE_GROUND_CATEGORIES.includes(category) &&
    contents?.image !== false;
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
  const cornersField = (field: FieldDef): FieldDef =>
    field.key !== "radius"
      ? field
      : {
          ...field,
          label: photos ? "Section corners (px)" : field.label,
          help: boxShows
            ? "Rounds the section’s background and line."
            : `Rounds the section’s background and line — they show once it has a background colour or a line.${photos ? " For the photographs, use Photo corners." : ""}`,
        };
  const setPhotoCorners = (radius: unknown) => {
    const images = { ...design.images, radius: Number(radius) > 0 ? Number(radius) : undefined };
    onChange("design", { ...design, images });
  };

  const problems = readability(settings);
  // By value: the design is an object, and a fresh `{}` is never `===` another.
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const changed = Object.entries(STYLE_RESET).some(([key, value]) => key in settings && !same(settings[key], value));

  // A new background with no text colour yet gets a readable one alongside it —
  // still the editor's to change.
  const change = (key: string, value: unknown) => {
    onChange(key, value);
    if (key === "bgColor" && typeof value === "string" && value && !settings.textColor) {
      onChange("textColor", contrastFor(value));
    }
  };

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
    <div className="flex-1 space-y-5 overflow-y-auto p-4">
      {/* The device being edited — the same switch as above the preview. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Settings marked with a device icon can differ on desktop, tablet and mobile.
        </p>
        <DeviceSwitch />
      </div>

      {grouped.map((group, index) => (
        <React.Fragment key={group.title}>
          {index > 0 && <Separator />}
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{group.title}</h3>
            {group.fields.map((field) => (
              <React.Fragment key={field.key}>
                <Field
                  field={cornersField(field)}
                  sectionId={sectionId}
                  settings={settings}
                  collections={collections}
                  onChange={change}
                />
                {/* Next to the section's corners, where an editor looks for them —
                    the same value as "More design → Images → Rounded corners". */}
                {field.key === "radius" && photos ? (
                  <Field
                    field={PHOTO_CORNERS}
                    sectionId={sectionId}
                    settings={{ [PHOTO_CORNERS.key]: design.images?.radius ?? 0 }}
                    collections={collections}
                    onChange={(_, value) => setPhotoCorners(value)}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </React.Fragment>
      ))}

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

      {designField ? (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">More design</h3>
            <DesignControls
              value={(settings.design as DesignValue | undefined) ?? {}}
              parts={
                designField.kind === "design"
                  ? // A banner's or a hero's photograph is its ground, not an image inside it;
                    // and a section with no photograph has nothing for "Images" to shape.
                    designField.parts.filter(
                      (part) => part !== "images" || (!IMAGE_GROUND_CATEGORIES.includes(category) && contents?.image !== false),
                    )
                  : []
              }
              radiusBase={Number(settings.radius) || 0}
              align={textAlign}
              contents={contents}
              spacingBase={
                settings.customSpacing
                  ? {
                      pt: Number(settings.paddingTop),
                      pb: Number(settings.paddingBottom),
                      mt: Number(settings.marginTop),
                      mb: Number(settings.marginBottom),
                    }
                  : null
              }
              onChange={(next) => onChange("design", next)}
              visibility={visibilityOf(settings, onChange)}
            />
          </div>
        </>
      ) : null}

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
