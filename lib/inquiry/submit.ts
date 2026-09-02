import "server-only";

import { adminFetch, assertNoUserErrors } from "@/lib/shopify/admin";

import { generateInquiryId, type InquirySubmission } from "./schema";

const CREATE_METAOBJECT = /* GraphQL */ `
  mutation CreateInquiry($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type CreateResult = {
  metaobjectCreate: {
    metaobject: { id: string; handle: string } | null;
    userErrors: { field?: string[] | null; message: string }[];
  };
};

/**
 * Writes the inquiry to Shopify. This is the authoritative step — the PDF and
 * the emails are enhancements layered on top, and a failure in either must not
 * lose the inquiry.
 */
export async function saveInquiry(submission: InquirySubmission, submittedAt = new Date()) {
  const inquiryId = generateInquiryId(submittedAt);

  const totalQuantity = submission.items.reduce((total, item) => total + item.qty, 0);

  // Stored as JSON, not product references, so the record still reads correctly
  // if a product is later renamed or removed from the catalogue.
  const items = submission.items.map((item) => ({
    sku: item.sku,
    title: item.title,
    variantTitle: item.variantTitle,
    qty: item.qty,
    variantId: item.variantId,
    productHandle: item.productHandle,
  }));

  const fields = [
    { key: "inquiry_id", value: inquiryId },
    { key: "submitted_at", value: submittedAt.toISOString() },
    { key: "customer_name", value: submission.name },
    { key: "company", value: submission.company || "" },
    { key: "email", value: submission.email },
    { key: "phone", value: submission.phone || "" },
    { key: "message", value: submission.message || "" },
    { key: "items", value: JSON.stringify(items) },
    { key: "total_products", value: String(submission.items.length) },
    { key: "total_quantity", value: String(totalQuantity) },
    { key: "status", value: "new" },
  ];

  const data = await adminFetch<CreateResult>(CREATE_METAOBJECT, {
    metaobject: {
      type: "inquiry",
      // The ID doubles as the handle, so an inquiry is findable by reference.
      handle: inquiryId.toLowerCase(),
      fields,
    },
  });

  assertNoUserErrors(data.metaobjectCreate.userErrors, "metaobjectCreate(inquiry)");

  if (!data.metaobjectCreate.metaobject) {
    throw new Error("Shopify accepted the inquiry but returned no metaobject.");
  }

  return {
    inquiryId,
    metaobjectId: data.metaobjectCreate.metaobject.id,
    submittedAt,
    totalProducts: submission.items.length,
    totalQuantity,
  };
}
