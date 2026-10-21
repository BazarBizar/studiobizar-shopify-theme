"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { createBuilderPageRequest } from "@/lib/admin/queries";
import { builderHandleProblem, handleFromTitle } from "@/lib/page-builder/handles";
import { PAGE_TEMPLATES, type PageTemplateId } from "@/lib/page-builder/templates";
import { cn } from "@/lib/utils/cn";

/** A page's Content tab — the page builder. */
export const builderHref = (pageId: string) => `/admin/pages/${pageId.split("/").pop()}/content`;

type DuplicateSource = { id: string; title: string };

/**
 * New page: a title, the address it will live at, and a starting layout.
 *
 * The handle follows the title until the operator edits it, and is checked as
 * they type with the same rule the server applies — so "that address is taken
 * by the site" appears here, not after a round trip. The page starts HIDDEN and
 * goes live on its first publish.
 *
 * With `duplicateOf` it makes a copy instead: no template choice, a "(copy)"
 * title to change, and the source's sections as the start. `beforeCreate` lets
 * the builder save what is on screen first, so the copy is of the page as the
 * operator sees it.
 *
 * One form, two homes: the Pages → New page screen, and the builder's Duplicate
 * page dialog.
 */
export function CreatePageForm({
  duplicateOf,
  beforeCreate,
  onCancel,
  onCreated,
}: {
  duplicateOf?: DuplicateSource;
  beforeCreate?: () => Promise<boolean>;
  onCancel?: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(duplicateOf ? `${duplicateOf.title} (copy)` : "");
  const [handle, setHandle] = React.useState("");
  const [handleTouched, setHandleTouched] = React.useState(false);
  const [template, setTemplate] = React.useState<PageTemplateId>("landing");
  const [saving, setSaving] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const effectiveHandle = handleTouched ? handle : handleFromTitle(title);
  const problem = effectiveHandle ? builderHandleProblem(effectiveHandle) : null;
  const ready = title.trim() !== "" && effectiveHandle !== "" && !problem && !saving;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    setSaving(true);
    setServerError(null);
    try {
      if (beforeCreate && !(await beforeCreate())) {
        setServerError("Your latest changes could not be saved, so nothing was copied. Try again.");
        return;
      }

      const created = await createBuilderPageRequest(
        duplicateOf
          ? { title: title.trim(), handle: effectiveHandle, duplicateOf: duplicateOf.id }
          : { title: title.trim(), handle: effectiveHandle, template },
      );
      toast.success(duplicateOf ? "Copy created" : "Page created", {
        description: "It stays hidden until you publish it.",
      });
      onCreated?.();
      router.push(builderHref(created.id));
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Could not create the page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="new-page-title">Title</Label>
        <Input
          id="new-page-title"
          value={title}
          maxLength={255}
          autoFocus
          placeholder="Summer collection"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-page-handle">Address</Label>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-sm">/</span>
          <Input
            id="new-page-handle"
            value={effectiveHandle}
            maxLength={100}
            aria-invalid={Boolean(problem)}
            aria-describedby="new-page-handle-help"
            onChange={(event) => {
              setHandleTouched(true);
              setHandle(event.target.value.toLowerCase());
            }}
          />
        </div>
        <p id="new-page-handle-help" className={cn("text-xs", problem ? "text-destructive" : "text-muted-foreground")}>
          {problem ?? "Lowercase letters, numbers and hyphens. Changing it later breaks links to the page."}
        </p>
      </div>

      {!duplicateOf && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Start from</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {PAGE_TEMPLATES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={template === option.id}
                onClick={() => setTemplate(option.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  template === option.id ? "border-primary ring-primary/20 ring-2" : "hover:bg-muted/50",
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">{option.description}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {serverError && (
        <p className="text-destructive text-sm" role="alert">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!ready}>
          {saving && <Loader2Icon className="animate-spin" />}
          {duplicateOf ? "Create copy and open it" : "Create and open builder"}
        </Button>
      </div>
    </form>
  );
}

/**
 * The builder's Duplicate page dialog — `CreatePageForm` in copy mode. Keyed on
 * open so every opening starts from a fresh "(copy)" title.
 */
export function DuplicatePageDialog({
  duplicateOf,
  open,
  onOpenChange,
  beforeCreate,
}: {
  duplicateOf: DuplicateSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beforeCreate?: () => Promise<boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicate page</DialogTitle>
          <DialogDescription>
            A new page with the same sections as “{duplicateOf.title}”. It stays hidden until you publish it.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <CreatePageForm
            duplicateOf={duplicateOf}
            beforeCreate={beforeCreate}
            onCancel={() => onOpenChange(false)}
            onCreated={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
