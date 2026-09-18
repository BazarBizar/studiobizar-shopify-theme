/**
 * Arrows and dots for a scroll-snap track — components/sections/hero-slider.tsx
 * and components/ui/carousel.tsx without embla-carousel.
 *
 * THE BROWSER IS THE CAROUSEL. `scroll-snap-type` does the snapping, the
 * momentum and the touch handling; `scroll-behavior: smooth` does the animation.
 * What is left is moving the scroll position when an arrow is pressed and
 * keeping the dots in step — about forty lines against a 20kB dependency.
 *
 * Without JavaScript the track is still a horizontally scrollable strip with
 * every slide reachable, which is why the arrows and dots are rendered hidden
 * and revealed here rather than shipped visible and left inert.
 */
(function () {
  "use strict";

  function bind(root) {
    var carousels = (root || document).querySelectorAll("[data-sb-carousel]");

    for (var i = 0; i < carousels.length; i++) {
      var carousel = carousels[i];
      if (carousel.dataset.sbBound === "true") continue;
      carousel.dataset.sbBound = "true";
      setup(carousel);
    }
  }

  function setup(carousel) {
    var track = carousel.querySelector("[data-sb-carousel-track]");
    if (!track) return;

    var slides = track.children;
    if (slides.length <= 1) return;

    var controls = carousel.querySelectorAll("[data-sb-carousel-controls]");
    for (var c = 0; c < controls.length; c++) controls[c].hidden = false;

    var dots = carousel.querySelectorAll("[data-sb-carousel-dot]");

    function current() {
      // Rounded against the slide width rather than tracked in a variable, so a
      // swipe, a keyboard scroll and an arrow press all agree on where we are.
      var width = slides[0].getBoundingClientRect().width || 1;
      return Math.round(track.scrollLeft / width);
    }

    function paint() {
      var index = current();
      for (var d = 0; d < dots.length; d++) {
        var active = Number(dots[d].getAttribute("data-sb-carousel-dot")) === index;
        if (active) dots[d].setAttribute("aria-current", "true");
        else dots[d].removeAttribute("aria-current");
        dots[d].classList.toggle("opacity-100", active);
        dots[d].classList.toggle("opacity-40", !active);
      }
    }

    function go(index) {
      var width = slides[0].getBoundingClientRect().width || 0;
      var wrapped = (index + slides.length) % slides.length;
      track.scrollTo({ left: wrapped * width });
    }

    carousel.addEventListener("click", function (event) {
      var target = event.target.closest ? event.target : null;
      if (!target) return;

      var prev = target.closest("[data-sb-carousel-prev]");
      if (prev) return go(current() - 1);

      var next = target.closest("[data-sb-carousel-next]");
      if (next) return go(current() + 1);

      var dot = target.closest("[data-sb-carousel-dot]");
      if (dot) go(Number(dot.getAttribute("data-sb-carousel-dot")));
    });

    // rAF-coalesced: scroll fires far more often than the dot state can change.
    var ticking = false;
    track.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          paint();
          ticking = false;
        });
      },
      { passive: true },
    );

    paint();
  }

  bind();
  document.addEventListener("shopify:section:load", function (event) {
    bind(event.target);
  });
})();
