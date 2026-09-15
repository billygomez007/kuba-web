/**
 * The one canonical VoiceConfig shape + parser, extracted from
 * app/api/ai-employees/[id]/voice/route.ts (previously duplicated as a
 * narrower, independently-defined type in app/api/voice/calls/route.ts —
 * both read the exact same stored string, so a second slightly-different
 * shape risked silently drifting out of sync). Stored as a JSON blob
 * appended to aiEmployeeSettings.roleInstructions after a marker string —
 * a workaround, not a dedicated schema column, but not something this
 * pass changes.
 */

const marker = "\n\nVoice capability configuration:\n";

export type VoiceConfig = {
  enabled: boolean;
  phoneNumber: string;
  callDirection: "inbound" | "outbound" | "both";
  provider: string;
  voiceModel: string;
  language: string;
  accent: string;
  speakingStyle: string;
  tone: string;
  speed: number;
  workingHours: string;
  maxDailyCalls: number;
  maxCallDurationMinutes: number;
  allowedCallTypes: string[];
  callPermissions: string[];
  humanTransferRules: string[];
  transferDestination: string;
  automationEvents: string[];
};

export const defaultVoiceConfig: VoiceConfig = {
  enabled: false,
  phoneNumber: "",
  callDirection: "both",
  provider: "",
  voiceModel: "",
  language: "English",
  accent: "Neutral",
  speakingStyle: "Professional",
  tone: "Warm and clear",
  speed: 1,
  workingHours: "Business hours",
  maxDailyCalls: 100,
  maxCallDurationMinutes: 30,
  allowedCallTypes: ["Customer enquiries", "Appointments", "Support callbacks"],
  callPermissions: ["Answer calls", "Provide information"],
  humanTransferRules: ["Customer requests a human", "Complaint detected"],
  transferDestination: "Business owner",
  automationEvents: ["call.started", "call.completed", "call.missed", "customer.requested_callback", "call.escalated"],
};

export const voiceConfigMarker = marker;

export function parseVoiceConfig(value: string | null | undefined): VoiceConfig {
  if (!value || !value.includes(marker)) return defaultVoiceConfig;
  try {
    return { ...defaultVoiceConfig, ...JSON.parse(value.slice(value.indexOf(marker) + marker.length)) };
  } catch {
    return defaultVoiceConfig;
  }
}

export function serializeVoiceConfig(existingRoleInstructions: string | null | undefined, config: VoiceConfig): string {
  const current = existingRoleInstructions || "";
  const base = current.includes(marker) ? current.slice(0, current.indexOf(marker)) : current;
  return `${base}${marker}${JSON.stringify(config)}`;
}
