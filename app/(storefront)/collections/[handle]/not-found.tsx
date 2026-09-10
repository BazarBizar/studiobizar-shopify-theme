
import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function CollectionNotFound() {
  return (
    <PageShell surface="light">
      <Container className="py-section">
        <h1 className="text-h1">We couldn’t find that collection</h1>
        <p className="text-body mt-4 max-w-[36rem] text-muted">
          It may have been renamed, or it is not published yet.
        </p>
        <ButtonLink href="/collections" variant="solid" className="mt-8">
          See all collections
        </ButtonLink>
      </Container>
    </PageShell>
  );
}
