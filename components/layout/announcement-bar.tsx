"use client";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import * as React from "react";

import { fingerprint, isScheduledNow, type Announcement, type AnnouncementMessage } from "@/lib/theme-builder/promo";
import { cn } from "@/lib/utils/cn";

const DURATION = { slow: "60s", normal: "35s", fast: "18s" } as const;
const SEPARATOR = { dot: "·", dash: "—", star: "✦", none: "" } as const;
const SIZE = { secondary: "text-secondary", tertiary: "text-tertiary", caption: "text-caption" } as const;
const CLOSED_KEY = "sb-announcement-closed";

const noopSubscribe = () => () => {};
const everyMinute = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
};
const currentMinute = () => Math.floor(Date.now() / 60_000) * 60_000;
const inPreview = () => window.location.pathname.startsWith("/preview");
function readClosed(): string | null {
  try {
    return window.localStorage.getItem(CLOSED_KEY);
  } catch {
    // Storage blocked: the bar simply shows.
    return null;
  }
}

/**
 * The bar above the header (Header & footer → Header → Announcement bar): several
 * messages, one at a time or moving across, each with its own link and dates.
 *
 * The dates and "closed" are decided here, in the browser — the page is cached, so
 * the server's clock would be up to a cache period late. The first render uses the
 * moment the server drew the page (`renderedAt`), so the browser's first render
 * matches it; the real clock takes over straight after.
 *
 * In the editor's preview every message shows, scheduled or not, and closing it
 * is not remembered.
 */
export function AnnouncementBar({
  announcement,
  renderedAt,
  className,
  style,
}: {
  announcement: Announcement;
  renderedAt: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // The browser's clock, to the minute — a message whose time comes while the page is
  // open appears then. The server's moment until hydration, so the two renders agree.
  const now = React.useSyncExternalStore(everyMinute, currentMinute, () => renderedAt);
  const preview = React.useSyncExternalStore(noopSubscribe, inPreview, () => false);
  const closedBefore = React.useSyncExternalStore(noopSubscribe, readClosed, () => null);
  const [closedNow, setClosedNow] = React.useState(false);

  const all = announcement.messages.filter((message) => message.text.trim());
  const key = fingerprint(JSON.stringify(all.map((message) => [message.text, message.href])));
  const closed = closedNow || (announcement.dismissible && !preview && closedBefore === key);

  const messages = preview ? all : all.filter((message) => isScheduledNow(message, now));
  if (!announcement.enabled || closed || messages.length === 0) return null;

  const close = () => {
    setClosedNow(true);
    if (preview) return;
    try {
      window.localStorage.setItem(CLOSED_KEY, key);
    } catch {
      // Not remembered — it comes back on the next page.
    }
  };

  return (
    <div
      role="region"
      aria-label="Announcement"
      className={cn("bg-off-black text-earth relative", SIZE[announcement.size], className)}
      style={style}
    >
      {announcement.mode === "scroll" ? (
        <Scrolling announcement={announcement} messages={messages} />
      ) : (
        <OneAtATime announcement={announcement} messages={messages} />
      )}
      {announcement.dismissible ? (
        <button
          type="button"
          onClick={close}
          aria-label="Close the announcement"
          className="absolute inset-y-0 inset-e-1 flex w-8 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function MessageText({ message, tabbable = true }: { message: AnnouncementMessage; tabbable?: boolean }) {
  return message.href ? (
    <a href={message.href} className="sb-underline" tabIndex={tabbable ? undefined : -1}>
      {message.text}
    </a>
  ) : (
    <>{message.text}</>
  );
}

/** One message, then the next — paused while the pointer or the keyboard is on it, with arrows to step. */
function OneAtATime({ announcement, messages }: { announcement: Announcement; messages: AnnouncementMessage[] }) {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const count = messages.length;
  const current = index % count;

  React.useEffect(() => {
    if (count < 2 || paused) return;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % count), announcement.interval * 1000);
    return () => window.clearInterval(timer);
  }, [count, paused, announcement.interval]);

  const step = (delta: number) => setIndex((value) => (value + delta + count) % count);

  return (
    <div
      className={cn("flex items-center gap-2 py-2", count > 1 ? "px-2" : "px-4", announcement.dismissible && "pe-10")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {count > 1 ? (
        <button type="button" onClick={() => step(-1)} aria-label="Previous announcement" className="shrink-0 opacity-60 hover:opacity-100">
          <ChevronLeftIcon className="size-3.5" />
        </button>
      ) : null}
      {/* Every message in one cell, so the bar is as tall as the longest and never jumps. */}
      <div className="grid min-w-0 flex-1 text-center" aria-live={paused ? "polite" : "off"}>
        {messages.map((message, position) => (
          <p
            key={message.id}
            aria-hidden={position !== current}
            className={cn(
              "[grid-area:1/1] transition-opacity duration-500",
              position === current ? "opacity-100" : "invisible opacity-0",
            )}
          >
            <MessageText message={message} tabbable={position === current} />
          </p>
        ))}
      </div>
      {count > 1 ? (
        <button type="button" onClick={() => step(1)} aria-label="Next announcement" className="shrink-0 opacity-60 hover:opacity-100">
          <ChevronRightIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Every message moving across — the Scrolling text section's loop (`sb-marquee` in
 * globals.css), paused under the pointer so a link can be clicked. Visitors who prefer
 * less motion get it at rest. The moving copies are hidden from screen readers, which
 * read the messages once from the list before them.
 */
function Scrolling({ announcement, messages }: { announcement: Announcement; messages: AnnouncementMessage[] }) {
  const mark = SEPARATOR[announcement.separator];
  const strip = (copy: number) => (
    <ul aria-hidden className="flex shrink-0 items-center" key={copy}>
      {/* Repeated so one copy is always wider than the screen, whatever the number of messages. */}
      {Array.from({ length: Math.max(2, Math.ceil(6 / messages.length)) }, (_, round) =>
        messages.map((message) => (
          <li key={`${round}-${message.id}`} className="flex items-center whitespace-nowrap">
            <span className="px-6">
              <MessageText message={message} tabbable={false} />
            </span>
            {mark && <span className="opacity-50">{mark}</span>}
          </li>
        )),
      )}
    </ul>
  );

  return (
    <div className={cn("overflow-hidden py-2", announcement.dismissible && "pe-8")}>
      <ul className="sr-only">
        {messages.map((message) => (
          <li key={message.id}>
            <MessageText message={message} />
          </li>
        ))}
      </ul>
      <div
        className={cn(
          "sb-marquee flex w-max hover:[animation-play-state:paused]",
          announcement.direction === "right" && "[animation-direction:reverse]",
        )}
        style={{ "--sb-marquee-duration": DURATION[announcement.speed] } as React.CSSProperties}
      >
        {[0, 1].map(strip)}
      </div>
    </div>
  );
}
