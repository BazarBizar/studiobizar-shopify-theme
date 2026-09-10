"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/admin/ui/card";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { updateEntryRequest } from "@/lib/admin/queries";

const OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
];

/**
 * The ONE writable field on an inquiry.
 *
 * `status` is the operator's own annotation about a submission, not part of what the
 * customer wrote — the same distinction that makes a customer note writable while their
 * details are not. `assertWritable` in the data layer refuses every other field, and
 * refuses create outright, so this control is a convenience over a rule that already
 * holds without it.
 *
 * It saves on change rather than behind a Save button: there is one field, and a
 * dropdown that looked changed but was not stored would misreport the state of a real
 * customer request.
 */
export function InquiryStatus({ inquiryId, status }: { inquiryId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(status);
  const [saving, setSaving] = React.useState(false);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);

    try {
      await updateEntryRequest({ id: inquiryId, fields: [{ key: "status", value: next }] });
      toast.success("Status updated", { description: `Marked as ${next}.` });
      router.refresh();
    } catch (error) {
      // Put the control back where it was, so it never shows a state Shopify refused.
      setValue(previous);
      toast.error("Could not update the status", {
        description: error instanceof Error ? error.message : "That change was not applied.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-0 py-4">
      <CardContent className="space-y-2 px-4">
        <Label htmlFor="inquiry-status">Status</Label>

        <Select value={value} onValueChange={change} disabled={saving}>
          <SelectTrigger id="inquiry-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {saving ? <Loader2Icon className="size-3 animate-spin" /> : null}
          {/* Said out loud, because the shared spec marks inquiries read on open and this
              store's schema cannot do that honestly. */}
          The only field that can be changed here. Opening an inquiry does not change it —
          &ldquo;contacted&rdquo; is a claim about having contacted someone, not about
          having looked.
        </p>
      </CardContent>
    </Card>
  );
}
