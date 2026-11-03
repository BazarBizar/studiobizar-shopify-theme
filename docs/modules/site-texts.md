# Site texts

Admin: **Settings → Site texts** (`/admin/site-texts`). The wording that used to be written into
the code: headings on product, collection and project pages, the inquiry and contact forms, the
page after sending an inquiry, the 404, and the inquiry emails.

Also the **form messages**: what the inquiry, contact and newsletter forms say when a field needs
fixing or sending fails, and the newsletter's own words.

Not here, because it is edited elsewhere: a page's own text (Pages), a product's name, description
and details (Products), the names of the facts and fold-out panels on product pages (Content →
Product details), header and footer (Appearance), menus (Menus), the contact form's "Type of
inquiry" choices (the Contact page).

## What an editor can do

- **Find a text** by typing the words they see on the site (accents and curly quotes ignored).
- Each field shows the words the site uses now; change them and Save.
- **Back to original** per text; an emptied field also falls back to the original.
- Texts with a customer's name, the inquiry reference, the website name or a quantity offer
  buttons that insert `{name}`, `{reference}`, `{brand}`, `{quantity}`. Removing one warns what
  will no longer be shown.
- **See it on the site** per group.

## How it is kept

| | |
|---|---|
| List | `SITE_TEXT_GROUPS` in `lib/site-texts.ts`: key, where it appears, original wording, placeholders |
| Where | Shop metafield `custom.site_texts`, json `{ version: 1, texts: { key: text }, savedAt, savedBy }` — **only changed texts** |
| Originals | Anything not stored is the `value` in the list, so improving an original reaches every site that never changed it |
| Definition | Created by the first save if missing (`PUBLIC_READ`); also in `schema-push` |
| Conflicts | `compareDigest`, as Shop categories (`lib/admin/shop-json.ts`) |
| Storefront | `getSiteTexts()` (cached under `content`); Server Components call it, Client Components read `useSiteTexts()` from the provider in `app/(storefront)/layout.tsx` |
| Emails | `sendInquiryEmails` reads the same texts; without Shopify the originals are sent |

Next only. The Liquid theme's own wording is Shopify's **Edit default theme content**.

## Adding a text

1. Add it to a group in `lib/site-texts.ts` (`where` in the editor's words, `value` = current wording).
2. Use `texts["your.key"]` where it is drawn.
3. `yarn check:site-texts` fails if a key is not used anywhere, so a field that changes nothing
   cannot ship.

## Checks

- `yarn check:site-texts` — logic, and that every text is used.
- `CHECK_BASE_URL=http://localhost:3000 yarn check:site-texts --ui` — the screen and the storefront
  pages in Chromium. Never saves.
