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
 */

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The response used whenever no real-time audio bridge is configured
 * (VOICE_GATEWAY_STREAM_URL unset — true in every environment today,
 * see docs/VOICE_RUNTIME.md). Honest, not silent: tells the caller
 * SuperKuba cannot currently complete the call, rather than connecting
 * them to a <Stream> URL that goes nowhere and produces dead air.
 */
export function buildUnavailableResponse(message = "We're unable to connect your call right now. Please try again later."): string {
  return `<Response><Speak>${escapeXml(message)}</Speak><Hangup/></Response>`;
}

/**
 * The response used once a real media bridge is configured. `streamUrl`
 * must be a wss:// URL for the dedicated Voice Gateway (see
 * docs/VOICE_RUNTIME.md) — never a URL inside this Next.js app itself,
 * which cannot hold a long-lived WebSocket connection.
 */
export function buildStreamResponse(streamUrl: string): string {
  return `<Response><Stream bidirectional="true" audioTrack="both" contentType="audio/x-l16;rate=8000">${escapeXml(streamUrl)}</Stream></Response>`;
}

/** Reads the configured media-bridge URL, or null if none is configured (every environment today). */
export function getVoiceGatewayStreamUrl(): string | null {
  const value = process.env.VOICE_GATEWAY_STREAM_URL?.trim();
  return value || null;
}

export function buildAnswerResponse(): string {
  const gatewayUrl = getVoiceGatewayStreamUrl();
  return gatewayUrl ? buildStreamResponse(gatewayUrl) : buildUnavailableResponse();
}
