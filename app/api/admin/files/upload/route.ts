import { NextResponse } from "next/server";

import { fail, failure, guard } from "@/lib/admin/api";
import { audit } from "@/lib/admin/audit";
import { checkUpload, MAX_VIDEO_BYTES, uploadFile } from "@/lib/admin/media";

/**
 * Upload relay: the browser POSTs bytes here, this server sends them to Shopify (§5.1).
 *
 * The alternative — the browser uploading straight to Shopify's signed target — would
 * require whitelisting a storage host in the admin CSP, and the panel's whole
 * `connect-src 'self'` posture exists so that an injection has nowhere to exfiltrate
 * to. It would also hand a signed upload URL to client code.
 *
 * This route reads `multipart/form-data` rather than JSON, so it does not use the
 * shared `readJson` body reader; the size limit is enforced against the part itself,
 * below.
 */

/** A 1 GB video over a slow connection needs far longer than an API call. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const guarded = await guard(request, { action: "files.upload", limit: "write" });
  if (!guarded.ok) return guarded.response;

  const { staff, ip } = guarded.context;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("BAD_REQUEST", "Send the file as multipart form data.");
  }

  const entry = form.get("file");
  if (!(entry instanceof File)) {
    audit({ action: "files.upload", actor: staff.email, outcome: "invalid", reason: "NO_FILE", ip });
    return fail("BAD_REQUEST", "No file was attached.");
  }

  /**
   * Checked on the server. The `accept` attribute on the input and any client-side size
   * check are conveniences for the person choosing a file; neither survives a direct
   * POST, so the rule lives here.
   */
  const verdict = checkUpload(entry.type, entry.size);
  if (!verdict.ok) {
    audit({
      action: "files.upload",
      actor: staff.email,
      outcome: "invalid",
      reason: verdict.kind === "size" ? "TOO_LARGE" : "BAD_TYPE",
      ip,
    });
    // A refused MIME type is not a size problem; answering 413 for it would send the
    // client looking for a smaller file it can never make small enough.
    return fail(verdict.kind === "size" ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST", verdict.reason);
  }

  // Belt and braces: `File.size` is reported by the caller, so the real byte count is
  // re-checked after reading rather than trusted from the header.
  const bytes = new Uint8Array(await entry.arrayBuffer());
  if (bytes.byteLength > MAX_VIDEO_BYTES || bytes.byteLength > verdict.limit) {
    audit({ action: "files.upload", actor: staff.email, outcome: "invalid", reason: "SIZE_MISMATCH", ip });
    return fail("PAYLOAD_TOO_LARGE", "That file is larger than it claimed to be.");
  }

  const alt = form.get("alt");

  try {
    const { file, processing } = await uploadFile({
      bytes,
      filename: entry.name || "upload",
      mimeType: entry.type,
      alt: typeof alt === "string" && alt.trim() ? alt.trim() : null,
    });

    audit({
      action: "files.upload",
      actor: staff.email,
      outcome: "ok",
      type: verdict.kind,
      entryId: file.id,
      // The filename is the operator's own words about their file, not store data, but
      // it is still content — only the resulting id and kind are recorded.
      ip,
    });

    return NextResponse.json({ file, processing });
  } catch (error) {
    audit({ action: "files.upload", actor: staff.email, outcome: "error", reason: "UPSTREAM", ip });
    return failure("files.upload", error);
  }
}
