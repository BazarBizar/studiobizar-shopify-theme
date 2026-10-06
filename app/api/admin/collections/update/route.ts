import { handleCollectionWrite } from "@/lib/admin/collection-write";

/** Room for the second cache drop `revalidateForType` schedules after responding. */
export const maxDuration = 60;

/** Pins the operation to `collectionUpdate`; see the note in `collection-write.ts`. */
export async function POST(request: Request) {
  return handleCollectionWrite(request, "collectionUpdate");
}
