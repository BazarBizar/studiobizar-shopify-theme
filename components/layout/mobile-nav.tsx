"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/layout/logo";
import type { MenuLink } from "@/lib/shopify/types";

export function MobileNav({
  primary,
  secondary,
}: {
  primary: MenuLink[];
  secondary: MenuLink[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="lg:hidden"
      >
        <Menu className="size-[1.35rem]" strokeWidth={1.5} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-foreground/40"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col bg-background text-foreground"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between px-gutter py-5">
                <Logo className="h-5 w-[11.47rem]" />
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                  <X className="size-[1.35rem]" strokeWidth={1.5} aria-hidden />
                </button>
              </div>

              <nav aria-label="Primary" className="px-gutter pt-6">
                <ul className="flex flex-col gap-5">
                  {primary.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} onClick={() => setOpen(false)} className="text-h3">
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <nav aria-label="Secondary" className="mt-auto px-gutter pb-10">
                <ul className="flex flex-col gap-3 border-t border-border pt-6">
                  {secondary.map((item) => (
                    <li key={item.id}>
                      <Link href={item.href} onClick={() => setOpen(false)} className="text-secondary opacity-80">
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
