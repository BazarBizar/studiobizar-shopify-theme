import { Container } from "@/components/ui/container";

/**
 * A page's one visible `h1` and what opens the page under it, as a band of its own.
 *
 *  - `standard` — heading, then an intro in running copy: Our Story, Careers,
 *    Our Locations. `compact` sets the intro 2rem under the heading rather than
 *    2.5rem, as Our Services has it.
 *  - `summary` — heading and a one-line summary in a narrower header: Our
 *    Designers, Gallery, Collections.
 *  - `lead` — heading and an intro set at heading size in a narrow measure:
 *    Contact.
 *
 * `children` is content that shares the band — the FAQ under its heading, the
 * designer grid under its summary — rather than starting a band of its own.
 */
export function PageHeading({
  title,
  html,
  compact = false,
  variant = "standard",
  summary,
  children,
}: {
  title: string;
  html?: string;
  compact?: boolean;
  variant?: "standard" | "summary" | "lead";
  summary?: string;
  children?: React.ReactNode;
}) {
  return (
    <Container className="pt-12 pb-section">
      {variant === "summary" ? (
        <header className="max-w-[46rem]">
          <h1 className="text-h1">{title}</h1>
          {summary && <p className="text-body mt-6">{summary}</p>}
        </header>
      ) : (
        <>
          <h1 className="text-h1">{title}</h1>
          {html && (
            <div
              className={
                variant === "lead"
                  ? "sb-prose mt-6 max-w-[36rem] text-h2"
                  : compact
                    ? "sb-prose mt-8 max-w-[44rem]"
                    : "sb-prose mt-10 max-w-[44rem]"
              }
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </>
      )}
      {children}
    </Container>
  );
}
