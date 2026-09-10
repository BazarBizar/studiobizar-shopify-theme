import { handleCollectionWrite } from "@/lib/admin/collection-write";

/** Pins the operation to `collectionUpdate`; see the note in `collection-write.ts`. */
export async function POST(request: Request) {
  return handleCollectionWrite(request, "collectionUpdate");
}
