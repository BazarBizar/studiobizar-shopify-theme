import type { UniversalSettings } from "@/lib/page-builder/define-section";
import { cn } from "@/lib/utils/cn";

/**
 * The wrapper every builder section renders inside. It applies the three
 * universal settings with what `globals.css` already has, and nothing else:
 *
 *  - `surface` → `data-surface`, which re-points every colour token beneath it;
 *  - `rhythm`  → `section-*`, which retunes every `py-section` / `pb-section`
 *    inside the band, so the component's own spacing classes follow;
 *  - `hideOn`  → a display class at the design's one breakpoint (750px).
 *
 * The component inside is untouched. Class names are written out in full because
 * Tailwind only emits what it can read in the source.
 *
 * `data-section-id` is how the preview finds a section to scroll to and outline.
 */

const RHYTHM: Record<UniversalSettings["rhythm"], string> = {
  default: "",
  xs: "section-xs",
  sm: "section-sm",
  md: "section-md",
  lg: "section-lg",
  xl: "section-xl",
};

const HIDE: Record<UniversalSettings["hideOn"], string> = {
  none: "",
  mobile: "max-sm:hidden",
  desktop: "sm:hidden",
};

export function SectionFrame({
  id,
  type,
  settings,
  children,
}: {
  id: string;
  type: string;
  settings: UniversalSettings;
  children: React.ReactNode;
}) {
  const painted = settings.surface !== "inherit";

  return (
    <div
      data-section-id={id}
      data-section-type={type}
      data-surface={painted ? settings.surface : undefined}
      className={cn(
        // `flow-root` keeps a child's margin inside the band, so a painted ground
        // reaches the edge of what the section draws.
        painted && "flow-root bg-background text-foreground",
        RHYTHM[settings.rhythm],
        HIDE[settings.hideOn],
      )}
    >
      {children}
    </div>
  );
}
