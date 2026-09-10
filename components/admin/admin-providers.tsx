"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Mounted in `app/(admin)/admin/layout.tsx` and nowhere else. The storefront has
 * its own client in `components/providers.tsx` with its own settings; keeping
 * them separate is what stops either half of the app from shipping the other's
 * runtime (§6.1).
 *
 * The settings are close to the opposite of the storefront's. There, a generous
 * `staleTime` is right because the first paint comes from a Server Component and
 * catalogue data moves slowly. Here an operator is looking at rows they are about
 * to overwrite, so anything cached is a chance to clobber somebody else's edit.
 */
export function AdminProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            refetchOnWindowFocus: true,
            retry: 1,
          },
          mutations: {
            // A failed write must surface, not silently retry into a duplicate.
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
