import { DetailHeader } from "@/components/admin/detail-header";
import { CreatePageForm } from "@/components/admin/page-builder/create-page-dialog";
import { Card, CardContent } from "@/components/admin/ui/card";

export const metadata = { title: "New page" };

/** Pages → New page: a title, an address and a starting layout, then its Content tab. */
export default function NewPageScreen() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <DetailHeader backHref="/admin/pages" backLabel="Pages" title="New page" />
      <p className="text-muted-foreground text-sm">
        Built from the site’s own sections. It stays hidden until you publish it.
      </p>
      <Card>
        <CardContent>
          <CreatePageForm />
        </CardContent>
      </Card>
    </div>
  );
}
