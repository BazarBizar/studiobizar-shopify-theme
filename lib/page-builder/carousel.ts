import { link, number, select, toggle } from "./fields";

/**
 * CAROUSEL SETTINGS — the same few, on every section that scrolls a row of items:
 * how many show across on each device, how far one arrow press moves, how many at
 * most, and an optional "show more" button.
 *
 * "As designed" is the default everywhere: the row keeps the widths its section was
 * drawn with (`designed`), so a page made before these existed looks exactly as it did.
 * Choosing a number for one device fills the others from the design.
 *
 * Drawn by `Carousel` (components/ui/carousel.tsx) through `carouselView`, and by the
 * Liquid theme's scroll-snap track (assets/sb-carousel.js) — both read the same
 * `data-cv` widths from styles/sb-carousel.css.
 */

const AUTO = { value: "auto", label: "As designed" } as const;
const PEEK = (n: number) => ({ value: `${n}.25`, label: `${n} and a peek of the next` });

export const PER_VIEW_DESKTOP = [AUTO, ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))] as const;
export const PER_VIEW_TABLET = [AUTO, { value: "1", label: "1" }, PEEK(1), { value: "2", label: "2" }, PEEK(2), { value: "3", label: "3" }, { value: "4", label: "4" }] as const;
export const PER_VIEW_MOBILE = [AUTO, { value: "1", label: "1" }, PEEK(1), { value: "2", label: "2" }, PEEK(2)] as const;
export const CAROUSEL_STEPS = [
  { value: "1", label: "1 item" },
  { value: "2", label: "2 items" },
  { value: "3", label: "3 items" },
  { value: "page", label: "A whole row" },
] as const;

/** Items across per device, and how far an arrow moves. `when`: only for a carousel layout. */
export const carouselViewFields = (when?: { field: string; is: readonly (string | boolean)[] }) => {
  const opts = { group: "layout" as const, ...(when ? { when } : {}) };
  return [
    select("perDesktop", "Items across on desktop", PER_VIEW_DESKTOP, { ...opts, default: "auto" }),
    select("perTablet", "Items across on tablets", PER_VIEW_TABLET, { ...opts, default: "auto" }),
    select("perMobile", "Items across on phones", PER_VIEW_MOBILE, { ...opts, default: "auto" }),
    select("step", "Each arrow moves", CAROUSEL_STEPS, { ...opts, default: "1", display: "buttons" }),
  ] as const;
};

/** The most items the row shows. */
export const carouselMaxField = (fallback: number, max = 24, when?: { field: string; is: readonly (string | boolean)[] }) =>
  number("maxItems", "Show at most", { min: 1, max, default: fallback, group: "layout", ...(when ? { when } : {}) });

/**
 * A "show more" button under the row — its text and where it goes. `when` ties it to a
 * section's existing on/off ("Show 'view all'"); without one it brings its own switch.
 */
export const showMoreLinkField = (help: string, when?: { field: string; is: readonly (string | boolean)[] }) =>
  link("moreLink", "Show more button", { group: "layout", help, ...(when ? { when } : {}) });
export const showMoreToggle = () => toggle("showMore", "Show a “show more” button", { group: "layout" });

export * from "./carousel-view";
