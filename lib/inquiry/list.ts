import "server-only";

import { adminFetch } from "@/lib/shopify/admin";

export type InquiryRecord = {
  id: string;
  inquiryId: string;
  submittedAt: string;
  email: string;
  status: string;
  totalProducts: number;
  totalQuantity: number;
  items: { title: string; variantTitle: string | null; qty: number; productHandle: string }[];
};

const QUERY = /* GraphQL */ `
  query InquiriesByType($first: Int!, $after: String) {
    metaobjects(type: "inquiry", first: $first, after: $after) {
      nodes {
        id
        fields {
          key
          value
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function field(fields: { key: string; value: string | null }[], key: string): string {
  return fields.find((f) => f.key === key)?.value ?? "";
}

/**
 * Metaobjects have no server-side filter by field value on either API, so
 * this pages through everything and matches the email in JS — the same
 * approach `app/faq/page.tsx` already uses for its category grouping. Fine at
 * this store's volume; worth a real filter if the inquiry list ever grows
 * into the thousands.
 */
export async function getInquiriesByEmail(email: string): Promise<InquiryRecord[]> {
  const target = email.trim().toLowerCase();
  const matches: InquiryRecord[] = [];
  let after: string | null = null;

  for (let page = 0; page < 20; page++) {
    const data: {
      metaobjects: {
        nodes: { id: string; fields: { key: string; value: string | null }[] }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await adminFetch(QUERY, { first: 100, after });

    for (const node of data.metaobjects.nodes) {
      if (field(node.fields, "email").trim().toLowerCase() !== target) continue;

      let items: InquiryRecord["items"] = [];
      try {
        items = JSON.parse(field(node.fields, "items") || "[]");
      } catch {
        items = [];
      }

      matches.push({
        id: node.id,
        inquiryId: field(node.fields, "inquiry_id"),
        submittedAt: field(node.fields, "submitted_at"),
        email: field(node.fields, "email"),
        status: field(node.fields, "status") || "new",
        totalProducts: Number(field(node.fields, "total_products")) || 0,
        totalQuantity: Number(field(node.fields, "total_quantity")) || 0,
        items,
      });
    }

    if (!data.metaobjects.pageInfo.hasNextPage) break;
    after = data.metaobjects.pageInfo.endCursor;
  }

  return matches.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
