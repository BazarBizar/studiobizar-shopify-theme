/**
 * Admin API helpers for the seed scripts.
 *
 * Separate from `lib/shopify/admin.ts` because that module imports
 * `server-only`, which throws outside a Next server runtime.
 */

import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
) as Record<string, string>;

const ENDPOINT = `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;

export const DRY_RUN = process.argv.includes("--dry-run");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Admin API uses a cost-based leaky bucket. Seeding hundreds of metafields
 * drains it, so THROTTLED, 429 and 5xx are retried with exponential backoff
 * rather than failing a long run near the end.
 */
export async function admin<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
  attempt = 0,
): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    const wait = Number(response.headers.get("retry-after")) * 1000 || 2 ** attempt * 500;
    await sleep(wait);
    return admin<T>(query, variables, attempt + 1);
  }

  if (!response.ok) throw new Error(`Admin API ${response.status}: ${await response.text()}`);

  const body = (await response.json()) as {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[];
    extensions?: { cost?: { throttleStatus?: { currentlyAvailable: number; restoreRate: number } } };
  };

  if (body.errors?.some((e) => e.extensions?.code === "THROTTLED") && attempt < 5) {
    await sleep(2 ** attempt * 1000);
    return admin<T>(query, variables, attempt + 1);
  }

  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("; "));
  if (!body.data) throw new Error("Admin API returned no data");

  // Pre-emptively wait when the bucket is nearly empty, rather than be rejected.
  const throttle = body.extensions?.cost?.throttleStatus;
  if (throttle && throttle.currentlyAvailable < 150) {
    await sleep(Math.ceil((200 - throttle.currentlyAvailable) / throttle.restoreRate) * 1000);
  }

  return body.data;
}

export function assertNoUserErrors(
  errors: { field?: string[] | null; message: string }[] | undefined,
  context: string,
) {
  if (!errors?.length) return;
  throw new Error(
    `${context}: ${errors.map((e) => `${e.field?.join(".") ?? ""} ${e.message}`.trim()).join("; ")}`,
  );
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Uploads a local image to Shopify Files and returns its MediaImage GID, which
 * is what a `file_reference` metafield stores.
 *
 * Three steps, all required: ask for a staged target, POST the bytes to it, then
 * register the uploaded object as a File. The file is then processed
 * asynchronously, so the last step polls until it reports READY — referencing a
 * file still in UPLOADED state fails validation.
 */
export async function uploadImage(path: string, altText?: string): Promise<string> {
  const filename = basename(path);
  const mimeType = MIME[extname(path).toLowerCase()] ?? "image/png";
  const bytes = readFileSync(path);

  const staged = await admin<{
    stagedUploadsCreate: {
      stagedTargets: { url: string; resourceUrl: string; parameters: { name: string; value: string }[] }[];
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    /* GraphQL */ `
      mutation StageUpload($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      input: [
        {
          filename,
          mimeType,
          resource: "IMAGE",
          httpMethod: "POST",
          fileSize: String(bytes.byteLength),
        },
      ],
    },
  );

  assertNoUserErrors(staged.stagedUploadsCreate.userErrors, "stagedUploadsCreate");
  const target = staged.stagedUploadsCreate.stagedTargets[0];
  if (!target) throw new Error(`No staged target for ${filename}`);

  const form = new FormData();
  for (const param of target.parameters) form.append(param.name, param.value);
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), filename);

  const upload = await fetch(target.url, { method: "POST", body: form });
  if (!upload.ok) throw new Error(`Staged upload failed (${upload.status}) for ${filename}`);

  const created = await admin<{
    fileCreate: {
      files: { id: string; fileStatus: string }[];
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>(
    /* GraphQL */ `
      mutation CreateFile($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      files: [
        {
          originalSource: target.resourceUrl,
          contentType: "IMAGE",
          alt: altText ?? filename,
        },
      ],
    },
  );

  assertNoUserErrors(created.fileCreate.userErrors, "fileCreate");
  const file = created.fileCreate.files[0];
  if (!file) throw new Error(`fileCreate returned nothing for ${filename}`);

  return waitForFile(file.id);
}

/** Files are processed asynchronously; a metafield cannot reference one until READY. */
export async function waitForFile(id: string, attempts = 30): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const data = await admin<{ node: { id: string; fileStatus?: string } | null }>(
      /* GraphQL */ `
        query FileStatus($id: ID!) {
          node(id: $id) {
            id
            ... on MediaImage {
              fileStatus
            }
          }
        }
      `,
      { id },
    );

    if (data.node?.fileStatus === "READY") return data.node.id;
    if (data.node?.fileStatus === "FAILED") throw new Error(`File ${id} failed processing`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`File ${id} did not become READY in time`);
}

/** Upserts metafields on any owner. `metafieldsSet` handles up to 25 at a time. */
export async function setMetafields(
  metafields: { ownerId: string; namespace: string; key: string; type: string; value: string }[],
) {
  for (let i = 0; i < metafields.length; i += 25) {
    const batch = metafields.slice(i, i + 25);
    const data = await admin<{
      metafieldsSet: {
        metafields: { key: string }[];
        userErrors: { field?: string[] | null; message: string }[];
      };
    }>(
      /* GraphQL */ `
        mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              key
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      { metafields: batch },
    );

    assertNoUserErrors(data.metafieldsSet.userErrors, "metafieldsSet");
  }
}

/** Shopify's rich_text_field wants a JSON AST, not HTML. */
export function richText(...paragraphs: string[]): string {
  return JSON.stringify({
    type: "root",
    children: paragraphs.map((text) => ({
      type: "paragraph",
      children: [{ type: "text", value: text }],
    })),
  });
}

export const log = {
  step: (message: string) => console.log(`\n▸ ${message}`),
  ok: (message: string) => console.log(`  ✓ ${message}`),
  skip: (message: string) => console.log(`  · ${message}`),
  warn: (message: string) => console.log(`  ! ${message}`),
};
