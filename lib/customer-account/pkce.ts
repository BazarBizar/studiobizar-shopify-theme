import { createHash, randomBytes } from "node:crypto";

/** Base64url, no padding — what every part of the OAuth handshake wants. */
function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(randomBytes(bytes));
}

/** PKCE (RFC 7636): a verifier the browser never reveals, and its S256 hash. */
export function createPkcePair() {
  const codeVerifier = randomToken(32);
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}
