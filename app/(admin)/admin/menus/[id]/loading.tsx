import { Skeleton } from "@/components/admin/ui/skeleton";

/** Mirrors the editor: back link, title, then the rows of the link list. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3 w-64" />
      </div>

      <div className="space-y-4 rounded-xl border p-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 rounded-md border p-2">
            <Skeleton className="mt-1.5 size-6 shrink-0" />
            <div className="grid flex-1 gap-2 sm:grid-cols-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="size-9 shrink-0" />
          </div>
        ))}
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
