"use client";

import { Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ROUTES } from "@/lib/routes";
import { selectTotalQuantity, useInquiryCart } from "@/store/inquiry-cart";
import { useUi } from "@/store/ui";

/** The right cluster: language switch, account, search and the inquiry bag. */
export function HeaderActions() {
  const count = useInquiryCart(selectTotalQuantity);
  const hydrated = useInquiryCart((state) => state.hydrated);
  const openDrawer = useUi((state) => state.openInquiryDrawer);
  const openSearch = useUi((state) => state.openSearch);

  return (
    <div className="flex items-center gap-4">
      <LanguageSwitcher />

      <Link
        href={ROUTES.account}
        className="transition-opacity hover:opacity-70"
        aria-label="Account"
      >
        <User className="size-[1.15rem]" strokeWidth={1.5} aria-hidden />
      </Link>

      <button
        type="button"
        onClick={openSearch}
        aria-label="Search"
        className="transition-opacity hover:opacity-70"
      >
        <Search className="size-[1.15rem]" strokeWidth={1.5} aria-hidden />
      </button>

      <button
        type="button"
        onClick={openDrawer}
        aria-label={hydrated && count > 0 ? `Your inquiry, ${count} items` : "Your inquiry"}
        aria-haspopup="dialog"
        className="relative transition-opacity hover:opacity-70"
      >
        <ShoppingBag className="size-[1.15rem]" strokeWidth={1.5} aria-hidden />
        {/* Rendered only after rehydration, or SSR would print 0 and mismatch. */}
        {hydrated && count > 0 && (
          <span className="text-micro absolute -top-1.5 -right-2 min-w-4 rounded-pill bg-foreground px-1 text-center tabular-nums text-background">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
    </div>
  );
}
