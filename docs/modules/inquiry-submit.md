# Inquiry Submit

`POST /api/inquiry` — validate, generate a reference, store it on Shopify.

## Files

| File | Role |
|---|---|
| `lib/inquiry/schema.ts` | Zod schema + `generateInquiryId`, shared by client and server |
| `lib/inquiry/submit.ts` | `saveInquiry` — writes the `inquiry` metaobject |
| `lib/shopify/admin.ts` | Admin API client, `server-only` |
| `app/api/inquiry/route.ts` | The route |
| `components/inquiry/inquiry-form.tsx` | `react-hook-form` + the same schema |
| `app/inquiry/success/page.tsx` | Confirmation with the reference |

## One schema, both sides

`inquiryContactSchema` validates the form in the browser; `inquirySubmissionSchema` extends it with
`items` and validates the request on the server. They cannot drift because they are the same file.

Fields, per the brief: `name` (required), `company`, `email` (required), `phone`, `message`.

Note zod v4 — `z.email()` is the top-level form; `z.string().email()` is deprecated.

## Reference format

`INQ-YYYYMMDD-XXXX`, lowercased as the metaobject handle so an inquiry is addressable. The suffix
alphabet omits `I`, `O`, `0` and `1`, so a reference read aloud is unambiguous. 0 collisions in 500
generated.

## Order of operations

1. Parse the body with the shared schema → `400` with the first message plus a per-field list
2. Generate the reference
3. **Store the `inquiry` metaobject via the Admin API — authoritative.** A failure here fails the
   request with `502`, because an inquiry that was never stored must never look sent
4. *(Step 6)* Generate the PDF
5. *(Step 6)* Send both emails via Resend

Steps 4 and 5 attach at the marked point in the route and are wrapped so a failure is logged and the
inquiry still counts as received — the brief's rule that email must not undo the save.

The client only clears the cart **after** a successful response, so a failed submit leaves the
inquiry intact to retry.

## `items` is JSON, not product references

A `list.product_reference` would break or silently change if a product were renamed or deleted. The
inquiry is a record of what was asked for at the time, so each line stores `sku`, `title`,
`variantTitle`, `qty`, `variantId` and `productHandle` as JSON.

## Shopify answers 200 on rejection

Mutations return HTTP 200 with a populated `userErrors`, so `assertNoUserErrors` checks every result
explicitly rather than trusting the status.

## The metaobject definition (S2)

`service` (3 fields) and `inquiry` (11 fields) were added to
`schema-push/src/definitions/metaobjects.js` and pushed. The push is additive and idempotent — the
five pre-existing definitions reported `SKIP`.

| Field | Type |
|---|---|
| `inquiry_id` | single_line_text (required) |
| `submitted_at` | date_time |
| `customer_name` | single_line_text |
| `company` · `phone` | single_line_text (optional) |
| `email` | single_line_text |
| `message` | multi_line_text (optional) |
| `items` | json |
| `total_products` · `total_quantity` | number_integer |
| `status` | single_line_text — `new` / `contacted` / `closed` |

## Verified end to end

A real submission was posted to the running app and read back from Shopify:

```
— inq-20260902-mt2w
   inquiry_id       INQ-20260902-MT2W
   customer_name    Ada Lovelace
   items            2 items: VIVT020N-XL-100×4, BAPI015NBr×12
   total_products   2
   total_quantity   16
   status           new
```

All 11 fields stored correctly, totals derived right. **The test entry was then deleted**, so the
store holds no inquiries.

Rejections also verified: missing body, empty name, invalid email, and an empty cart each return
`400` with the intended message.

`/inquiry` and `/inquiry/success` both carry `<meta name="robots" content="noindex, nofollow">`.

Steps 4 and 5 of the flow — the PDF and the emails — are covered below.

---

# Step 6 — PDF and email

## Files

| File | Role |
|---|---|
| `lib/brand.ts` | Brand constants for contexts that cannot read CSS |
| `lib/pdf/inquiry-pdf.ts` | The "Product Inquiry" PDF |
| `lib/email/client.ts` | Resend wrapper that degrades when unconfigured |
| `lib/email/templates/inquiry-email.tsx` | One `@react-email` layout, two audiences |
| `lib/email/send-inquiry.ts` | Builds the PDF, renders both messages, sends them |
| `scripts/check-inquiry-pdf.ts` | `yarn check:pdf` |

## What changed from the reference generator

`inquiry-pdf.ts` has been moved out of the repo root into `lib/pdf/` and stripped of everything
price-shaped, per the brief:

- **Columns are now SKU | Product | Variant | Qty.** `Unit Price` and `Subtotal` are gone and the
  freed 115pt went to Product and SKU: `100 + 220 + 115.28 + 60 = 495.28`, exactly `CONTENT_WIDTH`.
- **Totals are counts only** — Total Products and Total Quantity. No grand total, no order
  discounts, no "Price on inquiry" footnote.
- **Types dropped**: `unitPrice`, `lineTotal`, `discountLabel`, `grandTotal`, `orderDiscounts`,
  `customerCategory`. With them went the imports of `formatPrice`, `computeInquiryTotals`,
  `itemSubtotal` and `@/components/price`, none of which exist in this project.
- **Kept**: A4, real vector text in standard fonts (no embedding, ~10KB), the table header repeating
  on every page, zebra rows, and `Page X of Y` written last once the count is known.
- The customer's free-text message is appended after the totals.
- Footer reads *"Studio Bizar — this is an inquiry, not an order confirmation."*

`tsconfig.json` no longer excludes the file, and the root copy has been deleted.

## Colours

`lib/brand.ts` mirrors the palette from `globals.css`. Six values are the measured `[figma]` hexes;
`muted`, `border`, `headerBg` and `zebra` are marked `[derived]` — pdf-lib needs a table rule and an
alternating row, and neither exists in the designs. They are mixes of the measured colours, not new
brand colours. **If a palette token changes in globals.css, change it here too.**

## A bug worth remembering

`wrapText` measured **raw** text, and pdf-lib's `widthOfTextAtSize` throws on any character the
standard fonts cannot encode. A customer message containing CJK, an emoji, or a mojibake byte took
the whole PDF down — caught in a live submission with
`WinAnsi cannot encode "\uFFFD"`.

Sanitising happens before measuring now. Unrepresentable characters are dropped from the PDF; the
email still carries the full UTF-8 text, so nothing is lost overall.

## Graceful degradation

`sendEmail` returns `{ skipped: true, reason }` rather than throwing when `RESEND_API_KEY` or
`RESEND_FROM_EMAIL` is absent — it logs what it would have sent and reports success, so development
runs without credentials. `INQUIRY_NOTIFY_EMAIL` behaves the same way for the internal copy.

The distinction matters: callers can tell "delivered" from "no provider configured", which a bare
boolean would hide.

Everything below the Shopify write is wrapped so it can only log:

```
saveInquiry()            ← authoritative; failure ⇒ 502
  └ sendInquiryEmails()  ← PDF + 2 emails; failure ⇒ logged, request still 200
```

A PDF failure does not stop the emails either — they carry the same table inline.

## Verification

`yarn check:pdf` — 24 assertions:

- 60 items paginate to 3 pages with the header repeated on each
- Column set is SKU/Product/Variant/Qty; widths sum to exactly `CONTENT_WIDTH`
- Total Products and Total Quantity present; no Grand Total
- None of `Unit Price`, `Subtotal`, `Grand Total`, `Pricing Category`, `€`, `$`,
  `Price on inquiry` appear anywhere in the file
- Smart quotes survive; CJK + emoji + `U+FFFD` do not throw
- Email renders, shows the reference, lists products, states it is not an order, no currency

Live, against the running app: a submission with a CJK + emoji message returned an inquiry ID,
stored on Shopify, and logged exactly two warnings — `RESEND_API_KEY is not set` and
`INQUIRY_NOTIFY_EMAIL is not set`. **Both test entries were then deleted**; the store holds no
inquiries.

`yarn check:price` now scans `lib`, `app`, `components` and `store` — widened from `lib/shopify` so
the PDF and email code is covered too.

## Still open

- **Nothing has actually been emailed.** The path is exercised only in its skipped branch, because
  no Resend key exists. Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `INQUIRY_NOTIFY_EMAIL` in
  `.env` (the keys are there, empty) and re-run a submission to confirm delivery and the attachment.
- **No logo in the PDF.** `doc.embedPng()` would take one; `public/brand/mark.svg` is vector, so it
  needs rasterising first.
- Seed 10 dummy inquiries (S3).
