"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { Toaster } from "@/components/admin/ui/sonner";
import { TooltipProvider } from "@/components/admin/ui/tooltip";

/**
 * Every client provider the panel needs, mounted in
 * `app/(admin)/admin/layout.tsx` and nowhere else. The storefront has its own
 * `components/providers.tsx`; keeping them separate is what stops either half of
 * the app from shipping the other's runtime.
 *
 * `next-themes` is mounted HERE rather than in the root layout on purpose. It
 * writes a class onto <html>, which is global — but the storefront defines no
 * `.dark` rules at all (it uses the `data-surface` grounds instead), so the class
 * is inert on public pages. Mounting the provider at the root would instead put a
 * theme listener on every storefront visit for a feature only the panel has.
 */
export function AdminProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * Close to the opposite of the storefront's settings. There, a
             * generous `staleTime` is right because first paint comes from a
             * Server Component and catalogue data moves slowly. Here an operator
             * is looking at rows they are about to overwrite, so anything cached
             * is a chance to clobber somebody else's edit.
             */
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

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {children}
          {/* Rendered inside the panel so its trigger context is the panel, and
              positioned top-right per the shared convention. */}
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
