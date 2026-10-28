/**
 * Site-wide → Logo, icon & SEO (`site_identity`): how a saved entry is read, and the
 * logo stylesheet written from it — offline, nothing is fetched.
 *
 *   yarn check:site-identity
 */

import { EMPTY_SITE_IDENTITY, googleVerificationCode, normalizeSiteIdentity, type SiteIdentity } from "../lib/shopify/entities";
import type { ShopifyMetaobject } from "../lib/shopify/types";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${!ok && detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`);
  if (!ok) failures += 1;
}

const image = (url: string, width = 800, height = 200) => ({
  __typename: "MediaImage",
  image: { url, altText: null, width, height },
});

function entry(fields: Record<string, string | null>, references: Record<string, unknown> = {}): ShopifyMetaobject {
  return {
    id: "gid://shopify/Metaobject/1",
    handle: "site-identity",
    type: "site_identity",
    fields: [...new Set([...Object.keys(fields), ...Object.keys(references)])].map((key) => ({
      key,
      value: fields[key] ?? null,
      type: "single_line_text_field",
      reference: (references[key] ?? null) as never,
    })),
  } as unknown as ShopifyMetaobject;
}

async function main() {
  const { siteIdentityCss } = await import("../components/layout/site-identity-style");

  /* Reading */
  const empty = normalizeSiteIdentity(entry({}));
  check("an empty entry reads as the site was before: Studio Bizar, no logo, no icon", JSON.stringify(empty) === JSON.stringify(EMPTY_SITE_IDENTITY), empty);

  const full = normalizeSiteIdentity(
    entry(
      { site_name: "  Bizar Studio ", logo_colour: "original", meta_description: "Hand-made.", theme_color: "#1A2B3C" },
      { logo: image("https://cdn.shopify.com/s/files/logo.png"), favicon: image("https://cdn.shopify.com/s/files/icon.png", 512, 512) },
    ),
  );
  check(
    "a filled entry: name trimmed, logo, icon, colours, description",
    full.siteName === "Bizar Studio" && full.logo?.width === 800 && Boolean(full.favicon?.url.endsWith("icon.png")) && full.logoColour === "original" && full.metaDescription === "Hand-made." && full.themeColor === "#1A2B3C",
    full,
  );
  check("an unknown logo colour choice is read as “same colour as the text”", normalizeSiteIdentity(entry({ logo_colour: "rainbow" })).logoColour === "text");
  check("a colour that is not #RRGGBB is ignored", normalizeSiteIdentity(entry({ theme_color: "red; background:url(x)" })).themeColor === null);

  /* Google's code, however it was pasted */
  check("google: the code alone", googleVerificationCode("abcDEF123_-xyz456") === "abcDEF123_-xyz456");
  check(
    "google: the whole <meta> tag Google shows",
    googleVerificationCode('<meta name="google-site-verification" content="abcDEF123_-xyz456" />') === "abcDEF123_-xyz456",
  );
  check("google: anything else is refused", googleVerificationCode('"><script>alert(1)</script>') === null && googleVerificationCode("") === null);

  /* The logo stylesheet */
  check("no logo uploaded: nothing is written, the original lockup stays", siteIdentityCss(EMPTY_SITE_IDENTITY) === "");

  const withLogo: SiteIdentity = { ...EMPTY_SITE_IDENTITY, logo: { url: "https://cdn.shopify.com/s/files/logo.png", altText: null, width: 800, height: 200 } };
  const textCss = siteIdentityCss(withLogo);
  check(
    "same colour as the text: the upload becomes the mask, with its own proportions",
    textCss.includes('--sb-logo-full-shape:url("https://cdn.shopify.com/s/files/logo.png")') && textCss.includes("--sb-logo-full-ratio:800 / 200") && !textCss.includes("picture"),
    textCss,
  );
  check("…and the header lets it take its own width", textCss.includes('.sb-logo[data-variant="full"]{width:auto!important'));
  check("…while the symbol keeps the original", !textCss.includes("--sb-logo-mark"));

  const ownCss = siteIdentityCss({ ...withLogo, logoColour: "original" });
  check(
    "the logo’s own colours: drawn as a picture, no mask, no fill",
    ownCss.includes("--sb-logo-full-shape:none") && ownCss.includes("--sb-logo-full-picture:url(") && ownCss.includes("--sb-logo-full-fill:transparent"),
    ownCss,
  );

  const hostile = siteIdentityCss({
    ...EMPTY_SITE_IDENTITY,
    logo: { url: 'https://cdn.shopify.com/x.png");}</style><script>alert(1)</script>', altText: null, width: 1, height: 1 },
    logoMark: { url: "javascript:alert(1)", altText: null, width: 1, height: 1 },
  });
  check("an address that is not a plain https URL never reaches the stylesheet", hostile === "", hostile);
}

main()
  .then(() => {
    console.log(failures ? `\n${failures} site identity check(s) failed.` : "\nAll site identity checks passed.");
    process.exit(failures ? 1 : 0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
