import crypto from "node:crypto";

/**
 * Plivo's request-signature validation (the "V2" scheme: an HMAC-SHA256
 * signature over the exact request URL concatenated with a nonce Plivo
 * also sends, keyed by the account's Auth Token, base64-encoded).
 * Verified against Plivo's own documentation at the time this was
 * written, matching this codebase's existing convention of implementing
 * provider signature verification by hand rather than depending on a
 * provider SDK (see lib/voice/twilio-signature.ts, lib/email/
 * webhook-signature.ts, lib/channels/whatsapp.ts's verifyMetaSignature)
 * — no `plivo` npm package is installed in this repo, and none is added
 * for this.
 *
 * IMPORTANT — verify before relying on this in production: this
 * implementation could not be checked against an installed Plivo SDK
 * (none exists in this repo) or live API response, only against
 * documented behavior. Before activating real inbound Plivo calls,
 * confirm this still matches Plivo's current signature-validation
 * documentation for your account/application type — the same caution
 * this codebase already applies to unverifiable provider payload shapes
 * elsewhere (see docs/EMAIL_RUNTIME.md, "Provider").
 *
 * Like Twilio's verifier, the URL used for the signature MUST be the
 * exact public URL Plivo sent the request to (including query string) —
 * never a locally-reconstructed guess — or every signature will fail
 * closed even for genuine requests.
 */
export function verifyPlivoSignature(
  url: string,
  nonce: string | null,
  signature: string | null,
): boolean {
  const authToken = process.env.PLIVO_AUTH_TOKEN;
  if (!authToken || !nonce || !signature) return false;

  const expected = crypto
    .createHmac("sha256", authToken)
    .update(Buffer.from(`${url}${nonce}`, "utf-8"))
    .digest("base64");

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);

  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
