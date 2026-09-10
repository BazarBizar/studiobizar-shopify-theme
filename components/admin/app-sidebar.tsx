"use client";

import { BoxIcon, LogOutIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { AppLink } from "@/components/admin/app-link";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/admin/ui/button";
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
} from "@/components/admin/ui/sidebar";
import { navIconName } from "@/lib/admin/nav-icons";
import { seriesFor } from "@/lib/admin/series-colors";
import { cn } from "@/lib/utils/cn";

export type SidebarItem = {
  href: string;
  label: string;
  readOnly: boolean;
  /** Group key. Drives the icon TINT, and the icon itself only as a fallback. */
  group: string;
  /** Metaobject type, or null for a bespoke screen. */
  type?: string | null;
  /** Unread/needs-attention count. Amber, like every other "needs action" marker. */
  badge?: number;
};

export type SidebarSection = { key: string; label: string | null; items: SidebarItem[] };

export function AppSidebar({
  sections,
  email,
  loading = false,
  onSignOut,
}: {
  sections: SidebarSection[];
  email: string;
  loading?: boolean;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <AppLink href="/admin" showPending={false}>
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                  <BoxIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">Studio Bizar</span>
                  <span className="text-muted-foreground truncate text-xs">Admin</span>
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
          sections.map((section) => (
            <SidebarGroup key={section.key}>
              {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}

              <SidebarMenu>
                {section.items.map((item) => {
                  // Matched to what the row IS, falling back to the group for a
                  // definition nobody has given an icon yet.
                  const Icon = navIconName(item.href, item.type ?? null, item.group);
                  const tint = seriesFor(item.group).text;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                        tooltip={item.label}
                      >
                        <AppLink href={item.href} showPending={false}>
                          {/* The tint lives ONLY on the icon, and the icon always
                              has this label beside it — which is what makes the
                              aqua group legitimate at its contrast ratio. */}
                          <Icon className={cn("size-4 shrink-0", tint)} />
                          <span className="truncate">{item.label}</span>
                          {item.badge ? (
                            <span
                              // Amber and a number, and the aria-label spells it out — the
                              // colour is never the only carrier.
                              aria-label={`${item.badge} unread`}
                              className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white group-data-[collapsible=icon]:hidden"
                            >
                              {item.badge}
                            </span>
                          ) : item.readOnly ? (
                            <span className="text-muted-foreground ms-auto text-[11px] group-data-[collapsible=icon]:hidden">
                              read-only
                            </span>
                          ) : null}
                        </AppLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))
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
