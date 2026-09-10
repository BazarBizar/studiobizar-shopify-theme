"use client";

import { InfoIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Label } from "@/components/admin/ui/label";
import { Separator } from "@/components/admin/ui/separator";
import { paramFromEntryId } from "@/lib/admin/field-values";
import type { FieldSpec } from "@/lib/admin/form-fields";
import { createEntryRequest, updateEntryRequest } from "@/lib/admin/queries";

import { FieldRenderer } from "./field-renderer";

/**
 * The generic entry form. It knows nothing about any particular metaobject type — it
 * renders whatever specs the server hands it, and each spec was built from the live
 * Shopify definition.
 *
 * Client-side checks here are a courtesy to the operator. The rules live on the server:
 * `lib/admin/validation.ts` for shape, `assertWritable` for read-only, and Shopify
 * itself for per-type validity. Nothing below is load-bearing for security.
 */

type Values = Record<string, string>;

export function EntryForm({
  mode,
  type,
  typeLabel,
  entryId,
  specs,
}: {
  mode: "create" | "update";
  type: string;
  typeLabel: string;
  entryId: string | null;
  specs: FieldSpec[];
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  const defaults = React.useMemo<Values>(
    () => Object.fromEntries(specs.map((spec) => [spec.key, spec.initialValue])),
    [specs],
  );

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { dirtyFields, isDirty, errors },
  } = useForm<Values>({ defaultValues: defaults, mode: "onSubmit" });

  const editableSpecs = specs.filter((spec) => spec.editable);
  const nothingEditable = editableSpecs.length === 0;

  async function onSubmit(values: Values) {
    setSaving(true);

    /**
     * ONLY DIRTY FIELDS are sent. On a read-only type that is what keeps an update to
     * `status` from also re-submitting the customer's own words — and the server refuses
     * the rest regardless, in `assertWritable`.
     *
     * On create everything editable goes, because nothing exists to diff against.
     */
    const keys =
      mode === "create"
        ? editableSpecs.map((spec) => spec.key)
        : editableSpecs.map((spec) => spec.key).filter((key) => dirtyFields[key]);

    if (keys.length === 0) {
      setSaving(false);
      toast.info("Nothing to save", { description: "No fields have changed." });
      return;
    }

    // Caught here because Shopify's own error for malformed JSON is opaque, and the
    // operator can fix it immediately if told plainly.
    let invalid = false;
    for (const spec of editableSpecs) {
      const value = values[spec.key] ?? "";

      if (spec.required && value.trim() === "") {
        setError(spec.key, { message: `${spec.name} is required.` });
        invalid = true;
      } else if (spec.type === "json" && value.trim() !== "") {
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

    const fields = keys.map((key) => ({ key, value: values[key] ?? "" }));

    try {
      const result =
        mode === "create"
          ? await createEntryRequest({ type, fields })
          : await updateEntryRequest({ id: entryId!, fields });

      /**
       * Reset from the values that were actually SENT, not from a fresh object: this
       * clears the dirty state so the save bar goes quiet, and the subsequent
       * `router.refresh()` re-renders the server component with whatever Shopify
       * normalised, so any change it made becomes visible rather than being hidden
       * behind a form that thinks it is already in sync.
       */
      reset(values);

      toast.success("Saved", {
        description:
          mode === "create" ? `${typeLabel} created.` : `${keys.length} field(s) updated.`,
      });

      if (mode === "create") {
        router.push(`/admin/${type}/${paramFromEntryId(result.id)}`);
      }
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
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* One fieldset rather than `disabled` on every input: a single place to lock the
          form, and it cannot drift out of sync per field. */}
      <fieldset disabled={saving}>
        <Card className="gap-0 py-0">
          <CardContent className="space-y-6 px-0 py-6">
            {specs.map((spec, index) => (
              <React.Fragment key={spec.key}>
                {index > 0 ? <Separator /> : null}

                <div className="grid gap-2 px-6 sm:grid-cols-[13rem_1fr] sm:gap-4">
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor={spec.key} className="break-words">
                      {spec.name}
                      {spec.required ? (
                        <span className="text-destructive" aria-hidden>
                          {" "}
                          *
                        </span>
                      ) : null}
                    </Label>

                    <p className="text-muted-foreground font-mono text-[11px] break-all">
                      {spec.key}
                    </p>

                    {spec.description ? (
                      <p
                        id={`${spec.key}-description`}
                        className="text-muted-foreground flex items-start gap-1 text-xs"
                      >
                        <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                        {spec.description}
                      </p>
                    ) : null}

                    {!spec.editable ? (
                      <p className="text-muted-foreground text-xs">Not editable here</p>
                    ) : null}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <Controller
                      name={spec.key}
                      control={control}
                      render={({ field }) => (
                        <FieldRenderer
                          spec={spec}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          invalid={Boolean(errors[spec.key])}
                        />
                      )}
                    />

                    {errors[spec.key] ? (
                      <p className="text-destructive text-xs" role="alert">
                        {String(errors[spec.key]?.message)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </CardContent>
        </Card>

        {/* Sticky at the BOTTOM. `top-14` is for things sticking to the header; this one
            sits against the viewport floor so the save action is reachable on a long
            form without scrolling back. */}
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky bottom-0 flex items-center justify-between gap-3 border-t py-4 backdrop-blur">
          <p className="text-muted-foreground text-xs">
            {nothingEditable
              ? "Nothing on this record can be changed here"
              : isDirty
                ? "Unsaved changes"
                : "All changes saved"}
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!isDirty || saving}
              onClick={() => reset(defaults)}
            >
              Discard
            </Button>
            <Button type="submit" disabled={(!isDirty && mode === "update") || saving || nothingEditable}>
              {saving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              {saving ? "Saving…" : mode === "create" ? `Create ${typeLabel}` : "Save"}
            </Button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
