/**
 * Shop All's category chips.
 *
 * The design shows ~9 chips; the store has 63 flat `productType` values and no
 * category collections, so each chip maps to a set of product types and the
 * filter runs as a Storefront `query` rather than a collection lookup. Swapping
 * to real Shopify collections later means changing this file and nothing else.
 *
 * ⚠ TWO THINGS NEED CONFIRMING (see docs/pages/shop-all.md):
 *
 * 1. The chip LABELS are partly unreadable. The Figma PDF renders that row in a
 *    font whose embedded ToUnicode table is a 49-glyph subset covering only the
 *    header nav, so `d`, `c`, `h`, `m`, `u` and `&` decode to nothing there.
 *    "dining tables & chairs", "bar tables & chairs" and "side tables" are
 *    confident reads; "office furniture" and the rest are reconstructions.
 * 2. The GROUPING below is mine. It covers the whole catalogue so no product is
 *    unreachable — the design's chips alone would hide most of the 1,595.
 */

export type Category = {
  /** URL value, e.g. ?category=lighting */
  slug: string;
  label: string;
  /** Shopify `productType` values this chip selects. */
  types: string[];
};

export const CATEGORIES: Category[] = [
  {
    slug: "dining-tables-chairs",
    label: "dining tables & chairs",
    types: ["Dining Tables", "Dining Chairs"],
  },
  {
    slug: "bar-tables-chairs",
    label: "bar tables & chairs",
    types: ["Bar Tables", "Bar Stools", "Bar Tools & Accessories"],
  },
  {
    slug: "dressers-cabinets-consoles",
    label: "dressers, cabinets & consoles",
    types: ["Cabinets", "Consoles", "Nightstands", "Storage & Organizers", "Room Dividers"],
  },
  {
    slug: "coffee-side-tables",
    label: "coffee & side tables",
    types: ["Coffee Tables", "Side Tables"],
  },
  {
    slug: "seating",
    label: "seating",
    types: ["Sofas & Lounger", "Benches", "Stools", "Pouffes", "Sunbeds & Daybeds", "Bed Frames"],
  },
  {
    slug: "lighting",
    label: "lamps",
    types: ["Pendant Lamps", "Table Lamps", "Floor Lamps", "Wall Lamps", "Chandeliers", "On Stand"],
  },
  {
    slug: "decoration",
    label: "decoration",
    types: [
      "Mirrors",
      "Vases",
      "Statues",
      "Wall & Hanging",
      "Boho Accents",
      "Planters",
      "Candles & Holders",
      "Room Fragrance",
    ],
  },
  {
    slug: "textiles",
    label: "textiles",
    types: ["Cushion Covers", "Carpets & Runners", "Plaids & Throws", "Placemats", "Tassels"],
  },
  {
    slug: "tableware",
    label: "tableware",
    types: [
      "Bowls",
      "Plates",
      "Serving Dishes & Trays",
      "Cutlery",
      "Cups & Mugs",
      "Coasters",
      "Napkin Rings",
      "Cookware",
      "Cutting Boards",
      "Cooking Utensils",
      "Mixing & Measuring",
      "Bottles & Jars",
      "Seasonings",
    ],
  },
  {
    slug: "baskets-storage",
    label: "baskets",
    types: ["Baskets", "Cloth Hangers", "Hangers & Hooks", "Luggage Racks", "Brooms & Brushes"],
  },
  {
    slug: "accessories",
    label: "accessories",
    types: [
      "Bags",
      "Hats",
      "Jewelry",
      "Keychains",
      "Clutches & Wallets",
      "Table Accessories",
      "Bathroom Accessories",
      "Merchandise",
    ],
  },
];

export const findCategory = (slug?: string | null): Category | null =>
  CATEGORIES.find((category) => category.slug === slug) ?? null;

/**
 * Storefront search syntax. Types are quoted because most contain spaces or
 * an ampersand.
 */
export function categoryQuery(category: Category | null): string | undefined {
  if (!category?.types.length) return undefined;
  return category.types.map((type) => `product_type:"${type}"`).join(" OR ");
}
