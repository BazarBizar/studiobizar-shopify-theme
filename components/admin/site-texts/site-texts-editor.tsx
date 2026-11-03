"use client";

import { ExternalLinkIcon, RotateCcwIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { SaveBar } from "@/components/admin/save-bar";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import { formatDate } from "@/lib/admin/field-values";
import { RequestError, siteTextsRequest } from "@/lib/admin/queries";
import type { SiteTextsView } from "@/lib/admin/site-texts";
import {
  DEFAULT_SITE_TEXTS,
  onlyChanges,
  SITE_TEXT_GROUPS,
  SITE_TEXT_MAX,
  TEXT_VARIABLES,
  type SiteTextKey,
  type SiteTexts,
  type TextVariable,
} from "@/lib/site-texts";
import { cn } from "@/lib/utils/cn";

type Field = HTMLInputElement | HTMLTextAreaElement;

/** Order-independent, so "unsaved changes" never fires on a mere reshuffle. */
const fingerprint = (changes: Partial<SiteTexts>) => JSON.stringify(Object.entries(changes).sort(([a], [b]) => a.localeCompare(b)));

function messageOf(error: unknown): string {
  if (error instanceof RequestError) {
    const issues = error.detail.issues as { message?: string }[] | undefined;
    return issues?.[0]?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "That did not work.";
}

/** Lower case without accents or curly quotes, so "we’ll" is found by typing "we'll". */
const searchable = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase();

export function SiteTextsEditor({ view, siteUrl }: { view: SiteTextsView; siteUrl: string | null }) {
  // Every field shows the words on the site now, so changing one is just typing.
  const [values, setValues] = React.useState<SiteTexts>(() => ({ ...DEFAULT_SITE_TEXTS, ...view.changes }));
  const [saved, setSaved] = React.useState<Partial<SiteTexts>>(view.changes);
  const [digest, setDigest] = React.useState(view.digest);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const fields = React.useRef(new Map<string, Field>());

  const changes = onlyChanges(values);
  const changedCount = Object.keys(changes).length;
  const dirty = fingerprint(changes) !== fingerprint(saved);

  const set = (key: SiteTextKey, value: string) => setValues((current) => ({ ...current, [key]: value }));

  /** Puts `{name}` where the cursor is, or at the end. */
  const insert = (key: SiteTextKey, variable: TextVariable) => {
    const field = fields.current.get(key);
    const text = values[key];
    const token = `{${variable}}`;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? text.length;
    set(key, text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const discard = () => setValues({ ...DEFAULT_SITE_TEXTS, ...saved });

  const save = async () => {
    setSaving(true);
    try {
      const result = await siteTextsRequest({ digest, texts: changes });
      setValues({ ...DEFAULT_SITE_TEXTS, ...result.changes });
      setSaved(result.changes);
      setDigest(result.digest);
      toast.success("Texts saved", { description: "The website shows them within a minute." });
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

  const needle = searchable(query.trim());
  const groups = SITE_TEXT_GROUPS.map((group) => ({
    ...group,
    texts: group.texts.filter(
      (text) =>
        !needle ||
        searchable(`${group.label} ${text.where} ${text.value} ${values[text.key]}`).includes(needle),
    ),
  })).filter((group) => group.texts.length > 0);

  return (
    <div className="w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {changedCount === 0
            ? "Every text is as the website was built. Change any of them below."
            : `${changedCount} ${changedCount === 1 ? "text differs" : "texts differ"} from the original`}
          {view.savedAt ? ` · Last saved ${formatDate(view.savedAt, true)}${view.savedBy ? ` by ${view.savedBy}` : ""}` : ""}
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a text — type a few words you see on the website"
          aria-label="Find a text"
          className="pl-8"
        />
      </div>

      {groups.length === 0 && (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
          No text contains “{query.trim()}”. Texts you write yourself on a page are changed on that page under
          Pages, and a product’s own words under Products.
        </p>
      )}

      {groups.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <CardTitle>{group.label}</CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </div>
              {"href" in group && siteUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a href={`${siteUrl}${group.href}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon />
                    See it on the site
                  </a>
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {group.texts.map((text) => {
              const key = text.key as SiteTextKey;
              const value = values[key];
              const changed = key in changes;
              const empty = !value.trim();
              const vars: readonly TextVariable[] = "vars" in text ? text.vars : [];
              const missing = vars.filter((variable) => !value.includes(`{${variable}}`) && !empty);
              const id = `text-${key}`;
              const Control = "multiline" in text && text.multiline ? Textarea : Input;

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={id} className="text-sm">
                      {text.where}
                    </Label>
                    {(changed || empty) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground"
                        onClick={() => set(key, text.value)}
                        title={`Original: ${text.value}`}
                      >
                        <RotateCcwIcon />
                        Back to original
                      </Button>
                    )}
                  </div>
                  <Control
                    id={id}
                    ref={(node: Field | null) => {
                      if (node) fields.current.set(key, node);
                      else fields.current.delete(key);
                    }}
                    value={value}
                    maxLength={SITE_TEXT_MAX}
                    placeholder={text.value}
                    onChange={(event: React.ChangeEvent<Field>) => set(key, event.target.value)}
                    className={cn(changed && "border-primary/60")}
                    {...(Control === Textarea ? { rows: 2 } : {})}
                  />
                  {empty ? (
                    <p className="text-muted-foreground text-xs">Empty — the original text is used.</p>
                  ) : changed ? (
                    <p className="text-muted-foreground truncate text-xs">Original: {text.value}</p>
                  ) : null}
                  {vars.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-muted-foreground text-xs">Insert:</span>
                      {vars.map((variable) => (
                        <Button
                          key={variable}
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => insert(key, variable)}
                          title={`Adds {${variable}}, which is replaced by the ${TEXT_VARIABLES[variable].toLowerCase()}`}
                        >
                          {TEXT_VARIABLES[variable]}
                        </Button>
                      ))}
                    </div>
                  )}
                  {missing.length > 0 && (
                    <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                      <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden />
                      Without {missing.map((variable) => `{${variable}}`).join(" and ")} the{" "}
                      {missing.map((variable) => TEXT_VARIABLES[variable].toLowerCase()).join(" and ")} is not shown.
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <SaveBar dirty={dirty} saving={saving} onDiscard={discard} onSave={save} />
    </div>
  );
}
