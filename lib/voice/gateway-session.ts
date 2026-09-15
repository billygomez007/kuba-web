import crypto from "node:crypto";

/**
 * Signs the short-lived session-bootstrap token the Voice Gateway
 * verifies (see superkuba-voice-gateway's src/session-token.ts, which
 * implements the identical HMAC-SHA256 + base64url scheme independently
 * — the two services share only a secret, never a library, since the
 * gateway is a separate codebase/deployment). Minted by kuba-web only
 * AFTER it has already resolved businessId/employeeId itself (inbound:
 * from the dialed number's registration; outbound: from the
 * authenticated dashboard request that created the call) — the gateway
 * never receives raw provider/caller input and infers tenant from it.
 *
 * Short TTL (default 5 minutes) — long enough to cover Plivo's own
 * connection-setup latency after receiving the answer XML, short enough
 * that a leaked/logged token stops being useful quickly. A `nonce` is
 * included so the gateway's session registry can refuse a second
 * WebSocket connection attempt for the same sessionId (replay
 * resistance without needing persistent, cross-restart nonce storage —
 * gateway sessions are explicitly not durable, see docs/VOICE_RUNTIME.md).
 */
export interface VoiceSessionClaims {
  sessionId: string;
  businessId: string;
  employeeId: string;
  provider: string;
  direction: "inbound" | "outbound";
  exp: number;
  nonce: string;
  /**
   * The live call's `conversations` row id, when kuba-web resolved one
   * before minting this token — optional (never required) because a cold
   * inbound call's conversation is only created moments later by
   * persistEvent, and that call is itself best-effort. Enables voice
   * tool calls (e.g. request_handoff) that need to know which
   * conversation to act on; a token without it simply can't use those.
   */
  conversationId?: string;
}

const DEFAULT_TTL_SECONDS = 5 * 60;

function getSecret(): string {
  const secret = process.env.VOICE_GATEWAY_SESSION_SECRET;
  if (!secret) throw new Error("VOICE_GATEWAY_SESSION_SECRET is required to sign voice gateway session tokens.");
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

export function createVoiceSessionToken(params: {
  sessionId: string;
  businessId: string;
  employeeId: string;
  provider: string;
  direction: "inbound" | "outbound";
  conversationId?: string;
  ttlSeconds?: number;
}): string {
  const claims: VoiceSessionClaims = {
    sessionId: params.sessionId,
    businessId: params.businessId,
    employeeId: params.employeeId,
    provider: params.provider,
    direction: params.direction,
    exp: Math.floor(Date.now() / 1000) + (params.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    nonce: crypto.randomBytes(12).toString("base64url"),
    ...(params.conversationId ? { conversationId: params.conversationId } : {}),
  };
  const encoded = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Verifies a token the gateway forwards back to kuba-web's internal API
 * (defense in depth — the gateway already verified it once to accept the
 * WebSocket, but kuba-web never trusts the gateway's word for who a
 * session belongs to; it re-verifies with its own copy of the secret).
 * Never throws — fails closed and quietly on any malformed/expired/
 * tampered input.
 */
export function verifyVoiceSessionToken(token: string): VoiceSessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    return null;
  }
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return null;
  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof payload?.sessionId !== "string" ||
      typeof payload?.businessId !== "string" ||
      typeof payload?.employeeId !== "string" ||
      typeof payload?.provider !== "string" ||
      (payload?.direction !== "inbound" && payload?.direction !== "outbound") ||
      typeof payload?.exp !== "number" ||
      typeof payload?.nonce !== "string" ||
      (payload?.conversationId !== undefined && typeof payload.conversationId !== "string")
    ) {
      return null;
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as VoiceSessionClaims;
  } catch {
    return null;
  }
}
