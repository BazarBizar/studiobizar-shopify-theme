import { PendingPageBar } from "@/components/admin/pages-table/pending-page-bar";
import { Skeleton } from "@/components/admin/ui/skeleton";

/** The Settings tab loading: the page's bar as it was, then its two cards. */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PendingPageBar active="settings" className="-mx-4 -mt-4 md:-mx-6 md:-mt-6" />

      <div className="space-y-5 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
          <Skeleton className="h-10 w-28 shrink-0" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
