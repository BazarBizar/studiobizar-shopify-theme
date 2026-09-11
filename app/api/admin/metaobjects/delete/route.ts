import { handleWrite } from "@/lib/admin/write-handler";

/**
 * Pins the operation to `metaobjectDelete`; see the create route's note.
 *
 * POST, not DELETE. The panel's CSRF defence is the same-origin check in `guard`, which
 * every write goes through, and keeping one verb keeps one pipeline — a second one would
 * be a second place for that check to be forgotten.
 */
export async function POST(request: Request) {
  return handleWrite(request, "metaobjectDelete");
}
