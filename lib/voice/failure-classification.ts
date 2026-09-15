/**
 * Safe, fixed-vocabulary call failure classification (Phase 28) — never
 * exposes a raw provider response/error string to a customer or to the
 * browser; classification here is the only thing ever surfaced outward.
 * Mirrors lib/email/error-classification.ts's shape and reasoning for
 * the same problem in a different channel.
 */
export type VoiceFailureCategory =
  | "PLIVO_AUTH_ERROR"
  | "NUMBER_NOT_CONFIGURED"
  | "INVALID_DESTINATION"
  | "CALL_REJECTED"
  | "BUSY"
  | "NO_ANSWER"
  | "PROVIDER_ERROR"
  | "OPENAI_ERROR"
  | "STREAM_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

/**
 * Classifies Plivo's hangup event (hangup_url) into a truthful
 * completed-vs-failed outcome, using HangupCauseName (the field Plivo's
 * documentation associates with hangup events — NOT a `CallStatus`
 * field, which belongs to a different callback shape) as the primary
 * signal, with call duration as a fallback signal for causes this
 * mapping doesn't recognize. Plivo's exact HangupCauseName vocabulary
 * could not be verified against a live call in this environment — this
 * covers the commonly documented values and degrades to a safe,
 * honest "completed if any duration elapsed, else UNKNOWN failure"
 * default for anything unrecognized, never inventing a category and
 * never calling a zero-duration call "completed" merely because the API
 * accepted the request (Phase 18's explicit requirement).
 */
export function classifyPlivoHangup(
  hangupCauseName: string | null | undefined,
  durationSeconds: number,
): { completed: true } | { completed: false; failureCategory: VoiceFailureCategory } {
  const cause = (hangupCauseName || "").toUpperCase();

  if (cause.includes("NORMAL")) return { completed: true };
  if (cause.includes("BUSY")) return { completed: false, failureCategory: "BUSY" };
  if (cause.includes("NO_ANSWER") || cause.includes("NO-ANSWER") || cause.includes("TIMEOUT")) return { completed: false, failureCategory: cause.includes("TIMEOUT") ? "TIMEOUT" : "NO_ANSWER" };
  if (cause.includes("CANCEL") || cause.includes("REJECT")) return { completed: false, failureCategory: "CALL_REJECTED" };
  if (cause.includes("INVALID") || cause.includes("UNALLOCATED") || cause.includes("NOT_FOUND")) return { completed: false, failureCategory: "INVALID_DESTINATION" };
  if (durationSeconds > 0) return { completed: true };
  return { completed: false, failureCategory: "UNKNOWN" };
}

export function classifyPlivoApiError(errorMessage: string): VoiceFailureCategory {
  const message = errorMessage.toLowerCase();
  if (message.includes("auth") || message.includes("unauthorized") || message.includes("forbidden")) return "PLIVO_AUTH_ERROR";
  if (message.includes("invalid") && (message.includes("destination") || message.includes("number") || message.includes("to"))) return "INVALID_DESTINATION";
  if (message.includes("timeout")) return "TIMEOUT";
  return "PROVIDER_ERROR";
}

/**
 * Safe, fixed customer/UI-facing message per category — never the raw
 * provider error/response (Phase 28).
 */
export function safeVoiceFailureMessage(category: VoiceFailureCategory): string {
  const messages: Record<VoiceFailureCategory, string> = {
    PLIVO_AUTH_ERROR: "The call could not be started due to a provider configuration issue.",
    NUMBER_NOT_CONFIGURED: "This number is not configured to make or receive calls.",
    INVALID_DESTINATION: "The destination number is invalid.",
    CALL_REJECTED: "The call was rejected.",
    BUSY: "The line was busy.",
    NO_ANSWER: "The call was not answered.",
    PROVIDER_ERROR: "The call could not be completed due to a provider error.",
    OPENAI_ERROR: "The AI voice runtime encountered an error.",
    STREAM_ERROR: "The audio connection failed.",
    TIMEOUT: "The call timed out.",
    UNKNOWN: "The call could not be completed.",
  };
  return messages[category];
}
