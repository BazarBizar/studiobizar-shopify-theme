"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createEntryRequest, updateEntryRequest } from "@/lib/admin/queries";

import { FieldRenderer, type FieldSpec } from "./field-renderer";

/**
 * The generic entry form. It knows nothing about any particular metaobject type —
 * it renders whatever specs the server hands it, and each spec was built from the
 * live Shopify definition.
 *
 * Client-side checks here are a courtesy to the operator. The rules live on the
 * server: `lib/admin/validation.ts` for shape, `assertWritable` for read-only, and
 * Shopify itself for per-type validity. Nothing below is load-bearing for security.
 */

type Props = {
  mode: "create" | "update";
  type: string;
  typeLabel: string;
  entryId: string | null;
  specs: FieldSpec[];
  /** Shown when the whole type is read-only. */
  readOnlyNotice: string | null;
};

type Issue = { path: string; message: string };

export function EntryForm({ mode, type, typeLabel, entryId, specs, readOnlyNotice }: Props) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(specs.map((spec) => [spec.key, spec.initialValue])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dirty, setDirty] = useState(false);

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const localCheck = (): Issue[] => {
    const found: Issue[] = [];

    for (const spec of specs) {
      if (!spec.editable) continue;
      const value = values[spec.key] ?? "";

      if (spec.required && value.trim() === "") {
        found.push({ path: spec.key, message: `${spec.name} is required.` });
      }

      // Caught here because Shopify's own error for malformed JSON is opaque, and
      // the operator can fix it immediately if told plainly.
      if (spec.type === "json" && value.trim() !== "") {
        try {
          JSON.parse(value);
        } catch {
          found.push({ path: spec.key, message: `${spec.name} is not valid JSON.` });
        }
      }
    }

    return found;
  };

  async function save() {
    setError(null);

    const local = localCheck();
    setIssues(local);
    if (local.length) return;

    setSaving(true);

    /**
     * Only editable fields are sent. On a read-only type this is what keeps an
     * update to `status` from also re-submitting the customer's own words — and the
     * server refuses the rest regardless, in `assertWritable`.
     */
    const fields = specs
      .filter((spec) => spec.editable)
      .map((spec) => ({ key: spec.key, value: values[spec.key] ?? "" }));

    try {
      const result =
        mode === "create"
          ? await createEntryRequest({ type, fields })
          : await updateEntryRequest({ id: entryId!, fields });

      setDirty(false);

      // Straight to the saved entry on create, so the operator can see it landed.
      router.push(`/admin/${type}/${result.id.split("/").pop()}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That change could not be saved.");
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
      className="max-w-3xl"
    >
      {readOnlyNotice ? (
        <p className="bg-admin-warn-bg text-admin-warn rounded-admin mb-4 px-3 py-2 text-xs">
          {readOnlyNotice}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="bg-admin-danger-bg text-admin-danger rounded-admin mb-4 px-3 py-2 text-xs"
        >
          {error}
        </p>
      ) : null}

      <div className="border-admin-border bg-admin-panel rounded-admin divide-admin-border divide-y border">
        {specs.map((spec) => {
          const issue = issues.find((candidate) => candidate.path.includes(spec.key));

          return (
            <div key={spec.key} className="grid gap-2 p-4 sm:grid-cols-[13rem_1fr] sm:gap-4">
              <div className="min-w-0">
                <label
                  htmlFor={spec.key}
                  className="text-admin-fg block text-xs font-medium break-words"
                >
                  {spec.name}
                  {spec.required ? (
                    <span className="text-admin-danger" aria-hidden="true">
                      {" "}
                      *
                    </span>
                  ) : null}
                </label>

                <p className="text-admin-faint mt-0.5 font-mono text-[0.6875rem] break-all">
                  {spec.key}
                </p>

                {spec.description ? (
                  <p id={`${spec.key}-description`} className="text-admin-muted mt-1 text-xs">
                    {spec.description}
                  </p>
                ) : null}

                {!spec.editable ? (
                  <p className="text-admin-faint mt-1 text-xs">Not editable here</p>
                ) : null}
              </div>

              <div className="min-w-0">
                <FieldRenderer
                  spec={spec}
                  value={values[spec.key] ?? ""}
                  onChange={(value) => setValue(spec.key, value)}
                  invalid={Boolean(issue)}
                />

                {issue ? (
                  <p role="alert" className="text-admin-danger mt-1 text-xs">
                    {issue.message}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || specs.every((spec) => !spec.editable)}
          className="bg-admin-accent text-admin-accent-fg rounded-admin px-3 py-2 disabled:opacity-60"
        >
          {saving ? "Saving…" : mode === "create" ? `Create ${typeLabel}` : "Save changes"}
        </button>

        <Link
          href={`/admin/${type}`}
          className="border-admin-border rounded-admin hover:bg-admin-raised border px-3 py-2"
        >
          {dirty ? "Discard and go back" : "Back"}
        </Link>

        {dirty ? <span className="text-admin-muted text-xs">Unsaved changes</span> : null}
      </div>
    </form>
  );
}
