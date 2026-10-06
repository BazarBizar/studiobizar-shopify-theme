import { Container } from "@/components/ui/container";

/**
 * A page's one visible `h1` with an optional intro under it — the opening of Our
 * Story, the legal pages and FAQ, as a band of its own.
 */
export function PageHeading({ title, html }: { title: string; html?: string }) {
  return (
    <Container className="pt-12 pb-section">
      <h1 className="text-h1">{title}</h1>
      {html && (
        <div className="sb-prose mt-10 max-w-[44rem]" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </Container>
  );
}
