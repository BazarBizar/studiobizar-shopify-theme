/**
 * Behaviour for the landing sections — the theme halves of
 * components/sections/landing/{slideshow,tabs,video-embed}.tsx.
 *
 * Plain and deferred like sb-theme.js. Each part binds to a data attribute, does
 * nothing when there is none on the page, and binds again when the theme editor
 * re-renders a section (`shopify:section:load`).
 *
 *   [data-sb-slideshow]  cross-fading slides: autoplay with a pause control,
 *                        paused on hover and focus, none under reduced motion
 *   [data-sb-tabs]       WAI-ARIA tabs: arrows, Home and End; one panel shown
 *   [data-sb-video]      a cover until play; then the player, built from the
 *                        provider and id alone — nothing loads before that
 */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------- slideshow */

  function slideshow(root) {
    var slides = root.querySelectorAll("[data-sb-slide]");
    if (slides.length < 2) return;

    var controls = root.querySelector("[data-sb-slideshow-controls]");
    var dots = root.querySelectorAll("[data-sb-slideshow-dot]");
    var toggle = root.querySelector("[data-sb-slideshow-toggle]");
    var interval = (parseInt(root.getAttribute("data-interval"), 10) || 6) * 1000;
    var playing = root.getAttribute("data-autoplay") === "true" && !reduced.matches;
    var held = false;
    var index = 0;
    var timer = null;

    function show(next) {
      index = (next + slides.length) % slides.length;
      for (var i = 0; i < slides.length; i++) {
        var active = i === index;
        slides[i].classList.toggle("opacity-100", active);
        slides[i].classList.toggle("opacity-0", !active);
        slides[i].classList.toggle("pointer-events-none", !active);
        if (active) {
          slides[i].removeAttribute("aria-hidden");
          slides[i].removeAttribute("inert");
        } else {
          slides[i].setAttribute("aria-hidden", "true");
          slides[i].setAttribute("inert", "");
        }
      }
      for (var d = 0; d < dots.length; d++) {
        var current = d === index;
        if (current) dots[d].setAttribute("aria-current", "true");
        else dots[d].removeAttribute("aria-current");
        dots[d].classList.toggle("opacity-100", current);
        dots[d].classList.toggle("opacity-40", !current);
      }
      // The controls take the text colour of the slide under them.
      if (controls) controls.setAttribute("data-surface", slides[index].getAttribute("data-tone") || "black");
      schedule();
    }

    function schedule() {
      window.clearTimeout(timer);
      if (playing && !held) timer = window.setTimeout(function () { show(index + 1); }, interval);
    }

    function paintToggle() {
      if (!toggle) return;
      toggle.setAttribute("aria-label", toggle.getAttribute(playing ? "data-label-pause" : "data-label-play"));
      toggle.querySelector('[data-icon="pause"]').hidden = !playing;
      toggle.querySelector('[data-icon="play"]').hidden = playing;
    }

    root.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest("[data-sb-slideshow-prev]")) return show(index - 1);
      if (target.closest("[data-sb-slideshow-next]")) return show(index + 1);
      var dot = target.closest("[data-sb-slideshow-dot]");
      if (dot) return show(Number(dot.getAttribute("data-sb-slideshow-dot")));
      if (target.closest("[data-sb-slideshow-toggle]")) {
        playing = !playing;
        paintToggle();
        schedule();
      }
    });

    root.addEventListener("mouseenter", function () { held = true; schedule(); });
    root.addEventListener("mouseleave", function () { held = false; schedule(); });
    root.addEventListener("focusin", function () { held = true; schedule(); });
    root.addEventListener("focusout", function () { held = false; schedule(); });

    // The pause control exists only while it can do something.
    if (toggle && !reduced.matches) toggle.hidden = false;
    paintToggle();
    schedule();
  }

  /* --------------------------------------------------------------------- tabs */

  function tabs(root) {
    var list = root.querySelector("[data-sb-tablist]");
    var buttons = root.querySelectorAll("[data-sb-tab]");
    var panels = root.querySelectorAll("[data-sb-tabpanel]");
    if (!list || buttons.length === 0) return;

    // With script, the tab names move into the tab list; without, each panel keeps its own.
    list.hidden = false;
    var fallbacks = root.querySelectorAll("[data-sb-tab-fallback]");
    for (var f = 0; f < fallbacks.length; f++) fallbacks[f].hidden = true;

    function select(index, focus) {
      for (var i = 0; i < buttons.length; i++) {
        var active = i === index;
        buttons[i].setAttribute("aria-selected", active ? "true" : "false");
        buttons[i].tabIndex = active ? 0 : -1;
        if (panels[i]) panels[i].hidden = !active;
      }
      if (focus) buttons[index].focus();
    }

    list.addEventListener("click", function (event) {
      var button = event.target.closest && event.target.closest("[data-sb-tab]");
      if (!button) return;
      select(Array.prototype.indexOf.call(buttons, button), false);
    });

    list.addEventListener("keydown", function (event) {
      var current = Array.prototype.indexOf.call(buttons, document.activeElement);
      if (current < 0) return;
      var next = null;
      if (event.key === "ArrowRight") next = (current + 1) % buttons.length;
      else if (event.key === "ArrowLeft") next = (current - 1 + buttons.length) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      if (next === null) return;
      event.preventDefault();
      select(next, true);
    });

    select(0, false);
  }

  /* -------------------------------------------------------------------- video */

  var VIDEO_ID = { youtube: /^[A-Za-z0-9_-]{11}$/, vimeo: /^\d{6,12}$/ };

  function embedSrc(provider, id) {
    if (provider === "youtube") {
      return "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1&playsinline=1";
    }
    return "https://player.vimeo.com/video/" + id + "?autoplay=1&dnt=1";
  }

  function video(root) {
    var button = root.querySelector("[data-sb-video-play]");
    if (!button) return;
    button.addEventListener("click", function () {
      var provider = root.getAttribute("data-provider");
      var id = root.getAttribute("data-id") || "";
      // The address was parsed by Shopify; the id is checked again before it reaches a URL.
      if (!VIDEO_ID[provider] || !VIDEO_ID[provider].test(id)) return;
      var frame = document.createElement("iframe");
      frame.src = embedSrc(provider, id);
      frame.title = root.getAttribute("data-title") || "Video";
      frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      frame.allowFullscreen = true;
      frame.className = "absolute inset-0 h-full w-full";
      root.replaceChildren(frame);
      frame.focus();
    });
  }

  /* --------------------------------------------------------------------- bind */

  function bind(scope) {
    var parts = [
      ["[data-sb-slideshow]", slideshow],
      ["[data-sb-tabs]", tabs],
      ["[data-sb-video]", video],
    ];
    for (var p = 0; p < parts.length; p++) {
      var found = (scope || document).querySelectorAll(parts[p][0]);
      for (var i = 0; i < found.length; i++) {
        if (found[i].dataset.sbBound === "true") continue;
        found[i].dataset.sbBound = "true";
        parts[p][1](found[i]);
      }
    }
  }

  bind();
  document.addEventListener("shopify:section:load", function (event) {
    bind(event.target);
  });
})();
