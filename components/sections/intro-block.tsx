import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export type IntroProps = {
  title: string;
  html?: string;
  href?: string;
  label?: string;
  /** Outlined on the landing page; Our Services' "Beyond The Project" is filled. */
  variant?: ButtonVariant;
};

/**
 * Heading + copy + a text link — "Our Services", "Our Story" and "Selected
 * Project" on the landing page, and the Text section of the page builder.
 *
 * `IntroBody` is the bare block, for when it already sits inside a Container —
 * nesting one Container in another doubles the gutter and pushes the copy out of
 * line with the rest of the page.
 */
export function IntroBody({ title, html, href, label, variant = "outline" }: IntroProps) {
  return (
    <>
      <h2 className="text-h2">{title}</h2>
      {html && (
        <div
          className="sb-prose mt-6 max-w-[44rem]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      {href && label && (
        <ButtonLink href={href} className="mt-8" variant={variant}>
          {label}
        </ButtonLink>
      )}
    </>
  );
}

/** The same block on its own band, as Our Services and Our Story use it. */
export function IntroBlock(props: IntroProps) {
  return (
    <Container className="py-section">
      <IntroBody {...props} />
    </Container>
  );
}
