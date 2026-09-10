"use client";

import { Input } from "@/components/admin/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { isTrue, parseList } from "@/lib/admin/field-values";
import type { FieldSpec } from "@/lib/admin/form-fields";

import { MediaPicker } from "./media-picker";
import { ReferencePicker } from "./reference-picker";
import { RichTextEditor } from "./rich-text-editor";

/**
 * Chooses an input from the SHOPIFY FIELD TYPE, never from the field's name or from a
 * per-field table in this repo. That is what makes the form generic: a field added in
 * Shopify tomorrow gets the right control today.
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

/** A sentinel, because a Radix SelectItem cannot have an empty string value. */
const NONE = "__none__";

export function FieldRenderer({ spec, value, onChange, invalid }: Props) {
  const disabled = !spec.editable;
  const describedBy = spec.description ? `${spec.key}-description` : undefined;

  /* ---------------------------------------------------------------- references */

  if (spec.type === "file_reference" || spec.type === "list.file_reference") {
    if (spec.type === "list.file_reference") {
      const ids = parseList(value);

      return (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            This field holds several files. The panel edits them one at a time for now —
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
   * Product and collection pickers are Phase 4. Rendered as a read-only summary rather
   * than a text input: letting someone type a raw gid into a field is a way to silently
   * point a project at the wrong product.
   */
  if (
    spec.type.endsWith("product_reference") ||
    spec.type.endsWith("collection_reference") ||
    spec.type.endsWith("variant_reference")
  ) {
    const count = spec.type.startsWith("list.") ? parseList(value).length : value ? 1 : 0;

    return (
      <div className="rounded-md border px-3 py-2">
        <p className="text-muted-foreground text-sm">
          {count === 0
            ? "Nothing linked."
            : `${count} linked ${count === 1 ? "item" : "items"}: ${
                spec.currentRefs.map((reference) => reference.label).join(", ") || "—"
              }`}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Catalogue links are still edited in Shopify. Saving here leaves them untouched.
        </p>
      </div>
    );
  }

  /* -------------------------------------------------------------------- scalars */

  if (spec.type === "rich_text_field") {
    return (
      <RichTextEditor value={value} onChange={onChange} disabled={disabled} ariaLabel={spec.name} />
    );
  }

  if (spec.type === "boolean") {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={spec.key}
          checked={isTrue(value)}
          disabled={disabled}
          aria-describedby={describedBy}
          // Shopify stores booleans as the strings "true"/"false".
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
        />
        <span className="text-muted-foreground text-xs">{isTrue(value) ? "Yes" : "No"}</span>
      </div>
    );
  }

  if (spec.choices.length > 0) {
    return (
      <Select
        value={value === "" ? NONE : value}
        disabled={disabled}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
      >
        <SelectTrigger id={spec.key} aria-invalid={invalid} className="w-full">
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {/* A blank option only where the field allows one — offering it on a required
              field invites a save Shopify will reject. */}
          {!spec.required || !value ? (
            <SelectItem value={NONE}>
              <span className="text-muted-foreground">—</span>
            </SelectItem>
          ) : null}
          {spec.choices.map((choice) => (
            <SelectItem key={choice} value={choice}>
              {choice}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (spec.type === "multi_line_text_field") {
    return (
      <Textarea
        id={spec.key}
        value={value}
        disabled={disabled}
        rows={4}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (spec.type === "json") {
    return (
      <div className="space-y-1">
        <Textarea
          id={spec.key}
          value={value}
          disabled={disabled}
          rows={8}
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-xs"
        />
        <p className="text-muted-foreground text-xs">
          Raw JSON. Malformed JSON is rejected on save, before it reaches Shopify.
        </p>
      </div>
    );
  }

  if (spec.type === "number_integer" || spec.type === "number_decimal") {
    return (
      <Input
        id={spec.key}
        type="number"
        value={value}
        disabled={disabled}
        step={spec.type === "number_integer" ? 1 : "any"}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (spec.type === "date" || spec.type === "date_time") {
    const isDateTime = spec.type === "date_time";

    return (
      <Input
        id={spec.key}
        type={isDateTime ? "datetime-local" : "date"}
        // A `datetime-local` input wants "YYYY-MM-DDTHH:mm" and Shopify stores full ISO
        // with a zone; trimming is what makes a stored value show up at all.
        value={isDateTime ? value.slice(0, 16) : value.slice(0, 10)}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <Input
      id={spec.key}
      type={spec.type === "url" ? "url" : "text"}
      value={value}
      disabled={disabled}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
