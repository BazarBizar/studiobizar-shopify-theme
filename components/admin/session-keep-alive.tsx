"use client";

import { useEffect } from "react";

import { STAFF_BASE_PATH } from "@/lib/admin/cookie";

/** How often an open, visible panel tab checks in. Well inside the 8-hour session. */
const EVERY_MS = 10 * 60 * 1000;

/**
 * Keeps a working session alive. A staff session lasts 8 hours (`lib/admin/auth.ts`);
 * Auth.js re-issues the session cookie, with a fresh 8 hours, whenever its session
 * endpoint is asked. Nothing in the panel asked, so a session ran out 8 hours after
 * sign-in — in the middle of editing, with every autosave refused from then on.
 *
 * So, while a panel tab is open and in use, it checks in every 10 minutes and when
 * the tab comes back into view. An idle tab (hidden) does not, and a session nobody
 * uses still ends after 8 hours. If the session has already ended, the editors say
 * so where it matters — on the next save.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    let last = Date.now();
    const touch = () => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      void fetch(`${STAFF_BASE_PATH}/session`, { credentials: "same-origin", cache: "no-store" }).catch(() => undefined);
    };
    const timer = window.setInterval(touch, EVERY_MS);
    // Back in view after a while (a lunch break, another tab): check in at once.
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 60 * 1000) touch();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
