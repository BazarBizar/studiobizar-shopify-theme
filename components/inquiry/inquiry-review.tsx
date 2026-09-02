"use client";

import Link from "next/link";

import { InquiryForm } from "@/components/inquiry/inquiry-form";
import { InquiryList } from "@/components/inquiry/inquiry-list";
import { useInquiryCart } from "@/store/inquiry-cart";

/**
 * The list and the form only make sense together — the form is hidden while
 * the inquiry is empty, so there is never a Send button with nothing to send.
 */
export function InquiryReview() {
  const items = useInquiryCart((state) => state.items);
  const hydrated = useInquiryCart((state) => state.hydrated);

  return (
    <div className="mt-12 grid gap-16 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
      <div>
        <InquiryList />
      </div>

      {hydrated && items.length > 0 ? (
        <div>
          <h2 className="text-h2">Your details</h2>
          <p className="text-secondary mt-2 text-muted">
            So we know who to reply to. Fields marked * are required.
          </p>
          <div className="mt-8">
            <InquiryForm />
          </div>
        </div>
      ) : (
        <div className="hidden lg:block">
          <p className="text-secondary text-muted">
            Add a piece from the{" "}
            <Link href="/shop" className="sb-underline">
              catalogue
            </Link>{" "}
            and the form appears here.
          </p>
        </div>
      )}
    </div>
  );
}
