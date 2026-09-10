import "server-only";

import { NextResponse } from "next/server";

import { audit, logInternalError, logValidationFailure } from "./audit";
import { currentStaff, type StaffSession } from "./auth";
import { AdminApiError, UserErrors } from "./shopify";
import { consume, type LimitPreset } from "./rate-limit";
import { clientIp, isSameOrigin } from "./request";

/**
 * The guards every `/api/admin/**` route handler is built from.
 *
 * Each handler reads as a series of early returns rather than nested ifs, and the
 * ORDER matters — it is the cheap, local checks first and Shopify last, so an
 * unauthenticated flood never reaches the Admin API or spends a scrypt derive:
 *
 *   session -> same-origin -> rate limit -> body size -> schema -> operation
 *   allowlist -> Shopify
 */

/** Codes the client is allowed to see. Nothing else crosses the boundary. */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CROSS_ORIGIN"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_ALLOWED"
  | "INVALID"
  | "UPSTREAM";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CROSS_ORIGIN: 403,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  NOT_ALLOWED: 403,
  INVALID: 422,
  UPSTREAM: 502,
};

export function fail(code: ErrorCode, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ code, message, ...extra }, { status: STATUS[code] });
}

export type GuardContext = { staff: StaffSession; ip: string };

type GuardResult =
  | { ok: true; context: GuardContext }
  | { ok: false; response: NextResponse };

/**
 * `action` is the audit verb, e.g. "metaobject.update". `limit` picks the bucket:
 * "read" for GETs, "write" for mutations.
 *
 * `requireOrigin` defaults to true for the write preset. A cross-origin GET of
 * data the caller is already authenticated for is not a CSRF problem, but a
 * cross-origin POST is, so the check follows the preset unless overridden.
 */
export async function guard(
  request: Request,
  { action, limit }: { action: string; limit: LimitPreset },
): Promise<GuardResult> {
  const ip = clientIp(request.headers);

  const staff = await currentStaff();
  if (!staff) {
    audit({ action, actor: "anonymous", outcome: "denied", reason: "UNAUTHENTICATED", ip });
    return { ok: false, response: fail("UNAUTHENTICATED", "Sign in to continue.") };
  }

  if (limit === "write" && !isSameOrigin(request)) {
    audit({ action, actor: staff.email, outcome: "denied", reason: "CROSS_ORIGIN", ip });
    return { ok: false, response: fail("CROSS_ORIGIN", "This request must come from the admin panel.") };
  }

  const budget = consume(limit, `${staff.email}:${ip}`);
  if (!budget.ok) {
    audit({ action, actor: staff.email, outcome: "denied", reason: "RATE_LIMITED", ip });
    return {
      ok: false,
      response: NextResponse.json(
        { code: "RATE_LIMITED", message: "Too many requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(budget.retryAfterSeconds) } },
      ),
    };
  }

  return { ok: true, context: { staff, ip } };
}

/**
 * Reads at most `maxBytes` of JSON.
 *
 * The size is measured from the bytes that actually arrive, not from
 * `content-length` — that header is absent on a chunked request and can simply
 * lie on any other, so trusting it means the limit is advisory. The stream is
 * cancelled the moment the budget is passed, rather than buffering the whole
 * body and then complaining about it.
 */
export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; code: "PAYLOAD_TOO_LARGE" | "BAD_REQUEST" }> {
  const body = request.body;
  if (!body) return { ok: false, code: "BAD_REQUEST" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, code: "PAYLOAD_TOO_LARGE" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, code: "BAD_REQUEST" };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(merged)) };
  } catch {
    return { ok: false, code: "BAD_REQUEST" };
  }
}

type ZodLike<T> = {
  safeParse: (input: unknown) =>
    | { success: true; data: T }
    | { success: false; error: { issues: readonly { path: (string | number | symbol)[]; code: string; message: string }[] } };
};

/**
 * Validate on the server even though the form already validated on the client.
 * The client check is a convenience for the operator; this one is the rule.
 * Failures are logged with paths and codes but never with the submitted values,
 * so a malformed write leaves a diagnosable trace without leaking its content.
 */
export function validate<T>(
  schema: ZodLike<T>,
  input: unknown,
  scope: string,
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    logValidationFailure(scope, parsed.error.issues);
    return {
      ok: false,
      response: fail("INVALID", "That request is not valid.", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message,
        })),
      }),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * The single place an exception becomes a response. Shopify's own message, the
 * stack, and the values that caused it all stop here — the client learns a code
 * and a sentence, and stderr learns the rest.
 */
export function failure(scope: string, error: unknown): NextResponse {
  if (error instanceof UserErrors) {
    // Shopify's validation feedback, e.g. a bad URL in a `url` field. The
    // operator needs to see this to fix their input, so it is passed through.
    return fail("INVALID", "Shopify rejected the change.", { issues: error.issues });
  }

  if (error instanceof AdminApiError) {
    logInternalError(scope, error);
    return fail("UPSTREAM", "Shopify could not be reached. Try again.", { detail: error.code });
  }

  logInternalError(scope, error);
  return fail("UPSTREAM", "Something went wrong.");
}
