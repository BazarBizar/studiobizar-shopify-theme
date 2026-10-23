import { Container } from "@/components/ui/container";
import { designStyle, SHADOWS } from "@/lib/page-builder/design";
import { HEX_COLOR } from "@/lib/page-builder/fields";
import { FALLBACK_NAV, MENUS } from "@/lib/navigation";
import { getMenu, getSiteSettings } from "@/lib/shopify";
import type { MenuLink } from "@/lib/shopify/types";
import { ZONES, type HeaderLayout, type MenuKey, type ThemeElement, type ThemeLayoutContent, type Zones } from "@/lib/theme-builder/layout";
import { cn } from "@/lib/utils/cn";

import { HeaderScroll } from "./header-scroll";
import { ElementRun, hideClasses, responsivePadding, type ThemeData } from "./theme-elements";

/**
 * The header as the Theme Builder composed it (`lib/theme-builder/layout.ts`).
 * Drawn only once a layout has been PUBLISHED — until then `Header` draws the
 * original. Two arrangements: desktop from 1024px, mobile below it.
 *
 * Like the original it is sticky and opaque by default, and paints the page's own
 * ground unless a background is chosen.
 */

async function menuOrFallback(key: MenuKey): Promise<MenuLink[]> {
  try {
    const items = await getMenu(MENUS[key]);
    return items.length ? items : FALLBACK_NAV[key];
  } catch {
    return FALLBACK_NAV[key];
  }
}

/** Only the menus the layout uses, fetched once each. */
export async function loadThemeData(content: ThemeLayoutContent, keys: MenuKey[]): Promise<ThemeData> {
  const [entries, settings] = await Promise.all([
    Promise.all(keys.map(async (key) => [key, await menuOrFallback(key)] as const)),
    getSiteSettings(),
  ]);
  const menus = Object.fromEntries(entries) as ThemeData["menus"];
  // The phone drawer lists the menus the DESKTOP header shows, in order.
  const desktopMenus = ZONES.flatMap((zone) => content.header.desktop[zone])
    .filter((element) => element.type === "menu")
    .map((element) => menus[element.settings.menu as MenuKey] ?? []);
  return { menus, settings, drawer: { primary: desktopMenus[0] ?? [], secondary: desktopMenus.slice(1).flat() } };
}

export function headerMenus(header: HeaderLayout): MenuKey[] {
  const all = ZONES.flatMap((zone) => [...header.desktop[zone], ...header.mobile[zone]]);
  return [...new Set(all.filter((element) => element.type === "menu").map((element) => element.settings.menu as MenuKey))];
}

const ZONE_CLASS = { left: "justify-start", center: "justify-center", right: "justify-end" } as const;

function Bar({ zones, data, gap }: { zones: Zones; data: ThemeData; gap: number }) {
  // Three columns so a centred element is centred on the page, not between its neighbours.
  const centred = zones.center.length > 0;
  return (
    // Each side at least as wide as its content, so a menu never wraps onto two lines;
    // the centre stays centred whenever there is room for it to be.
    <div
      className={cn("items-center", centred ? "grid grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)]" : "flex")}
      style={{ columnGap: `${gap}px` }}
    >
      {ZONES.map((zone) => {
        if (!centred && zone === "center") return null;
        const elements: ThemeElement[] = zones[zone];
        return (
          <div key={zone} className={cn("flex min-w-0 items-center", ZONE_CLASS[zone], !centred && zone === "right" && "ml-auto")}>
            <ElementRun elements={elements} data={data} gap={gap} axis="row" />
          </div>
        );
      })}
    </div>
  );
}

export async function ThemeHeader({ content }: { content: ThemeLayoutContent }) {
  const header = content.header;
  const data = await loadThemeData(content, headerMenus(header));
  const { style: designVars, attrs: designAttrs } = designStyle(header.style.design);
  const padding = responsivePadding(header.style.paddingY);
  /** Only a validated `#rrggbb` reaches a style attribute. */
  const color = (value: string) => (HEX_COLOR.test(value) ? value : undefined);

  const style: Record<string, string> = { ...designVars };
  const background = color(header.style.background);
  const text = color(header.style.color);
  if (background) {
    style.backgroundColor = background;
    style["--sb-background"] = background;
  }
  if (text) {
    style.color = text;
    style["--sb-foreground"] = text;
  }
  if (header.style.border) style.borderBottom = `1px solid ${color(header.style.borderColor) ?? "var(--sb-border)"}`;
  if (header.style.shadow !== "none") style.boxShadow = SHADOWS[header.style.shadow].css;
  if (color(header.style.dropdownBackground)) style["--sb-dd-bg"] = header.style.dropdownBackground;
  if (color(header.style.dropdownColor)) style["--sb-dd-fg"] = header.style.dropdownColor;
  if (header.style.transparent) style["--sb-hdr-over"] = color(header.style.overColor) ?? "#ebe8e3";
  const scrolls = header.style.transparent || header.style.shrink || header.style.scrollShadow;

  const announcement = header.announcement;
  const announcementText = announcement.text.trim();

  return (
    <>
      {announcement.enabled && announcementText ? (
        <div
          className={cn("bg-off-black text-earth text-tertiary px-4 py-2 text-center", hideClasses(announcement.hide))}
          style={{
            ...(color(announcement.background) ? { backgroundColor: announcement.background } : {}),
            ...(color(announcement.color) ? { color: announcement.color } : {}),
          }}
        >
          {announcement.link?.href ? (
            <a href={announcement.link.href} className="sb-underline">
              {announcementText}
            </a>
          ) : (
            announcementText
          )}
        </div>
      ) : null}

      {/* z-40 keeps it under the two drawers at z-50, which are meant to cover it. */}
      <header
        id="site-header"
        data-theme-header=""
        {...designAttrs}
        data-transparent={header.style.transparent ? "" : undefined}
        data-shrink={header.style.shrink ? "" : undefined}
        data-scroll-shadow={header.style.scrollShadow ? "" : undefined}
        className={cn("z-40 bg-background text-foreground", header.sticky && "sticky top-0")}
        style={style as React.CSSProperties}
      >
        <Container>
          <div {...padding.attrs} style={padding.style as React.CSSProperties} data-hdr-bar="" className="py-5">
            <div className="hidden lg:block">
              <Bar zones={header.desktop} data={data} gap={header.style.gap} />
            </div>
            <div className="lg:hidden">
              <Bar zones={header.mobile} data={data} gap={header.style.gap} />
            </div>
          </div>
        </Container>
        {scrolls ? <HeaderScroll target="site-header" /> : null}
      </header>
    </>
  );
}
