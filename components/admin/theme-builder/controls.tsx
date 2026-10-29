"use client";

import { ChevronRightIcon } from "lucide-react";
import * as React from "react";

import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { DEVICE_LABELS, DEVICES } from "@/lib/page-builder/design";

import { DEVICE_ICONS } from "../page-builder/editor-device";

/** Small controls the Theme Builder's panels share. */

export function Group({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-md border" open={defaultOpen || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="text-muted-foreground size-3.5 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="space-y-4 border-t px-3 py-3">{children}</div>
    </details>
  );
}

export function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ShowOn({
  id,
  hide,
  onChange,
}: {
  id: string;
  hide: Partial<Record<"d" | "t" | "m", boolean>> | undefined;
  onChange: (hide: Partial<Record<"d" | "t" | "m", boolean>> | undefined) => void;
}) {
  return (
    <div className="space-y-3">
      <span className="text-xs font-medium">Show on</span>
      {DEVICES.map((device) => {
        const Icon = DEVICE_ICONS[device];
        return (
          <div key={device} className="flex items-center justify-between gap-3">
            <Label htmlFor={`${id}-show-${device}`} className="flex items-center gap-2 text-xs font-normal">
              <Icon className="text-muted-foreground size-3.5" />
              {DEVICE_LABELS[device]}
            </Label>
            <Switch
              id={`${id}-show-${device}`}
              checked={!hide?.[device]}
              onCheckedChange={(show) => {
                const next = { ...hide, [device]: show ? undefined : true };
                for (const key of DEVICES) if (!next[key]) delete next[key];
                onChange(Object.keys(next).length ? next : undefined);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
