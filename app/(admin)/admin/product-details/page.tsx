import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { ProductDetailsEditor } from "@/components/admin/product-details/product-details-editor";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { productDetailsView } from "@/lib/admin/product-details";

export const metadata = { title: "Product details" };

/**
 * Which product fields every product page shows, and under what labels — what used to be
 * fixed in `app/(storefront)/shop/[handle]/page.tsx`. See `lib/admin/product-details.ts`.
 */
export default async function ProductDetailsPage() {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const view = await productDetailsView();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Product details"
        description="The facts beside every product and the fold-out panels under the enquire button: which ones, in what order, under what name. What they say is filled in on each product under Products."
      />
      <ProductDetailsEditor view={view} />
    </div>
  );
}
