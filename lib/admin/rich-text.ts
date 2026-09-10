/**
 * Shopify rich text AST <-> Tiptap (ProseMirror) JSON.
 *
 * THE STOREFRONT IS THE SPEC. `lib/shopify/transforms.ts` `renderNode()` is what a
 * customer actually sees, and its `default` case returns a node's children with no
 * wrapper — so any node type it does not know is silently flattened. A blockquote
 * or a code block saved from this editor would LOOK fine in the panel and quietly
 * lose its formatting on the site.
 *
 * That is why the editor in `components/admin/rich-text-editor.tsx` disables every
 * StarterKit node this converter cannot express, and why the two files have to be
 * changed together. The vocabulary is exactly:
 *
 *   root · paragraph · heading(level) · list(listType) · list-item · link(url,
 *   title, target) · text(value, bold, italic)
 *
 * No `server-only`: the editor is a Client Component and needs the same conversion
 * the server uses. There is nothing secret here.
 */

/* -------------------------------------------------------------------------- *
 * Types
 * -------------------------------------------------------------------------- */

export type ShopifyRichNode = {
  type: string;
  value?: string;
  level?: number;
  listType?: "unordered" | "ordered";
  url?: string;
  title?: string;
  target?: string;
  bold?: boolean;
  italic?: boolean;
  children?: ShopifyRichNode[];
};

type Mark = { type: string; attrs?: Record<string, unknown> };

export type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: Mark[];
};

export const EMPTY_DOC: ProseMirrorNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/* -------------------------------------------------------------------------- *
 * Shopify -> Tiptap
 * -------------------------------------------------------------------------- */

function inlineToProseMirror(node: ShopifyRichNode, inherited: Mark[] = []): ProseMirrorNode[] {
  if (node.type === "text") {
    const marks = [...inherited];
    if (node.bold) marks.push({ type: "bold" });
    if (node.italic) marks.push({ type: "italic" });

    // ProseMirror rejects an empty text node outright, so drop it rather than
    // hand the editor a document it will refuse to load.
    if (!node.value) return [];

    return [{ type: "text", text: node.value, ...(marks.length ? { marks } : {}) }];
  }

  if (node.type === "link") {
    const linkMark: Mark = {
      type: "link",
      attrs: {
        href: node.url ?? "",
        ...(node.title ? { title: node.title } : {}),
        ...(node.target ? { target: node.target } : {}),
      },
    };

    // Shopify nests text inside a link node; Tiptap models a link as a MARK on the
    // text, so the wrapper dissolves and its mark is pushed down.
    return (node.children ?? []).flatMap((child) =>
      inlineToProseMirror(child, [...inherited, linkMark]),
    );
  }

  return (node.children ?? []).flatMap((child) => inlineToProseMirror(child, inherited));
}

function blockToProseMirror(node: ShopifyRichNode): ProseMirrorNode[] {
  switch (node.type) {
    case "paragraph": {
      const content = (node.children ?? []).flatMap((child) => inlineToProseMirror(child));
      return [{ type: "paragraph", ...(content.length ? { content } : {}) }];
    }

    case "heading": {
      const level = Math.min(Math.max(node.level ?? 2, 1), 6);
      const content = (node.children ?? []).flatMap((child) => inlineToProseMirror(child));
      return [{ type: "heading", attrs: { level }, ...(content.length ? { content } : {}) }];
    }

    case "list": {
      const items = (node.children ?? [])
        .filter((child) => child.type === "list-item")
        .map((child) => {
          const inline = (child.children ?? []).flatMap((grandchild) =>
            inlineToProseMirror(grandchild),
          );

          // A Tiptap listItem must contain a block, not inline content; Shopify's
          // list-item holds inline content directly. Wrap it.
          return {
            type: "listItem",
            content: [{ type: "paragraph", ...(inline.length ? { content: inline } : {}) }],
          };
        });

      if (!items.length) return [];

      return [
        { type: node.listType === "ordered" ? "orderedList" : "bulletList", content: items },
      ];
    }

    default:
      return (node.children ?? []).flatMap(blockToProseMirror);
  }
}

/** Parses a stored `rich_text_field` value into a document Tiptap can load. */
export function shopifyToProseMirror(value: string | null | undefined): ProseMirrorNode {
  if (!value) return EMPTY_DOC;

  let root: unknown;
  try {
    root = JSON.parse(value);
  } catch {
    // Pre-existing entries may hold plain text — the storefront tolerates that
    // too (`richTextToHtml` wraps it in a <p>), so open it as one paragraph
    // instead of showing the operator an empty editor and losing their copy.
    return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] };
  }

  if (!root || typeof root !== "object") return EMPTY_DOC;

  const content = blockToProseMirror(root as ShopifyRichNode);
  return content.length ? { type: "doc", content } : EMPTY_DOC;
}

/* -------------------------------------------------------------------------- *
 * Tiptap -> Shopify
 * -------------------------------------------------------------------------- */

function inlineToShopify(node: ProseMirrorNode): ShopifyRichNode[] {
  if (node.type !== "text" || !node.text) return [];

  const marks = node.marks ?? [];
  const bold = marks.some((mark) => mark.type === "bold");
  const italic = marks.some((mark) => mark.type === "italic");
  const link = marks.find((mark) => mark.type === "link");

  const text: ShopifyRichNode = {
    type: "text",
    value: node.text,
    ...(bold ? { bold: true } : {}),
    ...(italic ? { italic: true } : {}),
  };

  if (!link) return [text];

  const attrs = (link.attrs ?? {}) as { href?: string; title?: string; target?: string };

  return [
    {
      type: "link",
      url: attrs.href ?? "",
      ...(attrs.title ? { title: attrs.title } : {}),
      ...(attrs.target ? { target: attrs.target } : {}),
      children: [text],
    },
  ];
}

function blockToShopify(node: ProseMirrorNode): ShopifyRichNode[] {
  const inline = () => (node.content ?? []).flatMap(inlineToShopify);

  switch (node.type) {
    case "paragraph":
      return [{ type: "paragraph", children: inline() }];

    case "heading":
      return [
        {
          type: "heading",
          level: Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 6),
          children: inline(),
        },
      ];

    case "bulletList":
    case "orderedList":
      return [
        {
          type: "list",
          listType: node.type === "orderedList" ? "ordered" : "unordered",
          children: (node.content ?? [])
            .filter((child) => child.type === "listItem")
            .map((child) => ({
              type: "list-item",
              // Unwrap the paragraph Tiptap requires inside a list item: Shopify's
              // list-item takes inline content directly, and leaving the paragraph
              // in makes the storefront render a block inside an <li>.
              children: (child.content ?? []).flatMap((grandchild) =>
                grandchild.type === "paragraph"
                  ? (grandchild.content ?? []).flatMap(inlineToShopify)
                  : blockToShopify(grandchild).flatMap((block) => block.children ?? []),
              ),
            })),
        },
      ];

    default:
      // Anything else is flattened to its inline content rather than dropped
      // wholesale, so an operator loses the wrapper but never the words.
      return (node.content ?? []).flatMap(blockToShopify);
  }
}

/**
 * Serialises for storage. Returns "" for a document with no text, so a cleared
 * editor clears the field instead of storing an empty AST that Shopify would count
 * as present — which matters for a `required` field.
 */
export function proseMirrorToShopify(doc: ProseMirrorNode | null | undefined): string {
  if (!doc) return "";

  const children = (doc.content ?? []).flatMap(blockToShopify);
  const hasText = JSON.stringify(children).includes('"type":"text"');
  if (!hasText) return "";

  return JSON.stringify({ type: "root", children });
}
