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
import { isFieldActive, isFieldFilled, type FieldDef } from "@/lib/page-builder/fields";
import { sectionDefinition } from "@/lib/page-builder/registry";

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
  onChange,
  onToggle,
  onDuplicate,
  onRemove,
}: {
  section: SectionInstance;
  /** The type of the section above — whether this one can share the page heading's band. */
  previousType: string | null;
  collections: CollectionOption[];
  tab: "content" | "style";
  onTabChange: (tab: "content" | "style") => void;
  onBack: () => void;
  onChange: (key: string, value: unknown) => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
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
  const offered = (field: FieldDef) =>
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
          sectionId={section.id}
          settings={settings}
          collections={collections}
          onChange={onChange}
        />
      ) : (
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <p className="text-muted-foreground text-xs">{definition.description}</p>

        {!section.visible && (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs">
            Hidden — this section is not on the page. Its settings are kept.
          </p>
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
                  Shares the page heading’s band, so it takes the heading’s background and spacing.
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
  sectionId,
  settings,
  collections,
  onChange,
}: {
  fields: FieldDef[];
  joined: boolean;
  sectionId: string;
  settings: Record<string, unknown>;
  collections: CollectionOption[];
  onChange: (key: string, value: unknown) => void;
}) {
  const grouped = STYLE_GROUPS.map((group, index) => ({
    title: group.title,
    fields: fields.filter((field) =>
      (group.keys as readonly string[]).includes(field.key) ||
      (index === 0 && !STYLE_GROUPS.some((other) => (other.keys as readonly string[]).includes(field.key))),
    ),
  })).filter((group) => group.fields.length > 0);

  const changed = Object.entries(STYLE_RESET).some(
    ([key, value]) => key in settings && settings[key] !== value,
  );

  // A new background with no text colour yet gets a readable one alongside it —
  // still the editor's to change.
  const change = (key: string, value: unknown) => {
    onChange(key, value);
    if (key === "bgColor" && typeof value === "string" && value && !settings.textColor) {
      onChange("textColor", contrastFor(value));
    }
  };

  if (joined) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-muted-foreground text-xs">
          This section shares the page heading’s band, so it takes the heading’s style. Change
          the style on the Page heading instead, or set “Band” to “Separate band”.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4">
      {grouped.map((group, index) => (
        <React.Fragment key={group.title}>
          {index > 0 && <Separator />}
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{group.title}</h3>
            {group.fields.map((field) => (
              <Field
                key={field.key}
                field={field}
                sectionId={sectionId}
                settings={settings}
                collections={collections}
                onChange={change}
              />
            ))}
          </div>
        </React.Fragment>
      ))}

      {changed && (
        <>
          <Separator />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              for (const [key, value] of Object.entries(STYLE_RESET)) {
                if (key in settings && settings[key] !== value) onChange(key, value);
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
  onBack,
  onChange,
}: {
  settings: PageSettings;
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
          Title, address, visibility and search engine listing are page settings, on the Pages screen.
        </p>
      </div>
    </div>
  );
}
