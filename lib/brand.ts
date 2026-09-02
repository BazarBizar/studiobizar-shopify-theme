/**
 * Brand constants for contexts that cannot read CSS — the inquiry PDF and the
 * transactional emails.
 *
 * The six `[figma]` values are the same hexes as the palette in
 * `app/globals.css`, read out of the Figma PDFs. The `[derived]` tints exist
 * only here: pdf-lib needs a table rule and a zebra row, and neither appears in
 * the designs. They are mixes of the measured colours, not new brand colours.
 *
 * If a palette token changes in globals.css, change it here too.
 */

export const BRAND = {
  name: "Studio Bizar",
  tagline: "Designed for life, inspired by the world.",
  url: "https://studiobizar.be",

  /* Measured — identical to globals.css */
  earth: "#EBE8E3", // [figma] --color-earth
  darkWood: "#302F2D", // [figma] --color-dark-wood
  blackOlive: "#41473E", // [figma] --color-black-olive
  charcoalBlue: "#47515C", // [figma] --color-charcoal-blue
  deepMocha: "#521011", // [figma] --color-deep-mocha
  offBlack: "#1D1D1B", // [figma] --color-off-black

  /* Roles used by the PDF and email layouts */
  ink: "#302F2D", // body text — dark wood
  heading: "#41473E", // titles — black olive
  muted: "#6E6B66", // [derived] dark wood lightened toward earth
  border: "#D7D3CC", // [derived] earth darkened, for hairlines
  headerBg: "#DFDBD4", // [derived] earth darkened, for the table header band
  zebra: "#F5F3F0", // [derived] earth lightened, for alternating rows
  paper: "#FFFFFF",
} as const;

export type BrandColor = keyof typeof BRAND;
