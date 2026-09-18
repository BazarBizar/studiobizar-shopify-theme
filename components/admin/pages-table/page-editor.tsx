"use client";

import { ExternalLinkIcon, Loader2Icon, SaveIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FieldRenderer } from "@/components/admin/field-renderer";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Separator } from "@/components/admin/ui/separator";
import { Switch } from "@/components/admin/ui/switch";
import type { FieldSpec } from "@/lib/admin/form-fields";
import { updatePageRequest } from "@/lib/admin/queries";

/**
 * The page editor.
 *
 * Two halves, and the second is the reason the screen exists. The top card is the
 * page record — title, handle, body, published. Below it are the PAGE METAFIELDS,
 * rendered by the same `FieldRenderer` every metaobject form uses, from specs the
 * server built out of the live Shopify definitions.
 *
 * That is what makes this screen generic: a PAGE metafield definition added in
 * Shopify tomorrow appears here on the next page load, with the input its type
 * implies and a working media or reference picker. Nothing in this file names a
 * single metafield key.
 */

type Values = Record<string, string>;

const CORE = {
  title: "__core_title",
  handle: "__core_handle",
  body: "__core_body",
} as const;

export type EditablePage = {
  id: string;
  title: string;
  handle: string;
  body: string;
  isPublished: boolean;
};

export function PageEditor({
  page,
  specs,
  /** The route this page's content renders at. */
  publicPath,
}: {
  page: EditablePage;
  specs: FieldSpec[];
  publicPath: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [published, setPublished] = React.useState(page.isPublished);

  const defaults = React.useMemo<Values>(
    () => ({
      [CORE.title]: page.title,
      [CORE.handle]: page.handle,
      [CORE.body]: page.body,
      ...Object.fromEntries(specs.map((spec) => [spec.key, spec.initialValue])),
    }),
    [page, specs],
  );

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { dirtyFields, isDirty, errors },
  } = useForm<Values>({ defaultValues: defaults, mode: "onSubmit" });

  /**
   * `dirtyFields`, not `watch()`. react-hook-form compares against the defaults, so
   * this is already "differs from what Shopify has" — and it goes back to false if
   * the operator types the original handle back in, which is the behaviour wanted.
   * `watch()` would also work and is the only API in this codebase that defeats the
   * React Compiler, which is why nothing here uses it.
   */
  const handleChanged = Boolean(dirtyFields[CORE.handle]);
  const dirty = isDirty || published !== page.isPublished;

  async function onSubmit(values: Values) {
    setSaving(true);

    // Caught here because Shopify's error for malformed JSON is opaque, and the
    // operator can fix it immediately if told plainly. Same check the entry form makes.
    let invalid = false;
    for (const spec of specs) {
      const value = values[spec.key] ?? "";
      if (spec.type === "json" && value.trim() !== "") {
        try {
          JSON.parse(value);
        } catch {
          setError(spec.key, { message: `${spec.name} is not valid JSON.` });
          invalid = true;
        }
      }
    }

    if (invalid) {
      setSaving(false);
      return;
    }

    /**
     * ONLY DIRTY FIELDS are sent, so saving one metafield does not rewrite the
     * body with whatever the editor happened to be holding — and does not touch
     * the other twelve metafields at all.
     *
     * A metafield the operator emptied goes to `clearMetafields` rather than being
     * written as "": an empty metafield still exists and still reads as present to
     * every storefront check that guards a band on it.
     */
    const metafields: { key: string; type: string; value: string }[] = [];
    const clearMetafields: string[] = [];

    for (const spec of specs) {
      if (!dirtyFields[spec.key]) continue;
      const value = values[spec.key] ?? "";
      if (value.trim() === "") clearMetafields.push(spec.key);
      else metafields.push({ key: spec.key, type: spec.type, value });
    }

    const payload = {
      id: page.id,
      ...(dirtyFields[CORE.title] ? { title: values[CORE.title] } : {}),
      ...(dirtyFields[CORE.handle] ? { handle: values[CORE.handle] } : {}),
      ...(dirtyFields[CORE.body] ? { body: values[CORE.body] } : {}),
      ...(published !== page.isPublished ? { isPublished: published } : {}),
      ...(metafields.length ? { metafields } : {}),
      ...(clearMetafields.length ? { clearMetafields } : {}),
    };

    if (Object.keys(payload).length === 1) {
      setSaving(false);
      toast.info("Nothing to save", { description: "No fields have changed." });
      return;
    }

    try {
      await updatePageRequest(payload);

      // Reset from the values that were SENT, not a fresh object: that clears the
      // dirty state, and the refresh below re-renders the server component with
      // whatever Shopify normalised, so any change it made becomes visible.
      reset(values, { keepValues: true });

      toast.success("Saved", {
        description: handleChanged
          ? "Handle changed — check the storefront route still resolves."
          : "The storefront cache has been dropped.",
      });

      router.refresh();
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="page-title">Title</Label>
              <Controller
                control={control}
                name={CORE.title}
                render={({ field }) => <Input id="page-title" {...field} />}
              />
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <Label htmlFor="page-published">Published</Label>
              <Switch id="page-published" checked={published} onCheckedChange={setPublished} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="page-handle">Handle</Label>
            <Controller
              control={control}
              name={CORE.handle}
              render={({ field }) => <Input id="page-handle" {...field} />}
            />
            {/*
              Worth a warning rather than a lock. The storefront looks pages up BY
              HANDLE — `getPage("our-story")` — so renaming one does not redirect,
              it empties the route that reads it, silently and on the next deploy
              of the cache.
            */}
            {handleChanged ? (
              <p className="text-destructive flex items-center gap-1.5 text-xs">
                <TriangleAlertIcon className="size-3.5 shrink-0" />
                The storefront finds this page by its handle. Renaming it empties the
                route that reads it — there is no redirect.
              </p>
            ) : (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                Renders at{" "}
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono underline underline-offset-2"
                >
                  {publicPath}
                  <ExternalLinkIcon className="size-3" />
                </a>
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Body</Label>
            <Controller
              control={control}
              name={CORE.body}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  ariaLabel="Page body"
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {specs.length > 0 && (
        <Card>
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold">Content</h2>
              <p className="text-muted-foreground text-xs">
                Everything the storefront renders around the body. These are page
                metafields — the list comes from Shopify, so a definition added there
                appears here.
              </p>
            </div>

            {specs.map((spec) => (
              <div key={spec.key} className="space-y-2">
                <Label htmlFor={spec.key}>{spec.name}</Label>
                <Controller
                  control={control}
                  name={spec.key}
                  render={({ field }) => (
                    <FieldRenderer
                      spec={spec}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      invalid={Boolean(errors[spec.key])}
                    />
                  )}
                />
                {spec.description && (
                  <p id={`${spec.key}-description`} className="text-muted-foreground text-xs">
                    {spec.description}
                  </p>
                )}
                {errors[spec.key] && (
                  <p className="text-destructive text-xs">{errors[spec.key]?.message}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="bg-background/80 sticky bottom-0 flex items-center justify-end gap-3 border-t py-3 backdrop-blur">
        {dirty && <span className="text-muted-foreground text-xs">Unsaved changes</span>}
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          Save
        </Button>
      </div>
    </form>
  );
}
