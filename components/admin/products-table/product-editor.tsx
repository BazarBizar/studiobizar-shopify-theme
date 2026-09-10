"use client";

import { Loader2Icon, SaveIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { FieldRenderer } from "@/components/admin/field-renderer";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Separator } from "@/components/admin/ui/separator";
import { Textarea } from "@/components/admin/ui/textarea";
import type { FieldSpec } from "@/lib/admin/form-fields";

import { CollapsibleSection } from "./product-sections";

/**
 * Core fields, metafields and SEO — ONE form, ONE Save.
 *
 * They all land in a single `productUpdate`, so splitting them into separate cards with
 * separate buttons would invent a partial state the API does not have: there is no way to
 * save the title without the metafields going with it.
 *
 * Media and channels are deliberately NOT here. Each of those is its own Shopify mutation
 * with no draft, so they save on the spot — a photo that only appears after pressing Save
 * somewhere else on the page is a lie about what the store contains.
 */

export type ProductCore = {
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
};

type Props = {
  productId: string;
  initialCore: ProductCore;
  /**
   * Built from the metafield DEFINITIONS, not from the values present on this product —
   * a spec field nobody has filled in has no metafield yet, and keying off values would
   * hide it exactly when someone wants to fill it in.
   */
  specs: FieldSpec[];
  vendors: string[];
  productTypes: string[];
};

export function ProductEditor({ productId, initialCore, specs, vendors, productTypes }: Props) {
  const router = useRouter();

  const [core, setCore] = React.useState(initialCore);
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(specs.map((spec) => [spec.key, spec.initialValue])),
  );
  const [saving, setSaving] = React.useState(false);
  const [tagDraft, setTagDraft] = React.useState("");

  const initialValues = React.useMemo(
    () => Object.fromEntries(specs.map((spec) => [spec.key, spec.initialValue])),
    [specs],
  );

  const coreDirty = React.useMemo(
    () =>
      (Object.keys(core) as (keyof ProductCore)[]).filter(
        (key) => JSON.stringify(core[key]) !== JSON.stringify(initialCore[key]),
      ),
    [core, initialCore],
  );

  const specDirty = React.useMemo(
    () => specs.map((spec) => spec.key).filter((key) => values[key] !== initialValues[key]),
    [specs, values, initialValues],
  );

  const dirty = coreDirty.length > 0 || specDirty.length > 0;

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    // Adding a tag that is already there is a no-op somebody meant, not a mistake.
    if (core.tags.includes(tag)) {
      setTagDraft("");
      return;
    }
    setCore((current) => ({ ...current, tags: [...current.tags, tag] }));
    setTagDraft("");
  }

  async function save() {
    setSaving(true);

    const payload: Record<string, unknown> = { operation: "productUpdate", id: productId };

    for (const key of coreDirty) {
      if (key === "seoTitle" || key === "seoDescription") payload[key] = core[key];
      else payload[key] = core[key];
    }

    // A cleared metafield is DELETED, not stored as "". The two are different states.
    const changed = specDirty.filter((key) => values[key] !== "");
    const cleared = specDirty.filter((key) => values[key] === "");

    if (changed.length) {
      payload.metafields = changed.map((key) => {
        const spec = specs.find((candidate) => candidate.key === key)!;
        return { key, type: spec.type, value: values[key] };
      });
    }
    if (cleared.length) payload.clearMetafields = cleared;

    try {
      const response = await fetch("/api/admin/products/update", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? `Save failed (${response.status})`);
      }

      toast.success("Saved", {
        description: `${coreDirty.length + specDirty.length} field(s) updated.`,
      });

      // Re-seeds from what Shopify stored, so any normalisation it applied is visible
      // rather than hidden behind a form that thinks it is in sync.
      router.refresh();
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : "That change was not applied.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <CollapsibleSection
        id="product"
        title="Product"
        description="Title, description, vendor, type, status and tags."
        dirty={coreDirty.length > 0}
      >
        <fieldset disabled={saving} className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={core.title}
              onChange={(event) => setCore({ ...core, title: event.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="handle">Handle</Label>
            <Input
              id="handle"
              value={core.handle}
              onChange={(event) => setCore({ ...core, handle: event.target.value })}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichTextEditor
              value={core.descriptionHtml}
              onChange={(value) => setCore({ ...core, descriptionHtml: value })}
              ariaLabel="Description"
            />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                list="product-vendors"
                value={core.vendor}
                onChange={(event) => setCore({ ...core, vendor: event.target.value })}
              />
              <datalist id="product-vendors">
                {vendors.map((vendor) => (
                  <option key={vendor} value={vendor} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="productType">Type</Label>
              <Input
                id="productType"
                list="product-types"
                value={core.productType}
                onChange={(event) => setCore({ ...core, productType: event.target.value })}
              />
              <datalist id="product-types">
                {productTypes.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={core.status} onValueChange={(value) => setCore({ ...core, status: value })}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tagDraft}
              onChange={(event) => {
                // A comma finishes a tag, so pasting a comma-separated list works.
                if (event.target.value.includes(",")) {
                  for (const part of event.target.value.split(",")) addTag(part);
                  return;
                }
                setTagDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(tagDraft);
                }
              }}
              // Blur adds too, so a typed tag is not lost by clicking elsewhere.
              onBlur={() => addTag(tagDraft)}
              placeholder="Type a tag and press Enter"
            />

            {core.tags.length ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {core.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() =>
                        setCore((current) => ({
                          ...current,
                          tags: current.tags.filter((candidate) => candidate !== tag),
                        }))
                      }
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </fieldset>
      </CollapsibleSection>

      <CollapsibleSection
        id="specs"
        title="Specifications"
        description={`${specs.length} metafields from the product definition.`}
        dirty={specDirty.length > 0}
      >
        <fieldset disabled={saving} className="space-y-6">
          {specs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No product metafield definitions on this store.
            </p>
          ) : (
            specs.map((spec, index) => (
              <React.Fragment key={spec.key}>
                {index > 0 ? <Separator /> : null}
                <div className="grid gap-2 sm:grid-cols-[13rem_1fr] sm:gap-4">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor={spec.key}>{spec.name}</Label>
                    <p className="text-muted-foreground font-mono text-[11px] break-all">
                      {spec.key}
                    </p>
                  </div>
                  <FieldRenderer
                    spec={spec}
                    value={values[spec.key] ?? ""}
                    onChange={(value) => setValues((current) => ({ ...current, [spec.key]: value }))}
                  />
                </div>
              </React.Fragment>
            ))
          )}
        </fieldset>
      </CollapsibleSection>

      <CollapsibleSection id="seo" title="SEO" dirty={coreDirty.some((key) => key.startsWith("seo"))}>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="seoTitle">SEO title</Label>
            <Input
              id="seoTitle"
              value={core.seoTitle}
              onChange={(event) => setCore({ ...core, seoTitle: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seoDescription">SEO description</Label>
            <Textarea
              id="seoDescription"
              rows={3}
              value={core.seoDescription}
              onChange={(event) => setCore({ ...core, seoDescription: event.target.value })}
            />
          </div>
        </fieldset>
      </CollapsibleSection>

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky bottom-0 flex items-center justify-between gap-3 border-t py-4 backdrop-blur">
        <p className="text-muted-foreground text-xs">
          {dirty
            ? `${coreDirty.length + specDirty.length} unsaved change(s)`
            : "All changes saved"}
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!dirty || saving}
            onClick={() => {
              setCore(initialCore);
              setValues(initialValues);
            }}
          >
            Discard
          </Button>
          <Button type="button" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
