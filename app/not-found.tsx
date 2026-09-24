import StorefrontNotFound, { metadata } from "@/app/(storefront)/not-found";
import { Providers } from "@/components/providers";

export { metadata };

/**
 * A URL no route claims never enters a route group, so the storefront's own
 * not-found.tsx is not reached and Next falls back to its bare default page.
 * The root one reuses it — header, footer and a way back into the site — with
 * the Providers the storefront layout would otherwise have supplied.
 */
export default function NotFound() {
  return (
    <Providers>
      <StorefrontNotFound />
    </Providers>
  );
}
