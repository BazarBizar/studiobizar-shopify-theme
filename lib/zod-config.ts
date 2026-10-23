import { z } from "zod";

/**
 * Zod compiles faster validators with `new Function` when it can — which the
 * storefront's CSP (next.config.ts) refuses, so every page with a form logged a
 * violation while zod fell back on its own. `jitless` skips the attempt: the same
 * checks, without asking the browser for `eval`. Imported by the schemas forms use.
 */
z.config({ jitless: true });
