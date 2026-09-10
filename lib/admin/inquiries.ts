import "server-only";

import { cache } from "react";

import { listAllEntries, type Entry } from "./metaobjects";

/**
 * Inquiries — the canonical customer-generated record. The panel reads them and almost
 * never writes them.
 *
 * ADAPTED TO THIS STORE'S SCHEMA. The shared spec is written around fields this
 * definition does not have (`is_read`, `reference`, `grand_total`, `currency`,
 * `company_id`). Rather than migrate the storefront's inquiry form to match a panel, the
 * panel reads what the form actually writes:
 *
 *   inquiry_id · submitted_at · customer_name · company · email · phone
 *   message · items · total_products · total_quantity · status
 *
 * UNREAD IS `status === "new"`, not a separate `is_read` flag. The storefront writes
 * `status: "new"` on submission, so it already carries the meaning — and it does so in
 * one field an operator can also act on.
 *
 * WHAT IS DELIBERATELY NOT DONE: opening the detail page does NOT mark an inquiry read.
 * With a dedicated `is_read` flag that would be right — it records only that somebody
 * looked. Here the only field available is `status`, and moving it from "new" to
 * "contacted" claims the customer has been contacted. Silently asserting that because a
 * page was opened would put a false statement into a record the business relies on. The
 * operator changes status explicitly; the badge counts what is still "new".
 */

export const INQUIRY_TYPE = "inquiry";

export type InquiryItem = {
  sku: string | null;
  title: string | null;
  variantTitle: string | null;
  qty: number;
  variantId: string | null;
  productHandle: string | null;
};

export type Inquiry = {
  id: string;
  param: string;
  handle: string;
  reference: string;
  submittedAt: string | null;
  customerName: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  totalProducts: number;
  totalQuantity: number;
  items: InquiryItem[];
  updatedAt: string;
};

const value = (entry: Entry, key: string) =>
  entry.fields.find((field) => field.key === key)?.value ?? "";

function parseItems(raw: string): InquiryItem[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        sku: record.sku ? String(record.sku) : null,
        title: record.title ? String(record.title) : null,
        variantTitle: record.variantTitle ? String(record.variantTitle) : null,
        qty: Number(record.qty ?? 0),
        variantId: record.variantId ? String(record.variantId) : null,
        productHandle: record.productHandle ? String(record.productHandle) : null,
      };
    });
    // A malformed blob must not take down the whole screen; an inquiry with unreadable
    // items is still worth showing for its contact details.
  } catch {
    return [];
  }
}

function toInquiry(entry: Entry): Inquiry {
  return {
    id: entry.id,
    param: entry.id.split("/").pop() ?? entry.id,
    handle: entry.handle,
    // The storefront uses the inquiry id as the handle, so it doubles as the reference.
    reference: value(entry, "inquiry_id") || entry.handle,
    submittedAt: value(entry, "submitted_at") || null,
    customerName: value(entry, "customer_name"),
    company: value(entry, "company"),
    email: value(entry, "email"),
    phone: value(entry, "phone"),
    message: value(entry, "message"),
    status: value(entry, "status") || "new",
    totalProducts: Number(value(entry, "total_products") || 0),
    totalQuantity: Number(value(entry, "total_quantity") || 0),
    items: parseItems(value(entry, "items")),
    updatedAt: entry.updatedAt,
  };
}

/**
 * Memoised per request, so the sidebar badge and the list screen share ONE query. Without
 * this the count beside the nav item would be a second fetch of the same rows on every
 * page in the panel.
 */
export const loadInquiries = cache(async (): Promise<Inquiry[]> => {
  const entries = await listAllEntries(INQUIRY_TYPE).catch(() => []);
  return entries
    .map(toInquiry)
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
});

/** How many are still `new`. Reuses the memoised list — no extra request. */
export async function countUnreadInquiries(): Promise<number> {
  const inquiries = await loadInquiries();
  return inquiries.filter((inquiry) => inquiry.status === "new").length;
}

export async function getInquiry(param: string): Promise<Inquiry | null> {
  const inquiries = await loadInquiries();
  return inquiries.find((inquiry) => inquiry.param === param) ?? null;
}
