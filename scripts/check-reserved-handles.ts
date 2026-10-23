/**
 * Fails when a top-level route folder exists that `lib/page-builder/handles.ts`
 * does not reserve.
 *
 * Page builder pages render at `/<handle>`. A static route always wins over that
 * dynamic one, so a builder page whose handle matches a folder added later would
 * become unreachable with no error anywhere. This keeps the reserved list honest.
 *
 *   yarn check:handles
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { APP_ROUTE_SEGMENTS, builderHandleProblem } from "../lib/page-builder/handles";

const ROOTS = ["app", join("app", "(storefront)"), join("app", "(admin)")];

/** Segment folders only — not route groups `(x)`, dynamic `[x]`, or private `_x`. */
function segments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !/^[([_@]/.test(name));
}

const found = new Set(ROOTS.flatMap(segments));
const listed = new Set<string>(APP_ROUTE_SEGMENTS);

const unlisted = [...found].filter((segment) => !listed.has(segment));
const notReserved = [...found].filter((segment) => builderHandleProblem(segment) === null);

if (unlisted.length || notReserved.length) {
  console.error("✗ Route folders missing from APP_ROUTE_SEGMENTS in lib/page-builder/handles.ts:");
  for (const segment of new Set([...unlisted, ...notReserved])) console.error(`  /${segment}`);
  process.exit(1);
}

console.log(`✓ ${found.size} top-level route segments, all reserved from page builder handles.`);
