import Link from "next/link";

import { AccountLink, InquiryBagButton, SearchButton } from "@/components/layout/header-actions";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { SocialLinks } from "@/components/layout/social-links";
import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { DEVICES, type Device, type Responsive } from "@/lib/page-builder/design";
import type { LinkValue } from "@/lib/page-builder/fields";
import type { SiteSettings } from "@/lib/shopify/entities";
import type { MenuLink } from "@/lib/shopify/types";
import { resolveSocialLinks } from "@/lib/social";
import type { MenuKey, ThemeElement } from "@/lib/theme-builder/layout";
import { cn } from "@/lib/utils/cn";

/**
 * One Theme Builder element, drawn with the storefront's own components — the same
 * logo, menus, search, inquiry bag, newsletter form and social marks the original
 * header and footer use, so a composed header is this site's header rearranged, not
 * a lookalike.
 */

export type ThemeData = {
  menus: Partial<Record<MenuKey, MenuLink[]>>;
  settings: SiteSettings;
  /** For the menu button: what the phone drawer lists. */
  drawer: { primary: MenuLink[]; secondary: MenuLink[] };
};

/** Hidden per device — the breakpoints of `lib/page-builder/design.ts`, written out for Tailwind. */
const HIDE: Record<Device, string> = { d: "lg:hidden", t: "sm:max-lg:hidden", m: "max-sm:hidden" };

export function hideClasses(hide: Partial<Record<Device, boolean>> | undefined): string {
  return cn(DEVICES.filter((device) => hide?.[device]).map((device) => HIDE[device]));
}

/**
 * Padding per device, through the `data-sb-py` / `-pt` / `-pb` rules in
 * `globals.css`: `block` sets top and bottom alike.
 */
export function responsivePadding(
  value: Responsive<number>,
  side: "block" | "top" | "bottom" = "block",
): { style: Record<string, string>; attrs: Record<string, string> } {
  const name = { block: "py", top: "pt", bottom: "pb" }[side];
  const style: Record<string, string> = {};
  const set: Device[] = [];
  for (const device of DEVICES) {
    const v = value[device];
    if (v === undefined) continue;
    style[device === "d" ? `--sb-${name}` : `--sb-${name}-${device}`] = `${v}px`;
    set.push(device);
  }
  return { style, attrs: set.length ? { [`data-sb-${name}`]: set.join(" ") } : {} };
}

/** Where an element's space goes — written out for Tailwind. `stack`: a column on phones, a row from 750px. */
const SPACE_SIDE = {
  row: "ms-[var(--sb-space)]",
  column: "mt-[var(--sb-space)]",
  stack: "max-sm:mt-2 sm:ms-[var(--sb-space)]",
} as const;

/**
 * Elements in a row or a column, each after its own space (`spaceBefore`) or the
 * zone's — a widget's margin, as in Elementor. Hidden per device here, once.
 */
export function ElementRun({
  elements,
  data,
  gap,
  axis,
}: {
  elements: ThemeElement[];
  data: ThemeData;
  gap: number;
  axis: keyof typeof SPACE_SIDE;
}) {
  return elements.map((element, index) => (
    <div
      key={element.id}
      className={cn("flex min-w-0", axis === "column" ? "flex-col" : "items-center", index > 0 && SPACE_SIDE[axis], hideClasses(element.hide))}
      style={index > 0 ? ({ "--sb-space": `${element.spaceBefore ?? gap}px` } as React.CSSProperties) : undefined}
    >
      <ThemeElementView element={element} data={data} />
    </div>
  ));
}

const TEXT_SIZES: Record<string, string> = {
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  caption: "text-[0.75rem]",
};

const linkValue = (value: unknown) => (value && typeof value === "object" ? (value as LinkValue) : null);

export function ThemeElementView({
  element,
  data,
}: {
  element: ThemeElement;
  data: ThemeData;
}) {
  const s = element.settings;

  switch (element.type) {
    case "logo": {
      const variant = s.variant === "mark" ? "mark" : "full";
      const height = Number(s.height) || 20;
      const phone = Number(s.mobileHeight) || height;
      return (
        <span className="inline-flex shrink-0" style={{ ["--sb-logo-h" as string]: `${height}px`, ["--sb-logo-h-m" as string]: `${phone}px` }}>
          <Logo variant={variant} className="h-[var(--sb-logo-h)] w-auto max-sm:h-[var(--sb-logo-h-m)]" />
        </span>
      );
    }

    case "menu": {
      const items = data.menus[s.menu as MenuKey] ?? [];
      const column = s.direction === "column";
      const size = TEXT_SIZES[String(s.size)] ?? "text-secondary";
      const title = String(s.title ?? "").trim();
      return (
        <nav aria-label={title || "Menu"}>
          {title ? <h2 className="text-h4 mb-4 uppercase tracking-[0.06em]">{title}</h2> : null}
          <ul
            className={cn("flex", column ? "flex-col gap-3" : "flex-wrap items-center gap-y-2")}
            style={column ? undefined : { columnGap: `${Number(s.linkGap ?? 36)}px` }}
          >
            {items.map((item) => (
              <li key={item.id} className={cn(!column && s.dropdowns === true && item.items.length > 0 && "group relative")}>
                <Link href={item.href} className={cn(size, "sb-underline")}>
                  {item.title}
                </Link>
                {!column && s.dropdowns === true && item.items.length > 0 ? (
                  <ul
                    className={cn(
                      "invisible absolute top-full left-0 z-10 mt-3 min-w-48 border border-border py-2 opacity-0 shadow-sm transition-[opacity,visibility] duration-150",
                      "bg-[var(--sb-dd-bg,var(--sb-background))] text-[var(--sb-dd-fg,var(--sb-foreground))]",
                      "group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100",
                    )}
                  >
                    {item.items.map((child) => (
                      <li key={child.id}>
                        <Link href={child.href} className="text-secondary block px-4 py-2 whitespace-nowrap hover:bg-foreground/5">
                          {child.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      );
    }

    case "search":
      return <span className="inline-flex"><SearchButton /></span>;
    case "account":
      return <span className="inline-flex"><AccountLink /></span>;
    case "cart":
      return <span className="inline-flex"><InquiryBagButton /></span>;
    case "language":
      return <span className="inline-flex"><LanguageSwitcher /></span>;
    case "menuToggle":
      return (
        <span className="inline-flex">
          <MobileNav primary={data.drawer.primary} secondary={data.drawer.secondary} />
        </span>
      );

    case "social":
      return (
        <div>
          <h2 className="sr-only">Follow Studio Bizar</h2>
          <SocialLinks links={resolveSocialLinks(data.settings.social)} />
        </div>
      );

    case "text": {
      const size = TEXT_SIZES[String(s.size)] ?? "text-secondary";
      const fromSettings =
        s.source === "tagline"
          ? (data.settings.footerTagline ?? "Designed for life,\ninspired by the world")
          : s.source === "region"
            ? (data.settings.footerRegionLine ?? "Belgium — (EUR)")
            : String(s.text ?? "");
      if (!fromSettings.trim()) return null;
      const href = s.source === "typed" ? linkValue(s.link)?.href : null;
      const body = <p className={cn(size, "max-w-[26rem] whitespace-pre-line")}>{fromSettings}</p>;
      return href ? (
        <Link href={href} className="sb-underline">
          {body}
        </Link>
      ) : (
        body
      );
    }

    case "button": {
      const value = linkValue(s.link);
      if (!value?.href || !value.label) return null;
      return (
        <span className="inline-flex">
          <ButtonLink href={value.href} variant={(s.style as ButtonVariant) ?? "outline"} external={/^https?:\/\//i.test(value.href)}>
            {value.label}
          </ButtonLink>
        </span>
      );
    }

    case "newsletter":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-secondary max-w-[26.25rem]">
            {String(s.text ?? "").trim() ||
              data.settings.newsletterInvitation ||
              "Sign up for our newsletters to receive seasonal promotions and updates on the latest news of Studio Bizar."}
          </p>
          <NewsletterForm />
        </div>
      );

    case "copyright":
      return (
        <span className="text-tertiary">
          {String(s.text ?? "© {year} Studio Bizar").replaceAll("{year}", String(new Date().getFullYear()))}
        </span>
      );
  }
}
