/**
 * The image viewer — components/ui/lightbox.tsx, without
 * `yet-another-react-lightbox`.
 *
 * WHAT THE BROWSER NOW DOES INSTEAD OF THE LIBRARY. The markup is a native
 * `<dialog>` opened with `showModal()`, which supplies the focus trap, the
 * Escape handler, the backdrop and the inert-page semantics. Roughly everything
 * the library was there for except the slides, which is all that is left below.
 *
 * HOW A GRID CONNECTS TO IT. Any container marked `[data-sb-lightbox-group]`
 * whose triggers carry `[data-sb-lightbox-item]` and the media on data
 * attributes. Nothing is downloaded until the viewer opens: the stage is empty
 * in the markup and the `<img>` is built on demand, so a gallery of forty
 * photographs costs one thumbnail each and no full-size images at all.
 */
(function () {
  "use strict";

  var dialog = null;
  var items = [];
  var current = 0;
  var opener = null;

  function el(name) {
    return dialog ? dialog.querySelector("[data-sb-lightbox-" + name + "]") : null;
  }

  function readItem(trigger) {
    return {
      src: trigger.getAttribute("data-src"),
      alt: trigger.getAttribute("data-alt") || "",
      caption: trigger.getAttribute("data-caption") || "",
      credit: trigger.getAttribute("data-credit") || "",
      videoSrc: trigger.getAttribute("data-video-src"),
      videoType: trigger.getAttribute("data-video-type") || "video/mp4",
    };
  }

  function render() {
    var item = items[current];
    if (!item) return;

    var stage = el("stage");
    stage.textContent = "";

    if (item.videoSrc) {
      var video = document.createElement("video");
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      if (item.src) video.poster = item.src;
      video.className = "max-h-full max-w-full";

      var source = document.createElement("source");
      source.src = item.videoSrc;
      source.type = item.videoType;
      video.appendChild(source);
      stage.appendChild(video);
    } else {
      var img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt;
      img.className = "max-h-full max-w-full object-contain";
      stage.appendChild(img);
    }

    // `01 / 04`, zero-padded as the spec draws it.
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    el("counter").textContent = pad(current + 1) + " / " + pad(items.length);

    // Caption and credit join with a middot, as the React version did.
    var parts = [];
    if (item.caption) parts.push(item.caption);
    if (item.credit) parts.push(item.credit);
    el("caption").textContent = parts.join(" · ");

    var single = items.length <= 1;
    el("prev").hidden = single;
    el("next").hidden = single;
  }

  function go(by) {
    if (items.length === 0) return;
    // Wraps, which is what `carousel: { finite: false }` gave the library.
    current = (current + by + items.length) % items.length;
    render();
  }

  function open(group, index) {
    var triggers = group.querySelectorAll("[data-sb-lightbox-item]");
    items = Array.prototype.map.call(triggers, readItem);
    current = index;
    opener = triggers[index] || null;

    render();
    dialog.showModal();
  }

  function close() {
    // Stop any playing video before the stage is cleared, or audio can outlive
    // the dialog in some engines.
    var video = el("stage").querySelector("video");
    if (video) video.pause();

    el("stage").textContent = "";
    dialog.close();
  }

  function init() {
    dialog = document.querySelector("[data-sb-lightbox]");
    if (!dialog || dialog.dataset.sbBound === "true") return;
    dialog.dataset.sbBound = "true";

    document.addEventListener("click", function (event) {
      var trigger = event.target.closest
        ? event.target.closest("[data-sb-lightbox-item]")
        : null;
      if (!trigger) return;

      var group = trigger.closest("[data-sb-lightbox-group]");
      if (!group) return;

      event.preventDefault();

      var all = group.querySelectorAll("[data-sb-lightbox-item]");
      open(group, Array.prototype.indexOf.call(all, trigger));
    });

    el("close").addEventListener("click", close);
    el("prev").addEventListener("click", function () {
      go(-1);
    });
    el("next").addEventListener("click", function () {
      go(1);
    });

    dialog.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    });

    // `showModal` puts the backdrop behind the dialog element itself, so a click
    // that lands on the dialog rather than its content is a backdrop click.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) close();
    });

    // Fires for Escape as well as `close()`, which is where focus is restored —
    // the browser does not put it back on the element that opened the dialog.
    dialog.addEventListener("close", function () {
      el("stage").textContent = "";
      if (opener && typeof opener.focus === "function") opener.focus();
    });
  }

  init();
  document.addEventListener("shopify:section:load", init);
})();
