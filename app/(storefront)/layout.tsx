import { Providers } from "@/components/providers";

/**
 * Storefront-only shell. `Providers` (TanStack Query + the nuqs adapter) lives
 * here rather than in the root layout so that the admin panel — a sibling route
 * group — does not ship the storefront's client runtime, and vice versa. Moving
 * it up to the root would put both halves' client weight on every route.
 *
 * A route group is not a URL segment, so every storefront path is unchanged.
 */
export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return <Providers>{children}</Providers>;
}
