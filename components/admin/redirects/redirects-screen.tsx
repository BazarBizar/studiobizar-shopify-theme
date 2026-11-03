"use client";

import { ArrowRightIcon, ExternalLinkIcon, Loader2Icon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DestinationPicker, type DestinationOption } from "@/components/admin/destination-picker";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table";
import { formatDate } from "@/lib/admin/field-values";
import {
  createRedirectRequest,
  deleteRedirectRequest,
  RequestError,
  type RedirectRow,
} from "@/lib/admin/queries";
import { redirectSourceProblem, redirectTargetProblem } from "@/lib/redirects";

const TYPE_IT = "__type_it__";

function messageOf(error: unknown): string {
  if (error instanceof RequestError) {
    const issues = error.detail.issues as { message?: string }[] | undefined;
    return issues?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "That did not work.";
}

export function RedirectsScreen({
  initial,
  destinations,
  siteUrl,
  siteHost,
}: {
  initial: RedirectRow[];
  destinations: { label: string; href: string; group: string }[];
  siteUrl: string | null;
  siteHost: string | null;
}) {
  const [rows, setRows] = React.useState(initial);
  const [query, setQuery] = React.useState("");
  const [deleting, setDeleting] = React.useState<RedirectRow | null>(null);

  const label = React.useMemo(() => new Map(destinations.map((target) => [target.href, target.label])), [destinations]);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? rows.filter((row) => `${row.from} ${row.to} ${label.get(row.to) ?? ""}`.toLowerCase().includes(needle))
    : rows;

  return (
    <div className="w-full max-w-4xl space-y-6">
      <AddRedirect
        destinations={destinations}
        siteHost={siteHost}
        onAdded={(row) => setRows((current) => [row, ...current])}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            {rows.length} {rows.length === 1 ? "redirect" : "redirects"}
          </h2>
          {rows.length > 0 && (
            <div className="relative w-full max-w-xs">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find an address"
                aria-label="Find an address"
                className="pl-8"
              />
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No redirects yet"
            description="Changing the address of a page, product or collection here adds one by itself. Add your own above, for example for an old page that no longer exists."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Old address</TableHead>
                  <TableHead className="w-8" />
                  <TableHead>Visitors go to</TableHead>
                  <TableHead className="hidden md:table-cell">Added</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-64 truncate font-mono text-xs" title={row.from}>
                      {row.from}
                    </TableCell>
                    <TableCell>
                      <ArrowRightIcon className="text-muted-foreground size-3.5" aria-label="goes to" />
                    </TableCell>
                    <TableCell className="max-w-72 truncate text-xs" title={row.to}>
                      {label.get(row.to) ? (
                        <>
                          {label.get(row.to)} <span className="text-muted-foreground font-mono">{row.to}</span>
                        </>
                      ) : (
                        <span className="font-mono">{row.to}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {row.createdAt ? formatDate(row.createdAt, false) : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {siteUrl && (
                        <Button asChild variant="ghost" size="icon-sm" title="Try it: opens the old address">
                          <a href={`${siteUrl}${row.from}`} target="_blank" rel="noopener noreferrer" aria-label={`Try ${row.from}`}>
                            <ExternalLinkIcon />
                          </a>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        aria-label={`Delete the redirect from ${row.from}`}
                        title="Delete"
                        onClick={() => setDeleting(row)}
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-6 text-center text-sm">
                      No redirect has “{query.trim()}” in it.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this redirect?"
        description={
          deleting ? (
            <>
              Visitors to <span className="font-mono">{deleting.from}</span> will see “page not found” instead of going to{" "}
              <span className="font-mono">{deleting.to}</span>.
            </>
          ) : null
        }
        confirmLabel="Delete redirect"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteRedirectRequest(deleting.id);
            setRows((current) => current.filter((row) => row.id !== deleting.id));
            toast.success("Redirect deleted");
          } catch (error) {
            toast.error(messageOf(error));
            throw error;
          }
        }}
      />
    </div>
  );
}

function AddRedirect({
  destinations,
  siteHost,
  onAdded,
}: {
  destinations: { label: string; href: string; group: string }[];
  siteHost: string | null;
  onAdded: (row: RedirectRow) => void;
}) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  const options: DestinationOption[] = [
    ...destinations.map((target) => ({ value: target.href, label: target.label, group: target.group, hint: target.href })),
    { value: TYPE_IT, label: "Another address (type it — a product, or another website)", group: "Other" },
  ];
  const onList = destinations.some((target) => target.href === to);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    // The same checks the server makes, so the common mistakes answer at once.
    const problem = redirectSourceProblem(from) ?? redirectTargetProblem(to);
    if (problem) {
      setError(problem);
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const row = await createRedirectRequest({ from, to });
      onAdded(row);
      setFrom("");
      setTo("");
      setTyping(false);
      toast.success("Redirect added", { description: `${row.from} now goes to ${row.to}. It works on the website within a minute.` });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a redirect</CardTitle>
        <CardDescription>
          Changing the address of a page, product or collection in this admin adds a redirect by itself — you only need
          this for other old addresses.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={add} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="redirect-from">Old address</Label>
            <div className="flex items-center gap-1">
              {siteHost && <span className="text-muted-foreground shrink-0 text-xs">{siteHost}</span>}
              <Input
                id="redirect-from"
                value={from}
                maxLength={255}
                placeholder="/old-page"
                onChange={(event) => {
                  setFrom(event.target.value);
                  setError(null);
                }}
                aria-invalid={Boolean(error) || undefined}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="redirect-to">Send visitors to</Label>
            <DestinationPicker
              id="redirect-to"
              value={typing ? TYPE_IT : onList ? to : ""}
              options={options}
              placeholder="Choose a page"
              onChange={(next) => {
                setError(null);
                if (next === TYPE_IT) {
                  setTyping(true);
                  if (onList) setTo("");
                  return;
                }
                setTyping(false);
                setTo(next);
              }}
            />
          </div>
          <Button type="submit" disabled={adding}>
            {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            {adding ? "Adding…" : "Add redirect"}
          </Button>
          {typing && (
            <div className="md:col-start-2">
              <Input
                value={to}
                maxLength={2048}
                placeholder="/shop/new-chair or https://…"
                aria-label="New address"
                onChange={(event) => {
                  setTo(event.target.value.trim());
                  setError(null);
                }}
                className="font-mono text-xs"
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive text-xs md:col-span-3">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
