import { cardLook } from "@/lib/page-builder/template-look";

/**
 * The card settings' wrapper (`cardFields` / `markFields` in lib/page-builder/template-look.ts):
 * data attributes and custom properties that `styles/sb-template-look.css` restyles the cards
 * inside with. Nothing at all while every setting is as designed, so a section left alone
 * draws exactly what it did.
 */
export function Look({ s, children }: { s: Parameters<typeof cardLook>[0]; children: React.ReactNode }) {
  const look = cardLook(s);
  if (!look) return children;
  return (
    <div {...look.attrs} style={look.style as React.CSSProperties}>
      {children}
    </div>
  );
}
