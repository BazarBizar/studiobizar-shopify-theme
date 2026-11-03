"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Honeypot } from "@/components/forms/honeypot";
import { useSiteTexts } from "@/components/site-texts";
import { HONEYPOT_FIELD, honeypotValue } from "@/lib/honeypot";
import { inquiryContactSchema, type InquiryContact } from "@/lib/inquiry/schema";
import { useInquiryCart } from "@/store/inquiry-cart";
import { cn } from "@/lib/utils/cn";

/** Fields styled like the Contact page: label inside the field, hairline under. */
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
        <p id={`${id}-error`} role="alert" className="text-tertiary mt-1 text-deep-mocha">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  "text-body w-full border-b border-foreground bg-transparent py-2 placeholder:text-muted focus:outline-none focus:border-b-2";

export function InquiryForm() {
  const router = useRouter();
  const items = useInquiryCart((state) => state.items);
  const clear = useInquiryCart((state) => state.clear);
  const texts = useSiteTexts();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InquiryContact>({
    resolver: zodResolver(inquiryContactSchema),
    defaultValues: { name: "", company: "", email: "", phone: "", message: "" },
  });

  async function onSubmit(values: InquiryContact, event?: React.BaseSyntheticEvent) {
    setSubmitError(null);

    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, items, [HONEYPOT_FIELD]: honeypotValue(event?.target) }),
      });

      const body = (await response.json().catch(() => ({}))) as { inquiryId?: string };
      if (!response.ok || !body.inquiryId) {
        throw new Error(response.status === 429 ? texts["form.tooMany"] : texts["form.sendFailed"]);
      }

      // Only clear once the inquiry is safely stored.
      clear();
      router.push(`/inquiry/success?id=${encodeURIComponent(body.inquiryId)}`);
    } catch (error) {
      // A network failure throws a TypeError in the browser's own words — not for a visitor.
      setSubmitError(
        error instanceof Error && !(error instanceof TypeError) ? error.message : texts["form.sendFailed"],
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="relative flex flex-col gap-6">
      <Honeypot />
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="name" label="Your name" error={errors.name && texts["form.errorName"]}>
          <input
            id="name"
            {...register("name")}
            placeholder={texts["inquiry.fieldName"]}
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Field id="company" label="Company name" error={errors.company?.message}>
          <input
            id="company"
            {...register("company")}
            placeholder={texts["inquiry.fieldCompany"]}
            autoComplete="organization"
            className={inputClass}
          />
        </Field>

        <Field id="email" label="Email address" error={errors.email && texts["form.errorEmail"]}>
          <input
            id="email"
            type="email"
            {...register("email")}
            placeholder={texts["inquiry.fieldEmail"]}
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClass}
          />
        </Field>

        <Field id="phone" label="Phone number" error={errors.phone?.message}>
          <input
            id="phone"
            type="tel"
            {...register("phone")}
            placeholder={texts["inquiry.fieldPhone"]}
            autoComplete="tel"
            className={inputClass}
          />
        </Field>
      </div>

      <Field id="message" label="Message" error={errors.message?.message}>
        <textarea
          id="message"
          {...register("message")}
          rows={6}
          placeholder={texts["inquiry.fieldMessage"]}
          className={cn(inputClass, "resize-y")}
        />
      </Field>

      <p className="text-secondary text-muted">{texts["inquiry.formHint"]}</p>

      {submitError && (
        <p role="alert" className="text-secondary text-deep-mocha">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || items.length === 0}
        className="text-button h-12 w-full max-w-[20rem] border border-foreground uppercase tracking-[0.08em] transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting ? texts["inquiry.sending"] : texts["inquiry.send"]}
      </button>
    </form>
  );
}
