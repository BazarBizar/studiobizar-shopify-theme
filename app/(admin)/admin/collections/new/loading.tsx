import { Skeleton } from "@/components/admin/ui/skeleton";

/** Mirrors the edit screen: back link, title, then the field rows of the form card. */
export default function Loading() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3 w-40" />
      </div>

      <div className="space-y-6 rounded-xl border py-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid gap-2 px-6 sm:grid-cols-[13rem_1fr] sm:gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
