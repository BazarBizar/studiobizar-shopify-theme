"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json()) as { message?: string };

      if (!response.ok) throw new Error(body.message ?? "That did not go through.");

      setStatus("done");
      setMessage(body.message ?? "You are on the list.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "That did not go through.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[26.25rem]">
      <div className="flex items-center gap-4 border-b border-current pb-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Your email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Your email address"
          autoComplete="email"
          className="text-secondary w-full bg-transparent placeholder:text-current placeholder:opacity-70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="text-secondary shrink-0 transition-opacity hover:opacity-70 disabled:opacity-50"
        >
          {status === "sending" ? "Sending" : "Submit"}
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
