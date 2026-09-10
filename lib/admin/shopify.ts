import "server-only";

import { unstable_rethrow } from "next/navigation";

import { adminEnv } from "./env";
import { logInternalError } from "./audit";

/**
 * The admin panel's Admin GraphQL client.
 *
 * Separate from `lib/shopify/admin.ts` — which the storefront's inquiry write
 * uses — for two reasons: the token here comes only from `lib/admin/env.ts`
 * (§4.1), and this client retries, times out and refuses to cache, none of
 * which the storefront's one-shot write needs.
 *
 * Every response is `no-store`. An operator editing content must see the store
 * as it is now; a cached read would show them a stale row and invite them to
 * overwrite a change someone else already made.
 */

/** Short, safe codes. These are what a client is allowed to learn. */
export type AdminErrorCode =
  | "SHOPIFY_UNAVAILABLE"
  | "SHOPIFY_TIMEOUT"
  | "SHOPIFY_THROTTLED"
  | "SHOPIFY_REJECTED"
  | "SHOPIFY_MALFORMED";

export class AdminApiError extends Error {
  readonly code: AdminErrorCode;

  constructor(code: AdminErrorCode, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
  }
}

const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 4;

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: {
    cost?: { throttleStatus?: { currentlyAvailable: number; restoreRate: number } };
  };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential with jitter. Jitter matters when several admin tabs are open:
 *  without it they retry in lockstep and re-throttle each other. */
function backoffMs(attempt: number) {
  return Math.round(2 ** attempt * 250 * (0.5 + Math.random()));
}

function isThrottled(body: GraphQLResponse<unknown>) {
  return body.errors?.some((error) => error.extensions?.code === "THROTTLED") ?? false;
}

/**
 * Reads Shopify's leaky bucket and waits before it rejects us, rather than
 * after. `restoreRate` is points per second; below one large query's worth of
 * headroom, the next call is very likely to be throttled anyway.
 */
async function respectThrottle(body: GraphQLResponse<unknown>) {
  const status = body.extensions?.cost?.throttleStatus;
  if (!status || status.restoreRate <= 0) return;
  if (status.currentlyAvailable >= 200) return;

  await sleep(Math.min(2000, Math.ceil(((200 - status.currentlyAvailable) / status.restoreRate) * 1000)));
}

/**
 * `scope` is a static label for the log line — the operation name, normally.
 * The GraphQL document itself always comes from `lib/admin/operations.ts`; this
 * function takes a string because it is the transport, but nothing outside that
 * allowlist may ever call it.
 */
export async function adminGraphQL<T>(
  scope: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_ACCESS_TOKEN, apiVersion } = adminEnv();
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${apiVersion}/graphql.json`;

  let lastCode: AdminErrorCode = "SHOPIFY_UNAVAILABLE";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(backoffMs(attempt));

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      /**
       * Next signals control flow by THROWING: `notFound()`, `redirect()`, and — the one
       * that bit here — the dynamic-usage error raised when a `no-store` fetch is
       * attempted during static prerendering. Those are not failures and must reach
       * Next, so `unstable_rethrow` lets them past before anything else is considered.
       *
       * Without it the retry loop treated the prerender signal as a network fault and
       * retried four times with backoff, which turned every build into four seconds of
       * alarming stack traces per admin route — and would have swallowed a genuine
       * `redirect()` thrown from inside a fetch wrapper.
       */
      unstable_rethrow(error);

      // A timeout and a dead socket are both worth retrying, and neither should hand
      // the caller anything about our network.
      lastCode =
        error instanceof Error && error.name === "TimeoutError"
          ? "SHOPIFY_TIMEOUT"
          : "SHOPIFY_UNAVAILABLE";
      logInternalError(`shopify.${scope}.transport`, error);
      continue;
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
      lastCode = "SHOPIFY_THROTTLED";
      continue;
    }

    if (response.status >= 500) {
      lastCode = "SHOPIFY_UNAVAILABLE";
      logInternalError(`shopify.${scope}.http`, new Error(`Admin API returned ${response.status}`));
      continue;
    }

    if (!response.ok) {
      // 4xx other than 429: a bad document or a missing scope. Retrying cannot
      // help, and the body may quote our query, so it is logged, not returned.
      logInternalError(
        `shopify.${scope}.http`,
        new Error(`Admin API returned ${response.status}: ${await response.text().catch(() => "")}`),
      );
      throw new AdminApiError("SHOPIFY_REJECTED", "Shopify rejected the request.");
    }

    let body: GraphQLResponse<T>;
    try {
      body = (await response.json()) as GraphQLResponse<T>;
    } catch (error) {
      logInternalError(`shopify.${scope}.parse`, error);
      throw new AdminApiError("SHOPIFY_MALFORMED", "Shopify returned an unreadable response.");
    }

    if (isThrottled(body)) {
      lastCode = "SHOPIFY_THROTTLED";
      await respectThrottle(body);
      continue;
    }

    if (body.errors?.length) {
      // Shopify's GraphQL errors quote the document and sometimes the variables.
      logInternalError(`shopify.${scope}.graphql`, new Error(JSON.stringify(body.errors)));
      throw new AdminApiError("SHOPIFY_REJECTED", "Shopify rejected the query.");
    }

    if (!body.data) {
      logInternalError(`shopify.${scope}.empty`, new Error("Admin API returned no data"));
      throw new AdminApiError("SHOPIFY_MALFORMED", "Shopify returned no data.");
    }

    await respectThrottle(body);
    return body.data;
  }

  throw new AdminApiError(lastCode, "Shopify is not responding.");
}

export type UserError = { field?: string[] | null; message: string };

/**
 * Shopify answers HTTP 200 for a rejected mutation, so `userErrors` has to be
 * checked explicitly on every write. Unlike the transport errors above these are
 * usually the operator's fault ("value is not a valid URL"), so the messages are
 * safe to show — but the field paths are kept separate from them so a caller
 * cannot accidentally render a message that quotes a submitted value.
 */
export class UserErrors extends Error {
  readonly issues: { field: string; message: string }[];

  constructor(issues: { field: string; message: string }[]) {
    super("Shopify rejected the write.");
    this.name = "UserErrors";
    this.issues = issues;
  }
}

export function assertNoUserErrors(userErrors: UserError[] | undefined | null) {
  if (!userErrors?.length) return;

  throw new UserErrors(
    userErrors.map((error) => ({
      field: error.field?.join(".") ?? "",
      message: error.message,
    })),
  );
}
