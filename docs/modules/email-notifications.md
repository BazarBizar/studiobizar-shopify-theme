# Email notifications

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
