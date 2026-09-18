import { Skeleton } from "@/components/admin/ui/skeleton";

/** Shaped like the pages list: heading, then a plain four-column table. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="bg-muted/40 h-10 border-b" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b px-3 py-3 last:border-b-0">
            <Skeleton className="h-4 w-full max-w-44" />
            <Skeleton className="h-4 w-full max-w-32" />
            <Skeleton className="h-4 w-full max-w-36" />
            <Skeleton className="h-5 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
