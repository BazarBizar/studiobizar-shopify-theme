import { DesignerCard } from "@/components/designer/designer-card";
import type { Designer } from "@/lib/shopify/entities";
import { cn } from "@/lib/utils/cn";

/** Designer portraits on the 4-up grid from Our Designers. The first row loads eagerly. */
export function DesignerGrid({
  designers,
  className,
  showStudio = true,
}: {
  designers: Designer[];
  className?: string;
  showStudio?: boolean;
}) {
  return (
    <ul className={cn("sb-grid-4", className, "gap-y-12")}>
      {designers.map((designer, index) => (
        <li key={designer.handle}>
          <DesignerCard designer={designer} priority={index < 4} showStudio={showStudio} />
        </li>
      ))}
    </ul>
  );
}
