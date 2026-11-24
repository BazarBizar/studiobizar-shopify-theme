import { isBuilderHandle } from "./handle-rules";
import { pageMigration } from "./migrations";

/**
 * Handle rules live in `handle-rules.ts` (import-free, so `proxy.ts` can use them);
 * re-exported here so every existing import keeps working.
 */
export {
  APP_ROUTE_SEGMENTS,
  builderHandleProblem,
  isBuilderHandle,
  isReservedHandle,
} from "./handle-rules";

/**
 * Whether the builder may EDIT this page: a builder page, or a hand-built page
 * that has a migration (`lib/page-builder/migrations.ts`) and so renders the
 * published document at its own route. Only `isBuilderHandle` pages render at
 * `/<handle>` or can be deleted — a migrated page keeps its address and cannot be.
 */
export function isBuilderEditable(handle: string): boolean {
  return isBuilderHandle(handle) || pageMigration(handle) !== null;
}

/** Title → a handle suggestion. The operator can still edit it. */
export function handleFromTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}
