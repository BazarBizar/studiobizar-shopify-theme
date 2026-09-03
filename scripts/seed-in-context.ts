/**
 * Links `project` entries to a collection's `custom.in_context_projects` —
 * the "In Context" band on Collections Detail (`DESK - Collections
 * Detail.pdf`). A small follow-up to `seed-collections`, kept separate so
 * re-running it never re-uploads that script's collection images.
 *
 *   npx tsx scripts/seed-in-context.ts [--dry-run]
 *
 * Idempotent: re-running just re-sets the same list.
 */

import { DRY_RUN, admin, log, setMetafields } from "./lib/admin";

const LINKS: { collectionHandle: string; projectHandles: string[] }[] = [
  {
    collectionHandle: "the-arc-teak-collection",
    // Six of the ten seeded projects — an editorial pick, not a rule.
    projectHandles: [
      "casa-vitro",
      "sublima-comporta",
      "maison-dosier",
      "the-salt-room",
      "atelier-nord",
      "villa-mimosa",
    ],
  },
];

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

async function projectGid(handle: string): Promise<string> {
  const data = await admin<{ metaobjectByHandle: { id: string } | null }>(
    /* GraphQL */ `
      query P($handle: MetaobjectHandleInput!) {
        metaobjectByHandle(handle: $handle) {
          id
        }
      }
    `,
    { handle: { type: "project", handle } },
  );
  if (!data.metaobjectByHandle) {
    throw new Error(`Project "${handle}" not found — run seed-projects first.`);
  }
  return data.metaobjectByHandle.id;
}

async function main() {
  log.step(`Linking In Context projects${DRY_RUN ? " (dry run)" : ""}`);

  for (const link of LINKS) {
    const collectionId = await findCollection(link.collectionHandle);
    if (!collectionId) {
      log.warn(`${link.collectionHandle} — collection not found, run seed-collections first`);
      continue;
    }

    if (DRY_RUN) {
      log.ok(`${link.collectionHandle} — would link ${link.projectHandles.length} projects`);
      continue;
    }

    const projectIds = await Promise.all(link.projectHandles.map(projectGid));
    await setMetafields([
      {
        ownerId: collectionId,
        namespace: "custom",
        key: "in_context_projects",
        type: "list.metaobject_reference",
        value: JSON.stringify(projectIds),
      },
    ]);
    log.ok(`${link.collectionHandle} — linked ${projectIds.length} projects`);
  }

  console.log("");
}

void main().catch((error: unknown) => {
  console.error("\n✕", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
