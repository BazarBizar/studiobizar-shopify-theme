/**
 * Settings → Email and the inbox, in a real browser against `yarn dev` and the real
 * store:
 *
 *   - the Email screen says what is missing, refuses a key that is not one, and a test
 *     with nothing set up answers with the fix instead of a dead end;
 *   - a newsletter sign-up and a Contact page message are KEPT, and show up under Inbox
 *     (Subscribers, Messages — with a badge) and on the dashboard.
 *
 * It never saves the email settings (the store's stay as they are) and no email leaves
 * unless the store's settings would already send one. The two test entries it creates
 * are deleted at the end, whatever happened.
 *
 *   yarn dev            # in another terminal
 *   yarn check:email-ui
 *
 * The forms' own rate limits apply (lib/public-form.ts): run it at most a couple of
 * times a minute.
 */

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { encode } from "next-auth/jwt";
import { chromium, type Page } from "playwright";

import { STAFF_COOKIE } from "../lib/admin/cookie";

const ROOT = resolve(__dirname, "..");
const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const SHOTS = join(tmpdir(), "email-ui");

for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const key = line.slice(0, line.indexOf("=")).trim();
  let value = line.slice(line.indexOf("=") + 1).trim();
  if (/^".*"$/.test(value)) value = value.slice(1, -1);
  process.env[key] ??= value;
}
{
  const require = createRequire(resolve(ROOT, "package.json"));
  const resolved = require.resolve("next/navigation");
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { unstable_rethrow: () => {} } } as never;
}

let failures = 0;
function check(label: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && extra !== undefined ? `  → ${String(extra).slice(0, 240)}` : ""}`);
  if (!ok) failures += 1;
}

async function staffSession() {
  const email = process.env.ADMIN_ALLOWED_EMAILS?.split(",")[0]?.trim().toLowerCase();
  const secret = process.env.AUTH_SECRET;
  if (!email || !secret) throw new Error("ADMIN_ALLOWED_EMAILS and AUTH_SECRET must be set in .env.");
  return { email, token: await encode({ token: { email, sub: email }, secret, salt: STAFF_COOKIE, maxAge: 60 * 60 }) };
}

/** The Admin API, retried: a definition created minutes ago is sometimes answered with an empty 500. */
async function admin<T>(query: string, variables?: Record<string, unknown>, attempt = 0): Promise<T> {
  const response = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${process.env.SHOPIFY_API_VERSION ?? "2026-07"}/graphql.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN! },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (response.status >= 500 && attempt < 4) {
    await new Promise((done) => setTimeout(done, 1000 * (attempt + 1)));
    return admin<T>(query, variables, attempt + 1);
  }
  const body = (await response.json()) as { data: T; errors?: unknown };
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

/** Every entry of `type` whose `field` equals `value` — the test's own, to delete. */
async function findEntries(type: string, field: string, value: string): Promise<string[]> {
  const data = await admin<{ metaobjects: { nodes: { id: string; fields: { key: string; value: string | null }[] }[] } }>(
    `query($type: String!) { metaobjects(type: $type, first: 250) { nodes { id fields { key value } } } }`,
    { type },
  );
  return data.metaobjects.nodes
    .filter((node) => node.fields.find((candidate) => candidate.key === field)?.value === value)
    .map((node) => node.id);
}

async function main() {
  const { hostname } = new URL(BASE);
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    console.error(`✗ ${BASE} is not a local server. This check only runs against \`yarn dev\` on localhost.`);
    process.exit(1);
  }
  if (!(await fetch(BASE).then(() => true).catch(() => false))) {
    console.error(`✗ No dev server at ${BASE}. Start one with \`yarn dev\` (or set CHECK_BASE_URL).`);
    process.exit(1);
  }
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const stamp = Date.now().toString(36);
  const subscriberEmail = `email-check-${stamp}@example.com`;
  const contactEmail = `email-check-contact-${stamp}@example.com`;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const session = await staffSession();
  await context.addCookies([{ name: STAFF_COOKIE, value: session.token, domain: hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page: Page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  let testedBeforeSetup = false;
  const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true, caret: "initial" });

  async function step(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (error) {
      check(label, false, (error as Error).message.split("\n")[0]);
      await shot(`fail-${label.replace(/[^a-z0-9]+/gi, "-")}`).catch(() => undefined);
    }
  }

  try {
    /* The Email screen */
    await step("Email screen", async () => {
      await page.goto(`${BASE}/admin/email`);
      await page.getByRole("heading", { name: "Email", exact: true }).waitFor({ timeout: 90000 });
      const ready = (await page.getByText("Email is set up").count()) > 0;
      const notReady = (await page.getByText("The website is not sending emails yet").count()) > 0;
      check("Email screen: says plainly whether email is set up", ready !== notReady);
      check("Email screen: the sidebar has an Email row", (await page.locator("a[href='/admin/email']").count()) > 0);
      check("Email screen: shows who gets contact messages and inquiries", (await page.getByText("Contact form messages").count()) > 0 && (await page.getByText("Product inquiries").count()) > 0);
      await shot("01-email-screen");

      await page.getByLabel("Resend API key").fill("not-a-key");
      check(
        "Email screen: a key that is not a Resend key is refused before saving",
        (await page.getByText("does not look like a Resend key").count()) > 0 && (await page.getByRole("button", { name: "Save" }).isDisabled()),
      );
      await page.getByLabel("Resend API key").fill("");
      await page.getByLabel("Sender address").fill("studio bizar");
      check("Email screen: a sender that is not an address is refused", (await page.getByText("That is not an email address.").count()) > 0);
      await page.getByLabel("Sender address").fill("");

      if (notReady) {
        // Nothing is saved (the form is untouched), so this is the store's own state.
        testedBeforeSetup = true;
        await page.getByRole("button", { name: "Send test" }).click();
        const alert = page.getByRole("alert").filter({ hasText: "not set up yet" });
        await alert.waitFor({ timeout: 20000 });
        check("Email screen: a test before setup says what to fill in, not just that it failed", /Paste|Fill in/.test(await alert.innerText()));
        await shot("02-test-not-set-up");
      }
    });

    /* Newsletter: kept, one per address */
    await step("Newsletter sign-up", async () => {
      const first = await page.request.post(`${BASE}/api/newsletter`, { data: { email: subscriberEmail }, headers: { referer: `${BASE}/` } });
      if (first.status() === 429) throw new Error("the sign-up form's rate limit is spent — wait a minute and run again");
      const again = await page.request.post(`${BASE}/api/newsletter`, { data: { email: subscriberEmail.toUpperCase() } });
      check("Newsletter: a sign-up is stored and thanked", first.ok() && /on the list/.test(((await first.json()) as { message: string }).message));
      check("Newsletter: signing up again says so, and stays one entry", again.ok() && /already/.test(((await again.json()) as { message: string }).message));
      check("Newsletter: one entry in the store", (await findEntries("newsletter_subscriber", "email", subscriberEmail)).length === 1);
      await page.goto(`${BASE}/admin/newsletter_subscriber`);
      await page.getByText(subscriberEmail).first().waitFor({ timeout: 90000 });
      check("Newsletter: the subscriber shows under Inbox → Subscribers", true);
      await shot("03-subscribers");
    });

    /* Contact: kept, with what happened to the email */
    await step("Contact message", async () => {
      const response = await page.request.post(`${BASE}/api/contact`, {
        data: {
          firstName: "Email",
          lastName: `Check ${stamp}`,
          email: contactEmail,
          phone: "+32 000 00 00",
          company: "",
          inquiryType: "General",
          message: "A message sent by the automated email check. It is deleted again at the end.",
        },
      });
      if (response.status() === 429) throw new Error("the contact form's rate limit is spent — wait a minute and run again");
      check("Contact: the message is accepted", response.ok(), await response.text());
      check("Contact: one entry in the store", (await findEntries("contact_message", "email", contactEmail)).length === 1);
      await page.goto(`${BASE}/admin/contact_message`);
      const row = page.getByText(`Email Check ${stamp}`).first();
      await row.waitFor({ timeout: 90000 });
      check("Contact: the message shows under Inbox → Messages", true);
      const badge = await page.locator("a[href='/admin/contact_message']").first().innerText();
      check("Contact: the sidebar shows how many are new", /\d/.test(badge), badge);
      await shot("04-messages");
      await row.click();
      await page.getByText("A message sent by the automated email check").first().waitFor({ timeout: 90000 });
      check("Contact: the message opens, with the visitor's words", true);
      check(
        "Contact: it says whether the team was emailed",
        /^(Sent to|Not sent)/.test(await page.getByLabel("Email to the team").inputValue()),
      );
      await shot("05-message");
    });

    /* Dashboard */
    await step("Dashboard", async () => {
      await page.goto(`${BASE}/admin`);
      await page.locator("a[href='/admin/contact_message']").filter({ hasText: "Messages" }).last().waitFor({ timeout: 90000 });
      check("Dashboard: Messages and Subscribers tiles", (await page.locator("a[href='/admin/newsletter_subscriber']").count()) > 0);
      await shot("06-dashboard");
      const setUp = page.getByRole("link", { name: "Set up email" });
      if (await setUp.count()) {
        await setUp.click();
        await page.waitForURL(/\/admin\/email$/, { timeout: 90000 });
        check("Dashboard: “Set up email” leads to the Email screen", true);
      }
    });

    // The dev server's own websocket is refused by the admin CSP — in development only.
    // A 422 is the test-before-setup above, which is answered that way on purpose.
    const real = [
      ...new Set(
        consoleErrors.filter(
          (error) => !/ws:\/\/(127\.0\.0\.1|localhost)/.test(error) && !/favicon/.test(error) && !(testedBeforeSetup && /status of 422/.test(error)),
        ),
      ),
    ];
    check(`no console errors from the app (${real.length})`, real.length === 0, real.slice(0, 3).join(" | "));
  } finally {
    // Whatever happened above: the test's entries go.
    const ids = [
      ...(await findEntries("newsletter_subscriber", "email", subscriberEmail).catch(() => [])),
      ...(await findEntries("contact_message", "email", contactEmail).catch(() => [])),
    ];
    for (const id of ids) {
      await admin(`mutation($id: ID!) { metaobjectDelete(id: $id) { deletedId userErrors { message } } }`, { id });
    }
    const left = [
      ...(await findEntries("newsletter_subscriber", "email", subscriberEmail)),
      ...(await findEntries("contact_message", "email", contactEmail)),
    ];
    check(`cleanup: the ${ids.length} test entries are deleted`, left.length === 0);
    await browser.close();
  }

  console.log(`\nScreenshots: ${SHOTS}`);
  console.log(failures ? `\n${failures} email UI check(s) failed.` : "\nAll email UI checks passed.");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
