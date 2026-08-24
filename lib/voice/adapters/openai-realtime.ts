import type { VoiceProviderId, VoiceTransport } from "@/lib/voice/providers";

type OpenAISocket = WebSocket & { close: () => void };

export function createOpenAIRealtimeTransport(): VoiceTransport {
  const sockets = new Map<string, OpenAISocket>();
  const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";
  const apiKey = process.env.OPENAI_API_KEY;
  const unsupported = () => { throw new Error("OPENAI_API_KEY is not configured for realtime voice."); };
  return {
    provider: "openai-realtime" as VoiceProviderId,
    async connect(input) {
      if (!apiKey) return unsupported() as never;
      const callId = crypto.randomUUID();
      const socket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, ["realtime", `openai-insecure-api-key.${apiKey}`, "openai-beta.realtime-v1"]) as OpenAISocket;
      await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(new Error("OpenAI Realtime connection timed out.")), 10000); socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }); socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("OpenAI Realtime connection failed.")); }); });
      socket.send(JSON.stringify({ type: "session.update", session: { modalities: ["text", "audio"], model, voice: process.env.OPENAI_REALTIME_VOICE || "alloy", input_audio_format: "g711_ulaw", output_audio_format: "g711_ulaw", turn_detection: { type: "server_vad", interrupt_response: true } } }));
      sockets.set(callId, socket);
      return { providerCallId: callId, status: "active" as const };
    },
    async sendAudio({ providerCallId, audio }) { const socket = sockets.get(providerCallId); if (!socket) throw new Error("OpenAI Realtime session not found."); socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: Buffer.from(audio).toString("base64") })); },
    async stopAudio({ providerCallId }) { sockets.get(providerCallId)?.send(JSON.stringify({ type: "response.cancel" })); },
    async startCall(input) { return this.connect(input); },
    async endCall({ providerCallId }) { const socket = sockets.get(providerCallId); if (socket) { socket.send(JSON.stringify({ type: "response.cancel" })); socket.close(); sockets.delete(providerCallId); } },
  };
}
