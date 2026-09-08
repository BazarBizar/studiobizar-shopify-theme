import { NextResponse } from "next/server";

import { callbackUrl, customerAccountConfig, customerAccountConfigured } from "@/lib/customer-account/config";
import { createPkcePair, randomToken } from "@/lib/customer-account/pkce";
import { setPkceCookie } from "@/lib/customer-account/session";

/** Starts the Shopify Customer Account sign-in — see lib/customer-account/config.ts. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  if (!customerAccountConfigured()) {
    return NextResponse.redirect(`${origin}/account?error=not-connected`);
  }

  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = randomToken(16);
  await setPkceCookie({ codeVerifier, state });

  const authorize = new URL(customerAccountConfig.authorizeUrl);
  authorize.searchParams.set("client_id", customerAccountConfig.clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", callbackUrl(origin));
  authorize.searchParams.set("scope", customerAccountConfig.scope);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", codeChallenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(authorize.toString());
}
