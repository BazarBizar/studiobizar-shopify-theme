"use client";

import {
  CopyPlusIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  HistoryIcon,
  Loader2Icon,
  MonitorIcon,
  RotateCcwIcon,
  Redo2Icon,
  SendIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
  Undo2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { PREVIEW_MESSAGE } from "@/components/page-builder/preview-bridge";
import {
  builderActionRequest,
  draftRevisionRequest,
  RequestError,
  saveDraftRequest,
} from "@/lib/admin/queries";
import {
  duplicateSection,
  publishProblems,
  type DocumentContent,
  type PublishProblem,
} from "@/lib/page-builder/document";
import { sectionFromPreset, type SectionPreset } from "@/lib/page-builder/presets";
import { cn } from "@/lib/utils/cn";

import { PageEditorBar } from "@/components/admin/pages-table/page-editor-bar";

import { DuplicatePageDialog } from "./create-page-dialog";
import { EditorLookupsContext, type CollectionOption, type EditorLookups } from "./field-controls";
import { historyReducer, initialHistory, insertionIndex } from "./reducer";
import { PageSettingsEditor, SectionEditor } from "./section-editor";
import { SectionList } from "./section-list";

/**
 * The page builder: sections on the left, the real page on the right.
 *
 * SAVING. Every change is saved as a DRAFT a moment after the operator stops —
 * there is no Save button to forget — and the preview re-renders from what was
 * saved. Drafts never reach the storefront; only Publish does. Saves run one at a
 * time, each naming the revision it was made from, so a second tab or a colleague
 * produces a clear "reload" rather than a silent overwrite.
 *
 * Discard, restore and a conflict reload all go through `router.refresh()`. The
 * server component keys this component by revision, so a refresh with a newer
 * document mounts a fresh editor instead of trying to merge into this one.
 */

type Panel = { kind: "list" } | { kind: "section"; id: string } | { kind: "page" };
type SaveState = "idle" | "saving" | "error" | "conflict";
type Busy = null | "publish" | "discard" | "rollback";
type Confirm = null | "discard" | "rollback";

export type PageBuilderProps = {
  page: {
    id: string;
    param: string;
    title: string;
    handle: string;
    isPublished: boolean;
  };
  initial: {
    content: DocumentContent;
    revision: number;
    hasPublished: boolean;
    hasUnpublishedChanges: boolean;
    canRollback: boolean;
    dropped: number;
    publishedInvalid: boolean;
  };
  collections: CollectionOption[];
  /** Link destinations and FAQ categories, for the form's pick-lists. */
  lookups: EditorLookups;
  publicPath: string;
};

/** Quiet long enough to be a pause, short enough that the preview feels live. */
const AUTOSAVE_MS = 1200;

export function PageBuilder({ page, initial, collections, lookups, publicPath }: PageBuilderProps) {
  const router = useRouter();

  const [history, dispatch] = React.useReducer(historyReducer, initial.content, initialHistory);
  const content = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  /**
   * Bumped by every undo and redo, and part of the section form's key. The rich
   * text editor reads its value once, when it mounts — so after an undo the form
   * is remounted from the restored document, or the editor would go on showing
   * (and on the next keystroke, re-saving) the text that was just undone.
   */
  const [epoch, setEpoch] = React.useState(0);
  // Content or Style. Held here, not in the editor, which remounts on undo/redo —
  // an undo while styling should leave you on the Style tab.
  const [editorTab, setEditorTab] = React.useState<"content" | "style">("content");
  const step = React.useCallback((kind: "undo" | "redo") => {
    dispatch({ kind });
    setEpoch((value) => value + 1);
  }, []);
  const [panel, setPanel] = React.useState<Panel>({ kind: "list" });
  const [savedJson, setSavedJson] = React.useState(() => JSON.stringify(initial.content));
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [hasUnpublished, setHasUnpublished] = React.useState(initial.hasUnpublishedChanges);
  const [hasPublished, setHasPublished] = React.useState(initial.hasPublished);
  const [isLive, setIsLive] = React.useState(page.isPublished);
  const [canRollback, setCanRollback] = React.useState(initial.canRollback);
  const [problems, setProblems] = React.useState<PublishProblem[]>([]);
  const [busy, setBusy] = React.useState<Busy>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [viewport, setViewport] = React.useState<"desktop" | "mobile">("desktop");
  const [duplicating, setDuplicating] = React.useState(false);

  const contentJson = React.useMemo(() => JSON.stringify(content), [content]);
  const dirty = contentJson !== savedJson;

  /* ---- refs the async save path reads; written only in effects and handlers ---- */
  const contentRef = React.useRef(content);
  const revisionRef = React.useRef(initial.revision);
  const inflightRef = React.useRef<Promise<boolean> | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    contentRef.current = content;
  }, [content]);



  const post = React.useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, []);

  // What was last saved, and whether saving is blocked by a conflict — read by the
  // leave paths below, which run outside render.
  const savedJsonRef = React.useRef(savedJson);
  const conflictRef = React.useRef(false);
  React.useEffect(() => {
    savedJsonRef.current = savedJson;
  }, [savedJson]);

  /* ---- saving ---- */

  const flush = React.useCallback(async (): Promise<boolean> => {
    if (inflightRef.current) await inflightRef.current;

    const snapshot = contentRef.current;
    const json = JSON.stringify(snapshot);

    const run = (async () => {
      setSaveState("saving");
      try {
        const result = await saveDraftRequest({ id: page.id, baseRevision: revisionRef.current, content: snapshot });
        revisionRef.current = result.revision;
        // Set at once, not only through the effect below: a leave that follows this
        // save must see it as saved, or the unmount would send it a second time.
        savedJsonRef.current = json;
        setSavedJson(json);
        setHasUnpublished(result.hasUnpublishedChanges);
        setSaveState("idle");
        setSaveError(null);
        post({ type: PREVIEW_MESSAGE.refresh });
        return true;
      } catch (error) {
        if (error instanceof RequestError && error.code === "CONFLICT") {
          setSaveState("conflict");
        } else {
          setSaveState("error");
          setSaveError(error instanceof Error ? error.message : "Could not save.");
        }
        return false;
      }
    })();

    inflightRef.current = run;
    const ok = await run;
    inflightRef.current = null;
    return ok;
  }, [page.id, post]);

  React.useEffect(() => {
    conflictRef.current = saveState === "conflict";
  }, [saveState]);

  /**
   * Leaving the editor — the Settings tab, the back arrow — saves what is on
   * screen first. Without this, an edit made in the last second before leaving
   * died with the autosave timer when the editor unmounted. False means the save
   * failed; the caller stays, and the banner says why.
   */
  const leave = React.useCallback(async (): Promise<boolean> => {
    const unsaved = JSON.stringify(contentRef.current) !== savedJsonRef.current;
    if (!unsaved && !inflightRef.current) return true;
    if (conflictRef.current) return false;
    const ok = await flush();
    if (!ok) toast.error("Your latest changes are not saved yet", { description: "Stay on this page and try again." });
    return ok;
  }, [flush]);

  /**
   * And the way out no button covers — a sidebar link, a breadcrumb: if the
   * editor unmounts with unsaved changes, send them anyway. The panel is a single
   * page app, so the request completes after this component is gone.
   */
  React.useEffect(() => {
    const content = contentRef;
    const saved = savedJsonRef;
    const conflict = conflictRef;
    const revision = revisionRef;
    return () => {
      if (conflict.current || JSON.stringify(content.current) === saved.current) return;
      void saveDraftRequest({ id: page.id, baseRevision: revision.current, content: content.current }).catch(() => undefined);
    };
  }, [page.id]);

  /**
   * Is this the version that is really there? Back and Forward restore the editor
   * from the router cache, as it was rendered on the last visit — possibly before
   * the saves made since. Ask once on open; if the page has moved on, reload it
   * (the screen is keyed by revision, so that mounts a fresh editor).
   */
  React.useEffect(() => {
    let cancelled = false;
    draftRevisionRequest(page.id)
      .then(({ revision }) => {
        if (!cancelled && revision !== initial.revision) router.refresh();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [page.id, initial.revision, router]);

  // Autosave: a pause after the last change. A conflict stops it — saving over
  // someone else's newer draft is exactly what the conflict is there to prevent.
  React.useEffect(() => {
    if (!dirty || saveState === "conflict") return;
    const timer = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [contentJson, dirty, saveState, flush]);

  React.useEffect(() => {
    if (!dirty && saveState !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saveState]);

  /**
   * Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) — except while typing in a field,
   * where the browser's own undo for that field is what the operator means.
   */
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const redo = (key === "z" && event.shiftKey) || key === "y";
      if (key !== "z" && !redo) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")) return;

      event.preventDefault();
      step(redo ? "redo" : "undo");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step]);

  /* ---- preview ---- */

  const selectedId = panel.kind === "section" ? panel.id : null;

  React.useEffect(() => {
    post({ type: PREVIEW_MESSAGE.select, id: selectedId });
  }, [selectedId, post]);

  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; id?: unknown } | null;
      if (data?.type === PREVIEW_MESSAGE.clicked && typeof data.id === "string") {
        setPanel({ kind: "section", id: data.id });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  /* ---- section actions ---- */

  const addSection = (preset: SectionPreset) => {
    const section = sectionFromPreset(preset);
    dispatch({ kind: "insert", section, index: insertionIndex(content, selectedId) });
    setPanel({ kind: "section", id: section.id });
  };

  const duplicate = (id: string) => {
    const index = content.sections.findIndex((section) => section.id === id);
    if (index < 0) return;
    const copy = duplicateSection(content.sections[index]!);
    dispatch({ kind: "insert", section: copy, index: index + 1 });
    setPanel({ kind: "section", id: copy.id });
  };

  /** No confirmation dialog — a toast with Undo is faster and just as safe. */
  const remove = (id: string) => {
    const index = content.sections.findIndex((section) => section.id === id);
    const section = content.sections[index];
    if (!section) return;

    dispatch({ kind: "remove", id });
    if (selectedId === id) setPanel({ kind: "list" });

    toast("Section deleted", {
      action: { label: "Undo", onClick: () => dispatch({ kind: "insert", section, index }) },
    });
  };

  /* ---- publishing ---- */

  const incomplete = React.useMemo(() => publishProblems(content), [content]);
  const incompleteIds = React.useMemo(() => new Set(incomplete.map((problem) => problem.sectionId)), [incomplete]);

  async function publishNow() {
    setBusy("publish");
    setProblems([]);

    try {
      // Whatever is typed but not yet saved goes first, so what is published is
      // exactly what is on screen.
      if (dirty || inflightRef.current) {
        const saved = await flush();
        if (!saved) return;
      }

      const result = await builderActionRequest("builderPublish", {
        id: page.id,
        baseRevision: revisionRef.current,
      });
      revisionRef.current = result.revision;

      setCanRollback(hasPublished);
      // Only a FIRST publish makes a page visible — the server does the same. After
      // that, visibility is the page's Settings, and publishing content leaves it be.
      if (!hasPublished) setIsLive(true);
      setHasPublished(true);
      setHasUnpublished(false);
      // Shopify takes up to about half a minute to serve a change. Saying so stops
      // someone reloading at once and concluding the publish failed. A page published
      // for the first time is in no menu yet — say that too, with the way there.
      toast.success("Published", {
        description: hasPublished
          ? `${publicPath} shows it within about half a minute.`
          : `${publicPath} is live within about half a minute. Add it to the site’s navigation under Menus.`,
        ...(hasPublished ? {} : { action: { label: "Menus", onClick: () => router.push("/admin/menus") } }),
      });
    } catch (error) {
      if (error instanceof RequestError && Array.isArray(error.detail.problems)) {
        const found = error.detail.problems as PublishProblem[];
        setProblems(found);
        if (found[0]) setPanel({ kind: "section", id: found[0].sectionId });
        toast.error("Not published", { description: "Some sections still need content." });
      } else if (error instanceof RequestError && error.code === "CONFLICT") {
        setSaveState("conflict");
      } else {
        toast.error("Could not publish", {
          description: error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    } finally {
      setBusy(null);
    }
  }

  // The dialog stays open with its spinner until this settles — the panel's rule
  // for confirmations (ConfirmDialog) — then closes itself.
  async function runConfirmed(action: NonNullable<Confirm>) {
    setBusy(action);

    try {
      await builderActionRequest(action === "discard" ? "builderDiscard" : "builderRollback", {
        id: page.id,
        baseRevision: revisionRef.current,
      });
      toast.success(action === "discard" ? "Changes discarded" : "Previous version loaded", {
        description: action === "rollback" ? "It is your draft now. Check it, then publish to put it back on the site." : undefined,
      });
      router.refresh();
    } catch (error) {
      if (error instanceof RequestError && error.code === "CONFLICT") setSaveState("conflict");
      else toast.error("That did not work", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  /* ---- render ---- */

  const selectedSection =
    panel.kind === "section" ? content.sections.find((section) => section.id === panel.id) : undefined;

  const status =
    saveState === "conflict"
      ? "Edited elsewhere"
      : saveState === "error"
        ? "Not saved"
        : saveState === "saving"
          ? "Saving…"
          : dirty
            ? "Unsaved changes"
            : "Draft saved";

  const previewSrc = `/preview/pages/${page.param}`;
  const canPublish = busy === null && saveState !== "conflict" && (dirty || hasUnpublished || !hasPublished);

  return (
    <EditorLookupsContext.Provider value={lookups}>
      <div className="-m-4 flex h-[calc(100svh-3.5rem)] flex-col md:-m-6">
        {/* ---------------- top bar ---------------- */}
        <PageEditorBar
          title={page.title}
          path={publicPath}
          param={page.param}
          active="content"
          isPublished={isLive}
          content={!hasPublished ? "draft" : hasUnpublished || dirty ? "changes" : "published"}
          onLeave={leave}
        >
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
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                disabled={!canUndo}
                onClick={() => step("undo")}
              >
                <Undo2Icon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                disabled={!canRedo}
                onClick={() => step("redo")}
              >
                <Redo2Icon />
              </Button>
            </div>

            <div className="bg-muted hidden rounded-md p-0.5 lg:flex" role="group" aria-label="Preview width">
              <Button
                type="button"
                variant={viewport === "desktop" ? "outline" : "ghost"}
                size="icon-xs"
                aria-label="Desktop preview"
                aria-pressed={viewport === "desktop"}
                onClick={() => setViewport("desktop")}
              >
                <MonitorIcon />
              </Button>
              <Button
                type="button"
                variant={viewport === "mobile" ? "outline" : "ghost"}
                size="icon-xs"
                aria-label="Mobile preview"
                aria-pressed={viewport === "mobile"}
                onClick={() => setViewport("mobile")}
              >
                <SmartphoneIcon />
              </Button>
            </div>

            <Button asChild variant="outline" size="sm">
              <a href={previewSrc} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon />
                Preview
              </a>
            </Button>

            <Button type="button" size="sm" disabled={!canPublish} onClick={() => void publishNow()}>
              {busy === "publish" ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              Publish
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="More page actions">
                  <EllipsisVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {isLive && hasPublished && (
                  <DropdownMenuItem asChild>
                    <a href={publicPath} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon />
                      View live page
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={busy !== null || saveState === "conflict"} onSelect={() => setDuplicating(true)}>
                  <CopyPlusIcon />
                  Duplicate page
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!hasPublished || (!hasUnpublished && !dirty) || busy !== null}
                  onSelect={() => setConfirm("discard")}
                >
                  <RotateCcwIcon />
                  Discard unpublished changes
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canRollback || busy !== null} onSelect={() => setConfirm("rollback")}>
                  <HistoryIcon />
                  Load previously published version
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </PageEditorBar>

        {/* ---------------- notices ---------------- */}
        {(saveState === "conflict" || saveState === "error" || initial.dropped > 0 || initial.publishedInvalid) && (
          <div className="space-y-1 border-b px-3 py-2 text-xs">
            {saveState === "conflict" && (
              <p className="text-destructive flex items-center gap-2">
                <TriangleAlertIcon className="size-3.5 shrink-0" />
                This page was saved somewhere else since you opened it. Your last changes were not saved.
                <Button type="button" size="xs" variant="outline" onClick={() => router.refresh()}>
                  Load latest
                </Button>
              </p>
            )}
            {saveState === "error" && (
              <p className="text-destructive flex items-center gap-2">
                <TriangleAlertIcon className="size-3.5 shrink-0" />
                {saveError ?? "Could not save."}
                <Button type="button" size="xs" variant="outline" onClick={() => void flush()}>
                  Try again
                </Button>
              </p>
            )}
            {initial.dropped > 0 && (
              <p className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                <TriangleAlertIcon className="size-3.5 shrink-0" />
                {initial.dropped} section{initial.dropped === 1 ? "" : "s"} in the saved draft could not be read and
                {initial.dropped === 1 ? " was" : " were"} left out. Saving will remove {initial.dropped === 1 ? "it" : "them"} for good.
              </p>
            )}
            {initial.publishedInvalid && (
              <p className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
                <TriangleAlertIcon className="size-3.5 shrink-0" />
                The live version of this page cannot be read, so visitors see its plain title and body. Publishing fixes it.
              </p>
            )}
          </div>
        )}

        {/* ---------------- editor + preview ---------------- */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[22rem_1fr]">
          <aside className="bg-background flex min-h-0 flex-col border-r">
            {problems.length > 0 && (
              <div className="border-b px-3 py-2 text-xs">
                <p className="font-medium text-amber-700 dark:text-amber-500">Not published — these need content first:</p>
                <ul className="mt-1 space-y-0.5">
                  {problems.map((problem) => (
                    <li key={problem.sectionId}>
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={() => setPanel({ kind: "section", id: problem.sectionId })}
                      >
                        {problem.section}: {problem.fields.join(", ")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="min-h-0 flex-1">
              {panel.kind === "page" ? (
                <PageSettingsEditor
                  settings={content.page}
                  onBack={() => setPanel({ kind: "list" })}
                  onChange={(key, value) => dispatch({ kind: "page", key, value })}
                />
              ) : selectedSection ? (
                <SectionEditor
                  // Keyed so the rich text editor and pickers start fresh per section,
                  // and again after an undo or redo — see `epoch`.
                  key={`${selectedSection.id}:${epoch}`}
                  section={selectedSection}
                  previousType={content.sections[content.sections.findIndex((item) => item.id === selectedSection.id) - 1]?.type ?? null}
                  collections={collections}
                  tab={editorTab}
                  onTabChange={setEditorTab}
                  onBack={() => setPanel({ kind: "list" })}
                  onChange={(key, value) => dispatch({ kind: "setting", id: selectedSection.id, key, value })}
                  onToggle={() => dispatch({ kind: "toggle", id: selectedSection.id })}
                  onDuplicate={() => duplicate(selectedSection.id)}
                  onRemove={() => remove(selectedSection.id)}
                />
              ) : (
                <SectionList
                  sections={content.sections}
                  selectedId={selectedId}
                  incompleteIds={incompleteIds}
                  onAdd={addSection}
                  onOpenPageSettings={() => setPanel({ kind: "page" })}
                  handlers={{
                    onSelect: (id) => setPanel({ kind: "section", id }),
                    onMove: (from, to) => dispatch({ kind: "move", from, to }),
                    onToggle: (id) => dispatch({ kind: "toggle", id }),
                    onDuplicate: duplicate,
                    onRemove: remove,
                  }}
                />
              )}
            </div>
          </aside>

          {/* The preview is the real page. Below `lg` there is no room for it beside
              the editor; the Preview button opens it in a tab instead. */}
          <div className="bg-muted/40 hidden min-h-0 lg:flex lg:justify-center">
            <iframe
              ref={iframeRef}
              src={previewSrc}
              title={`Preview of ${page.title}`}
              onLoad={() => post({ type: PREVIEW_MESSAGE.select, id: selectedId })}
              className={cn(
                "h-full border-0 bg-white transition-[width] duration-200",
                viewport === "mobile" ? "my-4 h-[calc(100%-2rem)] w-[390px] rounded-lg border shadow-sm" : "w-full",
              )}
            />
          </div>
        </div>

        {/* The copy is of what is on screen: anything typed but not yet autosaved is
            saved first. */}
        <DuplicatePageDialog
          duplicateOf={{ id: page.id, title: page.title }}
          open={duplicating}
          onOpenChange={setDuplicating}
          beforeCreate={() => (dirty || inflightRef.current ? flush() : Promise.resolve(true))}
        />

        {/* ---------------- confirmations ---------------- */}
        <ConfirmDialog
          open={confirm !== null}
          onOpenChange={(open) => !open && setConfirm(null)}
          destructive={confirm === "discard"}
          title={confirm === "rollback" ? "Load the previously published version?" : "Discard unpublished changes?"}
          description={
            confirm === "rollback"
              ? "Your draft is replaced by the version that was live before the last publish. Nothing changes on the site until you publish."
              : "Your draft goes back to what is live now. Changes since the last publish are lost."
          }
          confirmLabel={confirm === "rollback" ? "Load it" : "Discard changes"}
          onConfirm={() => (confirm ? runConfirmed(confirm) : undefined)}
        />
      </div>
    </EditorLookupsContext.Provider>
  );
}
