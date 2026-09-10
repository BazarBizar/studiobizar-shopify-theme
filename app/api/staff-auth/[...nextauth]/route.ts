import { handlers } from "@/lib/admin/auth";

/**
 * Staff auth endpoints. Mounted at `/api/staff-auth`, NOT the Auth.js default
 * `/api/auth` — that prefix belongs to the storefront's Shopify customer OAuth
 * flow (`/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`). The
 * `basePath` in `lib/admin/auth.ts` has to agree with this folder name.
 */
export const { GET, POST } = handlers;
