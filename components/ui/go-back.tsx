"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * The "go back" control that closes most detail pages.
 *
 * Always a real link, so it works without JavaScript and the server and client
 * render the same markup. When there *is* history — the visitor came from a
 * filtered listing — the click is intercepted and `router.back()` returns them
 * to it with their filters intact, instead of dumping them on a bare index.
 */
export function GoBack({
  fallbackHref = "/",
  label = "go back",
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <Link
      href={fallbackHref}
      onClick={(event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className="text-secondary inline-flex items-center gap-3 transition-opacity hover:opacity-70"
    >
      <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
      {label}
    </Link>
  );
}
