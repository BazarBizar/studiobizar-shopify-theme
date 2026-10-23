import {
  createElement,
  MAX_ELEMENTS_PER_ZONE,
  MAX_FOOTER_COLUMNS,
  ZONES,
  type ElementType,
  type ThemeElement,
  type ThemeLayoutContent,
  type Zone,
} from "@/lib/theme-builder/layout";
import { newBlockId } from "@/lib/page-builder/fields";

/**
 * The Theme Builder's edits, as pure functions over the layout — every one returns a
 * new layout and leaves the old one untouched, which is what undo keeps.
 *
 * An element is found by its id wherever it is; a LOCATION names a list: a header
 * zone (per arrangement), a footer bottom-bar zone, or a footer column.
 */

export type Location =
  | { area: "desktop" | "mobile" | "bottom"; zone: Zone }
  | { area: "column"; index: number };

export function listAt(content: ThemeLayoutContent, at: Location): ThemeElement[] {
  if (at.area === "column") return content.footer.columns[at.index]?.elements ?? [];
  if (at.area === "bottom") return content.footer.bottom[at.zone];
  return content.header[at.area][at.zone];
}

function withList(content: ThemeLayoutContent, at: Location, list: ThemeElement[]): ThemeLayoutContent {
  if (at.area === "column") {
    return {
      ...content,
      footer: {
        ...content.footer,
        columns: content.footer.columns.map((column, index) => (index === at.index ? { ...column, elements: list } : column)),
      },
    };
  }
  if (at.area === "bottom") {
    return { ...content, footer: { ...content.footer, bottom: { ...content.footer.bottom, [at.zone]: list } } };
  }
  return { ...content, header: { ...content.header, [at.area]: { ...content.header[at.area], [at.zone]: list } } };
}

export function allLocations(content: ThemeLayoutContent): Location[] {
  return [
    ...(["desktop", "mobile", "bottom"] as const).flatMap((area) => ZONES.map((zone) => ({ area, zone }))),
    ...content.footer.columns.map((_, index) => ({ area: "column" as const, index })),
  ];
}

export function locate(content: ThemeLayoutContent, id: string): { at: Location; index: number; element: ThemeElement } | null {
  for (const at of allLocations(content)) {
    const index = listAt(content, at).findIndex((element) => element.id === id);
    if (index >= 0) return { at, index, element: listAt(content, at)[index]! };
  }
  return null;
}

export function updateElement(content: ThemeLayoutContent, id: string, change: (element: ThemeElement) => ThemeElement) {
  const found = locate(content, id);
  if (!found) return content;
  const list = [...listAt(content, found.at)];
  list[found.index] = change(found.element);
  return withList(content, found.at, list);
}

export function insertElement(content: ThemeLayoutContent, at: Location, type: ElementType): { content: ThemeLayoutContent; id: string | null } {
  const list = listAt(content, at);
  if (list.length >= MAX_ELEMENTS_PER_ZONE) return { content, id: null };
  const element = createElement(type);
  return { content: withList(content, at, [...list, element]), id: element.id };
}

export function removeElement(content: ThemeLayoutContent, id: string) {
  const found = locate(content, id);
  if (!found) return content;
  return withList(content, found.at, listAt(content, found.at).filter((element) => element.id !== id));
}

export function duplicateElement(content: ThemeLayoutContent, id: string) {
  const found = locate(content, id);
  if (!found) return content;
  const list = [...listAt(content, found.at)];
  if (list.length >= MAX_ELEMENTS_PER_ZONE) return content;
  list.splice(found.index + 1, 0, { ...structuredClone(found.element), id: newBlockId() });
  return withList(content, found.at, list);
}

/** One step earlier or later within its list. */
export function shiftElement(content: ThemeLayoutContent, id: string, delta: -1 | 1) {
  const found = locate(content, id);
  if (!found) return content;
  const list = [...listAt(content, found.at)];
  const target = found.index + delta;
  if (target < 0 || target >= list.length) return content;
  [list[found.index], list[target]] = [list[target]!, list[found.index]!];
  return withList(content, found.at, list);
}

/** To the end of another list — "move to the right zone". */
export function moveElement(content: ThemeLayoutContent, id: string, to: Location) {
  const found = locate(content, id);
  if (!found || listAt(content, to).length >= MAX_ELEMENTS_PER_ZONE) return content;
  const without = withList(content, found.at, listAt(content, found.at).filter((element) => element.id !== id));
  return withList(without, to, [...listAt(without, to), found.element]);
}

export function addColumn(content: ThemeLayoutContent) {
  if (content.footer.columns.length >= MAX_FOOTER_COLUMNS) return content;
  return { ...content, footer: { ...content.footer, columns: [...content.footer.columns, { id: newBlockId(), elements: [] }] } };
}

export function removeColumn(content: ThemeLayoutContent, index: number) {
  if (content.footer.columns.length <= 1) return content;
  return { ...content, footer: { ...content.footer, columns: content.footer.columns.filter((_, at) => at !== index) } };
}

export function shiftColumn(content: ThemeLayoutContent, index: number, delta: -1 | 1) {
  const columns = [...content.footer.columns];
  const target = index + delta;
  if (target < 0 || target >= columns.length) return content;
  [columns[index], columns[target]] = [columns[target]!, columns[index]!];
  return { ...content, footer: { ...content.footer, columns } };
}

export function locationLabel(at: Location): string {
  if (at.area === "column") return `Column ${at.index + 1}`;
  const zone = { left: "left", center: "centre", right: "right" }[at.zone];
  return at.area === "bottom" ? `Bottom bar, ${zone}` : `${zone[0]!.toUpperCase()}${zone.slice(1)}`;
}

/** Drag and drop: to `index` in `to` — within its own list, or into another. */
export function placeElement(content: ThemeLayoutContent, id: string, to: Location, index: number) {
  const found = locate(content, id);
  if (!found) return content;
  const same = JSON.stringify(found.at) === JSON.stringify(to);
  if (!same && listAt(content, to).length >= MAX_ELEMENTS_PER_ZONE) return content;
  const without = withList(content, found.at, listAt(content, found.at).filter((element) => element.id !== id));
  const list = [...listAt(without, to)];
  list.splice(Math.max(0, Math.min(index, list.length)), 0, found.element);
  return withList(without, to, list);
}
