"use client";

import { Loader2Icon, SaveIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";

/**
 * The only editable part of a customer.
 *
 * A note and a tag are the PANEL'S annotations about a customer, not the customer's own
 * details — the same distinction that lets an inquiry's status change while the words the
 * customer wrote stay untouched. Everything else on the record belongs to Shopify and is
 * shown as read-only text above.
 */
export function CustomerAnnotations({
  customerId,
  initialNote,
  initialTags,
}: {
  customerId: string;
  initialNote: string;
  initialTags: string[];
}) {
  const router = useRouter();
  const [note, setNote] = React.useState(initialNote);
  const [tags, setTags] = React.useState(initialTags);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const dirty =
    note !== initialNote || JSON.stringify(tags) !== JSON.stringify(initialTags);

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    // Adding one that is already there is a no-op somebody meant, not an error.
    if (!tags.includes(tag)) setTags((current) => [...current, tag]);
    setDraft("");
  }

  async function save() {
    setSaving(true);

    try {
      const response = await fetch("/api/admin/customers/update", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "customerUpdate", id: customerId, note, tags }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? `Save failed (${response.status})`);
      }

      toast.success("Saved", { description: "Note and tags updated." });
      router.refresh();
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : "That change was not applied.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-4 px-4">
        <div>
          <h2 className="text-sm font-semibold">Your notes</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Only these two fields can be changed here — everything else belongs to Shopify.
          </p>
        </div>

        <fieldset disabled={saving} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customer-tags">Tags</Label>
            <Input
              id="customer-tags"
              value={draft}
              onChange={(event) => {
                if (event.target.value.includes(",")) {
                  for (const part of event.target.value.split(",")) addTag(part);
                  return;
                }
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(draft);
                }
              }}
              onBlur={() => addTag(draft)}
              placeholder="Type a tag and press Enter"
            />

            {tags.length ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => setTags((current) => current.filter((value) => value !== tag))}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <p className="text-muted-foreground text-xs">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </p>
            <div className="ms-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!dirty || saving}
                onClick={() => {
                  setNote(initialNote);
                  setTags(initialTags);
                }}
              >
                Discard
              </Button>
              <Button type="button" size="sm" disabled={!dirty || saving} onClick={save}>
                {saving ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
