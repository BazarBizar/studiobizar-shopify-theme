import { cn } from "@/lib/utils/cn";

/**
 * The 1728px canvas with its 20px gutter, as measured off the Figma frames.
 */
export function Container({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "header" | "footer" | "nav" | "main";
}) {
  return <Tag className={cn("sb-container", className)}>{children}</Tag>;
}
