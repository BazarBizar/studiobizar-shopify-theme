import { ExternalLinkIcon } from "lucide-react";

import { CustomerAnnotations } from "@/components/admin/customers-table/customer-annotations";
import { ScreenNotFound } from "@/components/admin/screen-not-found";
import { DetailHeader } from "@/components/admin/detail-header";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { customerIdFromParam, getCustomer } from "@/lib/admin/customers";
import { formatDate } from "@/lib/admin/field-values";

export async function generateMetadata({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const gid = customerIdFromParam(id);
  const customer = gid ? await getCustomer(gid) : null;
  return { title: customer?.name ?? "Not found" };
}

export default async function CustomerDetailPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;

  const gid = customerIdFromParam(id);
  if (!gid) return <ScreenNotFound backHref="/admin/customers" backLabel="Customers" />;

  const customer = await getCustomer(gid);
  if (!customer)
    return (
      <ScreenNotFound
        backHref="/admin/customers"
        backLabel="Customers"
        description="That customer does not exist. It may have been deleted in Shopify."
      />
    );

  const shopDomain = process.env.SHOPIFY_STORE_DOMAIN?.replace(".myshopify.com", "");

  const money = (value: { amount: string; currencyCode: string } | null) => {
    if (!value) return "—";
    const amount = Number(value.amount);
    return Number.isNaN(amount)
      ? `${value.amount} ${value.currencyCode}`
      : new Intl.NumberFormat(undefined, { style: "currency", currency: value.currencyCode }).format(amount);
  };

  /**
   * A read-only VIEW, not a form with disabled inputs. Greyed controls read worse than
   * plain text and offer an edit that will never work — and every field is listed,
   * including the empty ones, so the shape of the record is visible rather than inferred
   * from whatever happens to be filled in.
   */
  const facts: [string, string][] = [
    ["Name", customer.name],
    ["Email", customer.email ?? "—"],
    ["Email verified", customer.verifiedEmail ? "Yes" : "No"],
    ["Phone", customer.phone ?? "—"],
    ["Account state", customer.stateLabel],
    ["Location", customer.location ?? "—"],
    ["Address", customer.addressLines.length ? customer.addressLines.join(", ") : "—"],
    ["Other addresses", customer.addresses.length ? String(customer.addresses.length) : "—"],
    ["Orders", String(customer.orders)],
    ["Total spent", money(customer.spent)],
    ["Created", formatDate(customer.createdAt, true)],
    ["Updated", formatDate(customer.updatedAt, true)],
  ];

  return (
    <div className="w-full max-w-3xl space-y-6">
      <DetailHeader
        backHref="/admin/customers"
        backLabel="Customers"
        title={customer.name}
        meta={customer.email ?? undefined}
        readOnly
      />

      {shopDomain ? (
        <Button asChild variant="outline" size="sm">
          <a
            href={`https://admin.shopify.com/store/${shopDomain}/customers/${customer.param}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Shopify
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </Button>
      ) : null}

      <Card className="gap-0 py-4">
        <CardContent className="px-4">
          <dl className="divide-border divide-y">
            {facts.map(([label, value]) => (
              <div key={label} className="py-2">
                <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
                <dd className="text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* The one writable part: the panel's own annotations, not the customer's details. */}
      <CustomerAnnotations
        customerId={customer.id}
        initialNote={customer.note ?? ""}
        initialTags={customer.tags}
      />

      {customer.metafields.length ? (
        <Card className="gap-0 py-4">
          <CardContent className="space-y-2 px-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Metafields</h2>
              <Badge variant="secondary">Read-only</Badge>
            </div>
            <dl className="divide-border divide-y">
              {customer.metafields.map((field) => (
                <div key={field.id} className="py-2">
                  <dt className="text-muted-foreground font-mono text-xs">{field.key}</dt>
                  <dd className="text-sm break-words">{field.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
