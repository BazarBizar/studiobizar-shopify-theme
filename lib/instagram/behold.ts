import "server-only";

import { getSiteSettings } from "@/lib/shopify";

import { beholdFeedId } from "./feed-id";

/**
 * Instagram feed via Behold (behold.so).
 *
 * Behold proxies the Instagram Graph API and serves a plain JSON feed, so no
 * Instagram token lives in this app and there is nothing to refresh.
 *
 * The feed is set in the panel (Site-wide → Site settings → Instagram feed), with
 * `BEHOLD_FEED_ID` in `.env` as the fallback — the id from the feed's Behold
 * dashboard, or the full `https://feeds.behold.so/…` URL. Nothing else is fetched:
 * the address is built here from the id, so a value typed into the panel can never
 * point the server at another host.
 *
 * With the variable unset this returns an empty array rather than throwing, and
 * the landing page falls back to the images on the page's `gallery` metafield —
 * the same degradation rule the email and newsletter code follows.
 */

export type InstagramPost = {
  id: string;
  permalink: string;
  imageUrl: string;
  caption: string | null;
  /** IMAGE · VIDEO · CAROUSEL_ALBUM */
  mediaType: string | null;
};

/** One size entry in Behold's `sizes` map. */
type BeholdSize = { mediaUrl?: string; width?: number; height?: number };

type BeholdPost = {
  id?: string;
  permalink?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  prunedCaption?: string;
  mediaType?: string;
  sizes?: { small?: BeholdSize; medium?: BeholdSize; large?: BeholdSize; full?: BeholdSize };
};

/** Behold has shipped both a bare array and a `{ posts }` envelope. */
type BeholdResponse = BeholdPost[] | { posts?: BeholdPost[] };

async function feedUrl(): Promise<string | null> {
  const fromPanel = beholdFeedId((await getSiteSettings()).instagramFeed);
  const id = fromPanel ?? beholdFeedId(process.env.BEHOLD_FEED_ID);
  return id ? `https://feeds.behold.so/${id}` : null;
}

export async function instagramConfigured(): Promise<boolean> {
  return Boolean(await feedUrl());
}

/**
 * A still image for every post. `mediaUrl` on a VIDEO is the video file, so the
 * thumbnail is preferred and the sized variants are used where Behold supplies
 * them.
 */
function imageFor(post: BeholdPost): string | null {
  const sized =
    post.sizes?.medium?.mediaUrl ?? post.sizes?.large?.mediaUrl ?? post.sizes?.full?.mediaUrl;

  if (post.mediaType === "VIDEO") return post.thumbnailUrl ?? sized ?? null;
  return sized ?? post.mediaUrl ?? post.thumbnailUrl ?? null;
}

export async function getInstagramPosts(limit = 5): Promise<InstagramPost[]> {
  const url = await feedUrl();

  if (!url) {
    console.warn("[instagram] No Instagram feed set (Site settings, or BEHOLD_FEED_ID) — falling back to the gallery.");
    return [];
  }

  try {
    const response = await fetch(url, {
      // Instagram content changes slowly and this is a decorative row; an hour
      // is plenty, and it keeps the landing page off Behold's rate limit.
      next: { revalidate: 60 * 60, tags: ["instagram"] },
    });

    if (!response.ok) throw new Error(`Behold returned ${response.status}`);

    const body = (await response.json()) as BeholdResponse;
    const posts = Array.isArray(body) ? body : (body.posts ?? []);

    return posts
      .map((post): InstagramPost | null => {
        const imageUrl = imageFor(post);
        if (!imageUrl || !post.permalink) return null;
        return {
          id: post.id ?? post.permalink,
          permalink: post.permalink,
          imageUrl,
          caption: post.prunedCaption ?? post.caption ?? null,
          mediaType: post.mediaType ?? null,
        };
      })
      .filter((post): post is InstagramPost => post !== null)
      .slice(0, limit);
  } catch (error) {
    // A feed outage must not take the landing page down.
    console.error("[instagram] could not load the Behold feed", error);
    return [];
  }
}
