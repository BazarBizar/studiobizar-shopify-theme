import {
  FileTextIcon,
  HelpCircleIcon,
  ImageIcon,
  InboxIcon,
  LayoutTemplateIcon,
  ListIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";

import { AppLink } from "@/components/admin/app-link";

import { PartToWhole } from "@/components/admin/dashboard/part-to-whole";
import { RecentPanel } from "@/components/admin/dashboard/recent-panel";
import { StatTile } from "@/components/admin/dashboard/stat-tile";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminSettings } from "@/lib/admin/admin-settings";
import { Card, CardContent } from "@/components/admin/ui/card";
import { getDashboardData } from "@/lib/admin/dashboard";
import { listPagesWithContent } from "@/lib/admin/page-builder";
import { SERIES } from "@/lib/admin/series-colors";

/**
 * "What does this store look like right now" — not analytics. No trends, no period
 * comparison, no chart library.
 *
 * The composition follows the shape of the data: four standalone numbers are tiles, the
 * one genuine part-to-whole gets the single chart, and short recency lists stay lists.
 */
export default async function AdminDashboardPage() {
  // The heading's wording comes from Site-wide → Admin appearance.
  const [data, settings, pages] = await Promise.all([
    getDashboardData(),
    getAdminSettings(),
    listPagesWithContent().catch(() => []),
  ]);
  const unpublished = pages.filter((page) => page.status === "changes" || page.status === "draft").length;

  /** The jobs people actually come here to do, one click each. */
  const shortcuts = [
    { href: "/admin/pages", label: "Edit a page", icon: LayoutTemplateIcon },
    { href: "/admin/project/new", label: "Add a project", icon: PlusIcon },
    { href: "/admin/faq_item/new", label: "Add a question to the FAQ", icon: HelpCircleIcon },
    { href: "/admin/media", label: "Upload photos", icon: ImageIcon },
    { href: "/admin/menus", label: "Change the menus", icon: ListIcon },
    { href: "/admin/site-wide", label: "Footer, contact & social links", icon: SettingsIcon },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={settings.dashboardTitle} description={settings.dashboardDescription} />

      <Card className="gap-0 py-4">
        <CardContent className="space-y-3 px-4">
          <p className="text-sm font-medium">What would you like to do?</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {shortcuts.map(({ href, label, icon: Icon }) => (
              <AppLink
                key={href}
                href={href}
                className="hover:bg-muted flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors"
              >
                <Icon className="text-muted-foreground size-4 shrink-0" />
                {label}
              </AppLink>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Pages"
          href="/admin/pages"
          icon={<LayoutTemplateIcon className="size-4" />}
          tint={SERIES.blue.text}
          value={pages.length}
          detail="Pages on the website"
          attention={
            unpublished > 0
              ? `${unpublished} with changes not published yet`
              : undefined
          }
        />

        <StatTile
          label="Projects"
          href="/admin/project"
          icon={<FileTextIcon className="size-4" />}
          tint={SERIES.aqua.text}
          value={data.projectTotal}
          detail={`${data.projectSplit[0]?.value ?? 0} shown on the homepage`}
        />

        <StatTile
          label="Images"
          href="/admin/captioned_image"
          icon={<ImageIcon className="size-4" />}
          tint={SERIES.orange.text}
          value={data.imagesTotal}
          detail="Photos used in slideshows and galleries"
        />

        <StatTile
          label="Inquiries"
          href="/admin/inquiry"
          icon={<InboxIcon className="size-4" />}
          tint={SERIES.violet.text}
          value={data.inquiriesTotal}
          detail="Sent by visitors through the website"
          /* A sentence, not a coloured dot: colour is never the only carrier. */
          attention={
            data.inquiriesNew > 0
              ? `${data.inquiriesNew} still marked new`
              : undefined
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PartToWhole
          title="Projects on the homepage"
          noun="projects"
          total={data.projectTotal}
          segments={[
            { label: "On the homepage", value: data.projectSplit[0]?.value ?? 0, series: "blue" },
            { label: "Not on the homepage", value: data.projectSplit[1]?.value ?? 0, series: "orange" },
          ]}
        />

        <RecentPanel
          title="Recently updated projects"
          allHref="/admin/project"
          allLabel="All projects"
          entries={data.recentProjects}
          emptyMessage="No projects yet."
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <RecentPanel
          title="Recently updated images"
          allHref="/admin/captioned_image"
          allLabel="All images"
          entries={data.recentImages}
          emptyMessage="No images yet."
        />
      </div>
    </div>
  );
}
