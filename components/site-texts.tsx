"use client";

import * as React from "react";

import { DEFAULT_SITE_TEXTS, type SiteTexts } from "@/lib/site-texts";

/**
 * The site's fixed texts for Client Components (the inquiry panel and form, the contact
 * form, the product's enquire button). Server Components call `getSiteTexts()` instead.
 * Filled once per page by the storefront layout; the originals outside it.
 */
const SiteTextsContext = React.createContext<SiteTexts>(DEFAULT_SITE_TEXTS);

export function SiteTextsProvider({ texts, children }: { texts: SiteTexts; children: React.ReactNode }) {
  return <SiteTextsContext.Provider value={texts}>{children}</SiteTextsContext.Provider>;
}

export function useSiteTexts(): SiteTexts {
  return React.useContext(SiteTextsContext);
}
