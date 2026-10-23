"use client";

import { Loader2Icon, UploadIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/admin/ui/button";
import { uploadFileRequest, type PickerFile } from "@/lib/admin/queries";

/**
 * THE way a file reaches Shopify from the panel — the Media library and every
 * picker. One place for the request, the "Uploading…" state and the toasts, so an
 * upload reads and behaves the same wherever it starts.
 */

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,application/pdf";
export const VIDEO_ACCEPT = "video/mp4,video/quicktime";

export function acceptFor(kind: "image" | "video" | "any"): string | undefined {
  return kind === "video" ? VIDEO_ACCEPT : kind === "image" ? IMAGE_ACCEPT : undefined;
}

export function useFileUpload(onUploaded: (file: PickerFile) => void | Promise<void>) {
  const [uploading, setUploading] = React.useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { file: created, processing } = await uploadFileRequest(file);
      await onUploaded(created);
      toast.success("Uploaded", {
        description: processing
          ? "Uploaded — the preview appears in a moment, once it is processed."
          : "Uploaded.",
      });
    } catch (caught) {
      toast.error("Upload failed", {
        description: caught instanceof Error ? caught.message : "Shopify did not accept the file.",
      });
    } finally {
      setUploading(false);
    }
  }

  return { uploading, upload };
}

/** The Upload button: opens the file dialog, shows progress, hands the file to `onFile`. */
export function UploadButton({
  accept,
  uploading,
  onFile,
  label = "Upload",
  size = "sm",
}: {
  accept?: string;
  uploading: boolean;
  onFile: (file: File) => void;
  label?: string;
  size?: "sm" | "default";
}) {
  const input = React.useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset at once, so choosing the same file twice still fires a change.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button type="button" variant="outline" size={size} disabled={uploading} onClick={() => input.current?.click()}>
        {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
        {uploading ? "Uploading…" : label}
      </Button>
    </>
  );
}
