import "server-only";

import { z } from "zod";

import {
  clearEmailSettingsCache,
  EMAIL_SETTINGS_KEY,
  EMAIL_SETTINGS_NAMESPACE,
  isEmailAddress,
  parseStoredEmailSettings,
  resolveEmailConfig,
  sealApiKey,
  type StoredEmailSettings,
} from "@/lib/email/settings";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * The panel's side of `lib/email/settings.ts`: what the Email screen shows (never the
 * key itself) and the one write. Reads here go through the panel's allowlisted client,
 * fresh, so the screen always shows what is saved now.
 */

export class EmailSettingsError extends Error {
  readonly code: "CONFLICT" | "INVALID";
  constructor(code: EmailSettingsError["code"], message: string) {
    super(message);
    this.name = "EmailSettingsError";
    this.code = code;
  }
}

async function readState() {
  const data = await adminGraphQL<{
    shop: { id: string; settings: { value: string; compareDigest: string } | null };
  }>("emailSettings", OPERATIONS.emailSettings.document, {});
  return {
    shopId: data.shop.id,
    digest: data.shop.settings?.compareDigest ?? null,
    settings: parseStoredEmailSettings(data.shop.settings?.value),
  };
}

export type EmailSettingsView = {
  /** As saved in the panel — empty means "use the server's". */
  fromName: string;
  fromEmail: string;
  replyTo: string;
  /** What is actually in use, wherever it came from. */
  effective: { from: string | null; fromSource: "panel" | "server" | null; replyTo: string | null };
  key: { source: "panel" | "server" | null; hint: string | null; unreadable: boolean };
  /** A key can be saved here only when the server has an AUTH_SECRET to seal it with. */
  canStoreKey: boolean;
  ready: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function emailSettingsView(): Promise<EmailSettingsView> {
  const { settings } = await readState();
  const config = resolveEmailConfig(settings);
  return {
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyTo: settings.replyTo,
    effective: { from: config.from, fromSource: config.fromSource, replyTo: config.replyTo },
    key: { source: config.keySource, hint: config.keyHint, unreadable: config.keyUnreadable },
    canStoreKey: Boolean(sealApiKey("probe")),
    ready: Boolean(config.apiKey && config.from),
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  };
}

const optionalEmail = (message: string) =>
  z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === "" || isEmailAddress(value), message);

export const emailSettingsInput = z.strictObject({
  fromName: z.string().trim().max(100),
  fromEmail: optionalEmail("The sender address is not an email address."),
  replyTo: optionalEmail("The reply-to address is not an email address."),
  /** Absent: keep the saved key. A string: replace it. */
  apiKey: z
    .string()
    .trim()
    .max(200)
    .refine((value) => /^re_[A-Za-z0-9_-]{8,}$/.test(value), "That does not look like a Resend API key — it starts with re_.")
    .optional(),
  /** Forget the saved key, so the server's key (if any) is used again. */
  removeKey: z.boolean().optional(),
});
export type EmailSettingsInput = z.infer<typeof emailSettingsInput>;

export async function saveEmailSettings(input: EmailSettingsInput, actor: string): Promise<void> {
  const state = await readState();

  let apiKey: StoredEmailSettings["apiKey"] = state.settings.apiKey;
  let keyHint = state.settings.keyHint;
  if (input.removeKey) {
    apiKey = null;
    keyHint = null;
  }
  if (input.apiKey) {
    const sealed = sealApiKey(input.apiKey);
    if (!sealed) {
      throw new EmailSettingsError("INVALID", "The server cannot store a key safely (AUTH_SECRET is missing). Ask your developer.");
    }
    apiKey = sealed;
    keyHint = input.apiKey.slice(-4);
  }

  const next: StoredEmailSettings = {
    version: 1,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    replyTo: input.replyTo,
    apiKey,
    keyHint,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };

  const data = await adminGraphQL<{
    metafieldsSet: { userErrors: { field?: string[] | null; message: string; code?: string | null }[] };
  }>("emailSettingsSet", OPERATIONS.emailSettingsSet.document, {
    metafields: [
      {
        ownerId: state.shopId,
        namespace: EMAIL_SETTINGS_NAMESPACE,
        key: EMAIL_SETTINGS_KEY,
        type: "json",
        value: JSON.stringify(next),
        // Refused when someone else saved since this was read — no lost update.
        compareDigest: state.digest,
      },
    ],
  });
  clearEmailSettingsCache();
  if (data.metafieldsSet.userErrors.some((error) => error.code === "STALE_OBJECT")) {
    throw new EmailSettingsError("CONFLICT", "Someone else changed these settings just now. Reload the page and try again.");
  }
  assertNoUserErrors(data.metafieldsSet.userErrors);
}
