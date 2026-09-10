"use client";

import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { Card, CardContent } from "@/components/admin/ui/card";
import { useStoredJson } from "@/hooks/use-stored-preference";
import { cn } from "@/lib/utils/cn";

/**
 * The product page is long because a product genuinely is. Collapsible cards beat tabs
 * here: a tab hides the pane you are not looking at AND the fact that it has unsaved
 * changes.
 *
 * THREE RULES CARRY WEIGHT. None is decoration:
 *
 *  1. A collapsed section stays MOUNTED — hidden with CSS, never unmounted. Each editor
 *     keeps its draft in its own state, so unmounting a collapsed card throws away
 *     precisely the work somebody collapsed the card to get out of the way.
 *  2. A section with unsaved changes SAYS SO while collapsed, and "Collapse all" leaves
 *     it open. Hiding a pending edit is how an operator loses work without being told.
 *  3. The jump bar's order comes from the constant below, not from the order sections
 *     register themselves. Registration happens in an effect, and under
 *     `reactStrictMode` every section mounts, tears down and mounts again — which put the
 *     bar out of step with the page.
 */

export const PRODUCT_SECTIONS = [
  "media",
  "product",
  "specs",
  "seo",
  "channels",
  "details",
] as const;

export type ProductSectionId = (typeof PRODUCT_SECTIONS)[number];

const SECTION_LABELS: Record<ProductSectionId, string> = {
  media: "Media",
  product: "Product",
  specs: "Specifications",
  seo: "SEO",
  channels: "Channels",
  details: "Details",
};

type SectionState = { dirty: boolean; present: boolean };

const SectionContext = React.createContext<{
  collapsed: Record<string, boolean>;
  toggle: (id: ProductSectionId) => void;
  report: (id: ProductSectionId, state: SectionState) => void;
} | null>(null);

export function ProductSectionProvider({ children }: { children: React.ReactNode }) {
  /** Per OPERATOR, not per product: a preference about how to work, not about this record. */
  const [collapsed, setCollapsed] = useStoredJson<Record<string, boolean>>(
    "sb-admin.product-sections",
    {},
  );

  const [states, setStates] = React.useState<Record<string, SectionState>>({});

  const report = React.useCallback((id: ProductSectionId, state: SectionState) => {
    setStates((current) => {
      const previous = current[id];
      if (previous?.dirty === state.dirty && previous?.present === state.present) return current;
      return { ...current, [id]: state };
    });
  }, []);

  const toggle = React.useCallback(
    (id: ProductSectionId) => setCollapsed({ ...collapsed, [id]: !collapsed[id] }),
    [collapsed, setCollapsed],
  );

  const value = React.useMemo(() => ({ collapsed, toggle, report }), [collapsed, toggle, report]);

  return (
    <SectionContext.Provider value={value}>
      <SectionBar states={states} collapsed={collapsed} setCollapsed={setCollapsed} />
      {children}
    </SectionContext.Provider>
  );
}

function SectionBar({
  states,
  collapsed,
  setCollapsed,
}: {
  states: Record<string, SectionState>;
  collapsed: Record<string, boolean>;
  setCollapsed: (next: Record<string, boolean>) => void;
}) {
  // The admin header is `h-14 sticky top-0`; anything at top-0 in a page would sit under it.
  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-14 z-[9] -mx-4 flex flex-wrap items-center gap-1 border-b px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
      {/* Order from the constant, never from registration order. */}
      {PRODUCT_SECTIONS.filter((id) => states[id]?.present).map((id) => (
        <a
          key={id}
          href={`#section-${id}`}
          className="hover:bg-muted rounded-md px-2 py-1 text-xs transition-colors"
        >
          {SECTION_LABELS[id]}
          {states[id]?.dirty ? (
            <span
              className="ms-1 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
              aria-label="unsaved changes"
            />
          ) : null}
        </a>
      ))}

      <button
        type="button"
        onClick={() => {
          const next: Record<string, boolean> = { ...collapsed };
          for (const id of PRODUCT_SECTIONS) {
            // A section with unsaved changes stays OPEN. Collapsing it would hide an edit
            // the operator has not stored yet.
            next[id] = !states[id]?.dirty;
          }
          setCollapsed(next);
        }}
        className="text-muted-foreground hover:text-foreground ms-auto rounded-md px-2 py-1 text-xs"
      >
        Collapse all
      </button>
      <button
        type="button"
        onClick={() => setCollapsed({})}
        className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-xs"
      >
        Expand all
      </button>
    </div>
  );
}

export function CollapsibleSection({
  id,
  title,
  description,
  dirty = false,
  children,
}: {
  /** Typed by the tuple, so a section that is not registered fails to compile. */
  id: ProductSectionId;
  title: string;
  description?: string;
  dirty?: boolean;
  children: React.ReactNode;
}) {
  const context = React.useContext(SectionContext);
  if (!context) throw new Error("CollapsibleSection must be inside ProductSectionProvider");

  const { collapsed, toggle, report } = context;
  const isCollapsed = Boolean(collapsed[id]);

  React.useEffect(() => {
    report(id, { dirty, present: true });
    return () => report(id, { dirty: false, present: false });
  }, [id, dirty, report]);

  return (
    <Card id={`section-${id}`} className="gap-0 py-0 scroll-mt-28">
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-expanded={!isCollapsed}
        className="flex w-full items-center gap-2 px-6 py-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold">{title}</span>
            {/* Says so while collapsed — the whole point of rule 2. */}
            {dirty ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                Unsaved changes
              </span>
            ) : null}
          </span>
          {description ? (
            <span className="text-muted-foreground mt-0.5 block text-xs">{description}</span>
          ) : null}
        </span>

        <ChevronDownIcon
          className={cn("text-muted-foreground size-4 shrink-0 transition-transform", isCollapsed && "-rotate-90")}
        />
      </button>

      {/**
       * `hidden` rather than a conditional render: the children stay MOUNTED so their
       * draft state survives collapsing. Rule 1.
       */}
      <CardContent className={cn("border-t px-6 py-6", isCollapsed && "hidden")}>
        {children}
      </CardContent>
    </Card>
  );
}
