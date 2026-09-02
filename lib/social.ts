/**
 * The six social marks in the footer, extracted as SVG from the Figma PDF
 * (`public/brand/social/`) because lucide v1 ships no brand icons.
 *
 * ⚠ The icon → platform mapping below is INFERRED from each glyph's geometry,
 * not from anything written in the design. Only the three channels the Contact
 * page actually names — Instagram, Facebook and Pinterest, all
 * @studiobizarantwerp — have confirmed handles. Confirm `label` and `href`
 * before launch; correcting them is a one-line change per entry.
 */

export type SocialLink = {
  /** File in `public/brand/social/`. */
  icon: string;
  label: string;
  href: string | null;
  confirmed: boolean;
};

export const SOCIAL_LINKS: SocialLink[] = [
  {
    icon: "social-1",
    label: "Instagram",
    href: "https://www.instagram.com/studiobizarantwerp",
    confirmed: true,
  },
  {
    icon: "social-2",
    label: "Facebook",
    href: "https://www.facebook.com/studiobizarantwerp",
    confirmed: true,
  },
  {
    icon: "social-3",
    label: "Pinterest",
    href: "https://www.pinterest.com/studiobizarantwerp",
    confirmed: true,
  },
  { icon: "social-4", label: "LinkedIn", href: null, confirmed: false },
  { icon: "social-5", label: "Social channel", href: null, confirmed: false },
  { icon: "social-6", label: "Social channel", href: null, confirmed: false },
];
