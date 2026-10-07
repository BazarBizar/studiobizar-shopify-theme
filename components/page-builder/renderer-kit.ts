import type { SectionType, SettingsFor } from "@/lib/page-builder/registry";

/**
 * The types every section renderer is written against, shared by
 * `renderers.tsx` and `renderers-landing.tsx`.
 */

export type RenderContext = {
  /** The Shopify page's own title — what Page heading shows when left empty. */
  pageTitle: string;
  /**
   * Drawing the builder's preview, not the live site. A section may then show a
   * neutral placeholder where a required image is still empty, so the operator
   * sees its shape; the live site never draws one.
   */
  preview?: boolean;
};

/**
 * What a renderer is told about where it is drawing.
 *
 * `inline` — this section sits inside the page heading's band (`placement:
 * "heading"`, see `section-renderer.tsx`). It then draws its content alone, with
 * the spacing and the empty-state line the hand-built page gives it, and no band
 * or heading of its own.
 *
 * `children` — for the page heading: the section drawn inside its band.
 */
export type SectionContext = RenderContext & {
  id: string;
  inline: boolean;
  children?: React.ReactNode;
  /** The first band on the page — its image is the one to load at once (Largest Contentful Paint). */
  first?: boolean;
};

export type Renderer<T extends SectionType, D> = {
  load?: (settings: SettingsFor<T>) => Promise<D>;
  render: (settings: SettingsFor<T>, data: D, context: SectionContext) => React.ReactNode;
};

/** Any renderer for `T`, whatever its data — what the map is checked against. */
export type SomeRenderer<T extends SectionType> = {
  load?: (settings: SettingsFor<T>) => Promise<unknown>;
  render: (settings: SettingsFor<T>, data: never, context: SectionContext) => React.ReactNode;
};

export function renderer<T extends SectionType, D = undefined>(definition: Renderer<T, D>): Renderer<T, D> {
  return definition;
}
