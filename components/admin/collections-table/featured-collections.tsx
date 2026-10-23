"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { CataloguePicker } from "@/components/admin/catalogue-picker";
import { SaveBar } from "@/components/admin/save-bar";
import { Card, CardContent } from "@/components/admin/ui/card";
import { updateEntryRequest } from "@/lib/admin/queries";

/**
 * The collections featured across the site — `site_settings.featured_collections`,
 * the same field Site-wide › Site settings edits, with the same picker
 * (`CataloguePicker`) and the same save bar, so the one setting never looks like
 * two different things.
 */

type Option = { id: string; label: string; thumbnail: string | null };

export function FeaturedCollections({
  settingsId,
  selected,
  options,
}: {
  settingsId: string | null;
  selected: string[];
  options: Option[];
}) {
  const router = useRouter();
  const [order, setOrder] = React.useState<string[]>(selected);
  const [saving, setSaving] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const isDirty = JSON.stringify(order) !== JSON.stringify(selected);

  async function save() {
    if (!settingsId) return;
    setSaving(true);
    try {
      await updateEntryRequest({
        id: settingsId,
        fields: [{ key: "featured_collections", value: JSON.stringify(order) }],
      });
      toast.success("Saved", { description: "The featured collections are updated on the site." });
      router.refresh();
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : "That change was not applied.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!settingsId) {
    return (
      <Card className="gap-0 py-4">
        <CardContent className="px-4">
          <p className="text-sm font-medium">Featured collections are not set up yet</p>
          <p className="text-muted-foreground mt-1 text-sm">Ask your developer to set them up.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-muted-foreground text-sm">These collections appear on the website, in this order.</p>
      <CataloguePicker
        // Remounted on Discard so the picker's own memory of names starts over too.
        key={version}
        kind="collection"
        multiple
        value={order}
        current={options}
        collectionOptions={options}
        label="Featured collections"
        onChange={(ids) => setOrder(ids)}
      />
      <SaveBar
        dirty={isDirty}
        saving={saving}
        onSave={() => void save()}
        onDiscard={() => {
          setOrder(selected);
          setVersion((current) => current + 1);
        }}
      />
    </div>
  );
}
