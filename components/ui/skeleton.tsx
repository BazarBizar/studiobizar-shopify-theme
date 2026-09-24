import { cn } from "@/lib/utils/cn";

/** Shaped like the thing it stands in for — never a full-page spinner. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse bg-foreground/10", className)} />;
}

export function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-card w-full" />
      {!compact && (
        <>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </>
      )}
    </div>
  );
}
