import { Skeleton } from "@/components/admin/ui/skeleton";

/** Shaped like the library: heading, toolbar, then wide rows. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="overflow-hidden rounded-md border">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b p-3 last:border-b-0">
            <Skeleton className="size-14 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
