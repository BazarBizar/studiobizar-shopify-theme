"use client";

import { ImageIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/admin/app-link";
import { RecordPickerDialog, type RecordItem } from "@/components/admin/record-picker";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";
import { useProductSearch } from "@/lib/admin/queries";

/**
 * What the collection actually contains.
 *
 * A MANUAL collection: products are added (searched by name, as everywhere in the
 * panel) and removed here, each change saved straight away, a removal with Undo.
 *
 * A SMART collection's contents are decided by its rules, so there is nothing to add
 * or remove — the list is for checking what those rules really matched, and it says so.
 * The server refuses a smart collection too (`setCollectionMembership`).
 */

type Product = {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
};

export function CollectionProducts({
  collectionId,
  initial,
  hasNextPage,
  endCursor,
  total,
  smart,
}: {
  collectionId: string;
  initial: Product[];
  hasNextPage: boolean;
  endCursor: string | null;
  total: number;
  smart: boolean;
}) {
  const [products, setProducts] = React.useState(initial);
  const [cursor, setCursor] = React.useState(endCursor);
  const [more, setMore] = React.useState(hasNextPage);
  const [loading, setLoading] = React.useState(false);
  const [count, setCount] = React.useState(total);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const found = useProductSearch(debounced, pickerOpen, { includeDrafts: true });
  const options: RecordItem[] = (found.data ?? []).map((product) => ({
    id: product.id,
    label: product.title,
    thumbnail: product.thumbnail,
    handle: product.handle,
  }));

  /** One change to the collection; returns the products that did not move. */
  async function change(body: { add?: string[]; remove?: string[] }): Promise<string[]> {
    const response = await fetch("/api/admin/collections/membership", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "collectionMembership", id: collectionId, ...body }),
    });
    const result = (await response.json().catch(() => null)) as { failed?: string[]; message?: string } | null;
    if (!response.ok) throw new Error(result?.message ?? `Failed (${response.status})`);
    return result?.failed ?? [];
  }

  async function add(picked: RecordItem[]) {
    const fresh = picked.filter((item) => !products.some((product) => product.id === item.id));
    if (fresh.length === 0) return;
    setSaving(true);
    try {
      const failed = new Set(await change({ add: fresh.map((item) => item.id) }));
      const added = fresh.filter((item) => !failed.has(item.id));
      setProducts((current) => [
        ...added.map((item) => ({
          id: item.id,
          title: item.label,
          handle: item.handle ?? "",
          status: found.data?.find((product) => product.id === item.id)?.status ?? "ACTIVE",
          thumbnail: item.thumbnail ?? null,
        })),
        ...current,
      ]);
      setCount((current) => current + added.length);
      if (failed.size) toast.error(`${failed.size} of ${fresh.length} could not be added`, { description: "Try those again." });
      else toast.success(added.length > 1 ? `${added.length} products added` : "Product added");
    } catch (error) {
      toast.error("Could not add the products", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(product: Product) {
    const before = products;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setCount((current) => current - 1);
    try {
      const failed = await change({ remove: [product.id] });
      if (failed.length) throw new Error("Shopify refused the change.");
      toast("Removed from this collection", {
        description: product.title,
        action: {
          label: "Undo",
          onClick: () => {
            void change({ add: [product.id] })
              .then((stillFailed) => {
                if (stillFailed.length) throw new Error("Shopify refused the change.");
                setProducts(before);
                setCount((current) => current + 1);
              })
              .catch(() => toast.error("Could not put it back", { description: "Add it again with Add products." }));
          },
        },
      });
    } catch (error) {
      setProducts(before);
      setCount((current) => current + 1);
      toast.error("Could not remove the product", {
        description: error instanceof Error ? error.message : "Shopify refused the change.",
      });
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);

    try {
      const response = await fetch("/api/admin/collections/products", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "collectionProducts", id: collectionId, after: cursor }),
      });

      if (!response.ok) return;

      const page = (await response.json()) as {
        products: Product[];
        hasNextPage: boolean;
        endCursor: string | null;
      };

      setProducts((current) => [...current, ...page.products]);
      setCursor(page.endCursor);
      setMore(page.hasNextPage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Products</h2>
          <span className="text-muted-foreground ms-auto text-xs">
            {products.length} of {count}
          </span>
        </div>

        {smart ? (
          <p className="text-muted-foreground text-xs">
            Chosen automatically by this collection’s rules. Use this to check what the rules match.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setPickerOpen(true)}>
              {saving ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
              {saving ? "Adding…" : "Add products"}
            </Button>
            <p className="text-muted-foreground text-xs">Changes here are saved straight away.</p>
          </div>
        )}

        {products.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            This collection is empty.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {products.map((product) => (
              <li key={product.id} className="flex items-center gap-3 py-2">
                <span className="bg-muted flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                  {product.thumbnail ? (
                    <Image
                      src={product.thumbnail}
                      alt=""
                      width={36}
                      height={36}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="text-muted-foreground size-3.5" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <AppLink
                    href={`/admin/products/${product.id.split("/").pop()}`}
                    className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {product.title}
                  </AppLink>
                </span>

                {product.status !== "ACTIVE" ? (
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {product.status === "DRAFT" ? "Draft — hidden" : "Archived — hidden"}
                  </Badge>
                ) : null}

                {!smart ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    aria-label={`Remove ${product.title} from this collection`}
                    title="Remove from this collection"
                    onClick={() => void remove(product)}
                  >
                    <XIcon />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {more ? (
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        ) : null}
      </CardContent>

      {!smart ? (
        <RecordPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="products for this collection"
          noun="products"
          items={options}
          loading={found.isLoading}
          error={found.error?.message ?? null}
          onRetry={() => void found.refetch()}
          search={{ value: search, onChange: setSearch, searching: found.isFetching }}
          multiple
          selectedIds={products.map((product) => product.id)}
          limit={50}
          onConfirm={(picked) => void add(picked)}
        />
      ) : null}
    </Card>
  );
}
