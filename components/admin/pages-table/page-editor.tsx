"use client";

import { ExternalLinkIcon, Loader2Icon, SaveIcon, TriangleAlertIcon } from "lucide-react";

import { LEAVE_UNSAVED, useConfirm } from "@/components/admin/confirm-dialog";
import { useUnsavedChangesWarning } from "@/components/admin/save-bar";
import type { ContentStatus } from "@/lib/admin/page-status";
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
import { Textarea } from "@/components/admin/ui/textarea";
import type { FieldSpec } from "@/lib/admin/form-fields";
import { updatePageRequest } from "@/lib/admin/queries";

import { PageEditorBar } from "./page-editor-bar";

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
  seoTitle: "__core_seo_title",
  seoDescription: "__core_seo_description",
} as const;

export type EditablePage = {
  id: string;
  title: string;
  handle: string;
  body: string;
  isPublished: boolean;
  /**
   * Shopify's SEO fields — present only for pages whose route reads them (page
   * builder pages, the legal pages). A hand-built route that writes its own
   * metadata would ignore them, so offering them there would be offering nothing.
   */
  seo?: { title: string; description: string };
  /**
   * The page builder draws this page, so its Shopify body is shown nowhere — the
   * body field is left out rather than offered as an edit that changes nothing.
   */
  contentInBuilder?: boolean;
};

export function PageEditor({
  page,
  specs,
  /** The route this page's content renders at. */
  publicPath,
  tabsParam,
  notice,
  content,
}: {
  page: EditablePage;
  specs: FieldSpec[];
  publicPath: string;
  /**
   * The page's id segment, when it has a Content tab. The tabs live here, inside
   * the form, so leaving for Content can first ask about unsaved settings.
   */
  tabsParam?: string;
  /** A line under the tabs, above the fields. */
  notice?: React.ReactNode;
  /** Where the page's builder content stands, for the status badge. */
  content: ContentStatus;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [published, setPublished] = React.useState(page.isPublished);

  const defaults = React.useMemo<Values>(
    () => ({
      [CORE.title]: page.title,
      [CORE.handle]: page.handle,
      [CORE.body]: page.body,
      [CORE.seoTitle]: page.seo?.title ?? "",
      [CORE.seoDescription]: page.seo?.description ?? "",
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

  // Settings save with Save, not on their own — so leaving with changes asks first,
  // with the panel's own dialog, and the browser asks on a reload or close.
  const [leaveDialog, ask] = useConfirm();
  const onLeave = async () => !dirty || (await ask(LEAVE_UNSAVED));
  useUnsavedChangesWarning(dirty && !saving);

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
      ...(page.seo && dirtyFields[CORE.seoTitle] ? { seoTitle: values[CORE.seoTitle] ?? "" } : {}),
      ...(page.seo && dirtyFields[CORE.seoDescription] ? { seoDescription: values[CORE.seoDescription] ?? "" } : {}),
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
          ? "The page has a new web address. Update any links that pointed to the old one."
          : "Your changes are live on the site.",
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
      {leaveDialog}
      {/* The same bar as the Content tab; full-bleed against the layout's padding. */}
      <PageEditorBar
        className="-mx-4 -mt-4 md:-mx-6 md:-mt-6"
        title={page.title}
        path={publicPath}
        param={tabsParam}
        active="settings"
        isPublished={page.isPublished}
        content={content}
        onLeave={onLeave}
      >
        <span className="text-muted-foreground hidden text-xs sm:inline" aria-live="polite">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        {page.isPublished ? (
          <Button asChild variant="outline" size="sm">
            <a href={publicPath} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
              View page
            </a>
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => { reset(defaults); setPublished(page.isPublished); }}>
          Discard
        </Button>
        <Button type="submit" size="sm" disabled={saving || !dirty}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {saving ? "Saving…" : "Save"}
        </Button>
      </PageEditorBar>
      {notice}

      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="page-title">Page title</Label>
              <Controller
                control={control}
                name={CORE.title}
                render={({ field }) => <Input id="page-title" {...field} />}
              />
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              {/* "Visible", not "Published": Publish is the page builder's word for
                  putting edited content live. This is whether the page exists for
                  visitors at all. */}
              <Label htmlFor="page-published">Show to visitors</Label>
              <Switch id="page-published" checked={published} onCheckedChange={setPublished} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="page-handle">Web address</Label>
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
                Changing the web address breaks every link to the old one, including in
                menus. Only change it if you are sure.
              </p>
            ) : (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                Visitors open it at{" "}
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  {publicPath}
                  <ExternalLinkIcon className="size-3" />
                </a>
              </p>
            )}
          </div>

          {!page.contentInBuilder && (
            <>
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
                    format="html"
                  />
                )}
              />
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {page.seo && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Search engine listing</h2>
              <p className="text-muted-foreground text-xs">
                How this page appears in Google. Live as soon as you save.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-seo-title">Title</Label>
              <Controller
                control={control}
                name={CORE.seoTitle}
                render={({ field }) => (
                  <Input id="page-seo-title" maxLength={70} placeholder={page.title} {...field} />
                )}
              />
              <p className="text-muted-foreground text-xs">Up to 70 characters. Empty uses the page title.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-seo-description">Description</Label>
              <Controller
                control={control}
                name={CORE.seoDescription}
                render={({ field }) => <Textarea id="page-seo-description" maxLength={320} rows={3} {...field} />}
              />
              <p className="text-muted-foreground text-xs">Up to 320 characters. Empty uses the page’s own summary.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {specs.length > 0 && (
        <Card>
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold">Page details</h2>
              <p className="text-muted-foreground text-xs">
                The text and photos this page shows around its main content.
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
    </form>
  );
}
