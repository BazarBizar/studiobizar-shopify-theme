"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/admin/error-state";

/**
 * The panel's error boundary, so a thrown Shopify failure renders as the shared
 * `ErrorState` inside the shell rather than as Next's default page — which would drop the
 * operator out of the sidebar and give them no way back.
 *
 * `error.digest` is the only identifier Next exposes for a server error; the message
 * itself is replaced with a generic string in production precisely so nothing internal
 * leaks, which is why the digest is worth showing.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The real cause is already on the server's stderr via `logInternalError`; this is the
    // browser-side record for anything that failed after hydration.
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-2xl">
      <ErrorState
        title="This screen could not load"
        error="Shopify did not answer, or something in the panel failed. Trying again is usually enough."
        code={error.digest}
        onRetry={reset}
      />
    </div>
  );
}
