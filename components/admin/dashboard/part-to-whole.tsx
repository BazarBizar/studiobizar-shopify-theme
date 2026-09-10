import { Card, CardContent } from "@/components/admin/ui/card";
import { SERIES, type SeriesKey } from "@/lib/admin/series-colors";

import { formatNumber } from "./stat-tile";

/**
 * The one chart on this dashboard, for the one genuinely part-to-whole figure.
 *
 * Built from divs rather than a chart library: at this size a charting dependency buys
 * nothing and costs a bundle. There is no trend, no period comparison — the dashboard
 * answers "what does this store look like right now".
 */

type Segment = { label: string; value: number; series: SeriesKey };

export function PartToWhole({
  title,
  segments,
  total,
  noun,
}: {
  title: string;
  segments: Segment[];
  total: number;
  noun: string;
}) {
  // Zero-value segments are REMOVED, not drawn as a hair-thin sliver that cannot be
  // hovered and reads as a rendering artefact.
  const visible = segments.filter((segment) => segment.value > 0);

  const percent = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100));

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-muted-foreground text-xs">
            {formatNumber(total)} {noun}
          </p>
        </div>

        {total === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nothing to show yet.</p>
        ) : (
          <>
            <div
              /* One label naming every segment and its value, so the bar is not
                 information carried by colour alone. */
              role="img"
              aria-label={`${title}: ${visible
                .map((segment) => `${segment.label} ${segment.value}`)
                .join(", ")}, of ${total} ${noun} total`}
              // 2px gaps so two fills never touch and read as one block.
              className="flex h-3 w-full gap-0.5"
            >
              {visible.map((segment) => (
                <div
                  key={segment.label}
                  title={`${segment.label}: ${segment.value} (${percent(segment.value)}%)`}
                  className={`rounded-lg ${SERIES[segment.series].bg}`}
                  style={{ width: `${(segment.value / total) * 100}%` }}
                />
              ))}
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {segments.map((segment) => (
                <div key={segment.label}>
                  <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <span
                      className={`size-2 shrink-0 rounded-xs ${SERIES[segment.series].bg}`}
                      aria-hidden
                    />
                    {segment.label}
                  </dt>
                  <dd className="mt-0.5 flex items-baseline gap-1.5">
                    {/* `tabular-nums` HERE, unlike the KPI tiles: these are a column of
                        figures meant to be compared down the list. */}
                    <span className="text-sm font-medium tabular-nums">
                      {formatNumber(segment.value)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {percent(segment.value)}%
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
