"use client";

import { KeyRoundIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { staffRequest, type StaffOperation } from "@/lib/admin/queries";
import type { StaffRow } from "@/lib/admin/staff";

/** Four random words would be kinder, but a dictionary is a lot to ship: 16 easy-to-read characters. */
function suggestPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((byte) => alphabet[byte % alphabet.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12).join("")}`;
}

export function StaffScreen({
  me,
  owner,
  rows,
  minLength,
}: {
  me: string;
  owner: boolean;
  rows: StaffRow[];
  minLength: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const run = async (key: string, input: StaffOperation) => {
    setBusy(key);
    try {
      await staffRequest(input);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That did not work.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  /* Your password */
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [repeat, setRepeat] = React.useState("");
  const mismatch = repeat.length > 0 && next !== repeat;
  const tooShort = next.length > 0 && next.length < minLength;
  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mismatch || tooShort || !current) return;
    if (await run("password", { operation: "staffChangePassword", current, next })) {
      // The change ends every session, this one too: sign in with the new password.
      toast.success("Password changed", { description: "Sign in again with your new password." });
      router.push(`${STAFF_LOGIN_PATH}?from=${encodeURIComponent("/admin/staff")}`);
    }
  };

  /* Add someone */
  const [email, setEmail] = React.useState("");
  const [firstPassword, setFirstPassword] = React.useState("");
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await run("add", { operation: "staffAdd", email, password: firstPassword })) {
      toast.success(`${email} can sign in now`, {
        description: "Give them the password in person — they can change it here once signed in.",
      });
      setEmail("");
      setFirstPassword("");
      router.refresh();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRoundIcon className="size-4" /> Your password
          </CardTitle>
          <CardDescription>For {me}. Changing it signs you out everywhere, here too.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-current">Current password</Label>
              <Input id="staff-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-next">New password</Label>
              <Input id="staff-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={tooShort} />
              <p className={tooShort ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                At least {minLength} characters — a short sentence is easiest to remember.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-repeat">New password, again</Label>
              <Input id="staff-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={mismatch} />
              {mismatch ? <p className="text-destructive text-xs">The two do not match yet.</p> : null}
            </div>
            <Button type="submit" disabled={busy !== null || !current || !next || mismatch || tooShort || next !== repeat}>
              {busy === "password" ? "Changing…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People who can sign in</CardTitle>
          <CardDescription>
            {owner
              ? "Owners are set on the server and always keep access. Anyone you add here can be removed again."
              : "Only an owner can add or remove people."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="divide-y rounded-md border">
            {rows.map((row) => (
              <li key={row.email} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.email}</p>
                  <p className="text-muted-foreground text-xs">
                    {row.owner
                      ? row.ownPassword
                        ? "Owner · own password"
                        : "Owner · the server password"
                      : `Added ${row.addedAt ? new Date(row.addedAt).toLocaleDateString() : ""}${row.addedBy ? ` by ${row.addedBy}` : ""}`}
                  </p>
                </div>
                {row.email === me ? <Badge variant="secondary">You</Badge> : null}
                {row.owner ? <Badge variant="outline">Owner</Badge> : null}
                {owner && !row.owner ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`Remove ${row.email}`}
                    disabled={busy !== null}
                    onClick={() => setRemoving(row.email)}
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>

          {owner ? (
            <form onSubmit={add} className="space-y-4 border-t pt-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <UserPlusIcon className="size-4" /> Add someone
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="staff-email">Email address</Label>
                <Input id="staff-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-first">First password</Label>
                <div className="flex gap-2">
                  <Input
                    id="staff-first"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={firstPassword}
                    onChange={(e) => setFirstPassword(e.target.value)}
                    className="font-mono"
                  />
                  <Button type="button" variant="outline" onClick={() => setFirstPassword(suggestPassword())}>
                    Suggest one
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Give it to them in person, not by email. They can change it here once signed in.
                </p>
              </div>
              <Button type="submit" disabled={busy !== null || !email || firstPassword.length < minLength}>
                {busy === "add" ? "Adding…" : "Add"}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing}?</AlertDialogTitle>
            <AlertDialogDescription>
              They can no longer sign in, and anyone signed in as them is signed out at once. You can add them again
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                const email = removing!;
                setRemoving(null);
                if (await run("remove", { operation: "staffRemove", email })) {
                  toast.success(`${email} can no longer sign in`);
                  router.refresh();
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
