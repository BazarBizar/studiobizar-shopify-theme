import "server-only";

import { z } from "zod";

import {
  onlyChanges,
  parseSiteTexts,
  SITE_TEXT_MAX,
  SITE_TEXTS_KEY,
  SITE_TEXTS_VERSION,
  type SiteTexts,
  type StoredSiteTexts,
} from "@/lib/site-texts";

import { OPERATIONS } from "./operations";
import { ensureShopJsonDefinition, ShopJsonConflict, writeShopJson } from "./shop-json";
import { adminGraphQL } from "./shopify";

/**
 * Settings → Site texts: the fixed wording of the site (`lib/site-texts.ts`). Only the
 * texts someone changed are stored, in one json metafield on the shop, written whole
 * and named by the digest it was edited from — like Shop categories.
 */

export class SiteTextsError extends Error {
  readonly code = "CONFLICT" as const;
  constructor() {
    super("Someone else changed the texts just now. Reload the page to see their version.");
    this.name = "SiteTextsError";
  }
}

type Raw = {
  shop: { id: string; texts: { value: string; compareDigest: string } | null };
  metafieldDefinitions: { nodes: { id: string }[] };
};

async function readState() {
  const data = await adminGraphQL<Raw>("siteTexts", OPERATIONS.siteTexts.document, {});
  return {
    shopId: data.shop.id,
    digest: data.shop.texts?.compareDigest ?? null,
    stored: parseSiteTexts(data.shop.texts?.value),
    hasDefinition: data.metafieldDefinitions.nodes.length > 0,
  };
}

export type SiteTextsView = {
  /** Only what differs from the originals. */
  changes: Partial<SiteTexts>;
  digest: string | null;
  savedAt: string | null;
  savedBy: string | null;
};

export async function siteTextsView(): Promise<SiteTextsView> {
  const state = await readState();
  return {
    changes: onlyChanges(state.stored?.texts ?? {}),
    digest: state.digest,
    savedAt: state.stored?.savedAt ?? null,
    savedBy: state.stored?.savedBy ?? null,
  };
}

export const siteTextsInput = z.strictObject({
  digest: z.string().max(200).nullable(),
  texts: z.record(
    z.string().max(80),
    z.string().max(SITE_TEXT_MAX, `A text can be at most ${SITE_TEXT_MAX} characters.`),
  ),
});

export type SiteTextsInput = z.infer<typeof siteTextsInput>;

export async function saveSiteTexts(
  input: SiteTextsInput,
  actor: string,
): Promise<{ digest: string | null; changes: Partial<SiteTexts>; savedAt: string }> {
  const state = await readState();
  if (state.digest !== input.digest) throw new SiteTextsError();

  // Unknown keys, empty texts and texts equal to their original are dropped here.
  const changes = onlyChanges(input.texts);
  const savedAt = new Date().toISOString();
  const next: StoredSiteTexts = { version: SITE_TEXTS_VERSION, texts: changes, savedAt, savedBy: actor };

  if (!state.hasDefinition) {
    await ensureShopJsonDefinition({
      key: SITE_TEXTS_KEY,
      name: "Site texts",
      description: "Changed wording of the website, managed under Settings → Site texts in the admin panel. Do not edit by hand.",
    });
  }

  try {
    const digest = await writeShopJson({ shopId: state.shopId, key: SITE_TEXTS_KEY, value: next, digest: state.digest });
    return { digest, changes, savedAt };
  } catch (error) {
    if (error instanceof ShopJsonConflict) throw new SiteTextsError();
    throw error;
  }
}
