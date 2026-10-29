import "server-only";

import { z } from "zod";

import { fail, type ErrorCode } from "./api";
import { MAX_MENU_ITEMS, MENU_HANDLE, treeDepth, type StoredMenuItem } from "./menu-tree";
import { MenuRuleError } from "./menus";

/**
 * What the menu routes accept: a whole tree, at most three levels, each item one of
 * Shopify's link types. A product type or vendor arrives as the web link Shopify's
 * own editor makes of it (see `menu-tree.ts`), so it needs no type of its own here.
 */

const TYPES = [
  "FRONTPAGE",
  "CATALOG",
  "COLLECTIONS",
  "SEARCH",
  "HTTP",
  "PAGE",
  "COLLECTION",
  "SHOP_POLICY",
  "PRODUCT",
  "BLOG",
  "ARTICLE",
  "CUSTOMER_ACCOUNT_PAGE",
  "METAOBJECT",
] as const;

const base = {
  /** Absent for an item being added. */
  id: z.string().regex(/^gid:\/\/shopify\/MenuItem\/\d+$/).optional(),
  title: z.string().trim().min(1).max(255),
  type: z.enum(TYPES),
  url: z.string().max(2048).nullable().optional(),
  resourceId: z.string().max(255).nullable().optional(),
  tags: z.array(z.string().min(1).max(255)).max(10).optional(),
};

const third = z.strictObject(base);
const second = z.strictObject({ ...base, items: z.array(third).max(MAX_MENU_ITEMS).optional() });
const first = z.strictObject({ ...base, items: z.array(second).max(MAX_MENU_ITEMS).optional() });

const count = (items: StoredMenuItem[]): number => items.reduce((sum, item) => sum + 1 + count(item.items ?? []), 0);

export const menuItemsSchema = z
  .array(first)
  .max(MAX_MENU_ITEMS)
  .refine((items) => count(items as StoredMenuItem[]) <= MAX_MENU_ITEMS, `A menu holds at most ${MAX_MENU_ITEMS} links.`)
  .refine((items) => treeDepth(items as StoredMenuItem[]) <= 3, "A menu goes at most three levels deep.");

export const menuTitle = z.string().trim().min(1, "Give the menu a name.").max(255);
export const menuHandle = z.string().min(1).max(255).regex(MENU_HANDLE, "Use lowercase letters, numbers and dashes.");
export const menuId = z.string().regex(/^gid:\/\/shopify\/Menu\/\d+$/, "not a menu id");

export const countMenuItems = count;

const RULE_STATUS: Record<MenuRuleError["code"], ErrorCode> = {
  RESERVED: "CONFLICT",
  IN_USE: "CONFLICT",
  NOT_ALLOWED: "NOT_ALLOWED",
  INVALID: "INVALID",
};

/** A rule the panel enforces (the site's own menus, a menu in use) → its answer. */
export function menuRuleResponse(error: unknown) {
  return error instanceof MenuRuleError ? fail(RULE_STATUS[error.code], error.message, { rule: error.code }) : null;
}
