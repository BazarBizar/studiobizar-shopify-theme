"use client";

import { isTrue, parseList } from "@/lib/admin/field-values";
import type { FieldSpec } from "@/lib/admin/form-fields";

import { MediaPicker } from "./media-picker";
import { ReferencePicker } from "./reference-picker";
import { RichTextEditor } from "./rich-text-editor";

/**
 * Chooses an input from the SHOPIFY FIELD TYPE, never from the field's name or from
 * a per-field table in this repo. That is what makes the form generic: a field
 * added in Shopify tomorrow gets the right control today.
 *
 * Every value in and out is a string — see the note at the top of
 * `lib/admin/field-values.ts` for why nothing is coerced.
 */

export type { FieldSpec };

type Props = {
  spec: FieldSpec;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

const INPUT =
  "border-admin-border bg-admin-panel rounded-admin w-full border px-2.5 py-1.5 outline-none disabled:opacity-60";

export function FieldRenderer({ spec, value, onChange, invalid }: Props) {
  const disabled = !spec.editable;
  const describedBy = spec.description ? `${spec.key}-description` : undefined;
  const className = invalid ? `${INPUT} border-admin-danger` : INPUT;

  /* ---------------------------------------------------------------- references */

  if (spec.type === "file_reference" || spec.type === "list.file_reference") {
    // A list of files is stored as a JSON array; the picker here handles one at a
    // time, so a list field is edited as its first entry plus a clear note. Full
    // multi-file ordering arrives with the media work in Phase 4.
    if (spec.type === "list.file_reference") {
      const ids = parseList(value);

      return (
        <div>
          <p className="bg-admin-warn-bg text-admin-warn rounded-admin mb-2 px-3 py-2 text-xs">
            This field holds several files. The panel can edit them one at a time for now —
            reordering a multi-file field is still done in Shopify.
          </p>
          <MediaPicker
            label={spec.name}
            kind={spec.fileKind}
            value={ids[0] ?? null}
            current={spec.currentFile}
            disabled={disabled}
            onChange={(id) => onChange(JSON.stringify(id ? [id, ...ids.slice(1)] : ids.slice(1)))}
          />
        </div>
      );
    }

    return (
      <MediaPicker
        label={spec.name}
        kind={spec.fileKind}
        value={value || null}
        current={spec.currentFile}
        disabled={disabled}
        onChange={(id) => onChange(id ?? "")}
      />
    );
  }

  if (spec.type === "metaobject_reference" || spec.type === "list.metaobject_reference") {
    const multiple = spec.type === "list.metaobject_reference";
    const ids = multiple ? parseList(value) : value ? [value] : [];

    return (
      <ReferencePicker
        label={spec.name}
        targetType={spec.targetType}
        multiple={multiple}
        value={ids}
        current={spec.currentRefs}
        disabled={disabled}
        onChange={(next) => onChange(multiple ? JSON.stringify(next) : (next[0] ?? ""))}
      />
    );
  }

  /**
   * Product and collection pickers are Phase 4. Rendered as a read-only summary
   * rather than a text input: letting someone type a raw gid into a field is a way
   * to silently point a project at the wrong product.
   */
  if (
    spec.type.endsWith("product_reference") ||
    spec.type.endsWith("collection_reference") ||
    spec.type.endsWith("variant_reference")
  ) {
    const count = spec.type.startsWith("list.") ? parseList(value).length : value ? 1 : 0;

    return (
      <div className="border-admin-border rounded-admin border px-3 py-2">
        <p className="text-admin-muted text-xs">
          {count === 0
            ? "Nothing linked."
            : `${count} linked ${count === 1 ? "item" : "items"}: ${
                spec.currentRefs.map((reference) => reference.label).join(", ") || "—"
              }`}
        </p>
        <p className="text-admin-faint mt-1 text-xs">
          Catalogue links are still edited in Shopify. Saving here leaves them untouched.
        </p>
      </div>
    );
  }

  /* -------------------------------------------------------------------- scalars */

  if (spec.type === "rich_text_field") {
    return (
      <RichTextEditor
        value={value}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={spec.name}
      />
    );
  }

  if (spec.type === "boolean") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isTrue(value)}
          disabled={disabled}
          aria-describedby={describedBy}
          // Shopify stores booleans as the strings "true"/"false".
          onChange={(event) => onChange(event.target.checked ? "true" : "false")}
          className="size-4"
        />
        <span className="text-admin-muted text-xs">{isTrue(value) ? "Yes" : "No"}</span>
      </label>
    );
  }

  if (spec.choices.length > 0) {
    return (
      <select
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        {/* A blank option only where the field allows one — offering it on a
            required field invites a save Shopify will reject. */}
        {!spec.required || !value ? <option value="">—</option> : null}
        {spec.choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    );
  }

  if (spec.type === "multi_line_text_field") {
    return (
      <textarea
        value={value}
        disabled={disabled}
        rows={4}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      />
    );
  }

  if (spec.type === "json") {
    return (
      <div>
        <textarea
          value={value}
          disabled={disabled}
          rows={8}
          spellCheck={false}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} font-mono text-xs`}
        />
        <p className="text-admin-faint mt-1 text-xs">
          Raw JSON. Malformed JSON is rejected on save, before it reaches Shopify.
        </p>
      </div>
    );
  }

  if (spec.type === "number_integer" || spec.type === "number_decimal") {
    return (
      <input
        type="number"
        value={value}
        disabled={disabled}
        step={spec.type === "number_integer" ? 1 : "any"}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      />
    );
  }

  if (spec.type === "date" || spec.type === "date_time") {
    const isDateTime = spec.type === "date_time";

    return (
      <input
        type={isDateTime ? "datetime-local" : "date"}
        // A `datetime-local` input wants "YYYY-MM-DDTHH:mm" and Shopify stores full
        // ISO with a zone; trimming is what makes a stored value show up at all.
        value={isDateTime ? value.slice(0, 16) : value.slice(0, 10)}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      />
    );
  }

  return (
    <input
      type={spec.type === "url" ? "url" : "text"}
      value={value}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}
