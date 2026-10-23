import { z } from "zod";

import "@/lib/zod-config";

/**
 * One schema, used by the form in the browser and by `POST /api/inquiry` on the
 * server, so the two can never disagree about what a valid inquiry is.
 */

/**
 * Bounded everywhere: these arrive from a visitor, are stored, drawn into a PDF and
 * mailed — including to the address they typed — so nothing in them may be large.
 */
export const inquiryItemSchema = z.object({
  variantId: z.string().min(1).max(200),
  productHandle: z.string().min(1).max(255),
  sku: z.string().max(100).nullable(),
  title: z.string().min(1).max(255),
  variantTitle: z.string().max(255).nullable(),
  qty: z.number().int().min(1).max(999),
  image: z.string().max(2048).nullable(),
});

/** More distinct products than one inquiry has any reason to hold. */
export const MAX_INQUIRY_ITEMS = 100;

export const inquiryContactSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.email("Enter a valid email address.").max(200),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const inquirySubmissionSchema = inquiryContactSchema.extend({
  items: z
    .array(inquiryItemSchema)
    .min(1, "Add at least one product to your inquiry.")
    .max(MAX_INQUIRY_ITEMS, `An inquiry can hold up to ${MAX_INQUIRY_ITEMS} products — send the rest in a second one.`),
});

export type InquiryContact = z.infer<typeof inquiryContactSchema>;
export type InquirySubmission = z.infer<typeof inquirySubmissionSchema>;

/** `INQ-YYYYMMDD-XXXX`, per the brief. Also used as the metaobject handle. */
export function generateInquiryId(now = new Date()): string {
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");

  // Avoids the ambiguous glyphs so the reference is easy to read back over the phone.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `INQ-${date}-${suffix}`;
}
