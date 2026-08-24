import { runAutomationTrigger } from "@/lib/automations/engine";

export type VoiceEvent =
  | "voice.call_started"
  | "voice.call_completed"
  | "voice.call_missed"
  | "voice.callback_requested"
  | "voice.escalated";

export async function emitVoiceEvent({
  businessId,
  event,
  data,
}: {
  businessId: string;
  event: VoiceEvent;
  data: Record<string, unknown>;
}) {
  return runAutomationTrigger({
    businessId,
    trigger: event,
    data: {
      ...data,
      channel: "voice",
    },
  });
}
