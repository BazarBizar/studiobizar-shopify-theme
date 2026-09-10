import "server-only";

/**
 * Audit trail and internal error logging.
 *
 * Two hard rules, because both are invisible when broken:
 *
 *  - An audit line records WHICH fields a write touched, never WHAT was written.
 *    A customer's email or a draft press release in a log line is a data leak
 *    that outlives the request, and audit logs are routinely shipped to places
 *    with weaker access control than the store itself.
 *  - Internal errors go to stderr and stop there. The client gets a short code
 *    from `lib/admin/api.ts`; the Shopify response body, the stack and the
 *    submitted values never cross the boundary.
 */

export type AuditOutcome = "ok" | "denied" | "invalid" | "error";

export type AuditEntry = {
  /** Verb, e.g. "metaobject.update", "auth.login". */
  action: string;
  /** Email of the staff member, or "anonymous" before a session exists. */
  actor: string;
  outcome: AuditOutcome;
  /** Metaobject type or resource class the action addressed. */
  type?: string;
  entryId?: string;
  /** Field KEYS only. Never values — see the note above. */
  fields?: string[];
  /** Short machine-readable cause, e.g. "NOT_ALLOWED", "RATE_LIMITED". */
  reason?: string;
  ip?: string;
};

export type AuditSink = (line: AuditEntry & { at: string }) => void;

const stdoutSink: AuditSink = (line) => {
  // One line of JSON: greppable, and parseable by any log shipper without a
  // multi-line rule.
  process.stdout.write(`${JSON.stringify({ audit: line })}\n`);
};

let sink: AuditSink = stdoutSink;

/**
 * Redirects the audit trail — to a database, to Shopify metaobjects, to a queue.
 * Exists so that decision can be made later without touching a single call
 * site, which is why every writer goes through `audit()` and nothing formats
 * its own log line.
 */
export function setAuditSink(next: AuditSink | null) {
  sink = next ?? stdoutSink;
}

export function audit(entry: AuditEntry) {
  try {
    sink({ ...entry, at: new Date().toISOString() });
  } catch {
    // A broken sink must never fail the request it was describing.
  }
}

/**
 * The real cause, for operators. `scope` is a short static string like
 * "metaobjects.update" so that a grep finds every occurrence of one failure.
 */
export function logInternalError(scope: string, error: unknown) {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "NonError", message: String(error) };

  process.stderr.write(
    `${JSON.stringify({ adminError: { scope, at: new Date().toISOString(), ...detail } })}\n`,
  );
}

type ZodLikeIssue = { path: (string | number | symbol)[]; code: string; message: string };

/**
 * Validation failures are logged too. Without this a malformed write leaves no
 * trace at all — the client gets a generic 400 and the operator has nothing to
 * diagnose. Path, code and message only: `issue.input` and the submitted body
 * are deliberately dropped, so this stays safe to log for a form that carries
 * customer data.
 */
export function logValidationFailure(scope: string, issues: readonly ZodLikeIssue[]) {
  process.stderr.write(
    `${JSON.stringify({
      adminInvalid: {
        scope,
        at: new Date().toISOString(),
        issues: issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          code: issue.code,
          message: issue.message,
        })),
      },
    })}\n`,
  );
}
