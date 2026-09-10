import { handleWrite } from "@/lib/admin/write-handler";

/** Pins the operation to `metaobjectUpdate`; see the create route's note. */
export async function POST(request: Request) {
  return handleWrite(request, "metaobjectUpdate");
}
