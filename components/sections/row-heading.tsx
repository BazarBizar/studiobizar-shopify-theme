import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/** A row's heading with its `view all` link trailing on the right. */
export function RowHeading({
  title,
  href,
  className,
}: {
  title: string;
  href?: string;
  /** For a row that sits on its own band and needs a different ink. */
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex items-end justify-between gap-6", className)}>
      <h2 className="text-h2">{title}</h2>
      {href && (
        <ButtonLink href={href} className="shrink-0">
          view all
        </ButtonLink>
      )}
    </div>
  );
}
