"use client";

import { endOfDay, format, startOfDay, subDays, subMonths } from "date-fns";
import { PlusCircleIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Calendar } from "@/components/admin/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { Separator } from "@/components/admin/ui/separator";

/**
 * Date range filter, shared by both load strategies.
 *
 * Controlled and deliberately agnostic: the caller decides whether the selected range
 * becomes a TanStack column filter or an `updated_at` bound in a Shopify query. That
 * is why this component holds no filter logic of its own.
 */

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
] as const;

export function DateRangeFilter({
  title = "Updated",
  value,
  onChange,
}: {
  title?: string;
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}) {
  /**
   * A single selected day means THE WHOLE DAY. The picker hands back an instant at
   * midnight local time; comparing a timestamp against that matches only rows saved
   * in the same millisecond, so the range has to be widened to the day's bounds.
   */
  const commit = (range: DateRange | undefined) => {
    if (!range?.from) {
      onChange(undefined);
      return;
    }

    onChange({
      from: startOfDay(range.from),
      to: endOfDay(range.to ?? range.from),
    });
  };

  const preset = (days: number) => {
    const now = new Date();
    onChange({ from: startOfDay(subDays(now, days)), to: endOfDay(now) });
  };

  const label = value?.from
    ? value.to && format(value.from, "yyyy-MM-dd") !== format(value.to, "yyyy-MM-dd")
      ? `${format(value.from, "d MMM")} – ${format(value.to, "d MMM")}`
      : format(value.from, "d MMM yyyy")
    : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="border-dashed">
          <PlusCircleIcon className="size-3.5" />
          {title}
          {label ? (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                {label}
              </Badge>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="flex w-auto gap-0 p-0" align="start">
        {/* Relative presets first, on the left: this is how people actually reach for
            a date filter — "the last week", not two specific calendar days. */}
        <div className="flex w-40 shrink-0 flex-col gap-1 border-r p-2">
          {PRESETS.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => preset(item.days)}
            >
              {item.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              const now = new Date();
              onChange({ from: startOfDay(subMonths(now, 12)), to: endOfDay(now) });
            }}
          >
            Last 12 months
          </Button>

          <Separator className="my-1" />

          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => onChange(undefined)}
          >
            Clear
          </Button>
        </div>

        <Calendar
          mode="range"
          selected={value}
          onSelect={commit}
          // Two months so a range crossing a month boundary needs no paging.
          numberOfMonths={2}
          // A future range can never match anything that already exists.
          disabled={{ after: new Date() }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
