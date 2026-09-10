import { Skeleton } from "@/components/admin/ui/skeleton";

/** Shaped like the catalogue screen: heading, toolbar, table body. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="ms-auto h-8 w-44" />
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="bg-muted/40 h-10 border-b" />
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b px-3 py-3 last:border-b-0">
              <Skeleton className="size-9 shrink-0 rounded-md" />
              <Skeleton className="h-4 w-full max-w-56" />
              <Skeleton className="h-4 w-full max-w-20" />
              <Skeleton className="h-4 w-full max-w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
