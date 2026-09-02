/**
 * Native `<details>`, so the five Shop Detail panels open without JavaScript and
 * are keyboard- and screen-reader-correct for free.
 */
export function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-border">
      <summary className="text-h4 flex cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
        {title}
        <span
          aria-hidden
          className="relative ml-4 block size-3 shrink-0 before:absolute before:top-1/2 before:left-0 before:h-px before:w-3 before:-translate-y-1/2 before:bg-current after:absolute after:top-0 after:left-1/2 after:h-3 after:w-px after:-translate-x-1/2 after:bg-current after:transition-opacity group-open:after:opacity-0"
        />
      </summary>
      <div className="sb-prose pb-6">{children}</div>
    </details>
  );
}
