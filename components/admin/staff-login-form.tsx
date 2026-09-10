"use client";

import { useActionState } from "react";

import { staffLogin, type LoginState } from "@/app/(admin)/staff/login/actions";

const initial: LoginState = { error: null };

export function StaffLoginForm({ from }: { from: string }) {
  const [state, action, pending] = useActionState(staffLogin, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="from" value={from} />

      <label className="flex flex-col gap-1.5">
        <span className="text-admin-muted text-xs font-medium tracking-wide uppercase">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="border-admin-border bg-admin-panel rounded-admin border px-3 py-2 outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-admin-muted text-xs font-medium tracking-wide uppercase">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border-admin-border bg-admin-panel rounded-admin border px-3 py-2 outline-none"
        />
      </label>

      {/* `role="alert"` so the failure is announced, not only shown. */}
      {state.error ? (
        <p
          role="alert"
          className="bg-admin-danger-bg text-admin-danger rounded-admin px-3 py-2 text-xs"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-admin-accent text-admin-accent-fg rounded-admin mt-1 px-3 py-2.5 font-medium disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
