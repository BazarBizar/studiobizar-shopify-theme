"use client";

import { Search as SearchIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Container } from "@/components/ui/container";
import { shopifyUrlToRoute } from "@/lib/routes";
import { cdnImage } from "@/lib/shopify/transforms";
import type { ProductCard } from "@/lib/shopify/types";
import { useUi } from "@/store/ui";

type PredictiveResults = {
  products: ProductCard[];
  collections: { id: string; handle: string; title: string }[];
  pages: { id: string; handle: string; title: string }[];
};

const EMPTY: PredictiveResults = { products: [], collections: [], pages: [] };

/**
 * Opens over the page rather than navigating to it — `/search` still exists
 * for a full result set, but typing here never leaves the page you were on.
 * Debounced against `/api/search/predictive`, which just calls the
 * `predictiveSearch` helper that already existed with no caller.
 */
export function SearchOverlay() {
  const open = useUi((state) => state.searchOpen);
  const close = useUi((state) => state.closeSearch);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PredictiveResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clearing on open happens during render, not in an effect: adjusting state
  // from a change in props/store value this way is the pattern React itself
  // recommends over a setState-in-effect, which would cost an extra frame.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setResults(EMPTY);
    }
  }

  // Lock scroll and wire Escape while open; focus the field once it mounts.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 50);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(focusId);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Debounced predictive fetch, cancelled if the query changes again first.
  // An empty query is handled entirely by the render-time gating below —
  // `trimmed.length > 0` — rather than by resetting `results` here, so this
  // effect never needs to call setState just because there is nothing to ask
  // the API for.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    let cancelled = false;

    const id = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/search/predictive?q=${encodeURIComponent(trimmed)}`)
        .then((response) => (response.ok ? response.json() : EMPTY))
        .then((data: PredictiveResults) => {
          if (!cancelled) setResults(data);
        })
        .catch(() => {
          if (!cancelled) setResults(EMPTY);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query]);

  const trimmed = query.trim();
  // Gated on `trimmed` rather than on `results` alone, so a result set from
  // the previous query never lingers for the instant after the field clears.
  const hasResults =
    trimmed.length > 0 &&
    (results.products.length > 0 || results.collections.length > 0 || results.pages.length > 0);
  const showEmpty = trimmed.length > 0 && !loading && !hasResults;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            type="button"
            aria-label="Close search"
            onClick={close}
            className="absolute inset-0 bg-off-black/40"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            data-surface="light"
            className="absolute inset-x-0 top-0 max-h-[85vh] overflow-y-auto bg-background text-foreground"
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Container className="py-8">
              <div className="flex items-center gap-4 border-b border-foreground pb-3">
                <SearchIcon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
                <label htmlFor="predictive-search" className="sr-only">
                  Search products, collections and pages
                </label>
                <input
                  ref={inputRef}
                  id="predictive-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products, collections, pages"
                  className="text-h3 w-full bg-transparent placeholder:text-muted focus:outline-none"
                />
                <button type="button" onClick={close} aria-label="Close search" className="shrink-0">
                  <X className="size-5" strokeWidth={1.5} aria-hidden />
                </button>
              </div>

              {showEmpty && <p className="text-body mt-8 text-muted">No results for &ldquo;{trimmed}&rdquo;.</p>}

              {trimmed.length > 0 && results.pages.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-tertiary mb-3 text-muted uppercase tracking-[0.06em]">Pages</h2>
                  <ul className="flex flex-col gap-2">
                    {results.pages.map((page) => (
                      <li key={page.id}>
                        <Link
                          href={shopifyUrlToRoute(`/pages/${page.handle}`)}
                          onClick={close}
                          className="text-secondary sb-underline"
                        >
                          {page.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trimmed.length > 0 && results.collections.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-tertiary mb-3 text-muted uppercase tracking-[0.06em]">Collections</h2>
                  <ul className="flex flex-col gap-2">
                    {results.collections.map((collection) => (
                      <li key={collection.id}>
                        <Link
                          href={shopifyUrlToRoute(`/collections/${collection.handle}`)}
                          onClick={close}
                          className="text-secondary sb-underline"
                        >
                          {collection.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trimmed.length > 0 && results.products.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-tertiary mb-3 text-muted uppercase tracking-[0.06em]">Products</h2>
                  <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                    {results.products.map((product) => (
                      <li key={product.id}>
                        <Link
                          href={`/shop/${product.handle}`}
                          onClick={close}
                          className="group flex items-center gap-4"
                        >
                          <div className="relative aspect-square w-16 shrink-0 overflow-hidden bg-foreground/5">
                            {product.image && (
                              <Image
                                src={cdnImage(product.image.url)}
                                alt={product.image.altText ?? product.title}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            )}
                          </div>
                          <span className="text-secondary sb-underline">{product.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trimmed.length > 0 && (
                <div className="mt-10 border-t border-border pt-6">
                  <Link
                    href={`/search?q=${encodeURIComponent(trimmed)}`}
                    onClick={close}
                    className="text-button sb-underline uppercase tracking-[0.06em]"
                  >
                    See all results for &ldquo;{trimmed}&rdquo;
                  </Link>
                </div>
              )}
            </Container>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
