"use client";

import { Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { MediaField } from "@/components/admin/media/media-field";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
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

/**
 * One component serves both create and edit, on the same `FormState`.
 *
 * The difference that matters is what gets SENT: an edit ships only the keys that
 * actually changed, because Shopify leaves an omitted key alone and a full payload would
 * overwrite whatever another editor touched a minute ago.
 */

export type CollectionFormState = {
  title: string;
  handle: string;
  descriptionHtml: string;
  sortOrder: string;
  seoTitle: string;
  seoDescription: string;
  imageGid: string;
  imageAlt: string;
};

type Props = {
  mode: "create" | "edit";
  id: string | null;
  initial: CollectionFormState;
  sortOrderOptions: { value: string; label: string }[];
  /** Shown as read-only context; the panel never writes rules. */
  ruleSet: { appliedDisjunctively: boolean; rules: { column: string; relation: string; condition: string }[] } | null;
};

const humanise = (value: string) => value.toLowerCase().replace(/_/g, " ");

export function CollectionForm({
  mode,
  id,
  initial,
  sortOrderOptions,
  ruleSet,
}: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState<CollectionFormState>(initial);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const set = <K extends keyof CollectionFormState>(key: K, value: CollectionFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Dirty is a comparison of snapshots, so a value edited back to its original is clean. */
  const dirtyKeys = React.useMemo(
    () =>
      (Object.keys(form) as (keyof CollectionFormState)[]).filter(
        (key) => JSON.stringify(form[key]) !== JSON.stringify(initial[key]),
      ),
    [form, initial],
  );

  const isDirty = dirtyKeys.length > 0;

  async function save() {
    setErrors({});

    if (!form.title.trim()) {
      setErrors({ title: "A title is required." });
      return;
    }

    setSaving(true);

    // Only what changed. On create everything goes, since there is nothing to diff.
    const keys = mode === "create" ? (Object.keys(form) as (keyof CollectionFormState)[]) : dirtyKeys;
    const payload: Record<string, unknown> = {};
    for (const key of keys) payload[key] = form[key];

    try {
      const response = await fetch(
        mode === "create" ? "/api/admin/collections/create" : "/api/admin/collections/update",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: mode === "create" ? "collectionCreate" : "collectionUpdate",
            ...(mode === "edit" ? { id } : {}),
            ...payload,
          }),
        },
      );

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? `Save failed (${response.status})`);
      }

      const saved = (await response.json()) as { id: string; handle: string };

      toast.success("Saved", {
        description: mode === "create" ? "Collection created." : `${keys.length} field(s) updated.`,
      });

      if (mode === "create") {
        // Straight to the new record's own URL, so a reload does not re-create it.
        router.replace(`/admin/collections/${saved.id.split("/").pop()}`);
      }
      // Re-seeds the form from what Shopify actually stored, so a generated handle or
      // any other normalisation becomes visible instead of hiding behind a form that
      // believes it is already in sync.
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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={saving} className="space-y-4">
        <Card className="gap-0 py-0">
          <CardContent className="space-y-6 px-6 py-6">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title ? (
                <p className="text-destructive text-xs" role="alert">
                  {errors.title}
                </p>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                value={form.handle}
                onChange={(event) => set("handle", event.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                The storefront URL segment. Leave blank on a new collection and Shopify
                generates one from the title.
              </p>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Description</Label>
              <RichTextEditor
                value={form.descriptionHtml}
                onChange={(value) => set("descriptionHtml", value)}
                ariaLabel="Description"
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Image</Label>
              <MediaField
                label="Collection image"
                kind="image"
                value={form.imageGid}
                onChange={(gid) => set("imageGid", gid)}
              />
              <Label htmlFor="imageAlt" className="pt-2">
                Image alt text
              </Label>
              <Input
                id="imageAlt"
                value={form.imageAlt}
                onChange={(event) => set("imageAlt", event.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="sortOrder">Product sort order</Label>
              <Select value={form.sortOrder} onValueChange={(value) => set("sortOrder", value)}>
                <SelectTrigger id="sortOrder" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOrderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="seoTitle">SEO title</Label>
                <Input
                  id="seoTitle"
                  value={form.seoTitle}
                  onChange={(event) => set("seoTitle", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seoDescription">SEO description</Label>
                <Textarea
                  id="seoDescription"
                  rows={3}
                  value={form.seoDescription}
                  onChange={(event) => set("seoDescription", event.target.value)}
                />
              </div>
            </div>

            {ruleSet ? (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Rules</Label>
                  {/**
                   * READ-ONLY, and not because a control is disabled: `lib/admin/collections.ts`
                   * has no field for `ruleSet` and the validation schema has no key for it, so
                   * nothing in the panel can send one. Rules decide which of two thousand
                   * products a collection contains, and one wrong condition empties it on the
                   * storefront with no undo.
                   */}
                  <div className="bg-muted/40 space-y-1 rounded-md border px-3 py-2">
                    <p className="text-muted-foreground text-xs">
                      Products are chosen automatically when{" "}
                      {ruleSet.appliedDisjunctively ? "ANY" : "ALL"} of these match. Edit rules in
                      Shopify.
                    </p>
                    <ul className="space-y-0.5">
                      {ruleSet.rules.map((rule, index) => (
                        <li key={index} className="font-mono text-xs">
                          {humanise(rule.column)} {humanise(rule.relation)} “{rule.condition}”
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky bottom-0 flex items-center justify-between gap-3 border-t py-4 backdrop-blur">
          <p className="text-muted-foreground text-xs">
            {isDirty ? `${dirtyKeys.length} unsaved change(s)` : "All changes saved"}
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!isDirty || saving}
              onClick={() => setForm(initial)}
            >
              Discard
            </Button>
            <Button type="submit" disabled={saving || (mode === "edit" && !isDirty)}>
              {saving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              {saving ? "Saving…" : mode === "create" ? "Create collection" : "Save"}
            </Button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
