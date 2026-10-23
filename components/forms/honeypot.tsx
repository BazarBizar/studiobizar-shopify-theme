import { HONEYPOT_FIELD } from "@/lib/honeypot";

/** The bot trap inside a public form — see `lib/honeypot.ts`. Place it anywhere in the <form>. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Leave this empty
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
