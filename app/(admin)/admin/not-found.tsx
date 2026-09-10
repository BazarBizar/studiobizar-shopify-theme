import { ArrowLeftIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { Button } from "@/components/admin/ui/button";
import { PageHeader } from "@/components/admin/page-header";

/**
 * Rendered when a slug matches no metaobject definition, or an id matches no entry.
 *
 * Scoped to the admin segment so it appears INSIDE the shell, with the sidebar still
 * there. The root `not-found` would render the storefront chrome around an admin URL,
 * which is disorienting and leaves no way back into the panel.
 */
export default function AdminNotFound() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Not found"
        description="That content type or entry does not exist. It may have been deleted in Shopify, or the address may be wrong."
      />

      <Button asChild variant="outline" size="sm">
        <AppLink href="/admin" showPending={false}>
          <ArrowLeftIcon className="size-3.5" />
          Back to dashboard
        </AppLink>
      </Button>
    </div>
  );
}
