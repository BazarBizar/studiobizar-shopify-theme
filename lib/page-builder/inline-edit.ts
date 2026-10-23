/**
 * EDITING TEXT IN THE PREVIEW. A double-click on a line of text in the preview asks
 * the editor which setting that text IS; when one matches, the line becomes editable
 * in place and every keystroke goes to that setting.
 *
 * The match is by value: the text on screen against the section's plain-text
 * settings — headings, labels, a textarea, a button's label, a caption, and the same
 * inside its blocks (slides, columns, questions). Rich text is not offered here (its
 * formatting lives in the editor's own toolbar), nor is anything the section draws
 * from elsewhere (an FAQ entry, a product). No match: nothing becomes editable, and
 * the section is simply selected as before.
 *
 * Pure: the editor and the checks import it.
 */

export type TextPath = readonly (string | number)[];

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** Where `text` lives in a section's settings, or null. Rich text (JSON) never matches. */
export function findTextPath(settings: Record<string, unknown>, text: string): TextPath | null {
  const wanted = normalize(text);
  if (!wanted) return null;

  const walk = (value: unknown, path: (string | number)[]): TextPath | null => {
    if (typeof value === "string") {
      return !value.startsWith("{") && normalize(value) === wanted ? path : null;
    }
    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) {
        const found = walk(item, [...path, index]);
        if (found) return found;
      }
      return null;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      // A block: only its settings. A link: only its label, never its address.
      if ("settings" in record && "type" in record) return walk(record.settings, [...path, "settings"]);
      if ("href" in record && "label" in record) return walk(record.label, [...path, "label"]);
      // A captioned image: only the caption.
      if ("image" in record && "caption" in record) return walk(record.caption, [...path, "caption"]);
      for (const [key, child] of Object.entries(record)) {
        if (key === "design" || key === "id" || key === "type") continue;
        const found = walk(child, [...path, key]);
        if (found) return found;
      }
    }
    return null;
  };

  return walk(settings, []);
}

/** A copy of `value` with `text` at `path` — deep, so the old settings are untouched (undo keeps them). */
export function withText<T>(value: T, path: TextPath, text: string): T {
  const [head, ...rest] = path;
  if (head === undefined) return text as T;
  if (Array.isArray(value)) {
    const copy = [...value];
    copy[head as number] = withText(copy[head as number], rest, text);
    return copy as T;
  }
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return { ...record, [head]: withText(record[head as string], rest, text) } as T;
}
