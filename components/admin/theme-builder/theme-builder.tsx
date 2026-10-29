"use client";

import {
  ExternalLinkIcon,
  InfoIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  Redo2Icon,
  RotateCcwIcon,
  SendIcon,
  TriangleAlertIcon,
  Undo2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useUnsavedChangesWarning } from "@/components/admin/save-bar";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { PREVIEW_MESSAGE } from "@/components/page-builder/preview-bridge";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { RequestError, themeActionRequest, themeSaveRequest } from "@/lib/admin/queries";
import type { Device } from "@/lib/page-builder/design";
import type { ThemeLayoutContent } from "@/lib/theme-builder/layout";
import { cn } from "@/lib/utils/cn";

import { DeviceSwitch, DeviceViewport, EditorDeviceContext, PaneSwitch } from "../page-builder/editor-device";
import { EditorLookupsContext, type EditorLookups } from "../page-builder/field-controls";

import * as ops from "./ops";
import { ElementEditor, FooterPanel, GlobalPanel, HeaderPanel, type Edits } from "./panels";
import { PopupEditor, PopupsPanel } from "./promo-panels";

export type ThemeTab = "header" | "footer" | "site" | "popups";

/**
 * THE THEME BUILDER — the site's header and footer, composed from elements, edited
 * beside a live preview of a real page. The page builder's contract, for the shell
 * every page shares:
 *
 *  - every change is saved as a DRAFT a moment after the editor stops — no Save button;
 *  - the preview shows that draft, at the chosen device's real width;
 *  - nothing a visitor sees changes until Publish, and the version Publish replaces can
 *    be loaded back.
 *
 * Before the first Publish the site still draws its original header and footer, and
 * the editor opens on a layout that reproduces them — so the first change starts from
 * what is on the site, and the page says so plainly.
 */

type History = { past: ThemeLayoutContent[]; present: ThemeLayoutContent; future: ThemeLayoutContent[] };
/** `signedOut`: the session ended — saving waits for the editor to sign in again. */
type SaveState = "saved" | "saving" | "error" | "conflict" | "signedOut";

export function ThemeBuilder({
  initial,
  previewPages,
  lookups,
}: {
  initial: {
    content: ThemeLayoutContent;
    revision: number;
    hasPublished: boolean;
    hasUnpublishedChanges: boolean;
    canRollback: boolean;
    publishedInvalid: boolean;
  };
  previewPages: { handle: string; title: string }[];
  lookups: EditorLookups;
}) {
  const router = useRouter();
  const [history, setHistory] = React.useState<History>({ past: [], present: initial.content, future: [] });
  const content = history.present;

  const [tab, setTab] = React.useState<ThemeTab>("header");
  const [selected, setSelected] = React.useState<string | null>(null);
  // The pop-up being edited — the preview opens it (`#popup-<id>`, see `Popups`).
  const [popup, setPopup] = React.useState<string | null>(null);
  const [device, setDevice] = React.useState<Device>("d");
  // Below 1024px: the settings or the preview, one at a time (`PaneSwitch`).
  const [pane, setPane] = React.useState<"edit" | "preview">("edit");
  const deviceState = React.useMemo(() => ({ device, setDevice }), [device]);
  const [previewPage, setPreviewPage] = React.useState(previewPages[0]?.handle ?? "home");

  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [hasPublished, setHasPublished] = React.useState(initial.hasPublished);
  const [unpublished, setUnpublished] = React.useState(initial.hasUnpublishedChanges);
  const [busy, setBusy] = React.useState<"publish" | "discard" | "rollback" | null>(null);
  const [confirm, setConfirm] = React.useState<"discard" | "rollback" | null>(null);

  const revisionRef = React.useRef(initial.revision);
  // The last saved content: in state for rendering ("Unsaved changes"), in a ref for the
  // save itself, which runs outside render.
  const [savedJson, setSavedJson] = React.useState(() => JSON.stringify(initial.content));
  const savedRef = React.useRef(savedJson);
  const contentRef = React.useRef(content);
  const inflightRef = React.useRef<Promise<boolean> | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  React.useEffect(() => {
    contentRef.current = content;
  });

  const dirty = JSON.stringify(content) !== savedJson;
  useUnsavedChangesWarning(dirty || saveState === "saving" || saveState === "error");

  /* ---- edits, through history ---- */

  const change = React.useCallback((next: ThemeLayoutContent) => {
    setHistory((current) => ({ past: [...current.past, current.present].slice(-60), present: next, future: [] }));
  }, []);
  const undo = React.useCallback(() => {
    setHistory((current) =>
      current.past.length
        ? { past: current.past.slice(0, -1), present: current.past.at(-1)!, future: [current.present, ...current.future] }
        : current,
    );
  }, []);
  const redo = React.useCallback(() => {
    setHistory((current) =>
      current.future.length
        ? { past: [...current.past, current.present], present: current.future[0]!, future: current.future.slice(1) }
        : current,
    );
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      // Typing in a field keeps the field's own undo.
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // The colours being saved here are offered in this editor's pickers straight away.
  const liveLookups = React.useMemo(
    () => ({ ...lookups, savedColours: content.global.colors }),
    [lookups, content.global.colors],
  );

  const edits: Edits = {
    content,
    change,
    select: setSelected,
    add: (at, type) => {
      const result = ops.insertElement(content, at, type);
      if (!result.id) {
        toast.error("This place is full", { description: "Remove an element first, or add it somewhere else." });
        return;
      }
      change(result.content);
      setSelected(result.id);
    },
    remove: (id) => {
      const before = content;
      change(ops.removeElement(content, id));
      toast("Element removed", { action: { label: "Undo", onClick: () => change(before) } });
    },
    duplicate: (id) => change(ops.duplicateElement(content, id)),
    shift: (id, delta) => change(ops.shiftElement(content, id, delta)),
    move: (id, to) => change(ops.moveElement(content, id, to)),
  };

  /* ---- saving ---- */

  // The layout a save last failed on: autosave does not resend it by itself (a failure
  // would otherwise retry every 0.8s for as long as it lasts); a new change, or
  // "Try again", does.
  const failedJsonRef = React.useRef<string | null>(null);

  const save = React.useCallback(async (): Promise<boolean> => {
    if (inflightRef.current) await inflightRef.current;
    const snapshot = contentRef.current;
    const json = JSON.stringify(snapshot);
    if (json === savedRef.current) return true;

    const run = (async () => {
      setSaveState("saving");
      try {
        const result = await themeSaveRequest({ baseRevision: revisionRef.current, content: snapshot });
        revisionRef.current = result.revision;
        savedRef.current = json;
        setSavedJson(json);
        setSaveState("saved");
        setSaveError(null);
        setUnpublished(true);
        failedJsonRef.current = null;
        return true;
      } catch (error) {
        failedJsonRef.current = json;
        const conflict = error instanceof RequestError && error.status === 409;
        const signedOut = error instanceof RequestError && error.status === 401;
        setSaveState(conflict ? "conflict" : signedOut ? "signedOut" : "error");
        setSaveError(error instanceof Error ? error.message : "Could not save.");
        return false;
      }
    })();
    inflightRef.current = run;
    const ok = await run;
    inflightRef.current = null;
    return ok;
  }, []);

  // LIVE PREVIEW: the layout on screen goes to the preview a moment after each change,
  // drawn there by the server without waiting for the save — see `LivePreview`.
  const sendContent = React.useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: PREVIEW_MESSAGE.content, content: contentRef.current }, window.location.origin);
  }, []);
  React.useEffect(() => {
    const timer = window.setTimeout(sendContent, 150);
    return () => window.clearTimeout(timer);
  }, [content, sendContent]);

  React.useEffect(() => {
    if (!dirty || saveState === "conflict" || saveState === "signedOut") return;
    if (JSON.stringify(content) === failedJsonRef.current) return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [content, dirty, saveState, save]);

  /* ---- publish, discard, previous ---- */

  async function publish() {
    setBusy("publish");
    try {
      if (!(await save())) return;
      const result = await themeActionRequest("themePublish", revisionRef.current);
      revisionRef.current = result.revision;
      setHasPublished(true);
      setUnpublished(false);
      toast.success("Published", { description: "Your changes reach every page within about half a minute." });
    } catch (error) {
      toast.error("Could not publish", { description: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  async function act(action: "discard" | "rollback") {
    setBusy(action);
    try {
      await themeActionRequest(action === "discard" ? "themeDiscard" : "themeRollback", revisionRef.current);
      toast.success(action === "discard" ? "Changes discarded" : "Previous version loaded", {
        description: action === "rollback" ? "It is your draft now. Check it, then publish to put it back on the site." : undefined,
      });
      router.refresh();
    } catch (error) {
      toast.error("That did not work", { description: error instanceof Error ? error.message : undefined });
      throw error;
    } finally {
      setBusy(null);
    }
  }

  /* ---- render ---- */

  const status =
    saveState === "conflict"
      ? "Edited elsewhere"
      : saveState === "signedOut"
        ? "Signed out — not saved"
      : saveState === "error"
        ? "Not saved"
        : saveState === "saving"
          ? "Saving…"
          : dirty
            ? "Unsaved changes"
            : "Draft saved";

  const badge = !hasPublished
    ? { label: "Not published", tone: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300" }
    : unpublished || dirty
      ? { label: "Changes not published", tone: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300" }
      : { label: "Live", tone: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };

  const editingPopup = tab === "popups" && popup && content.popups.some((candidate) => candidate.id === popup) ? popup : null;
  const previewHash = editingPopup ? `popup-${editingPopup}` : tab === "footer" ? "site-footer" : "site-header";
  const previewSrc = `/preview/theme?page=${encodeURIComponent(previewPage)}#${previewHash}`;

  return (
    <EditorLookupsContext.Provider value={liveLookups}>
      <EditorDeviceContext.Provider value={deviceState}>
        <div className="-m-4 flex h-[calc(100svh-3.5rem)] flex-col md:-m-6">
          {/* ---------------- top bar ---------------- */}
          <div className="bg-background flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">Appearance</h1>
              <p className="text-muted-foreground truncate text-[11px]">Header, footer, site style and pop-ups</p>
            </div>
            <Badge variant="outline" className={badge.tone}>
              {badge.label}
            </Badge>

            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "text-muted-foreground hidden items-center gap-1 text-xs sm:inline-flex",
                  (saveState === "error" || saveState === "conflict") && "text-destructive",
                )}
                aria-live="polite"
                title={saveError ?? undefined}
              >
                {saveState === "saving" && <Loader2Icon className="size-3 animate-spin" />}
                {status}
              </span>
              <div className="flex items-center" role="group" aria-label="History">
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!history.past.length} onClick={undo}>
                  <Undo2Icon />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={redo}>
                  <Redo2Icon />
                </Button>
              </div>
              <DeviceSwitch className="hidden lg:flex" />
              <Select value={previewPage} onValueChange={setPreviewPage}>
                <SelectTrigger className="hidden h-8 w-40 text-xs lg:flex" aria-label="Page shown in the preview">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {previewPages.map((page) => (
                    <SelectItem key={page.handle} value={page.handle} className="text-xs">
                      {page.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button asChild variant="outline" size="sm">
                <a href={previewSrc} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon />
                  Preview
                </a>
              </Button>
              <Button type="button" size="sm" disabled={busy !== null || saveState === "conflict"} onClick={() => void publish()}>
                {busy === "publish" ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
                Publish
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="More actions">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={!unpublished && !dirty} onSelect={() => setConfirm("discard")}>
                    <RotateCcwIcon />
                    Discard unpublished changes
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!initial.canRollback} onSelect={() => setConfirm("rollback")}>
                    <Undo2Icon />
                    Load previously published version
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ---------------- notices ---------------- */}
          {!hasPublished ||
          saveState === "conflict" ||
          saveState === "error" ||
          saveState === "signedOut" ||
          initial.publishedInvalid ? (
            <div className="space-y-1 border-b px-3 py-2 text-xs">
              {!hasPublished ? (
                <p className="text-muted-foreground flex items-center gap-2">
                  <InfoIcon className="size-3.5 shrink-0" />
                  Visitors still see the original header and footer, and no pop-ups. What you arrange here goes live when you press Publish.
                </p>
              ) : null}
              {saveState === "conflict" ? (
                <p className="text-destructive flex items-center gap-2">
                  <TriangleAlertIcon className="size-3.5 shrink-0" />
                  The header, footer and pop-ups were saved somewhere else since you opened them. Your last changes were not saved.
                  <Button type="button" size="xs" variant="outline" onClick={() => router.refresh()}>
                    Load latest
                  </Button>
                </p>
              ) : null}
              {saveState === "signedOut" ? (
                <p className="text-destructive flex flex-wrap items-center gap-2">
                  <TriangleAlertIcon className="size-3.5 shrink-0" />
                  You were signed out, so your latest changes are not saved yet. Sign in again in a new tab — this page
                  keeps them — then save.
                  <Button asChild size="xs" variant="outline">
                    <a href={`${STAFF_LOGIN_PATH}?from=${encodeURIComponent(window.location.pathname)}`} target="_blank" rel="noopener">
                      Sign in again
                    </a>
                  </Button>
                  <Button type="button" size="xs" onClick={() => void save()}>
                    Save now
                  </Button>
                </p>
              ) : null}
              {saveState === "error" ? (
                <p className="text-destructive flex items-center gap-2">
                  <TriangleAlertIcon className="size-3.5 shrink-0" />
                  {saveError ?? "Could not save."}
                  <Button type="button" size="xs" variant="outline" onClick={() => void save()}>
                    Try again
                  </Button>
                </p>
              ) : null}
              {initial.publishedInvalid ? (
                <p className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                  <TriangleAlertIcon className="size-3.5 shrink-0" />
                  The live version cannot be read, so visitors see the original header and footer. Publishing fixes it.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ---------------- editor + preview ---------------- */}
          <div className="grid min-h-0 flex-1 lg:grid-cols-[22rem_1fr]">
            <aside className={cn("bg-background flex min-h-0 flex-col border-r", pane === "preview" && "max-lg:hidden")}>
              {selected && ops.locate(content, selected) ? (
                <ElementEditor id={selected} edits={edits} onBack={() => setSelected(null)} />
              ) : editingPopup ? (
                <PopupEditor id={editingPopup} edits={edits} onBack={() => setPopup(null)} />
              ) : (
                <>
                  <div className="border-b px-4 py-2">
                    <Tabs value={tab} onValueChange={(next) => setTab(next as ThemeTab)}>
                      <TabsList className="w-full">
                        <TabsTrigger value="header" className="flex-1">
                          Header
                        </TabsTrigger>
                        <TabsTrigger value="footer" className="flex-1">
                          Footer
                        </TabsTrigger>
                        <TabsTrigger value="site" className="flex-1">
                          Site style
                        </TabsTrigger>
                        <TabsTrigger value="popups" className="flex-1">
                          Pop-ups
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {tab === "header" ? (
                      <HeaderPanel edits={edits} />
                    ) : tab === "popups" ? (
                      <PopupsPanel edits={edits} onOpen={setPopup} />
                    ) : tab === "site" ? (
                      <GlobalPanel edits={edits} />
                    ) : (
                      <FooterPanel
                        edits={edits}
                        addColumn={() => change(ops.addColumn(content))}
                        removeColumn={(index) => {
                          const before = content;
                          change(ops.removeColumn(content, index));
                          toast("Column removed", { action: { label: "Undo", onClick: () => change(before) } });
                        }}
                        shiftColumn={(index, delta) => change(ops.shiftColumn(content, index, delta))}
                      />
                    )}
                  </div>
                </>
              )}
            </aside>

            <div className={cn("bg-muted/40 min-h-0", pane === "preview" ? "flex" : "hidden lg:flex")}>
              <DeviceViewport device={device}>
                {(style) => (
                  <iframe
                    ref={iframeRef}
                    src={previewSrc}
                    title="Preview of the header, footer and pop-ups"
                    onLoad={sendContent}
                    className={cn("border-0 bg-white", device !== "d" && "rounded-lg border shadow-sm")}
                    style={style}
                  />
                )}
              </DeviceViewport>
            </div>
          </div>

          <PaneSwitch pane={pane} onChange={setPane} />

          <ConfirmDialog
            open={confirm !== null}
            onOpenChange={(open) => !open && setConfirm(null)}
            title={confirm === "rollback" ? "Load the previously published version?" : "Discard unpublished changes?"}
            description={
              confirm === "rollback"
                ? "Your draft is replaced by the header, footer and pop-ups that were live before the last publish. Nothing changes on the site until you publish."
                : hasPublished
                  ? "Your draft goes back to what is live now. Changes since the last publish are lost."
                  : "Your draft goes back to the original header and footer, with no pop-ups. Your changes are lost."
            }
            confirmLabel={confirm === "rollback" ? "Load it" : "Discard changes"}
            destructive={confirm === "discard"}
            onConfirm={() => act(confirm ?? "discard")}
          />
        </div>
      </EditorDeviceContext.Provider>
    </EditorLookupsContext.Provider>
  );
}
