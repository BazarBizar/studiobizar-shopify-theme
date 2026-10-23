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
        description="Every photo and file on the website. Give each one a short description — Google and people using screen readers read it. Files can’t be deleted here, because a page that still shows one would break."
      />

      <MediaLibrary />
    </div>
  );
}
