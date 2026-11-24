import { notFound } from "next/navigation";

import { PageBuilder } from "@/components/admin/page-builder/page-builder";
import { defaultSample, templateSamples } from "@/components/page-builder/template-record";
import { listCollections } from "@/lib/admin/collections";
import { getExampleMedia } from "@/lib/admin/example-media";
import { linkTargetsFrom } from "@/lib/admin/link-targets";
import { listAllEntries } from "@/lib/admin/metaobjects";
import { listPages } from "@/lib/admin/pages";
import { getTemplateState } from "@/lib/admin/templates";
import { getThemeState } from "@/lib/admin/theme-builder";
import { isTemplateKind, TEMPLATES } from "@/lib/page-builder/template-kinds";

export const metadata = { title: "Template" };

/**
 * Website → Templates → one template, in the page builder. The same editor as a page's
 * Content tab, saving to the template's copies on the shop and previewing it with an
 * item the operator picks ("Preview with").
 *
 * `key` is the draft revision, as on a page: after a discard, a restore or "load
 * latest", the refreshed render mounts a fresh editor.
 */
export default async function TemplateScreen({ params }: PageProps<"/admin/templates/[kind]">) {
  const { kind } = await params;
  if (!isTemplateKind(kind)) notFound();

  const [state, collections, pages, faqEntries, samples] = await Promise.all([
    getTemplateState(kind),
    listCollections(),
    listPages(),
    listAllEntries("faq_item").catch(() => []),
    templateSamples(kind),
  ]);
  const [examples, savedColours, sample] = await Promise.all([
    getExampleMedia(collections),
    getThemeState()
      .then((theme) => theme.draft.global.colors)
      .catch(() => []),
    defaultSample(kind, samples),
  ]);

  const faqCategories = [
    ...new Set(
      faqEntries
        .map((entry) => entry.fields.find((field) => field.key === "category")?.value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const info = TEMPLATES[kind];

  return (
    <PageBuilder
      key={state.draft.meta.revision}
      page={{ id: kind, param: kind, title: `${info.label} template`, handle: kind, isPublished: true }}
      initial={{
        content: { page: state.draft.page, sections: state.draft.sections },
        revision: state.draft.meta.revision,
        hasPublished: state.published !== null,
        hasUnpublishedChanges: state.hasUnpublishedChanges,
        canRollback: state.canRollback,
        dropped: state.dropped,
        publishedInvalid: state.publishedInvalid,
      }}
      collections={collections
        .filter((collection) => collection.handle !== "frontpage")
        .map((collection) => ({
          id: collection.id,
          handle: collection.handle,
          title: collection.title,
          thumbnail: collection.image?.url ?? null,
        }))}
      lookups={{ linkTargets: linkTargetsFrom(pages, collections), faqCategories, examples, savedColours }}
      publicPath={info.path}
      template={{ kind, samples, sample }}
    />
  );
}
