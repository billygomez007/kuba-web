/**
 * Safe, internal error categories for email provider (Resend) failures —
 * Phase 29 of the email audit. This is intentionally a SEPARATE, more
 * granular taxonomy from lib/outreach/send-worker.ts's own
 * RETRYABLE_FAILURE_CODES/PERMANENT_FAILURE_CODES, which is the existing,
 * tested contract governing the campaign send worker's actual retry
 * decisions and is NOT changed here. This module exists for safe logging
 * and safe user-facing messages (never raw provider responses/secrets);
 * `toSendWorkerFailureCode` is the one bridge between the two, used only
 * where a caller needs the worker's own FailureCode shape.
 */
export type EmailErrorCategory =
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "DOMAIN_NOT_VERIFIED"
  | "RECIPIENT_REJECTED"
  | "BOUNCE"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INVALID_ADDRESS"
  | "UNKNOWN";

/**
 * Resend's own documented/observed error `name` values (snake_case) — see
 * lib/outreach/email-channel.ts's pre-existing isRetryableResendError for
 * the subset already relied on for retry decisions.
 */
const AUTH_ERROR_NAMES = new Set(["missing_api_key", "invalid_api_key", "restricted_api_key"]);
const RATE_LIMIT_NAMES = new Set(["rate_limit_exceeded", "daily_quota_exceeded"]);
const DOMAIN_NAMES = new Set(["domain_not_verified"]);
const ADDRESS_NAMES = new Set(["invalid_to_address", "invalid_from_address", "invalid_reply_to_address"]);
const PROVIDER_ERROR_NAMES = new Set(["internal_server_error", "application_error"]);

export function classifyEmailProviderError(error: unknown): EmailErrorCategory {
  const name = extractErrorName(error);
  if (name) {
    if (AUTH_ERROR_NAMES.has(name)) return "AUTH_ERROR";
    if (RATE_LIMIT_NAMES.has(name)) return "RATE_LIMIT";
    if (DOMAIN_NAMES.has(name)) return "DOMAIN_NOT_VERIFIED";
    if (ADDRESS_NAMES.has(name)) return "INVALID_ADDRESS";
    if (PROVIDER_ERROR_NAMES.has(name)) return "PROVIDER_ERROR";
    if (name === "validation_error") return "RECIPIENT_REJECTED";
  }

  const message = extractErrorMessage(error).toLowerCase();
  if (message.includes("timed out") || message.includes("timeout") || (error instanceof Error && error.name === "AbortError")) {
    return "TIMEOUT";
  }
  if (message.includes("bounce")) return "BOUNCE";

  return "UNKNOWN";
}

function extractErrorName(error: unknown): string | null {
  if (error && typeof error === "object" && "name" in error) {
    const value = (error as { name?: unknown }).name;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/** Customer/log-safe message — never the raw provider error/response. */
export function safeEmailErrorMessage(category: EmailErrorCategory): string {
  switch (category) {
    case "AUTH_ERROR":
      return "Email sending is not configured correctly right now.";
    case "RATE_LIMIT":
      return "Email sending is temporarily rate-limited. Please try again shortly.";
    case "DOMAIN_NOT_VERIFIED":
      return "The sending domain for this account is not verified yet.";
    case "RECIPIENT_REJECTED":
    case "INVALID_ADDRESS":
      return "This email address could not be reached.";
    case "BOUNCE":
      return "This email bounced and could not be delivered.";
    case "TIMEOUT":
      return "Email sending took too long. Please try again.";
    case "PROVIDER_ERROR":
      return "Email sending is temporarily unavailable. Please try again shortly.";
    default:
      return "Unable to send this email right now.";
  }
}

/**
 * The only bridge into lib/outreach/send-worker.ts's existing, tested
 * FailureCode taxonomy — used where a caller needs that specific shape
 * (e.g. a future send path reusing the worker's retry state machine).
 * Never used to change how the existing outbound campaign path already
 * classifies retryable vs. permanent (email-channel.ts keeps its own
 * isRetryableResendError check exactly as before).
 */
export function toSendWorkerFailureCode(
  category: EmailErrorCategory,
): "rate_limited" | "provider_5xx" | "invalid_recipient" | "provider_rejected_permanent" {
  switch (category) {
    case "RATE_LIMIT":
      return "rate_limited";
    case "PROVIDER_ERROR":
    case "TIMEOUT":
      return "provider_5xx";
    case "INVALID_ADDRESS":
    case "RECIPIENT_REJECTED":
      return "invalid_recipient";
    default:
      return "provider_rejected_permanent";
  }
}
