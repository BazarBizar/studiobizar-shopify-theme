import "server-only";

import { OPERATIONS } from "./operations";
import { adminGraphQL, assertNoUserErrors } from "./shopify";

/**
 * Customers.
 *
 * WRITE SCOPE: `note` and `tags`, nothing else. No create, no delete, and no edit of the
 * customer's own details — an account is a record Shopify owns, the same reasoning that
 * makes inquiries read-only. What the panel may write is its OWN annotations about a
 * customer, which is what a note and a tag are.
 *
 * WHAT THIS STORE DOES NOT HAVE, and why the module is smaller than it might be
 * elsewhere:
 *
 *  - **No B2B companies.** Company accounts are a Shopify Plus feature and this store is
 *    on Basic, so there is no master/employee relationship, no inherited status and no
 *    approval flow. Building the inherited-status card and the approval email against an
 *    API this plan does not expose would be building something untestable that reports
 *    states that cannot occur.
 *  - **No CUSTOMER metafield definitions**, so there is no customer category to show or
 *    filter by.
 *  - **No customers and no orders yet**, so the screen is honestly empty rather than
 *    demonstrating anything.
 *
 * `state` below is Shopify's own account state (`ENABLED`, `INVITED`, `DECLINED`,
 * `DISABLED`) — the only status a non-Plus store has. It is displayed, never written:
 * Shopify manages it through invitation and account activation, and a value written here
 * would contradict that.
 */

const CUSTOMER_GID_PREFIX = "gid://shopify/Customer/";

export function customerIdFromParam(param: string): string | null {
  return /^\d+$/.test(param) ? `${CUSTOMER_GID_PREFIX}${param}` : null;
}

export function paramFromCustomerId(id: string): string {
  return id.startsWith(CUSTOMER_GID_PREFIX) ? id.slice(CUSTOMER_GID_PREFIX.length) : id;
}

/** Shopify's enum, in words. Never shown raw. */
const STATE_LABELS: Record<string, string> = {
  ENABLED: "Enabled",
  INVITED: "Invited",
  DECLINED: "Declined",
  DISABLED: "Disabled",
};

export function customerStateLabel(state: string | null | undefined): string {
  if (!state) return "—";
  return STATE_LABELS[state] ?? state.toLowerCase().replace(/_/g, " ");
}

export type CustomerRow = {
  id: string;
  param: string;
  name: string;
  email: string | null;
  phone: string | null;
  state: string;
  stateLabel: string;
  tags: string[];
  orders: number;
  spent: { amount: string; currencyCode: string } | null;
  location: string | null;
  createdAt: string;
};

type RawCustomer = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  state: string;
  note: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  numberOfOrders: string | number;
  amountSpent: { amount: string; currencyCode: string } | null;
  defaultAddress: { formatted?: string[]; formattedArea: string | null } | null;
};

function toRow(raw: RawCustomer): CustomerRow {
  return {
    id: raw.id,
    param: paramFromCustomerId(raw.id),
    name: raw.displayName || [raw.firstName, raw.lastName].filter(Boolean).join(" ") || "—",
    email: raw.email,
    phone: raw.phone,
    state: raw.state,
    stateLabel: customerStateLabel(raw.state),
    tags: raw.tags,
    // Shopify returns this as an UnsignedInt64, which arrives as a string.
    orders: Number(raw.numberOfOrders ?? 0),
    spent: raw.amountSpent,
    location: raw.defaultAddress?.formattedArea ?? null,
    createdAt: raw.createdAt,
  };
}

export async function listCustomers({
  first = 100,
  after = null,
  query = null,
}: { first?: number; after?: string | null; query?: string | null } = {}): Promise<{
  customers: CustomerRow[];
  hasNextPage: boolean;
  endCursor: string | null;
}> {
  const data = await adminGraphQL<{
    customers: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RawCustomer[];
    };
  }>("customers", OPERATIONS.customers.document, { first, after, query });

  return {
    customers: data.customers.nodes.map(toRow),
    hasNextPage: data.customers.pageInfo.hasNextPage,
    endCursor: data.customers.pageInfo.endCursor,
  };
}

/**
 * Every customer. Client strategy while the list is small — this store has none today.
 * Past roughly a thousand it must move to the server strategy, and the column filters
 * have to go with it, because a facet over a partial set silently omits matches.
 */
export async function listAllCustomers(): Promise<CustomerRow[]> {
  const all: CustomerRow[] = [];
  let after: string | null = null;

  for (;;) {
    const page = await listCustomers({ first: 250, after });
    all.push(...page.customers);
    if (!page.hasNextPage || !page.endCursor) break;
    after = page.endCursor;
  }

  return all;
}

export async function countCustomers(): Promise<number> {
  const data = await adminGraphQL<{ customersCount: { count: number } }>(
    "customersCount",
    OPERATIONS.customersCount.document,
    { query: null },
  );
  return data.customersCount.count;
}

export type CustomerDetail = CustomerRow & {
  note: string | null;
  verifiedEmail: boolean;
  updatedAt: string;
  addressLines: string[];
  addresses: { id: string; formatted: string[] }[];
  metafields: { id: string; key: string; type: string; value: string }[];
};

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const data = await adminGraphQL<{
    customer:
      | (RawCustomer & {
          verifiedEmail: boolean;
          addresses: { id: string; formatted: string[] }[];
          metafields: { nodes: { id: string; key: string; type: string; value: string }[] };
        })
      | null;
  }>("customer", OPERATIONS.customer.document, { id });

  const raw = data.customer;
  if (!raw) return null;

  return {
    ...toRow(raw),
    note: raw.note,
    verifiedEmail: raw.verifiedEmail,
    updatedAt: raw.updatedAt,
    addressLines: raw.defaultAddress?.formatted ?? [],
    addresses: raw.addresses ?? [],
    metafields: raw.metafields?.nodes ?? [],
  };
}

/**
 * The only write. `note` and `tags` are the operator's annotations about a customer, not
 * the customer's own details — the same distinction that lets an inquiry's status change
 * while the customer's words stay untouched.
 */
export async function annotateCustomer(
  id: string,
  annotation: { note?: string; tags?: string[] },
) {
  const data = await adminGraphQL<{
    customerUpdate: {
      customer: { id: string; note: string | null; tags: string[] } | null;
      userErrors: { field?: string[] | null; message: string }[];
    };
  }>("customerUpdate", OPERATIONS.customerUpdate.document, {
    input: {
      id,
      ...(annotation.note !== undefined ? { note: annotation.note } : {}),
      ...(annotation.tags !== undefined ? { tags: annotation.tags } : {}),
    },
  });

  assertNoUserErrors(data.customerUpdate.userErrors);
  if (!data.customerUpdate.customer) throw new Error("Shopify updated nothing.");

  return data.customerUpdate.customer;
}
