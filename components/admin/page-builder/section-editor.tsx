"use client";

import { ArrowLeftIcon, CopyIcon, EyeIcon, EyeOffIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Separator } from "@/components/admin/ui/separator";
import { Textarea } from "@/components/admin/ui/textarea";
import { PAGE_SURFACES, type PageSettings, type SectionInstance } from "@/lib/page-builder/document";
import { SURFACE_OPTIONS } from "@/lib/page-builder/define-section";
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
  collections,
  onBack,
  onChange,
  onToggle,
  onDuplicate,
  onRemove,
}: {
  section: SectionInstance;
  collections: CollectionOption[];
  onBack: () => void;
  onChange: (key: string, value: unknown) => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const definition = sectionDefinition(section.type);
  if (!definition) return null;

  const settings = section.settings as Record<string, unknown>;
  const active = definition.fields.filter((field) => isFieldActive(field, settings));
  const content = active.filter((field) => (field.group ?? "content") === "content");
  const layout = active.filter((field) => field.group === "layout");

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

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <p className="text-muted-foreground text-xs">{definition.description}</p>

        {!section.visible && (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs">
            Hidden — this section is not on the page. Its settings are kept.
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

        {content.length === 0 && layout.length === 0 && (
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
            </div>
          </>
        )}
      </div>
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
  pageTitle,
  onBack,
  onChange,
}: {
  settings: PageSettings;
  pageTitle: string;
  onBack: () => void;
  onChange: (key: keyof PageSettings, value: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to sections" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <h2 className="text-sm font-medium">Page settings</h2>
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

        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="page-seo-title" className="text-xs">
            Search title
          </Label>
          <Input
            id="page-seo-title"
            value={settings.seoTitle}
            maxLength={70}
            placeholder={pageTitle}
            onChange={(event) => onChange("seoTitle", event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {settings.seoTitle.length}/70 — leave empty to use the page title.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="page-seo-description" className="text-xs">
            Search description
          </Label>
          <Textarea
            id="page-seo-description"
            value={settings.seoDescription}
            maxLength={320}
            rows={4}
            onChange={(event) => onChange("seoDescription", event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {settings.seoDescription.length}/320 — what search engines show under the title. Goes live on publish.
          </p>
        </div>
      </div>
    </div>
  );
}
