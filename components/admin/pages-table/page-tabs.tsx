"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";

/**
 * A page's two tabs. Content is what the page shows (the page builder); Settings
 * is the page itself — title, address, visibility, search listing, delete.
 *
 * They are separate screens, and switching between them is a real navigation, in
 * the history: Back from Settings returns to Content, as an operator expects —
 * not past both tabs to the list.
 *
 * It must still FEEL like a tab: the clicked tab is selected at once (not when the
 * next screen has arrived), the other tab is prefetched so its loading screen is
 * on hand, and that loading screen keeps this bar (`PendingPageBar`).
 *
 * `beforeLeave` lets the builder save what is on screen first; it returns false
 * when that save failed, and the tab goes back rather than lose the edit.
 */
export function PageTabs({
  param,
  active,
  beforeLeave,
}: {
  param: string;
  active: "content" | "settings";
  beforeLeave?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [chosen, setChosen] = React.useState<"content" | "settings" | null>(null);
  const href = (tab: "content" | "settings") =>
    tab === "content" ? `/admin/pages/${param}/content` : `/admin/pages/${param}`;

  React.useEffect(() => {
    router.prefetch(active === "content" ? `/admin/pages/${param}` : `/admin/pages/${param}/content`);
  }, [router, param, active]);

  async function go(value: "content" | "settings") {
    if (value === active) return;
    setChosen(value);
    if (beforeLeave && !(await beforeLeave())) {
      setChosen(null);
      return;
    }
    router.push(href(value), { scroll: false });
  }

  return (
    <Tabs value={chosen ?? active} onValueChange={(value) => void go(value as "content" | "settings")}>
      <TabsList>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
