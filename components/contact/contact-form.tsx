"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { contactSchema, type ContactSubmission } from "@/lib/contact/schema";
import { cn } from "@/lib/utils/cn";

const inputClass =
  "text-body w-full border-b border-foreground bg-transparent py-2 placeholder:text-muted focus:border-b-2 focus:outline-none";

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-tertiary mt-1 text-foreground/80">
          {error}
        </p>
      )}
    </div>
  );
}

/** Fields and order transcribed from `DESK - Contact.pdf`. */
export function ContactForm({ inquiryTypes }: { inquiryTypes: string[] }) {
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactSubmission>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      inquiryType: inquiryTypes[0] ?? "General",
      message: "",
    },
  });

  async function onSubmit(values: ContactSubmission) {
    setSubmitError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "That did not send.");

      setSent(true);
      reset();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "That did not send.");
    }
  }

  if (sent) {
    return (
      <div className="border-t border-border pt-8">
        <p className="text-h3">Thank you — your message is with us.</p>
        <p className="text-body mt-3 text-muted">
          We’ll reply by email, usually within two working days.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-button sb-underline mt-6"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <h2 className="text-h3">Email Us</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="firstName" label="First name" error={errors.firstName?.message}>
          <input id="firstName" {...register("firstName")} placeholder="First Name*" autoComplete="given-name" className={inputClass} />
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName?.message}>
          <input id="lastName" {...register("lastName")} placeholder="Last Name*" autoComplete="family-name" className={inputClass} />
        </Field>
      </div>

      <Field id="email" label="Email address" error={errors.email?.message}>
        <input id="email" type="email" {...register("email")} placeholder="Email*" autoComplete="email" className={inputClass} />
      </Field>

      <Field id="phone" label="Phone number" error={errors.phone?.message}>
        <input id="phone" type="tel" {...register("phone")} placeholder="Phone*" autoComplete="tel" className={inputClass} />
      </Field>

      <Field id="company" label="Company name" error={errors.company?.message}>
        <input id="company" {...register("company")} placeholder="Company Name" autoComplete="organization" className={inputClass} />
      </Field>

      <Field id="inquiryType" label="Type of inquiry" error={errors.inquiryType?.message}>
        <select id="inquiryType" {...register("inquiryType")} className={cn(inputClass, "cursor-pointer")}>
          {inquiryTypes.map((type) => (
            <option key={type} value={type} className="text-foreground">
              {type}
            </option>
          ))}
        </select>
      </Field>

      <Field id="message" label="Message" error={errors.message?.message}>
        <textarea id="message" rows={6} {...register("message")} placeholder="Message*" className={cn(inputClass, "resize-y")} />
      </Field>

      <p className="text-secondary text-muted">
        Please include anything that can help us to help you faster, such as an order number,
        timeline or budget.
      </p>

      {submitError && (
        <p role="alert" className="text-secondary">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="text-button h-12 w-full max-w-[20rem] border border-foreground uppercase tracking-[0.08em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-40"
      >
        {isSubmitting ? "Sending" : "Send message"}
      </button>
    </form>
  );
}
