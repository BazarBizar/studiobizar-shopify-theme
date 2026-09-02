import { z } from "zod";

/**
 * One schema, used by the form in the browser and by `POST /api/inquiry` on the
 * server, so the two can never disagree about what a valid inquiry is.
 */

export const inquiryItemSchema = z.object({
  variantId: z.string().min(1),
  productHandle: z.string().min(1),
  sku: z.string().nullable(),
  title: z.string().min(1),
  variantTitle: z.string().nullable(),
  qty: z.number().int().min(1).max(999),
  image: z.string().nullable(),
});

export const inquiryContactSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.email("Enter a valid email address.").max(200),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
});

export const inquirySubmissionSchema = inquiryContactSchema.extend({
  items: z.array(inquiryItemSchema).min(1, "Add at least one product to your inquiry."),
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
