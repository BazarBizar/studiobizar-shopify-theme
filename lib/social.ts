/**
 * The six social marks in the footer, extracted as SVG from the Figma PDF
 * (`public/brand/social/`) because lucide v1 ships no brand icons.
 *
 * ⚠ The icon → platform mapping below is INFERRED from each glyph's geometry,
 * not from anything written in the design. Only the three channels the Contact
 * page actually names — Instagram, Facebook and Pinterest, all
 * @studiobizarantwerp — have confirmed handles.
 *
 * THE DESTINATIONS ARE NO LONGER SET HERE. Each slot names a field on the
 * `site_settings` singleton, and `resolveSocialLinks` prefers what an operator
 * has entered there. The `href` below is the fallback for a store where that
 * field is empty, so the footer renders the same links it always has.
 *
 * The LABELS stay in code on purpose. A label names which platform a glyph
 * belongs to, and that is an unresolved question about the artwork rather than a
 * setting — putting it in the panel would invite somebody to answer it by
 * guessing. Confirm the two unknown marks, then correct them here.
 */

export type SocialLink = {
  /** File in `public/brand/social/`. */
  icon: string;
  label: string;
  href: string | null;
  confirmed: boolean;
  /** Field on the `site_settings` singleton that overrides `href`. */
  settingKey: string;
};

export const SOCIAL_LINKS: SocialLink[] = [
  {
    icon: "social-1",
    settingKey: "social_instagram",
    label: "Instagram",
    href: "https://www.instagram.com/studiobizarantwerp",
    confirmed: true,
  },
  {
    icon: "social-2",
    settingKey: "social_facebook",
    label: "Facebook",
    href: "https://www.facebook.com/studiobizarantwerp",
    confirmed: true,
  },
  {
    icon: "social-3",
    settingKey: "social_pinterest",
    label: "Pinterest",
    href: "https://www.pinterest.com/studiobizarantwerp",
    confirmed: true,
  },
  { icon: "social-4", label: "LinkedIn", href: null, confirmed: false, settingKey: "social_linkedin" },
  { icon: "social-5", label: "Social channel", href: null, confirmed: false, settingKey: "social_five" },
  { icon: "social-6", label: "Social channel", href: null, confirmed: false, settingKey: "social_six" },
];

/**
 * The six marks with their destinations resolved against the panel's settings.
 *
 * An operator's value wins; a blank one falls back to the literal above; a slot
 * with neither renders dimmed rather than guessing a destination, which is what
 * the footer has always done with an unconfirmed channel.
 */
export function resolveSocialLinks(
  social: Record<string, string | null | undefined>,
): SocialLink[] {
  return SOCIAL_LINKS.map((link) => {
    const configured = social[link.settingKey]?.trim();
    return configured ? { ...link, href: configured } : link;
  });
}
