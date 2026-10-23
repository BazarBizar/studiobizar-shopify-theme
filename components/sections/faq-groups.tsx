import { Accordion } from "@/components/ui/accordion";
import type { FaqGroup } from "@/lib/shopify/entities";
import { cn } from "@/lib/utils/cn";

/**
 * Questions as native `<details>` panels, under a small-caps category heading per
 * group — the FAQ page. A group with no category (a page builder FAQ written by
 * hand) has no heading.
 */
export function FaqGroups({ groups, className }: { groups: FaqGroup[]; className?: string }) {
  return (
    <div className={cn(className, "max-w-[52rem]")}>
      {groups.map((group, index) => (
        <section key={group.category ?? `group-${index}`} className="mb-12">
          {group.category && (
            <h2 className="text-h3 mb-2 text-muted uppercase tracking-[0.06em]">{group.category}</h2>
          )}
          {group.items.map((item) => (
            <Accordion key={item.handle} title={item.question}>
              <div dangerouslySetInnerHTML={{ __html: item.answer }} />
            </Accordion>
          ))}
        </section>
      ))}
    </div>
  );
}
