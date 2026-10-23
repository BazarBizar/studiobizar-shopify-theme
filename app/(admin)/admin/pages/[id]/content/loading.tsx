import { PendingPageBar } from "@/components/admin/pages-table/pending-page-bar";
import { Skeleton } from "@/components/admin/ui/skeleton";

/** The Content tab loading: the page's bar as it was, then the builder's outline — sections left, preview right. */
export default function Loading() {
  return (
    <div className="-m-4 flex h-[calc(100svh-3.5rem)] flex-col md:-m-6">
      <PendingPageBar active="content" />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-2 border-r p-3">
          <Skeleton className="mb-3 h-4 w-20" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </aside>
        <div className="bg-muted/40 hidden p-4 lg:block">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}
