import { redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { ShopCategoriesEditor } from "@/components/admin/shop-categories/shop-categories-editor";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { storefrontUrl } from "@/lib/admin/links";
import { shopCategoriesView } from "@/lib/admin/shop-categories";

export const metadata = { title: "Shop categories" };

/**
 * The chips above the products on the Shop page — what used to be a list in
 * `lib/shopify/categories.ts`. See `lib/admin/shop-categories.ts`.
 */
export default async function ShopCategoriesPage() {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const view = await shopCategoriesView();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shop categories"
        description="The filters above the products on the Shop page. Each category shows the products of the product types you put in it."
      />
      <ShopCategoriesEditor view={view} shopUrl={storefrontUrl("/shop")} />
    </div>
  );
}
