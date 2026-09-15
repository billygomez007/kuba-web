import { safeCompareSecret } from "@/lib/auth/security";
import { verifyVoiceSessionToken, type VoiceSessionClaims } from "@/lib/voice/gateway-session";

/**
 * Shared guard for every app/api/internal/voice/* route (Phase 7-9):
 * BOTH the service-to-service shared secret (proves the caller is the
 * Voice Gateway, not an arbitrary public POST) AND the signed session
 * token (proves which specific call/business/employee this request is
 * for) must be valid. Neither alone is sufficient — a leaked internal
 * secret without a valid session token still can't touch any specific
 * business's data, and a valid session token without the internal
 * secret still can't reach these routes at all (they are not public API
 * — Phase 7: "Do NOT expose public tenant mutation endpoints").
 */
export type InternalAuthResult = { ok: true; claims: VoiceSessionClaims } | { ok: false; status: 401 | 403; error: string };

export function requireGatewayInternalAuth(request: Request, token: unknown): InternalAuthResult {
  const secret = request.headers.get("x-voice-gateway-internal-secret");
  if (!safeCompareSecret(secret, process.env.VOICE_GATEWAY_INTERNAL_SECRET)) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  if (typeof token !== "string" || !token) {
    return { ok: false, status: 403, error: "Invalid session token." };
  }
  const claims = verifyVoiceSessionToken(token);
  if (!claims) {
    return { ok: false, status: 403, error: "Invalid or expired session token." };
  }
  return { ok: true, claims };
}
