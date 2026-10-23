import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's own scale. Told nothing, it reads the
 * design system's type sizes (`text-button`, `text-body`, … — `--text-*` in
 * globals.css) as COLOURS, so `cn("text-button", "text-primary-foreground")`
 * dropped the size and kept the colour: the filled button lost its 14px label
 * and grew to whatever size surrounded it. Naming the sizes keeps a size and a
 * colour side by side, while two sizes still merge as they should.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "h1",
        "h2",
        "h3",
        "h4",
        "body",
        "secondary",
        "tertiary",
        "caption",
        "button",
        "sku",
        "display",
        "display-lg",
        "micro",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
