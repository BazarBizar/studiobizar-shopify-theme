/**
 * The product page's three pieces of behaviour — product-gallery.tsx and
 * add-to-inquiry.tsx, plus the recommendations row.
 *
 * All three are enhancements. Without JS the gallery shows the primary photo and
 * the thumbnail rail, the quantity field is a working number input, and the
 * recommendations row is simply absent.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Gallery

     Every image is already in the DOM, the first shown and the rest hidden.
     Switching toggles `hidden` rather than swapping a src, so a photo the
     visitor has already looked at does not reload when they come back to it.
     --------------------------------------------------------------------- */
  function gallery(root) {
    var box = root.querySelector("[data-sb-gallery]");
    if (!box || box.dataset.sbBound === "true") return;
    box.dataset.sbBound = "true";

    box.addEventListener("click", function (event) {
      var thumb = event.target.closest
        ? event.target.closest("[data-sb-gallery-thumb]")
        : null;
      if (!thumb) return;

      var index = thumb.getAttribute("data-sb-gallery-thumb");

      var panes = box.querySelectorAll("[data-sb-gallery-pane]");
      for (var i = 0; i < panes.length; i++) {
        panes[i].hidden = panes[i].getAttribute("data-sb-gallery-pane") !== index;
      }

      var thumbs = box.querySelectorAll("[data-sb-gallery-thumb]");
      for (var j = 0; j < thumbs.length; j++) {
        if (thumbs[j] === thumb) thumbs[j].setAttribute("aria-current", "true");
        else thumbs[j].removeAttribute("aria-current");
      }
    });
  }

  /* ---------------------------------------------------------------------
     Quantity stepper and share
     --------------------------------------------------------------------- */
  function inquiryForm(root) {
    var form = root.querySelector("[data-sb-inquiry-form]");
    if (!form || form.dataset.sbBound === "true") return;
    form.dataset.sbBound = "true";

    var input = form.querySelector("[data-sb-qty]");
    var addButton = form.querySelector("[data-sb-inquiry-add]");

    function min() {
      return parseInt(input.getAttribute("min"), 10) || 1;
    }

    function sync() {
      var value = parseInt(input.value, 10);
      if (isNaN(value) || value < min()) value = min();
      if (value > 999) value = 999;

      input.value = String(value);

      // The add button reads its quantity from an attribute, because
      // sb-inquiry-cart.js handles the card's `+` and this button with one
      // listener and knows nothing about steppers.
      if (addButton) addButton.setAttribute("data-qty", String(value));

      var down = form.querySelector('[data-sb-qty-step="-1"]');
      if (down) down.disabled = value <= min();
      var up = form.querySelector('[data-sb-qty-step="1"]');
      if (up) up.disabled = value >= 999;
    }

    form.addEventListener("click", function (event) {
      var step = event.target.closest ? event.target.closest("[data-sb-qty-step]") : null;
      if (!step) return;

      var by = parseInt(step.getAttribute("data-sb-qty-step"), 10) || 0;
      input.value = String((parseInt(input.value, 10) || min()) + by);
      sync();
    });

    input.addEventListener("input", sync);
    input.addEventListener("blur", sync);
    sync();

    /* The enquire button's own acknowledgement. The cart script sets
       `data-added` on whatever was clicked, so this only has to exist for the
       CSS to have something to hang on — no extra state here. */

    var share = form.querySelector("[data-sb-share]");
    if (share) {
      share.addEventListener("click", async function () {
        var url = window.location.href;

        if (navigator.share) {
          try {
            await navigator.share({ title: document.title, url: url });
          } catch (error) {
            // The visitor dismissed the share sheet. Not a failure.
          }
          return;
        }

        try {
          await navigator.clipboard.writeText(url);
          var note = form.querySelector("[data-sb-share-note]");
          if (note) {
            note.hidden = false;
            window.setTimeout(function () {
              note.hidden = true;
            }, 2400);
          }
        } catch (error) {
          // No clipboard permission — the URL is in the address bar regardless.
        }
      });
    }
  }

  /* ---------------------------------------------------------------------
     Recommendations

     Shopify's Recommendations API answers out of band: `recommendations.performed`
     is false on the first render, so the row is fetched afterwards through the
     Section Rendering API. On a store with no order history it commonly returns
     nothing, and then nothing is inserted — which is correct, and is why the
     container ships empty rather than with a heading waiting for rows.
     --------------------------------------------------------------------- */
  function recommendations(root) {
    var box = root.querySelector("[data-sb-recommendations]");
    if (!box || box.dataset.sbBound === "true") return;
    box.dataset.sbBound = "true";

    var url = box.getAttribute("data-url");
    if (!url) return;

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then(function (html) {
        var parsed = new DOMParser().parseFromString(html, "text/html");
        var incoming = parsed.querySelector("[data-sb-recommendations]");
        if (incoming && incoming.innerHTML.trim()) box.innerHTML = incoming.innerHTML;
      })
      .catch(function () {
        // Leaving the row out is the right failure: it is a discovery aid, and
        // an error message where a product row should be helps nobody.
      });
  }

  function init(root) {
    var scope = root || document;
    gallery(scope);
    inquiryForm(scope);
    recommendations(scope);
  }

  init();
  document.addEventListener("shopify:section:load", function (event) {
    init(event.target);
  });
})();
