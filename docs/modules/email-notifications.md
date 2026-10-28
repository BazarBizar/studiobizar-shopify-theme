# Email notifications

Three parts:

- **Sending** (Settings → Email): which Resend key and sender address the site uses.
- **Routing** (Site-wide → Email notifications): who on the team gets each kind of email.
- **Inbox** (Messages, Subscribers): what visitors send is also kept in the panel.

## Sending — Settings → Email

`/admin/email` (`app/(admin)/admin/email/page.tsx`, `components/admin/email/email-screen.tsx`).

| Field | Notes |
|---|---|
| Resend API key | Starts with `re_`. Stored **sealed** (AES-256-GCM, key derived from `AUTH_SECRET`). Only the last four characters are ever shown again. "Remove" falls back to `RESEND_API_KEY`. |
| Sender name / address | The address must be on a domain verified at Resend → Domains. "Use the test sender" fills in `onboarding@resend.dev`, which only delivers to the Resend account owner. |
| Replies go to | Optional reply-to for every email. Contact form emails always reply to the visitor instead. |

- **Storage:** one json shop metafield, `studio_admin.email_settings`, with no definition (like the staff list). The Storefront API cannot read it.
- **What wins:** the panel value, then `.env` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). When Shopify cannot be reached, `.env` is used so mail keeps going.
- **Cache:** the settings are cached for 30 s. Saving clears the cache on the instance that handled the save.
- **If `AUTH_SECRET` changes,** a saved key can no longer be opened. The screen says so and asks for the key again.
- **Send test** saves pending changes first, then sends one email. A Resend refusal is translated into a sentence and a fix (`explainSendError` in `lib/email/client.ts`), with Resend's own words underneath.
- **Who gets the emails** lists the current recipients. When there are none, the button "Send them all to <me>" creates a `default` rule.
- The dashboard shows "The website is not sending emails yet" with a **Set up email** button until both a key and a sender exist.

Files:

| File | Role |
|---|---|
| `lib/email/settings.ts` | Read, seal/open, resolve |
| `lib/admin/email-settings.ts` | Panel view and save, with `compareDigest` so a concurrent save is not overwritten |
| `app/api/admin/email/route.ts` | `emailSave`, `emailTest` |

### Resend, as found on 2026-10-28

- The key in `.env` is a *sending-only* key restricted to one domain, and that domain is **not verified**. Every send is refused with "The associated domain with your API key is not verified".
- The Resend account belongs to `andri@bazarbizar.asia`. That is the only address the test sender can reach.
- **To make email work:** verify the domain at Resend → Domains (add its DNS records). Then, in Settings → Email, set a sender address on that domain and press **Send test**.

## Inbox — Messages and Subscribers

Created by `scripts/add-inbox-types.mjs` (`yarn setup:inbox`). The script is idempotent and additive, and sets storefront access to `NONE`. Writes happen in `lib/inbox/save.ts`.

| Type | Written by | Fields |
|---|---|---|
| `contact_message` | `POST /api/contact` | name, email, phone, company, topic, message, received_at, status (`new`/`replied`/`closed`), email_status |
| `newsletter_subscriber` | `POST /api/newsletter` | email, subscribed_at, source (page path), status (`subscribed`/`unsubscribed`) |

- **Read-only in the panel** except `status`, like inquiries.
- **Badge:** Messages carries a sidebar badge of how many are still `new`. The dashboard has tiles for both types.
- **Contact:** the team email goes out first, then the message is saved together with `email_status` ("Sent to …" or "Not sent: …"). The visitor is thanked when either step worked, and gets 502 only when both failed.
- **Newsletter:** one entry per address. The handle is `subscriber-<sha256 of the address>`, so the same address in any case is the same entry, and the address never appears in a URL. Signing up again re-subscribes and keeps the first date. A sign-up is confirmed only after it has been stored.

## Checks

- `yarn check:email`: offline. Uses stand-ins for Shopify and Resend to test precedence, sealing, conflicts, the outage fallback, refusal wording and inbox writes.
- `yarn check:email-ui`: against `yarn dev` and the real store.
  - Covers the Email screen, a real newsletter sign-up and contact message, Inbox and the dashboard.
  - It never saves the email settings.
  - It deletes its own entries at the end.
  - The forms' rate limits apply, so run it at most a couple of times a minute.

---

# Routing — who gets the team's copy

Who receives the **staff copy** of each storefront email. Stored in the `email_notification`
metaobject and edited in the panel under **Site-wide → Email notifications**, so changing a recipient
needs no deploy.

The customer's own confirmation email is not affected. It always goes to the address the customer
entered.

## Schema

Created by `scripts/add-email-notifications.mjs` (idempotent, additive only).

| Field | Type | Notes |
|---|---|---|
| `name` (required) | `single_line_text_field` | Display name |
| `notification_type` (required) | `single_line_text_field`, choices | `default`, `product_inquiry`, `contact` |
| `recipients` (required) | `list.single_line_text_field` | Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, enforced by Shopify on save. One per line in the panel. |
| `enabled` (required) | `boolean` | |

Storefront access is **`NONE`**. The site reads this type through the Admin API, and recipient addresses
are not something the storefront token should be able to list.

| Type | Sent by |
|---|---|
| `product_inquiry` | `lib/email/send-inquiry.ts`: the inquiry list (`POST /api/inquiry`) |
| `contact` | `app/api/contact/route.ts`: the Contact page form |
| `default` | Any type without its own entry |

## Routing

`lib/email/notification-recipients.ts` resolves recipients in this order:

1. The entry for the requested type.
2. If there is none, the `default` entry.
3. A **disabled** entry mutes its type. It does **not** fall back to `default`.
4. If there are no entries at all, or Shopify cannot be reached, it falls back to `INQUIRY_NOTIFY_EMAIL`
   (comma-separated). A missing setup or an outage therefore never silently drops a message the old
   configuration would have delivered.

When two entries share a type, the first one wins.

The entries are cached for 60 seconds per process. Saving an entry in the panel clears the cache on
the instance that handled the save (`lib/admin/revalidate.ts`). Other instances pick up the change
within a minute.

Every unsent notification logs its reason, for example
`[contact] message from … was not delivered: email_notification "contact" is disabled.`

## Setup on a store

```sh
node --env-file=.env scripts/add-email-notifications.mjs
# optionally also create the `default` entry:
node --env-file=.env scripts/add-email-notifications.mjs --default-recipient=studio@example.com
```

Without `--default-recipient`, add the `default` entry in the panel. Until one exists, no staff copy is
sent, unless `INQUIRY_NOTIFY_EMAIL` is set.

## Private access

`scripts/set-private-access.mjs` sets storefront access to `NONE` on every type in its `PRIVATE_TYPES`
list (`inquiry`, `email_notification`). `schema-push` now takes an `access` per definition, but it only
applies it when creating a definition. This script is what changes a definition that already exists.
