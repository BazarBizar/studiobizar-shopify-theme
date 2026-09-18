"use client";

import { useEffect } from "react";

import { Logo } from "@/components/layout/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * The storefront's error boundary.
 *
 * Every public page reads Shopify at request time, so "Shopify did not answer"
 * is a real state rather than a theoretical one — and until now it rendered
 * Next's default error page: unbranded, and with no way back into the site. The
 * admin half has had its own boundary all along; this is the same idea on the
 * public side.
 *
 * IT DOES NOT USE `PageShell`, and cannot. An error boundary must be a client
 * component, while `PageShell` renders `Header` and `Footer`, both of which are
 * async server components that fetch menus. Importing it here would pull those
 * into the client bundle, where an async component cannot run at all. So the
 * shell is rebuilt in miniature: the mark, a way back, nothing that fetches.
 *
 * That constraint is also a virtue here. This page renders when Shopify is
 * unreachable, and a header that needs a menu from Shopify is exactly the thing
 * that would fail a second time.
 *
 * `reset()` re-renders the segment without a full page load, which is the right
 * first thing to try: most failures here are a timeout or a rate limit, and the
 * next attempt succeeds.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server has already logged the real cause; this is the browser-side
    // record for anything that failed after hydration.
    console.error(error);
  }, [error]);

  return (
    <div
      data-surface="light"
      className="flex min-h-full flex-col bg-background text-foreground"
    >
      <header className="sb-container py-5">
        <Logo className="h-5 w-[11.47rem]" />
      </header>

      <main className="flex-1">
        <Container className="py-section">
          <h1 className="text-h1">Something went wrong</h1>
          <p className="text-body mt-4 max-w-[36rem] text-muted">
            This page could not be loaded. It is usually temporary — trying again is
            worth a moment.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Button variant="solid" onClick={reset}>
              Try again
            </Button>
            <ButtonLink href="/" variant="outline">
              Back to home
            </ButtonLink>
          </div>

          {/*
            `error.message` is replaced with a generic string in production
            precisely so nothing internal leaks, so the digest is the only
            identifier Next exposes — and it is what ties a visitor's report to a
            line in the server log.
          */}
          {error.digest && (
            <p className="text-tertiary mt-8 text-muted">Reference: {error.digest}</p>
          )}
        </Container>
      </main>
    </div>
  );
}
