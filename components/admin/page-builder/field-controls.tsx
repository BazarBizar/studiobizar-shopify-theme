"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  Columns2Icon,
  Columns3Icon,
  CopyIcon,
  GripVerticalIcon,
  HeadingIcon,
  ImageIcon,
  ListCollapseIcon,
  ListIcon,
  MinusIcon,
  MousePointerClickIcon,
  MoveVerticalIcon,
  PanelTopIcon,
  PilcrowIcon,
  PlusIcon,
  QuoteIcon,
  ShoppingBagIcon,
  SparklesIcon,
  SquareIcon,
  TagIcon,
  Trash2Icon,
  VideoIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as React from "react";
import { toast } from "sonner";

import { CataloguePicker } from "@/components/admin/catalogue-picker";
import { DestinationPicker, type DestinationOption } from "@/components/admin/destination-picker";
import { MediaPicker, type MediaPick } from "@/components/admin/media/media-picker";
import { MediaRows, MediaSlot, moved } from "@/components/admin/media/media-selection";
import { SectionIcon } from "@/components/sections/section-icon";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { type PickerFile } from "@/lib/admin/queries";
import {
  blockDefinition,
  createBlock,
  HEX_COLOR,
  isFieldActive,
  isFieldFilled,
  isSafeHref,
  newBlockId,
  parseVideoUrl,
  type BlockDef,
  type BlockLayout,
  type BlocksFieldDef,
  type BlockValue,
  type CaptionedImageValue,
  type FieldDef,
  type ImageRef,
  type LinkValue,
  type ResourceRef,
  type SelectDisplay,
} from "@/lib/page-builder/fields";
import type { DesignValue } from "@/lib/page-builder/design";
import { blockWithExamples, NO_EXAMPLE_MEDIA, type ExampleMedia } from "@/lib/page-builder/examples";
import { cdnImage } from "@/lib/shopify/transforms";
import { cn } from "@/lib/utils/cn";

import { DesignControls } from "./design-controls";

/**
 * One input per field KIND — the only place the builder decides what a setting
 * looks like in the form. A section never brings a form of its own; it brings a
 * field list, and this renders it.
 */

export type CollectionOption = ResourceRef & { thumbnail: string | null };

/** A place on the site a button can point at, offered by the link picker. */
export type LinkTarget = { label: string; href: string; group: "Pages" | "Collections" | "Site" };

/**
 * What the form offers to pick from, loaded once for the whole editor rather than
 * threaded through every field: link destinations and the FAQ categories in use.
 */
export type EditorLookups = {
  linkTargets: LinkTarget[];
  faqCategories: string[];
  /** The shop's photographs and products a newly added section is filled with — see `lib/page-builder/examples.ts`. */
  examples?: ExampleMedia;
  /** Menus a Theme Builder menu element can show: the site's own by key, others by handle. */
  menus?: { value: string; label: string }[];
  /** The site's saved colours (Header & footer → Site style), offered in every colour picker. */
  savedColours?: { name: string; value: string }[];
};

export const EditorLookupsContext = React.createContext<EditorLookups>({ linkTargets: [], faqCategories: [] });

type ControlProps = {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  inputId: string;
  collections: CollectionOption[];
};

export function FieldControl({ field, value, onChange, inputId, collections }: ControlProps) {
  switch (field.kind) {
    case "text":
      if (field.suggest) {
        return <SuggestField inputId={inputId} value={(value as string) ?? ""} kind={field.suggest} onChange={onChange} />;
      }
      return (
        <Input
          id={inputId}
          value={(value as string) ?? ""}
          maxLength={field.max}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "textarea":
      return (
        <Textarea
          id={inputId}
          value={(value as string) ?? ""}
          maxLength={field.max}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "richText":
      return (
        <RichTextEditor
          value={(value as string) || null}
          onChange={(next) => onChange(next)}
          ariaLabel={field.label}
        />
      );

    case "image":
      return <ImageField value={(value as ImageRef | null) ?? null} onChange={onChange} label={field.label} />;

    case "imageList":
      return (
        <ImageListField
          value={(value as CaptionedImageValue[]) ?? []}
          onChange={onChange}
          label={field.label}
          max={field.max}
          captions={field.captions}
        />
      );

    case "link":
      return <LinkField value={(value as LinkValue | null) ?? null} onChange={onChange} inputId={inputId} />;

    case "url":
      return <HrefField inputId={inputId} href={(value as string) ?? ""} onChange={(href) => onChange(href)} />;

    case "video": {
      const address = (value as string) ?? "";
      const parsed = address ? parseVideoUrl(address) : null;
      return (
        <div className="space-y-1">
          <Input
            id={inputId}
            value={address}
            maxLength={512}
            placeholder="Paste a YouTube or Vimeo link"
            aria-invalid={address !== "" && !parsed}
            onChange={(event) => onChange(event.target.value.trim())}
          />
          {address !== "" &&
            (parsed ? (
              <p className="text-muted-foreground text-xs">
                {parsed.provider === "youtube" ? "YouTube" : "Vimeo"} video found.
              </p>
            ) : (
              <p className="text-destructive text-xs" role="alert">
                This doesn’t look like a YouTube or Vimeo link. Copy it from the video’s Share button.
              </p>
            ))}
        </div>
      );
    }

    case "blocks":
      return (
        <BlocksField
          field={field}
          value={(value as BlockValue[]) ?? []}
          onChange={onChange}
          collections={collections}
        />
      );

    case "select":
      return (
        <ChoiceField
          inputId={inputId}
          value={value as string}
          options={field.options}
          display={field.display}
          onChange={onChange}
        />
      );

    case "toggle":
      return <Switch id={inputId} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />;

    case "number":
      return <NumberField inputId={inputId} field={field} value={value as number | undefined} onChange={onChange} />;

    case "color":
      return <ColorField inputId={inputId} value={(value as string) ?? ""} onChange={onChange} />;

    case "design":
      return (
        <DesignControls
          value={(value as DesignValue | undefined) ?? {}}
          parts={field.parts}
          onChange={(next) => onChange(next)}
          {...(field.targets
            ? {
                align: false,
                contents: {
                  heading: field.targets.includes("heading"),
                  text: field.targets.includes("text"),
                  button: field.targets.includes("button"),
                },
              }
            : {})}
        />
      );

    case "product":
    case "products":
    case "collection":
    case "collections": {
      const multiple = field.kind === "products" || field.kind === "collections";
      const list = multiple ? ((value as ResourceRef[]) ?? []) : value ? [value as ResourceRef] : [];

      return (
        <ResourceField
          kind={field.kind.startsWith("product") ? "product" : "collection"}
          value={list}
          multiple={multiple}
          max={"max" in field ? field.max : 1}
          collections={collections}
          label={field.label}
          onChange={(next) => onChange(multiple ? next : (next[0] ?? null))}
        />
      );
    }
  }
}

/* -------------------------------------------------------------------------- *
 * Number and colour — the Style tab's controls
 * -------------------------------------------------------------------------- */

/**
 * A slider with the number beside it, as in Elementor: drag for a feel, type for
 * an exact value. Out-of-range typing is clamped rather than refused.
 */
function NumberField({
  inputId,
  field,
  value,
  onChange,
}: {
  inputId: string;
  field: { min: number; max: number; default: number; label: string };
  value: number | undefined;
  onChange: (value: unknown) => void;
}) {
  const current = value ?? field.default;
  const set = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    if (Number.isFinite(next)) onChange(Math.min(field.max, Math.max(field.min, next)));
  };

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={1}
        value={current}
        aria-label={field.label}
        onChange={(event) => set(event.target.value)}
        className="accent-primary h-1.5 min-w-0 flex-1 cursor-pointer"
      />
      <Input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={field.min}
        max={field.max}
        step={1}
        value={String(current)}
        onChange={(event) => set(event.target.value)}
        className="h-8 w-20 text-xs"
      />
    </div>
  );
}

/** The design's own palette first, so the obvious choices are one click away. */
const BRAND_COLOURS = [
  { value: "#ebe8e3", label: "Earth" },
  { value: "#302f2d", label: "Dark wood" },
  { value: "#41473e", label: "Black olive" },
  { value: "#47515c", label: "Charcoal blue" },
  { value: "#4a3c3f", label: "Deep mocha" },
  { value: "#1d1d1b", label: "Off-black" },
  { value: "#ffffff", label: "White" },
] as const;

export function ColorField({
  inputId,
  value,
  onChange,
}: {
  inputId: string;
  value: string;
  onChange: (value: unknown) => void;
}) {
  // The typed text, re-synced when the value changes from outside (a swatch, the
  // picker, undo) — adjusted during render rather than in an effect.
  const [draft, setDraft] = React.useState(value);
  const [synced, setSynced] = React.useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  const valid = draft === "" || HEX_COLOR.test(draft);
  const saved = React.useContext(EditorLookupsContext).savedColours ?? [];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {[...BRAND_COLOURS, ...saved.map((colour) => ({ value: colour.value.toLowerCase(), label: colour.name }))].map((swatch) => (
          <button
            key={swatch.value}
            type="button"
            title={swatch.label}
            aria-label={swatch.label}
            aria-pressed={value.toLowerCase() === swatch.value}
            onClick={() => onChange(swatch.value)}
            className={cn(
              "size-6 rounded-full border shadow-xs transition-transform hover:scale-110",
              value.toLowerCase() === swatch.value && "ring-ring ring-2 ring-offset-1",
            )}
            style={{ backgroundColor: swatch.value }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label
          className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border"
          title="Pick any colour"
          style={value ? { backgroundColor: value } : undefined}
        >
          {!value && (
            <span className="text-muted-foreground absolute inset-0 flex items-center justify-center text-[10px]">
              —
            </span>
          )}
          <input
            type="color"
            value={value || "#ffffff"}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Pick any colour"
          />
        </label>
        <Input
          id={inputId}
          value={draft}
          maxLength={7}
          placeholder="None"
          aria-invalid={!valid}
          onChange={(event) => {
            const next = event.target.value.trim();
            setDraft(next);
            if (next === "" || HEX_COLOR.test(next)) onChange(next.toLowerCase());
          }}
          className="h-8 w-24 text-xs"
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onChange("")}>
            <XIcon className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
      {!valid && <p className="text-destructive text-xs">Use a colour code like #302f2d, or pick one above.</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Images
 * -------------------------------------------------------------------------- */

/**
 * A picked file → the snapshot the document stores. Only an image Shopify has
 * finished processing has a CDN url; a fresh upload may not yet, and storing it
 * without one would store a section that cannot render.
 */
function toImageRef(file: PickerFile): ImageRef | null {
  if (!file.url || !/^https:\/\/cdn\.shopify\.com\//.test(file.url)) return null;
  if (file.kind !== "MediaImage" && !file.mimeType?.startsWith("image/")) return null;

  return { id: file.id, url: file.url, altText: file.alt, width: file.width, height: file.height };
}

/**
 * The picks from the shared `MediaPicker` → snapshots, refusing what cannot be
 * stored (say so once, keep the rest).
 */
function imagesFrom(picks: MediaPick[]): ImageRef[] {
  const images = picks.flatMap((pick) => {
    const image = pick.file ? toImageRef(pick.file) : null;
    return image ? [image] : [];
  });
  if (images.length < picks.length) {
    toast.error("A file can’t be used here", {
      description: "Choose an image. A file uploaded a moment ago may still be processing — try again shortly.",
    });
  }
  return images;
}

const previewOfImage = (image: ImageRef) => ({
  thumbnail: cdnImage(image.url, 160),
  label: image.altText ?? "",
  kind: "image" as const,
});

/**
 * The image's alt text FOR THIS USE. It starts as the file's own alt text from
 * Shopify; changing it here changes this page only, never the file. Empty means
 * the image is decorative, and the components fall back to the caption if there
 * is one.
 */
function AltInput({
  image,
  label,
  onChange,
}: {
  image: ImageRef;
  label: string;
  onChange: (image: ImageRef) => void;
}) {
  return (
    <label className="block space-y-0.5">
      <span
        className="text-muted-foreground text-[11px]"
        title="Describes the photo for Google and for people who cannot see it."
      >
        Image description
      </span>
      <Input
        value={image.altText ?? ""}
        maxLength={512}
        placeholder="e.g. Oak dining table in a bright room"
        aria-label={`${label} image description`}
        onChange={(event) => onChange({ ...image, altText: event.target.value || null })}
        className="h-7 text-xs"
      />
    </label>
  );
}

/** One image — the shared `MediaSlot` and `MediaPicker`, as on every form in the panel. */
export function ImageField({
  value,
  onChange,
  label,
}: {
  value: ImageRef | null;
  onChange: (value: ImageRef | null) => void;
  label: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <MediaSlot
        preview={value ? previewOfImage(value) : null}
        onChoose={() => setOpen(true)}
        onRemove={() => onChange(null)}
      >
        {value && <AltInput image={value} label={label} onChange={onChange} />}
      </MediaSlot>
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        title={label.toLowerCase()}
        selectedIds={value ? [value.id] : []}
        onSelect={(picks) => {
          const [image] = imagesFrom(picks);
          if (image) onChange(image);
        }}
      />
    </>
  );
}

/**
 * Several images, in an order that matters, each with an optional caption — the
 * shared `MediaRows`, several chosen at once in the `MediaPicker`. Reordered by
 * buttons rather than by drag: this sits inside the section list's own drag
 * context, and a nested one fights it.
 */
function ImageListField({
  value,
  onChange,
  label,
  max,
  captions,
}: {
  value: CaptionedImageValue[];
  onChange: (value: CaptionedImageValue[]) => void;
  label: string;
  max: number;
  captions: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const update = (index: number, item: CaptionedImageValue) => {
    const next = [...value];
    next[index] = item;
    onChange(next);
  };

  return (
    <>
      <MediaRows
        noun="images"
        max={max}
        rows={value.map((item, index) => ({
          key: `${item.image.id}-${index}`,
          preview: { ...previewOfImage(item.image), label: "" },
          extra: (
            <>
              {captions && (
                <label className="block space-y-0.5">
                  <span className="text-muted-foreground text-[11px]">Caption (optional)</span>
                  <Input
                    value={item.caption}
                    maxLength={200}
                    aria-label={`${label} ${index + 1} caption`}
                    onChange={(event) => update(index, { ...item, caption: event.target.value })}
                    className="h-7 text-xs"
                  />
                </label>
              )}
              <AltInput image={item.image} label={`${label} ${index + 1}`} onChange={(image) => update(index, { ...item, image })} />
            </>
          ),
        }))}
        onMove={(index, delta) => onChange(moved(value, index, delta))}
        onRemove={(index) => onChange(value.filter((_, position) => position !== index))}
        onAdd={() => setOpen(true)}
      />
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        title={label.toLowerCase()}
        multiple
        limit={max - value.length}
        selectedIds={value.map((item) => item.image.id)}
        onSelect={(picks) => onChange([...value, ...imagesFrom(picks).map((image) => ({ image, caption: "" }))])}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- *
 * Links and choices
 * -------------------------------------------------------------------------- */

function LinkField({
  value,
  onChange,
  inputId,
}: {
  value: LinkValue | null;
  onChange: (value: LinkValue | null) => void;
  inputId: string;
}) {
  const label = value?.label ?? "";
  const href = value?.href ?? "";

  const update = (next: Partial<LinkValue>) => {
    const merged = { label, href, ...next };
    onChange(merged.label === "" && merged.href === "" ? null : merged);
  };

  return (
    <div className="space-y-2">
      <Input
        id={inputId}
        value={label}
        maxLength={80}
        placeholder="Button text, e.g. shop the collection"
        onChange={(event) => update({ label: event.target.value })}
      />
      <HrefField
        href={href}
        // A page picked for an empty button names the button after it.
        onChange={(next, picked) => update({ href: next, ...(picked && !label ? { label: picked.toLowerCase() } : {}) })}
      />
    </div>
  );
}

const ANOTHER_WEBSITE = "__another_website__";

/**
 * Where a link goes, in the page builder — the panel's shared
 * `DestinationPicker` (as in Menus) over the site's pages and collections, with
 * "Another website" opening an address field.
 */
function HrefField({
  inputId,
  href,
  onChange,
}: {
  inputId?: string;
  href: string;
  onChange: (href: string, pickedLabel?: string) => void;
}) {
  const { linkTargets } = React.useContext(EditorLookupsContext);
  const onList = linkTargets.some((target) => target.href === href);
  const [typing, setTyping] = React.useState(href !== "" && !onList);
  const unsafe = href !== "" && !isSafeHref(href);

  const options: DestinationOption[] = [
    ...linkTargets.map((target) => ({ value: target.href, label: target.label, group: target.group, hint: target.href })),
    { value: ANOTHER_WEBSITE, label: "Another website (type the address)", group: "Other" },
  ];

  return (
    <div className="space-y-2">
      <DestinationPicker
        id={inputId}
        value={typing ? ANOTHER_WEBSITE : onList ? href : ""}
        options={options}
        placeholder="Choose where it goes"
        onChange={(next) => {
          if (next === ANOTHER_WEBSITE) {
            setTyping(true);
            if (onList) onChange("");
            return;
          }
          setTyping(false);
          onChange(next, linkTargets.find((target) => target.href === next)?.label);
        }}
      />
      {typing && (
        <Input
          value={href}
          maxLength={2048}
          placeholder="e.g. https://www.instagram.com/studiobizar"
          aria-label="Web address"
          aria-invalid={unsafe}
          onChange={(event) => onChange(event.target.value.trim())}
          className="text-xs"
        />
      )}
      {unsafe && (
        <p className="text-destructive text-xs" role="alert">
          Use a full web address starting with https://, or choose a page from the list.
        </p>
      )}
    </div>
  );
}

/**
 * Two or three options are a row of buttons — every choice visible, one click.
 * More than that is a select.
 */
function ChoiceField({
  inputId,
  value,
  options,
  display,
  onChange,
}: {
  inputId: string;
  value: string;
  options: readonly { value: string; label: string }[];
  display?: SelectDisplay;
  onChange: (value: string) => void;
}) {
  if (display === "position") {
    // A 3 × 3 grid standing for the image — the cell picked is where the copy sits.
    return (
      <div
        id={inputId}
        role="radiogroup"
        className="bg-muted grid aspect-[16/10] w-36 grid-cols-3 grid-rows-3 gap-1 rounded-lg border p-1.5"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center justify-center rounded transition-colors",
              value === option.value ? "bg-primary" : "bg-background hover:bg-primary/20",
            )}
          >
            <span
              className={cn("block h-1 w-4 rounded-full", value === option.value ? "bg-primary-foreground" : "bg-muted-foreground/40")}
            />
          </button>
        ))}
      </div>
    );
  }

  if (display === "icons") {
    return (
      <div id={inputId} role="radiogroup" className="grid grid-cols-8 gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border transition-colors",
              value === option.value ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {option.value === "none" ? <XIcon className="size-3.5" /> : <SectionIcon name={option.value} className="size-4" />}
          </button>
        ))}
      </div>
    );
  }

  if (options.length <= 3 || display === "buttons") {
    return (
      <div id={inputId} role="radiogroup" className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              value === option.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={inputId} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* -------------------------------------------------------------------------- *
 * Products and collections
 * -------------------------------------------------------------------------- */

/**
 * Products and collections in a section — the panel's shared `CataloguePicker`, the
 * same dialog the content forms use. The document stores a snapshot (id, handle,
 * title), so the picker hands back the records, not just their ids.
 */
function ResourceField({
  kind,
  value,
  multiple,
  max,
  collections,
  label,
  onChange,
}: {
  kind: "product" | "collection";
  value: ResourceRef[];
  multiple: boolean;
  max: number;
  collections: CollectionOption[];
  label: string;
  onChange: (value: ResourceRef[]) => void;
}) {
  return (
    <CataloguePicker
      kind={kind}
      multiple={multiple}
      max={multiple ? max : undefined}
      value={value.map((item) => item.id)}
      current={value.map((item) => ({ id: item.id, label: item.title, thumbnail: null, handle: item.handle }))}
      collectionOptions={collections.map((item) => ({
        id: item.id,
        label: item.title,
        thumbnail: item.thumbnail,
        handle: item.handle,
      }))}
      label={label}
      onChange={(_, items) =>
        onChange(items.map((item) => ({ id: item.id, handle: item.handle ?? "", title: item.label })))
      }
    />
  );
}

/* -------------------------------------------------------------------------- *
 * Blocks
 * -------------------------------------------------------------------------- */

/** Plain text out of Shopify's rich text AST, for a one-line summary. */
function plainText(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  try {
    const walk = (node: { value?: unknown; children?: unknown }): string =>
      (typeof node.value === "string" ? node.value : "") +
      (Array.isArray(node.children) ? node.children.map((child) => walk(child as never)).join(" ") : "");
    return walk(JSON.parse(value)).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

/** What a block is called in the list: its summary field, else the first thing it says. */
function blockSummary(definition: BlockDef, settings: Record<string, unknown>): string {
  const keys = definition.summaryKey ? [definition.summaryKey] : definition.fields.map((field) => field.key);
  for (const key of keys) {
    const value = settings[key];
    if (typeof value === "string" && value.trim() && !value.startsWith("{")) return value.trim();
    if (typeof value === "string") {
      const text = plainText(value);
      if (text) return text;
    }
    if (value && typeof value === "object" && "label" in value && typeof value.label === "string" && value.label) {
      return value.label;
    }
    if (value && typeof value === "object" && "title" in value && typeof value.title === "string" && value.title) {
      return value.title;
    }
  }
  return "";
}

/** The picture beside each block type in the list and the picker. */
const BLOCK_ICONS: Record<string, LucideIcon> = {
  heading: HeadingIcon,
  eyebrow: TagIcon,
  text: PilcrowIcon,
  button: MousePointerClickIcon,
  image: ImageIcon,
  icon: SparklesIcon,
  card: PanelTopIcon,
  list: ListIcon,
  quote: QuoteIcon,
  fold: ListCollapseIcon,
  video: VideoIcon,
  product: ShoppingBagIcon,
  line: MinusIcon,
  space: MoveVerticalIcon,
  column: Columns2Icon,
};

const blockIcon = (type: string) => BLOCK_ICONS[type] ?? SquareIcon;

const WIDTH_WORDS: Record<string, string> = {
  equal: "auto width",
  "100": "full width",
  "75": "75%",
  "67": "66%",
  "50": "half",
  "33": "a third",
  "25": "a quarter",
  "20": "a fifth",
};

/** "Half · full width on phones" — what a Column is, in the list. */
function columnSummary(settings: Record<string, unknown>): string {
  const desktop = WIDTH_WORDS[String(settings.width)] ?? "";
  const phones = WIDTH_WORDS[String(settings.widthMobile)] ?? "";
  return [desktop && `${desktop[0]!.toUpperCase()}${desktop.slice(1)}`, phones && `${phones} on phones`]
    .filter(Boolean)
    .join(" · ");
}

/** Where a run of blocks starting at `index` ends: at the next Column, or the end. */
function runEnd(value: BlockValue[], field: BlocksFieldDef, index: number): number {
  let end = index + 1;
  while (end < value.length && !blockDefinition(field, value[end]!.type)?.column) end += 1;
  return end;
}

const withFreshIds = (items: BlockValue[]) =>
  items.map((item) => ({ ...item, id: newBlockId(), settings: structuredClone(item.settings) }));

/**
 * The blocks inside a section, edited in place: each is a row that opens to its
 * own fields, with move, duplicate and delete beside it. One row is open at a
 * time, so a long FAQ stays scannable.
 *
 * Where the section has COLUMN blocks (the Custom section), the blocks after a
 * Column are drawn under it, indented, and the Column row has its own "+" that adds
 * a block at the end of that column. Moving, duplicating or deleting a Column takes
 * its blocks with it.
 *
 * A new block arrives filled with example words and the shop's own photos, so it
 * shows in the preview at once.
 *
 * Reordering: drag a row by its grip (or lift it with Space and move it with the
 * arrow keys), or use the arrows. The section list is not on screen while a section
 * is open, so this drag context never sits inside its own. A Column dragged takes
 * its blocks along and lands between columns — never splitting another one.
 */
function BlocksField({
  field,
  value,
  onChange,
  collections,
}: {
  field: BlocksFieldDef;
  value: BlockValue[];
  onChange: (value: BlockValue[]) => void;
  collections: CollectionOption[];
}) {
  const { examples } = React.useContext(EditorLookupsContext);
  const [openId, setOpenId] = React.useState<string | null>(value.length === 1 ? (value[0]?.id ?? null) : null);
  const full = value.length >= field.max;
  const isColumn = (item: BlockValue | undefined) => Boolean(item && blockDefinition(field, item.type)?.column);
  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dragging, setDragging] = React.useState<string | null>(null);

  const fresh = (definition: BlockDef, settings?: Record<string, unknown>): BlockValue => {
    const filled = blockWithExamples(definition, createBlock(definition), examples ?? NO_EXAMPLE_MEDIA);
    return settings ? { ...filled, settings: { ...filled.settings, ...settings } } : filled;
  };

  const insert = (items: BlockValue[], at = value.length) => {
    const room = field.max - value.length;
    if (room <= 0) return;
    const kept = items.slice(0, room);
    const next = [...value];
    next.splice(at, 0, ...kept);
    onChange(next);
    // Open the first block that says something — a Column's own settings can wait.
    setOpenId(kept.find((item) => !isColumn(item))?.id ?? kept[0]?.id ?? null);
    if (kept.length < items.length) toast(`Only ${kept.length} added — a section holds at most ${field.max} blocks.`);
  };

  const add = (definition: BlockDef, at?: number) => insert([fresh(definition)], at);

  const addLayout = (layout: BlockLayout) =>
    insert(
      layout.blocks.flatMap((item) => {
        const definition = blockDefinition(field, item.type);
        return definition ? [fresh(definition, item.settings)] : [];
      }),
    );

  const update = (id: string, key: string, next: unknown) =>
    onChange(value.map((item) => (item.id === id ? { ...item, settings: { ...item.settings, [key]: next } } : item)));

  /**
   * Where a Column moves to: the start of the column before it, or the end of the
   * one after it — never above blocks that are in no column, which would pull them in.
   */
  const columnTarget = (index: number, delta: number): number | null => {
    if (delta < 0) {
      let start = index - 1;
      while (start >= 0 && !isColumn(value[start])) start -= 1;
      return start >= 0 ? start : null;
    }
    const end = runEnd(value, field, index);
    return end < value.length ? runEnd(value, field, end) : null;
  };

  const move = (index: number, delta: number) => {
    if (isColumn(value[index])) {
      const target = columnTarget(index, delta);
      if (target === null) return;
      const end = runEnd(value, field, index);
      const run = value.slice(index, end);
      const rest = [...value.slice(0, index), ...value.slice(end)];
      // Moving down, the target was measured with this column still in place.
      rest.splice(delta < 0 ? target : target - run.length, 0, ...run);
      onChange(rest);
      return;
    }
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  /**
   * A drop. A block simply goes where it is dropped — into whichever column that is.
   * A Column goes with its blocks, to a boundary between columns: dropped on a block
   * further down, after that block's column; further up, before it; and never above
   * the blocks that are in no column, which it would otherwise take in.
   */
  const drop = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over || active.id === over.id) return;
    const from = value.findIndex((item) => item.id === active.id);
    const to = value.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    if (!isColumn(value[from])) {
      onChange(arrayMove(value, from, to));
      return;
    }
    const end = runEnd(value, field, from);
    if (to > from && to < end) return; // onto one of its own blocks
    const run = value.slice(from, end);
    const rest = [...value.slice(0, from), ...value.slice(end)];
    const target = rest.findIndex((item) => item.id === over.id);
    let start = target;
    while (start >= 0 && !isColumn(rest[start])) start -= 1;
    const firstColumn = rest.findIndex((item) => isColumn(item));
    const at =
      to > from
        ? start < 0
          ? Math.max(firstColumn, 0)
          : runEnd(rest, field, start)
        : start < 0
          ? firstColumn < 0
            ? rest.length
            : firstColumn
          : start;
    rest.splice(at, 0, ...run);
    onChange(rest);
  };

  /** While a Column is dragged, the blocks it takes along are dimmed. */
  const draggingRun = (() => {
    const index = value.findIndex((item) => item.id === dragging);
    if (index < 0 || !isColumn(value[index])) return new Set<string>();
    return new Set(value.slice(index + 1, runEnd(value, field, index)).map((item) => item.id));
  })();

  const duplicate = (index: number) => {
    const end = isColumn(value[index]) ? runEnd(value, field, index) : index + 1;
    if (value.length + (end - index) > field.max) {
      toast(`A section holds at most ${field.max} blocks.`);
      return;
    }
    const copies = withFreshIds(value.slice(index, end));
    const next = [...value];
    next.splice(end, 0, ...copies);
    onChange(next);
    setOpenId(copies[0]!.id);
  };

  const remove = (index: number) => {
    const before = value;
    const end = isColumn(value[index]) ? runEnd(value, field, index) : index + 1;
    const inside = end - index - 1;
    onChange([...value.slice(0, index), ...value.slice(end)]);
    if (value.slice(index, end).some((item) => item.id === openId)) setOpenId(null);
    if (inside > 0) {
      toast(`Column deleted, with the ${inside} block${inside > 1 ? "s" : ""} in it.`, {
        action: { label: "Undo", onClick: () => onChange(before) },
      });
    }
  };

  // Which column each block sits in, for the indent and the "Column 2" names.
  const rows = value.map((item, index) => {
    const column = isColumn(item);
    const number = value.slice(0, index + 1).filter(isColumn).length;
    return { item, index, column, number, inColumn: !column && number > 0 };
  });

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragStart={({ active }) => setDragging(String(active.id))}
          onDragCancel={() => setDragging(null)}
          onDragEnd={drop}
        >
        <SortableContext items={value.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {rows.map(({ item, index, column, number, inColumn }) => {
            const definition = blockDefinition(field, item.type);
            if (!definition) return null;

            const open = openId === item.id;
            const summary = column ? columnSummary(item.settings) : blockSummary(definition, item.settings);
            const incomplete = definition.fields.some(
              (child) =>
                child.required && isFieldActive(child, item.settings) && !isFieldFilled(child, item.settings[child.key]),
            );
            const Icon = blockIcon(item.type);
            const label = column ? `${definition.label} ${number}` : definition.label;
            const name = column ? label : `${label} ${index + 1}`;
            const end = column ? runEnd(value, field, index) : index + 1;
            const upDisabled = column ? columnTarget(index, -1) === null : index === 0;
            const downDisabled = column ? columnTarget(index, 1) === null : index === value.length - 1;

            return (
              <SortableRow
                key={item.id}
                id={item.id}
                label={name}
                dimmed={draggingRun.has(item.id)}
                className={cn(
                  "rounded-md border",
                  column && "bg-muted/60 mt-3 first:mt-0",
                  inColumn && "border-l-primary/40 ml-3 border-l-2",
                )}
              >
                {(grip) => (
                <>
                <div className="flex items-center gap-0.5 px-1 py-1">
                  {grip}
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left"
                  >
                    <ChevronRightIcon
                      className={cn("text-muted-foreground size-3.5 shrink-0 transition-transform", open && "rotate-90")}
                    />
                    <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{label}</span>
                      {summary && <span className="text-muted-foreground block truncate text-xs">{summary}</span>}
                    </span>
                  </button>

                  {column && (
                    <BlockPicker
                      field={field}
                      disabled={full}
                      onPick={(picked) => add(picked, end)}
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Add a block to ${label}`}
                          title="Add a block to this column"
                          disabled={full}
                        >
                          <PlusIcon />
                        </Button>
                      }
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${name} up`}
                    disabled={upDisabled}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${name} down`}
                    disabled={downDisabled}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Duplicate ${name}`}
                    disabled={full}
                    onClick={() => duplicate(index)}
                  >
                    <CopyIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive"
                    aria-label={`Delete ${name}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>

                {incomplete && !open && (
                  <p className="px-3 pb-1.5 text-xs text-amber-600 dark:text-amber-500">
                    Has an empty required field — needed before publishing.
                  </p>
                )}
                {column && end === index + 1 && !open && (
                  <p className="text-muted-foreground px-3 pb-1.5 text-xs">Empty — use + to put a block in it.</p>
                )}

                {open && (
                  <BlockFields
                    definition={definition}
                    item={item}
                    collections={collections}
                    onChange={(key, next) => update(item.id, key, next)}
                  />
                )}
                </>
                )}
              </SortableRow>
            );
          })}
        </ul>
        </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2">
        {field.blocks.length === 1 ? (
          <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add(field.blocks[0]!)}>
            <PlusIcon className="size-3.5" />
            Add {field.blocks[0]!.label.toLowerCase()}
          </Button>
        ) : field.blocks.length >= 5 ? (
          <BlockPicker
            field={field}
            disabled={full}
            onPick={(picked) => add(picked)}
            onLayout={addLayout}
            trigger={
              <Button type="button" variant="outline" size="sm" disabled={full}>
                <PlusIcon className="size-3.5" />
                Add block
              </Button>
            }
          />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={full}>
                <PlusIcon className="size-3.5" />
                Add block
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {field.blocks.map((definition) => (
                <DropdownMenuItem key={definition.type} onSelect={() => add(definition)}>
                  {definition.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="text-muted-foreground text-xs">
          {value.length} of {field.max}
        </span>
      </div>
    </div>
  );
}

/** One block's row: dnd-kit's sortable item, with a grip handed to its header. */
function SortableRow({
  id,
  label,
  dimmed,
  className,
  children,
}: {
  id: string;
  label: string;
  dimmed: boolean;
  className: string;
  children: (grip: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const grip = (
    <button
      type="button"
      aria-label={`Drag ${label} to reorder`}
      title="Drag to reorder"
      className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon className="size-3.5" />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform ? { ...transform, x: 0, scaleX: 1, scaleY: 1 } : null),
        transition,
      }}
      className={cn(className, isDragging && "bg-background relative z-10 shadow-md", dimmed && "opacity-40")}
    >
      {children(grip)}
    </li>
  );
}

/**
 * Every block type as a tile — its picture, its name and one line on what it is —
 * and below them the ready-made layouts. Typing narrows the tiles, and Enter adds
 * the first one left, so the block you want is two keys away.
 */
function BlockPicker({
  field,
  disabled,
  onPick,
  onLayout,
  trigger,
}: {
  field: BlocksFieldDef;
  disabled: boolean;
  onPick: (definition: BlockDef) => void;
  /** Absent where a layout makes no sense — adding into one column. */
  onLayout?: (layout: BlockLayout) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const words = query.trim().toLowerCase();
  const matches = (label: string, description = "") => !words || `${label} ${description}`.toLowerCase().includes(words);
  // Inside a column, a Column block would start a new one — not what "+" on a column means.
  const tiles = field.blocks.filter(
    (definition) => (onLayout || !definition.column) && matches(definition.label, definition.description),
  );
  const layouts = onLayout ? (field.layouts ?? []).filter((layout) => matches(layout.label, layout.description)) : [];

  const pick = (action: () => void) => {
    action();
    setOpen(false);
    setQuery("");
  };

  const tile = (key: string, Icon: LucideIcon, label: string, description: string | undefined, action: () => void) => (
    <button
      key={key}
      type="button"
      onClick={() => pick(action)}
      className="hover:bg-muted focus-visible:bg-muted flex items-start gap-2 rounded-md p-2 text-left outline-none"
    >
      <span className="bg-muted text-foreground flex size-7 shrink-0 items-center justify-center rounded">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        {description && (
          <span className="text-muted-foreground line-clamp-2 block text-[11px] leading-snug">{description}</span>
        )}
      </span>
    </button>
  );

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-0">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            aria-label="Search blocks"
            placeholder="Search — heading, photo, button…"
            className="h-8 text-xs"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (tiles[0]) pick(() => onPick(tiles[0]!));
              else if (layouts[0]) pick(() => onLayout!(layouts[0]!));
            }}
          />
        </div>
        <div className="max-h-[min(26rem,60svh)] overflow-y-auto p-2">
          {tiles.length > 0 && (
            <div className="grid grid-cols-2 gap-1">
              {tiles.map((definition) =>
                tile(definition.type, blockIcon(definition.type), definition.label, definition.description, () =>
                  onPick(definition),
                ),
              )}
            </div>
          )}
          {layouts.length > 0 && (
            <>
              <p className="text-muted-foreground mt-3 mb-1 px-2 text-[11px] font-medium tracking-wide uppercase">
                Ready-made layouts
              </p>
              <div className="grid grid-cols-2 gap-1">
                {layouts.map((layout) =>
                  tile(layout.id, Columns3Icon, layout.label, layout.description, () => onLayout!(layout)),
                )}
              </div>
            </>
          )}
          {tiles.length === 0 && layouts.length === 0 && (
            <p className="text-muted-foreground p-4 text-center text-xs">No block matches “{query}”.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- *
 * Pick-lists
 * -------------------------------------------------------------------------- */

/**
 * The site's pages and collections, to point a button at without knowing the
 * address. Pasting a URL still works for anything else.
 */
/** A text value chosen from the ones already in use — the FAQ categories. */
/**
 * One open block's form. What the block SAYS comes first; how it looks (fields in a
 * style, layout or advanced group) is folded below, so a slide with a dozen design
 * options still opens on its photo and words.
 */
function BlockFields({
  definition,
  item,
  collections,
  onChange,
}: {
  definition: BlockDef;
  item: BlockValue;
  collections: CollectionOption[];
  onChange: (key: string, next: unknown) => void;
}) {
  const active = definition.fields.filter((child) => isFieldActive(child, item.settings));
  const says = active.filter((child) => (child.group ?? "content") === "content");
  const looks = active.filter((child) => (child.group ?? "content") !== "content");

  const render = (child: (typeof active)[number]) => {
    const inputId = `${item.id}-${child.key}`;
    // The design panel names its own parts; a label above it would say it twice.
    if (child.kind === "design") {
      return (
        <FieldControl
          key={child.key}
          field={child}
          value={item.settings[child.key]}
          inputId={inputId}
          collections={collections}
          onChange={(next) => onChange(child.key, next)}
        />
      );
    }
    const missing = child.required && !isFieldFilled(child, item.settings[child.key]);
    const inline = child.kind === "toggle";

    return (
      <div key={child.key} className={inline ? "flex items-center justify-between gap-4" : "space-y-1.5"}>
        <Label htmlFor={inputId} className="text-xs">
          {child.label}
          {child.required && (
            <span className="text-muted-foreground" aria-label="required">
              *
            </span>
          )}
        </Label>
        <FieldControl
          field={child}
          value={item.settings[child.key]}
          inputId={inputId}
          collections={collections}
          onChange={(next) => onChange(child.key, next)}
        />
        {child.help && !inline && <p className="text-muted-foreground text-xs">{child.help}</p>}
        {missing && <p className="text-xs text-amber-600 dark:text-amber-500">Needed before this page can be published.</p>}
      </div>
    );
  };

  return (
    <div className="space-y-3 border-t px-3 py-3">
      {says.map(render)}
      {looks.length > 0 && (
        <details className="group/looks rounded-md border">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="text-muted-foreground size-3.5 transition-transform group-open/looks:rotate-90" />
            Position &amp; style
          </summary>
          <div className="space-y-3 border-t px-3 py-3">{looks.map(render)}</div>
        </details>
      )}
    </div>
  );
}

function SuggestField({
  inputId,
  value,
  kind,
  onChange,
}: {
  inputId: string;
  value: string;
  kind: "faqCategories" | "menus";
  onChange: (value: string) => void;
}) {
  const lookups = React.useContext(EditorLookupsContext);
  const choices =
    kind === "menus" ? (lookups.menus ?? []) : lookups.faqCategories.map((category) => ({ value: category, label: category }));
  const known = choices.map((choice) => choice.value);
  const labelOf = (option: string) => choices.find((choice) => choice.value === option)?.label ?? option;
  // A stored value no longer in use stays selectable, so opening the form never
  // silently changes it.
  const options = value && !known.includes(value) ? [value, ...known] : known;

  if (options.length === 0) {
    return <Input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} />;
  }

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={inputId} className="w-full">
        <SelectValue placeholder={kind === "menus" ? "Choose a menu" : "Choose a category"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {labelOf(option)}
            {!known.includes(option) ? (kind === "menus" ? " (deleted)" : " (no longer used)") : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
