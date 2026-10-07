import { cn } from "@/lib/utils/cn";

const HEIGHT = {
  xs: "h-section-xs",
  sm: "h-section-sm",
  md: "h-section-md",
  lg: "h-section-lg",
  xl: "h-section-xl",
} as const;

/** Space between two bands, from the section rhythm scale, with an optional hairline. */
export function Spacer({ height, line }: { height: keyof typeof HEIGHT; line: "none" | "contained" | "full" }) {
  return (
    <div aria-hidden className={cn("flex items-center", HEIGHT[height], line === "contained" && "sb-container")}>
      {line !== "none" && <hr className="border-border w-full border-t" />}
    </div>
  );
}
