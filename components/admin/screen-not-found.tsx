import { ArrowLeftIcon } from "lucide-react";

import { AppLink } from "@/components/admin/app-link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";

/**
 * Shown when a screen's record does not exist — a deleted metaobject definition, a stale
 * bookmark, a mistyped id.
 *
 * RENDERED INLINE, not thrown via `notFound()`, and that is deliberate. The admin layout
 * is `force-dynamic` and streams: by the time a page component decides the record is
 * missing, the shell (sidebar, header, breadcrumbs) has already been flushed. Next then
 * cannot swap in the `not-found.tsx` boundary or change the status, so `notFound()` left
 * the content area COMPLETELY BLANK with a 200 — a panel that looks broken rather than
 * one that explains itself.
 *
 * Returning this component instead always renders, keeps the sidebar usable, and gives
 * the operator a way back. The status stays 200, which is the part that cannot be fixed
 * after the shell has flushed; the panel is `noindex` so nothing consumes that status.
 */
export function ScreenNotFound({
  title = "Not found",
  description = "That record does not exist. It may have been deleted in Shopify, or the address may be wrong.",
  backHref = "/admin",
  backLabel = "Back to dashboard",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <Button asChild variant="outline" size="sm">
        <AppLink href={backHref} showPending={false}>
          <ArrowLeftIcon className="size-3.5" />
          {backLabel}
        </AppLink>
      </Button>
    </div>
  );
}
