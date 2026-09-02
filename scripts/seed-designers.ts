/**
 * Seeds the `designer` metaobject.
 *
 * Names are the ones printed in `DESK - Our Designers.pdf`, `DESK - Shop
 * Detail.pdf` and `DESK - Landing Page.pdf`, so the seeded store matches the
 * design. The **bios are invented** — the PDFs use lorem ipsum there, so there
 * was nothing real to copy. Replace them with Studio Bizar's own copy.
 *
 * Portraits come from `public/image/designer/`.
 *
 *   npx tsx scripts/seed-designers.ts [--dry-run]
 *
 * Idempotent: a designer whose handle already exists is skipped, not updated.
 */

import { DRY_RUN, admin, assertNoUserErrors, log, richText, uploadImage } from "./lib/admin";

type Seed = {
  handle: string;
  name: string;
  studio?: string;
  byline: string;
  bioShort: string;
  bioFull: string[];
  portrait: string;
};

const DESIGNERS: Seed[] = [
  {
    handle: "adelie-ducasse",
    name: "Adélie Ducasse",
    studio: "Atelier Ducasse",
    byline: "Furniture that earns its keep",
    bioShort: "Works in solid oak and hand-thrown ceramic, from a converted dairy outside Ghent.",
    bioFull: [
      "Adélie Ducasse trained as a cabinetmaker before turning to design, and it shows in the joinery — nothing is hidden, nothing is glued where it could be pegged.",
      "Her pieces for Studio Bizar began with a single question: what does a chair owe the room it stands in? The answer, so far, has been restraint.",
    ],
    portrait: "public/image/designer/designer1.png",
  },
  {
    handle: "aede-studios",
    name: "Aède Studios",
    studio: "Aède",
    byline: "Light as a structural material",
    bioShort: "A three-person studio in Antwerp working at the seam between lighting and sculpture.",
    bioFull: [
      "Aède Studios treat a lamp as an object first and a light source second. Their pendants read as forms in daylight and only reveal their purpose after dark.",
      "The collaboration with Studio Bizar produced a run of woven shades made with makers in Bali, each one signed by the weaver.",
    ],
    portrait: "public/image/designer/designer2.png",
  },
  {
    handle: "agence-volta",
    name: "Agence Volta",
    studio: "Volta",
    byline: "Industrial memory, domestic scale",
    bioShort: "Brussels practice drawing on the vocabulary of workshops and warehouses.",
    bioFull: [
      "Agence Volta look to the fittings of factory life — bench stops, clamp handles, cable runs — and bring them indoors at a scale that suits a living room.",
      "Nothing is decorative for its own sake. Every visible fixing does something.",
    ],
    portrait: "public/image/designer/designer3.png",
  },
  {
    handle: "altin",
    name: "Altin",
    byline: "Brass, patina, and time",
    bioShort: "Metalworker whose surfaces are designed to change with handling.",
    bioFull: [
      "Altin finishes nothing to a permanent state. The brass leaves the workshop bright and is expected to darken where hands fall most often.",
      "It makes each piece a record of the household it lives in.",
    ],
    portrait: "public/image/designer/designer4.png",
  },
  {
    handle: "amare",
    name: "Amare",
    studio: "Amare Studio",
    byline: "Textiles with a long memory",
    bioShort: "Weaving studio working with natural dyes and undyed fibre.",
    bioFull: [
      "Amare works only with fibres that will age well — linen, hemp, undyed wool — and refuses anything that looks worse after a decade than it did on the first day.",
      "Colour comes from madder, indigo and walnut, so no two runs are identical.",
    ],
    portrait: "public/image/designer/designer5.png",
  },
  {
    handle: "antoine-maurice",
    name: "Antoine Maurice",
    byline: "Proportion before ornament",
    bioShort: "Designs seating and tables around the way people actually sit and eat.",
    bioFull: [
      "Antoine Maurice starts every project by measuring: elbow height at a table, the depth a shoulder needs in a lounge chair, the reach across a console.",
      "The result is furniture that is comfortable before it is anything else.",
    ],
    portrait: "public/image/designer/designer6.png",
  },
  {
    handle: "atelier-pa",
    name: "Atelier PA",
    studio: "Atelier PA",
    byline: "Objects for the long room",
    bioShort: "Collaborative atelier producing case goods and storage in small runs.",
    bioFull: [
      "Atelier PA build in batches small enough that every cabinet is checked by the person who made it.",
      "Their work for Studio Bizar focuses on storage that reads as architecture — pieces meant to stay put.",
    ],
    portrait: "public/image/designer/designer7.png",
  },
  {
    handle: "asai",
    name: "ASAÏ",
    byline: "Where craft meets repetition",
    bioShort: "Studio exploring what happens when a handmade form is made a thousand times.",
    bioFull: [
      "ASAÏ are interested in the point at which a craft process becomes a production process without losing the hand.",
      "Their baskets and vessels are made to a pattern, but the pattern is held by a person, not a machine.",
    ],
    portrait: "public/image/designer/designer8.png",
  },
  {
    handle: "pascale-pelsmaekers",
    name: "Pascale Pelsmaekers",
    studio: "Studio Bizar",
    byline: "In-house, and close to the workshop",
    bioShort: "Leads Studio Bizar's own collections and photographs most of them herself.",
    bioFull: [
      "Pascale Pelsmaekers designs from inside the studio, which means a prototype can be argued about in the morning and rebuilt by the afternoon.",
      "She also shoots most of the catalogue, so the pieces are photographed by someone who knows exactly where to look.",
    ],
    portrait: "public/image/designer/designer9.png",
  },
  {
    handle: "eddy-roothaert",
    name: "Eddy Roothaert",
    studio: "Studio Bizar",
    byline: "The long view on materials",
    bioShort: "Sources and tests every material before it reaches a collection.",
    bioFull: [
      "Eddy Roothaert spends more time with suppliers than with drawings. If a timber cannot be traced, it does not enter a Studio Bizar collection.",
      "That discipline sets the boundary the rest of the design work happens inside.",
    ],
    portrait: "public/image/designer/designer10.png",
  },
];

async function existingHandles(): Promise<Set<string>> {
  const data = await admin<{ metaobjects: { nodes: { handle: string }[] } }>(
    /* GraphQL */ `
      query {
        metaobjects(type: "designer", first: 100) {
          nodes {
            handle
          }
        }
      }
    `,
  );
  return new Set(data.metaobjects.nodes.map((node) => node.handle));
}

async function main() {
  log.step(`Seeding ${DESIGNERS.length} designers${DRY_RUN ? " (dry run)" : ""}`);

  const existing = await existingHandles();
  let created = 0;
  let skipped = 0;

  for (const [index, designer] of DESIGNERS.entries()) {
    if (existing.has(designer.handle)) {
      log.skip(`${designer.name} — already exists`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      log.ok(`${designer.name} — would create (portrait ${designer.portrait})`);
      created++;
      continue;
    }

    const portraitId = await uploadImage(designer.portrait, `${designer.name}, portrait`);

    const data = await admin<{
      metaobjectCreate: {
        metaobject: { handle: string } | null;
        userErrors: { field?: string[] | null; message: string }[];
      };
    }>(
      /* GraphQL */ `
        mutation CreateDesigner($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject {
              handle
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
          type: "designer",
          handle: designer.handle,
          capabilities: { publishable: { status: "ACTIVE" } },
          fields: [
            { key: "name", value: designer.name },
            ...(designer.studio ? [{ key: "studio", value: designer.studio }] : []),
            { key: "byline", value: designer.byline },
            { key: "portrait", value: portraitId },
            { key: "portrait_alt", value: `${designer.name}, portrait` },
            { key: "bio_short", value: designer.bioShort },
            { key: "bio_full", value: richText(...designer.bioFull) },
            { key: "sort_order", value: String(index + 1) },
          ],
        },
      },
    );

    assertNoUserErrors(data.metaobjectCreate.userErrors, `designer ${designer.handle}`);
    log.ok(`${designer.name} → ${data.metaobjectCreate.metaobject?.handle}`);
    created++;
  }

  console.log(`\n  created ${created} · skipped ${skipped}\n`);
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
