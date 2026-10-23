import "server-only";

import type { ExampleMedia } from "@/lib/page-builder/examples";

import { listProducts } from "./products";
import { OPERATIONS } from "./operations";
import { adminGraphQL } from "./shopify";

/**
 * The shop's own photographs and products, for the example content a newly added
 * section is filled with (`lib/page-builder/examples.ts`). Large, processed images
 * only — an example banner on a thumbnail looks broken, not exemplary.
 *
 * Never fails: with nothing to offer, a section's text is still filled and its images
 * show the usual placeholder.
 */
export async function getExampleMedia(collections: { id: string; handle: string; title: string }[]): Promise<ExampleMedia> {
  const [images, products] = await Promise.all([
    adminGraphQL<{
      files: {
        nodes: {
          __typename: string;
          id: string;
          fileStatus: string;
          image?: { url: string; altText: string | null; width: number | null; height: number | null } | null;
        }[];
      };
    }>("files", OPERATIONS.files.document, {
      first: 60,
      after: null,
      query: "media_type:IMAGE",
      sortKey: "CREATED_AT",
      reverse: true,
    })
      .then((data) =>
        data.files.nodes
          .filter((node) => node.__typename === "MediaImage" && node.fileStatus === "READY" && node.image?.url)
          .filter((node) => (node.image!.width ?? 0) >= 1000)
          .slice(0, 12)
          .map((node) => ({
            id: node.id,
            url: node.image!.url,
            altText: node.image!.altText,
            width: node.image!.width,
            height: node.image!.height,
          })),
      )
      .catch(() => []),
    listProducts({ first: 8, query: "status:active" })
      .then((page) => page.products.map((product) => ({ id: product.id, handle: product.handle, title: product.title })))
      .catch(() => []),
  ]);

  return {
    images,
    products,
    collections: collections.filter((collection) => collection.handle !== "frontpage").slice(0, 8),
  };
}
