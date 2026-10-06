import { ButtonLink, type ButtonVariant } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/cn";

/**
 * A band of copy assembled from blocks — headings, paragraphs and buttons in any
 * order — inside one measure. The Next counterpart of the theme's `sb-rich-text`
 * section, with the same settings: `width`, `align`, and per block a `scale` for
 * copy and a style for buttons.
 *
 * Every block is drawn with the type scale and button weights that already
 * exist. There is no size, colour or spacing an editor can set beyond these.
 *
 * Consecutive buttons sit on one row, as a primary and secondary action do.
 */

export type RichContentBlock =
  | { id: string; kind: "heading"; text: string; level: "h2" | "h3" }
  | { id: string; kind: "text"; html: string; scale: "body" | "lead" }
  | { id: string; kind: "button"; href: string; label: string; variant: ButtonVariant; external: boolean };

const WIDTH = {
  narrow: "max-w-[38rem]",
  medium: "max-w-[44rem]",
  full: "",
} as const;

type Group = { id: string; buttons: Extract<RichContentBlock, { kind: "button" }>[] } | RichContentBlock;

function group(blocks: RichContentBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    const last = groups.at(-1);
    if (block.kind === "button" && last && "buttons" in last) last.buttons.push(block);
    else if (block.kind === "button") groups.push({ id: block.id, buttons: [block] });
    else groups.push(block);
  }
  return groups;
}

export function RichContent({
  blocks,
  width = "medium",
  align = "left",
}: {
  blocks: RichContentBlock[];
  width?: keyof typeof WIDTH;
  align?: "left" | "center";
}) {
  if (blocks.length === 0) return null;
  const centred = align === "center";

  return (
    <Container className="py-section">
      <div className={cn(WIDTH[width], centred && "mx-auto text-center")}>
        {group(blocks).map((item, index) => {
          // The first block sits flush; each later one keeps the rhythm the
          // hand-built bands use — copy 1.5rem under what precedes it, a
          // button row 2rem.
          const gap = index === 0 ? "" : "buttons" in item ? "mt-8" : "mt-6";

          if ("buttons" in item) {
            return (
              <div key={item.id} className={cn("flex flex-wrap gap-4", centred && "justify-center", gap)}>
                {item.buttons.map((button) => (
                  <ButtonLink key={button.id} href={button.href} variant={button.variant} external={button.external}>
                    {button.label}
                  </ButtonLink>
                ))}
              </div>
            );
          }

          if (item.kind === "heading") {
            const Heading = item.level;
            return (
              <Heading key={item.id} className={cn(item.level === "h2" ? "text-h2" : "text-h3", gap)}>
                {item.text}
              </Heading>
            );
          }

          if (item.kind === "text") {
            return (
              <div
                key={item.id}
                className={cn(item.scale === "lead" ? "text-h2" : "sb-prose", gap)}
                dangerouslySetInnerHTML={{ __html: item.html }}
              />
            );
          }

          return null;
        })}
      </div>
    </Container>
  );
}
