import { z } from "zod";

import "@/lib/zod-config";

import { quoted } from "./catalogue-filter";

/**
 * Shop All's category chips — the "by type" row above the grid.
 *
 * The store has flat `productType` values and no category collections, so each chip
 * maps to a set of product types and the filter runs as a Storefront `query` rather
 * than a collection lookup.
 *
 * THE LIST IS EDITED IN THE ADMIN (Content → Shop categories, `lib/admin/shop-categories.ts`)
 * and kept as one json metafield on the shop, `custom.shop_categories`. Until it has
 * been saved once the storefront draws `DEFAULT_CATEGORIES` below, which is the list
 * the site has always shown — so the first save starts from what is on the site.
 *
 * Shared by the storefront, the admin and the browser: plain data, no `server-only`.
 */

export type Category = {
  /**
   * URL value, e.g. ?category=lighting. Made from the name when a category is first
   * saved and kept from then on, so renaming a category does not break shared links.
   */
  slug: string;
  label: string;
  /** Shopify `productType` values this chip selects. */
  types: string[];
};

export const SHOP_CATEGORIES_KEY = "shop_categories";
export const SHOP_CATEGORIES_VERSION = 1;

export const CATEGORY_LIMITS = { categories: 40, label: 60, types: 120, type: 255 } as const;

/**
 * The original grouping, from before the list could be edited. The design's ~9
 * furniture-led chips alone would hide most of the catalogue, so these cover every
 * product type the store had — see docs/pages/shop-all.md.
 */
export const DEFAULT_CATEGORIES: readonly Category[] = [
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

export const findCategory = (categories: readonly Category[], slug?: string | null): Category | null =>
  categories.find((category) => category.slug === slug) ?? null;

/**
 * Storefront search syntax. Types are quoted because most contain spaces or
 * an ampersand — and now that anyone can type one, escaped as well.
 */
export function categoryQuery(category: Category | null): string | undefined {
  if (!category?.types.length) return undefined;
  return category.types.map((type) => `product_type:${quoted(type)}`).join(" OR ");
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const categorySchema = z.object({
  slug: z.string().regex(SLUG).max(80),
  label: z.string().trim().min(1).max(CATEGORY_LIMITS.label),
  types: z.array(z.string().min(1).max(CATEGORY_LIMITS.type)).max(CATEGORY_LIMITS.types),
});

const storedSchema = z.object({
  version: z.literal(SHOP_CATEGORIES_VERSION),
  categories: z.array(categorySchema).max(CATEGORY_LIMITS.categories),
  savedAt: z.string().nullable().optional(),
  savedBy: z.string().nullable().optional(),
});

export type StoredShopCategories = z.infer<typeof storedSchema>;

/**
 * The saved list, or null when there is none or it cannot be read — the caller then
 * draws `DEFAULT_CATEGORIES`. A list someone emptied on purpose is still a list.
 */
export function parseShopCategories(raw: string | null | undefined): StoredShopCategories | null {
  if (!raw) return null;
  try {
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** "Dressers, Cabinets & Consoles" → "dressers-cabinets-consoles". */
export function slugifyCategory(label: string): string {
  const slug = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "category";
}

/**
 * Gives every category without a slug one made from its name, and makes every slug
 * unique — two chips on one address would make the second unreachable.
 */
export function assignSlugs(categories: { slug?: string | null; label: string; types: string[] }[]): Category[] {
  const taken = new Set<string>();
  const unique = (base: string) => {
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  };
  // Kept slugs first, so a new category never takes an address an old one already has.
  const kept = categories.map((category) =>
    category.slug && SLUG.test(category.slug) && !taken.has(category.slug) ? unique(category.slug) : null,
  );
  return categories.map((category, index) => ({
    slug: kept[index] ?? unique(slugifyCategory(category.label)),
    label: category.label.trim(),
    types: [...new Set(category.types)],
  }));
}
