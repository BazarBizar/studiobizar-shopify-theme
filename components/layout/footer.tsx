import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { SocialLinks } from "@/components/layout/social-links";
import { Container } from "@/components/ui/container";
import { FALLBACK_NAV, FOOTER_COLUMNS, MENUS } from "@/lib/navigation";
import { getMenu, getSiteSettings } from "@/lib/shopify";
import { resolveSocialLinks } from "@/lib/social";
import type { MenuLink } from "@/lib/shopify/types";
import type { Surface } from "@/components/layout/page-shell";

async function menuOrFallback(
  handle: string,
  fallback: MenuLink[],
): Promise<MenuLink[]> {
  try {
    const items = await getMenu(handle);
    return items.length ? items : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Olive on almost every page; Contact puts it on dark wood, hence the prop.
 *
 * The tagline, the newsletter invitation, the region line and the six social
 * destinations come from the `site_settings` singleton so an operator can change
 * them in the panel. Every one falls back to the literal it replaced — the
 * footer is on all twenty-three routes, so no state of that data may leave it
 * blank.
 */
export async function Footer({ surface = "olive" }: { surface?: Surface }) {
  const [about, info, legal, settings] = await Promise.all([
    menuOrFallback(MENUS.footerAbout, FALLBACK_NAV.footerAbout),
    menuOrFallback(MENUS.footerInfo, FALLBACK_NAV.footerInfo),
    menuOrFallback(MENUS.footerLegal, FALLBACK_NAV.footerLegal),
    getSiteSettings(),
  ]);

  const columns: MenuLink[][] = [about, info, legal];

  return (
    <footer data-surface={surface} className="bg-background text-foreground">
      <Container className="grid gap-12 pt-12 pb-4 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:gap-[12.3rem]">
        {/* Brand + newsletter */}
        <div className="flex flex-col gap-[4.65rem]">
          <div className="flex flex-col gap-7">
            <Logo variant="mark" className="size-[5.625rem]" href={null} />
            {/* Measured at 12px — smaller than `text-tertiary` (14px), which
                is used everywhere else in the footer. `whitespace-pre-line` so a
                line break typed in the panel survives; the design breaks it
                after "life,". */}
            <p className="max-w-[12rem] text-[0.75rem] whitespace-pre-line">
              {settings.footerTagline ?? (
                <>
                  Designed for life,
                  <br />
                  inspired by the world
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-secondary max-w-[26.25rem]">
              {settings.newsletterInvitation ??
                "Sign up for our newsletters to receive seasonal promotions and updates on the latest news of Studio Bizar."}
            </p>
            <NewsletterForm />
          </div>
        </div>

        {/* Link columns */}
        {FOOTER_COLUMNS.map((column, index) => (
          <nav key={column.key} aria-label={column.heading}>
            <h2 className="text-h4 mb-4 uppercase tracking-[0.06em]">
              {column.heading}
            </h2>
            <ul className="flex flex-col gap-3">
              {columns[index].map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="text-secondary sb-underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="lg:justify-self-end">
          <h2 className="sr-only">Follow Studio Bizar</h2>
          <SocialLinks links={resolveSocialLinks(settings.social)} />
        </div>
      </Container>

      <Container className="flex flex-col gap-2 pb-4 text-tertiary sm:flex-row sm:justify-center sm:gap-12">
        <span>{settings.footerRegionLine ?? "Belgium — (EUR)"}</span>
        <span>© {new Date().getFullYear()} Studio Bizar</span>
      </Container>
    </footer>
  );
}
