/**
 * Content for the four pages behind the new Info/About submenus:
 * Our Artisans, Our Locations (plus the `location` entries it lists),
 * Care & Maintenance and Careers. `schema-push` creates all four blank —
 * this fills them in, the same division of labour as `seed-pages.ts`.
 *
 * **All copy here is invented** — there is no PDF for these pages, so there
 * is no transcription to fall back on. Photos are reused from the existing
 * library rather than uploading new ones.
 *
 *   npx tsx scripts/seed-nav-pages.ts [--dry-run]
 *
 * Idempotent: an existing `location` or `captioned_image` handle is reused,
 * never recreated; page metafields are re-set.
 */

import { DRY_RUN, admin, assertNoUserErrors, log, richText, setMetafields, uploadImage } from "./lib/admin";

/* -------------------------------------------------------------------------- *
 * location — Our Locations
 * -------------------------------------------------------------------------- */

type LocationSeed = {
  handle: string;
  name: string;
  kind: "Showroom" | "Workshop";
  address: string[];
  phone?: string;
  email?: string;
  hours?: string[];
  image: string;
};

const LOCATIONS: LocationSeed[] = [
  {
    handle: "antwerp-showroom",
    name: "Antwerp Showroom",
    kind: "Showroom",
    address: ["Katelijnevest 12", "2000 Antwerp", "Belgium"],
    phone: "+32 3 234 56 78",
    email: "showroom@studiobizar.com",
    hours: ["Tuesday – Saturday, 10:00 – 18:00", "Closed Sunday & Monday"],
    image: "public/image/service/hero_service1.png",
  },
  {
    handle: "bali-workshop",
    name: "Bali Workshop",
    kind: "Workshop",
    address: ["Jl. Raya Mas No. 88", "Ubud, Gianyar", "Bali, Indonesia"],
    email: "workshop@studiobizar.com",
    hours: ["By appointment only"],
    image: "public/image/project3.png",
  },
];

async function metaobjectId(type: string, handle: string): Promise<string | null> {
  const data = await admin<{ metaobjectByHandle: { id: string } | null }>(
    /* GraphQL */ `
      query M($handle: MetaobjectHandleInput!) {
        metaobjectByHandle(handle: $handle) {
          id
        }
      }
    `,
    { handle: { type, handle } },
  );
  return data.metaobjectByHandle?.id ?? null;
}

const findLocation = (handle: string) => metaobjectId("location", handle);

async function createCaptionedImage(handle: string, fileId: string, caption: string): Promise<string> {
  const already = await metaobjectId("captioned_image", handle);
  if (already) return already;

  const data = await admin<{
    metaobjectCreate: {
      metaobject: { id: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    /* GraphQL */ `
      mutation CreateCaptioned($metaobject: MetaobjectCreateInput!) {
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
    {
      metaobject: {
        type: "captioned_image",
        handle,
        fields: [
          { key: "image", value: fileId },
          { key: "caption", value: caption },
        ],
      },
    },
  );
  assertNoUserErrors(data.metaobjectCreate.userErrors, `captioned_image ${handle}`);
  return data.metaobjectCreate.metaobject!.id;
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
  log.step(`Seeding nav pages${DRY_RUN ? " (dry run)" : ""}`);

  /* ---------------------------------------------------------------- *
   * location entries
   * ---------------------------------------------------------------- */
  const locationIds: string[] = [];
  for (const [index, loc] of LOCATIONS.entries()) {
    const found = await findLocation(loc.handle);
    if (found) {
      log.skip(`${loc.name} — exists`);
      locationIds.push(found);
      continue;
    }

    if (DRY_RUN) {
      log.ok(`${loc.name} — would create`);
      continue;
    }

    const imageId = await uploadImage(loc.image, loc.name);
    const data = await admin<{
      metaobjectCreate: {
        metaobject: { id: string } | null;
        userErrors: { field?: string[] | null; message: string }[];
      };
    }>(
      /* GraphQL */ `
        mutation CreateLocation($metaobject: MetaobjectCreateInput!) {
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
      {
        metaobject: {
          type: "location",
          handle: loc.handle,
          fields: [
            { key: "name", value: loc.name },
            { key: "kind", value: loc.kind },
            { key: "address", value: loc.address.join("\n") },
            ...(loc.phone ? [{ key: "phone", value: loc.phone }] : []),
            ...(loc.email ? [{ key: "email", value: loc.email }] : []),
            ...(loc.hours ? [{ key: "hours", value: loc.hours.join("\n") }] : []),
            { key: "image", value: imageId },
            { key: "sort_order", value: String(index + 1) },
          ],
        },
      },
    );
    assertNoUserErrors(data.metaobjectCreate.userErrors, `location ${loc.handle}`);
    log.ok(`${loc.name} — created`);
    locationIds.push(data.metaobjectCreate.metaobject!.id);
  }

  if (DRY_RUN) {
    log.ok("our-locations — would set locations metafield");
  } else {
    const locationsPageId = await pageId("our-locations");
    if (locationsPageId && locationIds.length) {
      await setMetafields([
        {
          ownerId: locationsPageId,
          namespace: "custom",
          key: "locations",
          type: "list.metaobject_reference",
          value: JSON.stringify(locationIds),
        },
      ]);
      log.ok(`our-locations — ${locationIds.length} locations linked`);
    } else {
      log.warn("our-locations page not found, or no locations to link");
    }
  }

  /* ---------------------------------------------------------------- *
   * our-artisans
   * ---------------------------------------------------------------- */
  if (DRY_RUN) {
    log.ok("our-artisans — would set story + images");
  } else {
    const artisansId = await pageId("our-artisans");
    if (artisansId) {
      const featureIds = await Promise.all(
        ["public/image/designer/designer1.png", "public/image/designer/designer4.png", "public/image/designer/designer9.png"].map(
          (path, i) => uploadImage(path, `Our Artisans — feature ${i + 1}`),
        ),
      );

      await setMetafields([
        {
          ownerId: artisansId,
          namespace: "custom",
          key: "story_block_1",
          type: "rich_text_field",
          value: richText(
            "Every piece that leaves the workshop passes through the same hands that shaped the last one, and the one before that. In Bali and Java, furniture-making is still a trade you learn standing next to someone, for years, before you touch the wood yourself.",
            "We work with a small number of workshops rather than a large number of factories — families and cooperatives we have returned to for two decades, who know our proportions well enough to correct our drawings when we get them wrong.",
            "Weaving, turning, joinery, finishing: each is its own specialism, and a single Studio Bizar piece can pass through three or four different pairs of hands before it is done. None of that is automated, and none of it is meant to be.",
          ),
        },
        {
          ownerId: artisansId,
          namespace: "custom",
          key: "feature_images",
          type: "list.metaobject_reference",
          value: JSON.stringify(
            await Promise.all(
              featureIds.map((fileId, i) =>
                createCaptionedImage(`our-artisans-feature-${i + 1}`, fileId, "In the workshop"),
              ),
            ),
          ),
        },
      ]);
      log.ok("our-artisans — story + 3 feature images");
    } else {
      log.warn("our-artisans page not found");
    }
  }

  /* ---------------------------------------------------------------- *
   * care-maintenance
   * ---------------------------------------------------------------- */
  if (DRY_RUN) {
    log.ok("care-maintenance — would set intro");
  } else {
    const careId = await pageId("care-maintenance");
    if (careId) {
      await setMetafields([
        {
          ownerId: careId,
          namespace: "custom",
          key: "intro_body",
          type: "rich_text_field",
          value: richText(
            "Solid wood, natural fibre and reclaimed materials all move with their environment — that is the trade-off for choosing something that was alive before it was furniture. A little routine care keeps every piece looking the way it did when it left the workshop.",
            "Wood: wipe with a dry or barely damp cloth. Reoil teak and other unfinished woods every 6–12 months to keep the grain from drying out, and keep pieces out of direct, sustained sun where possible.",
            "Upholstery and weaving: vacuum on a low setting to lift dust out of the weave. Blot spills immediately rather than rubbing them in, and avoid harsh detergents on natural fibres.",
            "Metal and stone: a dry cloth is usually enough. Avoid abrasive cleaners on patinated or blackened metal — they will strip the finish, not just the dirt.",
            "Specific care instructions for the material and finish of your piece are listed on its own product page — see the Care & Maintenance section there for anything not covered here.",
          ),
        },
      ]);
      log.ok("care-maintenance — intro set");
    } else {
      log.warn("care-maintenance page not found");
    }
  }

  /* ---------------------------------------------------------------- *
   * careers
   * ---------------------------------------------------------------- */
  if (DRY_RUN) {
    log.ok("careers — would set intro");
  } else {
    const careersId = await pageId("careers");
    if (careersId) {
      await setMetafields([
        {
          ownerId: careersId,
          namespace: "custom",
          key: "intro_body",
          type: "rich_text_field",
          value: richText(
            "We are a small team split between Antwerp and the workshops of Bali and Java, and we grow slowly and rarely. What we look for is less about a specific résumé than a genuine interest in how things are made — whether that shows up in design, production, logistics or working directly with our partners.",
            "We do not have a running list of open roles. If something above resonates and you think there is a fit, write to us and tell us why — we read everything.",
          ),
        },
      ]);
      log.ok("careers — intro set");
    } else {
      log.warn("careers page not found");
    }
  }

  console.log("");
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
