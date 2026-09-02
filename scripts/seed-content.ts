/**
 * The rest of S3: `service`, `contact_channel` and `faq_item` entries, plus the
 * PAGE metafields behind Our Story, Our Services and Contact.
 *
 * The Service page's ten service names, its "Design Program" and "Beyond The
 * Project" copy, and every contact channel value are **transcribed from the
 * designs** — those pages carry real text rather than lorem. Service
 * descriptions, the Our Story blocks and all FAQ answers are **invented**.
 *
 *   npx tsx scripts/seed-content.ts [--dry-run]
 *
 * Idempotent: existing entries are skipped, metafields are re-set.
 */

import { DRY_RUN, admin, assertNoUserErrors, log, richText, setMetafields } from "./lib/admin";

/* -------------------------------------------------------------------------- *
 * service — names transcribed from DESK - Service.pdf, bodies invented
 * -------------------------------------------------------------------------- */

const SERVICES: { handle: string; title: string; body: string }[] = [
  {
    handle: "concept-development",
    title: "Concept Development",
    body: "We start from the room, not the catalogue. Mood, materials and a first cut of the piece list, before anything is specified.",
  },
  {
    handle: "private-white-label-development",
    title: "Private- & White-label Development",
    body: "Your name on the piece, our workshop behind it. Tooling, finishes and packaging developed to your specification.",
  },
  {
    handle: "project-management",
    title: "Project Management",
    body: "One contact from first drawing to final delivery, holding the timeline against the makers and the freight.",
  },
  {
    handle: "custom-design",
    title: "Custom Design",
    body: "Where nothing in the collection fits, we draw it. Prototyped in the same workshop that will build the run.",
  },
  {
    handle: "bulk-purchasing-price-optimization",
    title: "Bulk Purchasing & Price Optimization",
    body: "Volume changes what is possible. We consolidate orders across a project to bring the landed cost down.",
  },
  {
    handle: "renderings",
    title: "Renderings",
    body: "Photoreal visuals of the specified pieces in your space, so the client signs off on the room rather than a list.",
  },
  {
    handle: "quality-control",
    title: "Quality Control",
    body: "Every batch inspected at the workshop before it ships — joinery, finish and moisture content, against a written standard.",
  },
  {
    handle: "sourcing-support",
    title: "Sourcing Support",
    body: "Two decades of maker relationships in Indonesia and beyond, opened up for pieces we do not make ourselves.",
  },
  {
    handle: "logistics-support",
    title: "Logistics Support",
    body: "Consolidated container shipping, customs paperwork and delivery scheduled to the site, not the warehouse.",
  },
  {
    handle: "sourcing-catalogue-access",
    title: "Sourcing Catalogue Access",
    body: "The full catalogue with trade pricing, live stock and lead times, for partners working at volume.",
  },
];

/* -------------------------------------------------------------------------- *
 * contact_channel — every value transcribed from DESK - Contact.pdf
 * -------------------------------------------------------------------------- */

const CHANNELS: {
  handle: string;
  label: string;
  value: string;
  linkType: "email" | "phone" | "url" | "text";
  linkUrl?: string;
}[] = [
  { handle: "general-inquiries", label: "General Inquiries", value: "info@studiobizar.be", linkType: "email" },
  { handle: "trade-wholesale", label: "Trade & Wholesale", value: "sales@studiobizar.be", linkType: "email" },
  { handle: "media-inquiries", label: "Media Inquiries", value: "press@studiobizar.be", linkType: "email" },
  {
    handle: "our-showroom",
    label: "Our Showroom",
    value: "Duffelsesteenweg 152, Kontich, Antwerp, 2550",
    linkType: "text",
  },
  { handle: "telephone", label: "Telephone", value: "+32 475 80 54 12", linkType: "phone" },
  {
    handle: "instagram",
    label: "Instagram",
    value: "@studiobizarantwerp",
    linkType: "url",
    linkUrl: "https://www.instagram.com/studiobizarantwerp",
  },
  {
    handle: "facebook",
    label: "Facebook",
    value: "@studiobizarantwerp",
    linkType: "url",
    linkUrl: "https://www.facebook.com/studiobizarantwerp",
  },
  {
    handle: "pinterest",
    label: "Pinterest",
    value: "@studiobizarantwerp",
    linkType: "url",
    linkUrl: "https://www.pinterest.com/studiobizarantwerp",
  },
];

/** The design's "Type of Inquiry" control. */
const INQUIRY_TYPES = [
  "General",
  "Trade & Wholesale",
  "Project or Contract",
  "Press & Media",
  "Careers",
];

/* -------------------------------------------------------------------------- *
 * faq_item — invented
 * -------------------------------------------------------------------------- */

const FAQS: { handle: string; question: string; answer: string; category: string }[] = [
  { handle: "faq-prices", question: "Why are no prices shown?", answer: "Every piece is quoted per project — volume, finish and destination all move the number. Send an inquiry and we come back with pricing and lead times.", category: "Ordering" },
  { handle: "faq-lead-times", question: "What are your lead times?", answer: "In-stock pieces ship in two to three weeks. Made-to-order runs are typically ten to sixteen weeks, confirmed when the order is placed.", category: "Ordering" },
  { handle: "faq-minimum-order", question: "Is there a minimum order?", answer: "Not for most pieces. A few are sold in pairs or sets, and the minimum is shown on the product page where one applies.", category: "Ordering" },
  { handle: "faq-samples", question: "Can I see a material sample first?", answer: "Yes. We send finish and fabric samples free of charge for specified projects.", category: "Ordering" },
  { handle: "faq-trade", question: "Do you work with trade and contract clients?", answer: "Most of what we do is trade. Architects, designers, hotels and restaurants work with us through the Design Program.", category: "Trade" },
  { handle: "faq-custom", question: "Can you make something bespoke?", answer: "Yes — dimensions, finishes and in some cases a piece drawn from scratch. Custom Design covers it.", category: "Trade" },
  { handle: "faq-shipping", question: "Where do you ship?", answer: "Worldwide. Consolidated container freight for projects, and pallet delivery to the room of your choice within Europe.", category: "Delivery" },
  { handle: "faq-assembly", question: "Does anything need assembling?", answer: "Most pieces arrive assembled. Larger tables ship with the top separate, and that is stated on the product page.", category: "Delivery" },
  { handle: "faq-care", question: "How should I care for solid teak?", answer: "Dust it, and re-oil once a year or whenever the surface starts to look dry. Avoid standing water and long spells of direct sun.", category: "Care" },
  { handle: "faq-sustainability", question: "Where does your timber come from?", answer: "Reclaimed teak wherever possible, and FSC-certified stock otherwise. If a timber cannot be traced, it does not enter a collection.", category: "Materials" },
];

/* -------------------------------------------------------------------------- *
 * PAGE metafields
 * -------------------------------------------------------------------------- */

const STORY_BLOCK_1 = [
  "Studio Bizar began in a warehouse in Kontich with a container of teak and no particular plan. What we knew was that furniture had got worse — thinner, faster, harder to repair — and that the makers who could do better were still there if you went looking.",
  "So we went looking. The relationships we built in Bali and Java two decades ago are the same ones the workshop runs on now.",
];

const STORY_BLOCK_2 = [
  "Everything is still made by hand, which means no two pieces are identical and none of them pretend to be. A joint is visible because it is doing work. A grain runs where the tree put it.",
  "We design for a long second life: pieces that can be re-oiled, re-woven and re-upholstered rather than replaced.",
];

async function existing(type: string): Promise<Set<string>> {
  const data = await admin<{ metaobjects: { nodes: { handle: string }[] } }>(
    /* GraphQL */ `
      query E($type: String!) {
        metaobjects(type: $type, first: 200) {
          nodes {
            handle
          }
        }
      }
    `,
    { type },
  );
  return new Set(data.metaobjects.nodes.map((node) => node.handle));
}

async function create(type: string, handle: string, fields: { key: string; value: string }[]) {
  const data = await admin<{
    metaobjectCreate: {
      metaobject: { id: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    /* GraphQL */ `
      mutation C($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    { metaobject: { type, handle, fields } },
  );

  assertNoUserErrors(data.metaobjectCreate.userErrors, `${type} ${handle}`);
  return data.metaobjectCreate.metaobject!.id;
}

async function idsByHandle(type: string, handles: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const handle of handles) {
    const data = await admin<{ metaobjectByHandle: { id: string } | null }>(
      /* GraphQL */ `
        query B($handle: MetaobjectHandleInput!) {
          metaobjectByHandle(handle: $handle) {
            id
          }
        }
      `,
      { handle: { type, handle } },
    );
    if (data.metaobjectByHandle) ids.push(data.metaobjectByHandle.id);
  }
  return ids;
}

async function pageId(handle: string): Promise<string | null> {
  const data = await admin<{ pages: { nodes: { id: string; handle: string }[] } }>(
    /* GraphQL */ `
      query P($query: String!) {
        pages(first: 5, query: $query) {
          nodes {
            id
            handle
          }
        }
      }
    `,
    { query: `handle:${handle}` },
  );
  return data.pages.nodes.find((node) => node.handle === handle)?.id ?? null;
}

async function main() {
  if (DRY_RUN) {
    log.step("Dry run");
    log.ok(`${SERVICES.length} services, ${CHANNELS.length} contact channels, ${FAQS.length} FAQs`);
    log.ok("PAGE metafields on our-story, our-services, contact");
    console.log("");
    return;
  }

  /* services */
  log.step("Services");
  const haveServices = await existing("service");
  for (const [index, service] of SERVICES.entries()) {
    if (haveServices.has(service.handle)) {
      log.skip(`${service.title} — exists`);
      continue;
    }
    await create("service", service.handle, [
      { key: "title", value: service.title },
      { key: "body", value: richText(service.body) },
      { key: "sort_order", value: String(index + 1) },
    ]);
    log.ok(service.title);
  }

  /* contact channels */
  log.step("Contact channels");
  const haveChannels = await existing("contact_channel");
  for (const [index, channel] of CHANNELS.entries()) {
    if (haveChannels.has(channel.handle)) {
      log.skip(`${channel.label} — exists`);
      continue;
    }
    await create("contact_channel", channel.handle, [
      { key: "label", value: channel.label },
      { key: "value", value: channel.value },
      { key: "link_type", value: channel.linkType },
      ...(channel.linkUrl ? [{ key: "link_url", value: channel.linkUrl }] : []),
      { key: "sort_order", value: String(index + 1) },
    ]);
    log.ok(`${channel.label} — ${channel.value}`);
  }

  /* FAQs */
  log.step("FAQ");
  const haveFaqs = await existing("faq_item");
  for (const [index, faq] of FAQS.entries()) {
    if (haveFaqs.has(faq.handle)) {
      log.skip(`${faq.question.slice(0, 40)} — exists`);
      continue;
    }
    await create("faq_item", faq.handle, [
      { key: "question", value: faq.question },
      { key: "answer", value: richText(faq.answer) },
      { key: "category", value: faq.category },
      { key: "sort_order", value: String(index + 1) },
    ]);
    log.ok(faq.question);
  }

  /* page metafields */
  log.step("Page metafields");
  const captioned = await idsByHandle(
    "captioned_image",
    Array.from({ length: 6 }, (_, i) => `project-image-${i + 7}`),
  );
  const channelIds = await idsByHandle("contact_channel", CHANNELS.map((c) => c.handle));

  const story = await pageId("our-story");
  if (story) {
    await setMetafields([
      { ownerId: story, namespace: "custom", key: "story_block_1", type: "rich_text_field", value: richText(...STORY_BLOCK_1) },
      { ownerId: story, namespace: "custom", key: "story_block_2", type: "rich_text_field", value: richText(...STORY_BLOCK_2) },
      ...(captioned.length
        ? [
            { ownerId: story, namespace: "custom", key: "feature_images", type: "list.metaobject_reference", value: JSON.stringify(captioned.slice(0, 3)) },
            { ownerId: story, namespace: "custom", key: "gallery", type: "list.metaobject_reference", value: JSON.stringify(captioned) },
          ]
        : []),
    ]);
    log.ok("our-story — story blocks + images");
  } else {
    log.warn("our-story page not found");
  }

  const services = await pageId("our-services");
  if (services) {
    await setMetafields([
      {
        ownerId: services,
        namespace: "custom",
        key: "intro_body",
        type: "rich_text_field",
        value: richText(
          "Through our Design Program, we deliver made-to-order pieces, private label collections and tailored solutions, supporting projects from concept to completion. We collaborate worldwide with architects, designers, project developers, hotels, restaurants and retail partners.",
        ),
      },
      ...(captioned.length
        ? [{ ownerId: services, namespace: "custom", key: "feature_images", type: "list.metaobject_reference", value: JSON.stringify(captioned.slice(0, 3)) }]
        : []),
    ]);
    log.ok("our-services — intro + images");
  } else {
    log.warn("our-services page not found");
  }

  const contact = await pageId("contact");
  if (contact && channelIds.length) {
    await setMetafields([
      { ownerId: contact, namespace: "custom", key: "channels", type: "list.metaobject_reference", value: JSON.stringify(channelIds) },
      { ownerId: contact, namespace: "custom", key: "inquiry_types", type: "list.single_line_text_field", value: JSON.stringify(INQUIRY_TYPES) },
      {
        ownerId: contact,
        namespace: "custom",
        key: "intro_body",
        type: "rich_text_field",
        value: richText(
          "Whether you have a question about an order, a product, or would like more information about what we do, we’d love to hear from you.",
        ),
      },
    ]);
    log.ok(`contact — ${channelIds.length} channels, ${INQUIRY_TYPES.length} inquiry types`);
  } else {
    log.warn("contact page not found");
  }

  console.log("");
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
