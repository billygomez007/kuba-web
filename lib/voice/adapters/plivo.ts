import type { VoiceTransport } from "@/lib/voice/providers";

/**
 * Plivo call-control transport. Platform-managed credentials only (see
 * Phase 3/31 of the voice audit) — PLIVO_AUTH_ID/PLIVO_AUTH_TOKEN are
 * read from server-side environment variables, the same pattern
 * lib/voice/adapters/twilio.ts already uses, never a per-business
 * pasted secret. No `plivo` npm package is installed or added — this
 * follows the codebase's existing convention (Twilio, Resend, WhatsApp)
 * of talking to provider REST APIs via raw `fetch` rather than an SDK
 * dependency.
 *
 * Like Twilio's adapter, `sendAudio` is an intentional dead stub — real
 * audio does not flow through this function. It flows (once a media
 * bridge exists — see docs/VOICE_RUNTIME.md, "Media bridge") through a
 * Plivo <Stream> WebSocket connection, which is a genuinely separate
 * piece of infrastructure this transport does not implement.
 *
 * IMPORTANT — Plivo's outbound Call API returns a `request_uuid`
 * synchronously, NOT the definitive `CallUUID` used in later
 * answer/status callbacks (unlike Twilio, whose Call API returns the
 * definitive SID immediately). `startCall` returns `request_uuid` as a
 * provisional `providerCallId`; the caller (app/api/voice/calls/route.ts)
 * reconciles the conversation's stored external id to the real
 * `CallUUID` once it arrives via the answer webhook. Verify this
 * behavior against a real Plivo account before relying on it for
 * anything billing- or reporting-sensitive — it could not be confirmed
 * against a live API response in this environment.
 */
export function createPlivoTransport(): VoiceTransport {
  const authId = process.env.PLIVO_AUTH_ID;
  const authToken = process.env.PLIVO_AUTH_TOKEN;
  const from = process.env.PLIVO_VOICE_NUMBER;
  const baseUrl = process.env.PUBLIC_APP_URL;
  const unavailable = () => { throw new Error("Plivo voice credentials are not configured."); };

  function authHeader() {
    return `Basic ${Buffer.from(`${authId}:${authToken}`).toString("base64")}`;
  }

  return {
    provider: "plivo",
    async connect(input) { return this.startCall(input); },
    async sendAudio() { throw new Error("Plivo audio is delivered through the configured Stream websocket, not this call."); },
    async stopAudio() { return; },
    async startCall(input) {
      if (!authId || !authToken || !from || !baseUrl || !input.phoneNumber) return unavailable() as never;
      // businessId is safe to embed here even though this is an
      // "inbound-looking" URL parameter: this call was only reached
      // because an authenticated, entitlement-checked dashboard request
      // already resolved and trusted this exact businessId (see the
      // "outbound" branch of app/api/voice/calls/route.ts) — it is not
      // attacker- or provider-supplied. Plivo's request signature covers
      // the full URL including this query string, so a third party
      // cannot forge a request against a different businessId/employeeId
      // pair without a valid signature for that exact URL.
      const answerUrl = `${baseUrl}/api/voice/plivo/answer?employeeId=${encodeURIComponent(input.employeeId)}&conversationId=${encodeURIComponent(input.conversationId)}`;
      const hangupUrl = `${baseUrl}/api/voice/plivo/status?employeeId=${encodeURIComponent(input.employeeId)}&conversationId=${encodeURIComponent(input.conversationId)}`;
      const response = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/`, {
        method: "POST",
        headers: { Authorization: authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({
          from: input.callerId || from,
          to: input.phoneNumber,
          answer_url: answerUrl,
          answer_method: "POST",
          hangup_url: hangupUrl,
          hangup_method: "POST",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Plivo call initiation failed.");
      return { providerCallId: data.request_uuid as string, status: "queued" as const };
    },
    async endCall({ providerCallId }) {
      if (!authId || !authToken) return unavailable() as never;
      const response = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/${providerCallId}/`, {
        method: "DELETE",
        headers: { Authorization: authHeader() },
      });
      if (!response.ok && response.status !== 204) throw new Error("Plivo call termination failed.");
    },
  };
}

export interface PlivoOwnedNumber {
  number: string;
  region: string | null;
  voiceEnabled: boolean;
  application: string | null;
}

/**
 * Reads the numbers already purchased in the platform's configured
 * Plivo account (Phase 6 — "do not fabricate numbers"). Server-side
 * only; never exposes PLIVO_AUTH_ID/PLIVO_AUTH_TOKEN to the caller.
 * Throws if credentials are not configured — callers decide how to
 * degrade (e.g. the settings route should return a clear "Plivo is not
 * configured on this platform" error, never an empty-but-successful
 * list that could be mistaken for "this Plivo account genuinely has no
 * numbers").
 */
export async function listPlivoNumbers(): Promise<PlivoOwnedNumber[]> {
  const authId = process.env.PLIVO_AUTH_ID;
  const authToken = process.env.PLIVO_AUTH_TOKEN;
  if (!authId || !authToken) throw new Error("Plivo credentials are not configured on this platform.");

  const numbers: PlivoOwnedNumber[] = [];
  const authorization = `Basic ${Buffer.from(`${authId}:${authToken}`).toString("base64")}`;
  let offset = 0;
  const limit = 20;
  for (let page = 0; page < 100; page += 1) {
    const response = await fetch(`https://api.plivo.com/v1/Account/${authId}/Number/?limit=${limit}&offset=${offset}`, {
      headers: { Authorization: authorization },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to read Plivo phone numbers.");
    const objects: unknown[] = Array.isArray(data.objects) ? data.objects : [];
    numbers.push(...objects.map((entry) => {
    const record = entry as Record<string, unknown>;
    return {
      number: typeof record.number === "string" ? record.number : "",
      region: typeof record.region === "string" ? record.region : null,
      voiceEnabled: record.voice_enabled === true || record.voice_enabled === "true",
      application: typeof record.application === "string" && record.application ? record.application : null,
    };
    }).filter((entry) => entry.number));
    const next = typeof data.meta?.next === "string" ? data.meta.next : "";
    if (objects.length < limit && !next) break;
    offset += objects.length || limit;
  }
  return numbers;
}
