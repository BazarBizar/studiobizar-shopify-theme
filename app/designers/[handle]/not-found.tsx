
import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function DesignerNotFound() {
  return (
    <PageShell surface="mocha">
      <Container className="py-section">
        <h1 className="text-h1">We couldn’t find that designer</h1>
        <p className="text-body mt-4 max-w-[36rem] text-muted">
          They may have been renamed, or the entry is not published yet.
        </p>
        <ButtonLink href="/designers" variant="solid" className="mt-8">
          See all designers
        </ButtonLink>
      </Container>
    </PageShell>
  );
}
