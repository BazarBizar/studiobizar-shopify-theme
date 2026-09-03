import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * The closing block on Collections Detail, Our Designers, Our Story, Service
 * and the Landing page. Copy is transcribed from the designs.
 */
export function ContactCta() {
  return (
    <Container className="py-section">
      <p className="text-h2 max-w-[38rem]">
        Whether you have a question about an order, a product, or would like more information about
        what we do, we’d love to hear from you.
      </p>
      <ButtonLink href="/contact" variant="outline" className="mt-8">
        contact us
      </ButtonLink>
    </Container>
  );
}
