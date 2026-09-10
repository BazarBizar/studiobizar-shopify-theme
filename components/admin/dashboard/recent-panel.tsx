import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { AppLink } from "@/components/admin/app-link";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Skeleton } from "@/components/admin/ui/skeleton";
import type { RecentEntry } from "@/lib/admin/dashboard";

/**
 * A short "most recently updated" list. Four rows stay a LIST — a chart over four rows is
 * a graphic pretending to be an analysis.
 */
export function RecentPanel({
  title,
  allHref,
  allLabel,
  entries,
  loading = false,
  emptyMessage,
}: {
  title: string;
  allHref: string;
  allLabel: string;
  entries: RecentEntry[];
  loading?: boolean;
  emptyMessage: string;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <AppLink
            href={allHref}
            showPending={false}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            {allLabel}
          </AppLink>
        </div>

        {loading ? (
          <ul className="divide-border divide-y">
            {Array.from({ length: 4 }).map((_, index) => (
              <li key={index} className="flex items-center gap-3 py-2">
                <Skeleton className="size-9 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{emptyMessage}</p>
        ) : (
          <ul className="divide-border divide-y">
            {entries.map((entry) => (
              <li key={entry.id}>
                <AppLink
                  href={`/admin/${entry.type}/${entry.param}`}
                  showPending={false}
                  className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors"
                >
                  <span className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                    {entry.thumbnail ? (
                      <Image
                        src={entry.thumbnail}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="text-muted-foreground size-3.5" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{entry.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {entry.meta || "—"}
                    </span>
                  </span>
                </AppLink>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
