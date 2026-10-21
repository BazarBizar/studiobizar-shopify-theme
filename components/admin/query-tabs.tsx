"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";

/**
 * Tabs that live in the URL as `?tab=` — so a tab can be linked to, reloaded and
 * reached with Back. The first tab is the bare URL. Used by Site-wide and
 * Collections; the page editor's Content | Settings are separate routes instead
 * (`PageTabs`). See docs/admin/ui-standard.md.
 */
export function QueryTabs({ tabs, active }: { tabs: { value: string; label: string }[]; active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(value: string) {
    const next = new URLSearchParams(params);
    if (value === tabs[0]?.value) next.delete("tab");
    else next.set("tab", value);

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={active} onValueChange={select}>
      <TabsList className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
