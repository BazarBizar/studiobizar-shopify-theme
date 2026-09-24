import Link from "next/link";

import { HeaderActions } from "@/components/layout/header-actions";
import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Container } from "@/components/ui/container";
import { FALLBACK_NAV, MENUS } from "@/lib/navigation";
import { getMenu } from "@/lib/shopify";
import type { MenuLink } from "@/lib/shopify/types";
import { cn } from "@/lib/utils/cn";

async function menuOrFallback(handle: string, fallback: MenuLink[]): Promise<MenuLink[]> {
  try {
    const items = await getMenu(handle);
    return items.length ? items : fallback;
  } catch {
    // The shell must render even when Shopify is unreachable.
    return fallback;
  }
}

/**
 * Header sits on the page's own ground — the designs put it on earth, dark
 * wood, mocha and off-black — so it paints no background of its own and takes
 * its colour from the surrounding `data-surface`.
 */
export async function Header() {
  const [primary, secondary] = await Promise.all([
    menuOrFallback(MENUS.primary, FALLBACK_NAV.primary),
    menuOrFallback(MENUS.secondary, FALLBACK_NAV.secondary),
  ]);

  return (
    /*
     * Sticky, and opaque once it is — a transparent bar would let the page
     * scroll through it. `bg-background` resolves against the surrounding
     * `data-surface`, so it is dark wood on the landing page and earth on Shop
     * without a per-page override.
     *
     * z-40 keeps it under the two drawers at z-50, which are meant to cover it.
     */
    <header className="sticky top-0 z-40 bg-background text-foreground">
      <Container className="flex items-center gap-4 py-5 lg:gap-13">
        <Logo className="h-4 w-[9.5rem] shrink-0 sm:h-5 sm:w-[11.47rem]" />

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {primary.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="text-secondary sb-underline">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-4 lg:gap-[4.3rem]">
          <nav aria-label="Secondary" className="hidden lg:block">
            <ul className="flex items-center gap-5">
              {secondary.map((item) => (
                <li key={item.id} className="group relative">
                  <Link href={item.href} className="text-tertiary sb-underline">
                    {item.title}
                  </Link>

                  {item.items.length > 0 && (
                    <ul
                      className={cn(
                        "invisible absolute top-full left-0 z-10 mt-3 min-w-48 border border-border bg-background py-2 opacity-0 shadow-sm transition-[opacity,visibility] duration-150",
                        "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
                      )}
                    >
                      {item.items.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={child.href}
                            className="text-secondary block px-4 py-2 whitespace-nowrap hover:bg-foreground/5"
                          >
                            {child.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <HeaderActions />
          <MobileNav primary={primary} secondary={secondary} />
        </div>
      </Container>
    </header>
  );
}
