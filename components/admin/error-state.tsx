"use client";

import { AlertCircleIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";

/**
 * The single error presentation for the panel. One component so that a Shopify
 * timeout on the products table and a failed metaobject save look the same and read
 * the same.
 *
 * `code` is the short machine code the server allowed across the boundary
 * (`UPSTREAM`, `NOT_ALLOWED`, `RATE_LIMITED`) — never a stack, never Shopify's raw
 * response. It is shown because it is the one thing worth quoting in a bug report.
 */
export function ErrorState({
  error,
  code,
  onRetry,
  title = "Something went wrong",
}: {
  error: string;
  code?: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/30 bg-destructive/5 space-y-3 rounded-lg border p-4"
    >
      <div className="flex items-start gap-2">
        <AlertCircleIcon className="text-destructive mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          {code ? <p className="text-muted-foreground font-mono text-xs">{code}</p> : null}
        </div>
      </div>

      {/* Only offered when retrying can actually help — a NOT_ALLOWED will fail
          identically every time, and a button that never works is worse than none. */}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
