/**
 * The mobile drawer — components/layout/mobile-nav.tsx without React or
 * framer-motion.
 *
 * What the React version got for free and has to be written out here:
 *
 *   · mount/unmount        → `hidden`, dropped one frame before data-open, so
 *                            the CSS transition has a state to animate from
 *   · body scroll lock     → the same overflow save/restore the useEffect did
 *   · Escape to close      → a keydown listener, added only while open
 *   · focus                → React kept focus in the tree; here it is moved to
 *                            the panel on open and back to the trigger on close,
 *                            and trapped in between
 *
 * The focus trap is new. The React drawer never had one, so a keyboard user
 * could tab out of the open panel and onto the page behind it — a real bug this
 * port fixes rather than reproduces.
 */
(function () {
  "use strict";

  var FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "summary",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  function visibleFocusable(root) {
    var all = root.querySelectorAll(FOCUSABLE);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      // offsetParent is null for anything display:none — including the items
      // inside a collapsed <details>, which must not be tab stops.
      if (el.offsetParent !== null && el.getAttribute("tabindex") !== "-1") out.push(el);
    }
    return out;
  }

  function drawer() {
    var root = document.querySelector("[data-sb-nav]");
    if (!root || root.dataset.sbBound === "true") return;
    root.dataset.sbBound = "true";

    var panel = root.querySelector("[data-sb-nav-panel]");
    var openers = document.querySelectorAll("[data-sb-nav-open]");
    var closers = root.querySelectorAll("[data-sb-nav-close]");
    var lastFocused = null;
    var previousOverflow = "";

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      var items = visibleFocusable(panel);
      if (items.length === 0) return;

      var first = items[0];
      var last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function open() {
      lastFocused = document.activeElement;

      root.hidden = false;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      // Two frames: one for `hidden` to be gone and the element laid out,
      // one for the browser to register the starting transform before it
      // changes. A single frame drops the animation on some engines.
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          root.dataset.open = "true";
        });
      });

      for (var i = 0; i < openers.length; i++) {
        openers[i].setAttribute("aria-expanded", "true");
      }

      var items = visibleFocusable(panel);
      if (items.length) items[0].focus();

      document.addEventListener("keydown", onKeydown);
    }

    function close() {
      root.dataset.open = "false";
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeydown);

      for (var i = 0; i < openers.length; i++) {
        openers[i].setAttribute("aria-expanded", "false");
      }

      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();

      // Hide only once the panel has finished sliding out, or it vanishes
      // instead of animating. transitionend can be missed if the tab is
      // backgrounded mid-transition, so a timeout backs it up.
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        if (root.dataset.open === "false") root.hidden = true;
        panel.removeEventListener("transitionend", finish);
      }
      panel.addEventListener("transitionend", finish);
      window.setTimeout(finish, 400);
    }

    for (var i = 0; i < openers.length; i++) {
      openers[i].addEventListener("click", open);
    }
    for (var j = 0; j < closers.length; j++) {
      closers[j].addEventListener("click", close);
    }
  }

  drawer();
  document.addEventListener("shopify:section:load", drawer);
})();
