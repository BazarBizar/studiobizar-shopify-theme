import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { adminFetch } from "@/lib/shopify/admin";

/**
 * HOW THE SITE SENDS EMAIL — set in the panel (Settings → Email), not only in `.env`.
 *
 * Kept on the shop as ONE json metafield in the panel's private namespace with no
 * definition, like the staff list (`lib/admin/staff.ts`): the Admin API token can read
 * it, the Storefront API cannot, and nothing on the site renders it.
 *
 * The Resend API key is stored ENCRYPTED (AES-256-GCM, with a key derived from
 * `AUTH_SECRET`), so the metafield on its own — in a Shopify export, say — does not hand
 * anyone the right to send mail as the shop. The panel never shows it again after it is
 * saved, only its last four characters.
 *
 * WHAT WINS: a value saved in the panel, then the `.env` value (`RESEND_API_KEY`,
 * `RESEND_FROM_EMAIL`), then nothing — and with nothing, `sendEmail` logs and skips
 * (see `client.ts`). When Shopify cannot be reached the `.env` values are used, so an
 * outage there does not stop a customer's confirmation.
 *
 * Read on every send, so it is cached here for 30 seconds; a save through the panel
 * clears the cache at once on the instance that handled it.
 */

export const EMAIL_SETTINGS_NAMESPACE = "studio_admin";
export const EMAIL_SETTINGS_KEY = "email_settings";

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const isEmailAddress = (value: string) => EMAIL.test(value.trim());

const sealedSchema = z.object({ iv: z.string(), tag: z.string(), data: z.string() });

export const storedEmailSettingsSchema = z.object({
  version: z.literal(1),
  fromName: z.string().max(100).default(""),
  fromEmail: z.string().max(200).default(""),
  replyTo: z.string().max(200).default(""),
  apiKey: sealedSchema.nullable().default(null),
  /** The key's last four characters, so the panel can say which key is saved. */
  keyHint: z.string().max(8).nullable().default(null),
  updatedAt: z.string().nullable().default(null),
  updatedBy: z.string().nullable().default(null),
});
export type StoredEmailSettings = z.infer<typeof storedEmailSettingsSchema>;

export const EMPTY_EMAIL_SETTINGS: StoredEmailSettings = {
  version: 1,
  fromName: "",
  fromEmail: "",
  replyTo: "",
  apiKey: null,
  keyHint: null,
  updatedAt: null,
  updatedBy: null,
};

/* -------------------------------------------------------------------------- *
 * The key, sealed
 * -------------------------------------------------------------------------- */

function sealingKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHash("sha256").update(`studio-bizar:email-settings:${secret}`).digest();
}

/** Null when there is no `AUTH_SECRET` to seal with — the caller refuses to store the key then. */
export function sealApiKey(apiKey: string): z.infer<typeof sealedSchema> | null {
  const key = sealingKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
}

/** Null when it cannot be opened — `AUTH_SECRET` changed since it was saved, or it was tampered with. */
export function openApiKey(sealed: z.infer<typeof sealedSchema>): string | null {
  const key = sealingKey();
  if (!key) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
    decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(sealed.data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- *
 * Reading
 * -------------------------------------------------------------------------- */

export const EMAIL_SETTINGS_QUERY = /* GraphQL */ `
  query EmailSettings {
    shop {
      id
      settings: metafield(namespace: "studio_admin", key: "email_settings") {
        value
        compareDigest
      }
    }
  }
`;

export type EmailSettingsState = {
  shopId: string;
  digest: string | null;
  settings: StoredEmailSettings;
};

const CACHE_MS = 30_000;
let cache: { at: number; state: EmailSettingsState } | null = null;

export function clearEmailSettingsCache(): void {
  cache = null;
}

export function parseStoredEmailSettings(value: string | null | undefined): StoredEmailSettings {
  if (!value) return EMPTY_EMAIL_SETTINGS;
  try {
    const parsed = storedEmailSettingsSchema.safeParse(JSON.parse(value));
    if (parsed.success) return parsed.data;
  } catch {
    // Falls through.
  }
  console.error("[email] the saved email settings are unreadable; using the server settings");
  return EMPTY_EMAIL_SETTINGS;
}

/** The saved settings, fresh enough. Throws when Shopify cannot be reached. */
export async function readEmailSettings({ fresh = false } = {}): Promise<EmailSettingsState> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.state;
  const data = await adminFetch<{
    shop: { id: string; settings: { value: string; compareDigest: string } | null };
  }>(EMAIL_SETTINGS_QUERY);
  const state: EmailSettingsState = {
    shopId: data.shop.id,
    digest: data.shop.settings?.compareDigest ?? null,
    settings: parseStoredEmailSettings(data.shop.settings?.value),
  };
  cache = { at: Date.now(), state };
  return state;
}

/* -------------------------------------------------------------------------- *
 * What a send uses
 * -------------------------------------------------------------------------- */

export type EmailConfig = {
  apiKey: string | null;
  /** Where the key came from — for the panel's status line, never the key itself. */
  keySource: "panel" | "server" | null;
  keyHint: string | null;
  /** The saved key exists but cannot be opened (AUTH_SECRET changed). */
  keyUnreadable: boolean;
  fromName: string;
  fromEmail: string;
  /** `"Name <address>"`, ready for Resend; null when no sender address is set. */
  from: string | null;
  fromSource: "panel" | "server" | null;
  replyTo: string | null;
  /** The settings could not be read from Shopify, so the `.env` values are in use. */
  offline: boolean;
};

/** `RESEND_FROM_EMAIL` may already be `Name <address>`. */
function splitFrom(value: string): { name: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value);
  return match ? { name: match[1]!.replace(/^"|"$/g, ""), email: match[2]!.trim() } : { name: "", email: value.trim() };
}

export function formatFrom(name: string, email: string): string {
  const clean = name.replace(/["<>\r\n]/g, "").trim();
  return clean ? `${clean} <${email}>` : email;
}

export function resolveEmailConfig(stored: StoredEmailSettings, offline = false): EmailConfig {
  const opened = stored.apiKey ? openApiKey(stored.apiKey) : null;
  const serverKey = process.env.RESEND_API_KEY?.trim() || null;
  const apiKey = opened ?? serverKey;

  const server = splitFrom(process.env.RESEND_FROM_EMAIL ?? "");
  const panelFrom = isEmailAddress(stored.fromEmail);
  const fromEmail = panelFrom ? stored.fromEmail.trim() : isEmailAddress(server.email) ? server.email : "";
  const fromName = stored.fromName.trim() || (panelFrom ? "" : server.name);

  return {
    apiKey,
    keySource: opened ? "panel" : serverKey ? "server" : null,
    keyHint: opened ? stored.keyHint : serverKey ? serverKey.slice(-4) : null,
    keyUnreadable: Boolean(stored.apiKey && !opened),
    fromName,
    fromEmail,
    from: fromEmail ? formatFrom(fromName, fromEmail) : null,
    fromSource: panelFrom ? "panel" : fromEmail ? "server" : null,
    replyTo: isEmailAddress(stored.replyTo) ? stored.replyTo.trim() : null,
    offline,
  };
}

/** What the next email will be sent with. Never throws. */
export async function emailConfig(): Promise<EmailConfig> {
  try {
    return resolveEmailConfig((await readEmailSettings()).settings);
  } catch (error) {
    console.error("[email] could not read the email settings from Shopify; using the server settings", error);
    return resolveEmailConfig(EMPTY_EMAIL_SETTINGS, true);
  }
}
