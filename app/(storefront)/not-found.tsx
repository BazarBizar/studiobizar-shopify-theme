import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata = {
  title: "Page not found",
  // A 404 has nothing worth indexing, and every one of them would otherwise
  // compete with the real page whose URL was mistyped.
  robots: { index: false, follow: true },
};

/**
 * The storefront's 404, for any URL no route claims.
 *
 * Four routes already have their own — `/shop/[handle]`, `/collections/[handle]`,
 * `/designers/[handle]`, `/projects/[handle]` — and those stay, because "we
 * couldn't find that piece" is more useful than this when we know what was being
 * looked for. This catches everything else, which until now fell through to
 * Next's default page: unbranded, no header, no footer, and no way back into the
 * site.
 */
export default function NotFound() {
  return (
    <PageShell surface="light">
      <Container className="py-section">
        <h1 className="text-h1">We couldn&rsquo;t find that page</h1>
        <p className="text-body mt-4 max-w-[36rem] text-muted">
          The address may be mistyped, or the page may have been renamed since the
          link was made.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <ButtonLink href="/shop" variant="solid">
            Browse all products
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </Container>
    </PageShell>
  );
}
