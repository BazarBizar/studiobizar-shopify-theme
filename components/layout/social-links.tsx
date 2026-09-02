import { SOCIAL_LINKS } from "@/lib/social";

/**
 * 2×3 grid of 27px circular marks, as measured in the footer. Unconfirmed
 * channels render without a link rather than guessing a destination.
 */
export function SocialLinks() {
  return (
    <ul className="grid grid-cols-2 gap-x-[0.45rem] gap-y-[0.45rem]">
      {SOCIAL_LINKS.map((social) => {
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
            {social.href ? (
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="block transition-opacity hover:opacity-70"
              >
                {mark}
              </a>
            ) : (
              <span className="block opacity-45">{mark}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
