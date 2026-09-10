/**
 * The panel's only categorical colours. Validated, not chosen by eye — do not
 * substitute hues without re-measuring against the panel's real surfaces (card
 * `#ffffff`/`#171717`, sidebar `#fafafa`/`#171717`).
 *
 * WHY BLUE AND ORANGE FOR TWO SERIES THAT MUST BE TOLD APART. The obvious pairing
 * — green for active, amber for draft (`#0ca30c` + `#c98500`) — measures
 * **CVD ΔE 3.0 under protanopia**: a red-green colourblind operator cannot
 * distinguish them at all. Green + blue fails differently, at ΔE 5.1 under
 * tritanopia in dark mode. Blue + orange passes in both modes, worst case ΔE 24.7
 * light / 26.8 dark. Never use green/red for two series that carry meaning.
 *
 * WHY THESE ARE FULL CLASS STRINGS and not composed from a hex at runtime:
 * Tailwind scans source text for literal class names, so `text-[${hex}]` produces
 * no CSS at all. Each pairing has to appear verbatim somewhere in the source.
 *
 * ONE ACCESSIBILITY CAVEAT. Aqua in light mode sits at 2.7:1 against the sidebar
 * surface, under the 3:1 floor for a mark that carries meaning on its own. It is
 * legitimate there ONLY because every sidebar icon has a text label beside it.
 * Do not reuse that hex for a bare mark — a status dot, a legend swatch with no
 * text, a chart segment without a label.
 */

export type SeriesKey = "blue" | "orange" | "aqua" | "violet" | "grey";

type Series = {
  /** Foreground, for icons and text. */
  text: string;
  /** Background, for legend swatches and bar segments. */
  bg: string;
};

export const SERIES: Record<SeriesKey, Series> = {
  /** slot 1 — active products, Catalogue */
  blue: { text: "text-[#2a78d6] dark:text-[#3987e5]", bg: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  /** slot 2 — drafts, Customers */
  orange: { text: "text-[#eb6834] dark:text-[#d95926]", bg: "bg-[#eb6834] dark:bg-[#d95926]" },
  /** slot 3 — Content. See the contrast caveat above. */
  aqua: { text: "text-[#1baf7a] dark:text-[#199e70]", bg: "bg-[#1baf7a] dark:bg-[#199e70]" },
  /** slot 7 — Inbox */
  violet: { text: "text-[#4a3aa7] dark:text-[#9085e9]", bg: "bg-[#4a3aa7] dark:bg-[#9085e9]" },
  /** de-emphasis — archived, uncategorised */
  grey: { text: "text-[#898781] dark:text-[#898781]", bg: "bg-[#898781] dark:bg-[#898781]" },
};

/**
 * Sidebar group -> series. Keys match `GroupKey` in `lib/admin/groups.ts`; kept
 * here rather than there so the grouping logic carries no presentation.
 */
export const GROUP_SERIES: Record<string, SeriesKey> = {
  catalogue: "blue",
  pages: "aqua",
  library: "orange",
  inbox: "violet",
  other: "grey",
};

export function seriesFor(group: string): Series {
  return SERIES[GROUP_SERIES[group] ?? "grey"];
}
