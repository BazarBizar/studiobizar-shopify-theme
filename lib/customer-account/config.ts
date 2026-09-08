/**
 * Shopify Customer Account API — a separate OAuth-protected API from the
 * Storefront and Admin ones already used elsewhere in `lib/shopify`. It needs
 * two things neither of those do:
 *
 *   1. "New customer accounts" turned on for the shop
 *      (Shopify Admin → Settings → Customer accounts).
 *   2. A Client ID for this storefront, from Shopify Admin → Settings →
 *      Customer accounts → Customer Account API (or the Headless channel,
 *      depending on the plan). That page also wants this app's exact login
 *      callback URL added to its allowed redirect URIs:
 *
 *        {origin}/api/auth/callback
 *
 *      Neither step has a GraphQL mutation — they only exist as an admin
 *      screen — so nothing here can provision them the way `schema-push`
 *      provisions metaobjects and menus. Once both are done, set:
 *
 *        SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID=shp_...
 *
 *      in `.env`. Until then `customerAccountConfigured()` is false and the
 *      account page shows a plain "not connected yet" state instead of a
 *      broken sign-in button.
 */

const SHOP_ID = "75081089160";
const API_VERSION = "2025-07";

export function customerAccountConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID);
}

export const customerAccountConfig = {
  clientId: process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID ?? "",
  shopId: SHOP_ID,
  authorizeUrl: `https://shopify.com/authentication/${SHOP_ID}/oauth/authorize`,
  tokenUrl: `https://shopify.com/authentication/${SHOP_ID}/oauth/token`,
  logoutUrl: `https://shopify.com/authentication/${SHOP_ID}/logout`,
  graphqlUrl: `https://shopify.com/${SHOP_ID}/account/customer/api/${API_VERSION}/graphql`,
  scope: "openid email customer-account-api:full",
};

/** This app's own callback — must match a redirect URI registered in Admin. */
export function callbackUrl(origin: string): string {
  return `${origin}/api/auth/callback`;
}
