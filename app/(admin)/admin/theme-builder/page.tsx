import { ThemeBuilder } from "@/components/admin/theme-builder/theme-builder";
import { listCollections } from "@/lib/admin/collections";
import { linkTargetsFrom } from "@/lib/admin/link-targets";
import { listPages } from "@/lib/admin/pages";
import { getThemeState } from "@/lib/admin/theme-builder";

export const metadata = { title: "Header & footer" };

/**
 * Website → Header & footer: the Theme Builder. Reads the layout's three copies and
 * what the pickers offer, then hands them to the client editor.
 *
 * `key` is the draft revision, as on a page's Content tab: after a discard, a restore
 * or "load latest", the refreshed render mounts a fresh editor rather than one that
 * would have to reconcile its state with a layout it did not write.
 */
export default async function ThemeBuilderScreen() {
  const [state, pages, collections] = await Promise.all([getThemeState(), listPages(), listCollections()]);

  // The preview can show any visible page; the home page first.
  const visible = pages.filter((page) => page.isPublished);
  const previewPages = [
    ...visible.filter((page) => page.handle === "home"),
    ...visible.filter((page) => page.handle !== "home").sort((a, b) => a.title.localeCompare(b.title)),
  ].map((page) => ({ handle: page.handle, title: page.handle === "home" ? "Home page" : page.title }));

  return (
    <ThemeBuilder
      key={state.draft.meta.revision}
      initial={{
        content: { header: state.draft.header, footer: state.draft.footer, global: state.draft.global },
        revision: state.draft.meta.revision,
        hasPublished: state.published !== null,
        hasUnpublishedChanges: state.hasUnpublishedChanges,
        canRollback: state.canRollback,
        publishedInvalid: state.publishedInvalid,
      }}
      previewPages={previewPages}
      lookups={{ linkTargets: linkTargetsFrom(pages, collections), faqCategories: [] }}
    />
  );
}
