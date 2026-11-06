import { ThemeBuilder } from "@/components/admin/theme-builder/theme-builder";
import { listCollections } from "@/lib/admin/collections";
import { getExampleMedia } from "@/lib/admin/example-media";
import { linkTargetsFrom } from "@/lib/admin/link-targets";
import { listAllEntries } from "@/lib/admin/metaobjects";
import { listMenus, menuChoices } from "@/lib/admin/menus";
import { listPages } from "@/lib/admin/pages";
import { getThemeState } from "@/lib/admin/theme-builder";

export const metadata = { title: "Appearance" };

/**
 * Website → Appearance: the Theme Builder — header, footer, site style and pop-ups. Reads the layout's three
 * copies and what the pickers offer, then hands them to the client editor.
 *
 * `key` is the draft revision, as on a page's Content tab: after a discard, a restore
 * or "load latest", the refreshed render mounts a fresh editor rather than one that
 * would have to reconcile its state with a layout it did not write.
 */
export default async function ThemeBuilderScreen() {
  const [state, pages, collections, menus, faqEntries] = await Promise.all([
    getThemeState(),
    listPages(),
    listCollections(),
    listMenus().catch(() => []),
    listAllEntries("faq_item").catch(() => []),
  ]);
  // For the sections under the header and in the footer, as on a page: what a new one
  // is filled with, and what the FAQ section's category picker offers.
  const examples = await getExampleMedia(collections);
  const faqCategories = [
    ...new Set(
      faqEntries
        .map((entry) => entry.fields.find((field) => field.key === "category")?.value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

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
        content: { header: state.draft.header, footer: state.draft.footer, global: state.draft.global, popups: state.draft.popups },
        revision: state.draft.meta.revision,
        hasPublished: state.published !== null,
        hasUnpublishedChanges: state.hasUnpublishedChanges,
        canRollback: state.canRollback,
        publishedInvalid: state.publishedInvalid,
      }}
      previewPages={previewPages}
      lookups={{ linkTargets: linkTargetsFrom(pages, collections), faqCategories, menus: menuChoices(menus), examples }}
      collections={collections
        .filter((collection) => collection.handle !== "frontpage")
        .map((collection) => ({
          id: collection.id,
          handle: collection.handle,
          title: collection.title,
          thumbnail: collection.image?.url ?? null,
        }))}
    />
  );
}
