import type { Metadata } from "next";

import { InquiryReview } from "@/components/inquiry/inquiry-review";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Your inquiry",
  robots: { index: false, follow: false },
};

export default function InquiryPage() {
  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">Your inquiry</h1>
        <p className="text-body mt-4 max-w-[40rem] text-muted">
          Check the pieces below, then send them to us in one request. Nothing is ordered or charged
          here — we’ll reply with availability, lead times and pricing.
        </p>

        <InquiryReview />
      </Container>
    </PageShell>
  );
}
