import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";

/**
 * Placeholder. The Landing page — hero slider, Our Services, Selected
 * Projects, Signature Collections, New In, Monthly Selection, Our Story,
 * Instagram — is Step 12, once the sections it reuses exist.
 *
 * Landing sits on dark wood in the design, hence the surface.
 */
export default function HomePage() {
  return (
    <PageShell surface="dark">
      <Container className="py-section">
        <h1 className="text-h1">Studio Bizar</h1>
        <p className="text-body mt-4 max-w-[40rem] text-muted">
          Designed for life, inspired by the world.
        </p>
      </Container>
    </PageShell>
  );
}
