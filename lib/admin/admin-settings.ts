import "server-only";

import { listAllEntries } from "./metaobjects";

/**
 * Branding for the admin panel itself, from the `admin_settings` singleton
 * (`scripts/add-admin-settings.mjs`; Site-wide → Admin panel).
 *
 * BEST-EFFORT, NEVER THROWS. This is read by the layout on every admin page; a Shopify
 * hiccup, a missing definition or an empty field must cost the panel its custom name,
 * not the panel. Anything missing falls back to what was hardcoded before.
 */

export type AdminSettings = {
  title: string;
  /** The smaller line under the title in the sidebar. */
  subtitle: string;
  initials: string;
  /** CDN url of the logo image; when set it replaces the initials square. */
  logoUrl: string | null;
  /** CDN url of the favicon image, or null for the site's own icon. */
  faviconUrl: string | null;
  /** The dashboard's (`/admin`) heading and the sentence under it. */
  dashboardTitle: string;
  dashboardDescription: string;
};

const DEFAULTS: AdminSettings = {
  title: "Studio Bizar",
  subtitle: "Admin",
  initials: "SB",
  logoUrl: null,
  faviconUrl: null,
  dashboardTitle: "Dashboard",
  dashboardDescription: "Everything on this store is edited here and stored in Shopify.",
};

/** Per process. An edit is also cleared immediately by `revalidateForType`. */
const TTL_MS = 60_000;

let cache: { at: number; value: AdminSettings } | null = null;

export function clearAdminSettingsCache(): void {
  cache = null;
}

export async function getAdminSettings(): Promise<AdminSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  try {
    const [entry] = await listAllEntries("admin_settings");
    const field = (key: string) => entry?.fields.find((candidate) => candidate.key === key);

    const text = (key: string) => field(key)?.value?.trim() || "";
    const image = (key: string) => field(key)?.reference?.image?.url ?? null;

    const value: AdminSettings = {
      title: text("panel_title") || DEFAULTS.title,
      subtitle: text("panel_subtitle") || DEFAULTS.subtitle,
      initials: text("panel_initials").slice(0, 3) || DEFAULTS.initials,
      logoUrl: image("logo"),
      faviconUrl: image("favicon"),
      dashboardTitle: text("dashboard_title") || DEFAULTS.dashboardTitle,
      dashboardDescription: text("dashboard_description") || DEFAULTS.dashboardDescription,
    };

    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    // `NotAllowedError` when the definition does not exist in this store — expected
    // until the script has run, so it is not worth a stack trace.
    if (!(error instanceof Error && error.name === "NotAllowedError")) {
      console.error("[admin] could not read admin_settings", error);
    }
    return DEFAULTS;
  }
}
