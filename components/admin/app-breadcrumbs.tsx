"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { AppLink } from "@/components/admin/app-link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/admin/ui/breadcrumb";

/**
 * Breadcrumbs derived from the path, with labels supplied by the server.
 *
 * `labels` maps a metaobject type to its display name ("faq_item" → "FAQ"), because
 * the URL segment is the Shopify type and only the server knows what the module
 * calls it. A segment with no label falls back to the raw segment rather than being
 * dropped — a gap in the trail is worse than an ugly word in it.
 */
export function AppBreadcrumbs({ labels }: { labels: Record<string, string> }) {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  // Everything here lives under /admin, which is the root crumb.
  const rest = segments.slice(1);

  const crumbs = rest.map((segment, index) => {
    const href = `/admin/${rest.slice(0, index + 1).join("/")}`;

    // `new` is a route, not a record; an id is digits and has no useful label.
    const label =
      labels[segment] ?? (segment === "new" ? "New" : /^\d+$/.test(segment) ? "Edit" : segment);

    return { href, label, last: index === rest.length - 1 };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {crumbs.length === 0 ? (
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <AppLink href="/admin" showPending={false}>
                Dashboard
              </AppLink>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {/* The separator is a SIBLING of the item, not a child: both render an <li>, and
            nesting them produces invalid HTML that React reports as a hydration error. */}
        {crumbs.map((crumb) => (
          <Fragment key={crumb.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.last ? (
                <BreadcrumbPage className="max-w-48 truncate">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <AppLink href={crumb.href} showPending={false}>
                    {crumb.label}
                  </AppLink>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
