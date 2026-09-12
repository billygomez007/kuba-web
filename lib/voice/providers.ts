import { createOpenAIRealtimeTransport } from "@/lib/voice/adapters/openai-realtime";
import { createTwilioTransport } from "@/lib/voice/adapters/twilio";

export type VoiceProviderId =
  | "openai-realtime"
  | "twilio"
  | "retell"
  | "vapi"
  | "sip";

export type VoiceProvider = {
  id: VoiceProviderId;
  name: string;
  status: "available" | "planned";
  models: string[];
};

// `status` must reflect whether `getVoiceTransport` actually returns a
// working transport below, not aspiration — retell/vapi/sip have no
// adapter implementation and would silently fail at call time if a
// business were allowed to connect one (see PRODUCTION_CONFIGURATION_
// CHECKLIST.md and the voice audit: these were previously mislabeled
// "available", letting a business save credentials for a provider that
// can never place or receive a call).
export const voiceProviders: VoiceProvider[] = [
  { id: "openai-realtime", name: "OpenAI Realtime API", status: "available", models: ["gpt-realtime"] },
  { id: "twilio", name: "Twilio", status: "available", models: ["voice-media-stream"] },
  { id: "retell", name: "Retell AI", status: "planned", models: ["retell-default"] },
  { id: "vapi", name: "Vapi", status: "planned", models: ["vapi-default"] },
  { id: "sip", name: "SIP provider", status: "planned", models: ["sip-bridge"] },
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
