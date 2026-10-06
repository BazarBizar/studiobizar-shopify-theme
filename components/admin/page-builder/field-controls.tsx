"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CopyIcon,
  ImageIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/media/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/admin/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/admin/ui/command";
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
import { useProductSearch, type PickerFile } from "@/lib/admin/queries";
import {
  blockDefinition,
  createBlock,
  isFieldActive,
  isFieldFilled,
  isSafeHref,
  newBlockId,
  type BlockDef,
  type BlocksFieldDef,
  type BlockValue,
  type CaptionedImageValue,
  type FieldDef,
  type ImageRef,
  type LinkValue,
  type ResourceRef,
} from "@/lib/page-builder/fields";
import { cdnImage } from "@/lib/shopify/transforms";
import { cn } from "@/lib/utils/cn";

/**
 * One input per field KIND — the only place the builder decides what a setting
 * looks like in the form. A section never brings a form of its own; it brings a
 * field list, and this renders it.
 */

export type CollectionOption = ResourceRef & { thumbnail: string | null };

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

    case "url": {
      const href = (value as string) ?? "";
      const unsafe = href !== "" && !isSafeHref(href);
      return (
        <div className="space-y-1">
          <Input
            id={inputId}
            value={href}
            maxLength={2048}
            placeholder="/"
            aria-invalid={unsafe}
            onChange={(event) => onChange(event.target.value.trim())}
            className="font-mono text-xs"
          />
          {unsafe && (
            <p className="text-destructive text-xs" role="alert">
              Use a path on this site like /shop, or an address starting with https://.
            </p>
          )}
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
          onChange={onChange}
        />
      );

    case "toggle":
      return <Switch id={inputId} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />;

    case "number":
      return (
        <Input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          step={1}
          value={String(value ?? field.default)}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(next)) onChange(Math.min(field.max, Math.max(field.min, next)));
          }}
          className="w-28"
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

function useImagePicker(onPicked: (image: ImageRef) => void) {
  const [open, setOpen] = React.useState(false);

  const onSelect = (file: PickerFile) => {
    const image = toImageRef(file);
    if (!image) {
      toast.error("That file can’t be used here", {
        description: "Choose an image. A file uploaded a moment ago may still be processing — try again shortly.",
      });
      return;
    }
    onPicked(image);
  };

  return { open, setOpen, onSelect };
}

function Thumb({ image, className }: { image: ImageRef | null; className?: string }) {
  return (
    <span
      className={cn(
        "bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border",
        className,
      )}
    >
      {image ? (
        <Image
          src={cdnImage(image.url, 160)}
          alt={image.altText ?? ""}
          width={64}
          height={64}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        <ImageIcon className="text-muted-foreground size-4" />
      )}
    </span>
  );
}

function ImageField({
  value,
  onChange,
  label,
}: {
  value: ImageRef | null;
  onChange: (value: ImageRef | null) => void;
  label: string;
}) {
  const picker = useImagePicker((image) => onChange(image));

  return (
    <div className="flex items-start gap-3">
      <Thumb image={value} className="size-20" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => picker.setOpen(true)}>
          {value ? "Replace" : "Choose image"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onChange(null)}>
            <XIcon className="size-3.5" />
            Remove
          </Button>
        )}
      </div>
      <MediaPicker
        open={picker.open}
        onOpenChange={picker.setOpen}
        kind="image"
        title={label.toLowerCase()}
        selectedId={value?.id ?? null}
        onSelect={picker.onSelect}
      />
    </div>
  );
}

/**
 * Several images, in an order that matters, each with an optional caption.
 * Reordered by buttons rather than by drag: this sits inside the section list's
 * own drag context, and a nested one fights it.
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
  const picker = useImagePicker((image) => onChange([...value, { image, caption: "" }]));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((item, index) => (
            <li key={`${item.image.id}-${index}`} className="flex items-start gap-2 rounded-md border p-2">
              <Thumb image={item.image} className="size-14" />

              <div className="min-w-0 flex-1">
                {captions ? (
                  <Input
                    value={item.caption}
                    maxLength={200}
                    placeholder="Caption (optional)"
                    aria-label={`${label} ${index + 1} caption`}
                    onChange={(event) => {
                      const next = [...value];
                      next[index] = { ...item, caption: event.target.value };
                      onChange(next);
                    }}
                    className="h-7 text-xs"
                  />
                ) : (
                  <p className="text-muted-foreground truncate pt-1 text-xs">{item.image.altText || "No alt text"}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${label} ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move ${label} ${index + 1} down`}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive"
                  aria-label={`Remove ${label} ${index + 1}`}
                  onClick={() => onChange(value.filter((_, position) => position !== index))}
                >
                  <XIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value.length >= max}
          onClick={() => picker.setOpen(true)}
        >
          <PlusIcon className="size-3.5" />
          Add image
        </Button>
        <span className="text-muted-foreground text-xs">
          {value.length} of {max}
        </span>
      </div>

      <MediaPicker
        open={picker.open}
        onOpenChange={picker.setOpen}
        kind="image"
        title={label.toLowerCase()}
        onSelect={picker.onSelect}
      />
    </div>
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
  const unsafe = href !== "" && !isSafeHref(href);

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
      <Input
        value={href}
        maxLength={2048}
        placeholder="/collections/arc-teak or https://…"
        aria-label="Button link"
        aria-invalid={unsafe}
        onChange={(event) => update({ href: event.target.value.trim() })}
        className="font-mono text-xs"
      />
      {unsafe && (
        <p className="text-destructive text-xs" role="alert">
          Use a path on this site like /shop, or an address starting with https://.
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
  onChange,
}: {
  inputId: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  if (options.length <= 3) {
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
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const products = useProductSearch(debounced, kind === "product" && open);
  const chosen = new Set(value.map((item) => item.id));

  const options: CollectionOption[] =
    kind === "collection"
      ? collections
      : (products.data ?? []).map((product) => ({ ...product }));

  const pick = (option: CollectionOption) => {
    const ref: ResourceRef = { id: option.id, handle: option.handle, title: option.title };
    onChange(multiple ? [...value, ref] : [ref]);
    if (!multiple || value.length + 1 >= max) setOpen(false);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
              {multiple && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${item.title} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${item.title} down`}
                    disabled={index === value.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-destructive"
                aria-label={`Remove ${item.title}`}
                onClick={() => onChange(value.filter((other) => other.id !== item.id))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(multiple ? value.length < max : true) && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <PlusIcon className="size-3.5" />
              {multiple || value.length === 0 ? `Add ${kind}` : `Change ${kind}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            {/* Products are searched on the server across the whole catalogue;
                collections are few enough to filter here. */}
            <Command shouldFilter={kind === "collection"}>
              <CommandInput
                placeholder={`Search ${kind === "product" ? "products" : "collections"}`}
                value={search}
                onValueChange={setSearch}
                aria-label={`Search for ${label.toLowerCase()}`}
              />
              <CommandList>
                <CommandEmpty>
                  {kind === "product" && products.isFetching ? "Searching…" : "Nothing found."}
                </CommandEmpty>
                <CommandGroup>
                  {options
                    .filter((option) => !chosen.has(option.id))
                    .map((option) => (
                      <CommandItem key={option.id} value={`${option.title} ${option.handle}`} onSelect={() => pick(option)}>
                        <span className="bg-muted flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border">
                          {option.thumbnail ? (
                            <Image
                              src={option.thumbnail}
                              alt=""
                              width={28}
                              height={28}
                              unoptimized
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="text-muted-foreground size-3" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{option.title}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
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
  }
  return "";
}

/**
 * The blocks inside a section, edited in place: each is a row that opens to its
 * own fields, with move, duplicate and delete beside it. One row is open at a
 * time, so a long FAQ stays scannable.
 *
 * Reordering is by button, as for image lists — this sits inside the section
 * list's drag context, and a nested one fights it.
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
  const [openId, setOpenId] = React.useState<string | null>(value.length === 1 ? (value[0]?.id ?? null) : null);
  const full = value.length >= field.max;

  const add = (definition: BlockDef) => {
    const created = createBlock(definition);
    onChange([...value, created]);
    setOpenId(created.id);
  };

  const update = (id: string, key: string, next: unknown) =>
    onChange(value.map((item) => (item.id === id ? { ...item, settings: { ...item.settings, [key]: next } } : item)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };

  const duplicate = (index: number) => {
    if (full) return;
    const copy = { ...value[index]!, id: newBlockId(), settings: structuredClone(value[index]!.settings) };
    const next = [...value];
    next.splice(index + 1, 0, copy);
    onChange(next);
    setOpenId(copy.id);
  };

  const remove = (id: string) => {
    onChange(value.filter((item) => item.id !== id));
    if (openId === id) setOpenId(null);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((item, index) => {
            const definition = blockDefinition(field, item.type);
            if (!definition) return null;

            const open = openId === item.id;
            const summary = blockSummary(definition, item.settings);
            const incomplete = definition.fields.some(
              (child) =>
                child.required && isFieldActive(child, item.settings) && !isFieldFilled(child, item.settings[child.key]),
            );

            return (
              <li key={item.id} className="rounded-md border">
                <div className="flex items-center gap-1 px-1 py-1">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : item.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left"
                  >
                    <ChevronRightIcon
                      className={cn("text-muted-foreground size-3.5 shrink-0 transition-transform", open && "rotate-90")}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{definition.label}</span>
                      {summary && <span className="text-muted-foreground block truncate text-xs">{summary}</span>}
                    </span>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${definition.label} ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${definition.label} ${index + 1} down`}
                    disabled={index === value.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Duplicate ${definition.label} ${index + 1}`}
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
                    aria-label={`Delete ${definition.label} ${index + 1}`}
                    onClick={() => remove(item.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>

                {incomplete && !open && (
                  <p className="px-3 pb-1.5 text-xs text-amber-600 dark:text-amber-500">
                    Has an empty required field — needed before publishing.
                  </p>
                )}

                {open && (
                  <div className="space-y-3 border-t px-3 py-3">
                    {definition.fields
                      .filter((child) => isFieldActive(child, item.settings))
                      .map((child) => {
                        const inputId = `${item.id}-${child.key}`;
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
                              onChange={(next) => update(item.id, child.key, next)}
                            />
                            {child.help && !inline && <p className="text-muted-foreground text-xs">{child.help}</p>}
                            {missing && (
                              <p className="text-xs text-amber-600 dark:text-amber-500">
                                Needed before this page can be published.
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        {field.blocks.length === 1 ? (
          <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add(field.blocks[0]!)}>
            <PlusIcon className="size-3.5" />
            Add {field.blocks[0]!.label.toLowerCase()}
          </Button>
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
