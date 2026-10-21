/**
 * ONE status for a page, in the words a person acts on — the same in the Pages
 * list, the page builder's bar and the page's Settings bar. Whether the page is
 * shown at all (Settings) wins; then whether its content is up to date.
 *
 * No `server-only`: the builder computes it in the browser as edits happen.
 */

/** Where a page's builder content stands. `setup`: still its original layout; `fixed`: a code-only page. */
export type ContentStatus = "published" | "changes" | "draft" | "setup" | "fixed";

export type PageStatus = { label: string; tone: "live" | "waiting" | "off"; hint: string };

export function pageStatus(isPublished: boolean, content: ContentStatus): PageStatus {
  if (!isPublished) {
    return { label: "Hidden", tone: "off", hint: "Visitors can’t open this page. Switch it on in Settings." };
  }
  switch (content) {
    case "changes":
      return { label: "Changes not published", tone: "waiting", hint: "Visitors still see the old version. Press Publish to show your changes." };
    case "draft":
      return { label: "Not published yet", tone: "waiting", hint: "Visitors don’t see this content yet. Press Publish to put it on the site." };
    case "setup":
      return { label: "Live", tone: "live", hint: "Shown with its original layout. Open Content to edit it." };
    case "fixed":
      return { label: "Live", tone: "live", hint: "A standard page — only its title and search listing can be changed." };
    default:
      return { label: "Live", tone: "live", hint: "Visitors see the latest version." };
  }
}

/** The badge colours per tone — amber means "needs action", as everywhere in the panel. */
export const STATUS_TONE: Record<PageStatus["tone"], string> = {
  live: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  waiting: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400",
  off: "",
};
