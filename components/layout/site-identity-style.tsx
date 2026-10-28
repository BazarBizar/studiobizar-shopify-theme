import { getSiteIdentity } from "@/lib/shopify";
import type { SiteIdentity } from "@/lib/shopify/entities";
import type { Maybe, ShopifyImage } from "@/lib/shopify/types";

/**
 * Hands an uploaded logo (Site-wide → Logo, icon & SEO) to every `<Logo>` on the page,
 * through the custom properties `styles/sb-logo.css` reads. Nothing is written when no
 * logo was uploaded, so the original vector lockup stays exactly as it was.
 *
 * Only a plain https address is ever put into the stylesheet — anything else is left
 * out rather than escaped, since it lands inside a <style> element.
 */

const SAFE_URL = /^https:\/\/[^\s"'<>\\()]+$/;

function declarations(prefix: "full" | "mark", image: Maybe<ShopifyImage>, colour: SiteIdentity["logoColour"]): string[] {
  if (!image || !SAFE_URL.test(image.url)) return [];
  const ratio = image.width && image.height ? `${image.width} / ${image.height}` : prefix === "mark" ? "1 / 1" : "4 / 1";
  const url = `url("${image.url}")`;
  return colour === "original"
    ? [
        `--sb-logo-${prefix}-ratio:${ratio}`,
        `--sb-logo-${prefix}-shape:none`,
        `--sb-logo-${prefix}-picture:${url}`,
        `--sb-logo-${prefix}-fill:transparent`,
      ]
    : [`--sb-logo-${prefix}-ratio:${ratio}`, `--sb-logo-${prefix}-shape:${url}`];
}

export function siteIdentityCss(identity: SiteIdentity): string {
  const full = declarations("full", identity.logo, identity.logoColour);
  const mark = declarations("mark", identity.logoMark, identity.logoColour);
  if (!full.length && !mark.length) return "";
  // The header and drawer give the lockup a fixed width for ITS proportions; an uploaded
  // logo takes the width its own proportions give at that height.
  const width = full.length ? `.sb-logo[data-variant="full"]{width:auto!important;max-width:min(100%,24rem)}` : "";
  return `:root{${[...full, ...mark].join(";")}}${width}`;
}

export async function SiteIdentityStyle() {
  const css = siteIdentityCss(await getSiteIdentity());
  return css ? <style data-site-identity>{css}</style> : null;
}
