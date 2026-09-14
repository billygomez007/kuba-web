import { APICallError, LoadAPIKeyError } from "ai";

/**
 * Safe, internal categories every OpenAI-calling route should classify its
 * failures into (Phase 19 of the OpenAI production-readiness audit). Never
 * expose the raw provider error/status/response body to a customer or
 * website visitor — only these category names and the safe messages below
 * are client-facing; the raw error still goes to server-side console logs
 * for diagnostics.
 */
export type AIProviderErrorCategory =
  | "missing_api_key"
  | "invalid_api_key"
  | "rate_limited"
  | "insufficient_quota"
  | "timeout"
  | "provider_error"
  | "unknown";

export function classifyAIProviderError(
  error: unknown,
): AIProviderErrorCategory {
  if (LoadAPIKeyError.isInstance(error)) {
    return "missing_api_key";
  }

  if (APICallError.isInstance(error)) {
    const status = error.statusCode;

    if (status === 401) {
      return "invalid_api_key";
    }

    if (status === 429) {
      // OpenAI uses the same 429 status for both true rate limiting and
      // quota exhaustion, distinguishing them only in the response body's
      // error.code/error.type — check the body text rather than assuming.
      const body = (error.responseBody || "").toLowerCase();
      if (
        body.includes("insufficient_quota") ||
        body.includes("insufficient quota") ||
        body.includes("exceeded your current quota")
      ) {
        return "insufficient_quota";
      }
      return "rate_limited";
    }

    if (typeof status === "number" && status >= 500) {
      return "provider_error";
    }
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  if (
    (error instanceof Error && error.name === "AbortError") ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "timeout";
  }

  return "unknown";
}

/**
 * Customer/website-visitor-safe message for a classified failure — no
 * provider name, status code, or response detail. Pair with server-side
 * console logging of the real error for diagnostics (see
 * lib/ai/usage-logging.ts).
 */
export function safeAIErrorMessage(
  category: AIProviderErrorCategory,
): string {
  switch (category) {
    case "missing_api_key":
    case "invalid_api_key":
      return "This AI service is not configured correctly right now.";
    case "rate_limited":
      return "This AI service is busy right now. Please try again shortly.";
    case "insufficient_quota":
      return "This AI service has reached its usage limit.";
    case "timeout":
      return "This AI service took too long to respond. Please try again.";
    case "provider_error":
      return "This AI service is temporarily unavailable. Please try again shortly.";
    default:
      return "Unable to generate a response right now.";
  }
}
