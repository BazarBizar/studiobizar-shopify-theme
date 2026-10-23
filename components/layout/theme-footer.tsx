import type { Surface } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { designStyle } from "@/lib/page-builder/design";
import { HEX_COLOR } from "@/lib/page-builder/fields";
import { ZONES, type FooterLayout, type MenuKey, type ThemeLayoutContent } from "@/lib/theme-builder/layout";
import { cn } from "@/lib/utils/cn";

import { ElementRun, responsivePadding } from "./theme-elements";
import { loadThemeData } from "./theme-header";

/**
 * The footer as the Theme Builder composed it: columns of elements, then a bottom
 * bar. Drawn only once a layout has been PUBLISHED — until then `Footer` draws the
 * original. On the page's footer ground (olive on most pages) unless a background
 * is chosen, as the original.
 */

export function footerMenus(footer: FooterLayout): MenuKey[] {
  const all = [...footer.columns.flatMap((column) => column.elements), ...ZONES.flatMap((zone) => footer.bottom[zone])];
  return [...new Set(all.filter((element) => element.type === "menu").map((element) => element.settings.menu as MenuKey))];
}

export async function ThemeFooter({ content, surface }: { content: ThemeLayoutContent; surface: Surface }) {
  const footer = content.footer;
  const data = await loadThemeData(content, footerMenus(footer));
  const { style: designVars, attrs: designAttrs } = designStyle(footer.style.design);
  const top = responsivePadding(footer.style.paddingTop, "top");
  const bottomPad = responsivePadding(footer.style.paddingBottom, "bottom");
  const color = (value: string) => (HEX_COLOR.test(value) ? value : undefined);

  const style: Record<string, string> = {
    ...designVars,
    // The first column takes the room; the others size to their content, as the original.
    "--sb-cols": `minmax(0,1fr) ${"auto ".repeat(Math.max(0, footer.columns.length - 1)).trim()}`.trim(),
    "--sb-col-gap": `${footer.style.columnGap}px`,
  };
  const background = color(footer.style.background);
  const text = color(footer.style.color);
  if (background) {
    style.backgroundColor = background;
    style["--sb-background"] = background;
  }
  if (text) {
    style.color = text;
    style["--sb-foreground"] = text;
  }
  if (footer.style.border) style.borderTop = `1px solid ${color(footer.style.borderColor) ?? "var(--sb-border)"}`;

  const bottom = footer.bottom;
  const centred = bottom.center.length > 0;

  return (
    <footer
      id="site-footer"
      data-theme-footer=""
      data-surface={background ? undefined : surface}
      {...designAttrs}
      className="bg-background text-foreground"
      style={style as React.CSSProperties}
    >
      <Container>
        <div {...top.attrs} {...bottomPad.attrs} style={{ ...top.style, ...bottomPad.style } as React.CSSProperties} className="pt-12 pb-4">
          <div
            className={cn(
              "grid gap-x-[var(--sb-col-gap)] gap-y-12 lg:[grid-template-columns:var(--sb-cols)]",
              footer.style.mobileColumns === "two" ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            {footer.columns.map((column) => (
              <div key={column.id} className="flex min-w-0 flex-col">
                <ElementRun elements={column.elements} data={data} gap={28} axis="column" />
              </div>
            ))}
          </div>

          <div
            className={cn(
              "text-tertiary mt-4 flex flex-col",
              centred ? "sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center" : "sm:flex-row sm:items-center sm:justify-between",
            )}
          >
            {ZONES.map((zone) =>
              !centred && zone === "center" ? null : (
                <div
                  key={zone}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center",
                    zone === "center" ? "sm:justify-center" : zone === "right" ? "sm:justify-end" : "sm:justify-start",
                  )}
                >
                  <ElementRun elements={bottom[zone]} data={data} gap={48} axis="stack" />
                </div>
              ),
            )}
          </div>
        </div>
      </Container>
    </footer>
  );
}
