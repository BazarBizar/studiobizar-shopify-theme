import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export type IntroProps = {
  title: string;
  html?: string;
  href?: string;
  label?: string;
  /** Outlined on the landing page; Our Services' "Beyond The Project" is filled. */
  variant?: ButtonVariant;
  /**
   * `plain` sets the copy as one running paragraph at `text-body` — "Beyond The
   * Project" — instead of `sb-prose`, whose 1.55 line height is for longer text.
   */
  plain?: boolean;
};

/**
 * A single `<p>…</p>` from the rich text renderer, unwrapped — so `plain` copy is
 * the one paragraph it reads as, not a paragraph inside a div.
 */
function singleParagraph(html: string): string | null {
  const match = /^<p>([\s\S]*)<\/p>$/.exec(html);
  return match && !match[1]!.includes("<p") ? match[1]! : null;
}

/**
 * Heading + copy + a text link — "Our Services", "Our Story" and "Selected
 * Project" on the landing page, and the Text section of the page builder.
 *
 * `IntroBody` is the bare block, for when it already sits inside a Container —
 * nesting one Container in another doubles the gutter and pushes the copy out of
 * line with the rest of the page.
 */
export function IntroBody({ title, html, href, label, variant = "outline", plain = false }: IntroProps) {
  const paragraph = plain && html ? singleParagraph(html) : null;

  return (
    <>
      <h2 className="text-h2">{title}</h2>
      {html &&
        (paragraph !== null ? (
          <p className="text-body mt-6 max-w-[44rem]" dangerouslySetInnerHTML={{ __html: paragraph }} />
        ) : (
          <div
            className={plain ? "text-body mt-6 max-w-[44rem]" : "sb-prose mt-6 max-w-[44rem]"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ))}
      {href && label && (
        <ButtonLink href={href} className="mt-8" variant={variant}>
          {label}
        </ButtonLink>
      )}
    </>
  );
}

/**
 * The same block on its own band, as Our Services and Our Story use it.
 *
 * `flush` drops the band's top padding, for a block that follows a band which
 * already ends in one — the second "Our Story" block, "Beyond The Project".
 */
export function IntroBlock({ flush = false, ...props }: IntroProps & { flush?: boolean }) {
  return (
    <Container className={flush ? "pb-section" : "py-section"}>
      <IntroBody {...props} />
    </Container>
  );
}
