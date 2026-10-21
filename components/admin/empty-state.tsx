import { cn } from "@/lib/utils/cn";

/**
 * The single "nothing here" presentation — the same two lines the tables use: what
 * is missing, and what to do about it. Never just "No results".
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  /** A button that fixes it, when there is one. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1 px-4 py-10 text-center", className)}>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
