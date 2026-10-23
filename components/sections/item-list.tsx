import { Container } from "@/components/ui/container";

export type ListItem = { key: string; title: string; html: string };

/**
 * "Our Services": a heading, then named items with a short text each, in two
 * columns on desktop (x=20 and x=874 in the design).
 */
export function ItemList({ title, items }: { title?: string; items: ListItem[] }) {
  if (items.length === 0) return null;

  return (
    <Container className="pb-section">
      {title && <h2 className="text-h2 mb-10">{title}</h2>}
      {/* Two columns in the design, at x=20 and x=874. */}
      <ul className="grid gap-x-16 gap-y-10 lg:grid-cols-2">
        {items.map((item) => (
          <li key={item.key}>
            <h3 className="text-h3">{item.title}</h3>
            {item.html && (
              <div
                className="sb-prose mt-2 max-w-[30rem] text-muted"
                dangerouslySetInnerHTML={{ __html: item.html }}
              />
            )}
          </li>
        ))}
      </ul>
    </Container>
  );
}
