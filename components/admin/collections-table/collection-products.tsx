"use client";

import { ImageIcon, Loader2Icon } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { AppLink } from "@/components/admin/app-link";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent } from "@/components/admin/ui/card";

/**
 * What the collection actually contains.
 *
 * READ-ONLY, and the reason depends on the collection:
 *  - a SMART collection's contents are decided by its rules, so there is nothing here to
 *    add or remove — this list is for checking what those rules really matched;
 *  - a MANUAL collection's membership is editable in Shopify, but adding and removing
 *    products is outside this panel's declared write scope (create and edit only), and
 *    the refusal lives in the data layer rather than in a hidden button.
 *
 * Either way the badge says so, so nobody hunts for an edit control that is not coming.
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
          <Badge variant="secondary">Read-only</Badge>
          <span className="text-muted-foreground ms-auto text-xs">
            {products.length} of {total}
          </span>
        </div>

        <p className="text-muted-foreground text-xs">
          {smart
            ? "Chosen automatically by this collection's rules. Use this to check what the rules match."
            : "Membership is edited in Shopify."}
        </p>

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
                  <span className="text-muted-foreground block truncate font-mono text-xs">
                    {product.handle}
                  </span>
                </span>

                {product.status !== "ACTIVE" ? (
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {product.status.toLowerCase()}
                  </Badge>
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
    </Card>
  );
}
