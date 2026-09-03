/**
 * Creates the Shopify pages the storefront reads that `schema-push` does not
 * provision, and fills their PAGE metafields.
 *
 * Right now that is the `gallery` page, whose `custom.gallery` metafield points
 * at the `captioned_image` entries created by `seed-projects`. Step 11 extends
 * this with the Our Story, Service and Contact content.
 *
 *   npx tsx scripts/seed-pages.ts [--dry-run]
 *
 * Idempotent: an existing page is reused and its metafields re-set.
 */

import { DRY_RUN, admin, assertNoUserErrors, log, richText, setMetafields, uploadImage } from "./lib/admin";

type PageSeed = {
  handle: string;
  title: string;
  body: string;
  /** captioned_image handles to attach to `custom.gallery`. */
  gallery?: string[];
  /** Local images uploaded and wrapped as captioned_image for `hero_slides`. */
  heroSlides?: { file: string; caption: string }[];
  /** captioned_image handles for `custom.feature_images`. */
  featureImages?: string[];
  storyImage?: string;
  introBody?: string[];
  projectsIntro?: string[];
  storyBlock?: string[];
  /** Collection handles for the two landing-page product carousels. */
  newIn?: string;
  monthlySelection?: string;
};

const PAGES: PageSeed[] = [
  {
    handle: "gallery",
    title: "Gallery",
    body: "<p>Studio Bizar pieces photographed in the rooms they were made for — interiors, details, and the workshop in Bali.</p>",
    gallery: Array.from({ length: 12 }, (_, i) => `project-image-${i + 1}`),
  },
  {
    handle: "home",
    title: "Studio Bizar",
    body: "<p>Designed for life, inspired by the world.</p>",
    // The hero is a carousel — add or remove slides here and the landing page
    // follows; there is no fixed count in the component.
    heroSlides: [
      { file: "public/image/home slide/hero1.png", caption: "The pool house at dusk" },
      { file: "public/image/home slide/hero2.png", caption: "The long room" },
      { file: "public/image/home slide/hero3.png", caption: "Terrace seating" },
    ],
    featureImages: ["project-image-1", "project-image-2", "project-image-3"],
    gallery: ["project-image-4", "project-image-5", "project-image-6", "project-image-7", "project-image-8"],
    storyImage: "public/image/owner.png",
    introBody: [
      "Through our Design Program, we deliver made-to-order pieces, private label collections and tailored solutions, supporting projects from concept to completion. We collaborate worldwide with architects, designers, project developers, hotels, restaurants and retail partners.",
    ],
    projectsIntro: [
      "From private homes to hotels and restaurants, we work alongside architects and designers to furnish spaces that are built to be lived in, not just photographed.",
    ],
    storyBlock: [
      "Studio Bizar began in a warehouse in Kontich with a container of teak and no particular plan. What we knew was that furniture had got worse — thinner, faster, harder to repair — and that the makers who could do better were still there if you went looking.",
      "Two decades on, the relationships we built in Bali and Java are the same ones the workshop runs on.",
    ],
    newIn: "the-duna-collection",
    monthlySelection: "the-safari-collection",
  },
];

async function findPage(handle: string): Promise<string | null> {
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
  // The page query does honour `handle:`, but confirm rather than trust it.
  return data.pages.nodes.find((node) => node.handle === handle)?.id ?? null;
}

async function captionedImageIds(handles: string[]): Promise<string[]> {
  const ids: string[] = [];

  for (const handle of handles) {
    const data = await admin<{ metaobjectByHandle: { id: string } | null }>(
      /* GraphQL */ `
        query C($handle: MetaobjectHandleInput!) {
          metaobjectByHandle(handle: $handle) {
            id
          }
        }
      `,
      { handle: { type: "captioned_image", handle } },
    );
    if (data.metaobjectByHandle) ids.push(data.metaobjectByHandle.id);
  }

  return ids;
}

async function main() {
  log.step(`Seeding ${PAGES.length} page(s)${DRY_RUN ? " (dry run)" : ""}`);

  for (const seed of PAGES) {
    if (DRY_RUN) {
      log.ok(`${seed.title} — ${seed.gallery?.length ?? 0} gallery images`);
      continue;
    }

    let pageId = await findPage(seed.handle);

    if (pageId) {
      log.skip(`${seed.title} — page exists, refreshing metafields`);
    } else {
      const created = await admin<{
        pageCreate: {
          page: { id: string } | null;
          userErrors: { field?: string[] | null; message: string }[];
        };
      }>(
        /* GraphQL */ `
          mutation CreatePage($page: PageCreateInput!) {
            pageCreate(page: $page) {
              page {
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
          page: {
            handle: seed.handle,
            title: seed.title,
            body: seed.body,
            isPublished: true,
          },
        },
      );

      assertNoUserErrors(created.pageCreate.userErrors, `pageCreate ${seed.handle}`);
      pageId = created.pageCreate.page!.id;
      log.ok(`${seed.title} — created`);
    }

    // Pages publish through `isPublished` on the input above — unlike collections,
    // they are not `Publishable`, and publishablePublish rejects a Page gid.

    const metafields: {
      ownerId: string;
      namespace: string;
      key: string;
      type: string;
      value: string;
    }[] = [];

    if (seed.gallery?.length) {
      const ids = await captionedImageIds(seed.gallery);
      if (ids.length === 0) {
        log.warn(`${seed.title} — no captioned_image entries found; run seed-projects first`);
      } else {
        metafields.push({
          ownerId: pageId,
          namespace: "custom",
          key: "gallery",
          type: "list.metaobject_reference",
          value: JSON.stringify(ids),
        });
        log.ok(`${seed.title} — ${ids.length} gallery images`);
      }
    }

    if (seed.featureImages?.length) {
      const ids = await captionedImageIds(seed.featureImages);
      if (ids.length) {
        metafields.push({
          ownerId: pageId,
          namespace: "custom",
          key: "feature_images",
          type: "list.metaobject_reference",
          value: JSON.stringify(ids),
        });
      }
    }

    // Hero slides are uploaded here rather than reused, so the landing page can
    // have its own artwork independent of the project galleries.
    if (seed.heroSlides?.length) {
      const ids: string[] = [];
      for (const [index, slide] of seed.heroSlides.entries()) {
        const handle = `home-hero-${index + 1}`;
        const found = await admin<{ metaobjectByHandle: { id: string } | null }>(
          /* GraphQL */ `
            query H($handle: MetaobjectHandleInput!) {
              metaobjectByHandle(handle: $handle) {
                id
              }
            }
          `,
          { handle: { type: "captioned_image", handle } },
        );

        if (found.metaobjectByHandle) {
          ids.push(found.metaobjectByHandle.id);
          continue;
        }

        const fileId = await uploadImage(slide.file, slide.caption);
        const created = await admin<{
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
          {
            metaobject: {
              type: "captioned_image",
              handle,
              fields: [
                { key: "image", value: fileId },
                { key: "caption", value: slide.caption },
                { key: "alt_text", value: slide.caption },
              ],
            },
          },
        );
        assertNoUserErrors(created.metaobjectCreate.userErrors, `hero slide ${handle}`);
        ids.push(created.metaobjectCreate.metaobject!.id);
      }

      metafields.push({
        ownerId: pageId,
        namespace: "custom",
        key: "hero_slides",
        type: "list.metaobject_reference",
        value: JSON.stringify(ids),
      });
      log.ok(`${seed.title} — ${ids.length} hero slides`);
    }

    if (seed.storyImage) {
      const fileId = await uploadImage(seed.storyImage, `${seed.title} — our story`);
      metafields.push({
        ownerId: pageId,
        namespace: "custom",
        key: "story_image",
        type: "file_reference",
        value: fileId,
      });
    }

    if (seed.introBody?.length) {
      metafields.push({
        ownerId: pageId,
        namespace: "custom",
        key: "intro_body",
        type: "rich_text_field",
        value: richText(...seed.introBody),
      });
    }

    if (seed.projectsIntro?.length) {
      metafields.push({
        ownerId: pageId,
        namespace: "custom",
        key: "projects_intro",
        type: "rich_text_field",
        value: richText(...seed.projectsIntro),
      });
    }

    if (seed.storyBlock?.length) {
      metafields.push({
        ownerId: pageId,
        namespace: "custom",
        key: "story_block_1",
        type: "rich_text_field",
        value: richText(...seed.storyBlock),
      });
    }

    for (const [key, handle] of [
      ["new_in", seed.newIn],
      ["monthly_selection", seed.monthlySelection],
    ] as const) {
      if (!handle) continue;
      const found = await admin<{ collectionByHandle: { id: string } | null }>(
        /* GraphQL */ `
          query C($handle: String!) {
            collectionByHandle(handle: $handle) {
              id
            }
          }
        `,
        { handle },
      );
      if (found.collectionByHandle) {
        metafields.push({
          ownerId: pageId,
          namespace: "custom",
          key,
          type: "collection_reference",
          value: found.collectionByHandle.id,
        });
      } else {
        log.warn(`${seed.title} — collection "${handle}" not found for ${key}`);
      }
    }

    if (metafields.length) {
      await setMetafields(metafields);
      log.ok(`${seed.title} — ${metafields.length} metafields set`);
    }
  }

  console.log("");
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
