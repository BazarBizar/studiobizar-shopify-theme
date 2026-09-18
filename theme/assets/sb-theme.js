/**
 * Shell behaviour that is not the navigation.
 *
 * Deliberately plain: no framework, no build step, no module graph. A theme
 * serves assets/ verbatim, so anything here has to be loadable as-is — and this
 * file is small enough that a framework would cost more than it saves.
 *
 * Loaded with `defer`, so the DOM is parsed before it runs.
 */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------------
     Back to top — components/layout/back-to-top.tsx

     Appears past its threshold, scrolls smoothly unless the visitor has asked
     for reduced motion. The CSS override for reduced motion cannot cancel a
     programmatic smooth scroll, which is why the check is repeated here.
     --------------------------------------------------------------------- */
  function backToTop() {
    var button = document.querySelector("[data-sb-back-to-top]");
    if (!button) return;

    var threshold = parseInt(button.getAttribute("data-threshold"), 10) || 900;
    var ticking = false;

    function apply() {
      button.hidden = window.scrollY <= threshold;
      ticking = false;
    }

    // rAF-coalesced: scroll fires far more often than the state can change.
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }

    button.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduced.matches ? "auto" : "smooth" });
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
  }

  /* ---------------------------------------------------------------------
     Disclosure dropdowns — the language switch and any other <details> used
     as a menu. A <details> stays open when you click away, which no dropdown
     in the designs does.
     --------------------------------------------------------------------- */
  function closeDetailsOnOutsideClick() {
    document.addEventListener("click", function (event) {
      var open = document.querySelectorAll("details[open]");
      for (var i = 0; i < open.length; i++) {
        if (!open[i].contains(event.target)) open[i].removeAttribute("open");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = document.querySelectorAll("details[open]");
      for (var i = 0; i < open.length; i++) {
        open[i].removeAttribute("open");
        var summary = open[i].querySelector("summary");
        if (summary && open[i].contains(document.activeElement)) summary.focus();
      }
    });
  }

  function init() {
    backToTop();
    closeDetailsOnOutsideClick();
  }

  init();

  // The theme editor swaps section markup in place without a page load, so
  // anything bound to an element inside a section has to be bound again.
  document.addEventListener("shopify:section:load", init);
})();
