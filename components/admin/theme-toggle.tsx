"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const;

/** A store that never changes: false on the server, true once hydrated. */
const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Light / dark / system for the panel only. The storefront defines no `.dark` rules — it
 * uses the `data-surface` grounds — so this cannot darken the shop.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  /**
   * `next-themes` reads `localStorage` synchronously on the client and the server has no
   * way to know the answer, so rendering the active icon before hydration is a guaranteed
   * mismatch. Until then, show the neutral monitor icon.
   *
   * Done with `useSyncExternalStore` rather than `useState` + `useEffect`: the effect
   * version sets state on mount, which cascades an extra render and trips
   * `react-hooks/set-state-in-effect`. This has an explicit server snapshot, so React
   * knows the two passes are meant to differ and corrects it during hydration instead.
   */
  const mounted = React.useSyncExternalStore(noopSubscribe, onClient, onServer);

  const active = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[2];
  const Icon = mounted ? active.Icon : MonitorIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Change theme">
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className="gap-2"
          >
            <option.Icon className="size-3.5" />
            {option.label}
            {mounted && theme === option.value ? (
              <span className="text-muted-foreground ms-auto text-xs">Active</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
