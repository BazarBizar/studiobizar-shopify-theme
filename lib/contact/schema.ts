import { z } from "zod";

/**
 * The Contact page form, which is a different, richer form from the inquiry one
 * in `lib/inquiry/schema.ts` — the design splits the name and adds a required
 * phone and inquiry type. Shared by the form and `POST /api/contact`.
 */
export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Tell us your first name.").max(80),
  lastName: z.string().trim().min(1, "Tell us your last name.").max(80),
  email: z.email("Enter a valid email address.").max(200),
  phone: z.string().trim().min(1, "A phone number helps us reply faster.").max(60),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  inquiryType: z.string().trim().min(1, "Choose what this is about.").max(80),
  message: z.string().trim().min(1, "Tell us what you need.").max(4000),
});

export type ContactSubmission = z.infer<typeof contactSchema>;
