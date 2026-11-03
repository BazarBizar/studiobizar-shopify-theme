import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { getSiteTexts } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Inquiry sent",
  robots: { index: false, follow: false },
};

export default async function InquirySuccessPage({
  searchParams,
}: PageProps<"/inquiry/success">) {
  const { id } = await searchParams;
  const inquiryId = typeof id === "string" ? id : null;
  const texts = await getSiteTexts();
  // The reference is set in bold inside its sentence, wherever the sentence puts it.
  const [beforeReference, afterReference] = texts["inquirySent.reference"].split("{reference}");

  return (
    <PageShell surface="light">
      <Container className="py-section">
        <div className="max-w-[40rem]">
          <h1 className="text-h1">{texts["inquirySent.title"]}</h1>

          {inquiryId && (
            <p className="text-body mt-6">
              {beforeReference}
              {afterReference !== undefined && (
                <strong className="text-sku font-medium tabular-nums">{inquiryId}</strong>
              )}
              {afterReference}
            </p>
          )}

          <p className="text-body mt-4 text-muted">{texts["inquirySent.reply"]}</p>

          <div className="mt-10 flex flex-wrap gap-8">
            <Link href="/shop" className="text-button sb-underline">
              {texts["inquirySent.back"]}
            </Link>
            <Link href="/contact" className="text-button sb-underline">
              {texts["inquirySent.contact"]}
            </Link>
          </div>
        </div>
      </Container>
    </PageShell>
  );
}
