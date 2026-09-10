import { failure, guard } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { buildInquiryWorkbook } from "@/lib/admin/inquiry-excel";

/**
 * The `.xlsx` export. A route handler rather than a server action because the response is
 * binary — a server action would have to base64 it through the RSC payload.
 *
 * Always the whole collection; see the note in `lib/admin/inquiry-excel.ts`.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const guarded = await guard(request, { action: "inquiry.export", limit: "read" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  try {
    const { filename, bytes, rows } = await buildInquiryWorkbook();

    audit({
      action: "inquiry.export",
      actor: staff.email,
      outcome: "ok",
      type: "inquiry",
      // A row count, never the exported content.
      fields: [`${rows} item rows`],
      ip,
    });

    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (error) {
    audit({ action: "inquiry.export", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("inquiry.export", error);
  }
}
