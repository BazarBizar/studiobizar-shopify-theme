import { PageHeader } from "@/components/admin/page-header";
import { MediaLibrary } from "@/components/admin/media/media-library";

export const metadata = { title: "Media" };

/**
 * Shopify Files. A static segment, so it wins over `/admin/[slug]`; a metaobject
 * type named `media` would be shadowed and `reservedSlug()` says so in the sidebar.
 *
 * The screen exists mainly to make alt text editable after upload — until now it
 * could only be set once, when the file was added, and `setFileAlt` sat unused.
 */
export default function MediaScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Media"
        description="Everything in Shopify Files. Alt text is the only property editable here, and there is no delete — Shopify removes a file without checking what points at it."
      />

      <MediaLibrary />
    </div>
  );
}
