import Link from "next/link";

import type { MenuLink } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

/**
 * What opens under a header link — the original header and the Theme Builder's menu
 * element both draw it. Pure CSS (hover and focus-within), no script.
 *
 *  - Links under it, none deeper: a DROPDOWN, a short list beside the link.
 *  - A third level anywhere under it: a MEGA MENU, a panel the width of the header —
 *    each second-level link a column heading, its own links beneath.
 *
 * The colours follow the Theme Builder's dropdown colours (`--sb-dd-bg` / `--sb-dd-fg`)
 * where it set them, the page's ground otherwise. The Liquid twin is in
 * `theme/sections/sb-header.liquid`.
 */

export const isMegaMenu = (item: MenuLink) => item.items.some((child) => child.items.length > 0);

/**
 * The classes of the `<li>` holding a top-level link. A mega menu's `<li>` is NOT
 * positioned, so the panel measures itself against the header (sticky, or `relative`)
 * and spans its whole width.
 */
export function menuHostClass(item: MenuLink): string {
  if (!item.items.length) return "";
  return isMegaMenu(item) ? "group" : "group relative";
}

/**
 * On a mega menu's link: an invisible strip from the link down to the header's foot,
 * where the panel starts, so the pointer crossing that space keeps it open. On
 * `::before`, because `sb-underline` draws its line with `::after`.
 */
export function menuLinkClass(item: MenuLink): string {
  return isMegaMenu(item) ? "relative before:absolute before:inset-x-0 before:top-full before:h-10 before:content-['']" : "";
}

const PANEL = cn(
  "invisible z-10 opacity-0 shadow-sm transition-[opacity,visibility] duration-150",
  "bg-[var(--sb-dd-bg,var(--sb-background))] text-[var(--sb-dd-fg,var(--sb-foreground))]",
  "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
);

export function MenuDropdown({ item }: { item: MenuLink }) {
  if (!item.items.length) return null;

  if (!isMegaMenu(item)) {
    return (
      <ul className={cn(PANEL, "absolute top-full left-0 mt-3 min-w-48 border border-border py-2")}>
        {item.items.map((child) => (
          <li key={child.id}>
            <Link href={child.href} className="text-secondary block px-4 py-2 whitespace-nowrap hover:bg-foreground/5">
              {child.title}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn(PANEL, "absolute inset-x-0 top-full border-y border-border")}>
      <div className="sb-container grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-10 gap-y-8 py-8">
        {item.items.map((column) => (
          <div key={column.id}>
            <Link href={column.href} className="text-secondary sb-underline font-medium">
              {column.title}
            </Link>
            {column.items.length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {column.items.map((link) => (
                  <li key={link.id}>
                    <Link href={link.href} className="text-tertiary opacity-80 transition-opacity hover:opacity-100">
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
