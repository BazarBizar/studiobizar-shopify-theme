/**
 * The public forms' bot trap: a field people never see (it sits off screen, hidden
 * from assistive technology and skipped by Tab) and form-filling scripts fill in.
 * A submission with it filled is answered like any other — "thanks" — and dropped:
 * telling a script it was caught only teaches it. See `readPublicForm`.
 */
export const HONEYPOT_FIELD = "website";

/** The trap's value in the form an event came from; "" when there is none. */
export function honeypotValue(target: EventTarget | null | undefined): string {
  const element = target as Element | null | undefined;
  const form = element?.closest?.("form");
  const input = form?.elements.namedItem(HONEYPOT_FIELD);
  return input && "value" in input && typeof input.value === "string" ? input.value : "";
}
