"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };
export type NavGroup = { label: string | null; items: NavItem[] };

/**
 * Navigation is passed in from the server rather than imported here, because from
 * Phase 3 it is derived from the metaobject definitions that actually exist in
 * the store — a new definition has to appear without a code change, so this
 * component must not hold a hardcoded list.
 */
export function AdminSidebar({ groups, email }: { groups: NavGroup[]; email: string }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Admin"
      className="border-admin-border bg-admin-panel flex w-56 shrink-0 flex-col border-r"
    >
      <div className="border-admin-border border-b px-4 py-4">
        <p className="text-admin-muted text-[0.625rem] font-medium tracking-[0.12em] uppercase">
          Studio Bizar
        </p>
        <p className="text-admin-fg mt-0.5 text-sm font-semibold">Admin</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {groups.map((group, index) => (
          <div key={group.label ?? `group-${index}`} className={index > 0 ? "mt-4" : undefined}>
            {group.label ? (
              <p className="text-admin-faint px-2 pb-1 text-[0.625rem] font-medium tracking-[0.1em] uppercase">
                {group.label}
              </p>
            ) : null}

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={
                      isActive(item.href)
                        ? "bg-admin-accent text-admin-accent-fg rounded-admin block px-2 py-1.5"
                        : "text-admin-fg hover:bg-admin-raised rounded-admin block px-2 py-1.5"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-admin-border border-t px-4 py-3">
        <p className="text-admin-muted truncate text-xs" title={email}>
          {email}
        </p>
      </div>
    </nav>
  );
}
