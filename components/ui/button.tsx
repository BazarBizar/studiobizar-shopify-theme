import Link from "next/link";

import { cn } from "@/lib/utils/cn";

/**
 * The one call-to-action control, in three weights.
 *
 * `solid` is the button measured on the landing page — **251 × 33, filled**,
 * with a 14px label centred in it. It is painted with `bg-primary` /
 * `text-primary-foreground`, so it inverts with the surface on its own: earth
 * on a dark ground, dark wood on an earth one.
 *
 * `outline` is the taller bordered control used where a form is being
 * submitted (`enquire`, `Send inquiry`) — 48px, so it pairs with an input.
 *
 * `text` is the inline underlined link (`learn more`, `go back`).
 */

export type ButtonVariant = "solid" | "outline" | "text";

// 212 × 26 on the 393px frames, 251 × 33 on the desktop ones.
const base =
  "h-[1.625rem] min-w-[13.25rem] sm:h-[2rem] sm:min-w-[16rem] text-button uppercase inline-flex items-center font-medium justify-center transition-colors";

const VARIANTS: Record<ButtonVariant, string> = {
  // 251 × 33 measured; min-width so a longer label still fits.
  solid: cn(
    base,
    " gap-2 px-6 ",
    "bg-primary text-primary-foreground hover:opacity-85",
    "disabled:cursor-not-allowed disabled:opacity-40",
  ),
  outline: cn(
    base,
    " gap-2 border border-foreground px-8",
    "hover:bg-foreground hover:text-background",
    "disabled:cursor-not-allowed disabled:opacity-40",
  ),
  text: cn(
    base,
    "sb-underline gap-2",
    "disabled:cursor-not-allowed disabled:opacity-40",
  ),
};

type Common = {
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "solid",
  className,
  children,
  ...props
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(VARIANTS[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "solid",
  className,
  children,
  href,
  external,
  ...props
}: Common & {
  href: string;
  /** Renders a plain anchor with the right rel, for an off-site destination. */
  external?: boolean;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const classes = cn(VARIANTS[variant], className);

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
