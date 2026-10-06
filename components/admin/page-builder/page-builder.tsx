"use client";

import {
  ArrowLeftIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  HistoryIcon,
  Loader2Icon,
  MonitorIcon,
  RotateCcwIcon,
  SendIcon,
  SettingsIcon,
  SmartphoneIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/admin/app-link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Badge } from "@/components/admin/ui/badge";
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
  deletePageRequest,
  RequestError,
  saveDraftRequest,
} from "@/lib/admin/queries";
import {
  createSection,
  duplicateSection,
  publishProblems,
  type DocumentContent,
  type PublishProblem,
} from "@/lib/page-builder/document";
import type { SectionType } from "@/lib/page-builder/registry";
import { cn } from "@/lib/utils/cn";

import type { CollectionOption } from "./field-controls";
import { builderReducer, insertionIndex } from "./reducer";
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
type Busy = null | "publish" | "discard" | "rollback" | "delete";
type Confirm = null | "discard" | "rollback" | "delete";

export type PageBuilderProps = {
  page: { id: string; param: string; title: string; handle: string; isPublished: boolean };
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
  publicPath: string;
};

/** Quiet long enough to be a pause, short enough that the preview feels live. */
const AUTOSAVE_MS = 1200;

export function PageBuilder({ page, initial, collections, publicPath }: PageBuilderProps) {
  const router = useRouter();

  const [content, dispatch] = React.useReducer(builderReducer, initial.content);
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

  const addSection = (type: SectionType) => {
    const section = createSection(type);
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
      setHasPublished(true);
      setHasUnpublished(false);
      setIsLive(true);
      // Shopify takes up to about half a minute to serve a change. Saying so stops
      // someone reloading at once and concluding the publish failed.
      toast.success("Published", { description: `${publicPath} shows it within about half a minute.` });
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

  async function runConfirmed(action: NonNullable<Confirm>) {
    setConfirm(null);
    setBusy(action);

    try {
      if (action === "delete") {
        await deletePageRequest(page.id);
        toast.success("Page deleted");
        router.push("/admin/pages");
        return;
      }

      await builderActionRequest(action === "discard" ? "builderDiscard" : "builderRollback", {
        id: page.id,
        baseRevision: revisionRef.current,
      });
      toast.success(action === "discard" ? "Changes discarded" : "Previous version restored", {
        description: action === "rollback" ? "Visitors see it within about half a minute." : undefined,
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
    <div className="-m-4 flex h-[calc(100svh-3.5rem)] flex-col md:-m-6">
      {/* ---------------- top bar ---------------- */}
      <div className="bg-background flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to page">
          <AppLink href={`/admin/pages/${page.param}`}>
            <ArrowLeftIcon />
          </AppLink>
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{page.title}</h1>
          <p className="text-muted-foreground truncate font-mono text-[11px]">{publicPath}</p>
        </div>

        <div className="flex items-center gap-1.5">
          {isLive ? <Badge variant="secondary">Live</Badge> : <Badge variant="outline">Hidden</Badge>}
          {!hasPublished ? (
            <Badge variant="outline">Never published</Badge>
          ) : hasUnpublished || dirty ? (
            <Badge variant="outline">Unpublished changes</Badge>
          ) : null}
        </div>

        <div className="ms-auto flex items-center gap-1.5">
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
              <DropdownMenuItem asChild>
                <AppLink href={`/admin/pages/${page.param}`}>
                  <SettingsIcon />
                  Title, handle and visibility
                </AppLink>
              </DropdownMenuItem>
              {isLive && hasPublished && (
                <DropdownMenuItem asChild>
                  <a href={publicPath} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon />
                    View live page
                  </a>
                </DropdownMenuItem>
              )}
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
                Restore previous version
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={busy !== null} onSelect={() => setConfirm("delete")}>
                <Trash2Icon />
                Delete page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
                pageTitle={page.title}
                onBack={() => setPanel({ kind: "list" })}
                onChange={(key, value) => dispatch({ kind: "page", key, value })}
              />
            ) : selectedSection ? (
              <SectionEditor
                // Keyed so the rich text editor and pickers start fresh per section.
                key={selectedSection.id}
                section={selectedSection}
                collections={collections}
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

      {/* ---------------- confirmations ---------------- */}
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "delete"
                ? "Delete this page?"
                : confirm === "rollback"
                  ? "Restore the previous version?"
                  : "Discard unpublished changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete"
                ? `“${page.title}” and ${publicPath} will be gone. This cannot be undone.`
                : confirm === "rollback"
                  ? "The version published before the current one goes live again straight away, and becomes your draft."
                  : "Your draft goes back to what is live now. Changes since the last publish are lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              // As in delete-entry-action.tsx: the destructive button is styled as
              // such, and Cancel keeps the focus so a reflexive Enter cancels.
              className={cn(
                confirm === "delete" && "bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/30 text-white",
              )}
              onClick={() => confirm && void runConfirmed(confirm)}
            >
              {confirm === "delete" ? "Delete page" : confirm === "rollback" ? "Restore" : "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
