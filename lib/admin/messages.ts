import "server-only";

import { cache } from "react";

import { listAllEntries } from "./metaobjects";

/**
 * Contact messages still marked "new" — the sidebar badge on Inbox → Messages and the
 * dashboard tile. Request-memoised, so the two cost one query between them.
 *
 * Like an inquiry, opening a message does NOT change its status: "Replied" says the
 * visitor was answered, which is the team's to say, not something a page view implies.
 */

export const CONTACT_MESSAGE_TYPE = "contact_message";
export const SUBSCRIBER_TYPE = "newsletter_subscriber";

const status = (fields: { key: string; value: string | null }[]) => fields.find((field) => field.key === "status")?.value;

export const countNewMessages = cache(async (): Promise<{ total: number; fresh: number }> => {
  const entries = await listAllEntries(CONTACT_MESSAGE_TYPE).catch(() => []);
  return { total: entries.length, fresh: entries.filter((entry) => status(entry.fields) === "new").length };
});

export const countSubscribers = cache(async (): Promise<number> => {
  const entries = await listAllEntries(SUBSCRIBER_TYPE).catch(() => []);
  return entries.filter((entry) => status(entry.fields) === "subscribed").length;
});
