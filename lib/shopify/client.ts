import "server-only";

/**
 * Thin Storefront API client. The access token never leaves the server, which
 * is what `server-only` enforces — importing this from a Client Component is a
 * build error rather than a leak.
 */

export class ShopifyError extends Error {
  readonly status?: number;
  readonly detail?: unknown;

  constructor(message: string, options?: { status?: number; detail?: unknown }) {
    super(message);
    this.name = "ShopifyError";
    this.status = options?.status;
    this.detail = options?.detail;
  }
}

type GraphQLError = { message: string; path?: (string | number)[] };

type GraphQLResponse<T> = { data?: T; errors?: GraphQLError[] };

type FetchArgs<V> = {
  query: string;
  variables?: V;
  /** Cache tags, so a webhook can invalidate one entity class. */
  tags?: string[];
  /** Seconds. `false` opts out of the cache entirely. */
  revalidate?: number | false;
};

/** Read env at call time — a missing token must not break `next build`. */
function endpoint() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

  if (!domain || !token) {
    throw new ShopifyError(
      "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN. Add them to .env.",
    );
  }

  return { url: `https://${domain}/api/${version}/graphql.json`, token };
}

export async function shopifyFetch<T, V = Record<string, unknown>>({
  query,
  variables,
  tags,
  revalidate,
}: FetchArgs<V>): Promise<T> {
  const { url, token } = endpoint();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    ...(revalidate === false
      ? { cache: "no-store" as const }
      : { next: { revalidate, tags } }),
  });

  if (!response.ok) {
    throw new ShopifyError(`Storefront API returned ${response.status}`, {
      status: response.status,
      detail: await response.text().catch(() => undefined),
    });
  }

  const body = (await response.json()) as GraphQLResponse<T>;

  if (body.errors?.length) {
    throw new ShopifyError(body.errors.map((e) => e.message).join("; "), {
      detail: body.errors,
    });
  }

  if (!body.data) {
    throw new ShopifyError("Storefront API returned no data");
  }

  return body.data;
}
