/**
 * The words a person sees for each field — label and one line of help — written for the
 * people who edit the site, not for whoever named the field in Shopify.
 *
 * Shopify stays the authority on WHICH fields exist and what they hold; this only renames
 * them on screen. A key listed here that no longer exists is ignored, and a field nobody
 * has written copy for falls back to its Shopify name and description, so a field added
 * in Shopify tomorrow still shows up — just with its raw name until it gets a line here.
 *
 * No `server-only`: the product editor builds its form in the browser.
 */

export type FieldCopy = {
  label?: string;
  help?: string;
  /**
   * Kept off the form. Only for values the panel looks after itself — a manual order
   * that the list's drag handles set — never for content someone might need to change.
   */
  hidden?: boolean;
  /** Friendly names for a field's fixed choices, keyed by the stored value. */
  choiceLabels?: Record<string, string>;
};

const ORDER: FieldCopy = { label: "Position", hidden: true };

const ALT: FieldCopy = {
  label: "Image description",
  help: "A short description of the photo for people who cannot see it, and for Google. E.g. “Oak dining table in a bright room”.",
};

export const FIELD_COPY: Record<string, Record<string, FieldCopy>> = {
  captioned_image: {
    image: { label: "Photo", help: "The picture itself." },
    caption: { label: "Caption", help: "Shown under the photo on the site." },
    alt_text: ALT,
    credit: { label: "Photo credit", help: "The photographer’s name, if they should be credited." },
    video: { label: "Video (optional)", help: "Plays instead of the photo where the site supports it." },
  },

  designer: {
    name: { label: "Name" },
    studio: { label: "Studio", help: "Their studio or company, if any." },
    byline: { label: "Short line under the name", help: "E.g. “Furniture designer, Antwerp”." },
    portrait: { label: "Portrait photo" },
    portrait_alt: ALT,
    bio_short: { label: "Short bio", help: "One or two sentences, shown on the designers overview." },
    bio_full: { label: "Full bio", help: "Shown on the designer’s own page." },
    sort_order: ORDER,
  },

  project: {
    title: { label: "Project name" },
    subtitle: { label: "Subtitle", help: "One sentence under the name." },
    location: { label: "Location", help: "City and country, e.g. “Mallorca, Spain”." },
    year: { label: "Year" },
    category: { label: "Category" },
    hero_image: { label: "Main photo", help: "The large photo at the top of the project page." },
    card_image: {
      label: "Thumbnail photo",
      help: "Shown on the projects overview. Leave empty to use the main photo.",
    },
    body: { label: "Story", help: "The text on the project page." },
    creative_lead: { label: "Creative lead" },
    collaborators: { label: "Collaborators", help: "One per line, e.g. “Architects: Taller Lentisco”." },
    photography: { label: "Photographer" },
    gallery: {
      label: "Photo gallery",
      help: "The photos on the project page, in this order. Use the arrows to reorder.",
    },
    featured_items: { label: "Products used", help: "Products from the shop that appear in this project." },
    is_selected: { label: "Show on the homepage", help: "Switch on to feature this project on the homepage." },
    related_projects: { label: "Related projects", help: "Suggested at the bottom of the project page." },
    sort_order: ORDER,
  },

  service: {
    title: { label: "Service name" },
    body: { label: "Description" },
    sort_order: ORDER,
  },

  faq_item: {
    question: { label: "Question" },
    answer: { label: "Answer" },
    category: { label: "Topic", help: "Questions with the same topic are grouped together on the FAQ page." },
    sort_order: ORDER,
  },

  location: {
    name: { label: "Name", help: "E.g. “Showroom Antwerp”." },
    kind: { label: "Type of place", help: "E.g. showroom, warehouse, office." },
    address: { label: "Address", help: "As it should appear on the site. Line breaks are kept." },
    phone: { label: "Phone number" },
    email: { label: "Email address" },
    hours: { label: "Opening hours", help: "One line per day or group of days." },
    image: { label: "Photo" },
    map_url: { label: "Map link", help: "Paste the “Share” link from Google Maps." },
    sort_order: ORDER,
  },

  contact_channel: {
    label: { label: "Name", help: "What the row is called, e.g. “Telephone” or “Instagram”." },
    value: { label: "What people see", help: "E.g. the phone number, the email address or @yourhandle." },
    link_type: {
      label: "What happens on click",
      choiceLabels: {
        email: "Opens an email",
        phone: "Calls the number",
        url: "Opens a website",
        text: "Nothing — just text",
      },
    },
    link_url: {
      label: "Website link",
      help: "Only needed when clicking opens a website.",
    },
    sort_order: ORDER,
  },

  site_settings: {
    // Only the settings entry's own name ("Site Settings"); the site never shows it. As
    // "Site name" it read like the shop's name, which changing here would not change.
    title: { label: "Entry name", hidden: true },
    featured_collections: {
      label: "Featured collections",
      help: "The collections highlighted across the site, in this order.",
    },
    newsletter_invitation: { label: "Newsletter text", help: "The sentence above the newsletter sign-up at the bottom of every page." },
    footer_region_line: { label: "Footer bottom line", help: "Shown beside the copyright at the very bottom of every page." },
    contact_cta_body: {
      label: "“Contact us” block — text",
      help: "The closing block on several pages, inviting people to get in touch.",
    },
    contact_cta_label: { label: "“Contact us” block — button text" },
    social_instagram: { label: "Instagram link" },
    social_facebook: { label: "Facebook link" },
    social_pinterest: { label: "Pinterest link" },
    social_linkedin: { label: "LinkedIn link" },
    social_five: { label: "Extra social link (5th icon)", help: "Leave empty to hide the icon." },
    social_six: { label: "Extra social link (6th icon)", help: "Leave empty to hide the icon." },
    footer_tagline: { label: "Footer tagline", help: "Beside the logo at the bottom of every page. Line breaks are kept." },
    instagram_feed: {
      label: "Instagram feed",
      help: "The feed ID from your Behold account (behold.so → your feed → Feed ID), or its https://feeds.behold.so/… address. The Instagram row on the site shows these posts; empty keeps the one set on the server.",
    },
  },

  site_identity: {
    site_name: {
      label: "Website name",
      help: "Shown after each page’s title in the browser tab and in Google, e.g. “Our Story · Studio Bizar”.",
    },
    logo: {
      label: "Logo",
      help: "Replaces the Studio Bizar logo in the header and footer. An SVG or a PNG with a transparent background works best. Empty keeps the original.",
    },
    logo_mark: {
      label: "Small logo (symbol)",
      help: "Used where the site shows only the symbol, like the large mark in the footer. Empty keeps the original.",
    },
    logo_colour: {
      label: "Logo colours",
      help: "“Same colour as the text” suits a one-colour logo: it turns light on dark backgrounds by itself. Choose “The logo’s own colours” for a logo with several colours.",
      choiceLabels: { text: "Same colour as the text", original: "The logo’s own colours" },
    },
    favicon: {
      label: "Browser tab icon",
      help: "The small icon in the browser tab and on a phone’s home screen. A square image, at least 180 × 180 pixels. Empty keeps the original.",
    },
    meta_description: {
      label: "Description for search engines",
      help: "One or two sentences Google may show under the website’s name. Used for every page that has no description of its own. Up to about 155 characters shows in full.",
    },
    share_image: {
      label: "Share image",
      help: "The picture shown when someone shares a link to the website on WhatsApp, Facebook or LinkedIn. 1200 × 630 pixels works best. Product, project and designer pages use their own photo.",
    },
    theme_color: {
      label: "Browser colour on phones",
      help: "Colours the address bar in some phone browsers. Leave empty for the browser’s own.",
    },
    google_verification: {
      label: "Google Search Console code",
      help: "Only if Google asks you to prove you own the website: paste the code from the “HTML tag” method (the part in content=\"…\"), or the whole tag.",
    },
  },

  email_notification: {
    name: { label: "Name" },
    notification_type: {
      label: "Which emails",
      choiceLabels: {
        default: "Everything else",
        product_inquiry: "Product inquiries",
        contact: "Contact form messages",
      },
    },
    recipients: { label: "Send to", help: "Email addresses, one per line." },
    enabled: {
      label: "Sending",
      help: "Switch off to stop these emails completely.",
    },
  },

  admin_settings: {
    panel_title: { label: "Admin name", help: "Shown at the top of the menu and in the browser tab." },
    panel_subtitle: { label: "Line under the name", help: "Leave empty for “Admin”." },
    panel_initials: { label: "Initials", help: "Up to three letters, shown when there is no logo." },
    logo: { label: "Logo", help: "Shown at the top of the menu and on the sign-in page. A square image works best." },
    favicon: { label: "Browser tab icon", help: "The small icon in the browser tab. A square PNG works best." },
    dashboard_title: { label: "Dashboard heading", help: "Leave empty for “Dashboard”." },
    dashboard_description: { label: "Dashboard intro", help: "The sentence under the dashboard heading." },
  },

  inquiry: {
    inquiry_id: { label: "Reference" },
    submitted_at: { label: "Received" },
    customer_name: { label: "Name" },
    company: { label: "Company" },
    email: { label: "Email" },
    phone: { label: "Phone" },
    message: { label: "Message" },
    items: { label: "Products asked about" },
    total_products: { label: "Products" },
    total_quantity: { label: "Pieces" },
    status: {
      label: "Status",
      choiceLabels: { new: "New", contacted: "Contacted", closed: "Closed" },
    },
  },

  contact_message: {
    name: { label: "Name" },
    email: { label: "Email" },
    phone: { label: "Phone" },
    company: { label: "Company" },
    topic: { label: "About" },
    message: { label: "Message" },
    received_at: { label: "Received" },
    status: {
      label: "Status",
      choiceLabels: { new: "New", replied: "Replied", closed: "Closed" },
    },
    email_status: { label: "Email to the team", help: "Whether the team was emailed about this message." },
  },

  newsletter_subscriber: {
    email: { label: "Email" },
    subscribed_at: { label: "Signed up" },
    source: { label: "Signed up on", help: "The page the form was sent from." },
    status: {
      label: "Status",
      help: "Set to Unsubscribed when someone asks to be taken off the list.",
      choiceLabels: { subscribed: "Subscribed", unsubscribed: "Unsubscribed" },
    },
  },

  /** Product metafields, by key without the `custom.` namespace. */
  product: {
    designer: { label: "Designer", help: "Who designed this piece." },
    collection_label: { label: "Collection name", help: "Shown above the product name, e.g. “Moyo”." },
    signature_collection: { label: "Signature collection", help: "The collection this piece belongs to." },
    is_new: { label: "Mark as new", help: "Shows a “New” label on the product." },
    material_finish: { label: "Material / finish" },
    colour: { label: "Colour" },
    upholstery: { label: "Upholstery" },
    availability: { label: "Availability", help: "E.g. “In stock” or “Made to order”." },
    technical_specifications: { label: "Technical specifications" },
    dimensions: { label: "Dimensions" },
    care_maintenance: { label: "Care & maintenance" },
    shipping_delivery: { label: "Shipping & delivery" },
    downloads: { label: "Downloads", help: "Files customers can download, e.g. a spec sheet PDF." },
    idea_body: { label: "“The idea” — text", help: "The story behind the piece." },
    idea_image: { label: "“The idea” — photo" },
    in_context_images: { label: "Photos in a room", help: "Photos of the piece in a real interior, in this order." },
    moq: { label: "Minimum order quantity" },
    lead_time_weeks: { label: "Lead time", help: "E.g. “6–8 weeks”." },
  },
};

export function fieldCopy(type: string, key: string): FieldCopy {
  return FIELD_COPY[type]?.[key.replace(/^custom\./, "")] ?? {};
}
