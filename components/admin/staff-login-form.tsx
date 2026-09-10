"use client";

import { Loader2Icon, LogInIcon } from "lucide-react";
import { useActionState } from "react";

import { staffLogin, type LoginState } from "@/app/(admin)/staff/login/actions";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";

const initial: LoginState = { error: null };

export function StaffLoginForm({ from }: { from: string }) {
  const [state, action, pending] = useActionState(staffLogin, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="from" value={from} />

      <fieldset disabled={pending} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {/* `role="alert"` so the failure is announced, not only shown. */}
        {state.error ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-xs"
          >
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full">
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <LogInIcon className="size-4" />
          )}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </fieldset>
    </form>
  );
}
