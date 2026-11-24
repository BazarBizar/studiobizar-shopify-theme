import "server-only";

import type { TemplateKind } from "@/lib/page-builder/template-kinds";
import {
  METAOBJECT_TYPES,
  getCollection,
  getListedCollections,
  getMetaobject,
  getMetaobjects,
  getProduct,
  getProducts,
} from "@/lib/shopify";
import { normalizeDesigner, normalizeProject, normalizeProjectCard, sortDesigners, sortProjects } from "@/lib/shopify/entities";

import type { TemplateRecord } from "./renderer-kit";

/**
 * The editor's side of a template: which items its preview can be drawn with, and the
 * item itself. The storefront routes load their own item; this is for the panel.
 */

export type TemplateSampleOption = { value: string; label: string; href: string };

/** Up to 60 items to preview a template with, newest or as listed on the site. */
export async function templateSamples(kind: TemplateKind): Promise<TemplateSampleOption[]> {
  switch (kind) {
    case "product": {
      const page = await getProducts({ first: 60 }).catch(() => null);
      return (page?.items ?? []).map((item) => ({ value: item.handle, label: item.title, href: `/shop/${item.handle}` }));
    }
    case "collection": {
      const items = await getListedCollections().catch(() => []);
      return items.map((item) => ({ value: item.handle, label: item.title, href: `/collections/${item.handle}` }));
    }
    case "project": {
      const page = await getMetaobjects(METAOBJECT_TYPES.project, { first: 60 }).catch(() => null);
      return sortProjects((page?.items ?? []).map(normalizeProjectCard)).map((item) => ({
        value: item.handle,
        label: item.title,
        href: `/projects/${item.handle}`,
      }));
    }
    case "designer": {
      const page = await getMetaobjects(METAOBJECT_TYPES.designer, { first: 60 }).catch(() => null);
      return sortDesigners((page?.items ?? []).map(normalizeDesigner)).map((item) => ({
        value: item.handle,
        label: item.name,
        href: `/designers/${item.handle}`,
      }));
    }
    default:
      return [];
  }
}

/** What the preview starts with: the first item, or for Search results a word that finds something. */
export async function defaultSample(kind: TemplateKind, samples: TemplateSampleOption[]): Promise<string> {
  if (kind === "search") {
    const page = await getProducts({ first: 1 }).catch(() => null);
    const word = page?.items[0]?.title.split(/\s+/).find((part) => part.length > 3);
    return word?.toLowerCase() ?? "chair";
  }
  return samples[0]?.value ?? "";
}

const HANDLE = /^[a-z0-9][a-z0-9-]{0,254}$/;

/**
 * The item the preview draws, and the title for its hidden heading. An unknown or
 * missing handle falls back to the first item, so the preview always shows a page;
 * null only when the store has no item of that kind at all.
 */
export async function loadTemplateRecord(
  kind: TemplateKind,
  item: string | undefined,
): Promise<{ record: TemplateRecord; title: string } | null> {
  const handle = item && HANDLE.test(item) ? item : undefined;
  const first = async () => (await templateSamples(kind))[0]?.value;

  switch (kind) {
    case "product": {
      const product = (handle ? await getProduct(handle).catch(() => null) : null) ?? (await firstOf(first, getProduct));
      return product ? { record: { kind, product }, title: product.title } : null;
    }
    case "collection": {
      const collection = (handle ? await getCollection(handle).catch(() => null) : null) ?? (await firstOf(first, getCollection));
      return collection ? { record: { kind, collection }, title: collection.title } : null;
    }
    case "project": {
      const load = (value: string) => getMetaobject(METAOBJECT_TYPES.project, value);
      const entry = (handle ? await load(handle).catch(() => null) : null) ?? (await firstOf(first, load));
      if (!entry) return null;
      const project = normalizeProject(entry);
      return { record: { kind, project }, title: project.title };
    }
    case "designer": {
      const load = (value: string) => getMetaobject(METAOBJECT_TYPES.designer, value);
      const entry = (handle ? await load(handle).catch(() => null) : null) ?? (await firstOf(first, load));
      if (!entry) return null;
      const designer = normalizeDesigner(entry);
      return { record: { kind, designer }, title: designer.name };
    }
    case "search":
      return { record: { kind, query: (item ?? "").trim().slice(0, 60) }, title: "Search" };
    case "shop":
      return { record: { kind, params: {} }, title: "Products" };
    case "collections":
      return { record: { kind }, title: "Collections" };
    case "projects":
      return { record: { kind, params: {} }, title: "Projects" };
  }
}

async function firstOf<T>(first: () => Promise<string | undefined>, load: (handle: string) => Promise<T | null | undefined>) {
  const handle = await first();
  return handle ? ((await load(handle).catch(() => null)) ?? null) : null;
}
