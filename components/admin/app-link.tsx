"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { confirmLeave, hasUnsavedChanges } from "@/components/admin/leave-guard";
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
 *
 * It also asks before leaving a screen with unsaved changes (`leave-guard.tsx`).
 * `onNavigate` runs for in-panel navigation only, so a Ctrl-click into a new tab —
 * which loses nothing — is never asked.
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

function hrefString(href: React.ComponentProps<typeof Link>["href"]): string {
  if (typeof href === "string") return href;
  const search = href.search ?? (href.query ? `?${new URLSearchParams(href.query as Record<string, string>)}` : "");
  return `${href.pathname ?? ""}${search}${href.hash ?? ""}`;
}

export function AppLink({
  className,
  children,
  showPending = true,
  onNavigate,
  ...props
}: React.ComponentProps<typeof Link> & { showPending?: boolean }) {
  const router = useRouter();

  return (
    <Link
      className={cn(className)}
      onNavigate={(event) => {
        if (hasUnsavedChanges()) {
          event.preventDefault();
          void confirmLeave().then((leave) => {
            if (!leave) return;
            const target = hrefString(props.href);
            if (props.replace) router.replace(target, { scroll: props.scroll });
            else router.push(target, { scroll: props.scroll });
          });
          return;
        }
        onNavigate?.(event);
      }}
      {...props}
    >
      {children}
      {/* Suppressed where the link is a whole card or a bare icon and an extra
          dot would break the layout. */}
      {showPending ? <PendingDot /> : null}
    </Link>
  );
}
