"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CopyIcon,
  EyeOffIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { DEVICE_LABELS, DEVICES, SHADOWS, type DesignValue } from "@/lib/page-builder/design";
import { isFieldActive, isFieldFilled, type LeafFieldDef, type LinkValue } from "@/lib/page-builder/fields";
import { newBlockId } from "@/lib/page-builder/fields";
import {
  ELEMENTS,
  ELEMENT_TYPES,
  MAX_SAVED_COLOURS,
  MAX_ELEMENTS_PER_ZONE,
  MAX_FOOTER_COLUMNS,
  MAX_SPACE_BEFORE,
  MENU_CHOICES,
  ZONES,
  type ElementType,
  type FooterLayout,
  type GlobalStyle,
  type HeaderLayout,
  type ThemeElement,
  type ThemeLayoutContent,
} from "@/lib/theme-builder/layout";
import { cn } from "@/lib/utils/cn";

import { DesignControls, ResponsiveSlider, Row, Segmented, Slider } from "../page-builder/design-controls";
import { DEVICE_ICONS, useEditorDevice } from "../page-builder/editor-device";
import { ColorField, FieldControl } from "../page-builder/field-controls";

import { listAt, locate, locationLabel, placeElement, type Location } from "./ops";

/**
 * The Theme Builder's panels: where elements sit, and how each looks. Written for
 * someone arranging a header, not writing one — every list says where it shows, every
 * element says what it is in words, and the device switch decides which arrangement
 * (desktop, or phones and tablets) is being edited.
 */

export type Edits = {
  content: ThemeLayoutContent;
  change: (next: ThemeLayoutContent) => void;
  select: (id: string) => void;
  add: (at: Location, type: ElementType) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  shift: (id: string, delta: -1 | 1) => void;
  move: (id: string, to: Location) => void;
};

/** What a row says under an element's name — enough to tell two menus apart. */
function summary(element: ThemeElement): string {
  const s = element.settings;
  switch (element.type) {
    case "menu":
      return MENU_CHOICES.find((choice) => choice.value === s.menu)?.label ?? "";
    case "logo":
      return s.variant === "mark" ? "Symbol" : "Name";
    case "text":
      return s.source === "tagline" ? "Footer tagline" : s.source === "region" ? "Footer bottom line" : String(s.text ?? "").slice(0, 40);
    case "button":
      return (s.link as LinkValue | null)?.label ?? "";
    default:
      return "";
  }
}

/* -------------------------------------------------------------------------- *
 * A list of elements — a zone or a column
 * -------------------------------------------------------------------------- */

/** A zone's id as a drop target — so an EMPTY zone can still be dropped into. */
const zoneKey = (at: Location) => `zone:${JSON.stringify(at)}`;

/**
 * Drag and drop between every zone it wraps — within a zone to reorder, or into
 * another (left → centre, a footer column → the bottom bar). The ↑ ↓ buttons and
 * "Move to" stay, for the keyboard and for anyone who would rather click.
 */
export function ZonesDnd({ edits, children }: { edits: Edits; children: React.ReactNode }) {
  // dnd-kit numbers its screen-reader ids from a module counter; a stable id keeps
  // server and browser in agreement (see the section list).
  const dndId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const target = String(over.id);
    if (target.startsWith("zone:")) {
      const to = JSON.parse(target.slice(5)) as Location;
      edits.change(placeElement(edits.content, String(active.id), to, listAt(edits.content, to).length));
      return;
    }
    const landing = locate(edits.content, target);
    if (landing) edits.change(placeElement(edits.content, String(active.id), landing.at, landing.index));
  };

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}

export function ZoneList({
  title,
  at,
  place,
  edits,
  targets,
  actions,
}: {
  title: string;
  at: Location;
  place: "header" | "footer";
  edits: Edits;
  /** Where an element here can be moved to. */
  targets: Location[];
  /** Extra controls beside the title (a column's). */
  actions?: React.ReactNode;
}) {
  const elements = listAt(edits.content, at);
  const full = elements.length >= MAX_ELEMENTS_PER_ZONE;
  const offered = ELEMENT_TYPES.filter((type) => (ELEMENTS[type].places as readonly string[]).includes(place));
  const { setNodeRef, isOver } = useDroppable({ id: zoneKey(at) });

  return (
    <div ref={setNodeRef} className={cn("rounded-md border transition-colors", isOver && "border-primary bg-primary/5")}>
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <span className="text-xs font-medium">{title}</span>
        <span className="ms-auto flex items-center">{actions}</span>
      </div>

      <SortableContext items={elements.map((element) => element.id)} strategy={verticalListSortingStrategy}>
        {elements.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-xs">Empty — drag an element here, or add one.</p>
        ) : (
          <ul className="divide-y">
            {elements.map((element, index) => (
              <ElementRow
                key={element.id}
                element={element}
                first={index === 0}
                last={index === elements.length - 1}
                full={full}
                targets={targets}
                edits={edits}
              />
            ))}
          </ul>
        )}
      </SortableContext>

      <div className="border-t px-1 py-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-xs" disabled={full}>
              <PlusIcon />
              Add element
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {offered.map((type) => (
              <DropdownMenuItem key={type} onSelect={() => edits.add(at, type)} className="flex-col items-start gap-0">
                <span className="text-xs font-medium">{ELEMENTS[type].label}</span>
                <span className="text-muted-foreground text-[11px]">{ELEMENTS[type].description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ElementRow({
  element,
  first,
  last,
  full,
  targets,
  edits,
}: {
  element: ThemeElement;
  first: boolean;
  last: boolean;
  full: boolean;
  targets: Location[];
  edits: Edits;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: element.id });
  const hidden = DEVICES.filter((device) => element.hide?.[device]);
  const note = summary(element);
  const label = ELEMENTS[element.type].label;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("bg-background flex items-center gap-1 px-1 py-1", isDragging && "relative z-10 shadow-sm")}
    >
      <button
        type="button"
        aria-label={`Drag ${label}`}
        title="Drag to move"
        className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => edits.select(element.id)}
        className="hover:bg-muted flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{label}</span>
          {note ? <span className="text-muted-foreground block truncate text-[11px]">{note}</span> : null}
        </span>
        {hidden.length ? (
          <span
            className="text-muted-foreground"
            title={`Hidden on ${hidden.map((device) => DEVICE_LABELS[device].toLowerCase()).join(" and ")}`}
          >
            <EyeOffIcon className="size-3.5" />
          </span>
        ) : null}
        <ChevronRightIcon className="text-muted-foreground size-3.5" />
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${label} earlier`}
        disabled={first}
        onClick={() => edits.shift(element.id, -1)}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Move ${label} later`}
        disabled={last}
        onClick={() => edits.shift(element.id, 1)}
      >
        <ArrowDownIcon />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`More for ${label}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {targets.length > 0 ? <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel> : null}
          {targets.map((target) => (
            <DropdownMenuItem key={JSON.stringify(target)} onSelect={() => edits.move(element.id, target)}>
              <ArrowLeftRightIcon />
              {locationLabel(target)}
            </DropdownMenuItem>
          ))}
          {targets.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem onSelect={() => edits.duplicate(element.id)} disabled={full}>
            <CopyIcon />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => edits.remove(element.id)}>
            <Trash2Icon />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/* -------------------------------------------------------------------------- *
 * One element's settings
 * -------------------------------------------------------------------------- */

export function ElementEditor({ id, edits, onBack }: { id: string; edits: Edits; onBack: () => void }) {
  const found = locate(edits.content, id);
  if (!found) return null;
  const { element } = found;
  const definition = ELEMENTS[element.type];
  const fields = (definition.fields as readonly LeafFieldDef[]).filter((field) => isFieldActive(field, element.settings));

  const set = (change: (element: ThemeElement) => ThemeElement) =>
    edits.change(
      (() => {
        const next = structuredClone(edits.content);
        const at = locate(next, id)!;
        listAt(next, at.at)[at.index] = change(at.element);
        return next;
      })(),
    );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium">{definition.label}</h2>
          <p className="text-muted-foreground truncate text-[11px]">{locationLabel(found.at)}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Duplicate" title="Duplicate" onClick={() => edits.duplicate(id)}>
          <CopyIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive"
          aria-label="Remove"
          title="Remove"
          onClick={() => {
            edits.remove(id);
            onBack();
          }}
        >
          <Trash2Icon />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <p className="text-muted-foreground text-xs">{definition.description}</p>

        {fields.length === 0 ? null : (
          fields.map((field) => {
            const inputId = `${id}-${field.key}`;
            const inline = field.kind === "toggle";
            const missing = field.required && !isFieldFilled(field, element.settings[field.key]);
            return (
              <div key={field.key} className={inline ? "flex items-center justify-between gap-4" : "space-y-1.5"}>
                <Label htmlFor={inputId} className="text-xs">
                  {field.label}
                </Label>
                <FieldControl
                  field={field}
                  value={element.settings[field.key]}
                  inputId={inputId}
                  collections={[]}
                  onChange={(next) => set((current) => ({ ...current, settings: { ...current.settings, [field.key]: next } }))}
                />
                {field.help && !inline ? <p className="text-muted-foreground text-xs">{field.help}</p> : null}
                {missing ? <p className="text-xs text-amber-600 dark:text-amber-500">Fill this in, or the element is not shown.</p> : null}
              </div>
            );
          })
        )}

        <div className="space-y-4 border-t pt-4">
          <Slider
            label="Space before it"
            hint="Empty uses the spacing of the zone."
            unit="px"
            min={0}
            max={MAX_SPACE_BEFORE}
            step={1}
            value={element.spaceBefore}
            placeholder="Auto"
            onChange={(next) => set((current) => ({ ...current, spaceBefore: next }))}
          />
          <ShowOn
            id={id}
            hide={element.hide}
            onChange={(hide) =>
              set((current) => {
                const next = { ...current };
                if (hide) next.hide = hide;
                else delete next.hide;
                return next;
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Header
 * -------------------------------------------------------------------------- */

function Group({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-md border" open={defaultOpen || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="text-muted-foreground size-3.5 transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className="space-y-4 border-t px-3 py-3">{children}</div>
    </details>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function HeaderPanel({ edits }: { edits: Edits }) {
  const { device, setDevice } = useEditorDevice();
  const arrangement = device === "d" ? "desktop" : "mobile";
  const header = edits.content.header;
  const setHeader = (change: (header: HeaderLayout) => HeaderLayout) => edits.change({ ...edits.content, header: change(header) });
  const setStyle = <K extends keyof HeaderLayout["style"]>(key: K, value: HeaderLayout["style"][K]) =>
    setHeader((current) => ({ ...current, style: { ...current.style, [key]: value } }));
  const setAnnouncement = <K extends keyof HeaderLayout["announcement"]>(key: K, value: HeaderLayout["announcement"][K]) =>
    setHeader((current) => ({ ...current, announcement: { ...current.announcement, [key]: value } }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Segmented
          label="Arrangement"
          value={arrangement}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "mobile", label: "Phones & tablets" },
          ]}
          onChange={(next) => setDevice(next === "desktop" ? "d" : "m")}
        />
        <p className="text-muted-foreground text-xs">
          {arrangement === "desktop"
            ? "Screens 1024px and wider. The preview shows desktop."
            : "Screens narrower than 1024px — phones and tablets have their own arrangement."}
        </p>
      </div>

      <ZonesDnd edits={edits}>
        {ZONES.map((zone) => (
          <ZoneList
            key={`${arrangement}-${zone}`}
            title={{ left: "Left", center: "Centre", right: "Right" }[zone]}
            at={{ area: arrangement, zone }}
            place="header"
            edits={edits}
            targets={ZONES.filter((other) => other !== zone).map((other) => ({ area: arrangement, zone: other }))}
          />
        ))}
      </ZonesDnd>

      <Group title="Announcement bar">
        <Toggle
          id="ann-on"
          label="Show a bar above the header"
          checked={header.announcement.enabled}
          onChange={(next) => setAnnouncement("enabled", next)}
        />
        {header.announcement.enabled ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ann-text" className="text-xs">
                Text
              </Label>
              <Input
                id="ann-text"
                value={header.announcement.text}
                maxLength={200}
                placeholder="e.g. Free delivery in Belgium"
                onChange={(event) => setAnnouncement("text", event.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link</Label>
              <FieldControl
                field={{ kind: "link", key: "link", label: "Link" }}
                value={header.announcement.link}
                inputId="ann-link"
                collections={[]}
                onChange={(next) => setAnnouncement("link", next as LinkValue | null)}
              />
            </div>
            <Row label="Background" onReset={header.announcement.background ? () => setAnnouncement("background", "") : undefined}>
              <ColorField
                inputId="ann-bg"
                value={header.announcement.background}
                onChange={(next) => setAnnouncement("background", String(next))}
              />
            </Row>
            <Row label="Text colour" onReset={header.announcement.color ? () => setAnnouncement("color", "") : undefined}>
              <ColorField inputId="ann-fg" value={header.announcement.color} onChange={(next) => setAnnouncement("color", String(next))} />
            </Row>
            <ShowOn id="ann" hide={header.announcement.hide} onChange={(hide) => setAnnouncement("hide", hide)} />
          </>
        ) : null}
      </Group>

      <Group title="Look">
        <Toggle
          id="hdr-sticky"
          label="Stay at the top while scrolling"
          checked={header.sticky}
          onChange={(next) => setHeader((current) => ({ ...current, sticky: next }))}
        />
        <Toggle
          id="hdr-shrink"
          label="Get smaller while scrolling"
          checked={header.style.shrink}
          onChange={(next) => setStyle("shrink", next)}
        />
        <Toggle
          id="hdr-shadow"
          label="Shadow while scrolling"
          checked={header.style.scrollShadow}
          onChange={(next) => setStyle("scrollShadow", next)}
        />
        <Toggle
          id="hdr-over"
          label="Over the top of the page"
          checked={header.style.transparent}
          onChange={(next) => setStyle("transparent", next)}
        />
        {header.style.transparent ? (
          <>
            <p className="text-muted-foreground text-xs">
              No background until the page scrolls, so a photo at the top runs up behind it. Best on pages that open with a banner or
              slider.
            </p>
            <Row
              label="Text colour over the page"
              hint="Empty: light, for a photo."
              onReset={header.style.overColor ? () => setStyle("overColor", "") : undefined}
            >
              <ColorField
                inputId="hdr-over-colour"
                value={header.style.overColor}
                onChange={(next) => setStyle("overColor", String(next))}
              />
            </Row>
          </>
        ) : null}
        <Row
          label="Background"
          hint="Empty uses the page's own background."
          onReset={header.style.background ? () => setStyle("background", "") : undefined}
        >
          <ColorField inputId="hdr-bg" value={header.style.background} onChange={(next) => setStyle("background", String(next))} />
        </Row>
        <Row label="Text and icon colour" onReset={header.style.color ? () => setStyle("color", "") : undefined}>
          <ColorField inputId="hdr-fg" value={header.style.color} onChange={(next) => setStyle("color", String(next))} />
        </Row>
        <ResponsiveSlider
          label="Space above and below"
          unit="px"
          min={0}
          max={120}
          step={1}
          value={header.style.paddingY}
          placeholder="20"
          onChange={(next) => setStyle("paddingY", next ?? {})}
        />
        <Slider
          label="Space between elements"
          unit="px"
          min={0}
          max={120}
          step={1}
          value={header.style.gap}
          placeholder="36"
          onChange={(next) => setStyle("gap", next ?? 36)}
        />
        <Toggle id="hdr-border" label="Line under the header" checked={header.style.border} onChange={(next) => setStyle("border", next)} />
        {header.style.border ? (
          <Row
            label="Line colour"
            hint="Empty: a soft line in the text colour."
            onReset={header.style.borderColor ? () => setStyle("borderColor", "") : undefined}
          >
            <ColorField inputId="hdr-line" value={header.style.borderColor} onChange={(next) => setStyle("borderColor", String(next))} />
          </Row>
        ) : null}
        <Segmented
          label="Shadow"
          value={header.style.shadow}
          options={Object.entries(SHADOWS).map(([value, shadow]) => ({ value, label: shadow.label }))}
          onChange={(next) => setStyle("shadow", (next ?? "none") as HeaderLayout["style"]["shadow"])}
        />
      </Group>

      <Group title="Dropdown menus">
        <Row label="Background" onReset={header.style.dropdownBackground ? () => setStyle("dropdownBackground", "") : undefined}>
          <ColorField
            inputId="dd-bg"
            value={header.style.dropdownBackground}
            onChange={(next) => setStyle("dropdownBackground", String(next))}
          />
        </Row>
        <Row label="Text colour" onReset={header.style.dropdownColor ? () => setStyle("dropdownColor", "") : undefined}>
          <ColorField inputId="dd-fg" value={header.style.dropdownColor} onChange={(next) => setStyle("dropdownColor", String(next))} />
        </Row>
      </Group>

      <DesignControls value={header.style.design} parts={["typography"]} onChange={(next: DesignValue) => setStyle("design", next)} />
    </div>
  );
}

function ShowOn({
  id,
  hide,
  onChange,
}: {
  id: string;
  hide: Partial<Record<"d" | "t" | "m", boolean>> | undefined;
  onChange: (hide: Partial<Record<"d" | "t" | "m", boolean>> | undefined) => void;
}) {
  return (
    <div className="space-y-3">
      <span className="text-xs font-medium">Show on</span>
      {DEVICES.map((device) => {
        const Icon = DEVICE_ICONS[device];
        return (
          <div key={device} className="flex items-center justify-between gap-3">
            <Label htmlFor={`${id}-show-${device}`} className="flex items-center gap-2 text-xs font-normal">
              <Icon className="text-muted-foreground size-3.5" />
              {DEVICE_LABELS[device]}
            </Label>
            <Switch
              id={`${id}-show-${device}`}
              checked={!hide?.[device]}
              onCheckedChange={(show) => {
                const next = { ...hide, [device]: show ? undefined : true };
                for (const key of DEVICES) if (!next[key]) delete next[key];
                onChange(Object.keys(next).length ? next : undefined);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Footer
 * -------------------------------------------------------------------------- */

export function FooterPanel({
  edits,
  addColumn,
  removeColumn,
  shiftColumn,
}: {
  edits: Edits;
  addColumn: () => void;
  removeColumn: (index: number) => void;
  shiftColumn: (index: number, delta: -1 | 1) => void;
}) {
  const footer = edits.content.footer;
  const setStyle = <K extends keyof FooterLayout["style"]>(key: K, value: FooterLayout["style"][K]) =>
    edits.change({ ...edits.content, footer: { ...footer, style: { ...footer.style, [key]: value } } });
  const columnTargets = (index: number): Location[] => [
    ...footer.columns.map((_, other) => ({ area: "column" as const, index: other })).filter((target) => target.index !== index),
    ...ZONES.map((zone) => ({ area: "bottom" as const, zone })),
  ];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Columns side by side on desktop; on phones they stack (or sit two by two — under Look).
      </p>

      <ZonesDnd edits={edits}>
        {footer.columns.map((column, index) => (
          <ZoneList
            key={column.id}
            title={`Column ${index + 1}`}
            at={{ area: "column", index }}
            place="footer"
            edits={edits}
            targets={columnTargets(index)}
            actions={
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move column ${index + 1} left`}
                  disabled={index === 0}
                  onClick={() => shiftColumn(index, -1)}
                >
                  <ArrowUpIcon className="-rotate-90" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Move column ${index + 1} right`}
                  disabled={index === footer.columns.length - 1}
                  onClick={() => shiftColumn(index, 1)}
                >
                  <ArrowDownIcon className="-rotate-90" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive"
                  aria-label={`Remove column ${index + 1}`}
                  disabled={footer.columns.length <= 1}
                  onClick={() => removeColumn(index)}
                >
                  <Trash2Icon />
                </Button>
              </>
            }
          />
        ))}
        {footer.columns.length >= MAX_FOOTER_COLUMNS ? (
          <p className="text-muted-foreground text-xs">
            A footer has at most {MAX_FOOTER_COLUMNS} columns. Remove one, or add elements to an existing column.
          </p>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={addColumn}>
            <PlusIcon />
            Add column
          </Button>
        )}

        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Bottom bar</h3>
          {ZONES.map((zone) => (
            <ZoneList
              key={`bottom-${zone}`}
              title={{ left: "Left", center: "Centre", right: "Right" }[zone]}
              at={{ area: "bottom", zone }}
              place="footer"
              edits={edits}
              targets={ZONES.filter((other) => other !== zone).map((other) => ({ area: "bottom" as const, zone: other }))}
            />
          ))}
        </div>
      </ZonesDnd>

      <Group title="Look">
        <Row
          label="Background"
          hint="Empty uses each page's footer colour (olive on most)."
          onReset={footer.style.background ? () => setStyle("background", "") : undefined}
        >
          <ColorField inputId="ftr-bg" value={footer.style.background} onChange={(next) => setStyle("background", String(next))} />
        </Row>
        <Row label="Text colour" onReset={footer.style.color ? () => setStyle("color", "") : undefined}>
          <ColorField inputId="ftr-fg" value={footer.style.color} onChange={(next) => setStyle("color", String(next))} />
        </Row>
        <ResponsiveSlider
          label="Space above"
          unit="px"
          min={0}
          max={240}
          step={1}
          value={footer.style.paddingTop}
          placeholder="48"
          onChange={(next) => setStyle("paddingTop", next ?? {})}
        />
        <ResponsiveSlider
          label="Space below"
          unit="px"
          min={0}
          max={240}
          step={1}
          value={footer.style.paddingBottom}
          placeholder="16"
          onChange={(next) => setStyle("paddingBottom", next ?? {})}
        />
        <Slider
          label="Space between columns"
          unit="px"
          min={0}
          max={320}
          step={1}
          value={footer.style.columnGap}
          placeholder="197"
          onChange={(next) => setStyle("columnGap", next ?? 197)}
        />
        <Segmented
          label="Columns on phones"
          value={footer.style.mobileColumns}
          options={[
            { value: "one", label: "One under another" },
            { value: "two", label: "Two side by side" },
          ]}
          onChange={(next) => setStyle("mobileColumns", (next ?? "one") as FooterLayout["style"]["mobileColumns"])}
        />
        <Toggle id="ftr-border" label="Line above the footer" checked={footer.style.border} onChange={(next) => setStyle("border", next)} />
        {footer.style.border ? (
          <Row label="Line colour" onReset={footer.style.borderColor ? () => setStyle("borderColor", "") : undefined}>
            <ColorField inputId="ftr-line" value={footer.style.borderColor} onChange={(next) => setStyle("borderColor", String(next))} />
          </Row>
        ) : null}
      </Group>

      <DesignControls value={footer.style.design} parts={["typography"]} onChange={(next: DesignValue) => setStyle("design", next)} />
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Site style
 * -------------------------------------------------------------------------- */

/**
 * What every page starts from: typography for the whole site, and the saved colours
 * every colour picker offers. A section's own design still overrides the typography.
 */
export function GlobalPanel({ edits }: { edits: Edits }) {
  const global = edits.content.global;
  const setGlobal = (change: (global: GlobalStyle) => GlobalStyle) => edits.change({ ...edits.content, global: change(global) });
  const setColour = (id: string, change: Partial<GlobalStyle["colors"][number]>) =>
    setGlobal((current) => ({
      ...current,
      colors: current.colors.map((colour) => (colour.id === id ? { ...colour, ...change } : colour)),
    }));

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-xs">
        The look every page starts from. A section&rsquo;s own Style still wins where one is set.
      </p>

      <div className="space-y-2">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Fonts for the whole site</h3>
        <DesignControls
          value={global.design}
          parts={["typography"]}
          align={false}
          open={["typography"]}
          onChange={(next: DesignValue) => setGlobal((current) => ({ ...current, design: next }))}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Buttons for the whole site</h3>
        <DesignControls
          value={global.design}
          parts={["buttons"]}
          open={["buttons"]}
          onChange={(next: DesignValue) => setGlobal((current) => ({ ...current, design: next }))}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Saved colours</h3>
        <p className="text-muted-foreground text-xs">Offered in every colour picker, beside the brand&rsquo;s own.</p>
        {global.colors.length === 0 ? <p className="text-muted-foreground text-xs">None yet.</p> : null}
        <ul className="space-y-3">
          {global.colors.map((colour) => (
            <li key={colour.id} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={colour.name}
                  maxLength={40}
                  aria-label="Colour name"
                  placeholder="Name, e.g. Accent"
                  onChange={(event) => setColour(colour.id, { name: event.target.value })}
                  className="h-8 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive"
                  aria-label={`Remove ${colour.name || "colour"}`}
                  onClick={() => setGlobal((current) => ({ ...current, colors: current.colors.filter((other) => other.id !== colour.id) }))}
                >
                  <Trash2Icon />
                </Button>
              </div>
              <ColorField
                inputId={`saved-${colour.id}`}
                value={colour.value}
                onChange={(next) => next && setColour(colour.id, { value: String(next) })}
              />
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={global.colors.length >= MAX_SAVED_COLOURS}
          onClick={() =>
            setGlobal((current) => ({
              ...current,
              colors: [...current.colors, { id: newBlockId(), name: `Colour ${current.colors.length + 1}`, value: "#a65a3f" }],
            }))
          }
        >
          <PlusIcon />
          Add a colour
        </Button>
      </div>
    </div>
  );
}
