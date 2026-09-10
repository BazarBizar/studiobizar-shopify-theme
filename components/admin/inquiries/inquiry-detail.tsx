import { DetailHeader } from "@/components/admin/detail-header";
import { InquiryItemsTable } from "@/components/admin/inquiries/inquiry-items-table";
import { InquiryStatus } from "@/components/admin/inquiries/inquiry-status";
import { Badge } from "@/components/admin/ui/badge";
import { Card, CardContent } from "@/components/admin/ui/card";
import { formatDate } from "@/lib/admin/field-values";
import { getInquiry } from "@/lib/admin/inquiries";
import { resolveItemThumbnails } from "@/lib/admin/inquiry-media";

/**
 * A read-only VIEW, not a form with everything disabled.
 *
 * Greyed inputs read worse than plain text, carry an affordance that will never work, and
 * a JSON blob inside a disabled textarea is unreadable where the same data as a table is
 * obvious. Every field is listed including the empty ones, so the shape of the record is
 * visible rather than guessed from whatever happens to be filled in.
 *
 * The single exception is `status`, which is the panel's own annotation and gets its own
 * control below.
 */
export async function InquiryDetail({ param }: { param: string }) {
  const inquiry = await getInquiry(param);
  if (!inquiry) return null;

  const items = await resolveItemThumbnails(inquiry.items);

  const facts: [string, string][] = [
    ["Reference", inquiry.reference],
    ["Submitted", inquiry.submittedAt ? formatDate(inquiry.submittedAt, true) : "—"],
    ["Customer", inquiry.customerName || "—"],
    ["Company", inquiry.company || "—"],
    ["Email", inquiry.email || "—"],
    ["Phone", inquiry.phone || "—"],
    ["Products", String(inquiry.totalProducts)],
    ["Total quantity", String(inquiry.totalQuantity)],
  ];

  return (
    <div className="w-full space-y-6">
      <DetailHeader
        backHref="/admin/inquiry"
        backLabel="Inquiries"
        title={inquiry.reference}
        meta={inquiry.handle}
        readOnly
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="gap-0 py-4">
            <CardContent className="space-y-3 px-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Line items</h2>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <InquiryItemsTable items={items} />
            </CardContent>
          </Card>

          {inquiry.message ? (
            <Card className="gap-0 py-4">
              <CardContent className="space-y-2 px-4">
                <h2 className="text-sm font-semibold">Message</h2>
                {/* The customer's own words, shown as written. */}
                <p className="text-sm whitespace-pre-wrap">{inquiry.message}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <InquiryStatus inquiryId={inquiry.id} status={inquiry.status} />

          <Card className="gap-0 py-4">
            <CardContent className="px-4">
              <dl className="divide-border divide-y">
                {facts.map(([label, value]) => (
                  <div key={label} className="py-2">
                    <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
                    {/* Company is plain text, not a link: this store stores it as the name
                        the customer typed, with no company record to point at. */}
                    <dd className="text-sm break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
