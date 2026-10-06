import { arrayMove } from "@dnd-kit/sortable";

import { MAX_SECTIONS, type DocumentContent, type PageSettings, type SectionInstance } from "@/lib/page-builder/document";

/**
 * Every change the builder can make to a document, as a pure function of the
 * previous one. Pure so that undo/redo later is a stack of states and nothing
 * else — no change here mutates what it was given.
 *
 * New sections (added, duplicated, restored by Undo) are built by the CALLER and
 * arrive whole in `insert`. Minting an id in here would make the reducer impure —
 * React runs reducers twice in development — and the caller needs that id anyway,
 * to select the section it just made.
 */

export type BuilderAction =
  | { kind: "insert"; section: SectionInstance; index: number }
  | { kind: "remove"; id: string }
  | { kind: "move"; from: number; to: number }
  | { kind: "toggle"; id: string }
  | { kind: "setting"; id: string; key: string; value: unknown }
  | { kind: "page"; key: keyof PageSettings; value: string }
  | { kind: "replace"; content: DocumentContent };

export function builderReducer(state: DocumentContent, action: BuilderAction): DocumentContent {
  const sections = state.sections;

  switch (action.kind) {
    case "insert": {
      if (sections.length >= MAX_SECTIONS || sections.some((section) => section.id === action.section.id)) {
        return state;
      }
      const next = [...sections];
      next.splice(Math.max(0, Math.min(action.index, next.length)), 0, action.section);
      return { ...state, sections: next };
    }

    case "remove":
      return { ...state, sections: sections.filter((section) => section.id !== action.id) };

    case "move": {
      if (action.from === action.to || action.to < 0 || action.to >= sections.length) return state;
      return { ...state, sections: arrayMove(sections, action.from, action.to) };
    }

    case "toggle":
      return {
        ...state,
        sections: sections.map((section) =>
          section.id === action.id ? { ...section, visible: !section.visible } : section,
        ),
      };

    case "setting":
      return {
        ...state,
        sections: sections.map((section) =>
          section.id === action.id
            ? ({ ...section, settings: { ...section.settings, [action.key]: action.value } } as SectionInstance)
            : section,
        ),
      };

    case "page":
      return { ...state, page: { ...state.page, [action.key]: action.value } };

    case "replace":
      return action.content;
  }
}

/** The index a newly added section goes to: after the selected one, or at the end. */
export function insertionIndex(state: DocumentContent, selectedId: string | null): number {
  const index = selectedId ? state.sections.findIndex((section) => section.id === selectedId) : -1;
  return index >= 0 ? index + 1 : state.sections.length;
}
