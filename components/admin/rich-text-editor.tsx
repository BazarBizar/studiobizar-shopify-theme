"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { LinkIcon, ListIcon, ListOrderedIcon } from "lucide-react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback } from "react";

import { Button } from "@/components/admin/ui/button";
import { Separator } from "@/components/admin/ui/separator";
import { proseMirrorToShopify, shopifyToProseMirror } from "@/lib/admin/rich-text";

/**
 * Editor for `rich_text_field`. Reads and writes Shopify's rich text AST, not HTML.
 *
 * THE DISABLED EXTENSIONS BELOW ARE NOT A STYLE CHOICE. The storefront renderer
 * (`lib/shopify/transforms.ts`) has a `default` case that returns a node's children
 * with no wrapper, so any node it does not recognise is silently flattened on the
 * public site while still looking correct in this editor. Offering a blockquote
 * button would be offering formatting that disappears on save — from the operator's
 * point of view, a bug with no error message.
 *
 * If you add one back here, teach `lib/shopify/transforms.ts` and
 * `lib/admin/rich-text.ts` about it in the same change.
 */

type Props = {
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export function RichTextEditor({ value, onChange, disabled, ariaLabel }: Props) {
  const editor = useEditor({
    editable: !disabled,
    // Required with React SSR: rendering the editor during the server pass gives a
    // different tree than the client produces, which React reports as a hydration
    // mismatch.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Supported by the storefront renderer.
        heading: { levels: [2, 3, 4] },
        bold: {},
        italic: {},
        bulletList: {},
        orderedList: {},
        listItem: {},
        link: { openOnClick: false },

        // NOT supported — see the note above.
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        // Shopify's AST has no hard-break node, so a shift+enter would vanish.
        hardBreak: false,
        // Inserts a trailing paragraph node for click convenience; harmless, but it
        // makes an "empty" document look non-empty to a required-field check.
        trailingNode: false,
      }),
    ],
    content: shopifyToProseMirror(value),
    onUpdate: ({ editor: instance }) => onChange(proseMirrorToShopify(instance.getJSON())),
    editorProps: {
      attributes: {
        class: "sb-admin-prose min-h-32 px-3 py-2 outline-none",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      },
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;

    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", previous ?? "https://");

    // Cancel leaves the document alone; an empty string is a deliberate "unlink".
    if (href === null) return;
    if (href === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }, [editor]);

  if (!editor) {
    // One render pass before the editor mounts. A box of the right height keeps the
    // form from jumping.
    return <div className="min-h-32 rounded-md border" aria-busy="true" />;
  }

  const variant = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs) ? ("secondary" as const) : ("ghost" as const);

  return (
    <div className="bg-background rounded-md border">
      {!disabled ? (
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
        >
          <Button
            type="button"
            size="sm"
            variant={variant("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-pressed={editor.isActive("bold")}
            aria-label="Bold"
          >
            <strong>B</strong>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={variant("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-pressed={editor.isActive("italic")}
            aria-label="Italic"
          >
            <em>I</em>
          </Button>

          <Separator orientation="vertical" className="mx-1 h-4" />

          {[2, 3, 4].map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={variant("heading", { level })}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: level as 2 | 3 | 4 })
                  .run()
              }
              aria-pressed={editor.isActive("heading", { level })}
            >
              H{level}
            </Button>
          ))}

          <Separator orientation="vertical" className="mx-1 h-4" />

          <Button
            type="button"
            size="sm"
            variant={variant("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-pressed={editor.isActive("bulletList")}
            aria-label="Bulleted list"
          >
            <ListIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={variant("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-pressed={editor.isActive("orderedList")}
            aria-label="Numbered list"
          >
            <ListOrderedIcon className="size-3.5" />
          </Button>

          <Separator orientation="vertical" className="mx-1 h-4" />

          <Button
            type="button"
            size="sm"
            variant={variant("link")}
            onClick={setLink}
            aria-label="Link"
          >
            <LinkIcon className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <EditorContent editor={editor} />
    </div>
  );
}
