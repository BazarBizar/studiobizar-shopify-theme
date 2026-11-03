import type { Metadata } from "next";

import { InquiryReview } from "@/components/inquiry/inquiry-review";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { getSiteTexts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Your inquiry",
  robots: { index: false, follow: false },
};

export default async function InquiryPage() {
  const texts = await getSiteTexts();
  return (
    <PageShell surface="light">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">{texts["inquiry.title"]}</h1>
        <p className="text-body mt-4 max-w-[40rem] text-muted">{texts["inquiry.intro"]}</p>

        <InquiryReview />
      </Container>
    </PageShell>
  );
}
