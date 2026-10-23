import { handleWrite } from "@/lib/admin/write-handler";

/** Room for the second cache drop `revalidateForType` schedules after responding. */
export const maxDuration = 60;

/** Pins the operation to `metaobjectUpdate`; see the create route's note. */
export async function POST(request: Request) {
  return handleWrite(request, "metaobjectUpdate");
}
