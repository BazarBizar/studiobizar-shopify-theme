import { Badge } from "@/components/admin/ui/badge";

/**
 * The header for every LIST screen — one component rather than a block repeated per
 * page, so the vertical rhythm and type scale are identical wherever an operator
 * lands.
 *
 * Detail screens use a different, larger header with a way back; see
 * `components/admin/detail-header.tsx`. Those are the only two patterns — a third
 * one is how a panel starts feeling like several panels.
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  /** Machine identifier — a metaobject type, a handle. Rendered monospace. */
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {meta ? (
            <Badge variant="outline" className="font-mono text-[11px] font-normal">
              {meta}
            </Badge>
          ) : null}
        </div>

        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
