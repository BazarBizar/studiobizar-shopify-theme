import { PageHeader } from "@/components/admin/page-header";
import { CustomersTable } from "@/components/admin/customers-table/customers-table";
import { Card, CardContent } from "@/components/admin/ui/card";
import { listAllCustomers } from "@/lib/admin/customers";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const customers = await listAllCustomers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Accounts created on the storefront. Read-only apart from notes and tags."
      />

      {/* Stated plainly rather than left as a puzzle: this store cannot have the company
          relationships the B2B screens elsewhere are built around. */}
      <Card className="gap-0 py-3">
        <CardContent className="px-4">
          <p className="text-muted-foreground text-xs">
            Company accounts, approval workflow and inherited status are Shopify Plus
            features. This store is on Basic, so a customer here has only their own Shopify
            account state.
          </p>
        </CardContent>
      </Card>

      <CustomersTable rows={customers} />
    </div>
  );
}
