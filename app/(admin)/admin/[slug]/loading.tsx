import { Skeleton } from "@/components/admin/ui/skeleton";

/**
 * Shaped like the list screen it stands in for — heading, toolbar, table body — not a
 * centred spinner. That shape is what makes navigation feel continuous: the real content
 * lands in the boxes the skeleton already drew, instead of the page snapping together.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="ms-auto h-8 w-24" />
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="bg-muted/40 h-10 border-b" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b px-3 py-3 last:border-b-0">
              <Skeleton className="h-4 w-full max-w-40" />
              <Skeleton className="h-4 w-full max-w-24" />
              <Skeleton className="h-4 w-full max-w-32" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-56" />
        </div>
      </div>
    </div>
  );
}
