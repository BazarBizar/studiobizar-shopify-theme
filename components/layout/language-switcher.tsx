"use client";

import { Check, ChevronDown } from "lucide-react";

/**
 * Only English is translated today, so this opens onto a real dropdown with
 * the other two Benelux languages listed and disabled, rather than either a
 * dead button or a switcher with nothing to switch to. Swap this in for a
 * real locale list once Shopify Markets / translated content exists.
 */
const LOCALES = [
  { code: "EN", label: "English", available: true },
  { code: "NL", label: "Nederlands", available: false },
  { code: "FR", label: "Français", available: false },
] as const;

export function LanguageSwitcher() {
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-1 text-micro tracking-[0.08em] uppercase opacity-80 transition-opacity hover:opacity-100 marker:content-none"
        aria-label="Language: English"
      >
        EN
        <ChevronDown
          className="size-3 transition-transform group-open:rotate-180"
          strokeWidth={1.5}
          aria-hidden
        />
      </summary>

      <ul className="absolute top-full right-0 z-10 mt-3 min-w-36 border border-border bg-background py-2 shadow-sm">
        {LOCALES.map((locale) => (
          <li key={locale.code}>
            <button
              type="button"
              disabled={!locale.available}
              aria-current={locale.available ? "true" : undefined}
              className="text-secondary flex w-full items-center justify-between gap-4 px-4 py-2 text-left whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40"
            >
              {locale.label}
              {locale.available ? (
                <Check className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
              ) : (
                <span className="text-micro shrink-0 text-muted">Soon</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
