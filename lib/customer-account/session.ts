import "server-only";

import { cookies } from "next/headers";

const SESSION_COOKIE = "sb_customer_session";
const PKCE_COOKIE = "sb_customer_pkce";

export type CustomerSession = {
  accessToken: string;
  refreshToken: string;
  /** Kept only to hand back to Shopify's own logout endpoint as a hint. */
  idToken: string;
  /** Epoch ms. */
  expiresAt: number;
  email: string | null;
  firstName: string | null;
};

/** Decodes the id_token's payload for display purposes only — this app never
 *  trusts it for access control; every real request re-presents the access
 *  token to Shopify, which does its own verification. */
export function decodeIdToken(idToken: string): { email: string | null; firstName: string | null } {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return { email: null, firstName: null };
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as { email?: string; given_name?: string };
    return { email: claims.email ?? null, firstName: claims.given_name ?? null };
  } catch {
    return { email: null, firstName: null };
  }
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CustomerSession;
  } catch {
    return null;
  }
}

export async function setCustomerSession(session: CustomerSession) {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // A little past the refresh token's own life is pointless — expiresAt
    // drives silent refresh; this is just the outer bound.
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCustomerSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Short-lived: holds the PKCE verifier + state between /login and /callback. */
export async function setPkceCookie(value: { codeVerifier: string; state: string }) {
  const store = await cookies();
  store.set(PKCE_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function consumePkceCookie(): Promise<{ codeVerifier: string; state: string } | null> {
  const store = await cookies();
  const raw = store.get(PKCE_COOKIE)?.value;
  store.delete(PKCE_COOKIE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { codeVerifier: string; state: string };
  } catch {
    return null;
  }
}
