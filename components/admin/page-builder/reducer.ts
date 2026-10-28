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
  /** The section with this id, replaced whole — "Turn into Custom section", and its Undo. */
  | { kind: "swap"; section: SectionInstance }
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

    case "swap":
      return {
        ...state,
        sections: sections.map((section) => (section.id === action.section.id ? action.section : section)),
      };

    case "replace":
      return action.content;
  }
}

/* -------------------------------------------------------------------------- *
 * Undo / redo
 * -------------------------------------------------------------------------- */

/**
 * The document with its past and future, for undo and redo.
 *
 * CONSECUTIVE EDITS TO ONE FIELD ARE ONE STEP. Typing a heading dispatches a
 * `setting` per keystroke; recording each would make Undo remove one letter at a
 * time. So a change to the same field as the change before it replaces the last
 * step instead of adding one — still pure, no clock involved. Moving to another
 * field, or any structural change, starts a new step.
 */
export type BuilderHistory = {
  past: DocumentContent[];
  present: DocumentContent;
  future: DocumentContent[];
  /** Identifies the field the last step edited, for coalescing. */
  lastField: string | null;
};

export type HistoryAction = BuilderAction | { kind: "undo" } | { kind: "redo" };

/** Enough for an afternoon's work; a bound so a long session cannot grow without limit. */
const HISTORY_LIMIT = 100;

export function initialHistory(content: DocumentContent): BuilderHistory {
  return { past: [], present: content, future: [], lastField: null };
}

function fieldOf(action: BuilderAction): string | null {
  if (action.kind === "setting") return `${action.id}:${action.key}`;
  if (action.kind === "page") return `page:${action.key}`;
  return null;
}

export function historyReducer(state: BuilderHistory, action: HistoryAction): BuilderHistory {
  if (action.kind === "undo") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], lastField: null };
  }

  if (action.kind === "redo") {
    const next = state.future[0];
    if (!next) return state;
    return { past: [...state.past, state.present], present: next, future: state.future.slice(1), lastField: null };
  }

  // A replace is a new document from the server, not an edit — it starts history afresh.
  if (action.kind === "replace") return initialHistory(action.content);

  const present = builderReducer(state.present, action);
  if (present === state.present) return state;

  const field = fieldOf(action);
  if (field && field === state.lastField) {
    // Same field as the step before: amend that step rather than adding one.
    return { ...state, present, future: [] };
  }

  return {
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present,
    future: [],
    lastField: field,
  };
}

/** The index a newly added section goes to: after the selected one, or at the end. */
export function insertionIndex(state: DocumentContent, selectedId: string | null): number {
  const index = selectedId ? state.sections.findIndex((section) => section.id === selectedId) : -1;
  return index >= 0 ? index + 1 : state.sections.length;
}
