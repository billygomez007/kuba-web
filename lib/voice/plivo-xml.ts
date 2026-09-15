/**
 * Plivo call-control XML generation — isolated in its own module so the
 * "what does SuperKuba actually tell Plivo to do with this call" logic
 * is unit-testable without an HTTP request, and so there is exactly one
 * place that can generate this XML (never duplicated per route).
 *
 * Plivo supports both XML and JSON answer responses; XML is used here
 * to match this codebase's existing Twilio convention
 * (<Response>...</Response>).
 *
 * IMPORTANT — the <Stream> verb's exact attribute set below (bidirectional,
 * audioTrack, contentType) reflects Plivo's documented real-time-audio
 * streaming verb, but could not be verified against a live Plivo call
 * in this environment (no Plivo account access here). Confirm this
 * against Plivo's current Voice XML documentation before depending on
 * it for a real call — see docs/VOICE_RUNTIME.md, "Media bridge."
 *
 * contentType is µ-law at 8kHz deliberately — this MATCHES the format
 * lib/voice/adapters/openai-realtime.ts already configures OpenAI
 * Realtime sessions for (g711_ulaw both directions), so the Voice
 * Gateway needs no audio transcoding between Plivo and OpenAI, only
 * base64-framing translation between the two providers' JSON envelopes.
 * An earlier version of this file requested L16 PCM, which would have
 * required a real transcoder; reconciled to µ-law when the gateway
 * contract was designed specifically to avoid that.
 */

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The response used whenever no real-time audio bridge is configured
 * (VOICE_GATEWAY_URL unset — true in every environment today, see
 * docs/VOICE_RUNTIME.md). Honest, not silent: tells the caller SuperKuba
 * cannot currently complete the call, rather than connecting them to a
 * <Stream> URL that goes nowhere and produces dead air.
 */
export function buildUnavailableResponse(message = "We're unable to connect your call right now. Please try again later."): string {
  return `<Response><Speak>${escapeXml(message)}</Speak><Hangup/></Response>`;
}

/**
 * The response used once a real media bridge is configured. `streamUrl`
 * must already be the complete wss:// URL for the dedicated Voice
 * Gateway INCLUDING the signed, short-lived session token as a query
 * parameter (built by buildGatewayStreamUrl below) — never a URL inside
 * this Next.js app itself, which cannot hold a long-lived WebSocket
 * connection, and never a URL carrying raw business data (only the
 * opaque signed token).
 *
 * `customerPhoneNumber`, if given, is passed via Plivo's <Parameter>
 * child element — the mechanism Plivo's Stream verb specifically
 * provides for exactly this (relayed back to the gateway inside the
 * "start" event's customParameters, never appearing in the WebSocket
 * URL/query string itself, which stays limited to the opaque token).
 */
export function buildStreamResponse(streamUrl: string, customerPhoneNumber?: string): string {
  const parameter = customerPhoneNumber ? `<Parameter name="customerPhoneNumber" value="${escapeXml(customerPhoneNumber)}"/>` : "";
  return `<Response><Stream bidirectional="true" audioTrack="both" contentType="audio/x-mulaw;rate=8000">${escapeXml(streamUrl)}${parameter}</Stream></Response>`;
}

/** Reads the configured Voice Gateway base URL, or null if none is configured (every environment today). */
export function getVoiceGatewayUrl(): string | null {
  const value = process.env.VOICE_GATEWAY_URL?.trim();
  return value || null;
}

/** Builds the gateway's media-stream WebSocket URL, carrying only the opaque signed session token — never businessId/employeeId/phone numbers in the query string. */
export function buildGatewayStreamUrl(gatewayBaseUrl: string, sessionToken: string): string {
  const wsBase = gatewayBaseUrl.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsBase}/voice/stream?token=${encodeURIComponent(sessionToken)}`;
}

export function buildAnswerResponse(sessionToken: string | null, customerPhoneNumber?: string): string {
  const gatewayUrl = getVoiceGatewayUrl();
  if (!gatewayUrl || !sessionToken) return buildUnavailableResponse();
  return buildStreamResponse(buildGatewayStreamUrl(gatewayUrl, sessionToken), customerPhoneNumber);
}
