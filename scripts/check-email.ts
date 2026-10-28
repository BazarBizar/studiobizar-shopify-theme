/**
 * Settings → Email (lib/email/settings.ts, lib/admin/email-settings.ts), the send path
 * (lib/email/client.ts) and the inbox writes (lib/inbox/save.ts), checked against
 * stand-ins for Shopify's Admin API and for Resend — nothing is sent to the store, and
 * no email leaves.
 *
 *   yarn check:email
 */

import Module from "node:module";

// `lib/admin/shopify.ts` re-throws Next's control-flow errors with `next/navigation`,
// which only loads inside Next. Outside it there is nothing to re-throw.
const load = (Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown })._load;
(Module as unknown as { _load: typeof load })._load = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request === "next/navigation") return { unstable_rethrow: () => undefined };
  return load.call(this, request, ...rest);
};

process.env.SHOPIFY_STORE_DOMAIN = "email-check.myshopify.com";
process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN = "shpat_email_check";
process.env.SHOPIFY_API_VERSION = "2026-07";
process.env.ADMIN_ALLOWED_EMAILS = "owner@example.com";
process.env.ADMIN_PASSWORD_HASH = "scrypt:unused";
process.env.AUTH_SECRET = "a-test-secret-that-is-long-enough-for-the-check-1234567890";
process.env.RESEND_API_KEY = "";
process.env.RESEND_FROM_EMAIL = "";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures += 1;
}

/* The stand-ins: one shop metafield with compareDigest, a few metaobjects, and Resend. */
let stored: { value: string; digest: string } | null = null;
let writes = 0;
let staleNext = false;
let shopifyDown = false;
const entries = new Map<string, { id: string; type: string; fields: Map<string, string> }>();
let resendReply: { status: number; body: unknown } = { status: 200, body: { id: "email_1" } };
const sent: { key: string; body: Record<string, unknown> }[] = [];

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("api.resend.com")) {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const raw = init?.body ?? (input instanceof Request ? await input.text() : "{}");
    sent.push({ key: (headers.get("authorization") ?? "").replace("Bearer ", ""), body: JSON.parse(String(raw)) });
    return Response.json(resendReply.body, { status: resendReply.status });
  }
  if (!url.includes("email-check.myshopify.com")) return realFetch(input, init);
  if (shopifyDown) throw new TypeError("fetch failed");

  const body = JSON.parse(String(init?.body)) as { query: string; variables?: Record<string, unknown> };
  const q = body.query;
  if (q.includes("AdminEmailSettingsSet")) {
    const [field] = (body.variables!.metafields as { value: string; compareDigest: string | null }[])!;
    if (staleNext || (field!.compareDigest ?? null) !== (stored?.digest ?? null)) {
      staleNext = false;
      return Response.json({ data: { metafieldsSet: { metafields: [], userErrors: [{ field: ["metafields"], message: "stale", code: "STALE_OBJECT" }] } } });
    }
    writes += 1;
    stored = { value: field!.value, digest: `d${writes}` };
    return Response.json({ data: { metafieldsSet: { metafields: [{ key: "email_settings" }], userErrors: [] } } });
  }
  if (q.includes("EmailSettings")) {
    return Response.json({
      data: { shop: { id: "gid://shopify/Shop/1", settings: stored ? { value: stored.value, compareDigest: stored.digest } : null } },
    });
  }
  if (q.includes("FindSubscriber")) {
    const handle = (body.variables!.handle as { handle: string }).handle;
    const entry = entries.get(handle);
    return Response.json({
      data: { metaobjectByHandle: entry ? { id: entry.id, status: { value: entry.fields.get("status") ?? null } } : null },
    });
  }
  if (q.includes("InboxCreate")) {
    const input = body.variables!.metaobject as { type: string; handle?: string; fields: { key: string; value: string }[] };
    const handle = input.handle ?? `${input.type}-${entries.size + 1}`;
    if (entries.has(handle)) {
      return Response.json({ data: { metaobjectCreate: { metaobject: null, userErrors: [{ field: ["metaobject", "handle"], message: "Handle has already been taken" }] } } });
    }
    const id = `gid://shopify/Metaobject/${entries.size + 1}`;
    entries.set(handle, { id, type: input.type, fields: new Map(input.fields.map((field) => [field.key, field.value])) });
    return Response.json({ data: { metaobjectCreate: { metaobject: { id }, userErrors: [] } } });
  }
  if (q.includes("SubscriberUpdate")) {
    const id = body.variables!.id as string;
    const entry = [...entries.values()].find((candidate) => candidate.id === id)!;
    for (const field of (body.variables!.metaobject as { fields: { key: string; value: string }[] }).fields) {
      entry.fields.set(field.key, field.value);
    }
    return Response.json({ data: { metaobjectUpdate: { metaobject: { id }, userErrors: [] } } });
  }
  throw new Error(`unexpected query: ${q.slice(0, 80)}`);
}) as typeof fetch;

async function main() {
  const settings = await import("../lib/email/settings");
  const admin = await import("../lib/admin/email-settings");
  const { sendEmail, explainSendError } = await import("../lib/email/client");
  const inbox = await import("../lib/inbox/save");

  const throws = async (run: () => Promise<unknown>, code: string) => {
    try {
      await run();
      return false;
    } catch (error) {
      return (error as { code?: string }).code === code;
    }
  };
  const fresh = async () => {
    settings.clearEmailSettingsCache();
    return settings.emailConfig();
  };
  const message = { to: "someone@example.com", subject: "Hello", html: "<p>Hi</p>" };

  /* Nothing set anywhere */
  let config = await fresh();
  check("nothing set: not ready, and nothing is claimed", !config.apiKey && !config.from && config.keySource === null);
  check("nothing set: a send is skipped, not failed", (await sendEmail(message)).skipped === true && sent.length === 0);

  /* The server's settings, as before */
  process.env.RESEND_API_KEY = "re_serverkey_1234";
  process.env.RESEND_FROM_EMAIL = "Studio <studio@example.com>";
  config = await fresh();
  check(
    "server settings are used when nothing is saved in the panel",
    config.apiKey === "re_serverkey_1234" && config.from === "Studio <studio@example.com>" && config.keySource === "server" && config.fromSource === "server",
    config,
  );

  /* Saved in the panel */
  const panelKey = "re_PanelKey_abcdEFGH";
  await admin.saveEmailSettings(
    { fromName: "Studio Bizar", fromEmail: "hello@studiobizar.example", replyTo: "team@studiobizar.example", apiKey: panelKey },
    "owner@example.com",
  );
  check("the key is stored sealed, never as written", !stored!.value.includes(panelKey) && stored!.value.includes('"iv"'));
  config = await fresh();
  check(
    "panel settings win over the server's",
    config.apiKey === panelKey &&
      config.keySource === "panel" &&
      config.keyHint === "EFGH" &&
      config.from === "Studio Bizar <hello@studiobizar.example>" &&
      config.replyTo === "team@studiobizar.example",
    config,
  );
  const view = await admin.emailSettingsView();
  check("the panel's view carries the key's last four characters only", !JSON.stringify(view).includes(panelKey) && view.key.hint === "EFGH" && view.ready);

  const result = await sendEmail(message);
  check(
    "a send uses the panel's key, sender and reply-to",
    result.ok && !result.skipped && sent.at(-1)!.key === panelKey && sent.at(-1)!.body.from === "Studio Bizar <hello@studiobizar.example>" &&
      ((sent.at(-1)!.body.reply_to ?? sent.at(-1)!.body.replyTo) as unknown as string[] | string)?.toString() === "team@studiobizar.example",
    sent.at(-1),
  );
  await sendEmail({ ...message, replyTo: "visitor@example.com" });
  check(
    "a reply-to given by the caller (the visitor, on a contact message) wins",
    ((sent.at(-1)!.body.reply_to ?? sent.at(-1)!.body.replyTo) as unknown as string[] | string)?.toString() === "visitor@example.com",
    sent.at(-1),
  );

  /* Keeping, replacing and removing the key */
  await admin.saveEmailSettings({ fromName: "Studio Bizar", fromEmail: "hello@studiobizar.example", replyTo: "" }, "owner@example.com");
  config = await fresh();
  check("saving without a key keeps the saved one", config.apiKey === panelKey && config.replyTo === null);
  await admin.saveEmailSettings({ fromName: "", fromEmail: "", replyTo: "", removeKey: true }, "owner@example.com");
  config = await fresh();
  check("removing the key, and clearing the sender, falls back to the server's", config.keySource === "server" && config.fromSource === "server", config);

  /* AUTH_SECRET changed since the key was saved */
  await admin.saveEmailSettings({ fromName: "", fromEmail: "", replyTo: "", apiKey: panelKey }, "owner@example.com");
  const secret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "a-different-secret-that-is-also-long-enough-0987654321";
  config = await fresh();
  check("a key sealed with another secret is reported unreadable, and the server's key is used", config.keyUnreadable && config.apiKey === "re_serverkey_1234", config);
  process.env.AUTH_SECRET = secret;

  /* Conflicts, bad data, an outage */
  staleNext = true;
  check(
    "a change saved elsewhere in between is not overwritten",
    await throws(() => admin.saveEmailSettings({ fromName: "x", fromEmail: "", replyTo: "" }, "owner@example.com"), "CONFLICT"),
  );
  stored = { value: "not json", digest: "broken" };
  config = await fresh();
  check("unreadable saved settings fall back to the server's", config.keySource === "server" && config.fromSource === "server");
  shopifyDown = true;
  config = await fresh();
  check("Shopify unreachable: the server's settings, so email keeps going", config.offline && config.apiKey === "re_serverkey_1234");
  shopifyDown = false;

  /* What the panel accepts */
  const parse = (input: Record<string, unknown>) => admin.emailSettingsInput.safeParse({ fromName: "", fromEmail: "", replyTo: "", ...input }).success;
  check("input: a Resend key is accepted", parse({ apiKey: "re_abc123def456" }));
  check("input: anything else as a key is refused", !parse({ apiKey: "sk_live_123456789" }) && !parse({ apiKey: "re_" }));
  check("input: a sender that is not an address is refused", !parse({ fromEmail: "studio bizar" }));
  check("input: empty sender and reply-to are allowed (use the server's)", parse({}));

  /* Resend's refusals, in words — the three below are what Resend actually answers */
  const wrongDomain = explainSendError("The associated domain with your API key is not verified. Please, create a new API key with full access or with a verified domain.");
  check("refusal: a key tied to an unverified domain says to verify it", wrongDomain.title.includes("not verified") && wrongDomain.link === "https://resend.com/domains");
  const testSender = explainSendError(
    "You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain.",
  );
  check("refusal: the test sender names the one address it can reach", testSender.title.includes("test sender") && testSender.fix.includes("owner@example.com"));
  check("refusal: an unverified sender domain", explainSendError("The example.com domain is not verified. Please, add and verify your domain on https://resend.com/domains").title.includes("not allowed"));
  check("refusal: a bad key", explainSendError("API key is invalid").link === "https://resend.com/api-keys");

  stored = null;
  await admin.saveEmailSettings({ fromName: "", fromEmail: "hello@studiobizar.example", replyTo: "", apiKey: panelKey }, "owner@example.com");
  settings.clearEmailSettingsCache();
  resendReply = { status: 403, body: { name: "validation_error", message: "The associated domain with your API key is not verified.", statusCode: 403 } };
  const refused = await sendEmail(message);
  check("a refused send is reported as failed, with Resend's reason", !refused.ok && refused.error.includes("not verified"), refused);
  resendReply = { status: 200, body: { id: "email_2" } };

  /* The inbox */
  const first = await inbox.subscribeToNewsletter("Reader@Example.com", "/");
  const again = await inbox.subscribeToNewsletter("reader@example.com ", "/about");
  const subscriber = entries.get(inbox.subscriberHandle("reader@example.com"))!;
  check("newsletter: one entry per address, whatever its case", first === "new" && again === "again" && [...entries.values()].filter((entry) => entry.type === "newsletter_subscriber").length === 1);
  check("newsletter: the address is stored lower case, with where it was sent from", subscriber.fields.get("email") === "reader@example.com" && subscriber.fields.get("source") === "/");
  check("newsletter: the address is not in the handle", !inbox.subscriberHandle("reader@example.com").includes("reader"));
  subscriber.fields.set("status", "unsubscribed");
  await inbox.subscribeToNewsletter("reader@example.com", "/");
  check("newsletter: someone who left and signs up again is subscribed again", subscriber.fields.get("status") === "subscribed");

  await inbox.saveContactMessage({
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+32 1",
    company: "",
    topic: "General",
    message: "Hello\nthere",
    receivedAt: new Date("2026-10-28T10:00:00Z"),
    emailStatus: "Sent to team@example.com",
  });
  const saved = [...entries.values()].find((entry) => entry.type === "contact_message")!;
  check(
    "contact: the message is kept as sent, marked new, with what happened to the email",
    saved.fields.get("message") === "Hello\nthere" && saved.fields.get("status") === "new" && saved.fields.get("email_status") === "Sent to team@example.com",
  );
}

main()
  .then(() => {
    console.log(failures ? `\n${failures} email check(s) failed.` : "\nAll email checks passed.");
    process.exit(failures ? 1 : 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
