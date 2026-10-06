import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { UniversalSettings } from "@/lib/page-builder/define-section";
import type { PageDocument, SectionInstance } from "@/lib/page-builder/document";

import { RENDERERS, type RenderContext } from "./renderers";
import { SectionBoundary } from "./section-boundary";
import { SectionFrame } from "./section-frame";

/**
 * Draws a page document. The SAME component renders the live page and the
 * panel's preview — there is no preview-only version of anything.
 *
 * Every visible section's data loads in parallel, so a page of ten sections
 * costs the slowest one, not the sum. A section whose load throws is logged and
 * left out; the page still renders.
 *
 * A Server Component throughout. The only client JavaScript a builder page ships
 * is what its components already ship on the hand-built pages.
 */

type AnyRenderer = {
  load?: (settings: unknown) => Promise<unknown>;
  render: (settings: unknown, data: unknown, context: RenderContext & { id: string }) => React.ReactNode;
};

async function renderSection(section: SectionInstance, context: RenderContext) {
  const renderer = RENDERERS[section.type] as unknown as AnyRenderer;

  try {
    const data = renderer.load ? await renderer.load(section.settings) : undefined;
    const element = renderer.render(section.settings, data, { ...context, id: section.id });
    if (element === null || element === undefined || element === false) return null;

    return (
      <SectionFrame
        key={section.id}
        id={section.id}
        type={section.type}
        settings={section.settings as UniversalSettings}
      >
        <SectionBoundary id={section.id}>{element}</SectionBoundary>
      </SectionFrame>
    );
  } catch (error) {
    // `notFound()`, `redirect()` and Next's dynamic-usage signal are control flow,
    // not failures, and must reach Next.
    unstable_rethrow(error);
    console.error(`[page-builder] section ${section.type} ${section.id} could not load`, error);
    return null;
  }
}

export async function SectionRenderer({ doc, context }: { doc: PageDocument; context: RenderContext }) {
  const visible = doc.sections.filter((section) => section.visible);
  const rendered = await Promise.all(visible.map((section) => renderSection(section, context)));

  return <>{rendered}</>;
}
