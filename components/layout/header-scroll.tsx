"use client";

import * as React from "react";

/**
 * Tells the Theme Builder's header when the page has scrolled (`data-scrolled`) and
 * how tall it is (`--sb-hdr-h`), for the header's scroll behaviours — shrinking,
 * a shadow, turning solid when it sits over the page. The look itself is CSS
 * (`globals.css`, "Theme header"); this only reports. Renders nothing.
 */
export function HeaderScroll({ target }: { target: string }) {
  React.useEffect(() => {
    const header = document.getElementById(target);
    if (!header) return;
    const update = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
    const measure = () => header.style.setProperty("--sb-hdr-h", `${header.offsetHeight}px`);
    update();
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [target]);
  return null;
}
