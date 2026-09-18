/**
 * The inquiry list — store/inquiry-cart.ts without zustand.
 *
 * This storefront has no cart and no checkout. A visitor collects products into
 * a list held in their own browser, then submits it as an inquiry.
 *
 * THE STORAGE KEY AND ENVELOPE MATCH THE NEXT BUILD EXACTLY, down to zustand's
 * `{ state: { items }, version }` wrapper. Not nostalgia: the item shape is what
 * `lib/inquiry/schema.ts` validates and what the PDF and the emails are built
 * from, so keeping it identical means the submission backend needs no change
 * when the storefront becomes a theme.
 *
 * Everything here is deliberately plain. A theme serves assets/ verbatim, and
 * this file has to be loadable as-is.
 */
(function () {
  "use strict";

  var KEY = "sb-inquiry-cart";
  var VERSION = 1;
  var MAX_QTY = 999;
  var CHANGED = "sb:inquiry-change";

  /* ---------------------------------------------------------------------
     Storage

     Every read and write is guarded. localStorage throws in a private window
     on some engines, and is simply absent when a visitor has blocked site
     data — an inquiry list that cannot persist should degrade to one that
     works until the page unloads, not take the page down with it.
     --------------------------------------------------------------------- */

  var memory = null;

  function read() {
    if (memory) return memory;

    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return (memory = []);

      var parsed = JSON.parse(raw);
      var items = parsed && parsed.state && parsed.state.items;
      memory = Array.isArray(items) ? items.filter(isItem) : [];
    } catch (error) {
      memory = [];
    }

    return memory;
  }

  function isItem(value) {
    return value && typeof value.variantId === "string" && typeof value.qty === "number";
  }

  function write(items) {
    memory = items;

    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ state: { items: items }, version: VERSION }),
      );
    } catch (error) {
      // Kept in memory for this page view; the visitor still sees their list.
    }

    document.dispatchEvent(new CustomEvent(CHANGED, { detail: { items: items } }));
  }

  /* ---------------------------------------------------------------------
     Operations — the same rules as the zustand store
     --------------------------------------------------------------------- */

  function clampQty(value) {
    return Math.max(1, Math.min(value, MAX_QTY));
  }

  function add(item, qty) {
    var items = read().slice();
    var wanted = clampQty(qty || 1);
    var existing = null;

    for (var i = 0; i < items.length; i++) {
      if (items[i].variantId === item.variantId) {
        existing = i;
        break;
      }
    }

    if (existing === null) {
      items.push({
        variantId: item.variantId,
        productHandle: item.productHandle,
        sku: item.sku || null,
        title: item.title,
        variantTitle: item.variantTitle || null,
        image: item.image || null,
        qty: wanted,
      });
    } else {
      // Capped rather than rejected: asking for more than 999 of a sofa is a
      // typo, and refusing the whole add would lose the click.
      items[existing] = Object.assign({}, items[existing], {
        qty: Math.min(items[existing].qty + wanted, MAX_QTY),
      });
    }

    write(items);
  }

  function updateQty(variantId, qty) {
    // Below one is a removal, not a zero — the same rule the store applies, so
    // a stepper taken to 0 empties the row instead of leaving a dead line.
    if (qty < 1) return remove(variantId);

    write(
      read().map(function (item) {
        return item.variantId === variantId
          ? Object.assign({}, item, { qty: Math.min(qty, MAX_QTY) })
          : item;
      }),
    );
  }

  function remove(variantId) {
    write(
      read().filter(function (item) {
        return item.variantId !== variantId;
      }),
    );
  }

  function clear() {
    write([]);
  }

  function totalQuantity() {
    return read().reduce(function (total, item) {
      return total + item.qty;
    }, 0);
  }

  /* ---------------------------------------------------------------------
     The header badge

     Hidden until the list is known, which is what `hydrated` guarded in the
     React version. Server-rendered HTML cannot know what is in localStorage,
     so printing 0 before reading it would be wrong on every visitor's second
     page view.
     --------------------------------------------------------------------- */

  function paintBadge() {
    var badges = document.querySelectorAll("[data-sb-inquiry-count]");
    var count = totalQuantity();

    for (var i = 0; i < badges.length; i++) {
      badges[i].textContent = count > 99 ? "99+" : String(count);
      badges[i].hidden = count === 0;
    }

    var triggers = document.querySelectorAll("[data-sb-inquiry-open]");
    for (var j = 0; j < triggers.length; j++) {
      var label = triggers[j].getAttribute("data-label-with-count");
      if (label && count > 0) {
        triggers[j].setAttribute("aria-label", label.replace("%count%", String(count)));
      }
    }
  }

  /* ---------------------------------------------------------------------
     Add buttons

     The payload rides on data attributes rather than a JSON blob, so the
     markup stays readable and a missing field is visible in the DOM.
     --------------------------------------------------------------------- */

  function bindAddButtons() {
    document.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-sb-inquiry-add]") : null;
      if (!button) return;

      event.preventDefault();

      var variantId = button.getAttribute("data-variant-id");
      if (!variantId) return;

      add(
        {
          variantId: variantId,
          productHandle: button.getAttribute("data-product-handle") || "",
          sku: button.getAttribute("data-sku"),
          title: button.getAttribute("data-title") || "",
          variantTitle: button.getAttribute("data-variant-title"),
          image: button.getAttribute("data-image"),
        },
        parseInt(button.getAttribute("data-qty"), 10) || 1,
      );

      // A two-second acknowledgement on the button itself, as the card does in
      // the React build. `data-added` drives the tick; no layout changes.
      button.setAttribute("data-added", "true");
      window.setTimeout(function () {
        button.removeAttribute("data-added");
      }, 2000);
    });
  }

  /* ---------------------------------------------------------------------
     Public surface, for the drawer and the review page (phase 5)
     --------------------------------------------------------------------- */

  window.sbInquiry = {
    items: read,
    add: add,
    updateQty: updateQty,
    remove: remove,
    clear: clear,
    totalQuantity: totalQuantity,
    MAX_QTY: MAX_QTY,
    CHANGED: CHANGED,
  };

  document.addEventListener(CHANGED, paintBadge);

  /**
   * Another tab writing the list is a real case — someone browsing the shop in
   * two windows. `storage` fires only in the OTHER tab, so the cached copy is
   * dropped and the badge repainted from what was actually stored.
   */
  window.addEventListener("storage", function (event) {
    if (event.key !== KEY) return;
    memory = null;
    paintBadge();
  });

  bindAddButtons();
  paintBadge();

  // The theme editor swaps section markup in place, taking the badge with it.
  document.addEventListener("shopify:section:load", paintBadge);
})();
