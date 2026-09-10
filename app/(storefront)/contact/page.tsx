import type { Metadata } from "next";

import { ContactForm } from "@/components/contact/contact-form";
import { PageShell } from "@/components/layout/page-shell";
import { Container } from "@/components/ui/container";
import { GoBack } from "@/components/ui/go-back";
import { getPage } from "@/lib/shopify";
import {
  fieldInt,
  fieldText,
  metafieldList,
  metafieldMetaobjects,
  metafieldRichText,
  toFieldMap,
  toMetafieldMap,
} from "@/lib/shopify/transforms";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Studio Bizar, Duffelsesteenweg 152, Kontich, Antwerp. General, trade and press contacts, or send us a message.",
  alternates: { canonical: "/contact" },
};

/** email / phone / url / text — the `link_type` choices on the metaobject. */
function channelHref(linkType: string | null, value: string, linkUrl: string | null) {
  if (linkUrl) return linkUrl;
  if (linkType === "email") return `mailto:${value}`;
  if (linkType === "phone") return `tel:${value.replace(/\s+/g, "")}`;
  return null;
}

export default async function ContactPage() {
  const page = await getPage("contact").catch(() => null);
  const metafields = toMetafieldMap(page?.metafields);

  const intro = metafieldRichText(metafields, "intro_body");
  const inquiryTypes = metafieldList(metafields, "inquiry_types");

  const channels = metafieldMetaobjects(metafields, "channels")
    .map((entry) => {
      const fields = toFieldMap(entry.fields);
      return {
        handle: entry.handle,
        label: fieldText(fields, "label") ?? "",
        value: fieldText(fields, "value") ?? "",
        linkType: fieldText(fields, "link_type"),
        linkUrl: fieldText(fields, "link_url"),
        sortOrder: fieldInt(fields, "sort_order"),
      };
    })
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

  return (
    <PageShell surface="mocha" footerSurface="dark">
      <Container className="pt-12 pb-section">
        <h1 className="text-h1">Contact</h1>
        {intro && (
          <div className="sb-prose mt-6 max-w-[36rem] text-h2" dangerouslySetInnerHTML={{ __html: intro }} />
        )}

        {/* Channels left, form right — the design splits at x=20 and x=873. */}
        <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:gap-24">
          <div>
            <h2 className="sr-only">How to reach us</h2>
            <dl className="flex flex-col gap-8">
              {channels.map((channel) => {
                const href = channelHref(channel.linkType, channel.value, channel.linkUrl);
                return (
                  <div key={channel.handle} className="grid gap-1 sm:grid-cols-[14rem_1fr] sm:gap-4">
                    <dt className="text-h3">{channel.label}</dt>
                    <dd className="text-body">
                      {href ? (
                        <a
                          href={href}
                          {...(channel.linkType === "url"
                            ? { target: "_blank", rel: "noopener noreferrer" }
                            : {})}
                          className="sb-underline"
                        >
                          {channel.value}
                        </a>
                      ) : (
                        channel.value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <ContactForm inquiryTypes={inquiryTypes.length ? inquiryTypes : ["General"]} />
        </div>
      </Container>

      <Container className="pb-section">
        <GoBack fallbackHref="/" />
      </Container>
    </PageShell>
  );
}
