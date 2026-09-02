/**
 * Fills the empty PRODUCT metafields for every product in the four signature
 * collections, so Shop Detail has something to render below the buy controls.
 *
 * Before this runs, 1 of 18 product metafields is populated (`colour`, which
 * came with the import). After it, 14 are.
 *
 * **All copy here is invented.** The Figma PDFs use lorem ipsum for product
 * text, so there was nothing real to transcribe. Values vary by product type so
 * the seeded catalogue does not read as one sentence repeated 48 times, but
 * every line should be replaced with Studio Bizar's own.
 *
 *   npx tsx scripts/seed-products.ts [--dry-run] [--limit=N]
 *
 * Idempotent: `metafieldsSet` upserts, so re-running refreshes rather than
 * duplicating.
 */

import { DRY_RUN, admin, log, richText, setMetafields, uploadImage } from "./lib/admin";

/**
 * Discovered rather than hard-coded, so adding a collection to
 * `seed-collections.ts` automatically brings its products into scope here.
 */
async function signatureCollectionHandles(): Promise<string[]> {
  const data = await admin<{
    collections: { nodes: { handle: string; signature: { value: string } | null }[] };
  }>(
    /* GraphQL */ `
      query {
        collections(first: 100) {
          nodes {
            handle
            signature: metafield(namespace: "custom", key: "is_signature") {
              value
            }
          }
        }
      }
    `,
  );

  return data.collections.nodes
    .filter((node) => node.signature?.value === "true")
    .map((node) => node.handle);
}

/** Reused across products rather than uploading one image per product. */
const IDEA_IMAGES = Array.from(
  { length: 8 },
  (_, i) => `public/image/product detail/product${i + 1}.png`,
);

type TypeProfile = {
  material: string;
  upholstery?: string;
  availability: string;
  leadTime: string;
  moq: number;
  spec: string[];
  dimensions: string[];
  care: string[];
};

const DEFAULT_PROFILE: TypeProfile = {
  material: "Solid teak, natural oil finish",
  availability: "Made to order",
  leadTime: "Lead time of 10–14 weeks",
  moq: 1,
  spec: [
    "Frame in kiln-dried solid teak, finished with a penetrating natural oil.",
    "Assembled with mortise-and-tenon joinery; no visible fixings.",
  ],
  dimensions: ["Dimensions are nominal and vary by up to 10 mm, as each piece is finished by hand."],
  care: [
    "Dust with a dry cloth. Re-oil once a year, or whenever the surface starts to look dry.",
    "Avoid standing water and prolonged direct sunlight.",
  ],
};

const PROFILES: Record<string, Partial<TypeProfile>> = {
  "Sofas & Lounger": {
    material: "Oak frame, FSC Mix 70%",
    upholstery: "Washed linen, removable covers",
    availability: "Made to order",
    leadTime: "Lead time of 12–16 weeks",
    moq: 1,
    spec: [
      "Kiln-dried oak frame with webbed suspension and CMHR foam cushioning.",
      "Covers are removable and dry-cleanable; the seat cushion is reversible.",
    ],
    care: [
      "Rotate and plump the cushions weekly so they wear evenly.",
      "Vacuum the upholstery with a soft brush head. Dry clean covers only.",
    ],
  },
  Pouffes: {
    material: "Hand-woven jute over a foam core",
    upholstery: "Undyed jute",
    availability: "In production",
    leadTime: "Lead time of 6–8 weeks",
    moq: 2,
  },
  "Coffee Tables": {
    material: "Travertine top, solid oak base",
    availability: "Made to order",
    leadTime: "Lead time of 10–14 weeks",
    spec: [
      "Top cut from a single travertine slab, honed and sealed against staining.",
      "Base in solid oak, oiled. Felt pads fitted to protect flooring.",
    ],
    care: [
      "Wipe with a damp cloth and a pH-neutral cleaner. Never use vinegar or citrus.",
      "Blot spills immediately — travertine is porous and will mark if left.",
    ],
  },
  "Side Tables": {
    material: "Black basalt, honed",
    availability: "In stock",
    leadTime: "Ships within 2–3 weeks",
    spec: ["Solid stone, honed to a matte finish. Each piece carries its own veining."],
  },
  Consoles: { material: "Reclaimed teak, wax finish", availability: "Made to order" },
  "Dining Chairs": {
    material: "Solid teak, natural oil finish",
    upholstery: "Woven cord seat",
    availability: "Made to order",
    leadTime: "Lead time of 8–12 weeks",
    moq: 2,
    spec: [
      "Frame in solid teak with a hand-woven cord seat, re-weavable when it eventually wears.",
      "Tested to contract standards for hospitality use.",
    ],
  },
  "Bar Stools": { material: "Solid teak with a footrest in blackened steel", moq: 2 },
  Stools: { material: "Carved from a single block of suar wood", availability: "In stock" },
  Benches: { material: "Reclaimed teak, wax finish", moq: 1 },
  Baskets: {
    material: "Hand-woven rattan over a bamboo frame",
    availability: "In stock",
    leadTime: "Ships within 2–3 weeks",
    moq: 3,
    spec: ["Woven by hand in Bali. Size and colour vary slightly between pieces."],
    care: ["Keep dry. Dust with a soft brush; do not submerge in water."],
  },
  Vases: {
    material: "Hand-thrown stoneware, matte glaze",
    availability: "In stock",
    leadTime: "Ships within 2–3 weeks",
    moq: 3,
    care: ["Not watertight unless stated — use a liner for fresh flowers."],
  },
  Bowls: {
    material: "Turned mango wood, food-safe oil",
    availability: "In stock",
    moq: 4,
    care: ["Hand wash only. Do not put in a dishwasher or soak."],
  },
};

function profileFor(productType: string | null): TypeProfile {
  return { ...DEFAULT_PROFILE, ...(PROFILES[productType ?? ""] ?? {}) };
}

function ideaFor(title: string, collectionTitle: string): string[] {
  return [
    `${title} was drawn for ${collectionTitle} — which meant working inside the collection's rules before anything else: one material family, honest thickness, and no detail that exists only to be looked at.`,
    "The prototype went through the workshop three times. What survived is the version where nothing further could be taken away without the piece stopping working.",
  ];
}

type ProductNode = {
  id: string;
  handle: string;
  title: string;
  productType: string | null;
};

async function collectionProducts(handle: string) {
  const data = await admin<{
    collectionByHandle: {
      id: string;
      title: string;
      products: { nodes: ProductNode[] };
      designer: { value: string } | null;
    } | null;
  }>(
    /* GraphQL */ `
      query C($handle: String!) {
        collectionByHandle(handle: $handle) {
          id
          title
          designer: metafield(namespace: "custom", key: "designer") {
            value
          }
          products(first: 50) {
            nodes {
              id
              handle
              title
              productType
            }
          }
        }
      }
    `,
    { handle },
  );

  return data.collectionByHandle;
}

async function main() {
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

  log.step(`Seeding product metafields${DRY_RUN ? " (dry run)" : ""}`);

  const ideaImageIds: string[] = [];
  if (!DRY_RUN) {
    log.step("Uploading idea images (once, reused across products)");
    for (const path of IDEA_IMAGES) {
      ideaImageIds.push(await uploadImage(path, "Studio Bizar — in production"));
      log.ok(path);
    }
  }

  const handles = await signatureCollectionHandles();
  log.step(`${handles.length} signature collections in scope`);

  let seeded = 0;

  for (const handle of handles) {
    const collection = await collectionProducts(handle);
    if (!collection) {
      log.warn(`${handle} not found — run seed-collections first`);
      continue;
    }

    log.step(`${collection.title} — ${collection.products.nodes.length} products`);

    for (const [index, product] of collection.products.nodes.entries()) {
      if (seeded >= limit) break;

      const profile = profileFor(product.productType);
      const metafields = [
        { key: "collection_label", type: "single_line_text_field", value: `Part of ‘${collection.title}’` },
        { key: "signature_collection", type: "collection_reference", value: collection.id },
        { key: "is_new", type: "boolean", value: String(index % 4 === 0) },
        { key: "material_finish", type: "single_line_text_field", value: profile.material },
        { key: "availability", type: "single_line_text_field", value: profile.availability },
        { key: "lead_time_weeks", type: "single_line_text_field", value: profile.leadTime },
        { key: "moq", type: "number_integer", value: String(profile.moq) },
        { key: "technical_specifications", type: "rich_text_field", value: richText(...profile.spec) },
        { key: "dimensions", type: "rich_text_field", value: richText(...profile.dimensions) },
        { key: "care_maintenance", type: "rich_text_field", value: richText(...profile.care) },
        {
          key: "shipping_delivery",
          type: "rich_text_field",
          value: richText(
            "Delivered on a pallet by a two-person team, to the room of your choice.",
            "Shipping is quoted per project once the inquiry is confirmed — it depends on volume and destination.",
          ),
        },
        { key: "idea_body", type: "rich_text_field", value: richText(...ideaFor(product.title, collection.title)) },
        ...(profile.upholstery
          ? [{ key: "upholstery", type: "single_line_text_field", value: profile.upholstery }]
          : []),
        ...(collection.designer
          ? [{ key: "designer", type: "metaobject_reference", value: collection.designer.value }]
          : []),
        ...(ideaImageIds.length
          ? [{ key: "idea_image", type: "file_reference", value: ideaImageIds[seeded % ideaImageIds.length]! }]
          : []),
      ];

      if (DRY_RUN) {
        log.ok(`${product.handle} — ${metafields.length} metafields (${product.productType})`);
      } else {
        await setMetafields(
          metafields.map((field) => ({ ...field, ownerId: product.id, namespace: "custom" })),
        );
        log.ok(`${product.handle} — ${metafields.length} metafields`);
      }

      seeded++;
    }
  }

  console.log(`\n  ${seeded} products seeded\n`);
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
