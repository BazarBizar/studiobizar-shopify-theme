"use client";

import { ExternalLinkIcon } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/admin/ui/badge";
import type { ValueKind } from "@/components/admin/data-table/filters";
import { formatDate, toPlainText } from "@/lib/admin/field-values";

/**
 * One cell renderer, dispatching on `kind` rather than on the field's name — the same
 * discipline the form uses. A new Shopify field type renders sensibly without this
 * file being touched, because `kindForFieldType` maps it to one of these.
 */

export type CellData = {
  kind: ValueKind;
  /** Raw stored value, still a string — see the note in lib/admin/field-values.ts. */
  value: string | null;
  /** Resolved reference labels, for `reference` and `list` kinds. */
  labels: string[];
  thumbnail: string | null;
};

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

export function CellValue({ cell }: { cell: CellData | undefined }) {
  if (!cell) return <Empty />;

  const { kind, value, labels, thumbnail } = cell;

  if (kind === "media") {
    if (!thumbnail) {
      // No preview resolved (a video without a poster, a non-image file).
      return value ? <span className="font-mono text-xs">file</span> : <Empty />;
    }

    return (
      <span className="bg-muted block size-9 overflow-hidden rounded-md border">
        {/* Unoptimised to match the storefront: images come straight off the Shopify
            CDN with its own transform, and next.config.ts bypasses the optimiser. */}
        <Image
          src={thumbnail}
          alt=""
          width={36}
          height={36}
          unoptimized
          className="size-full object-cover"
        />
      </span>
    );
  }

  if (kind === "boolean") {
    if (!value) return <Empty />;
    return value === "true" ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>;
  }

  if (kind === "reference") {
    if (!labels.length) return <Empty />;
    return <Badge variant="secondary">{labels[0]}</Badge>;
  }

  if (kind === "list") {
    if (!labels.length) return <Empty />;

    const shown = labels.slice(0, 3);
    const overflow = labels.length - shown.length;

    return (
      <span className="flex flex-wrap items-center gap-1">
        {shown.map((label, index) => (
          <Badge key={`${label}-${index}`} variant="secondary">
            {label}
          </Badge>
        ))}
        {overflow > 0 ? <Badge variant="outline">+{overflow}</Badge> : null}
      </span>
    );
  }

  if (kind === "color") {
    if (!value) return <Empty />;
    return (
      <span className="flex items-center gap-2">
        {/* An inline style is unavoidable here: the colour is data, so no class can
            be known at build time. The panel's no-inline-style rule is about design
            tokens, not about rendering a stored swatch. */}
        <span
          className="size-4 rounded border"
          style={{ backgroundColor: value }}
          aria-hidden
        />
        <span className="font-mono text-xs">{value}</span>
      </span>
    );
  }

  if (kind === "url") {
    if (!value) return <Empty />;
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 underline underline-offset-2"
      >
        <span className="max-w-56 truncate">{value}</span>
        <ExternalLinkIcon className="size-3 shrink-0" />
      </a>
    );
  }

  if (kind === "number") {
    // Deliberately NO wrapper element. Inside a right-aligned cell, a block with a
    // max-width pins the number to the block's right edge rather than the cell's, so
    // it floats in the middle of a wide column.
    return value ? <>{value}</> : <Empty />;
  }

  if (kind === "date") {
    if (!value) return <Empty />;
    return <span className="tabular-nums">{formatDate(value, true)}</span>;
  }

  if (kind === "longtext" || kind === "json") {
    const text = toPlainText(kind === "json" ? "json" : "rich_text_field", value);
    if (!text) return <Empty />;
    return (
      <span className="block max-w-80 truncate" title={text}>
        {text}
      </span>
    );
  }

  if (!value) return <Empty />;
  return (
    <span className="block max-w-72 truncate" title={value}>
      {value}
    </span>
  );
}
