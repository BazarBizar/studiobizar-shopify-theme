"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { createBuilderPageRequest } from "@/lib/admin/queries";
import { builderHandleProblem, handleFromTitle } from "@/lib/page-builder/handles";
import { PAGE_TEMPLATES, type PageTemplateId } from "@/lib/page-builder/templates";
import { cn } from "@/lib/utils/cn";

/**
 * New page: a title, the address it will live at, and a starting layout.
 *
 * The handle follows the title until the operator edits it, and is checked as
 * they type with the same rule the server applies — so "that address is taken
 * by the site" appears here, not after a round trip. The page starts HIDDEN and
 * goes live on its first publish.
 */
export function CreatePageDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [handleTouched, setHandleTouched] = React.useState(false);
  const [template, setTemplate] = React.useState<PageTemplateId>("landing");
  const [saving, setSaving] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const effectiveHandle = handleTouched ? handle : handleFromTitle(title);
  const problem = effectiveHandle ? builderHandleProblem(effectiveHandle) : null;
  const ready = title.trim() !== "" && effectiveHandle !== "" && !problem && !saving;

  function reset() {
    setTitle("");
    setHandle("");
    setHandleTouched(false);
    setTemplate("landing");
    setServerError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    setSaving(true);
    setServerError(null);
    try {
      const created = await createBuilderPageRequest({ title: title.trim(), handle: effectiveHandle, template });
      toast.success("Page created", { description: "It stays hidden until you publish it." });
      setOpen(false);
      reset();
      router.push(`/admin/pages/${created.id.split("/").pop()}/builder`);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Could not create the page.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          New page
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
            <DialogDescription>
              Built from the site’s own sections. It stays hidden until you publish it.
            </DialogDescription>
          </DialogHeader>

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
              <span className="text-muted-foreground font-mono text-sm">/</span>
              <Input
                id="new-page-handle"
                value={effectiveHandle}
                maxLength={100}
                aria-invalid={Boolean(problem)}
                aria-describedby="new-page-handle-help"
                className="font-mono"
                onChange={(event) => {
                  setHandleTouched(true);
                  setHandle(event.target.value.toLowerCase());
                }}
              />
            </div>
            <p
              id="new-page-handle-help"
              className={cn("text-xs", problem ? "text-destructive" : "text-muted-foreground")}
            >
              {problem ?? "Lowercase letters, numbers and hyphens. Changing it later breaks links to the page."}
            </p>
          </div>

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

          {serverError && (
            <p className="text-destructive text-sm" role="alert">
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              {saving && <Loader2Icon className="animate-spin" />}
              Create and open builder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
