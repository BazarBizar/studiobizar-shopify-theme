import { NewsletterForm } from "@/components/layout/newsletter-form";
import { cn } from "@/lib/utils/cn";

/** The footer's sign-up, given a band of its own with a heading and an invitation. */
export function NewsletterBand({
  id,
  title,
  body,
  align,
  style,
}: {
  id: string;
  title: string;
  body: string;
  align: "left" | "center";
  style: "plain" | "panel";
}) {
  return (
    <div className="sb-container py-section">
      <div
        className={cn(
          "flex flex-col",
          align === "center" ? "mx-auto items-center text-center" : "items-start",
          style === "panel" ? "bg-foreground/[0.04] max-w-[60rem] p-10 sm:p-16" : "max-w-[46rem]",
        )}
      >
        {title.trim() && <h2 className="text-h2">{title}</h2>}
        {body.trim() && <p className="text-body text-muted mt-4 max-w-[38rem] whitespace-pre-line">{body}</p>}
        <NewsletterForm inputId={`newsletter-${id}`} className="mt-8 w-full max-w-[26.25rem] text-left" />
      </div>
    </div>
  );
}
