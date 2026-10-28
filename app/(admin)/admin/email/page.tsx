import { redirect } from "next/navigation";

import { EmailScreen } from "@/components/admin/email/email-screen";
import { PageHeader } from "@/components/admin/page-header";
import { currentStaff } from "@/lib/admin/auth";
import { STAFF_LOGIN_PATH } from "@/lib/admin/cookie";
import { emailSettingsView } from "@/lib/admin/email-settings";
import { CONTACT_MESSAGE_TYPE, countNewMessages, countSubscribers, SUBSCRIBER_TYPE } from "@/lib/admin/messages";
import { listDefinitions } from "@/lib/admin/metaobjects";
import { siteWideTabHref } from "@/lib/admin/site-wide";
import { BRAND } from "@/lib/brand";
import { notificationRecipients } from "@/lib/email/notification-recipients";

export const metadata = { title: "Email" };

/**
 * How the website sends email — the Resend key, the sender, a test — and who receives
 * what, on one screen. What used to be `RESEND_API_KEY` / `RESEND_FROM_EMAIL` in `.env`
 * only; see `lib/email/settings.ts` for where it is kept and what wins.
 */
export default async function EmailPage() {
  const staff = await currentStaff();
  if (!staff) redirect(STAFF_LOGIN_PATH);

  const [settings, contact, inquiry, definitions] = await Promise.all([
    emailSettingsView(),
    notificationRecipients("contact"),
    notificationRecipients("product_inquiry"),
    listDefinitions(),
  ]);
  const has = (type: string) => definitions.some((definition) => definition.type === type);
  const [messages, subscribers] = await Promise.all([
    has(CONTACT_MESSAGE_TYPE) ? countNewMessages() : null,
    has(SUBSCRIBER_TYPE) ? countSubscribers() : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email"
        description="How the website sends email: contact form messages, product inquiries and the confirmation customers get."
      />
      <EmailScreen
        me={staff.email}
        brand={BRAND.name}
        settings={settings}
        routes={[
          { label: "Contact form messages", to: contact.to },
          { label: "Product inquiries", to: inquiry.to },
        ]}
        rulesHref={has("email_notification") ? siteWideTabHref("email_notification") : null}
        canAddRule={has("email_notification")}
        inbox={{
          messages: messages ? { href: `/admin/${CONTACT_MESSAGE_TYPE}`, total: messages.total, fresh: messages.fresh } : null,
          subscribers: subscribers === null ? null : { href: `/admin/${SUBSCRIBER_TYPE}`, total: subscribers },
        }}
      />
    </div>
  );
}
