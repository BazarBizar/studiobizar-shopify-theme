/**
 * The announcement bar and the pop-ups — what depends on the visitor, decided in the
 * browser because the page is cached (sections/sb-announcement-bar.liquid,
 * sections/sb-popup.liquid; Next: components/layout/announcement-bar.tsx, popups.tsx).
 *
 * In the theme editor (`data-preview`) dates, a closed bar and "already seen" are
 * ignored, so what is being edited is always visible.
 */
(() => {
  const CLOSED_KEY = "sb-announcement-closed";

  const read = (storage, key) => {
    try {
      return window[storage].getItem(key);
    } catch {
      return null;
    }
  };
  const write = (storage, key, value) => {
    try {
      window[storage].setItem(key, value);
    } catch {
      /* private window: nothing remembered */
    }
  };

  /** "2026-12-01 09:00" → a time, on the visitor's clock. Empty or unreadable: open. */
  const when = (value) => {
    if (!value) return NaN;
    return Date.parse(value.trim().replace(" ", "T"));
  };
  const scheduledNow = (element, now = Date.now()) => {
    const starts = when(element.dataset.starts);
    const ends = when(element.dataset.ends);
    return !(starts > now) && !(ends <= now);
  };

  /* ---------------------------------------------------------------- bar */

  function announcement(bar) {
    const preview = bar.hasAttribute("data-preview");
    if (!preview && bar.hasAttribute("data-dismissible") && read("localStorage", CLOSED_KEY) === bar.dataset.key) {
      bar.hidden = true;
      return;
    }
    const messages = [...bar.querySelectorAll("[data-sb-message]")];
    if (!preview) for (const message of messages) if (!scheduledNow(message)) message.remove();
    if (!bar.querySelector("[data-sb-message]")) {
      bar.hidden = true;
      return;
    }

    bar.querySelector("[data-sb-announcement-close]")?.addEventListener("click", () => {
      bar.hidden = true;
      if (!preview) write("localStorage", CLOSED_KEY, bar.dataset.key);
    });

    if (bar.dataset.mode === "scroll") return;
    const slides = [...bar.querySelectorAll("p[data-sb-message]")];
    let current = 0;
    const show = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, position) => {
        const on = position === current;
        slide.classList.toggle("opacity-100", on);
        slide.classList.toggle("opacity-0", !on);
        slide.classList.toggle("invisible", !on);
        slide.setAttribute("aria-hidden", on ? "false" : "true");
      });
    };
    show(0);
    const arrows = bar.querySelectorAll("[data-sb-announcement-prev], [data-sb-announcement-next]");
    arrows.forEach((arrow) => (arrow.hidden = slides.length < 2));
    if (slides.length < 2) return;

    bar.querySelector("[data-sb-announcement-prev]")?.addEventListener("click", () => show(current - 1));
    bar.querySelector("[data-sb-announcement-next]")?.addEventListener("click", () => show(current + 1));
    let paused = false;
    for (const [event, value] of [["mouseenter", true], ["mouseleave", false], ["focusin", true], ["focusout", false]]) {
      bar.addEventListener(event, () => (paused = value));
    }
    const seconds = Math.max(2, Number(bar.dataset.interval) || 5);
    window.setInterval(() => {
      if (!paused) show(current + 1);
    }, seconds * 1000);
  }

  /* ---------------------------------------------------------------- pop-ups */

  const normalise = (path) => (path.length > 1 ? path.replace(/\/+$/, "") : path) || "/";

  /** Pages mode + one path per line, `/*` covering everything under it — `popupOnPath` in promo.ts. */
  function onThisPage(popup) {
    const mode = popup.dataset.pages || "all";
    const path = normalise(window.location.pathname);
    const listed = (popup.dataset.paths || "")
      .split(/\n+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .some((entry) => (entry.endsWith("/*") ? path === entry.slice(0, -2) || path.startsWith(entry.slice(0, -1)) : path === normalise(entry)));
    if (mode === "home") return path === "/";
    if (mode === "only") return listed;
    if (mode === "except") return !listed;
    return true;
  }

  function due(popup) {
    const key = `sb-popup-${popup.dataset.id}`;
    const frequency = popup.dataset.frequency;
    if (frequency === "always") return true;
    if (frequency === "session") return read("sessionStorage", key) === null;
    const last = Number(read("localStorage", key));
    if (!last) return true;
    if (frequency === "once") return false;
    const days = Math.max(1, Number(popup.dataset.days) || 7);
    return Date.now() - last >= days * 86_400_000;
  }

  function remember(popup) {
    const key = `sb-popup-${popup.dataset.id}`;
    if (popup.dataset.frequency === "session") write("sessionStorage", key, "1");
    else if (popup.dataset.frequency !== "always") write("localStorage", key, String(Date.now()));
  }

  function open(popup) {
    if (popup.open) return;
    if (popup.dataset.layout === "center") popup.showModal();
    else popup.show();
    remember(popup);
  }

  function popupSetUp(popup, preview) {
    const close = () => popup.close();
    popup.querySelectorAll("[data-sb-popup-close]").forEach((button) => button.addEventListener("click", close));
    // A click on the darkened page behind a centred pop-up closes it (not in the editor).
    popup.addEventListener("click", (event) => {
      if (!preview && event.target === popup && popup.dataset.layout === "center") close();
    });
    popup.querySelectorAll("a[href]").forEach((link) => link.addEventListener("click", () => popup.close()));

    if (preview) {
      open(popup);
      return;
    }
    if (!scheduledNow(popup) || !onThisPage(popup) || !due(popup)) return;

    const trigger = popup.dataset.trigger;
    if (trigger === "scroll") {
      const percent = Math.min(100, Math.max(5, Number(popup.dataset.scroll) || 40));
      const check = () => {
        const room = document.documentElement.scrollHeight - window.innerHeight;
        if (room <= 0 || (window.scrollY / room) * 100 >= percent) {
          window.removeEventListener("scroll", check);
          open(popup);
        }
      };
      window.addEventListener("scroll", check, { passive: true });
      check();
    } else if (trigger === "exit") {
      const leave = (event) => {
        if (event.clientY <= 0) {
          document.removeEventListener("mouseout", leave);
          open(popup);
        }
      };
      document.addEventListener("mouseout", leave);
    } else {
      window.setTimeout(() => open(popup), Math.max(0, Number(popup.dataset.delay) || 0) * 1000);
    }
  }

  function start() {
    document.querySelectorAll("[data-sb-announcement]").forEach(announcement);
    const popups = [...document.querySelectorAll("dialog[data-sb-popup]")];
    popups.forEach((popup) => popupSetUp(popup, popup.hasAttribute("data-preview")));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  // The theme editor re-renders a section in place: set the new one up.
  document.addEventListener("shopify:section:load", (event) => {
    event.target.querySelectorAll("[data-sb-announcement]").forEach(announcement);
    event.target.querySelectorAll("dialog[data-sb-popup]").forEach((popup) => popupSetUp(popup, true));
  });
})();
