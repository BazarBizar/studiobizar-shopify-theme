import { CollectionForm, type CollectionFormState } from "@/components/admin/collections-table/collection-form";
import { DetailHeader } from "@/components/admin/detail-header";
import { SORT_ORDER_OPTIONS } from "@/lib/admin/collections";

export const metadata = { title: "New collection" };

const EMPTY: CollectionFormState = {
  title: "",
  handle: "",
  descriptionHtml: "",
  sortOrder: "MANUAL",
  seoTitle: "",
  seoDescription: "",
  imageGid: "",
  imageAlt: "",
};

/**
 * Create is in the write scope for collections (unlike products), so this is a real form
 * rather than a pointer at Shopify. Rules are absent here by construction: a new
 * collection made from the panel is manual, and turning it into a smart collection is a
 * deliberate step taken in Shopify.
 */
export default function NewCollectionPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <DetailHeader backHref="/admin/collections" backLabel="Collections" title="New collection" />

      <CollectionForm
        mode="create"
        id={null}
        initial={EMPTY}
        sortOrderOptions={SORT_ORDER_OPTIONS}
        ruleSet={null}
      />
    </div>
  );
}
