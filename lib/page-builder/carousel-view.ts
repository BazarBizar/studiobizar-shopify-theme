/**
 * The carousel settings → what a row draws. No zod and no field helpers, so the
 * storefront's client `Carousel` can import it; `carousel.ts` re-exports all of it.
 */

export type PerView = { d: number; t: number; m: number };
export type CarouselStep = number | "page";
export type CarouselView = {
  /** null: the section's own widths (its `slideClassName`). */
  perView: PerView | null;
  step: CarouselStep;
};

/** The settings → what `Carousel` draws. `designed` is the section's own row, in items across. */
export function carouselView(
  settings: { perDesktop?: string; perTablet?: string; perMobile?: string; step?: string },
  designed: PerView,
): CarouselView {
  const read = (value: string | undefined) => {
    const n = Number(value);
    return value && value !== "auto" && Number.isFinite(n) && n > 0 ? n : null;
  };
  const chosen = { d: read(settings.perDesktop), t: read(settings.perTablet), m: read(settings.perMobile) };
  const step: CarouselStep = settings.step === "page" ? "page" : Math.max(1, Number(settings.step) || 1);
  if (chosen.d === null && chosen.t === null && chosen.m === null) return { perView: null, step };
  return { perView: { d: chosen.d ?? designed.d, t: chosen.t ?? designed.t, m: chosen.m ?? designed.m }, step };
}

/** The custom properties the shared rules read (`data-cv`): items across, and the gaps between them. */
export function carouselStyle(perView: PerView): Record<string, string> {
  const gaps = (n: number) => String(Math.max(0, Math.ceil(n) - 1));
  return {
    "--cv-d": String(perView.d),
    "--cv-t": String(perView.t),
    "--cv-m": String(perView.m),
    "--cv-d-gaps": gaps(perView.d),
    "--cv-t-gaps": gaps(perView.t),
    "--cv-m-gaps": gaps(perView.m),
  };
}

/** The section's own rows, in items across — what "As designed" means for each. */
export const DESIGNED = {
  /** Carousel's default: 78% / 46% / a quarter. */
  row: { d: 4, t: 2.15, m: 1.28 },
  instagram: { d: 5, t: 3.3, m: 2.2 },
  testimonials2: { d: 2, t: 2, m: 1.16 },
  testimonials3: { d: 3, t: 2.15, m: 1.16 },
  projects: { d: 3, t: 2, m: 1.15 },
} as const satisfies Record<string, PerView>;
