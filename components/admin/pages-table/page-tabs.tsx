"use client";

import { useRouter } from "next/navigation";

import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";

/**
 * A page's two tabs. Content is what the page shows (the page builder); Settings
 * is the page itself — title, address, visibility, search listing, delete.
 *
 * They are separate screens, and switching between them is a real navigation, in
 * the history: Back from Settings returns to Content, as an operator expects —
 * not past both tabs to the list.
 *
 * `beforeLeave` lets the builder save what is on screen first; it returns false
 * when that save failed, and the tab stays put rather than lose the edit.
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

  async function go(value: string) {
    if (value === active) return;
    if (beforeLeave && !(await beforeLeave())) return;
    router.push(value === "content" ? `/admin/pages/${param}/content` : `/admin/pages/${param}`, { scroll: false });
  }

  return (
    <Tabs value={active} onValueChange={(value) => void go(value)}>
      <TabsList>
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
