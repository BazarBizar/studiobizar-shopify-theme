import { NextResponse } from "next/server";

import { callbackUrl, customerAccountConfig } from "@/lib/customer-account/config";
import { consumePkceCookie, decodeIdToken, setCustomerSession } from "@/lib/customer-account/session";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

/** Exchanges the authorization code for tokens, then stores the session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const pkce = await consumePkceCookie();

  if (!code || !state || !pkce || state !== pkce.state) {
    return NextResponse.redirect(`${origin}/account?error=invalid-state`);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: customerAccountConfig.clientId,
    redirect_uri: callbackUrl(origin),
    code,
    code_verifier: pkce.codeVerifier,
  });

  let tokens: TokenResponse;
  try {
    const response = await fetch(customerAccountConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    tokens = (await response.json()) as TokenResponse;
    if (!response.ok || tokens.error) {
      console.error("[auth/callback] token exchange failed", tokens.error, tokens.error_description);
      return NextResponse.redirect(`${origin}/account?error=token-exchange`);
    }
  } catch (error) {
    console.error("[auth/callback] token exchange threw", error);
    return NextResponse.redirect(`${origin}/account?error=token-exchange`);
  }

  const { email, firstName } = decodeIdToken(tokens.id_token);

  await setCustomerSession({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    email,
    firstName,
  });

  return NextResponse.redirect(`${origin}/account`);
}
