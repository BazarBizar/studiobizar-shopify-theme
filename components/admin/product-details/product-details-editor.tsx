"use client";

import { ArrowDownIcon, ArrowUpIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { SaveBar } from "@/components/admin/save-bar";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Input } from "@/components/admin/ui/input";
import type { ProductDetailsView } from "@/lib/admin/product-details";
import { formatDate } from "@/lib/admin/field-values";
import {
  productDetailsRequest,
  productFieldRequest,
  RequestError,
  type ProductDetailRow,
  type ProductFieldOption,
} from "@/lib/admin/queries";
import { AVAILABILITY_KEY, DETAIL_LIMITS, PANEL_TYPES, ROW_TYPES } from "@/lib/shopify/product-details";

type Kind = "row" | "panel";

const COPY: Record<Kind, { title: string; description: string; add: string; empty: string; types: readonly string[]; max: number }> = {
  row: {
    title: "Facts beside the product",
    description: "Short facts under the product’s description, e.g. Material / Finish — Oak. A product without a value skips the row.",
    add: "Add a fact",
    empty: "No facts are shown beside products.",
    types: ROW_TYPES,
    max: DETAIL_LIMITS.rows,
  },
  panel: {
    title: "Fold-out panels",
    description: "Longer text under the enquire button, each in a panel that opens on a click. A product without text skips the panel.",
    add: "Add a panel",
    empty: "No fold-out panels are shown on products.",
    types: PANEL_TYPES,
    max: DETAIL_LIMITS.panels,
  },
};

function messageOf(error: unknown): string {
  if (error instanceof RequestError) {
    const issues = error.detail.issues as { message?: string }[] | undefined;
    return issues?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "That did not work.";
}

const fingerprint = (rows: ProductDetailRow[], panels: ProductDetailRow[]) =>
  JSON.stringify({ rows: rows.map(({ key, label }) => [key, label.trim()]), panels: panels.map(({ key, label }) => [key, label.trim()]) });

export function ProductDetailsEditor({ view }: { view: ProductDetailsView }) {
  const [rows, setRows] = React.useState(view.rows);
  const [panels, setPanels] = React.useState(view.panels);
  const [fields, setFields] = React.useState(view.fields);
  const [saved, setSaved] = React.useState(() => fingerprint(view.rows, view.panels));
  const [digest, setDigest] = React.useState(view.digest);
  const [saving, setSaving] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const [creating, setCreating] = React.useState<Kind | null>(null);

  const dirty = fingerprint(rows, panels) !== saved;
  const empty = [...rows, ...panels].some((item) => !item.label.trim());
  const fieldName = React.useMemo(() => new Map(fields.map((field) => [field.key, field.name])), [fields]);

  const lists = { row: [rows, setRows], panel: [panels, setPanels] } as const;

  const save = async () => {
    if (empty) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const trim = (list: ProductDetailRow[]) => list.map(({ key, label }) => ({ key, label: label.trim() }));
      const result = await productDetailsRequest({ digest, rows: trim(rows), panels: trim(panels) });
      setDigest(result.digest);
      setSaved(fingerprint(rows, panels));
      setShowErrors(false);
      toast.success("Product details saved", { description: "Product pages show them within a minute." });
    } catch (error) {
      if (error instanceof RequestError && error.code === "CONFLICT") {
        toast.error(messageOf(error), { action: { label: "Reload", onClick: () => window.location.reload() } });
      } else {
        toast.error(messageOf(error));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      <p className="text-muted-foreground text-xs">
        {view.saved
          ? view.savedAt
            ? `Last saved ${formatDate(view.savedAt, true)}${view.savedBy ? ` by ${view.savedBy}` : ""}`
            : null
          : "This is what product pages show today. Change it and press Save."}
      </p>

      {(["row", "panel"] as const).map((kind) => {
        const [list, setList] = lists[kind];
        const copy = COPY[kind];
        const available = fields.filter((field) => copy.types.includes(field.type) && !list.some((item) => item.key === field.key));
        const full = list.length >= copy.max;

        const move = (index: number, by: -1 | 1) =>
          setList((current) => {
            const next = [...current];
            const [item] = next.splice(index, 1);
            next.splice(index + by, 0, item!);
            return next;
          });
        const remove = (index: number) => {
          const before = list;
          setList(list.filter((_, i) => i !== index));
          toast(`“${list[index]!.label || fieldName.get(list[index]!.key)}” removed from product pages`, {
            description: "What products say in it is kept — add it back any time.",
            action: { label: "Undo", onClick: () => setList(before) },
          });
        };

        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle>{copy.title}</CardTitle>
              <CardDescription>{copy.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {list.length === 0 && <p className="text-muted-foreground text-sm">{copy.empty}</p>}
              <ol className="space-y-2">
                {list.map((item, index) => {
                  const id = `${kind}-${item.key}`;
                  const missing = showErrors && !item.label.trim();
                  return (
                    <li key={item.key} className="rounded-md border p-2">
                      <div className="flex items-center gap-1">
                        <label htmlFor={id} className="sr-only">
                          Name on the product page
                        </label>
                        <Input
                          id={id}
                          value={item.label}
                          maxLength={DETAIL_LIMITS.label}
                          placeholder="Name on the product page"
                          aria-invalid={missing || undefined}
                          onChange={(event) =>
                            setList((current) => current.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry)))
                          }
                          className="h-8 flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${item.label} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${item.label} down`}
                          disabled={index === list.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          aria-label={`Remove ${item.label} from product pages`}
                          title="Remove from product pages"
                          onClick={() => remove(index)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                      <p className="text-muted-foreground mt-1 px-1 text-xs">
                        Filled in on each product under Products → “{fieldName.get(item.key) ?? item.key}”
                        {item.key === AVAILABILITY_KEY ? ", with the lead time beside it" : ""}.
                      </p>
                      {missing && (
                        <p role="alert" className="text-destructive mt-1 px-1 text-xs">
                          Give it a name — this is what visitors read.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={full}>
                    <PlusIcon />
                    {copy.add}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
                  {available.length > 0 && (
                    <>
                      <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">A product field that exists</DropdownMenuLabel>
                      {available.map((field) => (
                        <DropdownMenuItem key={field.key} onSelect={() => setList((current) => [...current, { key: field.key, label: field.name }])}>
                          {field.name}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onSelect={() => setCreating(kind)}>
                    <PlusIcon />A new field…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        );
      })}

      <NewFieldDialog
        kind={creating}
        onClose={() => setCreating(null)}
        onCreated={(kind, field) => {
          setFields((current) => [...current, field]);
          lists[kind][1]((current) => [...current, { key: field.key, label: field.name }]);
        }}
      />

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => {
          const original = JSON.parse(saved) as { rows: [string, string][]; panels: [string, string][] };
          setRows(original.rows.map(([key, label]) => ({ key, label })));
          setPanels(original.panels.map(([key, label]) => ({ key, label })));
          setShowErrors(false);
        }}
        onSave={save}
        note={showErrors && empty ? "Every fact and panel needs a name before you can save." : undefined}
      />
    </div>
  );
}

function NewFieldDialog({
  kind,
  onClose,
  onCreated,
}: {
  kind: Kind | null;
  onClose: () => void;
  onCreated: (kind: Kind, field: ProductFieldOption) => void;
}) {
  const [name, setName] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!kind || !name.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const field = await productFieldRequest({ name: name.trim(), kind });
      onCreated(kind, field);
      toast.success(`“${field.name}” added`, {
        description: "Fill it in on each product under Products, and press Save here to show it.",
      });
      setName("");
      onClose();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && !working && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{kind === "panel" ? "A new fold-out panel" : "A new fact"}</DialogTitle>
            <DialogDescription>
              {kind === "panel"
                ? "Every product gets a new field for formatted text, filled in under Products."
                : "Every product gets a new one-line field, filled in under Products."}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            maxLength={DETAIL_LIMITS.label}
            placeholder={kind === "panel" ? "e.g. Assembly" : "e.g. Weight"}
            aria-label="Name"
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={working} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={working || !name.trim()}>
              {working ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              {working ? "Adding…" : "Add field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
