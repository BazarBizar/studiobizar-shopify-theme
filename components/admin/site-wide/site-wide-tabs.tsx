"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";

/**
 * Tab state lives in `?tab=`, written with `router.replace` — the same reasoning as
 * `CollectionTabs`: switching tabs is looking around one screen, and filling the back
 * stack with it buries the page the operator came from. The first tab is the bare URL.
 *
 * Only the active pane is rendered, by the page. A hidden tab loading every location
 * and channel is cost with no reader.
 */
export function SiteWideTabs({
  tabs,
  active,
}: {
  tabs: { value: string; label: string }[];
  active: string;
}) {
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
