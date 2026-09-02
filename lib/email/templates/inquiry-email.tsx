import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

import { BRAND } from "@/lib/brand";

/**
 * One layout, two audiences. Styling is inline and table-based because email
 * clients ignore most CSS; colours come from `lib/brand.ts` so they track the
 * palette in globals.css.
 */

export type InquiryEmailItem = {
  sku: string | null;
  title: string;
  variantTitle?: string | null;
  qty: number;
};

export type InquiryEmailProps = {
  inquiryId: string;
  submittedAt: Date;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  message?: string;
  items: InquiryEmailItem[];
  /** Internal copy adds the customer's details and drops the pleasantries. */
  audience: "customer" | "internal";
};

const styles = {
  body: {
    backgroundColor: BRAND.earth,
    fontFamily: "Helvetica, Arial, sans-serif",
    color: BRAND.ink,
    margin: 0,
    padding: "32px 0",
  },
  container: {
    backgroundColor: BRAND.paper,
    maxWidth: "600px",
    margin: "0 auto",
    padding: "40px",
  },
  heading: { color: BRAND.heading, fontSize: "24px", fontWeight: 600, margin: "0 0 8px" },
  tagline: { color: BRAND.muted, fontSize: "13px", margin: "0 0 28px" },
  label: { color: BRAND.muted, fontSize: "12px", margin: 0, textTransform: "uppercase" as const },
  value: { color: BRAND.ink, fontSize: "14px", margin: "0 0 14px" },
  text: { color: BRAND.ink, fontSize: "14px", lineHeight: "22px", margin: "0 0 14px" },
  hr: { borderColor: BRAND.border, margin: "26px 0" },
  th: {
    color: BRAND.muted,
    fontSize: "11px",
    textTransform: "uppercase" as const,
    padding: "8px 6px",
    borderBottom: `1px solid ${BRAND.border}`,
    textAlign: "left" as const,
  },
  td: {
    color: BRAND.ink,
    fontSize: "13px",
    padding: "10px 6px",
    borderBottom: `1px solid ${BRAND.border}`,
  },
  footer: { color: BRAND.muted, fontSize: "12px", lineHeight: "18px", margin: "6px 0 0" },
};

export function InquiryEmail({
  inquiryId,
  submittedAt,
  name,
  company,
  email,
  phone,
  message,
  items,
  audience,
}: InquiryEmailProps) {
  const internal = audience === "internal";
  const totalQuantity = items.reduce((total, item) => total + item.qty, 0);

  const preview = internal
    ? `New inquiry ${inquiryId} from ${name}`
    : `Your inquiry ${inquiryId} is with us`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            {internal ? "New product inquiry" : "Thank you — your inquiry is with us"}
          </Heading>
          <Text style={styles.tagline}>
            {BRAND.name} — {BRAND.tagline}
          </Text>

          {!internal && (
            <Text style={styles.text}>
              Hello {name}, thank you for your interest. Your inquiry is below and attached as a
              PDF. We’ll come back to you by email, usually within two working days, with
              availability, lead times and pricing.
            </Text>
          )}

          <Section>
            <Text style={styles.label}>Inquiry reference</Text>
            <Text style={styles.value}>{inquiryId}</Text>

            <Text style={styles.label}>Submitted</Text>
            <Text style={styles.value}>
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "UTC",
              }).format(submittedAt)}{" "}
              UTC
            </Text>

            {internal && (
              <>
                <Text style={styles.label}>From</Text>
                <Text style={styles.value}>
                  {name}
                  {company ? ` · ${company}` : ""}
                  <br />
                  {email}
                  {phone ? ` · ${phone}` : ""}
                </Text>
              </>
            )}
          </Section>

          <Hr style={styles.hr} />

          <Section>
            <Row>
              <Column style={styles.th}>SKU</Column>
              <Column style={styles.th}>Product</Column>
              <Column style={{ ...styles.th, textAlign: "right" }}>Qty</Column>
            </Row>

            {items.map((item) => (
              <Row key={`${item.sku ?? item.title}-${item.qty}`}>
                <Column style={styles.td}>{item.sku ?? "—"}</Column>
                <Column style={styles.td}>
                  {item.title}
                  {item.variantTitle ? ` · ${item.variantTitle}` : ""}
                </Column>
                <Column style={{ ...styles.td, textAlign: "right" }}>{item.qty}</Column>
              </Row>
            ))}
          </Section>

          <Text style={{ ...styles.text, marginTop: "18px" }}>
            {items.length} {items.length === 1 ? "product" : "products"} · {totalQuantity} total
            quantity
          </Text>

          {message && (
            <>
              <Hr style={styles.hr} />
              <Text style={styles.label}>Message</Text>
              <Text style={styles.text}>{message}</Text>
            </>
          )}

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            This is an inquiry, not an order confirmation. Nothing has been charged.
          </Text>
          <Text style={styles.footer}>{BRAND.url}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default InquiryEmail;
