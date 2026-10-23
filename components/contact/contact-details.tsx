import { ContactForm } from "@/components/contact/contact-form";
import type { ContactChannel } from "@/lib/shopify/entities";
import { cn } from "@/lib/utils/cn";

/** email / phone / url / text — the `link_type` choices on the metaobject. */
function channelHref(linkType: string | null, value: string, linkUrl: string | null) {
  if (linkUrl) return linkUrl;
  if (linkType === "email") return `mailto:${value}`;
  if (linkType === "phone") return `tel:${value.replace(/\s+/g, "")}`;
  return null;
}

/**
 * The Contact page's two columns: how to reach us on the left, the form on the
 * right — the design splits at x=20 and x=873.
 */
export function ContactDetails({
  channels,
  inquiryTypes,
  className,
}: {
  channels: ContactChannel[];
  inquiryTypes: string[];
  className?: string;
}) {
  return (
    <div className={cn(className, "grid gap-16 lg:grid-cols-2 lg:gap-24")}>
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
                      {...(channel.linkType === "url" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
  );
}
