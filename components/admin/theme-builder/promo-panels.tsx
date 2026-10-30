"use client";

import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  MonitorPlayIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
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
import { Separator } from "@/components/admin/ui/separator";
import { Switch } from "@/components/admin/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { contrastRatio, DEVICES, getAt, setAt, type DesignValue } from "@/lib/page-builder/design-style";
import { fieldDefault, isFieldActive, newBlockId, type ImageRef, type LeafFieldDef, type LinkValue } from "@/lib/page-builder/fields";
import {
  createMessage,
  createPopup,
  MAX_MESSAGES,
  MAX_POPUP_PATHS,
  MAX_POPUPS,
  MESSAGE_MAX,
  paddingOn,
  POPUP_FIELDS,
  POPUP_LIMITS,
  POPUP_SIDES,
  POPUP_STYLE_FOLD,
  popupDefaults,
  popupHasContent,
  scheduleNote,
  type Announcement,
  type AnnouncementMessage,
  type Popup,
  type PopupBox,
  type PopupPages,
  type PopupSides,
  type PopupStyleFold,
  type Schedule,
} from "@/lib/theme-builder/promo";
import { cn } from "@/lib/utils/cn";

import { BackgroundPart, DesignControls, Part, ResponsiveSlider, Row, Segmented, Slider } from "../page-builder/design-controls";
import { DeviceSwitch, useEditorDevice } from "../page-builder/editor-device";
import { ColorField, EditorLookupsContext, FieldControl } from "../page-builder/field-controls";
import { SpacingBox, type BoxSide } from "../page-builder/section-editor";

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

/** A copy just below it — switched off, so two of the same never open side by side. */
function duplicatePopup(edits: Edits, popup: Popup) {
  const popups = edits.content.popups;
  const index = popups.findIndex((other) => other.id === popup.id);
  const copy: Popup = { ...structuredClone(popup), id: newBlockId(), name: `${popup.name} (copy)`.slice(0, 60), enabled: false };
  edits.change({ ...edits.content, popups: [...popups.slice(0, index + 1), copy, ...popups.slice(index + 1)] });
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
        <DropdownMenuItem disabled={popups.length >= MAX_POPUPS} onSelect={() => duplicatePopup(edits, popup)}>
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

export function PopupEditor({
  id,
  edits,
  onBack,
  onPreview,
}: {
  id: string;
  edits: Edits;
  onBack: () => void;
  /** Opens it in the preview again — after it was closed there, say. */
  onPreview: () => void;
}) {
  const [tab, setTab] = React.useState<"content" | "style">("content");
  const popup = edits.content.popups.find((candidate) => candidate.id === id);
  if (!popup) return null;

  const set = (change: Partial<Popup>) =>
    edits.change({ ...edits.content, popups: edits.content.popups.map((other) => (other.id === id ? { ...other, ...change } : other)) });
  const setSetting = (key: string, value: unknown) => set({ settings: { ...popup.settings, [key]: value } });
  const replace = (next: Popup) =>
    edits.change({ ...edits.content, popups: edits.content.popups.map((other) => (other.id === id ? next : other)) });
  const s = popup.settings;
  const hasButton = Boolean((s.button as LinkValue | null)?.href);
  const fields = (POPUP_FIELDS as readonly LeafFieldDef[]).filter(
    (field) =>
      isFieldActive(field, s) &&
      // The page behind is darkened or blurred only behind the box in the middle.
      (POPUP_STYLE_FOLD[field.key] !== "behind" || s.layout === "center") &&
      (field.key !== "buttonStyle" || hasButton) &&
      ((field.key !== "borderStyle" && field.key !== "borderColor") || Number(s.borderWidth) > 0),
  );

  const renderField = (field: LeafFieldDef) => {
    const inputId = `${id}-${field.key}`;
    const inline = field.kind === "toggle";
    return (
      <div key={field.key} className={inline ? "flex items-center justify-between gap-4" : "space-y-1.5"}>
        <Label htmlFor={inputId} className="text-xs">
          {field.label}
        </Label>
        <FieldControl field={field} value={s[field.key]} inputId={inputId} collections={[]} onChange={(next) => setSetting(field.key, next)} />
        {field.help && !inline ? <p className="text-muted-foreground text-xs">{field.help}</p> : null}
      </div>
    );
  };
  const remove = () => {
    edits.change({ ...edits.content, popups: edits.content.popups.filter((other) => other.id !== id) });
    onBack();
  };

  return (
    <div className="flex h-full flex-col">
      {/* The section editor's header: back, the name, then show / hide, duplicate, delete. */}
      <div className="flex items-center gap-1 border-b px-2 py-2">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium">{popup.name || "Pop-up"}</h2>
          <p className="text-muted-foreground truncate text-[11px]">Pop-up · {popupSummary(popup)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Show in preview"
          title="Show in preview"
          onClick={onPreview}
          disabled={!popupHasContent(popup)}
        >
          <MonitorPlayIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={popup.enabled ? "Switch off" : "Switch on"}
          title={popup.enabled ? "Switch off" : "Switch on"}
          onClick={() => set({ enabled: !popup.enabled })}
        >
          {popup.enabled ? <EyeIcon /> : <EyeOffIcon />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Duplicate pop-up"
          title="Duplicate"
          disabled={edits.content.popups.length >= MAX_POPUPS}
          onClick={() => duplicatePopup(edits, popup)}
        >
          <CopyIcon />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Delete pop-up" title="Delete" onClick={remove}>
          <Trash2Icon />
        </Button>
      </div>

      {/* Content | Style, as on a section: what it says and when, then how it looks. */}
      <div className="border-b px-4 py-2">
        <Tabs value={tab} onValueChange={(next) => setTab(next as "content" | "style")}>
          <TabsList className="w-full">
            <TabsTrigger value="content" className="flex-1">
              Content
            </TabsTrigger>
            <TabsTrigger value="style" className="flex-1">
              Style
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "style" ? (
        <PopupStyle
          popup={popup}
          fields={fields.filter((field) => field.group === "style")}
          renderField={renderField}
          onSettings={(change) => set({ settings: { ...popup.settings, ...change } })}
          onBox={(box) => replace(Object.keys(box).length ? { ...popup, box } : withoutBox(popup))}
          onHide={(hide) => replace(hide ? { ...popup, hide } : withoutHide(popup))}
          onReset={(change) => replace({ ...withoutBox(popup), settings: { ...popup.settings, ...change } })}
        />
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <p className="text-muted-foreground text-xs">A box that opens over the page — for an event, a new collection or the newsletter.</p>

          {!popup.enabled ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2 text-xs">
              <p>Switched off — visitors don’t see it. The preview still shows it, so you can finish it first.</p>
              <Button type="button" variant="outline" size="xs" onClick={() => set({ enabled: true })}>
                Switch on
              </Button>
            </div>
          ) : null}
          {!popupHasContent(popup) ? (
            <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              Add a heading, some text, a photograph, a button or the sign-up — an empty pop-up never opens.
            </p>
          ) : null}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-name`} className="text-xs">
                Name
              </Label>
              <Input id={`${id}-name`} value={popup.name} maxLength={60} onChange={(event) => set({ name: event.target.value })} className="h-8 text-xs" />
              <p className="text-muted-foreground text-xs">Only for this list — visitors never see it.</p>
            </div>
            {fields.filter((field) => field.group === "content").map(renderField)}
          </div>

          <Separator />
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Layout</h3>
            {fields.filter((field) => field.group === "layout").map(renderField)}
          </div>

          <Separator />
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">When it opens</h3>
            {fields.filter((field) => field.group === "advanced").map(renderField)}
            {s.trigger === "exit" ? (
              <p className="text-muted-foreground text-xs">
                When the pointer heads for the tabs or the address bar. Phones and tablets have no pointer, so there it does not open.
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">Closing it, or pressing its button, counts as seen.</p>
          </div>

          <Separator />
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Where it shows</h3>
            <PagesPicker id={id} value={popup.pages} onChange={(pages) => set({ pages })} />
            <div className="flex items-center justify-between gap-3 text-xs">
              <p className="text-muted-foreground">
                {popup.hide && Object.values(popup.hide).some(Boolean) ? "Not on every device." : "On every device."}
              </p>
              <Button type="button" variant="outline" size="xs" onClick={() => setTab("style")}>
                Choose devices
              </Button>
            </div>
          </div>

          <Separator />
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Dates</h3>
            <DateRange id={id} value={popup} onChange={(next) => set(next)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * One pop-up's Style tab — the section's Style tab: the same frame, the same groups
 * in the same order, then the pop-up's own
 * -------------------------------------------------------------------------- */

const FOLD_TITLE: Record<PopupStyleFold, string> = {
  background: "Background",
  spacing: "Spacing",
  border: "Border & shadow",
  images: "Images",
  size: "Size",
  behind: "Page behind it",
  close: "Close button",
  animation: "Animation",
};

/** The brand's light ground and dark text: what an empty colour means in a pop-up. */
const LIGHT = { background: "#ebe8e3", text: "#302f2d" };

function readableOn(background: string): string {
  return contrastRatio(background, LIGHT.text) >= contrastRatio(background, LIGHT.background) ? LIGHT.text : LIGHT.background;
}

function PopupStyle({
  popup,
  fields,
  renderField,
  onSettings,
  onBox,
  onHide,
  onReset,
}: {
  popup: Popup;
  /** The look's settings that apply now. */
  fields: LeafFieldDef[];
  renderField: (field: LeafFieldDef) => React.ReactNode;
  /** Several settings in one change, so none overwrites another. */
  onSettings: (change: Record<string, unknown>) => void;
  onBox: (box: PopupBox) => void;
  onHide: (hide: Popup["hide"] | undefined) => void;
  /** These settings, and no per-device sizes — one change. */
  onReset: (settings: Record<string, unknown>) => void;
}) {
  const { device } = useEditorDevice();
  const s = popup.settings;
  const layout = (s.layout as "center" | "corner" | "bar") ?? "center";
  const box = popup.box ?? {};
  const design = (s.design as DesignValue | undefined) ?? {};
  const getDesign = (path: readonly (string | number)[]) => getAt(design, path);
  const setDesign = (path: readonly (string | number)[], next: unknown) => onSettings({ design: setAt(design, path, next) });
  const setBox = <K extends keyof PopupBox>(key: K, value: PopupBox[K] | undefined) => {
    const next = { ...box };
    if (value && Object.keys(value).length) next[key] = value;
    else delete next[key];
    onBox(next);
  };

  const all = POPUP_FIELDS as readonly LeafFieldDef[];
  const differs = (key: string) => {
    const field = all.find((candidate) => candidate.key === key);
    return field ? s[key] !== undefined && JSON.stringify(s[key]) !== JSON.stringify(fieldDefault(field)) : false;
  };
  const inFold = (fold: PopupStyleFold) => fields.filter((field) => POPUP_STYLE_FOLD[field.key] === fold);
  const foldChanged = (fold: PopupStyleFold) =>
    Object.entries(POPUP_STYLE_FOLD).some(([key, each]) => each === fold && differs(key));

  const image = s.image as ImageRef | null | undefined;
  const placed = layout === "center" ? String(s.imagePosition ?? "top") : "top";
  const closeRoom = !image || (layout === "center" && (placed === "bottom" || placed === "side"));
  const defaults = popupDefaults(layout, !closeRoom);
  // As a section's: photo controls only where there is a photograph to shape.
  const photo = Boolean(image) && layout !== "bar";

  /* Background */
  const background = typeof s.background === "string" && s.background ? s.background : LIGHT.background;
  const text = typeof s.color === "string" && s.color ? s.color : LIGHT.text;
  const hardToRead = !design.background?.image && contrastRatio(background, text) < 4.5;

  /* Spacing: the device being edited; an empty side follows the larger screen, then the pop-up's own. */
  const ownPadding = box.padding?.[device] ?? {};
  const inherited = paddingOn({ padding: { ...box.padding, [device]: undefined } }, device, defaults.padding);
  const changePadding = (changes: Partial<Record<BoxSide, number | undefined>>) => {
    const sides: PopupSides = { ...ownPadding, ...changes };
    for (const side of POPUP_SIDES) if (sides[side] === undefined) delete sides[side];
    const padding = { ...box.padding };
    if (Object.keys(sides).length) padding[device] = sides;
    else delete padding[device];
    setBox("padding", padding);
  };
  const offsetHint = {
    center:
      s.vertical === "top" || s.vertical === "bottom"
        ? "From the top or bottom of the screen, and the least space kept at its sides."
        : "The least space kept at its sides on a narrow screen.",
    corner: "From the bottom and the side of the screen.",
    bar: "0: across the whole foot of the screen. More: floating above it.",
  }[layout];

  /* Size: the box in the middle has sizes and Custom; the corner box a width; the bar runs across. */
  const widthShown = (layout === "center" && s.width === "custom") || layout === "corner";

  const changed = {
    background: foldChanged("background") || Boolean(design.background),
    spacing: Boolean(box.padding || box.offset || box.gap),
    border: foldChanged("border") || Boolean(box.radius || design.images?.radius),
    size: foldChanged("size") || Boolean(box.width),
  };
  const anything =
    Object.keys(POPUP_STYLE_FOLD).some(differs) || Object.keys(box).length > 0 || Object.keys(design).length > 0;

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {/* The device being edited — the same switch as above the preview. */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">Settings marked with a device icon can differ on desktop, tablet and mobile.</p>
        <DeviceSwitch />
      </div>

      <div className="space-y-2">
        <Part title={FOLD_TITLE.background} changed={changed.background} defaultOpen={false}>
          <div className="space-y-4">
            {inFold("background")
              .filter((field) => field.key === "background")
              .map(renderField)}
            <BackgroundPart get={getDesign} set={setDesign} what="pop-up" />
            {inFold("background")
              .filter((field) => field.key !== "background")
              .map(renderField)}
            {hardToRead ? (
              <div
                role="status"
                className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                <p>The text may be hard to read on this background.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => onSettings({ color: readableOn(background) })}>
                  Use a readable text colour
                </Button>
              </div>
            ) : null}
          </div>
        </Part>

        <Part title={FOLD_TITLE.spacing} changed={changed.spacing} defaultOpen={false}>
          <div className="space-y-4">
            <SpacingBox
              title="Padding"
              values={{ top: ownPadding.top, right: ownPadding.right, bottom: ownPadding.bottom, left: ownPadding.left }}
              placeholders={{
                top: String(inherited.top),
                right: String(inherited.right),
                bottom: String(inherited.bottom),
                left: String(inherited.left),
              }}
              hint={
                layout === "bar"
                  ? "Space around the words and buttons. Keep some on the right for the close button."
                  : "Space around the words and buttons. The photograph runs to the edge — for space around it, see Images."
              }
              onChange={changePadding}
            />
            <ResponsiveSlider
              label="Distance from the screen's edge"
              hint={offsetHint}
              unit="px"
              min={POPUP_LIMITS.offset.min}
              max={POPUP_LIMITS.offset.max}
              step={1}
              value={box.offset}
              placeholder={String(defaults.offset)}
              onChange={(next) => setBox("offset", next)}
            />
            <ResponsiveSlider
              label="Space between"
              hint="Between the heading and text, and the buttons."
              unit="px"
              min={POPUP_LIMITS.gap.min}
              max={POPUP_LIMITS.gap.max}
              step={1}
              value={box.gap}
              placeholder={String(defaults.gap)}
              onChange={(next) => setBox("gap", next)}
            />
          </div>
        </Part>

        <Part title={FOLD_TITLE.border} changed={changed.border} defaultOpen={false}>
          <div className="space-y-4">
            <ResponsiveSlider
              label={photo ? "Pop-up corners" : "Rounded corners"}
              unit="px"
              min={POPUP_LIMITS.radius.min}
              max={POPUP_LIMITS.radius.max}
              step={1}
              value={box.radius}
              placeholder="0"
              onChange={(next) => setBox("radius", next)}
            />
            {photo ? (
              <Slider
                label="Photo corners"
                hint="Rounds the photograph — best with some space around it (Images)."
                unit="px"
                min={0}
                max={120}
                step={1}
                value={getDesign(["images", "radius"]) as number | undefined}
                placeholder="0"
                onChange={(next) => setDesign(["images", "radius"], next === 0 ? undefined : next)}
              />
            ) : null}
            {inFold("border").map(renderField)}
          </div>
        </Part>

        <DesignControls
          value={design}
          parts={["typography", "buttons"]}
          contents={{
            heading: Boolean(String(s.heading ?? "").trim()),
            text: Boolean(String(s.text ?? "").trim()),
            button: Boolean((s.button as LinkValue | null)?.href),
          }}
          onChange={(next) => onSettings({ design: next })}
        />

        {photo ? (
          <Part title={FOLD_TITLE.images} changed={foldChanged("images")} defaultOpen={false}>
            <div className="space-y-4">{inFold("images").map(renderField)}</div>
          </Part>
        ) : null}

        {layout !== "bar" ? (
          <Part title={FOLD_TITLE.size} changed={changed.size} defaultOpen={false}>
            <div className="space-y-4">
              {inFold("size").map(renderField)}
              {widthShown ? (
                <ResponsiveSlider
                  label="Width"
                  hint={layout === "corner" ? "Empty: 384px. It never gets wider than the screen." : "It never gets wider than the screen."}
                  unit="px"
                  min={POPUP_LIMITS.width.min}
                  max={POPUP_LIMITS.width.max}
                  step={10}
                  value={box.width}
                  placeholder={String(defaults.width)}
                  onChange={(next) => setBox("width", next)}
                />
              ) : null}
            </div>
          </Part>
        ) : null}

        {layout === "center" ? (
          <Part title={FOLD_TITLE.behind} changed={foldChanged("behind")} defaultOpen={false}>
            <div className="space-y-4">{inFold("behind").map(renderField)}</div>
          </Part>
        ) : null}

        <Part title={FOLD_TITLE.close} changed={foldChanged("close")} defaultOpen={false}>
          <div className="space-y-4">{inFold("close").map(renderField)}</div>
        </Part>

        <Part title={FOLD_TITLE.animation} changed={foldChanged("animation")} defaultOpen={false}>
          <div className="space-y-4">{inFold("animation").map(renderField)}</div>
        </Part>

        {/* Last, as on a section. */}
        <DesignControls
          value={design}
          parts={["visibility"]}
          visibility={{
            hidden: DEVICES.filter((each) => popup.hide?.[each]),
            onChange: (hidden) => onHide(hidden.length ? Object.fromEntries(hidden.map((each) => [each, true])) : undefined),
          }}
          onChange={(next) => onSettings({ design: next })}
        />
      </div>

      {anything ? (
        <>
          <Separator />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onReset({
                ...Object.fromEntries(all.filter((field) => POPUP_STYLE_FOLD[field.key]).map((field) => [field.key, fieldDefault(field)])),
                design: {},
              })
            }
          >
            <RotateCcwIcon />
            Reset style
          </Button>
        </>
      ) : null}
    </div>
  );
}

/** A pop-up with no per-device sizes — the key gone, not empty, so it reads back the same. */
function withoutBox(popup: Popup): Popup {
  const rest = { ...popup };
  delete rest.box;
  return rest;
}

/** Shown on every device — the key gone, as a read leaves it. */
function withoutHide(popup: Popup): Popup {
  const rest = { ...popup };
  delete rest.hide;
  return rest;
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
