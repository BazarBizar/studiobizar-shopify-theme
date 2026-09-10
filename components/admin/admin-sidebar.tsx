"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; readOnly: boolean };
export type NavGroup = { label: string | null; items: NavItem[] };

/**
 * Navigation is passed in from the server rather than imported here, because it is
 * derived from the metaobject definitions that actually exist in the store — a new
 * definition has to appear without a code change, so this component must not hold
 * a list of its own.
 */
export function AdminSidebar({ groups, email }: { groups: NavGroup[]; email: string }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

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
              <p className="text-admin-faint px-2 pb-1 text-[0.625rem] font-medium tracking-widest uppercase">
                {group.label}
              </p>
            ) : null}

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`rounded-admin flex items-center gap-2 px-2 py-1.5 ${
                        active
                          ? "bg-admin-accent text-admin-accent-fg"
                          : "text-admin-fg hover:bg-admin-raised"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>

                      {/* Read-only types are marked in the nav as well as on the
                          screen, so an operator knows before clicking. */}
                      {item.readOnly ? (
                        <svg
                          viewBox="0 0 12 12"
                          aria-hidden="true"
                          className={`size-3 shrink-0 ${active ? "opacity-70" : "text-admin-faint"}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        >
                          <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
                          <path d="M4.25 5.5V4a1.75 1.75 0 0 1 3.5 0v1.5" />
                        </svg>
                      ) : null}

                    </Link>
                  </li>
                );
              })}
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
