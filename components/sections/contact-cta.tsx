import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/lib/shopify";

/**
 * The closing block on Collections Detail, Our Designers, Our Story, Service and
 * the Landing page.
 *
 * The copy below is transcribed from the designs and is now the FALLBACK: an
 * operator can change it in the panel under Site settings. Keeping the literal
 * here rather than requiring the field to be filled is what stops an empty
 * setting from shipping an empty band to five pages.
 */

const FALLBACK_BODY =
  "Whether you have a question about an order, a product, or would like more information about what we do, we’d love to hear from you.";

const FALLBACK_LABEL = "contact us";

export async function ContactCta() {
  const settings = await getSiteSettings();

  return (
    <Container className="py-section">
      <p className="text-h2 max-w-[38rem]">{settings.contactCtaBody ?? FALLBACK_BODY}</p>
      <ButtonLink href="/contact" variant="outline" className="mt-8">
        {settings.contactCtaLabel ?? FALLBACK_LABEL}
      </ButtonLink>
    </Container>
  );
}
