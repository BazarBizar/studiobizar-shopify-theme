import { Skeleton } from "@/components/admin/ui/skeleton";

/** Mirrors the editor: back link, title, the page card, then the metafield card. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3 w-32" />
      </div>

      <div className="space-y-5 rounded-xl border p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-16 shrink-0" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>

      <div className="space-y-6 rounded-xl border p-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
