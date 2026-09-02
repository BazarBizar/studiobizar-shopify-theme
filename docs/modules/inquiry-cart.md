# Inquiry Cart

The client-side list a visitor builds before submitting. Deliberately **not** the Shopify Cart API —
this storefront has no checkout.

## Files

| File | Role |
|---|---|
| `store/inquiry-cart.ts` | Zustand + `persist` to `localStorage` |
| `store/ui.ts` | Drawer open/closed — ephemeral, never persisted |
| `components/inquiry/inquiry-drawer.tsx` | Slides in from the header bag |
| `components/inquiry/inquiry-list.tsx` | The line items on `/inquiry` |
| `components/inquiry/inquiry-review.tsx` | Composes list + form |
| `components/product/add-to-inquiry.tsx` | Qty stepper + `enquire` on the PDP |
| `components/layout/header-actions.tsx` | Bag icon + badge |

## Item shape

Exactly the fields the brief specifies, so the PDF and the metaobject can be built from the cart
alone without re-fetching:

```ts
{ variantId, productHandle, sku, title, variantTitle, qty, image }
```

## Two things that are easy to get wrong

**The hydration flag.** The server cannot know what is in `localStorage`, so the badge and the list
render a neutral state until rehydration finishes. It is set through `set()` inside
`onRehydrateStorage` — mutating the draft there changes the value without notifying a single
subscriber, which leaves the UI stuck on skeletons forever.

**`partialize`.** Only `items` is persisted. Persisting `hydrated` would restore it as `true` on the
next visit, before rehydration had actually run.

## Behaviour

- `add` merges by `variantId` rather than appending a duplicate line
- `updateQty(id, 0)` removes the line, so the stepper needs no special case at 1
- Quantities are capped at `MAX_QTY` (999) on both add and update
- The drawer is review-only; sending happens on `/inquiry`, where there is room for the form

## Verified

14/14 assertions against the store outside React — add, merge-on-re-add, per-line totals, qty cap,
removal at zero, `localStorage` write, and that `hydrated` never reaches storage.
