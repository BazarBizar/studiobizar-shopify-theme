"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Honeypot } from "@/components/forms/honeypot";
import { useSiteTexts } from "@/components/site-texts";
import { contactSchema, type ContactSubmission } from "@/lib/contact/schema";
import { HONEYPOT_FIELD, honeypotValue } from "@/lib/honeypot";
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
  const texts = useSiteTexts();
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

  async function onSubmit(values: ContactSubmission, event?: React.BaseSyntheticEvent) {
    setSubmitError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, [HONEYPOT_FIELD]: honeypotValue(event?.target) }),
      });
      if (!response.ok) throw new Error(response.status === 429 ? texts["form.tooMany"] : texts["form.sendFailed"]);

      setSent(true);
      reset();
    } catch (error) {
      // A network failure throws a TypeError in the browser's own words — not for a visitor.
      setSubmitError(error instanceof Error && !(error instanceof TypeError) ? error.message : texts["form.sendFailed"]);
    }
  }

  if (sent) {
    return (
      <div className="border-t border-border pt-8">
        <p className="text-h3">{texts["contact.thanks"]}</p>
        <p className="text-body mt-3 text-muted">{texts["contact.reply"]}</p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-button sb-underline mt-6"
        >
          {texts["contact.another"]}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="relative flex flex-col gap-6">
      <Honeypot />
      <h2 className="text-h3">{texts["contact.title"]}</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="firstName" label="First name" error={errors.firstName && texts["form.errorFirstName"]}>
          <input id="firstName" {...register("firstName")} placeholder={texts["contact.fieldFirstName"]} autoComplete="given-name" className={inputClass} />
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName && texts["form.errorLastName"]}>
          <input id="lastName" {...register("lastName")} placeholder={texts["contact.fieldLastName"]} autoComplete="family-name" className={inputClass} />
        </Field>
      </div>

      <Field id="email" label="Email address" error={errors.email && texts["form.errorEmail"]}>
        <input id="email" type="email" {...register("email")} placeholder={texts["contact.fieldEmail"]} autoComplete="email" className={inputClass} />
      </Field>

      <Field id="phone" label="Phone number" error={errors.phone && texts["form.errorPhone"]}>
        <input id="phone" type="tel" {...register("phone")} placeholder={texts["contact.fieldPhone"]} autoComplete="tel" className={inputClass} />
      </Field>

      <Field id="company" label="Company name" error={errors.company?.message}>
        <input id="company" {...register("company")} placeholder={texts["contact.fieldCompany"]} autoComplete="organization" className={inputClass} />
      </Field>

      <Field id="inquiryType" label="Type of inquiry" error={errors.inquiryType && texts["form.errorInquiryType"]}>
        <select id="inquiryType" {...register("inquiryType")} className={cn(inputClass, "cursor-pointer")}>
          {inquiryTypes.map((type) => (
            <option key={type} value={type} className="text-foreground">
              {type}
            </option>
          ))}
        </select>
      </Field>

      <Field id="message" label="Message" error={errors.message && texts["form.errorMessage"]}>
        <textarea id="message" rows={6} {...register("message")} placeholder={texts["contact.fieldMessage"]} className={cn(inputClass, "resize-y")} />
      </Field>

      <p className="text-secondary text-muted">{texts["contact.hint"]}</p>

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
        {isSubmitting ? texts["contact.sending"] : texts["contact.send"]}
      </button>
    </form>
  );
}
