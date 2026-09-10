import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Inquiry sent",
  robots: { index: false, follow: false },
};

export default async function InquirySuccessPage({
  searchParams,
}: PageProps<"/inquiry/success">) {
  const { id } = await searchParams;
  const inquiryId = typeof id === "string" ? id : null;

  return (
    <PageShell surface="light">
      <Container className="py-section">
        <div className="max-w-[40rem]">
          <h1 className="text-h1">Thank you — your inquiry is with us</h1>

          {inquiryId && (
            <p className="text-body mt-6">
              Your reference is{" "}
              <strong className="text-sku font-medium tabular-nums">{inquiryId}</strong>. Keep it to
              hand if you get in touch about this request.
            </p>
          )}

          <p className="text-body mt-4 text-muted">
            We’ll come back to you by email, usually within two working days.
          </p>

          <div className="mt-10 flex flex-wrap gap-8">
            <Link href="/shop" className="text-button sb-underline">
              Back to products
            </Link>
            <Link href="/contact" className="text-button sb-underline">
              Contact us
            </Link>
          </div>
        </div>
      </Container>
    </PageShell>
  );
}
