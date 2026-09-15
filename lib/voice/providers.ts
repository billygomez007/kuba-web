import { createOpenAIRealtimeTransport } from "@/lib/voice/adapters/openai-realtime";
import { createTwilioTransport } from "@/lib/voice/adapters/twilio";
import { createPlivoTransport } from "@/lib/voice/adapters/plivo";

export type VoiceProviderId =
  | "openai-realtime"
  | "twilio"
  | "plivo"
  | "retell"
  | "vapi"
  | "sip";

export type VoiceProvider = {
  id: VoiceProviderId;
  name: string;
  status: "available" | "planned";
  models: string[];
  // "platform": credentials are owned/managed by SuperKuba itself
  // (server-side env vars) — a business never pastes a secret for
  // these, and the Settings UI must say so honestly rather than
  // presenting a credential form no working code path reads (see
  // Phase 31 of the voice audit, and the Email pass's identical fix for
  // per-business sender identity). "business": a business connects its
  // own account (the existing Twilio/future-provider pattern of pasting
  // an account id + secret via /api/settings/voice-providers).
  credentialModel: "platform" | "business";
};

// `status` must reflect whether `getVoiceTransport` actually returns a
// working transport below, not aspiration — retell/vapi/sip have no
// adapter implementation and would silently fail at call time if a
// business were allowed to connect one (see PRODUCTION_CONFIGURATION_
// CHECKLIST.md and the voice audit: these were previously mislabeled
// "available", letting a business save credentials for a provider that
// can never place or receive a call).
export const voiceProviders: VoiceProvider[] = [
  { id: "openai-realtime", name: "OpenAI Realtime API", status: "available", models: ["gpt-realtime"], credentialModel: "platform" },
  // Twilio's adapter (lib/voice/adapters/twilio.ts) reads
  // TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN from server env vars — it does
  // NOT read the per-business encrypted credentials
  // /api/settings/voice-providers previously let a business "save" here.
  // That was a real, pre-existing UI/backend mismatch (a business could
  // see "Connected" while the actual call-placing code silently ignored
  // what they saved and used the platform's own credentials instead) —
  // fixed by marking it "platform" honestly, the same fix this field
  // exists for Plivo in the first place.
  { id: "twilio", name: "Twilio", status: "available", models: ["voice-media-stream"], credentialModel: "platform" },
  { id: "plivo", name: "Plivo", status: "available", models: ["voice-media-stream"], credentialModel: "platform" },
  { id: "retell", name: "Retell AI", status: "planned", models: ["retell-default"], credentialModel: "business" },
  { id: "vapi", name: "Vapi", status: "planned", models: ["vapi-default"], credentialModel: "business" },
  { id: "sip", name: "SIP provider", status: "planned", models: ["sip-bridge"], credentialModel: "business" },
];

export type VoiceTransport = {
  provider: VoiceProviderId;
  connect: (input: { employeeId: string; conversationId: string; direction: "inbound" | "outbound"; phoneNumber?: string }) => Promise<{ providerCallId: string; status: "queued" | "ringing" | "connecting" | "connected" | "active" }>;
  sendAudio: (input: { providerCallId: string; audio: Uint8Array }) => Promise<void>;
  stopAudio: (input: { providerCallId: string }) => Promise<void>;
  startCall: (input: {
    employeeId: string;
    conversationId: string;
    direction: "inbound" | "outbound";
    phoneNumber?: string;
  }) => Promise<{ providerCallId: string; status: "queued" | "ringing" | "connecting" | "connected" | "active" }>;
  endCall: (input: { providerCallId: string }) => Promise<void>;
};

export function getVoiceProvider(id: string) {
  return voiceProviders.find((provider) => provider.id === id);
}

export function getVoiceTransport(id: string): VoiceTransport | null {
  const provider = getVoiceProvider(id);
  if (!provider) return null;

  if (provider.id === "openai-realtime") {
    return createOpenAIRealtimeTransport();
  }
  if (provider.id === "twilio") {
    return createTwilioTransport();
  }
  if (provider.id === "plivo") {
    return createPlivoTransport();
  }

  return {
    provider: provider.id,
    async connect() {
      throw new Error(`${provider.name} audio transport is not configured.`);
    },
    async sendAudio() {
      throw new Error(`${provider.name} audio transport is not configured.`);
    },
    async stopAudio() {
      throw new Error(`${provider.name} audio transport is not configured.`);
    },
    async startCall() {
      throw new Error(`${provider.name} credentials are not configured for live calls.`);
    },
    async endCall() {
      throw new Error(`${provider.name} audio transport is not configured.`);
    },
  };
}
