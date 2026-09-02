/**
 * Seeds the four signature collections named in `DESK - Collections All.pdf` and
 * `DESK - Landing Page.pdf`: Duna, Safari, Hardy and Arc Teak.
 *
 * Titles and designer attributions come from the designs. **Descriptions and
 * "The Idea" copy are invented** — the PDFs use lorem ipsum. Hero and card
 * images come from `public/image/collection/`.
 *
 *   npx tsx scripts/seed-collections.ts [--dry-run]
 *
 * Idempotent: an existing collection handle is reused rather than duplicated,
 * and its metafields are re-set.
 */

import { DRY_RUN, admin, assertNoUserErrors, log, richText, setMetafields, uploadImage } from "./lib/admin";

type Seed = {
  handle: string;
  title: string;
  description: string;
  designerHandle: string;
  ideaTitle: string;
  ideaBody: string[];
  image: string;
  /** Storefront product types drawn into this collection. */
  productTypes: string[];
  limit: number;
};

const COLLECTIONS: Seed[] = [
  {
    handle: "the-duna-collection",
    title: "The Duna Collection",
    description:
      "Low, soft and built for long afternoons. Duna is the seating collection — deep frames in oiled hardwood, cushions you sink into rather than perch on.",
    // The design credits Duna to Eddy Roothaert, Studio Bizar.
    designerHandle: "eddy-roothaert",
    ideaTitle: "The Idea",
    ideaBody: [
      "Duna started with a complaint. Lounge seating had become so shallow that nobody could actually lounge in it — the depth had been traded away for a cleaner silhouette.",
      "So the frame came first: deep enough to fold your legs onto, low enough that the room still reads open above it. Everything else followed from that single dimension.",
    ],
    image: "public/image/collection/collection1.png",
    productTypes: ["Sofas & Lounger", "Pouffes"],
    limit: 12,
  },
  {
    handle: "the-safari-collection",
    title: "The Safari Collection",
    description:
      "Tables and case goods in solid teak and travertine. Safari is the collection that holds everything else up.",
    // The design credits Safari to Pascale Pelsmaekers, Studio Bizar.
    designerHandle: "pascale-pelsmaekers",
    ideaTitle: "The Idea",
    ideaBody: [
      "A table is the one piece of furniture a household argues over. Safari was drawn to end the argument: one surface, honest thickness, no veneer anywhere.",
      "The stone tops are cut from single slabs, so the veining runs uninterrupted across the whole plane.",
    ],
    image: "public/image/collection/collection2.png",
    productTypes: ["Coffee Tables", "Side Tables", "Consoles"],
    limit: 12,
  },
  {
    handle: "the-hardy-collection",
    title: "The Hardy Collection",
    description:
      "Chairs and stools that take daily use without complaint. Hardy is the collection for rooms that get used hard.",
    // The design credits Hardy to La Mamba Studio, who is not among the ten
    // seeded designers — substituted here. Re-point when the real entry exists.
    designerHandle: "agence-volta",
    ideaTitle: "The Idea",
    ideaBody: [
      "Hardy came out of a hospitality brief: seating that survives a restaurant floor, stacked nightly, dragged across tile, and still looks like something you would want at home.",
      "The joint is the whole design. Everything visible is there because it carries load.",
    ],
    image: "public/image/collection/collection3.png",
    productTypes: ["Dining Chairs", "Bar Stools", "Stools", "Benches"],
    limit: 12,
  },
  {
    handle: "the-arc-teak-collection",
    title: "The Arc Teak Collection",
    description:
      "Woven and turned pieces in reclaimed teak, made with makers in Bali. Arc Teak is the collection with the most hand in it.",
    // The design credits Arc Teak to Mario Ruiz, Gazpacho Studio — also not
    // among the ten seeded designers. Substituted.
    designerHandle: "asai",
    ideaTitle: "The Idea",
    ideaBody: [
      "Every piece in Arc Teak begins as something else — a boat hull, a beam, a floor. The timber is already decades old before it reaches the workshop.",
      "That history sets the limits. The design works around what the salvaged stock will allow, not the other way round.",
    ],
    image: "public/image/collection/collection4.png",
    productTypes: ["Baskets", "Vases", "Bowls"],
    limit: 12,
  },

  /* ------------------------------------------------------------------ *
   * Eight further collections so the Signature Collections carousel on the
   * landing page has a full set to scroll. Names, copy and designer
   * attributions are all invented — only Duna, Safari, Hardy and Arc Teak
   * appear in the designs.
   * ------------------------------------------------------------------ */
  {
    handle: "the-lumen-collection",
    title: "The Lumen Collection",
    description: "Pendants, shades and floor lights woven by hand in Bali.",
    designerHandle: "aede-studios",
    ideaTitle: "The Idea",
    ideaBody: [
      "Lumen treats a lamp as an object first and a light source second — the form has to hold up in daylight, before it is ever switched on.",
      "Every shade is woven over a bamboo frame, so no two throw quite the same shadow.",
    ],
    image: "public/image/product detail/product1.png",
    productTypes: ["Pendant Lamps", "Table Lamps", "Floor Lamps", "Wall Lamps", "Chandeliers"],
    limit: 12,
  },
  {
    handle: "the-terra-collection",
    title: "The Terra Collection",
    description: "Hand-thrown vessels and planters in unglazed stoneware.",
    designerHandle: "amare",
    ideaTitle: "The Idea",
    ideaBody: [
      "Terra began with a refusal to glaze anything. Unfinished stoneware takes on the room — it darkens where it is handled and holds the water it is given.",
      "Each piece is thrown, not cast, so the wall thickness varies and the weight tells you so.",
    ],
    image: "public/image/product detail/product2.png",
    productTypes: ["Vases", "Planters", "Bowls", "Bottles & Jars"],
    limit: 12,
  },
  {
    handle: "the-atlas-collection",
    title: "The Atlas Collection",
    description: "Mirrors and wall pieces that carry a room's proportions.",
    designerHandle: "agence-volta",
    ideaTitle: "The Idea",
    ideaBody: [
      "A mirror is architecture more than furniture — it changes the size of the room it hangs in.",
      "Atlas frames are deliberately heavy, so the glass reads as a window rather than a surface.",
    ],
    image: "public/image/product detail/product3.png",
    productTypes: ["Mirrors", "Wall & Hanging", "Statues"],
    limit: 12,
  },
  {
    handle: "the-linen-collection",
    title: "The Linen Collection",
    description: "Cushion covers, throws and runners in undyed natural fibre.",
    designerHandle: "amare",
    ideaTitle: "The Idea",
    ideaBody: [
      "Linen is chosen for how it ages. It creases, softens and pales, and the collection is designed around that rather than against it.",
      "Colour comes from madder, indigo and walnut, so no two runs match exactly.",
    ],
    image: "public/image/product detail/product4.png",
    productTypes: ["Cushion Covers", "Plaids & Throws", "Carpets & Runners", "Placemats"],
    limit: 12,
  },
  {
    handle: "the-mesa-collection",
    title: "The Mesa Collection",
    description: "Serving pieces, boards and bowls for a table in constant use.",
    designerHandle: "antoine-maurice",
    ideaTitle: "The Idea",
    ideaBody: [
      "Mesa was drawn for the middle of the table — the pieces that get passed, stacked and washed every day.",
      "Turned from mango and suar, finished with a food-safe oil that can be renewed rather than stripped.",
    ],
    image: "public/image/product detail/product5.png",
    productTypes: ["Serving Dishes & Trays", "Bowls", "Plates", "Cutting Boards", "Cups & Mugs"],
    limit: 12,
  },
  {
    handle: "the-ember-collection",
    title: "The Ember Collection",
    description: "Candle holders, lanterns and room fragrance in blackened metal.",
    designerHandle: "altin",
    ideaTitle: "The Idea",
    ideaBody: [
      "Ember is the collection for the end of the day — low light, warm metal, nothing that reflects too sharply.",
      "The brass leaves the workshop bright and is expected to darken where hands fall most often.",
    ],
    image: "public/image/product detail/product6.png",
    productTypes: ["Candles & Holders", "Room Fragrance", "Boho Accents"],
    limit: 12,
  },
  {
    handle: "the-harbour-collection",
    title: "The Harbour Collection",
    description: "Bags, hats and carry pieces woven from seagrass and rattan.",
    designerHandle: "asai",
    ideaTitle: "The Idea",
    ideaBody: [
      "Harbour came out of the market baskets our weavers were already making for themselves — pieces built to be carried full, not displayed empty.",
      "The weave is tightened at the base, where the load actually sits.",
    ],
    image: "public/image/product detail/product7.png",
    productTypes: ["Bags", "Hats", "Clutches & Wallets", "Keychains", "Jewelry"],
    limit: 12,
  },
  {
    handle: "the-quarry-collection",
    title: "The Quarry Collection",
    description: "Stone-topped occasional tables and stools cut from single slabs.",
    designerHandle: "adelie-ducasse",
    ideaTitle: "The Idea",
    ideaBody: [
      "Quarry starts at the block. The stone decides the dimension, which means the run is never quite uniform and the veining is never repeated.",
      "Honed rather than polished, so the surface stays matte and shows a fingerprint less.",
    ],
    image: "public/image/product detail/product8.png",
    productTypes: ["Side Tables", "Stools", "Nightstands", "Coasters"],
    limit: 12,
  },
];

/** Admin exposes `metaobjectByHandle`; `metaobject(handle:)` is Storefront-only. */
async function designerGid(handle: string): Promise<string> {
  const data = await admin<{ metaobjectByHandle: { id: string } | null }>(
    /* GraphQL */ `
      query D($handle: MetaobjectHandleInput!) {
        metaobjectByHandle(handle: $handle) {
          id
        }
      }
    `,
    { handle: { type: "designer", handle } },
  );
  if (!data.metaobjectByHandle) {
    throw new Error(`Designer "${handle}" not found — run seed-designers first.`);
  }
  return data.metaobjectByHandle.id;
}

/**
 * A collection created through the Admin API is published to nothing, which
 * makes it invisible to the Storefront API — the seeded collections looked
 * correct in the admin and simply did not exist to the app until this ran.
 */
async function onlineStorePublicationId(): Promise<string | null> {
  const data = await admin<{ publications: { nodes: { id: string; name: string }[] } }>(
    /* GraphQL */ `
      query {
        publications(first: 20) {
          nodes {
            id
            name
          }
        }
      }
    `,
  );
  return data.publications.nodes.find((node) => node.name === "Online Store")?.id ?? null;
}

async function publish(id: string, publicationId: string) {
  const data = await admin<{
    publishablePublish: { userErrors: { field?: string[] | null; message: string }[] };
  }>(
    /* GraphQL */ `
      mutation Publish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `,
    { id, input: [{ publicationId }] },
  );
  assertNoUserErrors(data.publishablePublish.userErrors, "publishablePublish");
}

async function findCollection(handle: string): Promise<string | null> {
  const data = await admin<{ collectionByHandle: { id: string } | null }>(
    /* GraphQL */ `
      query C($handle: String!) {
        collectionByHandle(handle: $handle) {
          id
        }
      }
    `,
    { handle },
  );
  return data.collectionByHandle?.id ?? null;
}

async function productsOfTypes(types: string[], limit: number): Promise<string[]> {
  const query = `status:active AND (${types.map((t) => `product_type:'${t}'`).join(" OR ")})`;
  const data = await admin<{ products: { nodes: { id: string }[] } }>(
    /* GraphQL */ `
      query P($query: String!, $first: Int!) {
        products(first: $first, query: $query) {
          nodes {
            id
          }
        }
      }
    `,
    { query, first: limit },
  );
  return data.products.nodes.map((node) => node.id);
}

async function main() {
  log.step(`Seeding ${COLLECTIONS.length} signature collections${DRY_RUN ? " (dry run)" : ""}`);

  const publicationId = DRY_RUN ? null : await onlineStorePublicationId();
  if (!DRY_RUN && !publicationId) log.warn("No Online Store publication found — collections will stay invisible to the Storefront API.");

  for (const [index, seed] of COLLECTIONS.entries()) {
    const productIds = await productsOfTypes(seed.productTypes, seed.limit);

    if (DRY_RUN) {
      log.ok(`${seed.title} — ${productIds.length} products, designer ${seed.designerHandle}`);
      continue;
    }

    let collectionId = await findCollection(seed.handle);

    if (collectionId) {
      log.skip(`${seed.title} — collection exists, refreshing metafields`);
    } else {
      const created = await admin<{
        collectionCreate: {
          collection: { id: string } | null;
          userErrors: { field?: string[] | null; message: string }[];
        };
      }>(
        /* GraphQL */ `
          mutation CreateCollection($input: CollectionInput!) {
            collectionCreate(input: $input) {
              collection {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          input: {
            handle: seed.handle,
            title: seed.title,
            descriptionHtml: `<p>${seed.description}</p>`,
          },
        },
      );

      assertNoUserErrors(created.collectionCreate.userErrors, `collectionCreate ${seed.handle}`);
      collectionId = created.collectionCreate.collection!.id;
      log.ok(`${seed.title} — created`);
    }

    if (productIds.length) {
      const added = await admin<{
        collectionAddProducts: { userErrors: { field?: string[] | null; message: string }[] };
      }>(
        /* GraphQL */ `
          mutation AddProducts($id: ID!, $productIds: [ID!]!) {
            collectionAddProducts(id: $id, productIds: $productIds) {
              userErrors {
                field
                message
              }
            }
          }
        `,
        { id: collectionId, productIds },
      );
      assertNoUserErrors(added.collectionAddProducts.userErrors, `collectionAddProducts ${seed.handle}`);
    }

    if (publicationId) await publish(collectionId, publicationId);

    const imageId = await uploadImage(seed.image, `${seed.title} — collection image`);

    await setMetafields([
      { ownerId: collectionId, namespace: "custom", key: "is_signature", type: "boolean", value: "true" },
      { ownerId: collectionId, namespace: "custom", key: "hero_image", type: "file_reference", value: imageId },
      { ownerId: collectionId, namespace: "custom", key: "card_image", type: "file_reference", value: imageId },
      { ownerId: collectionId, namespace: "custom", key: "idea_image", type: "file_reference", value: imageId },
      {
        ownerId: collectionId,
        namespace: "custom",
        key: "designer",
        type: "metaobject_reference",
        value: await designerGid(seed.designerHandle),
      },
      { ownerId: collectionId, namespace: "custom", key: "idea_title", type: "single_line_text_field", value: seed.ideaTitle },
      { ownerId: collectionId, namespace: "custom", key: "idea_body", type: "rich_text_field", value: richText(...seed.ideaBody) },
      { ownerId: collectionId, namespace: "custom", key: "sort_order", type: "number_integer", value: String(index + 1) },
    ]);

    log.ok(`${seed.title} — ${productIds.length} products, metafields set`);
  }

  console.log("");
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
