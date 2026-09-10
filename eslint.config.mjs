import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * The storefront/admin import boundary is enforced here, not by convention.
 *
 * `lib/admin/**` is where the Admin API token is read and where the write
 * pipeline lives. Every module in it opens with `import "server-only"`, which
 * catches an import from a Client Component — but NOT an import from a storefront
 * Server Component, which would happily pull admin code into a public page's
 * render path. This rule catches that case, and it fails the build rather than
 * waiting for a review to notice.
 *
 * It is written as a denial for everything plus an allowance for the admin half,
 * rather than a denial aimed at `app/(storefront)/**`. That way a new storefront
 * file — or a new top-level route outside the group — is covered the moment it is
 * created instead of when somebody remembers to extend a list.
 */
const adminOnly = [
  "lib/admin/**",
  "components/admin/**",
  "app/(admin)/**",
  "app/api/admin/**",
  "app/api/staff-auth/**",
  // Needs the staff cookie name, and only that.
  "proxy.ts",
  // Run by hand against the store; never part of a page render path.
  "scripts/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/admin", "@/lib/admin/*", "**/lib/admin", "**/lib/admin/*"],
              message:
                "lib/admin is admin-panel only: it reads the Shopify Admin API token. Storefront code must go through lib/shopify instead.",
            },
          ],
        },
      ],
    },
  },

  /**
   * The patterns above match the import STRING, not the resolved path, so they
   * miss a sibling inside `lib/` reaching across with `./admin/env`. That is the
   * one relative form short enough not to contain "lib/admin", so it gets its own
   * rule. (From `app/**` the relative path is `../../lib/admin/…`, which the
   * patterns above already catch.)
   */
  {
    files: ["lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./admin", "./admin/*", "../admin", "../admin/*"],
              message:
                "lib/admin is admin-panel only: it reads the Shopify Admin API token. Storefront code must go through lib/shopify instead.",
            },
          ],
        },
      ],
    },
  },

  { files: adminOnly, rules: { "no-restricted-imports": "off" } },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
