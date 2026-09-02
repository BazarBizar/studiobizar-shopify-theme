import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";

export default function ProductNotFound() {
  return (
    <PageShell surface="light">
      <Container className="py-section">
        <h1 className="text-h1">We couldn’t find that piece</h1>
        <p className="text-body mt-4 max-w-[36rem] text-muted">
          It may have been renamed or withdrawn from the catalogue.
        </p>
        <Link href="/shop" className="text-button sb-underline mt-8 inline-block">
          Browse all products
        </Link>
      </Container>
    </PageShell>
  );
}
