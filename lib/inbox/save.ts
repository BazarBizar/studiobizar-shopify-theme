import "server-only";

import { createHash } from "node:crypto";

import { adminFetch, assertNoUserErrors } from "@/lib/shopify/admin";

/**
 * What the visitor-facing forms keep, so it can be read in the panel (Inbox) and not
 * only in somebody's mailbox. Definitions: `scripts/add-inbox-types.mjs`.
 *
 *   contact_message        one per Contact page message
 *   newsletter_subscriber  one per ADDRESS — signing up twice is still one subscriber
 *
 * Written through the Admin API with the storefront's server-side client, like an
 * inquiry (`lib/inquiry/submit.ts`); the definitions' storefront access is `NONE`.
 */

/** Kept in step with the `choices` in `scripts/add-inbox-types.mjs`. */
export const CONTACT_STATUSES = ["new", "replied", "closed"] as const;
export const SUBSCRIBER_STATUSES = ["subscribed", "unsubscribed"] as const;

const CREATE = /* GraphQL */ `
  mutation InboxCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type CreateResult = {
  metaobjectCreate: { metaobject: { id: string } | null; userErrors: { field?: string[] | null; message: string }[] };
};

export type ContactRecord = {
  name: string;
  email: string;
  phone: string;
  company: string;
  topic: string;
  message: string;
  receivedAt: Date;
  /** What happened to the team's email, in words: "Sent to …", "Not sent: …". */
  emailStatus: string;
};

export async function saveContactMessage(record: ContactRecord): Promise<string> {
  const data = await adminFetch<CreateResult>(CREATE, {
    metaobject: {
      type: "contact_message",
      fields: [
        { key: "name", value: record.name },
        { key: "email", value: record.email },
        { key: "phone", value: record.phone },
        { key: "company", value: record.company },
        { key: "topic", value: record.topic },
        { key: "message", value: record.message },
        { key: "received_at", value: record.receivedAt.toISOString() },
        { key: "status", value: "new" },
        { key: "email_status", value: record.emailStatus.slice(0, 250) },
      ],
    },
  });
  assertNoUserErrors(data.metaobjectCreate.userErrors, "metaobjectCreate(contact_message)");
  if (!data.metaobjectCreate.metaobject) throw new Error("Shopify accepted the message but returned no entry.");
  return data.metaobjectCreate.metaobject.id;
}

/**
 * The handle is a hash of the address, so one address is one entry whatever its case,
 * and the address itself does not appear in a URL.
 */
export function subscriberHandle(email: string): string {
  return `subscriber-${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24)}`;
}

const FIND_SUBSCRIBER = /* GraphQL */ `
  query FindSubscriber($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
      status: field(key: "status") {
        value
      }
    }
  }
`;

const UPDATE = /* GraphQL */ `
  mutation SubscriberUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/** `"new"` for a first sign-up, `"again"` for an address already on the list. */
export async function subscribeToNewsletter(email: string, source: string): Promise<"new" | "again"> {
  const address = email.trim().toLowerCase();
  const handle = subscriberHandle(address);

  const found = await adminFetch<{ metaobjectByHandle: { id: string; status: { value: string | null } | null } | null }>(
    FIND_SUBSCRIBER,
    { handle: { type: "newsletter_subscriber", handle } },
  );
  const existing = found.metaobjectByHandle;

  if (existing) {
    // Someone who left and signs up again is subscribed again; the first date is kept.
    if (existing.status?.value !== "subscribed") {
      const data = await adminFetch<{ metaobjectUpdate: { userErrors: { field?: string[] | null; message: string }[] } }>(
        UPDATE,
        { id: existing.id, metaobject: { fields: [{ key: "status", value: "subscribed" }] } },
      );
      assertNoUserErrors(data.metaobjectUpdate.userErrors, "metaobjectUpdate(newsletter_subscriber)");
    }
    return "again";
  }

  const data = await adminFetch<CreateResult>(CREATE, {
    metaobject: {
      type: "newsletter_subscriber",
      handle,
      fields: [
        { key: "email", value: address },
        { key: "subscribed_at", value: new Date().toISOString() },
        { key: "source", value: source.slice(0, 200) },
        { key: "status", value: "subscribed" },
      ],
    },
  });
  // The same address sent twice at once: the second create finds the handle taken.
  if (data.metaobjectCreate.userErrors.some((error) => error.field?.includes("handle"))) return "again";
  assertNoUserErrors(data.metaobjectCreate.userErrors, "metaobjectCreate(newsletter_subscriber)");
  return "new";
}
