import { NextResponse } from "next/server";

import { customerAccountConfig } from "@/lib/customer-account/config";
import { clearCustomerSession, getCustomerSession } from "@/lib/customer-account/session";

/** Clears the local session, then Shopify's own — otherwise "sign in" again
 *  silently re-authenticates against the still-live Shopify-side session. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const session = await getCustomerSession();
  await clearCustomerSession();

  if (!session) return NextResponse.redirect(origin);

  const logout = new URL(customerAccountConfig.logoutUrl);
  logout.searchParams.set("id_token_hint", session.idToken);
  logout.searchParams.set("post_logout_redirect_uri", origin);

  return NextResponse.redirect(logout.toString());
}
