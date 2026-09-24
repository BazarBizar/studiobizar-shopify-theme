import { SOCIAL_LINKS, type SocialLink } from "@/lib/social";

/**
 * 2×3 grid of 27px circular marks, as measured in the footer. A channel with no
 * destination is left out rather than shown dimmed — a greyed mark that does
 * nothing reads as broken, not as "coming soon".
 *
 * `links` comes in already resolved against the panel's site settings — see
 * `resolveSocialLinks`. It falls back to the module constant so a caller that
 * has no settings to hand still renders the marks.
 */
export function SocialLinks({ links = SOCIAL_LINKS }: { links?: SocialLink[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-[0.45rem] gap-y-[0.45rem]">
      {links
        .filter((social) => social.href)
        .map((social) => {
          const mark = (
            <span
              aria-hidden
              className="block size-[1.7rem] bg-current"
              style={{
                maskImage: `url(/brand/social/${social.icon}.svg)`,
                WebkitMaskImage: `url(/brand/social/${social.icon}.svg)`,
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskSize: "contain",
                WebkitMaskSize: "contain",
              }}
            />
          );

          return (
            <li key={social.icon}>
              <a
                href={social.href ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="block transition-opacity hover:opacity-70"
              >
                {mark}
              </a>
            </li>
          );
        })}
    </ul>
  );
}
