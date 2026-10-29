"use client";

import { ChevronRightIcon, LogOutIcon } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Collapsible } from "radix-ui";
import * as React from "react";

import { AppLink } from "@/components/admin/app-link";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/admin/ui/sidebar";
import { navIconName } from "@/lib/admin/nav-icons";
import { seriesFor } from "@/lib/admin/series-colors";
import { cn } from "@/lib/utils/cn";

export type SidebarItem = {
  href: string;
  label: string;
  /** Group key. Drives the icon TINT, and the icon itself only as a fallback. */
  group: string;
  /** Metaobject type, or null for a bespoke screen. */
  type?: string | null;
  /** Unread/needs-attention count. Amber, like every other "needs action" marker. */
  badge?: number;
  /** Other path prefixes this row is active for. */
  matches?: string[];
};

/** `menu`: one row that opens to its items, instead of a heading over a list — see `NavGroup`. */
export type SidebarSection = { key: string; label: string | null; items: SidebarItem[]; menu?: boolean };

/** Amber and a number, and the aria-label spells it out — the colour is never the only carrier. */
function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-label={`${count} unread`}
      className={cn(
        "ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white group-data-[collapsible=icon]:hidden",
        className,
      )}
    >
      {count}
    </span>
  );
}

/**
 * A section drawn as ONE row — Inbox, Settings — that opens to its screens. Open by
 * itself when one of them is the page, so the current place is never folded away;
 * closed, it carries its items' unread count. With the sidebar folded to icons there
 * is no room for a list, so the row opens a menu beside it instead.
 */
function NavMenu({ section, isActive }: { section: SidebarSection; isActive: (item: SidebarItem) => boolean }) {
  const { state, isMobile } = useSidebar();
  const active = section.items.some(isActive);
  const [open, setOpen] = React.useState(active);
  // Arriving on one of its screens (from a link elsewhere) opens it; leaving does not close it.
  const [wasActive, setWasActive] = React.useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setOpen(true);
  }

  const label = section.label ?? "";
  // An element, not a component: the icon is looked up, not made here.
  const icon = React.createElement(navIconName("", null, section.key), {
    className: cn("size-4 shrink-0", seriesFor(section.key).text),
  });
  const count = section.items.reduce((sum, item) => sum + (item.badge ?? 0), 0);
  const closedCount = !open && count > 0;

  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton isActive={active} tooltip={label}>
              {icon}
              <span className="truncate">{label}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-48">
            <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
            {section.items.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <AppLink href={item.href} showPending={false} className={cn(isActive(item) && "font-medium")}>
                  <span className="truncate">{item.label}</span>
                  {item.badge ? <CountBadge count={item.badge} /> : null}
                </AppLink>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible.Root asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <Collapsible.Trigger asChild>
          {/* Marked as the current place only while closed — open, the item inside is. */}
          <SidebarMenuButton isActive={active && !open} tooltip={label}>
            {icon}
            <span className="truncate">{label}</span>
            {closedCount ? <CountBadge count={count} /> : null}
            <ChevronRightIcon
              className={cn("size-4 shrink-0 opacity-60 transition-transform", !closedCount && "ms-auto", open && "rotate-90")}
            />
          </SidebarMenuButton>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <SidebarMenuSub>
            {section.items.map((item) => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton asChild isActive={isActive(item)}>
                  <AppLink href={item.href} showPending={false}>
                    <span className="truncate">{item.label}</span>
                    {item.badge ? <CountBadge count={item.badge} className="h-4 min-w-4 text-[10px]" /> : null}
                  </AppLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </Collapsible.Content>
      </SidebarMenuItem>
    </Collapsible.Root>
  );
}

/** Sections in order, with neighbouring menus gathered into one group — two rows, not two headed groups. */
function runs(sections: SidebarSection[]): (SidebarSection | SidebarSection[])[] {
  const out: (SidebarSection | SidebarSection[])[] = [];
  for (const section of sections) {
    const last = out.at(-1);
    if (section.menu && Array.isArray(last)) last.push(section);
    else out.push(section.menu ? [section] : section);
  }
  return out;
}

export function AppSidebar({
  sections,
  email,
  brand = { title: "Studio Bizar", subtitle: "Admin", initials: "SB", logoUrl: null },
  loading = false,
  onSignOut,
}: {
  sections: SidebarSection[];
  email: string;
  /** From `admin_settings`; see `lib/admin/admin-settings.ts`. */
  brand?: { title: string; subtitle: string; initials: string; logoUrl: string | null };
  loading?: boolean;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  const under = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const isActive = (item: SidebarItem) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : under(item.href) || (item.matches ?? []).some(under);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <AppLink href="/admin" showPending={false}>
                {/* The logo, when one is set, takes the initials' place at the same
                    size — the square is also what's left when the sidebar collapses. */}
                {brand.logoUrl ? (
                  <Image
                    src={brand.logoUrl}
                    alt=""
                    width={32}
                    height={32}
                    unoptimized
                    className="aspect-square size-8 shrink-0 rounded-md object-contain"
                  />
                ) : (
                  <div
                    className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md text-[11px] font-semibold tracking-tight"
                    aria-hidden
                  >
                    {brand.initials}
                  </div>
                )}
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{brand.title}</span>
                  <span className="text-muted-foreground truncate text-xs">{brand.subtitle}</span>
                </div>
              </AppLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {loading ? (
          /* A skeleton, not an empty sidebar: the sections come from Shopify, and
             an empty nav reads as "this store has nothing in it". */
          <SidebarGroup>
            <SidebarMenu>
              {Array.from({ length: 6 }).map((_, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          runs(sections).map((run) =>
            Array.isArray(run) ? (
              <SidebarGroup key={run.map((section) => section.key).join("+")}>
                <SidebarMenu>
                  {run.map((section) => (
                    <NavMenu key={section.key} section={section} isActive={isActive} />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ) : (
              <SidebarGroup key={run.key}>
                {run.label ? <SidebarGroupLabel>{run.label}</SidebarGroupLabel> : null}

                <SidebarMenu>
                  {run.items.map((item) => {
                    // Matched to what the row IS, falling back to the group for a
                    // definition nobody has given an icon yet.
                    const Icon = navIconName(item.href, item.type ?? null, item.group);
                    const tint = seriesFor(item.group).text;

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                          <AppLink href={item.href} showPending={false}>
                            {/* The tint lives ONLY on the icon, and the icon always
                                has this label beside it — which is what makes the
                                aqua group legitimate at its contrast ratio. */}
                            <Icon className={cn("size-4 shrink-0", tint)} />
                            <span className="truncate">{item.label}</span>
                            {item.badge ? <CountBadge count={item.badge} /> : null}
                          </AppLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            ),
          )
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          <p
            className="text-muted-foreground min-w-0 flex-1 truncate px-1 text-xs group-data-[collapsible=icon]:hidden"
            title={email}
          >
            {email}
          </p>

          <ThemeToggle />

          <form action={onSignOut}>
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Sign out"
            >
              <LogOutIcon className="size-4" />
            </Button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
