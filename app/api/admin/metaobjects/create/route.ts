import { handleWrite } from "@/lib/admin/write-handler";

/**
 * Pins the operation to `metaobjectCreate`, so an update payload cannot be
 * smuggled through here. The shared pipeline in `lib/admin/write-handler.ts` owns
 * the order of every check.
 */
export async function POST(request: Request) {
  return handleWrite(request, "metaobjectCreate");
}
