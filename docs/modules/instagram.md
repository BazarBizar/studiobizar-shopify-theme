# Instagram (Behold)

The five-up row on the landing page.

## Files

| File | Role |
|---|---|
| `lib/instagram/behold.ts` | Fetches and normalises the feed |
| `components/sections/instagram-row.tsx` | The row, live or fallback |

## Configuration

```dotenv
BEHOLD_FEED_ID=      # the id from the Behold dashboard, or the full feed URL
```

Both forms are accepted — a bare id is expanded to `https://feeds.behold.so/<id>`.

Behold proxies the Instagram Graph API and serves plain JSON, so **no Instagram token lives in this
app** and there is nothing to refresh.

## Degrades rather than breaks

Two fallbacks, following the same rule as the email and newsletter code:

- **`BEHOLD_FEED_ID` unset** — logs a warning, returns `[]`
- **Feed unreachable or malformed** — logs the error, returns `[]`

In both cases the row falls back to the images on the home page's `custom.gallery` metafield, so the
section never collapses and a feed outage cannot take the landing page down. Live tiles link to the
post; fallback tiles do not.

## Response shape

Behold has shipped both a bare array and a `{ posts: [...] }` envelope, so the parser accepts either.

Per post it prefers `sizes.medium → sizes.large → sizes.full → mediaUrl`. For a `VIDEO` it takes
`thumbnailUrl` first, because `mediaUrl` on a video is the video file rather than a still.

## Caching

`next: { revalidate: 3600, tags: ["instagram"] }` — an hour. The row is decorative, Instagram moves
slowly, and it keeps the landing page well clear of Behold's rate limit.

## Image hosts

Behold serves media from Meta's CDNs and its own, so `next.config.ts` allows:

```
**.cdninstagram.com   **.fbcdn.net   feeds.behold.so   behold.pictures
```

Instagram URLs arrive pre-sized, so live tiles pass `unoptimized` and skip the Shopify
`?width=` transform that the rest of the site uses.

## Verified

With a real feed id set, the row renders five tiles linking to their posts, served from
`behold.pictures` and `scontent-*.cdninstagram.com`.
