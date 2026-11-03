import { z } from "zod";

import "@/lib/zod-config";

/**
 * The fixed texts of the site — headings on product, collection and project pages, the
 * inquiry and contact forms, the 404, and the inquiry emails — editable under
 * Settings → Site texts (`lib/admin/site-texts.ts`).
 *
 * Only what someone CHANGED is stored: one json metafield on the shop,
 * `custom.site_texts`, as `{ key: text }`. Everything else is the `value` below, which
 * is what the site has always said — so a text that is emptied in the panel simply
 * goes back to its original, and a text added here later needs no migration.
 *
 * `{name}`-style placeholders are filled in where the text is used; the panel offers
 * them as buttons, so nobody has to type braces.
 *
 * Shared by the storefront, the admin, the emails and the browser: plain data.
 */

export const SITE_TEXTS_KEY = "site_texts";
export const SITE_TEXTS_VERSION = 1;
export const SITE_TEXT_MAX = 600;

/** What a placeholder stands for, in the panel's words. */
export const TEXT_VARIABLES = {
  name: "Customer’s name",
  reference: "Inquiry reference",
  brand: "Website name",
  quantity: "Minimum quantity",
} as const;

export type TextVariable = keyof typeof TEXT_VARIABLES;

type TextDefinition = {
  key: string;
  /** Where it appears, in the editor's words. */
  where: string;
  value: string;
  multiline?: boolean;
  vars?: readonly TextVariable[];
};

type TextGroup = {
  key: string;
  label: string;
  description: string;
  /** A page that shows these texts, for "See it on the site". */
  href?: string;
  texts: readonly TextDefinition[];
};

export const SITE_TEXT_GROUPS = [
  {
    key: "product",
    label: "Product page",
    description:
      "Every product page uses these. The rows and fold-out panels with a product’s details are set under Content → Product details; the product’s own words under Products.",
    href: "/shop",
    texts: [
      { key: "product.priceOnRequest", where: "Where a price would be", value: "Price on request" },
      { key: "product.enquire", where: "Button that adds the product to the inquiry", value: "enquire" },
      { key: "product.added", where: "Message after the button is pressed", value: "Added to your inquiry." },
      { key: "product.linkCopied", where: "Message after the share button copies the link", value: "Link copied." },
      {
        key: "product.minimumOrder",
        where: "Note for products with a minimum order",
        value: "Minimum order {quantity} pieces.",
        vars: ["quantity"],
      },
      { key: "product.panelDownloads", where: "Fold-out panel with files to download", value: "Downloads" },
      { key: "product.idea", where: "Heading of the story block", value: "The Idea" },
      { key: "product.designer", where: "Heading of the designer block", value: "The Designer" },
      { key: "product.designerLink", where: "Link in the designer block", value: "learn more" },
      { key: "product.collection", where: "Heading above more pieces from the same collection", value: "The Collection" },
      { key: "product.discover", where: "Heading above similar products", value: "Discover More" },
    ],
  },
  {
    key: "pages",
    label: "Collection, project & list pages",
    description: "Headings on pages that are made from your products, collections and projects.",
    href: "/collections",
    texts: [
      { key: "shop.title", where: "Shop page: heading", value: "Products" },
      { key: "collections.title", where: "All collections: heading", value: "Collections" },
      { key: "collection.designer", where: "A collection: heading of the designer block", value: "The Designer" },
      { key: "collection.inContext", where: "A collection: heading above the photos in a room", value: "In Context" },
      { key: "projects.title", where: "All projects: heading", value: "Projects" },
      { key: "project.featured", where: "A project: heading above its products", value: "Featured Items" },
      { key: "project.others", where: "A project: heading above other projects", value: "Other Projects" },
      { key: "search.title", where: "Search page: heading", value: "Search" },
    ],
  },
  {
    key: "inquiry",
    label: "Inquiry",
    description: "The list visitors collect products in, the form they send it with, and the page after sending.",
    href: "/inquiry",
    texts: [
      { key: "inquiry.title", where: "Heading of the inquiry list and page", value: "Your inquiry" },
      {
        key: "inquiry.intro",
        where: "Inquiry page: text under the heading",
        value:
          "Check the pieces below, then send them to us in one request. Nothing is ordered or charged here — we’ll reply with availability, lead times and pricing.",
        multiline: true,
      },
      { key: "inquiry.empty", where: "When the inquiry is empty", value: "Your inquiry is empty." },
      { key: "inquiry.browse", where: "Link when the inquiry is empty", value: "Browse products" },
      { key: "inquiry.reviewSend", where: "Button at the bottom of the side panel", value: "Review & send" },
      { key: "inquiry.totalProducts", where: "Inquiry page: count of products", value: "Total products" },
      { key: "inquiry.totalQuantity", where: "Inquiry page: total quantity", value: "Total quantity" },
      { key: "inquiry.clear", where: "Inquiry page: button that empties the list", value: "Clear inquiry" },
      { key: "inquiry.detailsTitle", where: "Heading above the form", value: "Your details" },
      { key: "inquiry.detailsIntro", where: "Text under that heading", value: "So we know who to reply to. Fields marked * are required." },
      { key: "inquiry.fieldName", where: "Form field: name", value: "Name*" },
      { key: "inquiry.fieldCompany", where: "Form field: company", value: "Company name" },
      { key: "inquiry.fieldEmail", where: "Form field: email", value: "Email*" },
      { key: "inquiry.fieldPhone", where: "Form field: phone", value: "Phone" },
      { key: "inquiry.fieldMessage", where: "Form field: message", value: "Message" },
      {
        key: "inquiry.formHint",
        where: "Text under the form",
        value: "Please include anything that can help us help you faster — a timeline, a budget, or the project it is for.",
        multiline: true,
      },
      { key: "inquiry.send", where: "Send button", value: "Send inquiry" },
      { key: "inquiry.sending", where: "Send button while sending", value: "Sending" },
      { key: "inquirySent.title", where: "After sending: heading", value: "Thank you — your inquiry is with us" },
      {
        key: "inquirySent.reference",
        where: "After sending: the reference number",
        value: "Your reference is {reference}. Keep it to hand if you get in touch about this request.",
        multiline: true,
        vars: ["reference"],
      },
      { key: "inquirySent.reply", where: "After sending: when you will answer", value: "We’ll come back to you by email, usually within two working days.", multiline: true },
      { key: "inquirySent.back", where: "After sending: link back to the products", value: "Back to products" },
      { key: "inquirySent.contact", where: "After sending: link to the contact page", value: "Contact us" },
    ],
  },
  {
    key: "contact",
    label: "Contact form",
    description: "The form on the Contact page. The choices under “Type of inquiry” are set on the Contact page itself.",
    href: "/contact",
    texts: [
      { key: "contact.title", where: "Heading above the form", value: "Email Us" },
      { key: "contact.fieldFirstName", where: "Form field: first name", value: "First Name*" },
      { key: "contact.fieldLastName", where: "Form field: last name", value: "Last Name*" },
      { key: "contact.fieldEmail", where: "Form field: email", value: "Email*" },
      { key: "contact.fieldPhone", where: "Form field: phone", value: "Phone*" },
      { key: "contact.fieldCompany", where: "Form field: company", value: "Company Name" },
      { key: "contact.fieldMessage", where: "Form field: message", value: "Message*" },
      {
        key: "contact.hint",
        where: "Text under the form",
        value: "Please include anything that can help us to help you faster, such as an order number, timeline or budget.",
        multiline: true,
      },
      { key: "contact.send", where: "Send button", value: "Send message" },
      { key: "contact.sending", where: "Send button while sending", value: "Sending" },
      { key: "contact.thanks", where: "After sending: heading", value: "Thank you — your message is with us." },
      { key: "contact.reply", where: "After sending: when you will answer", value: "We’ll reply by email, usually within two working days.", multiline: true },
      { key: "contact.another", where: "After sending: button to write again", value: "Send another message" },
    ],
  },
  {
    key: "forms",
    label: "Form messages",
    description:
      "What visitors see when something in the inquiry, contact or newsletter form needs fixing, when sending fails, and the newsletter sign-up itself.",
    href: "/contact",
    texts: [
      { key: "form.errorName", where: "Name left empty (inquiry form)", value: "Tell us your name." },
      { key: "form.errorFirstName", where: "First name left empty (contact form)", value: "Tell us your first name." },
      { key: "form.errorLastName", where: "Last name left empty (contact form)", value: "Tell us your last name." },
      { key: "form.errorEmail", where: "Email address missing or mistyped", value: "Enter a valid email address." },
      { key: "form.errorPhone", where: "Phone left empty (contact form)", value: "A phone number helps us reply faster." },
      { key: "form.errorInquiryType", where: "No type of inquiry chosen (contact form)", value: "Choose what this is about." },
      { key: "form.errorMessage", where: "Message left empty (contact form)", value: "Tell us what you need." },
      {
        key: "form.sendFailed",
        where: "When a form could not be sent",
        value: "We could not send that just now. Please try again, or email us directly.",
        multiline: true,
      },
      { key: "form.tooMany", where: "When one visitor sends too many at once", value: "Too many messages just now — please try again in a minute." },
      { key: "newsletter.field", where: "Newsletter: the email field", value: "Your email address" },
      { key: "newsletter.submit", where: "Newsletter: the button", value: "Submit" },
      { key: "newsletter.sending", where: "Newsletter: the button while sending", value: "Sending" },
      { key: "newsletter.thanks", where: "Newsletter: after signing up", value: "Thanks — you are on the list." },
      { key: "newsletter.again", where: "Newsletter: an address already on the list", value: "You are already on the list — thank you." },
      {
        key: "newsletter.failed",
        where: "Newsletter: when signing up fails",
        value: "We could not sign you up just now. Please try again in a moment.",
        multiline: true,
      },
    ],
  },
  {
    key: "notFound",
    label: "Page not found",
    description: "What a visitor sees on an address that does not exist.",
    href: "/page-that-does-not-exist",
    texts: [
      { key: "notFound.title", where: "Heading", value: "We couldn’t find that page" },
      {
        key: "notFound.body",
        where: "Text under the heading",
        value: "The address may be mistyped, or the page may have been renamed since the link was made.",
        multiline: true,
      },
      { key: "notFound.primary", where: "First button (to all products)", value: "Browse all products" },
      { key: "notFound.secondary", where: "Second button (to the home page)", value: "Back to home" },
    ],
  },
  {
    key: "email",
    label: "Inquiry emails",
    description: "The emails sent when a visitor sends an inquiry: the confirmation to the customer, and the message to your team.",
    texts: [
      {
        key: "email.customerSubject",
        where: "To the customer: subject",
        value: "Your {brand} inquiry — {reference}",
        vars: ["brand", "reference"],
      },
      { key: "email.customerHeading", where: "To the customer: heading", value: "Thank you — your inquiry is with us" },
      {
        key: "email.customerIntro",
        where: "To the customer: opening text",
        value:
          "Hello {name}, thank you for your interest. Your inquiry is below and attached as a PDF. We’ll come back to you by email, usually within two working days, with availability, lead times and pricing.",
        multiline: true,
        vars: ["name"],
      },
      {
        key: "email.footer",
        where: "Closing line of both emails",
        value: "This is an inquiry, not an order confirmation. Nothing has been charged.",
        multiline: true,
      },
      {
        key: "email.teamSubject",
        where: "To your team: subject",
        value: "New inquiry {reference} — {name}",
        vars: ["reference", "name"],
      },
      { key: "email.teamHeading", where: "To your team: heading", value: "New product inquiry" },
    ],
  },
] as const satisfies readonly TextGroup[];

export type SiteTextKey = (typeof SITE_TEXT_GROUPS)[number]["texts"][number]["key"];
export type SiteTexts = Record<SiteTextKey, string>;

const DEFINITIONS = new Map<string, TextDefinition>(
  SITE_TEXT_GROUPS.flatMap((group) => group.texts.map((text) => [text.key, text] as const)),
);

export const isSiteTextKey = (key: string): key is SiteTextKey => DEFINITIONS.has(key);
export const siteTextDefinition = (key: SiteTextKey) => DEFINITIONS.get(key)!;

/** Every text as the site has always said it. */
export const DEFAULT_SITE_TEXTS = Object.fromEntries(
  [...DEFINITIONS.values()].map((text) => [text.key, text.value]),
) as SiteTexts;

const storedSchema = z.object({
  version: z.literal(SITE_TEXTS_VERSION),
  texts: z.record(z.string(), z.string().max(SITE_TEXT_MAX)),
  savedAt: z.string().nullable().optional(),
  savedBy: z.string().nullable().optional(),
});

export type StoredSiteTexts = z.infer<typeof storedSchema>;

export function parseSiteTexts(raw: string | null | undefined): StoredSiteTexts | null {
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Only real changes: a key this version no longer knows, an empty text, or one equal
 * to its original is dropped — so the original keeps applying if it is improved later.
 */
export function onlyChanges(texts: Record<string, string>): Partial<SiteTexts> {
  const changes: Partial<SiteTexts> = {};
  for (const [key, value] of Object.entries(texts)) {
    const text = value.trim();
    if (isSiteTextKey(key) && text && text !== DEFAULT_SITE_TEXTS[key]) changes[key] = text;
  }
  return changes;
}

/** The originals with the saved changes on top. */
export function resolveSiteTexts(stored: StoredSiteTexts | null): SiteTexts {
  return { ...DEFAULT_SITE_TEXTS, ...onlyChanges(stored?.texts ?? {}) };
}

/** Fills `{name}`-style placeholders; one with no value is left as it is. */
export function fillText(text: string, values: Partial<Record<TextVariable, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name as TextVariable];
    return value === undefined || value === null ? match : String(value);
  });
}
