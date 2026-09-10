import { PageHeader } from "@/components/admin/page-header";
import { ProductsTable, type ProductRowData } from "@/components/admin/products-table/products-table";
import {
  buildProductQuery,
  countProducts,
  getProductFilterOptions,
  listProducts,
} from "@/lib/admin/products";

export const metadata = { title: "Products" };

/**
 * The catalogue. A static segment, so it wins over `/admin/[slug]`; a metaobject type
 * named `products` would be shadowed and `reservedSlug()` flags that in the sidebar.
 */
export default async function ProductsPage() {
  const query = buildProductQuery({});

  const [page, total, options] = await Promise.all([
    listProducts({ first: 50, query }),
    countProducts(query),
    getProductFilterOptions(),
  ]);

  const rows: ProductRowData[] = page.products;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="The catalogue lives in Shopify. Products can be edited here; creating and deleting stay in Shopify."
      />

      <ProductsTable
        initial={{
          products: rows,
          hasNextPage: page.hasNextPage,
          endCursor: page.endCursor,
          total,
        }}
        vendors={options.vendors}
        productTypes={options.productTypes}
      />
    </div>
  );
}
