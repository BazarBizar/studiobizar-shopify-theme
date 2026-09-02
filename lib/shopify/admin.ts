import "server-only";

import { ShopifyError } from "./client";

/**
 * Admin API client. Separate from the Storefront client because it carries a
 * far more powerful token — it must never be imported into anything that could
 * reach the browser, which `server-only` enforces.
 *
 * Used for writes the Storefront API cannot do: creating `inquiry` metaobject
 * entries, and the seed scripts.
 */

type GraphQLError = { message: string };

type AdminResponse<T> = { data?: T; errors?: GraphQLError[] };

function endpoint() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION ?? "2026-07";

  if (!domain || !token) {
    throw new ShopifyError(
      "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN. Add them to .env.",
    );
  }

  return { url: `https://${domain}/admin/api/${version}/graphql.json`, token };
}

export async function adminFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { url, token } = endpoint();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ShopifyError(`Admin API returned ${response.status}`, {
      status: response.status,
      detail: await response.text().catch(() => undefined),
    });
  }

  const body = (await response.json()) as AdminResponse<T>;

  if (body.errors?.length) {
    throw new ShopifyError(body.errors.map((e) => e.message).join("; "), { detail: body.errors });
  }
  if (!body.data) throw new ShopifyError("Admin API returned no data");

  return body.data;
}

/**
 * Shopify answers HTTP 200 even when a mutation is rejected, so every result
 * has to be checked for `userErrors` explicitly.
 */
export function assertNoUserErrors(
  userErrors: { field?: string[] | null; message: string }[] | undefined,
  context: string,
) {
  if (!userErrors?.length) return;
  throw new ShopifyError(
    `${context}: ${userErrors.map((e) => `${e.field?.join(".") ?? ""} ${e.message}`.trim()).join("; ")}`,
    { detail: userErrors },
  );
}
