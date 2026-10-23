import { cn } from "@/lib/utils/cn";

import { HEADING, type HeadingSize } from "./shared";

const DURATION = { slow: "70s", normal: "45s", fast: "25s" } as const;
const SEPARATOR = { dot: "·", dash: "—", star: "✦", none: "" } as const;

/**
 * Phrases scrolling across. Pure CSS (`sb-marquee` in globals.css): the strip is
 * drawn twice and moved by half its width, so the loop has no seam. Visitors who
 * prefer reduced motion get the global rule in globals.css, which stops it.
 *
 * The moving copy is hidden from assistive technology; the phrases are read once,
 * as a plain list, from the visually hidden copy.
 */
export function Marquee({
  items,
  size,
  speed,
  direction,
  separator,
  lines,
}: {
  items: { id: string; text: string }[];
  size: HeadingSize;
  speed: keyof typeof DURATION;
  direction: "left" | "right";
  separator: keyof typeof SEPARATOR;
  lines: boolean;
}) {
  const phrases = items.filter((item) => item.text.trim());
  if (phrases.length === 0) return null;
  const mark = SEPARATOR[separator];

  const strip = (copy: number) => (
    <ul aria-hidden className="flex shrink-0 items-center" key={copy}>
      {/* Repeated so one copy is always wider than the screen, whatever the number of phrases. */}
      {Array.from({ length: Math.max(2, Math.ceil(8 / phrases.length)) }, (_, round) =>
        phrases.map((item) => (
          <li key={`${round}-${item.id}`} className="flex items-center whitespace-nowrap">
            <span className="px-6 sm:px-10">{item.text}</span>
            {mark && <span className="opacity-50">{mark}</span>}
          </li>
        )),
      )}
    </ul>
  );

  return (
    <div className={cn("py-section-xs overflow-hidden", lines && "border-border border-y")}>
      <ul className="sr-only">
        {phrases.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
      <div
        className={cn("sb-marquee flex w-max", HEADING[size], direction === "right" && "[animation-direction:reverse]")}
        style={{ "--sb-marquee-duration": DURATION[speed] } as React.CSSProperties}
      >
        {[0, 1].map(strip)}
      </div>
    </div>
  );
}
