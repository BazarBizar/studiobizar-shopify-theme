import { FileTextIcon, ImageIcon, InboxIcon, LayersIcon } from "lucide-react";

import { PartToWhole } from "@/components/admin/dashboard/part-to-whole";
import { RecentPanel } from "@/components/admin/dashboard/recent-panel";
import { StatTile } from "@/components/admin/dashboard/stat-tile";
import { PageHeader } from "@/components/admin/page-header";
import { getDashboardData } from "@/lib/admin/dashboard";
import { SERIES } from "@/lib/admin/series-colors";

/**
 * "What does this store look like right now" — not analytics. No trends, no period
 * comparison, no chart library.
 *
 * The composition follows the shape of the data: four standalone numbers are tiles, the
 * one genuine part-to-whole gets the single chart, and short recency lists stay lists.
 */
export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Everything on this store is edited here and stored in Shopify."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Content types"
          href="/admin/project"
          icon={<LayersIcon className="size-4" />}
          tint={SERIES.blue.text}
          value={data.definitionCount}
          detail={`${data.fieldCount} fields in total`}
          note={`${data.contentCount} editable, ${data.readOnlyCount} read-only`}
        />

        <StatTile
          label="Projects"
          href="/admin/project"
          icon={<FileTextIcon className="size-4" />}
          tint={SERIES.aqua.text}
          value={data.projectTotal}
          detail={`${data.projectSplit[0]?.value ?? 0} marked as selected`}
        />

        <StatTile
          label="Images"
          href="/admin/captioned_image"
          icon={<ImageIcon className="size-4" />}
          tint={SERIES.orange.text}
          value={data.imagesTotal}
          detail="Captioned images used across the site"
        />

        <StatTile
          label="Inquiries"
          href="/admin/inquiry"
          icon={<InboxIcon className="size-4" />}
          tint={SERIES.violet.text}
          value={data.inquiriesTotal}
          detail="Submitted through the storefront"
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
            { label: "Selected", value: data.projectSplit[0]?.value ?? 0, series: "blue" },
            { label: "Not selected", value: data.projectSplit[1]?.value ?? 0, series: "orange" },
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
