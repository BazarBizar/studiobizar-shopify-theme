"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/admin/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { isFieldActive, newBlockId, type FieldGroup, type LeafFieldDef } from "@/lib/page-builder/fields";
import {
  createMessage,
  createPopup,
  MAX_MESSAGES,
  MAX_POPUP_PATHS,
  MAX_POPUPS,
  MESSAGE_MAX,
  POPUP_FIELDS,
  popupHasContent,
  scheduleNote,
  type Announcement,
  type AnnouncementMessage,
  type Popup,
  type PopupPages,
  type Schedule,
} from "@/lib/theme-builder/promo";
import { cn } from "@/lib/utils/cn";

import { Row, Segmented, Slider } from "../page-builder/design-controls";
import { ColorField, EditorLookupsContext, FieldControl } from "../page-builder/field-controls";

import { Group, ShowOn, Toggle } from "./controls";
import type { Edits } from "./panels";

/**
 * The promotions in the Theme Builder: the announcement bar (in the Header tab) and
 * the Pop-ups tab. The data and its rules are in `lib/theme-builder/promo.ts`; the
 * storefront half in `components/layout/announcement-bar.tsx` and `popups.tsx`.
 */

/* -------------------------------------------------------------------------- *
 * Dates — shared by a message and a pop-up
 * -------------------------------------------------------------------------- */

/** ISO → what a `datetime-local` input shows, in the editor's own time zone. */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function DateRange({ id, value, onChange }: { id: string; value: Schedule; onChange: (next: Schedule) => void }) {
  const backwards = value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt);
  const field = (key: keyof Schedule, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`${id}-${key}`} className="text-xs font-normal">
        {label}
      </Label>
      <div className="flex items-center gap-1">
        <Input
          id={`${id}-${key}`}
          type="datetime-local"
          value={toLocalInput(value[key])}
          onChange={(event) => onChange({ ...value, [key]: fromLocalInput(event.target.value) })}
          className="h-8 flex-1 text-xs"
        />
        {value[key] ? (
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange({ ...value, [key]: "" })}>
            <XIcon />
          </Button>
        ) : null}
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      {field("startsAt", "From")}
      {field("endsAt", "Until")}
      <p className="text-muted-foreground text-xs">Empty: from now on, with no end. Times are your own time zone.</p>
      {backwards ? (
        <p className="text-xs text-amber-600 dark:text-amber-500">The end is before the start, so it never shows.</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * The announcement bar (Header tab)
 * -------------------------------------------------------------------------- */

export function AnnouncementGroup({ edits }: { edits: Edits }) {
  const announcement = edits.content.header.announcement;
  const setAnnouncement = (change: Partial<Announcement>) =>
    edits.change({ ...edits.content, header: { ...edits.content.header, announcement: { ...announcement, ...change } } });
  const setMessage = (id: string, change: Partial<AnnouncementMessage>) =>
    setAnnouncement({ messages: announcement.messages.map((message) => (message.id === id ? { ...message, ...change } : message)) });
  const shiftMessage = (index: number, delta: -1 | 1) => {
    const messages = [...announcement.messages];
    const [moved] = messages.splice(index, 1);
    messages.splice(index + delta, 0, moved!);
    setAnnouncement({ messages });
  };
  const several = announcement.messages.length > 1;

  return (
    <Group title="Announcement bar">
      <Toggle id="ann-on" label="Show a bar above the header" checked={announcement.enabled} onChange={(next) => setAnnouncement({ enabled: next })} />
      {announcement.enabled ? (
        <>
          <ul className="space-y-3">
            {announcement.messages.map((message, index) => {
              const note = scheduleNote(message);
              return (
                <li key={message.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium">{several ? `Message ${index + 1}` : "Message"}</span>
                    {note ? <span className="text-muted-foreground text-[11px]">· {note}</span> : null}
                    <span className="ms-auto flex items-center">
                      {several ? (
                        <>
                          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move message ${index + 1} earlier`} disabled={index === 0} onClick={() => shiftMessage(index, -1)}>
                            <ArrowUpIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Move message ${index + 1} later`}
                            disabled={index === announcement.messages.length - 1}
                            onClick={() => shiftMessage(index, 1)}
                          >
                            <ArrowDownIcon />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-destructive"
                            aria-label={`Remove message ${index + 1}`}
                            onClick={() => setAnnouncement({ messages: announcement.messages.filter((other) => other.id !== message.id) })}
                          >
                            <Trash2Icon />
                          </Button>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <Input
                    aria-label={several ? `Message ${index + 1} text` : "Text"}
                    value={message.text}
                    maxLength={MESSAGE_MAX}
                    placeholder="e.g. Visit our new showroom in Antwerp"
                    onChange={(event) => setMessage(message.id, { text: event.target.value })}
                    className="h-8 text-xs"
                  />
                  <FieldControl
                    field={{ kind: "url", key: "href", label: "Link", default: "" }}
                    value={message.href}
                    inputId={`ann-link-${message.id}`}
                    collections={[]}
                    onChange={(next) => setMessage(message.id, { href: String(next ?? "") })}
                  />
                  <details className="group">
                    <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1 text-xs [&::-webkit-details-marker]:hidden">
                      <ChevronRightIcon className="size-3 transition-transform group-open:rotate-90" />
                      {message.startsAt || message.endsAt ? "Shown between dates" : "Show only between dates"}
                    </summary>
                    <div className="pt-2">
                      <DateRange
                        id={`ann-${message.id}`}
                        value={message}
                        onChange={(next) => setMessage(message.id, next)}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={announcement.messages.length >= MAX_MESSAGES}
            onClick={() => setAnnouncement({ messages: [...announcement.messages, createMessage()] })}
          >
            <PlusIcon />
            Add a message
          </Button>

          <Segmented
            label="Messages"
            value={announcement.mode}
            options={[
              { value: "rotate", label: "One at a time" },
              { value: "scroll", label: "Scrolling across" },
            ]}
            onChange={(next) => setAnnouncement({ mode: (next ?? "rotate") as Announcement["mode"] })}
          />
          {announcement.mode === "rotate" ? (
            several ? (
              <Slider
                label="Seconds per message"
                unit="s"
                min={2}
                max={30}
                step={1}
                value={announcement.interval}
                placeholder="5"
                onChange={(next) => setAnnouncement({ interval: next ?? 5 })}
              />
            ) : (
              <p className="text-muted-foreground text-xs">With one message the bar stays still. Add another and they take turns.</p>
            )
          ) : (
            <>
              <Segmented
                label="Speed"
                value={announcement.speed}
                options={[
                  { value: "slow", label: "Slow" },
                  { value: "normal", label: "Normal" },
                  { value: "fast", label: "Fast" },
                ]}
                onChange={(next) => setAnnouncement({ speed: (next ?? "normal") as Announcement["speed"] })}
              />
              <Segmented
                label="Direction"
                value={announcement.direction}
                options={[
                  { value: "left", label: "To the left" },
                  { value: "right", label: "To the right" },
                ]}
                onChange={(next) => setAnnouncement({ direction: (next ?? "left") as Announcement["direction"] })}
              />
              <Segmented
                label="Between messages"
                value={announcement.separator}
                options={[
                  { value: "dot", label: "·" },
                  { value: "dash", label: "—" },
                  { value: "star", label: "✦" },
                  { value: "none", label: "Nothing" },
                ]}
                onChange={(next) => setAnnouncement({ separator: (next ?? "dot") as Announcement["separator"] })}
              />
              <p className="text-muted-foreground text-xs">It stops under the pointer, so a link can be clicked.</p>
            </>
          )}

          <Segmented
            label="Text size"
            value={announcement.size}
            options={[
              { value: "secondary", label: "Standard" },
              { value: "tertiary", label: "Small" },
              { value: "caption", label: "Very small" },
            ]}
            onChange={(next) => setAnnouncement({ size: (next ?? "tertiary") as Announcement["size"] })}
          />
          <Toggle
            id="ann-close"
            label="Visitors can close it"
            checked={announcement.dismissible}
            onChange={(next) => setAnnouncement({ dismissible: next })}
          />
          {announcement.dismissible ? (
            <p className="text-muted-foreground text-xs">Closed stays closed for that visitor — until you change the messages.</p>
          ) : null}
          <Row label="Background" onReset={announcement.background ? () => setAnnouncement({ background: "" }) : undefined}>
            <ColorField inputId="ann-bg" value={announcement.background} onChange={(next) => setAnnouncement({ background: String(next) })} />
          </Row>
          <Row label="Text colour" onReset={announcement.color ? () => setAnnouncement({ color: "" }) : undefined}>
            <ColorField inputId="ann-fg" value={announcement.color} onChange={(next) => setAnnouncement({ color: String(next) })} />
          </Row>
          <ShowOn id="ann" hide={announcement.hide} onChange={(hide) => setAnnouncement({ hide })} />
        </>
      ) : null}
    </Group>
  );
}

/* -------------------------------------------------------------------------- *
 * The Pop-ups tab
 * -------------------------------------------------------------------------- */

/** Ready-made starts, so a new pop-up opens with something to change rather than nothing. */
const STARTERS: { label: string; description: string; name: string; settings: Record<string, unknown> }[] = [
  {
    label: "Event or news",
    description: "A box in the middle with a photograph, a few words and a button.",
    name: "Event",
    settings: {
      heading: "Join us at the showroom",
      text: "An evening with the makers — drinks, new pieces and the people behind them.",
      imagePosition: "top",
      trigger: "delay",
      delay: 5,
    },
  },
  {
    label: "Newsletter sign-up",
    description: "An invitation and the email field.",
    name: "Newsletter",
    settings: {
      heading: "Stay in touch",
      text: "New collections, projects and invitations — a few times a year.",
      newsletter: true,
      width: "small",
      trigger: "scroll",
      scroll: 50,
      frequency: "days",
      days: 30,
    },
  },
  {
    label: "Small note in a corner",
    description: "Quiet — the page stays usable around it.",
    name: "Corner note",
    settings: { layout: "corner", heading: "New in the shop", text: "The autumn collection has arrived.", align: "left", trigger: "delay", delay: 8 },
  },
  {
    label: "Bar along the bottom",
    description: "One line and a button, across the foot of the screen.",
    name: "Bottom bar",
    settings: { layout: "bar", text: "Our showroom is open on Sundays this month.", trigger: "delay", delay: 3 },
  },
];

const TRIGGER_NOTE: Record<string, (s: Record<string, unknown>) => string> = {
  delay: (s) => (Number(s.delay) ? `after ${s.delay}s` : "straight away"),
  scroll: (s) => `at ${s.scroll}% down`,
  exit: () => "when leaving",
};

function popupSummary(popup: Popup): string {
  if (!popup.enabled) return "Off";
  if (!popupHasContent(popup)) return "Empty — never opens";
  const dated = scheduleNote(popup);
  if (dated) return dated;
  const where = { all: "Every page", home: "Home page", only: "Some pages", except: "Most pages" }[popup.pages.mode];
  return `${where}, ${TRIGGER_NOTE[String(popup.settings.trigger)]?.(popup.settings) ?? ""}`;
}

export function PopupsPanel({ edits, onOpen }: { edits: Edits; onOpen: (id: string) => void }) {
  const popups = edits.content.popups;
  const setPopups = (next: Popup[]) => edits.change({ ...edits.content, popups: next });
  const full = popups.length >= MAX_POPUPS;

  const shift = (index: number, delta: -1 | 1) => {
    const next = [...popups];
    const [moved] = next.splice(index, 1);
    next.splice(index + delta, 0, moved!);
    setPopups(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Boxes that open over the page — for an event, a new collection or the newsletter. At most one opens per page: the first in this
        list whose moment comes.
      </p>

      {popups.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-xs">No pop-ups yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {popups.map((popup, index) => (
            <li key={popup.id} className="flex items-center gap-1 px-1 py-1">
              <button
                type="button"
                onClick={() => onOpen(popup.id)}
                className="hover:bg-muted flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{popup.name || "Pop-up"}</span>
                  <span className="text-muted-foreground block truncate text-[11px]">{popupSummary(popup)}</span>
                </span>
                <ChevronRightIcon className="text-muted-foreground size-3.5" />
              </button>
              <Switch
                aria-label={`${popup.name || "Pop-up"} switched on`}
                checked={popup.enabled}
                onCheckedChange={(enabled) => setPopups(popups.map((other) => (other.id === popup.id ? { ...other, enabled } : other)))}
              />
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Move ${popup.name} up`} disabled={index === 0} onClick={() => shift(index, -1)}>
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Move ${popup.name} down`}
                disabled={index === popups.length - 1}
                onClick={() => shift(index, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <PopupMenu edits={edits} popup={popup} />
            </li>
          ))}
        </ul>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={full}>
            <PlusIcon />
            Add a pop-up
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {STARTERS.map((starter) => (
            <DropdownMenuItem
              key={starter.label}
              className="flex-col items-start gap-0"
              onSelect={() => {
                const popup = createPopup(starter.name, starter.settings);
                setPopups([...popups, popup]);
                onOpen(popup.id);
              }}
            >
              <span className="text-xs font-medium">{starter.label}</span>
              <span className="text-muted-foreground text-[11px]">{starter.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {full ? <p className="text-muted-foreground text-xs">At most {MAX_POPUPS} pop-ups. Remove one you no longer use to add another.</p> : null}
    </div>
  );
}

function PopupMenu({ edits, popup, onRemoved }: { edits: Edits; popup: Popup; onRemoved?: () => void }) {
  const popups = edits.content.popups;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={`More for ${popup.name || "pop-up"}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={popups.length >= MAX_POPUPS}
          onSelect={() => {
            const index = popups.findIndex((other) => other.id === popup.id);
            // A copy starts switched off, so two of the same never open side by side.
            const copy: Popup = { ...structuredClone(popup), id: newBlockId(), name: `${popup.name} (copy)`.slice(0, 60), enabled: false };
            edits.change({ ...edits.content, popups: [...popups.slice(0, index + 1), copy, ...popups.slice(index + 1)] });
          }}
        >
          <CopyIcon />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            edits.change({ ...edits.content, popups: popups.filter((other) => other.id !== popup.id) });
            onRemoved?.();
          }}
        >
          <Trash2Icon />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------------- *
 * One pop-up's settings
 * -------------------------------------------------------------------------- */

const FOLDS: { group: FieldGroup; title: string }[] = [
  { group: "content", title: "What it says" },
  { group: "style", title: "Look" },
  { group: "advanced", title: "When it opens" },
];

export function PopupEditor({ id, edits, onBack }: { id: string; edits: Edits; onBack: () => void }) {
  const popup = edits.content.popups.find((candidate) => candidate.id === id);
  if (!popup) return null;

  const set = (change: Partial<Popup>) =>
    edits.change({ ...edits.content, popups: edits.content.popups.map((other) => (other.id === id ? { ...other, ...change } : other)) });
  const setSetting = (key: string, value: unknown) => set({ settings: { ...popup.settings, [key]: value } });
  const fields = (POPUP_FIELDS as readonly LeafFieldDef[]).filter((field) => isFieldActive(field, popup.settings));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium">{popup.name || "Pop-up"}</h2>
          <p className="text-muted-foreground truncate text-[11px]">Pop-up · {popupSummary(popup)}</p>
        </div>
        <PopupMenu edits={edits} popup={popup} onRemoved={onBack} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Toggle id={`${id}-on`} label="Switched on" checked={popup.enabled} onChange={(enabled) => set({ enabled })} />
        {!popup.enabled ? (
          <p className="text-muted-foreground text-xs">Visitors do not see it. The preview still shows it, so you can finish it first.</p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`} className="text-xs">
            Name
          </Label>
          <Input id={`${id}-name`} value={popup.name} maxLength={60} onChange={(event) => set({ name: event.target.value })} className="h-8 text-xs" />
          <p className="text-muted-foreground text-xs">Only for this list — visitors never see it.</p>
        </div>
        {!popupHasContent(popup) ? (
          <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            Add a heading, some text, a photograph, a button or the sign-up — an empty pop-up never opens.
          </p>
        ) : null}

        {FOLDS.map((fold) => (
          <Group key={fold.group} title={fold.title} defaultOpen={fold.group === "content"}>
            {fields
              .filter((field) => field.group === fold.group)
              .map((field) => {
                const inputId = `${id}-${field.key}`;
                const inline = field.kind === "toggle";
                return (
                  <div key={field.key} className={inline ? "flex items-center justify-between gap-4" : "space-y-1.5"}>
                    <Label htmlFor={inputId} className="text-xs">
                      {field.label}
                    </Label>
                    <FieldControl
                      field={field}
                      value={popup.settings[field.key]}
                      inputId={inputId}
                      collections={[]}
                      onChange={(next) => setSetting(field.key, next)}
                    />
                    {field.help && !inline ? <p className="text-muted-foreground text-xs">{field.help}</p> : null}
                  </div>
                );
              })}
            {fold.group === "advanced" && popup.settings.trigger === "exit" ? (
              <p className="text-muted-foreground text-xs">
                When the pointer heads for the tabs or the address bar. Phones and tablets have no pointer, so there it does not open.
              </p>
            ) : null}
            {fold.group === "advanced" ? (
              <p className="text-muted-foreground text-xs">Closing it, or pressing its button, counts as seen.</p>
            ) : null}
          </Group>
        ))}

        <Group title="Where it shows">
          <PagesPicker id={id} value={popup.pages} onChange={(pages) => set({ pages })} />
          <ShowOn
            id={`${id}-device`}
            hide={popup.hide}
            onChange={(hide) => {
              const next = { ...popup };
              if (hide) next.hide = hide;
              else delete next.hide;
              edits.change({ ...edits.content, popups: edits.content.popups.map((other) => (other.id === id ? next : other)) });
            }}
          />
        </Group>

        <Group title="Dates">
          <DateRange id={id} value={popup} onChange={(next) => set(next)} />
        </Group>
      </div>
    </div>
  );
}

function PagesPicker({ id, value, onChange }: { id: string; value: PopupPages; onChange: (next: PopupPages) => void }) {
  const { linkTargets } = React.useContext(EditorLookupsContext);
  const [typed, setTyped] = React.useState("");
  const listed = value.mode === "only" || value.mode === "except";
  const full = value.paths.length >= MAX_POPUP_PATHS;
  const add = (path: string) => {
    const clean = path.trim();
    if (!/^\/[^\s?#]*$/.test(clean) || value.paths.includes(clean) || full) return false;
    onChange({ ...value, paths: [...value.paths, clean] });
    return true;
  };
  const labelOf = (path: string) => (path === "/" ? "Home page" : linkTargets.find((target) => target.href === path)?.label);
  const groups = (["Pages", "Collections", "Site"] as const)
    .map((group) => ({ group, targets: linkTargets.filter((target) => target.group === group && !value.paths.includes(target.href)) }))
    .filter((entry) => entry.targets.length);
  const typedValid = /^\/[^\s?#]*$/.test(typed.trim());

  return (
    <div className="space-y-3">
      <Select value={value.mode} onValueChange={(mode) => onChange({ ...value, mode: mode as PopupPages["mode"] })}>
        <SelectTrigger className="h-8 w-full text-xs" aria-label="On which pages">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">
            Every page
          </SelectItem>
          <SelectItem value="home" className="text-xs">
            The home page only
          </SelectItem>
          <SelectItem value="only" className="text-xs">
            Only on the pages below
          </SelectItem>
          <SelectItem value="except" className="text-xs">
            Every page except the ones below
          </SelectItem>
        </SelectContent>
      </Select>

      {listed ? (
        <>
          {value.paths.length === 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {value.mode === "only" ? "Add a page, or it shows nowhere." : "Add the pages it should stay away from."}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {value.paths.map((path) => (
                <li key={path} className="flex items-center gap-2 px-2 py-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{labelOf(path) ?? path}</span>
                    {labelOf(path) ? <span className="text-muted-foreground block truncate text-[11px]">{path}</span> : null}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${labelOf(path) ?? path}`}
                    onClick={() => onChange({ ...value, paths: value.paths.filter((other) => other !== path) })}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Select value="" onValueChange={(path) => add(path)} disabled={full}>
            <SelectTrigger className="h-8 w-full text-xs" aria-label="Add a page">
              <SelectValue placeholder="Add a page…" />
            </SelectTrigger>
            <SelectContent>
              {!value.paths.includes("/") ? (
                <SelectItem value="/" className="text-xs">
                  Home page
                </SelectItem>
              ) : null}
              {groups.map((entry) => (
                <SelectGroup key={entry.group}>
                  <SelectLabel className="text-[11px]">{entry.group}</SelectLabel>
                  {entry.targets.map((target) => (
                    <SelectItem key={target.href} value={target.href} className="text-xs">
                      {target.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Input
                id={`${id}-path`}
                value={typed}
                placeholder="Or type an address, e.g. /products/*"
                aria-label="Page address"
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && add(typed)) {
                    event.preventDefault();
                    setTyped("");
                  }
                }}
                className={cn("h-8 flex-1 text-xs")}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!typedValid || full}
                onClick={() => add(typed) && setTyped("")}
              >
                Add
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">An address ending in /* covers every page under it — /products/* is every product.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
