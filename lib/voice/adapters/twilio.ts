import type { VoiceTransport } from "@/lib/voice/providers";

export function createTwilioTransport(): VoiceTransport {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_VOICE_NUMBER;
  const baseUrl = process.env.PUBLIC_APP_URL;
  const unavailable = () => { throw new Error("Twilio voice credentials are not configured."); };
  return {
    provider: "twilio",
    async connect(input) { return this.startCall(input); },
    async sendAudio() { throw new Error("Twilio audio is delivered through the configured Media Streams websocket."); },
    async stopAudio() { return; },
    async startCall(input) {
      if (!accountSid || !authToken || !from || !baseUrl || !input.phoneNumber) return unavailable() as never;
      const form = new URLSearchParams({ To: input.phoneNumber, From: from, Url: `${baseUrl}/api/voice/twilio/answer?employeeId=${encodeURIComponent(input.employeeId)}&conversationId=${encodeURIComponent(input.conversationId)}`, StatusCallback: `${baseUrl}/api/voice/twilio/status`, StatusCallbackMethod: "POST", StatusCallbackEvent: "initiated ringing answered completed" });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Twilio call initiation failed.");
      return { providerCallId: data.sid as string, status: "queued" as const };
    },
    async endCall({ providerCallId }) {
      if (!accountSid || !authToken) return unavailable() as never;
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${providerCallId}.json`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ Status: "completed" }) });
      if (!response.ok) throw new Error("Twilio call termination failed.");
    },
  };
}
