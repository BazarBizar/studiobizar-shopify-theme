import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/** A row's heading with its `view all` link trailing on the right. */
export function RowHeading({
  title,
  href,
  label = "view all",
  className,
}: {
  title: string;
  href?: string;
  /** The button's text — "view all" unless the builder's "Show more button" says otherwise. */
  label?: string;
  /** For a row that sits on its own band and needs a different ink. */
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex items-end justify-between gap-6", className)}>
      <h2 className="text-h2">{title}</h2>
      {href && (
        <ButtonLink href={href} className="shrink-0">
          {label}
        </ButtonLink>
      )}
    </div>
  );
}
