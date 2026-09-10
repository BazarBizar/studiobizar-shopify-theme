"use client";

import Link, { useLinkStatus } from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The panel's link. Use this everywhere inside `/admin` instead of importing
 * `next/link` directly, so every navigation gives feedback — a server-rendered
 * screen that takes half a second to fetch its Shopify data otherwise looks like a
 * dead click.
 *
 * `useLinkStatus` is Next's own hook for this and only reports pending state for
 * the link it is rendered inside, so there is no global router subscription and no
 * progress bar package.
 */

function PendingDot() {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      aria-hidden
      className="bg-current/40 ms-1 inline-block size-1 shrink-0 animate-pulse rounded-full align-middle"
    />
  );
}

export function AppLink({
  className,
  children,
  showPending = true,
  ...props
}: React.ComponentProps<typeof Link> & { showPending?: boolean }) {
  return (
    <Link className={cn(className)} {...props}>
      {children}
      {/* Suppressed where the link is a whole card or a bare icon and an extra
          dot would break the layout. */}
      {showPending ? <PendingDot /> : null}
    </Link>
  );
}
