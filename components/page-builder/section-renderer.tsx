import "server-only";

import { unstable_rethrow } from "next/navigation";

import { NEUTRAL_STYLE, type UniversalSettings } from "@/lib/page-builder/define-section";
import type { PageDocument, SectionInstance } from "@/lib/page-builder/document";

import { RENDERERS, type RenderContext, type SectionContext } from "./renderers";
import { SectionBoundary } from "./section-boundary";
import { SectionFrame } from "./section-frame";

/**
 * Draws a page document. The SAME component renders the live page and the
 * panel's preview — there is no preview-only version of anything.
 *
 * Every visible section's data loads in parallel, so a page of ten sections
 * costs the slowest one, not the sum. A section whose load or render throws is
 * logged and left out; the page still renders.
 *
 * ONE PAIRING. A Page heading followed by a section whose `placement` is
 * "heading" draws that section inside its own band, as the FAQ, Our Locations,
 * Our Designers and Gallery pages have always had their content: one container
 * from the heading down. The inner section keeps its own wrapper, so the preview
 * can still select it.
 *
 * A Server Component throughout. The only client JavaScript a builder page ships
 * is what its components already ship on the hand-built pages.
 */

type AnyRenderer = {
  load?: (settings: unknown) => Promise<unknown>;
  render: (settings: unknown, data: unknown, context: SectionContext) => React.ReactNode;
};

type Loaded = { section: SectionInstance; data: unknown; ok: boolean };

const rendererFor = (section: SectionInstance) => RENDERERS[section.type] as unknown as AnyRenderer;

async function load(section: SectionInstance): Promise<Loaded> {
  try {
    const renderer = rendererFor(section);
    return { section, data: renderer.load ? await renderer.load(section.settings) : undefined, ok: true };
  } catch (error) {
    // `notFound()`, `redirect()` and Next's dynamic-usage signal are control flow,
    // not failures, and must reach Next.
    unstable_rethrow(error);
    console.error(`[page-builder] section ${section.type} ${section.id} could not load`, error);
    return { section, data: undefined, ok: false };
  }
}

function draw(item: Loaded, context: SectionContext): React.ReactNode {
  if (!item.ok) return null;
  try {
    const element = rendererFor(item.section).render(item.section.settings, item.data, context);
    return element === null || element === undefined || element === false ? null : element;
  } catch (error) {
    console.error(`[page-builder] section ${item.section.type} ${item.section.id} could not render`, error);
    return null;
  }
}

function framed(section: SectionInstance, element: React.ReactNode, settings: UniversalSettings) {
  return (
    <SectionFrame key={section.id} id={section.id} type={section.type} settings={settings}>
      <SectionBoundary id={section.id}>{element}</SectionBoundary>
    </SectionFrame>
  );
}

const sitsUnderHeading = (section: SectionInstance | undefined) =>
  (section?.settings as { placement?: unknown } | undefined)?.placement === "heading";

export async function SectionRenderer({ doc, context }: { doc: PageDocument; context: RenderContext }) {
  const visible = doc.sections.filter((section) => section.visible);
  const loaded = await Promise.all(visible.map(load));

  const out: React.ReactNode[] = [];

  for (let index = 0; index < loaded.length; index += 1) {
    const item = loaded[index]!;
    const next = loaded[index + 1];

    if (item.section.type === "page_heading" && next && sitsUnderHeading(next.section)) {
      const inner = draw(next, { ...context, id: next.section.id, inline: true });
      // Inside the heading's band its own ground, spacing and style do not apply;
      // only per-device visibility still does.
      const children = inner
        ? framed(next.section, inner, {
            ...NEUTRAL_STYLE,
            surface: "inherit",
            rhythm: "default",
            hideOn: (next.section.settings as UniversalSettings).hideOn,
          })
        : null;

      const heading = draw(item, { ...context, id: item.section.id, inline: false, children });
      if (heading) out.push(framed(item.section, heading, item.section.settings as UniversalSettings));
      index += 1;
      continue;
    }

    const element = draw(item, { ...context, id: item.section.id, inline: false, first: out.length === 0 });
    if (element) out.push(framed(item.section, element, item.section.settings as UniversalSettings));
  }

  return <>{out}</>;
}
