import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { customerAccountFetch } from "@/lib/customer-account/client";
import { customerAccountConfigured } from "@/lib/customer-account/config";
import { getCustomerSession } from "@/lib/customer-account/session";
import { getInquiriesByEmail } from "@/lib/inquiry/list";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "inquiries", label: "Inquiries" },
  { key: "addresses", label: "Addresses" },
  { key: "details", label: "Details" },
  { key: "password", label: "Password" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type CustomerDetails = {
  customer: {
    firstName: string | null;
    lastName: string | null;
    emailAddress: { emailAddress: string } | null;
    phoneNumber: { phoneNumber: string } | null;
    defaultAddress: { formattedArea: string | null } | null;
    addresses: {
      nodes: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        address1: string | null;
        address2: string | null;
        city: string | null;
        zip: string | null;
        territoryCode: string | null;
      }[];
    };
  } | null;
};

// Field names per Shopify's documented Customer Account API schema — this
// tab is the one part of this page that has never run against a live
// connection (see lib/customer-account/config.ts) and so is unverified;
// confirm the shape once SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID is set.
const CUSTOMER_QUERY = /* GraphQL */ `
  query Customer {
    customer {
      firstName
      lastName
      emailAddress {
        emailAddress
      }
      phoneNumber {
        phoneNumber
      }
      defaultAddress {
        formattedArea
      }
      addresses(first: 10) {
        nodes {
          id
          firstName
          lastName
          address1
          address2
          city
          zip
          territoryCode
        }
      }
    }
  }
`;

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const { tab } = await searchParams;
  const active: TabKey = TABS.some((t) => t.key === tab) ? (tab as TabKey) : "overview";

  const configured = customerAccountConfigured();
  const session = configured ? await getCustomerSession() : null;

  if (!configured || !session) {
    return (
      <PageShell surface="light">
        <Container className="py-section">
          <h1 className="text-h1">My Account</h1>
          <p className="text-body mt-6 max-w-[34rem] text-muted">
            {configured
              ? "Sign in to see your inquiries, addresses and details."
              : "Customer accounts are not connected on this storefront yet."}
          </p>
          {configured ? (
            <ButtonLink href="/api/auth/login" className="mt-8">
              Sign in
            </ButtonLink>
          ) : (
            <p className="text-tertiary mt-4 max-w-[34rem] text-muted">
              This needs a one-time setup in Shopify Admin — see the comment in{" "}
              <code className="text-tertiary">lib/customer-account/config.ts</code>.
            </p>
          )}
        </Container>
      </PageShell>
    );
  }

  const [inquiries, customerData] = await Promise.all([
    session.email ? getInquiriesByEmail(session.email).catch(() => []) : Promise.resolve([]),
    customerAccountFetch<CustomerDetails>(CUSTOMER_QUERY).catch(() => null),
  ]);
  const customer = customerData?.customer ?? null;

  return (
    <PageShell surface="light">
      <Container className="py-section">
        <div className="flex items-center justify-between gap-6">
          <h1 className="text-h1">My Account</h1>
          <Link href="/api/auth/logout" className="text-secondary sb-underline">
            Sign out
          </Link>
        </div>

        <nav aria-label="Account" className="mt-10 border-b border-border">
          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {TABS.map((t) => (
              <li key={t.key}>
                <Link
                  href={t.key === "overview" ? "/account" : `/account?tab=${t.key}`}
                  aria-current={active === t.key ? "page" : undefined}
                  className={cn(
                    "text-secondary inline-block border-b-2 border-transparent pb-4 lowercase",
                    active === t.key ? "border-foreground font-medium" : "text-muted",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 max-w-[40rem]">
          {active === "overview" && (
            <div>
              <p className="text-h3">
                {session.firstName ? `Welcome back, ${session.firstName}.` : "Welcome back."}
              </p>
              <p className="text-secondary mt-2 text-muted">{session.email}</p>
              <p className="text-secondary mt-6">
                {inquiries.length === 0
                  ? "No inquiries yet."
                  : `${inquiries.length} inquir${inquiries.length === 1 ? "y" : "ies"} on file.`}
              </p>
            </div>
          )}

          {active === "inquiries" && (
            <div>
              {inquiries.length === 0 ? (
                <p className="text-body text-muted">
                  Nothing here yet — inquiries you submit from the shop will show up in this list.
                </p>
              ) : (
                <ul className="flex flex-col gap-8">
                  {inquiries.map((inquiry) => (
                    <li key={inquiry.id} className="border-b border-border pb-8">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-secondary font-medium tabular-nums">{inquiry.inquiryId}</p>
                        <p className="text-tertiary text-muted">
                          {new Date(inquiry.submittedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <p className="text-tertiary mt-1 text-muted uppercase tracking-[0.06em]">
                        {inquiry.status}
                      </p>
                      <ul className="mt-4 flex flex-col gap-1">
                        {inquiry.items.map((item, index) => (
                          <li key={index} className="text-secondary flex justify-between gap-4">
                            <span>
                              {item.title}
                              {item.variantTitle ? ` — ${item.variantTitle}` : ""}
                            </span>
                            <span className="text-muted tabular-nums">×{item.qty}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {active === "addresses" && (
            <div>
              {!customerData ? (
                <p className="text-body text-muted">Could not load your addresses right now.</p>
              ) : customer?.addresses.nodes.length ? (
                <ul className="flex flex-col gap-6">
                  {customer.addresses.nodes.map((address) => (
                    <li key={address.id} className="border-b border-border pb-6">
                      <p className="text-secondary">
                        {[address.firstName, address.lastName].filter(Boolean).join(" ")}
                      </p>
                      <p className="text-secondary text-muted">{address.address1}</p>
                      {address.address2 && <p className="text-secondary text-muted">{address.address2}</p>}
                      <p className="text-secondary text-muted">
                        {[address.city, address.zip, address.territoryCode].filter(Boolean).join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-muted">No addresses saved yet.</p>
              )}
            </div>
          )}

          {active === "details" && (
            <div>
              {!customerData ? (
                <p className="text-body text-muted">Could not load your details right now.</p>
              ) : (
                <dl className="flex flex-col gap-4">
                  <div>
                    <dt className="text-tertiary text-muted uppercase tracking-[0.06em]">Name</dt>
                    <dd className="text-secondary mt-1">
                      {[customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tertiary text-muted uppercase tracking-[0.06em]">Email</dt>
                    <dd className="text-secondary mt-1">
                      {customer?.emailAddress?.emailAddress ?? session.email ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tertiary text-muted uppercase tracking-[0.06em]">Phone</dt>
                    <dd className="text-secondary mt-1">{customer?.phoneNumber?.phoneNumber ?? "—"}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}

          {active === "password" && (
            <div>
              <p className="text-body text-muted">
                This storefront signs in with a one-time code sent to your email rather than a stored
                password, so there is nothing to change here. If you need to update the email itself,
                use the Details tab.
              </p>
            </div>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
