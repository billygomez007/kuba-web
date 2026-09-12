import crypto from "crypto";

/**
 * Signed, stateless, non-guessable unsubscribe token. Reuses
 * BETTER_AUTH_SECRET (already-required infrastructure) rather than
 * introducing a new dedicated secret. Deliberately does not expose any raw
 * database id as the sole authorization — the signature is what makes the
 * token unforgeable, not the values it carries, which are otherwise plain
 * JSON.
 */
export interface UnsubscribeTokenPayload {
  businessId: string;
  recipientId: string;
  channel: "email" | "phone";
  identity: string;
}

function getSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required to sign unsubscribe tokens.");
  return secret;
}

function encodePayload(payload: UnsubscribeTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sign(encodedPayload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

export function createUnsubscribeToken(payload: UnsubscribeTokenPayload): string {
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Returns the payload only if the signature is valid; otherwise null. Never
 * throws on malformed input — an unsubscribe link is followed by an
 * unauthenticated third party, so this must fail closed and quietly.
 */
export function verifyUnsubscribeToken(token: string): UnsubscribeTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof payload?.businessId !== "string" ||
      typeof payload?.recipientId !== "string" ||
      (payload?.channel !== "email" && payload?.channel !== "phone") ||
      typeof payload?.identity !== "string"
    ) {
      return null;
    }
    return payload as UnsubscribeTokenPayload;
  } catch {
    return null;
  }
}
