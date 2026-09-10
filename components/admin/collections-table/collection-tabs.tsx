"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";

/**
 * Tab state lives in `?tab=`, written with `router.replace` and NOT `push`.
 *
 * Switching tabs is looking around one screen; filling the back stack with it buries the
 * page the operator actually arrived from, so Back stops meaning "where I came from".
 * `scroll: false` keeps the viewport where it was.
 *
 * Only the active pane is rendered — see the page component. A hidden tab quietly
 * loading a few hundred rows is cost with no reader.
 */
export function CollectionTabs({ active }: { active: "all" | "featured" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(value: string) {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("tab");
    else next.set("tab", value);

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={active} onValueChange={select}>
      <TabsList className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <TabsTrigger value="all">All collections</TabsTrigger>
        <TabsTrigger value="featured">Featured on the storefront</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
