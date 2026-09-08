import "server-only";

import { customerAccountConfig } from "./config";
import { getCustomerSession, setCustomerSession, type CustomerSession } from "./session";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  error?: string;
};

/** Silently renews an access token within a minute of expiry. */
async function refreshed(session: CustomerSession): Promise<CustomerSession> {
  if (session.expiresAt - Date.now() > 60_000) return session;

  const response = await fetch(customerAccountConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: customerAccountConfig.clientId,
      refresh_token: session.refreshToken,
    }),
  });

  const tokens = (await response.json()) as TokenResponse;
  if (!response.ok || tokens.error) {
    throw new Error(`Could not refresh the customer session: ${tokens.error ?? response.status}`);
  }

  const next: CustomerSession = {
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  await setCustomerSession(next);
  return next;
}

/**
 * Queries the Customer Account API as the signed-in customer. Returns `null`
 * with no request made when there is no session, so a page can render its
 * signed-out state instead of throwing.
 */
export async function customerAccountFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T | null> {
  const session = await getCustomerSession();
  if (!session) return null;

  const fresh = await refreshed(session);

  const response = await fetch(customerAccountConfig.graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: fresh.accessToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new Error(`Customer Account API: ${body.errors.map((e) => e.message).join("; ")}`);
  }

  return body.data ?? null;
}
