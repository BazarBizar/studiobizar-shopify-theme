"use client";

import { useState } from "react";

import { Honeypot } from "@/components/forms/honeypot";
import { useSiteTexts } from "@/components/site-texts";
import { HONEYPOT_FIELD, honeypotValue } from "@/lib/honeypot";

type Status = "idle" | "sending" | "done" | "error";

/** `inputId` lets a second sign-up on the page (the Newsletter section) keep ids unique. */
export function NewsletterForm({ inputId = "newsletter-email", className }: { inputId?: string; className?: string } = {}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const texts = useSiteTexts();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, [HONEYPOT_FIELD]: honeypotValue(event.currentTarget) }),
      });
      const body = (await response.json().catch(() => ({}))) as { result?: string };

      if (!response.ok) {
        throw new Error(
          response.status === 400 ? texts["form.errorEmail"] : response.status === 429 ? texts["form.tooMany"] : texts["newsletter.failed"],
        );
      }

      setStatus("done");
      setMessage(body.result === "again" ? texts["newsletter.again"] : texts["newsletter.thanks"]);
      setEmail("");
    } catch (error) {
      setStatus("error");
      // A network failure throws a TypeError in the browser's own words — not for a visitor.
      setMessage(error instanceof Error && !(error instanceof TypeError) ? error.message : texts["newsletter.failed"]);
    }
  }

  return (
    <form onSubmit={onSubmit} className={`relative ${className ?? "max-w-[26.25rem]"}`}>
      <Honeypot />
      <div className="flex items-center gap-4 border-b border-current pb-2">
        <label htmlFor={inputId} className="sr-only">
          Your email address
        </label>
        <input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={texts["newsletter.field"]}
          autoComplete="email"
          className="text-secondary w-full bg-transparent placeholder:text-current placeholder:opacity-70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="text-secondary shrink-0 transition-opacity hover:opacity-70 disabled:opacity-50"
        >
          {status === "sending" ? texts["newsletter.sending"] : texts["newsletter.submit"]}
        </button>
      </div>

      {message && (
        <p role="status" className="text-tertiary mt-2 opacity-80">
          {message}
        </p>
      )}
    </form>
  );
}
