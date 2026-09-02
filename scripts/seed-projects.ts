/**
 * Seeds `captioned_image` and `project`.
 *
 * `project.gallery` is a required `list.metaobject_reference` pointing at
 * `captioned_image`, so the captioned images are created first and their gids
 * handed to the projects — the same dependency order `schema-push` uses.
 *
 * "Casa Vitro" (Ibiza) and "Sublima Comporta" — with its year, creative lead,
 * collaborators and photography credit — are transcribed from
 * `DESK - Projects Overview.pdf` and `DESK - Projects Detail).pdf`. The other
 * eight projects and **all body copy are invented**; the PDFs use lorem ipsum.
 *
 * Categories match the `choices()` validation on the definition and the filter
 * chips in the design: Commercial · Hospitality · Residential.
 *
 *   npx tsx scripts/seed-projects.ts [--dry-run]
 *
 * Idempotent: an existing handle is skipped.
 */

import { DRY_RUN, admin, assertNoUserErrors, log, richText, uploadImage } from "./lib/admin";

/** Local images, uploaded once and shared between heroes and galleries. */
const IMAGES = [
  { file: "public/image/project1.png", caption: "The lounge, looking west at dusk" },
  { file: "public/image/project2.png", caption: "Dining, with the original beams left exposed" },
  { file: "public/image/project3.png", caption: "The courtyard seen from the stair" },
  { file: "public/image/project4.png", caption: "Guest room, morning light" },
  { file: "public/image/project5.png", caption: "Terrace seating in the afternoon" },
  { file: "public/image/project8.png", caption: "The entrance hall" },
  { file: "public/image/home slide/hero1.png", caption: "The long room" },
  { file: "public/image/home slide/hero2.png", caption: "Reading corner" },
  { file: "public/image/home slide/hero3.png", caption: "The garden elevation" },
  { file: "public/image/blog/blog1.png", caption: "Detail: the woven screen" },
  { file: "public/image/blog/blog2.png", caption: "Detail: turned timber" },
  { file: "public/image/blog/blog3.png", caption: "Detail: stone and shadow" },
];

type ProjectSeed = {
  handle: string;
  title: string;
  subtitle: string;
  location: string;
  year: string;
  category: "Commercial" | "Hospitality" | "Residential";
  creativeLead: string;
  collaborators: string;
  photography: string;
  body: string[];
  isSelected: boolean;
};

const PROJECTS: ProjectSeed[] = [
  {
    handle: "casa-vitro",
    title: "Casa Vitro",
    subtitle: "A house built around the light it lets in.",
    location: "Ibiza, Spain",
    year: "2023",
    category: "Residential",
    creativeLead: "Studio Bizar",
    collaborators: "Architects: Estudio Mar\nStyling: Annabell Kutucu, Berlin",
    photography: "Pascale Pelsmaekers",
    body: [
      "Casa Vitro sits on a slope above the salt flats, and every decision in it follows the sun. The lounge faces west; the bedrooms take the morning.",
      "We furnished it almost entirely in Duna and Arc Teak — low seating that lets the horizon stay the tallest thing in the room, and reclaimed teak that had already spent decades in this climate.",
    ],
    isSelected: true,
  },
  {
    handle: "sublima-comporta",
    title: "Sublima Comporta",
    subtitle: "Us, sent. A hotel that behaves like a house.",
    location: "Crete, Greece",
    year: "2019",
    category: "Hospitality",
    creativeLead: "Studio Bizar",
    collaborators:
      "Architects: K-studio\nInterior Curation & Styling: Annabell Kutucu, Berlin\nRenderings: Fat Tony Studio",
    photography: "Pascale Pelsmaekers",
    body: [
      "The brief asked for forty rooms that did not feel like forty rooms. The answer was to furnish each one slightly differently from a shared, deliberately narrow palette.",
      "Hardy seating throughout, because it had to survive a season of guests, and Safari tables in stone cut on the island.",
    ],
    isSelected: true,
  },
  {
    handle: "maison-dosier",
    title: "Maison d’Osier",
    subtitle: "A townhouse returned to its own proportions.",
    location: "Antwerp, Belgium",
    year: "2024",
    category: "Residential",
    creativeLead: "Studio Bizar",
    collaborators: "Architects: Bureau Vlaeminck\nContractor: Van Hool & Zn",
    photography: "Pascale Pelsmaekers",
    body: [
      "A nineteenth-century townhouse that had been subdivided twice. The work was mostly subtraction — taking out partitions until the original room sizes came back.",
      "Furniture was chosen to be visibly newer than the building, rather than pretending to belong to it.",
    ],
    isSelected: false,
  },
  {
    handle: "the-salt-room",
    title: "The Salt Room",
    subtitle: "A restaurant with one long table and nothing else.",
    location: "Lisbon, Portugal",
    year: "2024",
    category: "Hospitality",
    creativeLead: "Studio Bizar",
    collaborators: "Architects: Atelier Rua\nLighting: Aède Studios",
    photography: "Ana Brígida",
    body: [
      "Twenty-six covers at a single table, which meant the chair had to work for a two-hour sitting and still stack at the end of the night.",
      "Hardy, in the contract specification, with the cord seat re-wovable in place.",
    ],
    isSelected: true,
  },
  {
    handle: "atelier-nord",
    title: "Atelier Nord",
    subtitle: "A working studio that also receives clients.",
    location: "Copenhagen, Denmark",
    year: "2023",
    category: "Commercial",
    creativeLead: "Studio Bizar",
    collaborators: "Architects: Nord Praksis",
    photography: "Mikkel Lund",
    body: [
      "Half workshop, half showroom, with the awkward requirement that neither could be tidied away when the other was in use.",
      "The storage does the work: everything has a place at arm's reach, so the room resets in ten minutes.",
    ],
    isSelected: false,
  },
  {
    handle: "villa-mimosa",
    title: "Villa Mimosa",
    subtitle: "A summer house that stays open to the garden.",
    location: "Grasse, France",
    year: "2022",
    category: "Residential",
    creativeLead: "Studio Bizar",
    collaborators: "Landscape: Jardins du Sud",
    photography: "Camille Renard",
    body: [
      "The doors are open from May to September, so every piece had to tolerate being half outdoors — sun on one side, damp on the other.",
      "Teak and stone throughout, with textiles that were expected to fade and chosen accordingly.",
    ],
    isSelected: false,
  },
  {
    handle: "the-reading-rooms",
    title: "The Reading Rooms",
    subtitle: "A members' library above a bookshop.",
    location: "London, United Kingdom",
    year: "2025",
    category: "Commercial",
    creativeLead: "Studio Bizar",
    collaborators: "Architects: Hollow & Pike\nAcoustics: Verne Studio",
    photography: "Tom Whitely",
    body: [
      "Quiet was the brief. Soft furniture, heavy textiles, and nothing with a hard edge that could be knocked in the dark.",
      "The lighting is all local — no ceiling fittings anywhere in the main room.",
    ],
    isSelected: false,
  },
  {
    handle: "hotel-marisol",
    title: "Hotel Marisol",
    subtitle: "Fourteen rooms on a working harbour.",
    location: "Cádiz, Spain",
    year: "2024",
    category: "Hospitality",
    creativeLead: "Studio Bizar",
    collaborators: "Architects: Estudio Puerto",
    photography: "Lucía Herrero",
    body: [
      "Salt air rules out most finishes. What survives here is oiled teak, unglazed ceramic and untreated linen.",
      "Everything else was specified on the assumption it will be replaced in five years, and priced accordingly.",
    ],
    isSelected: false,
  },
  {
    handle: "the-glasshouse",
    title: "The Glasshouse",
    subtitle: "An office that refused to look like one.",
    location: "Rotterdam, Netherlands",
    year: "2023",
    category: "Commercial",
    creativeLead: "Studio Bizar",
    collaborators: "Architects: Van Dijk Werkplaats",
    photography: "Joost Bakker",
    body: [
      "Meeting rooms furnished as sitting rooms, on the theory that people negotiate better in a low chair than a high one.",
      "It worked well enough that the client asked for the same treatment in two more floors.",
    ],
    isSelected: false,
  },
  {
    handle: "casa-lentisco",
    title: "Casa Lentisco",
    subtitle: "A restoration that kept every mark it could.",
    location: "Mallorca, Spain",
    year: "2022",
    category: "Residential",
    creativeLead: "Studio Bizar",
    collaborators: "Architects: Taller Lentisco\nConservation: Miquel Roig",
    photography: "Pascale Pelsmaekers",
    body: [
      "The walls were left exactly as found, which set a very high bar for anything placed against them.",
      "Arc Teak throughout — timber with its own history, so nothing in the room is pretending to be new.",
    ],
    isSelected: true,
  },
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

async function createMetaobject(
  type: string,
  handle: string,
  fields: { key: string; value: string }[],
  publishable = false,
): Promise<string> {
  const data = await admin<{
    metaobjectCreate: {
      metaobject: { id: string } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    /* GraphQL */ `
      mutation Create($metaobject: MetaobjectCreateInput!) {
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
        type,
        handle,
        ...(publishable ? { capabilities: { publishable: { status: "ACTIVE" } } } : {}),
        fields,
      },
    },
  );

  assertNoUserErrors(data.metaobjectCreate.userErrors, `${type} ${handle}`);
  return data.metaobjectCreate.metaobject!.id;
}

async function main() {
  log.step(`Seeding captioned images and projects${DRY_RUN ? " (dry run)" : ""}`);

  if (DRY_RUN) {
    log.ok(`${IMAGES.length} captioned_image entries`);
    for (const project of PROJECTS) {
      log.ok(`${project.title} — ${project.category}, ${project.location}`);
    }
    console.log("");
    return;
  }

  // 1. captioned_image — projects cannot be created without them.
  const existingImages = await existing("captioned_image");
  const captionedIds: string[] = [];

  log.step("Captioned images");
  for (const [index, image] of IMAGES.entries()) {
    const handle = `project-image-${index + 1}`;

    if (existingImages.has(handle)) {
      const found = await admin<{ metaobjectByHandle: { id: string } | null }>(
        /* GraphQL */ `
          query B($handle: MetaobjectHandleInput!) {
            metaobjectByHandle(handle: $handle) {
              id
            }
          }
        `,
        { handle: { type: "captioned_image", handle } },
      );
      captionedIds.push(found.metaobjectByHandle!.id);
      log.skip(`${handle} — exists`);
      continue;
    }

    const fileId = await uploadImage(image.file, image.caption);
    const id = await createMetaobject("captioned_image", handle, [
      { key: "image", value: fileId },
      { key: "caption", value: image.caption },
      { key: "alt_text", value: image.caption },
      { key: "credit", value: "Studio Bizar" },
    ]);

    captionedIds.push(id);
    log.ok(`${handle} — ${image.caption}`);
  }

  // 2. project — gallery draws four captioned images, offset per project so the
  //    seeded set does not repeat the same four everywhere.
  const existingProjects = await existing("project");
  log.step("Projects");

  let created = 0;
  for (const [index, project] of PROJECTS.entries()) {
    if (existingProjects.has(project.handle)) {
      log.skip(`${project.title} — exists`);
      continue;
    }

    const gallery = Array.from(
      { length: 4 },
      (_, offset) => captionedIds[(index * 3 + offset) % captionedIds.length]!,
    );
    const heroFile = IMAGES[index % IMAGES.length]!.file;
    const cardFile = IMAGES[(index + 1) % IMAGES.length]!.file;

    const heroId = await uploadImage(heroFile, `${project.title} — ${project.location}`);
    const cardId = await uploadImage(cardFile, `${project.title} — ${project.location}`);

    await createMetaobject(
      "project",
      project.handle,
      [
        { key: "title", value: project.title },
        { key: "subtitle", value: project.subtitle },
        { key: "location", value: project.location },
        { key: "year", value: project.year },
        { key: "category", value: project.category },
        { key: "hero_image", value: heroId },
        { key: "card_image", value: cardId },
        { key: "body", value: richText(...project.body) },
        { key: "creative_lead", value: project.creativeLead },
        { key: "collaborators", value: project.collaborators },
        { key: "photography", value: project.photography },
        { key: "gallery", value: JSON.stringify(gallery) },
        { key: "sort_order", value: String(index + 1) },
        { key: "is_selected", value: String(project.isSelected) },
      ],
      true,
    );

    log.ok(`${project.title} — ${project.category}, ${project.location}`);
    created++;
  }

  // 3. featured_items — the "Featured Items" rail on Projects Detail. Applied
  //    as an update so it also fills in projects created by an earlier run.
  log.step("Featured items");
  const catalogue = await admin<{ products: { nodes: { id: string; title: string }[] } }>(
    /* GraphQL */ `
      query {
        products(first: 40, query: "status:active AND (product_type:'Sofas & Lounger' OR product_type:'Dining Chairs' OR product_type:'Coffee Tables' OR product_type:'Baskets')") {
          nodes {
            id
            title
          }
        }
      }
    `,
  );

  const productIds = catalogue.products.nodes.map((node) => node.id);

  for (const [index, project] of PROJECTS.entries()) {
    const found = await admin<{
      metaobjectByHandle: { id: string; field: { value: string | null } | null } | null;
    }>(
      /* GraphQL */ `
        query P($handle: MetaobjectHandleInput!) {
          metaobjectByHandle(handle: $handle) {
            id
            field(key: "featured_items") {
              value
            }
          }
        }
      `,
      { handle: { type: "project", handle: project.handle } },
    );

    const node = found.metaobjectByHandle;
    if (!node) continue;
    if (node.field?.value && node.field.value !== "[]") {
      log.skip(`${project.title} — featured items already set`);
      continue;
    }

    const picks = Array.from(
      { length: 4 },
      (_, offset) => productIds[(index * 4 + offset) % productIds.length]!,
    );

    const updated = await admin<{
      metaobjectUpdate: { userErrors: { field?: string[] | null; message: string }[] };
    }>(
      /* GraphQL */ `
        mutation U($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        id: node.id,
        metaobject: { fields: [{ key: "featured_items", value: JSON.stringify(picks) }] },
      },
    );

    assertNoUserErrors(updated.metaobjectUpdate.userErrors, `featured_items ${project.handle}`);
    log.ok(`${project.title} — 4 featured items`);
  }

  console.log(`\n  ${captionedIds.length} captioned images · ${created} projects created\n`);
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
