import "server-only";

import { adminFetch } from "@/lib/shopify/admin";

/**
 * Who receives the staff copy of a storefront email.
 *
 * Read from the `email_notification` metaobject (created by
 * `scripts/add-email-notifications.mjs`, edited in the panel under Site-wide → Email notifications), through
 * the Admin API — the definition's storefront access is `NONE`, because recipient
 * addresses are not something the storefront token should be able to list.
 *
 * ROUTING, in order:
 *  1. The entry whose `notification_type` is the one asked for.
 *  2. Otherwise the `default` entry.
 *  3. A DISABLED entry mutes its type. It does NOT fall through to `default` — turning
 *     "contact" off means contact messages reach nobody, which is what the switch says.
 *  4. No entries at all, or Shopify unreachable: `INQUIRY_NOTIFY_EMAIL`, the address
 *     this module replaced. A store that has not run the script yet, or a Shopify
 *     outage, must not silently drop a customer's message.
 */

/** Kept in step with the `choices` validation in `scripts/add-email-notifications.mjs`. */
export const NOTIFICATION_TYPES = ["default", "product_inquiry", "contact"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** The same pattern the field's `regex` validation enforces on save. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sixty seconds, per process. Long enough that a burst of submissions costs one Admin
 * API call, short enough that an edit in the panel is live within a minute without a
 * deploy. `clearNotificationRecipientsCache` makes it immediate on the instance that
 * handled the save.
 */
const TTL_MS = 60_000;

type Route = { type: string; recipients: string[]; enabled: boolean };

let cache: { at: number; routes: Map<string, Route> } | null = null;

export function clearNotificationRecipientsCache(): void {
  cache = null;
}

const QUERY = /* GraphQL */ `
  query EmailNotifications {
    metaobjects(type: "email_notification", first: 50) {
      nodes {
        fields {
          key
          value
        }
      }
    }
  }
`;

function parseRecipients(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).trim()).filter((item) => EMAIL.test(item))
      : [];
  } catch {
    return [];
  }
}

/** `null` means "could not ask" — the caller falls back rather than going silent. */
async function loadRoutes(): Promise<Map<string, Route> | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.routes;

  try {
    const data = await adminFetch<{
      metaobjects: { nodes: { fields: { key: string; value: string | null }[] }[] };
    }>(QUERY);

    const routes = new Map<string, Route>();
    for (const node of data.metaobjects.nodes) {
      const field = (key: string) => node.fields.find((candidate) => candidate.key === key)?.value;
      const type = field("notification_type")?.trim();
      // Two entries for one type: the first wins, so a duplicate cannot quietly
      // redirect mail. The panel shows both, which is where it gets noticed.
      if (!type || routes.has(type)) continue;

      routes.set(type, {
        type,
        recipients: parseRecipients(field("recipients")),
        // Stored as the string "false" — `Boolean("false")` is true.
        enabled: field("enabled") === "true",
      });
    }

    cache = { at: Date.now(), routes };
    return routes;
  } catch (error) {
    // Not cached, so the next submission asks again rather than waiting out the TTL.
    console.error("[email] could not read email_notification entries", error);
    return null;
  }
}

export type Recipients = {
  /** Empty means send nothing. */
  to: string[];
  /** Why these recipients — or why none. For the log line, never shown to a customer. */
  source: string;
};

function fromEnv(reason: string): Recipients {
  const to = (process.env.INQUIRY_NOTIFY_EMAIL ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => EMAIL.test(address));

  return to.length
    ? { to, source: `INQUIRY_NOTIFY_EMAIL (${reason})` }
    : { to: [], source: `${reason}, and INQUIRY_NOTIFY_EMAIL is not set` };
}

export async function notificationRecipients(type: NotificationType): Promise<Recipients> {
  const routes = await loadRoutes();

  if (routes === null) return fromEnv("Shopify unreachable");
  if (routes.size === 0) return fromEnv("no email_notification entries");

  const route = routes.get(type) ?? routes.get("default");
  if (!route) {
    return { to: [], source: `no email_notification entry for "${type}" and no "default" entry` };
  }

  const via = route.type === type ? `"${type}"` : `"default" (no "${type}" entry)`;

  if (!route.enabled) return { to: [], source: `email_notification ${via} is disabled` };
  if (!route.recipients.length) {
    return { to: [], source: `email_notification ${via} has no valid recipients` };
  }

  return { to: route.recipients, source: `email_notification ${via}` };
}
